import { z } from 'zod';

import { Agent } from '../agent/agent';
import { Logger, createWorkflowLogger } from '../logger';
import { LogLevel } from '../logger/types';
import { SQLiteRepository } from '../repository';

import { WorkflowInstance } from './instance';
import { createMachine } from './machine';
import { Step } from './step';
import {
  StepId,
  RetryConfig,
  WorkflowEventDefinition,
  ConditionSpec,
  ExecuteFn,
  StepSchemaConfig,
  ExecutionMode,
  StepGroup,
  WorkflowContext,
  WorkflowRepository,
  WorkflowEventHandler,
  A2Agent,
  TraceSpan,
  TelemetryProvider,
  WorkflowState,
} from './types';

// Create a WorkflowRepository implementation that adapts the existing repository
class WorkflowRepositoryAdapter implements WorkflowRepository {
  constructor() {}

  async saveWorkflow(workflowId: string, state: WorkflowState): Promise<string> {
    // Implement workflow state persistence
    return workflowId; // Return persistence ID
  }

  async loadWorkflow(persistenceId: string): Promise<WorkflowState> {
    // Implement workflow state loading
    throw new Error('Method not implemented');
  }

  async updateStepResult(persistenceId: string, stepId: StepId, result: any): Promise<void> {
    // Implement step result updating
  }

  async listWorkflows(filters?: Record<string, any>): Promise<string[]> {
    // Implement workflow listing
    return [];
  }
}

export class Workflow {
  private name: string;
  private steps: Map<StepId, Step> = new Map();
  private triggerSchema?: z.ZodType<any>;
  private stepGraph: Map<StepId, StepId[]> = new Map();
  private retryConfig?: RetryConfig;
  private eventDefinitions: WorkflowEventDefinition[] = [];
  private agents: Record<string, Agent> = {};
  private stepGroups: Map<string, StepGroup> = new Map();
  private defaultExecutionMode: ExecutionMode = ExecutionMode.SEQUENTIAL;
  private repository: WorkflowRepository;
  private stateMachine: any; // XState machine
  private globalEventHandlers: WorkflowEventHandler[] = [];
  private logger: Logger;
  private telemetryProvider?: TelemetryProvider;

  constructor(
    name: string,
    options?: {
      triggerSchema?: z.ZodType<any>;
      retryConfig?: RetryConfig;
      agents?: Record<string, Agent>;
      events?: WorkflowEventDefinition[];
      defaultExecutionMode?: ExecutionMode;
      repository?: WorkflowRepository;
      logLevel?: LogLevel;
      telemetryProvider?: TelemetryProvider;
    },
  ) {
    this.name = name;
    this.triggerSchema = options?.triggerSchema;
    this.retryConfig = options?.retryConfig;
    this.agents = options?.agents || {};
    this.eventDefinitions = options?.events || [];
    this.defaultExecutionMode = options?.defaultExecutionMode || ExecutionMode.SEQUENTIAL;
    this.repository = options?.repository || new WorkflowRepositoryAdapter();
    this.telemetryProvider = options?.telemetryProvider;

    // Initialize logger for this workflow
    this.logger = createWorkflowLogger({
      workflowId: this.name,
      level: options?.logLevel || LogLevel.INFO,
    });

    // Initialize state machine
    this.initializeStateMachine();
  }

  private initializeStateMachine(): void {
    // Using our simplified state machine implementation
    this.stateMachine = createMachine({
      id: `workflow-${this.name}`,
      initial: 'idle',
      states: {
        idle: {
          on: { START: 'running' },
        },
        running: {
          on: {
            COMPLETE: 'completed',
            FAIL: 'failed',
            SUSPEND: 'suspended',
          },
        },
        suspended: {
          on: {
            RESUME: 'running',
            TERMINATE: 'terminated',
          },
        },
        completed: {
          type: 'final',
        },
        failed: {
          on: {
            RETRY: 'running',
          },
        },
        terminated: {
          type: 'final',
        },
      },
    });
  }

  step<TInput = any, TOutput = any>(
    id: StepId,
    execute: ExecuteFn<TInput, TOutput>,
    schemaConfig: StepSchemaConfig<TInput, TOutput>,
  ): Step<TInput, TOutput> {
    const step = new Step<TInput, TOutput>(id, execute, schemaConfig);
    this.steps.set(id, step);
    this.stepGraph.set(id, []);

    this.logger.debug(`Added step: ${id}`, { schemaConfig });
    this.validateNoCycles();
    return step;
  }

  group(
    id: string,
    stepIds: StepId[],
    executionMode: ExecutionMode = ExecutionMode.PARALLEL,
  ): this {
    for (const stepId of stepIds) {
      if (!this.steps.has(stepId)) {
        throw new Error(`Cannot create group with unknown step: ${stepId}`);
      }
    }

    this.stepGroups.set(id, {
      id,
      steps: stepIds,
      executionMode,
    });

    this.logger.debug(`Created step group: ${id}`, { steps: stepIds, executionMode });
    return this;
  }

  setDefaultExecutionMode(mode: ExecutionMode): this {
    this.defaultExecutionMode = mode;
    this.logger.debug(`Set default execution mode: ${mode}`);
    return this;
  }

  // Enhanced validation for complex dependencies
  private validateNoCycles(): void {
    const visited = new Set<StepId>();
    const recStack = new Set<StepId>();

    const hasCycle = (stepId: StepId): boolean => {
      if (recStack.has(stepId)) {
        return true;
      }

      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recStack.add(stepId);

      const step = this.steps.get(stepId);
      if (step) {
        for (const dep of step.getDependencies()) {
          if ('stepId' in dep) {
            const dependencyId = typeof dep.stepId === 'string' ? dep.stepId : dep.stepId.id;
            if (hasCycle(dependencyId)) {
              return true;
            }
          } else if ('stepIds' in dep) {
            for (const subDep of dep.stepIds) {
              const dependencyId = typeof subDep === 'string' ? subDep : subDep.id;
              if (hasCycle(dependencyId)) {
                return true;
              }
            }
          }
        }
      }

      recStack.delete(stepId);
      return false;
    };

    for (const stepId of this.steps.keys()) {
      if (hasCycle(stepId)) {
        this.logger.error(`Circular dependency detected in workflow involving step: ${stepId}`);
        throw new Error(`Circular dependency detected in workflow involving step: ${stepId}`);
      }
    }
  }

  legacyStep<TInput = any, TOutput = any>(
    id: StepId,
    execute: ExecuteFn<TInput, TOutput>,
  ): Step<TInput, TOutput> {
    const schemaConfig: StepSchemaConfig<TInput, TOutput> = {
      output: z.object({}).passthrough() as unknown as z.ZodType<TOutput>,
    };
    this.logger.warn(
      `Warning: legacyStep ${id} uses a generic schema. Consider using step() with proper schemas instead.`,
    );
    return this.step(id, execute, schemaConfig);
  }

  registerAgent(name: string, agent: Agent): this {
    this.agents[name] = agent;
    this.logger.info(`Registered agent: ${name}`, { agentId: agent.metadata?.agentId || name });
    return this;
  }

  // Enhanced event system
  addEvent(event: WorkflowEventDefinition): this {
    this.eventDefinitions.push(event);
    this.logger.debug(`Added event definition: ${event.type}`);
    return this;
  }

  onEvent(eventType: string, handler: (event: any, context: any) => Promise<void>): this {
    this.globalEventHandlers.push({ eventType, handler });
    this.logger.debug(`Registered global event handler for: ${eventType}`);
    return this;
  }

  // Complex control flow with if-else branching
  if(condition: ConditionSpec): IfBranchBuilder {
    return new IfBranchBuilder(this, condition);
  }

  // Loop control
  while(condition: ConditionSpec, options?: { maxIterations?: number }): WhileLoopBuilder {
    return new WhileLoopBuilder(this, condition, options);
  }

  // Enhanced persistence
  setRepository(repository: WorkflowRepository): this {
    this.repository = repository;
    this.logger.info('Set repository for workflow');
    return this;
  }

  // Set telemetry provider
  setTelemetryProvider(provider: TelemetryProvider): this {
    this.telemetryProvider = provider;
    this.logger.info('Set telemetry provider for workflow');
    return this;
  }

  createRun(triggerData?: any): WorkflowInstance {
    if (this.triggerSchema && triggerData) {
      try {
        this.triggerSchema.parse(triggerData);
      } catch (error) {
        this.logger.error('Invalid trigger data for workflow', { error });
        throw error;
      }
    }

    // Create a trace span for the entire workflow run
    let rootSpan;
    if (this.telemetryProvider) {
      rootSpan = this.telemetryProvider.startSpan(`workflow:${this.name}`);
      this.telemetryProvider.recordEvent(rootSpan, 'workflow_started', { triggerData });
    }

    this.logger.info('Creating workflow run', { triggerData });

    return new WorkflowInstance(
      this,
      triggerData || {},
      this.steps,
      this.stepGraph,
      this.agents,
      this.stepGroups,
      this.defaultExecutionMode,
      this.stateMachine,
      this.repository,
      this.telemetryProvider,
      rootSpan,
      this.globalEventHandlers,
    );
  }

  // Restore a workflow from persisted state
  async restoreRun(persistenceId: string): Promise<WorkflowInstance | null> {
    this.logger.info(`Attempting to restore workflow run: ${persistenceId}`);

    try {
      const state = await this.repository.loadWorkflow(persistenceId);
      if (!state) {
        this.logger.warn(`Workflow state not found for ID: ${persistenceId}`);
        return null;
      }

      // Create a new span for the restored workflow
      let rootSpan;
      if (this.telemetryProvider) {
        rootSpan = this.telemetryProvider.startSpan(`workflow:${this.name}:restored`);
        this.telemetryProvider.recordEvent(rootSpan, 'workflow_restored', { persistenceId });
      }

      this.logger.info(`Successfully restored workflow run: ${persistenceId}`);

      const instance = new WorkflowInstance(
        this,
        {}, // Will be loaded from persisted state
        this.steps,
        this.stepGraph,
        this.agents,
        this.stepGroups,
        this.defaultExecutionMode,
        this.stateMachine,
        this.repository,
        this.telemetryProvider,
        rootSpan,
        this.globalEventHandlers,
      );

      instance.restoreFromState(state);
      return instance;
    } catch (error) {
      this.logger.error(`Failed to restore workflow: ${persistenceId}`, { error });
      throw error;
    }
  }

  getLogger(): Logger {
    return this.logger;
  }

  getSteps(): Map<StepId, Step> {
    return this.steps;
  }

  getStepGraph(): Map<StepId, StepId[]> {
    return this.stepGraph;
  }

  getName(): string {
    return this.name;
  }

  getAgents(): Record<string, Agent> {
    return this.agents;
  }

  getEventDefinitions(): WorkflowEventDefinition[] {
    return this.eventDefinitions;
  }

  getGlobalEventHandlers(): WorkflowEventHandler[] {
    return this.globalEventHandlers;
  }

  getStepGroups(): Map<string, StepGroup> {
    return this.stepGroups;
  }

  getDefaultExecutionMode(): ExecutionMode {
    return this.defaultExecutionMode;
  }

  getStateMachine(): any {
    return this.stateMachine;
  }

  getRepository(): WorkflowRepository {
    return this.repository;
  }

  getTelemetryProvider(): TelemetryProvider | undefined {
    return this.telemetryProvider;
  }
}

// Helper class for building 'if' branches
class IfBranchBuilder {
  private workflow: Workflow;
  private condition: ConditionSpec;
  private thenSteps: Step[] = [];
  private elseSteps: Step[] = [];

  constructor(workflow: Workflow, condition: ConditionSpec) {
    this.workflow = workflow;
    this.condition = condition;
  }

  then(step: Step | ((context: WorkflowContext) => Step)): IfBranchBuilder {
    if (typeof step === 'function') {
      // We can't evaluate the function yet, so we'll keep the function reference
      // and eval it at execution time
      this.thenSteps.push(step as unknown as Step);
    } else {
      this.thenSteps.push(step);
    }
    return this;
  }

  else(step: Step | ((context: WorkflowContext) => Step)): IfBranchBuilder {
    if (typeof step === 'function') {
      // We can't evaluate the function yet, so we'll keep the function reference
      // and eval it at execution time
      this.elseSteps.push(step as unknown as Step);
    } else {
      this.elseSteps.push(step);
    }
    return this;
  }

  endIf(): Workflow {
    // Implementation will depend on the execution context
    // We'll use the condition to determine which steps to execute
    // during runtime.
    this.workflow.getLogger().debug('Added conditional branch', {
      condition: this.condition,
      thenSteps: this.thenSteps.map((s) => (s instanceof Step ? s.id : 'function')),
      elseSteps: this.elseSteps.map((s) => (s instanceof Step ? s.id : 'function')),
    });

    return this.workflow;
  }
}

// Helper class for building while loops
class WhileLoopBuilder {
  private workflow: Workflow;
  private condition: ConditionSpec;
  private loopSteps: Step[] = [];
  private maxIterations?: number;

  constructor(workflow: Workflow, condition: ConditionSpec, options?: { maxIterations?: number }) {
    this.workflow = workflow;
    this.condition = condition;
    this.maxIterations = options?.maxIterations;
  }

  do(step: Step): WhileLoopBuilder {
    this.loopSteps.push(step);
    return this;
  }

  endWhile(): Workflow {
    // Implementation will depend on the execution context
    // We'll iterate and execute the steps while the condition is true
    // during runtime.
    this.workflow.getLogger().debug('Added while loop', {
      condition: this.condition,
      maxIterations: this.maxIterations,
      steps: this.loopSteps.map((s) => s.id),
    });

    return this.workflow;
  }
}
