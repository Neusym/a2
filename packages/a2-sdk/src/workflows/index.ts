import { z } from 'zod';

/**
 * Type for a workflow task function
 */
export type WorkflowTaskFunction = (context: any) => Promise<Record<string, any>>;

/**
 * Type for workflow next step determination
 */
export type WorkflowNextFunction = (context: any) => string;

/**
 * Interface for a workflow step configuration
 */
export interface WorkflowStepConfig {
  /**
   * Unique identifier for the step
   */
  id: string;
  
  /**
   * Type of step ('input', 'task', 'output', etc.)
   */
  type: 'input' | 'task' | 'output' | 'decision';
  
  /**
   * Optional schema for validation (for 'input' type)
   */
  schema?: z.ZodType<any>;
  
  /**
   * Task function to execute (for 'task' type)
   */
  task?: WorkflowTaskFunction;
  
  /**
   * Function or string identifying the next step
   */
  next?: string | WorkflowNextFunction;
  
  /**
   * Mapping function for output (for 'output' type)
   */
  map?: (context: any) => any;
  
  /**
   * Description of the step
   */
  description?: string;
}

/**
 * Options for creating a workflow
 */
export interface CreateWorkflowOptions {
  /**
   * Unique identifier for the workflow
   */
  id: string;
  
  /**
   * Name of the workflow
   */
  name: string;
  
  /**
   * Array of step configurations
   */
  steps: WorkflowStepConfig[];
  
  /**
   * Description of what this workflow does
   */
  description?: string;
}

/**
 * Simple workflow implementation
 */
export interface SimpleWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStepConfig[];
  
  /**
   * Create a new instance of this workflow
   */
  createInstance(): SimpleWorkflowInstance;
}

/**
 * Interface for a workflow instance
 */
export interface SimpleWorkflowInstance {
  /**
   * Execute the workflow with the given input
   */
  execute(input: any): Promise<any>;
}

/**
 * Create a workflow with simplified options
 * 
 * @example
 * ```typescript
 * // Define a workflow with input validation
 * const workflow = createWorkflow({
 *   id: 'data-processing',
 *   name: 'Data Processing Workflow',
 *   steps: [
 *     {
 *       id: 'input',
 *       type: 'input',
 *       schema: z.object({
 *         data: z.array(z.number())
 *       }),
 *       next: 'process'
 *     },
 *     {
 *       id: 'process',
 *       type: 'task',
 *       task: async (context) => {
 *         const { data } = context.get('input');
 *         const sum = data.reduce((a, b) => a + b, 0);
 *         const average = sum / data.length;
 *         return { sum, average };
 *       },
 *       next: 'output'
 *     },
 *     {
 *       id: 'output',
 *       type: 'output',
 *       map: (context) => ({
 *         success: true,
 *         result: context.get('process')
 *       })
 *     }
 *   ]
 * });
 * 
 * // Execute the workflow
 * const result = await workflow.createInstance().execute({ data: [1, 2, 3, 4, 5] });
 * ```
 * 
 * @param options Options for creating the workflow
 * @returns A new Workflow instance
 */
export function createWorkflow(options: CreateWorkflowOptions): SimpleWorkflow {
  const { id, name, steps, description } = options;
  
  // Create a workflow implementation
  return {
    id,
    name,
    description,
    steps,
    
    createInstance(): SimpleWorkflowInstance {
      // Map of step results
      const stepResults = new Map<string, any>();
      
      return {
        async execute(input: any): Promise<any> {
          // Store input in context
          let currentStepId = '';
          
          // Find input step
          const inputStep = steps.find(step => step.type === 'input');
          
          if (!inputStep) {
            throw new Error('Workflow must have an input step');
          }
          
          // Start with input step
          currentStepId = inputStep.id;
          
          // Validate input if schema is provided
          if (inputStep.schema) {
            try {
              inputStep.schema.parse(input);
            } catch (error) {
              throw new Error(`Invalid input: ${error}`);
            }
          }
          
          // Store input in context
          stepResults.set(inputStep.id, input);
          
          // Create context helper
          const context = {
            get(stepId: string) {
              return stepResults.get(stepId);
            },
            has(stepId: string) {
              return stepResults.has(stepId);
            },
            getAll() {
              return Object.fromEntries(stepResults.entries());
            }
          };
          
          // Determine next step
          let nextStepId = determineNextStep(inputStep, context);
          
          // Execute steps until we reach output or no next step
          while (nextStepId) {
            const currentStep = steps.find(step => step.id === nextStepId);
            
            if (!currentStep) {
              throw new Error(`Step not found: ${nextStepId}`);
            }
            
            currentStepId = nextStepId;
            
            // Execute task step
            if (currentStep.type === 'task' && currentStep.task) {
              const result = await currentStep.task(context);
              stepResults.set(currentStep.id, result);
            }
            
            // If this is an output step, apply mapping function
            if (currentStep.type === 'output') {
              if (currentStep.map) {
                return currentStep.map(context);
              } else {
                // Return all results if no mapping function
                return context.getAll();
              }
            }
            
            // Determine next step
            nextStepId = determineNextStep(currentStep, context);
          }
          
          // If we reach here without hitting an output step, return all results
          return context.getAll();
        }
      };
    }
  };
  
  // Helper function to determine the next step
  function determineNextStep(step: WorkflowStepConfig, context: any): string {
    if (!step.next) {
      return '';
    }
    
    if (typeof step.next === 'function') {
      return step.next(context);
    }
    
    return step.next;
  }
}

/**
 * Create a linear workflow with a series of tasks that execute in sequence
 * 
 * @param options Base workflow options without steps
 * @param tasks Array of task functions to execute in order
 * @returns A new Workflow instance
 */
export function createLinearWorkflow(
  options: Omit<CreateWorkflowOptions, 'steps'>,
  tasks: WorkflowTaskFunction[]
): SimpleWorkflow {
  // Create input step
  const inputStep: WorkflowStepConfig = {
    id: 'input',
    type: 'input',
    next: 'task-1',
    description: 'Input step'
  };
  
  // Create task steps
  const taskSteps: WorkflowStepConfig[] = tasks.map((task, index) => ({
    id: `task-${index + 1}`,
    type: 'task',
    task,
    next: index < tasks.length - 1 ? `task-${index + 2}` : 'output',
    description: `Task ${index + 1}`
  }));
  
  // Create output step
  const outputStep: WorkflowStepConfig = {
    id: 'output',
    type: 'output',
    map: (context) => ({
      result: context.get(`task-${tasks.length}`)
    }),
    description: 'Output step'
  };
  
  // Combine all steps
  const steps = [inputStep, ...taskSteps, outputStep];
  
  return createWorkflow({
    ...options,
    steps
  });
} 