import { z } from 'zod';

export type StepId = string;

export enum StepStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
  SKIPPED = 'skipped',
}

export enum ExecutionMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
}

export enum WorkflowStateType {
  IDLE = 'idle',
  RUNNING = 'running',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type LogicalOperator = 'and' | 'or';
export type ConditionOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'startsWith'
  | 'endsWith';

export interface SimplePredicate {
  path: string;
  operator: ConditionOperator;
  value: any;
}

export interface LogicalGroup {
  operator: LogicalOperator;
  conditions: (SimplePredicate | LogicalGroup | ConditionFn)[];
}

export type ConditionSpec = SimplePredicate | LogicalGroup | ConditionFn;

export interface StepResult<T = any> {
  status: StepStatus;
  output?: T;
  error?: Error;
  schema: z.ZodType<T>;
}

export interface WorkflowState {
  steps: Record<StepId, StepResult>;
  currentSteps: StepId[];
  executionMode: ExecutionMode;
  machineState: WorkflowStateType;
  suspended?: {
    stepId: StepId;
    resumeToken: string;
  };
  persistenceId?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffFactor: number;
  initialDelay: number;
}

export type ConditionFn = (context: WorkflowContext) => boolean | Promise<boolean>;

export type ExecuteFn<TInput = any, TOutput = any> = (
  input: TInput,
  context: WorkflowExecutionContext,
) => Promise<TOutput> | TOutput;

export interface StepDependency {
  stepId: StepId | Step;
  type: 'success' | 'failure' | 'completion';
  condition?: ConditionSpec;
}

export interface CompoundDependency {
  stepIds: (StepId | Step)[];
  type: 'all' | 'any';
  condition?: ConditionSpec;
}

/**
 * Interface for persistent storage operations in workflows
 */
export interface PersistentStorage {
  /**
   * Save workflow state to persistent storage
   * @param workflowId Workflow identifier
   * @param state Current workflow state
   * @returns Promise resolving to persistence ID
   */
  saveWorkflow(workflowId: string, state: WorkflowState): Promise<string>;

  /**
   * Load workflow state from persistent storage
   * @param persistenceId Persistence identifier
   * @returns Promise resolving to workflow state
   */
  loadWorkflow(persistenceId: string): Promise<WorkflowState>;

  /**
   * Update a specific step result in persistent storage
   * @param persistenceId Persistence identifier
   * @param stepId Step identifier
   * @param result Step execution result
   * @returns Promise resolving when update is complete
   */
  updateStepResult(persistenceId: string, stepId: StepId, result: StepResult): Promise<void>;
}

export interface WorkflowContext {
  steps: Record<StepId, StepResult>;
  triggerData: any;
  getStepResult<T = any>(stepId: StepId): T | undefined;
  agents: Record<string, A2Agent>;
  repository: WorkflowRepository;
  variables: Record<string, any>;
}

export interface WorkflowExecutionContext extends WorkflowContext {
  suspend(resumeToken?: string): void;
  log(message: string, data?: any): void;
  isWorkflowComplete(): boolean;
  emitEvent(event: WorkflowEvent): void;
  waitForEvent(eventType: string, timeout?: number): Promise<WorkflowEvent>;
}

export interface WorkflowEvent {
  type: string;
  data: any;
  timestamp: number;
  correlationId?: string;
}

export interface WorkflowEventDefinition {
  type: string;
  schema?: z.ZodType<any>;
  description?: string;
}

export interface WorkflowEventHandler {
  eventType: string;
  handler: (event: WorkflowEvent, context: WorkflowExecutionContext) => Promise<void>;
}

export interface StepSchemaConfig<TInput = any, TOutput = any> {
  input?: z.ZodType<TInput>;
  output: z.ZodType<TOutput>;
  description?: string;
}

export interface LoopConfig {
  maxIterations?: number;
  until?: ConditionSpec;
  iterationVariable?: string;
}

export interface StepGroup {
  id: string;
  steps: StepId[];
  executionMode: ExecutionMode;
}

export interface WorkflowRepository {
  saveWorkflow(workflowId: string, state: WorkflowState): Promise<string>;
  loadWorkflow(persistenceId: string): Promise<WorkflowState>;
  updateStepResult(persistenceId: string, stepId: StepId, result: StepResult): Promise<void>;
  listWorkflows(filters?: Record<string, any>): Promise<string[]>;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: Array<{ time: number; name: string; attributes?: Record<string, any> }>;
}

export interface TelemetryProvider {
  startSpan(name: string, parentSpan?: TraceSpan): TraceSpan;
  endSpan(span: TraceSpan): void;
  recordEvent(span: TraceSpan, name: string, attributes?: Record<string, any>): void;
  recordMetric(name: string, value: number, attributes?: Record<string, any>): void;
}

// This is a placeholder - we'd need to import the actual agent type
export interface A2Agent {
  generate(params: any): Promise<any>;
}

// Forward reference for Step
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Step } from './step';
