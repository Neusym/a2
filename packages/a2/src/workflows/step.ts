import { z } from 'zod';

import {
  StepId,
  ExecuteFn,
  ConditionSpec,
  StepDependency,
  CompoundDependency,
  RetryConfig,
  WorkflowContext,
  StepSchemaConfig,
  WorkflowExecutionContext,
  WorkflowEventHandler,
  LoopConfig,
  TraceSpan,
  WorkflowEvent,
} from './types';

export class Step<TInput = any, TOutput = any> {
  readonly id: StepId;
  private execute: ExecuteFn<TInput, TOutput>;
  private dependencies: (StepDependency | CompoundDependency)[] = [];
  private condition?: ConditionSpec;
  private inputSchema?: z.ZodType<TInput>;
  private outputSchema: z.ZodType<TOutput>;
  private retryConfig?: RetryConfig;
  private variables: Record<string, string | ((context: WorkflowContext) => any)> = {};
  private schemaDescription?: string;
  private eventHandlers: WorkflowEventHandler[] = [];
  private loopConfig?: LoopConfig;
  private ifBranch?: Step;
  private elseBranch?: Step;
  private traceSpan?: TraceSpan;

  constructor(
    id: StepId,
    execute: ExecuteFn<TInput, TOutput>,
    schemaConfig: StepSchemaConfig<TInput, TOutput>,
  ) {
    this.id = id;
    this.execute = execute;
    this.inputSchema = schemaConfig.input;
    this.outputSchema = schemaConfig.output;
    this.schemaDescription = schemaConfig.description;
  }

  withInputSchema(schema: z.ZodType<TInput>): this {
    this.inputSchema = schema;
    return this;
  }

  withRetry(config: RetryConfig): this {
    this.retryConfig = config;
    return this;
  }

  // Enhanced condition system with predicate support
  when(condition: ConditionSpec): this {
    this.condition = condition;
    return this;
  }

  // Support for logical operators
  and(condition: ConditionSpec): this {
    if (!this.condition) {
      return this.when(condition);
    }

    this.condition = {
      operator: 'and',
      conditions: [this.condition, condition],
    };
    return this;
  }

  or(condition: ConditionSpec): this {
    if (!this.condition) {
      return this.when(condition);
    }

    this.condition = {
      operator: 'or',
      conditions: [this.condition, condition],
    };
    return this;
  }

  // Enhanced dependency system
  after(stepId: StepId | Step, type: 'success' | 'failure' | 'completion' = 'success'): this {
    this.dependencies.push({ stepId, type });
    return this;
  }

  // New subscriber pattern with compound dependencies
  afterAll(
    stepIds: (StepId | Step)[],
    type: 'success' | 'failure' | 'completion' = 'success',
  ): this {
    this.dependencies.push({
      stepIds,
      type: 'all',
      condition: undefined,
    });
    return this;
  }

  afterAny(
    stepIds: (StepId | Step)[],
    type: 'success' | 'failure' | 'completion' = 'success',
  ): this {
    this.dependencies.push({
      stepIds,
      type: 'any',
      condition: undefined,
    });
    return this;
  }

  // Event-driven workflows
  afterEvent(
    eventType: string,
    handler?: (event: WorkflowEvent, context: WorkflowExecutionContext) => Promise<void>,
  ): this {
    if (handler) {
      this.eventHandlers.push({ eventType, handler });
    } else {
      this.eventHandlers.push({
        eventType,
        handler: async (event, context) => {
          // Default handler just collects the event data
          this.variables['lastEvent'] = event as unknown as string;
        },
      });
    }
    return this;
  }

  // Loop control for complex flows
  withLoop(config: LoopConfig): this {
    this.loopConfig = config;
    return this;
  }

  // If-else branching for complex flows
  withBranch(
    thenStep: Step | ((context: WorkflowContext) => Step),
    elseStep?: Step | ((context: WorkflowContext) => Step),
  ): this {
    if (typeof thenStep === 'function') {
      // Will be evaluated at execution time
      this.variables['thenStepFactory'] = thenStep;
    } else {
      this.ifBranch = thenStep;
    }

    if (elseStep) {
      if (typeof elseStep === 'function') {
        // Will be evaluated at execution time
        this.variables['elseStepFactory'] = elseStep;
      } else {
        this.elseBranch = elseStep;
      }
    }
    return this;
  }

  withVariable(name: string, value: string | ((context: WorkflowContext) => any)): this {
    this.variables[name] = value;
    return this;
  }

  withSchemaDescription(description: string): this {
    this.schemaDescription = description;
    return this;
  }

  getDependencies(): (StepDependency | CompoundDependency)[] {
    return this.dependencies;
  }

  getCondition(): ConditionSpec | undefined {
    return this.condition;
  }

  getExecuteFn(): ExecuteFn<TInput, TOutput> {
    return this.execute;
  }

  getInputSchema(): z.ZodType<TInput> | undefined {
    return this.inputSchema;
  }

  getOutputSchema(): z.ZodType<TOutput> {
    return this.outputSchema;
  }

  getSchemaDescription(): string | undefined {
    return this.schemaDescription;
  }

  getRetryConfig(): RetryConfig | undefined {
    return this.retryConfig;
  }

  getVariables(): Record<string, string | ((context: WorkflowContext) => any)> {
    return this.variables;
  }

  getEventHandlers(): WorkflowEventHandler[] {
    return this.eventHandlers;
  }

  getLoopConfig(): LoopConfig | undefined {
    return this.loopConfig;
  }

  getBranches(): { ifBranch?: Step; elseBranch?: Step } {
    return {
      ifBranch: this.ifBranch,
      elseBranch: this.elseBranch,
    };
  }

  // For telemetry/tracing
  setTraceSpan(span: TraceSpan): this {
    this.traceSpan = span;
    return this;
  }

  getTraceSpan(): TraceSpan | undefined {
    return this.traceSpan;
  }
}
