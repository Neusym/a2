import { WorkflowExecutionContextImpl } from './context';
import { StateMachine } from './machine';
import { Step } from './step';
import {
  ExecutionMode,
  StepId,
  StepStatus,
  WorkflowState,
  WorkflowStateType,
  StepResult,
  WorkflowEvent,
  WorkflowEventHandler,
  StepGroup,
  PersistentStorage,
  TelemetryProvider,
  TraceSpan,
} from './types';
import { evaluateCondition } from './utils/conditions';
import { Workflow } from './workflow';

type StateChangeListener = (state: WorkflowState) => void;

export class WorkflowInstance {
  private workflow: Workflow;
  private triggerData: any;
  private steps: Map<StepId, Step>;
  private stepGraph: Map<StepId, StepId[]>;
  private agents: Record<string, any>;
  private stepGroups: Map<string, StepGroup>;
  private defaultExecutionMode: ExecutionMode;
  private state: WorkflowState;
  private listeners: StateChangeListener[] = [];
  private context: WorkflowExecutionContextImpl;
  private stateMachine: StateMachine;
  private persistentStorage?: PersistentStorage;
  private telemetryProvider?: TelemetryProvider;
  private rootSpan?: TraceSpan;
  private globalEventHandlers: WorkflowEventHandler[];

  constructor(
    workflow: Workflow,
    triggerData: any,
    steps: Map<StepId, Step>,
    stepGraph: Map<StepId, StepId[]>,
    agents: Record<string, any>,
    stepGroups: Map<string, StepGroup>,
    defaultExecutionMode: ExecutionMode,
    stateMachine: StateMachine,
    persistentStorage?: PersistentStorage,
    telemetryProvider?: TelemetryProvider,
    rootSpan?: TraceSpan,
    globalEventHandlers: WorkflowEventHandler[] = [],
  ) {
    this.workflow = workflow;
    this.triggerData = triggerData;
    this.steps = steps;
    this.stepGraph = stepGraph;
    this.agents = agents;
    this.stepGroups = stepGroups;
    this.defaultExecutionMode = defaultExecutionMode;
    this.stateMachine = stateMachine;
    this.persistentStorage = persistentStorage;
    this.telemetryProvider = telemetryProvider;
    this.rootSpan = rootSpan;
    this.globalEventHandlers = globalEventHandlers;

    // Initialize state
    this.state = {
      steps: {},
      currentSteps: [],
      executionMode: defaultExecutionMode,
      machineState: WorkflowStateType.IDLE,
    };

    // Create execution context
    this.context = new WorkflowExecutionContextImpl(
      triggerData,
      agents,
      persistentStorage,
      this.logMessage.bind(this),
      this.onWorkflowComplete.bind(this),
      // Pass a repository that delegates to the persistentStorage if available
      persistentStorage
        ? {
            saveWorkflow: persistentStorage.saveWorkflow.bind(persistentStorage),
            loadWorkflow: persistentStorage.loadWorkflow.bind(persistentStorage),
            updateStepResult: persistentStorage.updateStepResult.bind(persistentStorage),
            listWorkflows: async (filters?: Record<string, any>) => {
              // Default implementation for listWorkflows if not available in persistentStorage
              console.warn('Using default listWorkflows implementation');
              return [];
            },
          }
        : undefined,
    );

    // Set up suspend callback
    this.context.setSuspendCallback(this.handleSuspend.bind(this));

    // Register global event handlers
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    for (const handler of this.globalEventHandlers) {
      this.context.on(handler.eventType, async (event) => {
        try {
          await handler.handler(event, this.context);
        } catch (error) {
          this.logMessage(`Error in event handler for ${handler.eventType}:`, error);
        }
      });
    }
  }

  watch(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private updateState(updates: Partial<WorkflowState>): void {
    this.state = { ...this.state, ...updates };
    this.context.steps = this.state.steps;

    // Notify all listeners
    for (const listener of this.listeners) {
      listener(this.state);
    }

    // Persist state if storage is available
    this.persistState();
  }

  private async persistState(): Promise<void> {
    if (!this.persistentStorage) return;

    try {
      const persistenceId = await this.persistentStorage.saveWorkflow(
        this.workflow.getName(),
        this.state,
      );

      if (!this.state.persistenceId) {
        this.updateState({ persistenceId });
      }
    } catch (error) {
      this.logMessage('Failed to persist workflow state:', error);
    }
  }

  restoreFromState(state: WorkflowState): void {
    this.state = state;
    this.context.steps = state.steps;

    // Re-connect the state machine
    const machineState = {
      value: state.machineState,
      matches: (s: string) => s === state.machineState,
      context: {},
    };

    // Notify listeners of restored state
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private logMessage(message: string, data?: any): void {
    console.log(`[Workflow ${this.workflow.getName()}] ${message}`, data || '');
  }

  private handleSuspend(resumeToken: string): void {
    const currentStep = this.state.currentSteps[0];

    this.updateState({
      machineState: WorkflowStateType.SUSPENDED,
      suspended: {
        stepId: currentStep,
        resumeToken,
      },
    });
  }

  private onWorkflowComplete(): void {
    // Record telemetry if available
    if (this.telemetryProvider && this.rootSpan) {
      this.rootSpan.attributes.outcome = 'completed';
      this.telemetryProvider.endSpan(this.rootSpan);
    }
  }

  isWorkflowComplete(): boolean {
    return (
      this.state.machineState === WorkflowStateType.COMPLETED ||
      this.state.machineState === WorkflowStateType.FAILED
    );
  }

  getState(): WorkflowState {
    return this.state;
  }

  async start(): Promise<WorkflowState> {
    if (this.state.machineState !== WorkflowStateType.IDLE) {
      throw new Error('Workflow has already been started');
    }

    // Update state to running
    this.updateState({
      machineState: WorkflowStateType.RUNNING,
    });

    // Find initial steps (those with no dependencies)
    const initialSteps = this.findInitialSteps();

    if (initialSteps.length === 0) {
      this.logMessage('No initial steps found in workflow');
      this.updateState({
        machineState: WorkflowStateType.COMPLETED,
      });
      return this.state;
    }

    // Execute initial steps
    await this.executeSteps(initialSteps);

    return this.state;
  }

  private findInitialSteps(): StepId[] {
    const initialSteps: StepId[] = [];

    for (const [stepId, step] of this.steps.entries()) {
      const dependencies = step.getDependencies();
      if (dependencies.length === 0) {
        initialSteps.push(stepId);
      }
    }

    return initialSteps;
  }

  private async executeSteps(stepIds: StepId[]): Promise<void> {
    if (stepIds.length === 0) return;

    // Update current steps
    this.updateState({
      currentSteps: stepIds,
      executionMode: this.getExecutionModeForSteps(stepIds),
    });

    if (this.state.executionMode === ExecutionMode.SEQUENTIAL) {
      // Execute steps one at a time
      for (const stepId of stepIds) {
        await this.executeStep(stepId);

        // If workflow is no longer running, stop execution
        if (this.state.machineState !== WorkflowStateType.RUNNING) {
          return;
        }
      }
    } else {
      // Execute steps in parallel
      await Promise.all(stepIds.map((stepId) => this.executeStep(stepId)));
    }

    // Find next steps to execute
    if (this.state.machineState === WorkflowStateType.RUNNING) {
      const nextSteps = this.findNextSteps();

      if (nextSteps.length === 0) {
        // No more steps to execute, workflow is complete
        this.updateState({
          machineState: WorkflowStateType.COMPLETED,
          currentSteps: [],
        });
        this.context.notifyComplete();
      } else {
        // Execute next steps
        await this.executeSteps(nextSteps);
      }
    }
  }

  private getExecutionModeForSteps(stepIds: StepId[]): ExecutionMode {
    // Check if these steps are part of a group
    for (const [groupId, group] of this.stepGroups.entries()) {
      if (stepIds.every((id) => group.steps.includes(id)) && stepIds.length > 0) {
        return group.executionMode;
      }
    }

    // Default to workflow's execution mode
    return this.defaultExecutionMode;
  }

  private async executeStep(stepId: StepId): Promise<void> {
    const step = this.steps.get(stepId);
    if (!step) {
      this.logMessage(`Step ${stepId} not found`);
      return;
    }

    // Check if step should be executed based on conditions
    const condition = step.getCondition();
    if (condition) {
      try {
        const shouldExecute = await evaluateCondition(condition, this.context);
        if (!shouldExecute) {
          // Skip step execution
          this.updateStepResult(stepId, {
            status: StepStatus.SKIPPED,
            output: undefined,
            schema: step.getOutputSchema(),
          });
          return;
        }
      } catch (error) {
        this.logMessage(`Error evaluating condition for step ${stepId}:`, error);
        this.updateStepResult(stepId, {
          status: StepStatus.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
          schema: step.getOutputSchema(),
        });
        return;
      }
    }

    // Start telemetry span if available
    let stepSpan: TraceSpan | undefined;
    if (this.telemetryProvider && this.rootSpan) {
      stepSpan = this.telemetryProvider.startSpan(`step-${stepId}`, this.rootSpan);
      stepSpan.attributes.stepId = stepId;
      step.setTraceSpan(stepSpan);
    }

    // Update step status to executing
    this.updateStepResult(stepId, {
      status: StepStatus.EXECUTING,
      schema: step.getOutputSchema(),
    });

    try {
      // Get input from previous steps if needed
      const inputSchema = step.getInputSchema();
      const input: any = undefined;

      // Execute the step
      const execute = step.getExecuteFn();
      const output = await execute(input, this.context);

      // Validate output against schema
      const outputSchema = step.getOutputSchema();
      const validatedOutput = outputSchema.parse(output);

      // Update step result
      this.updateStepResult(stepId, {
        status: StepStatus.COMPLETED,
        output: validatedOutput,
        schema: outputSchema,
      });

      // End telemetry span
      if (this.telemetryProvider && stepSpan) {
        stepSpan.attributes.status = 'completed';
        this.telemetryProvider.endSpan(stepSpan);
      }
    } catch (error) {
      this.logMessage(`Error executing step ${stepId}:`, error);

      // Update step result
      this.updateStepResult(stepId, {
        status: StepStatus.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
        schema: step.getOutputSchema(),
      });

      // End telemetry span with error
      if (this.telemetryProvider && stepSpan) {
        stepSpan.attributes.status = 'failed';
        stepSpan.attributes.error = String(error);
        this.telemetryProvider.endSpan(stepSpan);
      }
    }
  }

  private updateStepResult(stepId: StepId, result: StepResult): void {
    const updatedSteps = { ...this.state.steps, [stepId]: result };
    this.updateState({ steps: updatedSteps });

    // Update persistent storage if available
    if (this.persistentStorage && this.state.persistenceId) {
      this.persistentStorage
        .updateStepResult(this.state.persistenceId, stepId, result)
        .catch((error) => {
          this.logMessage(`Failed to persist step result for ${stepId}:`, error);
        });
    }
  }

  private findNextSteps(): StepId[] {
    const nextSteps: StepId[] = [];
    const completedStepIds = Object.entries(this.state.steps)
      .filter(([, result]) => result.status === StepStatus.COMPLETED)
      .map(([id]) => id);

    // Check all steps to see if their dependencies are satisfied
    for (const [stepId, step] of this.steps.entries()) {
      // Skip already completed or executing steps
      const currentStatus = this.state.steps[stepId]?.status;
      if (
        currentStatus === StepStatus.COMPLETED ||
        currentStatus === StepStatus.EXECUTING ||
        currentStatus === StepStatus.SKIPPED
      ) {
        continue;
      }

      const dependencies = step.getDependencies();
      let dependenciesSatisfied = true;

      for (const dependency of dependencies) {
        if ('stepId' in dependency) {
          // Single step dependency
          const depId =
            typeof dependency.stepId === 'string' ? dependency.stepId : dependency.stepId.id;
          const depResult = this.state.steps[depId];

          if (!depResult) {
            dependenciesSatisfied = false;
            break;
          }

          if (dependency.type === 'success' && depResult.status !== StepStatus.COMPLETED) {
            dependenciesSatisfied = false;
            break;
          }

          if (dependency.type === 'failure' && depResult.status !== StepStatus.FAILED) {
            dependenciesSatisfied = false;
            break;
          }

          if (
            dependency.type === 'completion' &&
            depResult.status !== StepStatus.COMPLETED &&
            depResult.status !== StepStatus.FAILED &&
            depResult.status !== StepStatus.SKIPPED
          ) {
            dependenciesSatisfied = false;
            break;
          }

          // Check additional condition if present
          if (dependency.condition && dependenciesSatisfied) {
            try {
              const conditionMet = evaluateCondition(dependency.condition, this.context);
              if (!conditionMet) {
                dependenciesSatisfied = false;
                break;
              }
            } catch (error) {
              this.logMessage(`Error evaluating dependency condition for step ${stepId}:`, error);
              dependenciesSatisfied = false;
              break;
            }
          }
        } else if ('stepIds' in dependency) {
          // Compound dependency
          const { stepIds, type: combinationType } = dependency;

          if (combinationType === 'all') {
            // All dependencies must be satisfied
            for (const subDep of stepIds) {
              const subDepId = typeof subDep === 'string' ? subDep : subDep.id;
              if (!completedStepIds.includes(subDepId)) {
                dependenciesSatisfied = false;
                break;
              }
            }
          } else if (combinationType === 'any') {
            // At least one dependency must be satisfied
            dependenciesSatisfied = stepIds.some((subDep) => {
              const subDepId = typeof subDep === 'string' ? subDep : subDep.id;
              return completedStepIds.includes(subDepId);
            });
          }

          // Check additional condition if present
          if (dependency.condition && dependenciesSatisfied) {
            try {
              const conditionMet = evaluateCondition(dependency.condition, this.context);
              if (!conditionMet) {
                dependenciesSatisfied = false;
              }
            } catch (error) {
              this.logMessage(
                `Error evaluating compound dependency condition for step ${stepId}:`,
                error,
              );
              dependenciesSatisfied = false;
            }
          }
        }
      }

      if (dependenciesSatisfied) {
        nextSteps.push(stepId);
      }
    }

    return nextSteps;
  }

  async resume(stepId?: StepId): Promise<WorkflowState> {
    if (this.state.machineState !== WorkflowStateType.SUSPENDED) {
      throw new Error('Cannot resume workflow that is not suspended');
    }

    // If stepId is provided, ensure it's the currently suspended step
    if (stepId && this.state.suspended && this.state.suspended.stepId !== stepId) {
      throw new Error(
        `Cannot resume step ${stepId}, currently suspended at ${this.state.suspended.stepId}`,
      );
    }

    // Update state to running
    this.updateState({
      machineState: WorkflowStateType.RUNNING,
      suspended: undefined,
    });

    // Continue execution from the current step
    const currentSteps = [...this.state.currentSteps];
    await this.executeSteps(currentSteps);

    return this.state;
  }

  async resumeWithEvent(event: WorkflowEvent): Promise<WorkflowState> {
    if (this.state.machineState !== WorkflowStateType.SUSPENDED) {
      throw new Error('Cannot resume workflow that is not suspended');
    }

    // Emit the event
    this.context.emitEvent(event);

    // Resume execution
    return this.resume();
  }

  // Add methods for controlling and monitoring the workflow
  async cancel(): Promise<WorkflowState> {
    this.updateState({
      machineState: WorkflowStateType.FAILED,
      currentSteps: [],
    });

    // Clean up
    this.context.dispose();

    // Record telemetry if available
    if (this.telemetryProvider && this.rootSpan) {
      this.rootSpan.attributes.outcome = 'cancelled';
      this.telemetryProvider.endSpan(this.rootSpan);
    }

    return this.state;
  }
}
