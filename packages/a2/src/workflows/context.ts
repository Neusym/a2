import { EventEmitter } from 'events';

import {
  WorkflowContext,
  WorkflowExecutionContext,
  StepId,
  StepResult,
  WorkflowEvent,
  A2Agent,
  PersistentStorage,
  WorkflowRepository,
} from './types';

export class BaseWorkflowContext implements WorkflowContext {
  steps: Record<StepId, StepResult>;
  triggerData: any;
  agents: Record<string, A2Agent>;
  persistentStorage?: PersistentStorage;
  variables: Record<string, any>;
  repository: WorkflowRepository;

  constructor(
    triggerData: any,
    agents: Record<string, A2Agent> = {},
    persistentStorage?: PersistentStorage,
    repository?: WorkflowRepository,
  ) {
    this.steps = {};
    this.triggerData = triggerData;
    this.agents = agents;
    this.persistentStorage = persistentStorage;
    this.variables = {};

    // Create a default repository implementation if not provided
    this.repository = repository || {
      saveWorkflow: async (workflowId: string, state) => {
        // Default implementation - can be overridden by providing a real repository
        console.warn('Using default repository implementation for saveWorkflow');
        return `${workflowId}-${Date.now()}`;
      },
      loadWorkflow: async (persistenceId: string) => {
        console.warn('Using default repository implementation for loadWorkflow');
        throw new Error('Workflow not found: no real repository provided');
      },
      updateStepResult: async (persistenceId: string, stepId: string, result) => {
        console.warn('Using default repository implementation for updateStepResult');
        // No-op in default implementation
      },
      listWorkflows: async (filters) => {
        console.warn('Using default repository implementation for listWorkflows');
        return [];
      },
    };
  }

  getStepResult<T = any>(stepId: StepId): T | undefined {
    return this.steps[stepId]?.output as T | undefined;
  }

  getStepResultWithSchema<T = any>(stepId: StepId): { data: T | undefined; schema: any } {
    const result = this.steps[stepId];
    return {
      data: result?.output as T | undefined,
      schema: result?.schema,
    };
  }

  setVariable(name: string, value: any): void {
    this.variables[name] = value;
  }

  getVariable<T = any>(name: string): T | undefined {
    return this.variables[name] as T | undefined;
  }

  // Resolve variable references and interpolate them in strings
  resolveVariables(template: string): string {
    return template.replace(/\${([^}]+)}/g, (match, varPath) => {
      const path = varPath.trim().split('.');
      let value: any = this;

      for (const segment of path) {
        if (value === undefined || value === null) {
          return match; // Keep original template if path is invalid
        }
        value = value[segment];
      }

      return value !== undefined ? String(value) : match;
    });
  }
}

export class WorkflowExecutionContextImpl
  extends BaseWorkflowContext
  implements WorkflowExecutionContext
{
  private eventEmitter: EventEmitter;
  private suspendCallback?: (token: string) => void;
  private suspendResumeToken?: string;
  private logger: (message: string, data?: any) => void;
  private completionCallback?: () => void;

  constructor(
    triggerData: any,
    agents: Record<string, A2Agent> = {},
    persistentStorage?: PersistentStorage,
    logger?: (message: string, data?: any) => void,
    onComplete?: () => void,
    repository?: WorkflowRepository,
  ) {
    super(triggerData, agents, persistentStorage, repository);
    this.eventEmitter = new EventEmitter();
    this.logger = logger || ((msg) => console.log(msg));
    this.completionCallback = onComplete;
  }

  suspend(resumeToken?: string): void {
    if (!this.suspendCallback) {
      throw new Error('Suspend called but no suspend handler registered');
    }

    const token =
      resumeToken || `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.suspendResumeToken = token;
    this.suspendCallback(token);
  }

  log(message: string, data?: any): void {
    this.logger(message, data);
  }

  isWorkflowComplete(): boolean {
    return false; // This will be overridden by the WorkflowInstance
  }

  emitEvent(event: WorkflowEvent): void {
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    this.eventEmitter.emit(event.type, event);
    this.eventEmitter.emit('*', event);
  }

  async waitForEvent(eventType: string, timeout?: number): Promise<WorkflowEvent> {
    return new Promise((resolve, reject) => {
      const handler = (event: WorkflowEvent) => {
        clearTimeout(timeoutId);
        this.eventEmitter.off(eventType, handler);
        resolve(event);
      };

      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          this.eventEmitter.off(eventType, handler);
          reject(new Error(`Timeout waiting for event ${eventType}`));
        }, timeout);
      }

      this.eventEmitter.on(eventType, handler);
    });
  }

  setSuspendCallback(callback: (token: string) => void): void {
    this.suspendCallback = callback;
  }

  getSuspendResumeToken(): string | undefined {
    return this.suspendResumeToken;
  }

  notifyComplete(): void {
    if (this.completionCallback) {
      this.completionCallback();
    }
  }

  // Clean up any resources when the workflow is done
  dispose(): void {
    this.eventEmitter.removeAllListeners();
  }

  on(eventType: string, handler: (event: WorkflowEvent) => void): void {
    this.eventEmitter.on(eventType, handler);
  }

  off(eventType: string, handler: (event: WorkflowEvent) => void): void {
    this.eventEmitter.off(eventType, handler);
  }
}
