/**
 * Process Module
 *
 * Provides the central orchestration and runtime environment for the framework components.
 */

import { EventEmitter } from 'events';

import { Agent } from '../agent';
import { AgentConfig } from '../agent/types';
import { Logger, createLogger, LogLevel } from '../logger';
import { Memory } from '../memory';
import { Thread } from '../memory/types';
import { Repository, SQLiteRepository as SQLiteStorage } from '../repository';
import { Workflow, WorkflowInstance } from '../workflows';
import {
  ExecutionMode,
  RetryConfig,
  StepSchemaConfig,
  WorkflowEventDefinition,
  WorkflowRepository,
  TelemetryProvider,
  WorkflowState,
} from '../workflows/types';

/**
 * API middleware type definition
 */
export type ApiMiddleware = {
  path?: string;
  handler: (req: any, res: any, next: () => void) => void;
};

/**
 * Collab type definition (placeholder - implement actual type later)
 */
export type Collab = any;

/**
 * Adapter to use SQLiteStorage as WorkflowRepository
 */
export class RepositoryAdapter implements WorkflowRepository {
  private repository: Repository;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  async saveWorkflow(workflowId: string, state: WorkflowState): Promise<string> {
    // Generate a unique ID with timestamp and random component
    const randomId = Math.random().toString(36).substring(2, 10);
    const persistenceId = `workflow:${workflowId}:${Date.now()}-${randomId}`;

    // Create a thread to store the workflow state
    await this.repository.createThread({
      id: persistenceId,
      title: `Workflow ${workflowId}`,
      resourceId: 'workflow', // Required field
      metadata: { workflowId, state },
    });

    return persistenceId;
  }

  async loadWorkflow(persistenceId: string): Promise<WorkflowState> {
    const thread = await this.repository.getThread(persistenceId);
    if (!thread || !thread.metadata) {
      throw new Error(`Workflow state not found for ${persistenceId}`);
    }

    return thread.metadata.state as WorkflowState;
  }

  async updateStepResult(persistenceId: string, stepId: string, result: any): Promise<void> {
    const thread = await this.repository.getThread(persistenceId);
    if (!thread || !thread.metadata) {
      throw new Error(`Workflow state not found for ${persistenceId}`);
    }

    const state = thread.metadata.state as WorkflowState;
    state.steps[stepId] = result;

    await this.repository.updateThread(persistenceId, {
      metadata: { ...thread.metadata, state },
    });
  }

  async listWorkflows(filters?: Record<string, any>): Promise<string[]> {
    const threads = await this.repository.listThreads({
      resourceId: 'workflow',
    });
    return threads
      .filter((thread: Thread) => thread.metadata && thread.metadata.workflowId)
      .map((thread: Thread) => thread.id);
  }
}

/**
 * Process events enum
 */
export enum ProcessEvent {
  AGENT_CREATED = 'agent:created',
  AGENT_DELETED = 'agent:deleted',
  WORKFLOW_CREATED = 'workflow:created',
  WORKFLOW_DELETED = 'workflow:deleted',
  WORKFLOW_STARTED = 'workflow:started',
  WORKFLOW_COMPLETED = 'workflow:completed',
  WORKFLOW_FAILED = 'workflow:failed',
  MEMORY_INITIALIZED = 'memory:initialized',
  PERSISTENCE_INITIALIZED = 'persistence:initialized',
}

/**
 * Workflow configuration for process
 */
export interface WorkflowConfig {
  id?: string;
  triggerSchema?: any;
  retryConfig?: RetryConfig;
  agents?: Record<string, any>;
  events?: WorkflowEventDefinition[];
  defaultExecutionMode?: ExecutionMode;
  steps?: Record<
    string,
    {
      execute: Function;
      schema?: StepSchemaConfig;
    }
  >;
  repository?: WorkflowRepository;
  telemetryProvider?: TelemetryProvider;
}

/**
 * Process configuration type
 */
export type ProcessConfig = {
  agents?: Record<
    string,
    Omit<AgentConfig, 'logger'> & {
      name?: string;
      instructions?: string;
      goal?: string;
      role?: string;
    }
  >;
  workflow?: WorkflowConfig;
  logger?: Logger;
  repository?: Repository;
  apiMiddleware?: ApiMiddleware[];
  memory?: Memory;
  collab?: Record<string, Collab>;
};

type AgentConfigWithLogger = AgentConfig & {
  logger: Logger;
  name?: string;
  instructions?: string;
  goal?: string;
  role?: string;
};

/**
 * Process class
 *
 * Central orchestrator and runtime environment for framework components.
 * Manages the instantiation, execution, and monitoring of agents, workflows,
 * and other components during application runtime.
 */
export class Process extends EventEmitter {
  private agents: Record<string, Agent> = {};
  private logger: Logger;
  private workflow: Workflow | undefined;
  private apiMiddleware: ApiMiddleware[] = [];
  private repository?: Repository;
  private workflowRepository?: WorkflowRepository;
  private memory?: Memory;
  private collab: Record<string, Collab> = {};
  private workflowInstance?: WorkflowInstance;
  private initialized = false;

  /**
   * Creates a new Process instance
   *
   * @param config Optional configuration object
   */
  constructor(config?: ProcessConfig) {
    super();

    // Initialize logger
    this.logger = config?.logger || createLogger({ name: 'process', level: LogLevel.INFO });
    this.logger.info('Initializing Process');

    // Initialize core components
    this.initializePersistence(config);
    this.initializeAgents(config);
    this.initializeWorkflow(config);

    // Set other properties
    this.apiMiddleware = config?.apiMiddleware || [];
    this.memory = config?.memory;
    this.collab = config?.collab || {};
  }

  /**
   * Initialize persistence components
   * @private
   */
  private initializePersistence(config?: ProcessConfig): void {
    // Initialize persistence
    if (config?.repository) {
      this.repository = config.repository;
    } else {
      const storageUrl = process.env.DEFAULT_STORAGE_URL || ':memory:';
      this.repository = new SQLiteStorage({ dbPath: storageUrl });
    }

    // Create persistent storage adapter
    this.workflowRepository = new RepositoryAdapter(this.repository);

    this.logger.debug('Persistence initialized');
  }

  /**
   * Initialize agents from configuration
   * @private
   */
  private initializeAgents(config?: ProcessConfig): void {
    if (!config?.agents) {
      this.logger.debug('No agents in configuration');
      return;
    }

    Object.entries(config.agents).forEach(([id, agentConfig]) => {
      this.createAndRegisterAgent(id, agentConfig);
    });

    this.logger.info('Agents initialized', { count: Object.keys(this.agents).length });
  }

  /**
   * Create and register a single agent
   * @private
   */
  private createAndRegisterAgent(
    id: string,
    agentConfig: Omit<AgentConfig, 'logger'> & {
      name?: string;
      instructions?: string;
      goal?: string;
      role?: string;
    },
  ): void {
    // Create child logger with agent context
    const agentLogger = createLogger({
      name: 'agent',
      level: LogLevel.INFO,
      context: { component: `agent:${id}` },
    });

    // Create the agent
    const agent = new Agent({
      ...agentConfig,
      metadata: {
        name: agentConfig.name || id,
        agentId: id,
        instructions: agentConfig.instructions || '',
        goal: agentConfig.goal,
        role: agentConfig.role,
      },
      // Add logger (using type assertion to avoid type error)
      logger: agentLogger,
    } as AgentConfigWithLogger);

    this.agents[id] = agent;
    this.emit(ProcessEvent.AGENT_CREATED, { agentId: id, agent: this.agents[id] });
  }

  /**
   * Initialize workflow from configuration
   * @private
   */
  private initializeWorkflow(config?: ProcessConfig): void {
    if (!config?.workflow) {
      this.logger.debug('No workflow in configuration');
      return;
    }

    // Create child logger with workflow context
    const workflowLogger = createLogger({
      name: 'workflow',
      level: LogLevel.INFO,
      context: { component: `workflow:${config.workflow.id || 'main'}` },
    });

    const workflowId = config.workflow.id || 'main';

    // Create the workflow
    const workflowOptions = {
      ...config.workflow,
      repository: this.workflowRepository,
    };

    // Create the workflow instance with the proper config
    this.workflow = new Workflow(workflowId, workflowOptions);

    this.emit(ProcessEvent.WORKFLOW_CREATED, {
      workflowId,
      workflow: this.workflow,
    });

    this.logger.info('Workflow initialized', { workflowId });
  }

  /**
   * Initializes the process and all components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize persistence
    if (this.repository) {
      await this.repository.init();
      this.emit(ProcessEvent.PERSISTENCE_INITIALIZED, { persistence: this.repository });
      this.logger.info('Persistence initialized');
    }

    this.initialized = true;
    this.logger.info('Process fully initialized');
  }

  /**
   * Gets the logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Gets the memory instance
   */
  getMemory(): Memory | undefined {
    return this.memory;
  }

  /**
   * Sets a new memory instance
   * @param memory Memory instance
   */
  setMemory(memory: Memory): void {
    this.memory = memory;
    this.emit(ProcessEvent.MEMORY_INITIALIZED, { memory });
    this.logger.info('Memory set');
  }

  /**
   * Gets the persistence instance
   */
  getRepository(): Repository | undefined {
    return this.repository;
  }

  /**
   * Gets the API middleware configurations
   */
  getApiMiddleware(): ApiMiddleware[] {
    return this.apiMiddleware;
  }

  /**
   * Gets all collab instances or a specific one by ID
   * @param id Optional ID to get a specific collab instance
   */
  getCollabs(id?: string): Record<string, Collab> | Collab | undefined {
    if (!this.collab) {
      return undefined;
    }

    if (id) {
      return this.collab[id];
    }

    return this.collab;
  }

  /**
   * Gets all running agent instances
   */
  getAgents(): Record<string, Agent> {
    return this.agents;
  }

  /**
   * Gets a specific running agent instance by ID
   * @param id The agent ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents[id];
  }

  /**
   * Registers a new agent with the process
   * @param id Agent ID
   * @param agent Agent instance or configuration
   */
  registerAgent(
    id: string,
    agent:
      | Agent
      | (Omit<AgentConfig, 'logger'> & {
          name?: string;
          instructions?: string;
          goal?: string;
          role?: string;
        }),
  ): Agent {
    if (this.agents[id]) {
      this.logger.warn(`Agent with ID ${id} already exists, replacing`);
    }

    if (!(agent instanceof Agent)) {
      // Create child logger with agent context
      const agentLogger = createLogger({
        name: 'agent',
        level: LogLevel.INFO,
        context: { component: `agent:${id}` },
      });

      // Ensure the agent has a name
      const agentConfig = {
        ...agent,
        metadata: {
          name: agent.name || id,
          agentId: id,
          instructions: agent.instructions || '',
          goal: agent.goal,
          role: agent.role,
        },
        logger: agentLogger,
      } as AgentConfigWithLogger;

      agent = new Agent(agentConfig);
    }

    this.agents[id] = agent as Agent;
    this.emit(ProcessEvent.AGENT_CREATED, { agentId: id, agent: this.agents[id] });
    this.logger.info(`Agent ${id} registered`);

    return this.agents[id];
  }

  /**
   * Removes an agent from the process
   * @param id Agent ID
   */
  unregisterAgent(id: string): void {
    if (this.agents[id]) {
      delete this.agents[id];
      this.emit(ProcessEvent.AGENT_DELETED, { agentId: id });
      this.logger.info(`Agent ${id} unregistered`);
    }
  }

  /**
   * Gets the current workflow
   */
  getWorkflow(): Workflow | undefined {
    return this.workflow;
  }

  /**
   * Sets or replaces the current workflow
   * @param workflow Workflow instance or configuration
   * @param id Optional workflow ID
   */
  setWorkflow(workflow: Workflow | WorkflowConfig, id = 'main'): Workflow {
    if (!(workflow instanceof Workflow)) {
      // Create the workflow with the specified config
      const workflowOptions = {
        ...workflow,
        repository: this.workflowRepository,
      };

      workflow = new Workflow(id, workflowOptions);
    }

    // Emit deletion event if replacing an existing workflow
    if (this.workflow) {
      this.emit(ProcessEvent.WORKFLOW_DELETED, {
        workflowId: this.workflow instanceof Workflow ? this.workflow.getName() : 'unknown',
      });
    }

    this.workflow = workflow;
    this.emit(ProcessEvent.WORKFLOW_CREATED, { workflowId: id, workflow });
    this.logger.info(`Workflow ${id} set`);

    return workflow;
  }

  /**
   * Removes the current workflow
   */
  clearWorkflow(): void {
    if (this.workflow) {
      const workflowId = this.workflow instanceof Workflow ? this.workflow.getName() : 'unknown';
      this.workflow = undefined;
      this.emit(ProcessEvent.WORKFLOW_DELETED, { workflowId });
      this.logger.info(`Workflow ${workflowId} cleared`);
    }
  }

  /**
   * Starts the current workflow with optional trigger data
   * @param triggerData Optional trigger data
   */
  async startWorkflow(triggerData?: any): Promise<WorkflowInstance | undefined> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.workflow) {
      this.logger.warn('No workflow set, cannot start');
      return undefined;
    }

    const workflowId = this.workflow instanceof Workflow ? this.workflow.getName() : 'unknown';
    const randomId = Math.random().toString(36).substring(2, 10);
    const instanceId = `${workflowId}-${Date.now()}-${randomId}`;

    try {
      // Create workflow instance
      this.workflowInstance = this.workflow.createRun(triggerData);

      this.emit(ProcessEvent.WORKFLOW_STARTED, {
        workflowId,
        instanceId,
        triggerData,
      });

      // Start the workflow instance
      await this.workflowInstance.start();

      return this.workflowInstance;
    } catch (error) {
      this.emit(ProcessEvent.WORKFLOW_FAILED, {
        workflowId,
        instanceId,
        error,
      });

      throw error;
    }
  }

  /**
   * Starts the Process, initiating the current workflow
   */
  async run(triggerData?: any): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Starting Process');

    if (!this.workflow) {
      this.logger.warn('No workflow configured, nothing to run');
      return;
    }

    try {
      await this.startWorkflow(triggerData);
      this.logger.info('Process run completed');
    } catch (error) {
      this.logger.error('Error running process', { error });
      throw error;
    }
  }

  /**
   * Handle workflow started event
   * @private
   */
  private handleWorkflowStarted({
    workflowId,
    instanceId,
    triggerData,
  }: {
    workflowId: string;
    instanceId: string;
    triggerData: any;
  }): void {
    this.logger.info(`Workflow ${workflowId} started`, { instanceId, triggerData });
  }

  /**
   * Handle workflow completed event
   * @private
   */
  private handleWorkflowCompleted({
    workflowId,
    instanceId,
    results,
  }: {
    workflowId: string;
    instanceId: string;
    results: any;
  }): void {
    this.logger.info(`Workflow ${workflowId} completed`, { instanceId, results });
    // Clear the workflow instance reference
    this.workflowInstance = undefined;
  }

  /**
   * Handle workflow failed event
   * @private
   */
  private handleWorkflowFailed({
    workflowId,
    instanceId,
    error,
  }: {
    workflowId: string;
    instanceId: string;
    error: any;
  }): void {
    this.logger.error(`Workflow ${workflowId} failed`, { instanceId, error });
    // Clear the workflow instance reference
    this.workflowInstance = undefined;
  }
}
