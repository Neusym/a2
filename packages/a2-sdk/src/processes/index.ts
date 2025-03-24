/**
 * Type for a process step execution function
 */
export type ProcessStepFunction = (context: any) => Promise<Record<string, any>>;

/**
 * Type for a process step condition function
 */
export type ProcessStepCondition = (context: any) => boolean;

/**
 * Interface for a process step
 */
export interface ProcessStep {
  /**
   * Unique identifier for the step
   */
  id: string;

  /**
   * Function to execute for this step
   */
  execute: ProcessStepFunction;

  /**
   * Optional condition to determine if this step should run
   */
  condition?: ProcessStepCondition;

  /**
   * Description of what this step does
   */
  description?: string;
}

/**
 * Options for creating a process
 */
export interface CreateProcessOptions {
  /**
   * Name of the process
   */
  name: string;

  /**
   * Array of steps in the process
   */
  steps: ProcessStep[];

  /**
   * Description of what this process does
   */
  description?: string;
}

/**
 * Simple process implementation
 */
export interface SimpleProcess {
  /**
   * Process name
   */
  name: string;

  /**
   * Process description
   */
  description?: string;

  /**
   * Process steps
   */
  steps: ProcessStep[];

  /**
   * Run the process with the given input
   */
  run(input: any): Promise<{ output: any }>;
}

/**
 * Create a process with simplified options
 *
 * @example
 * ```typescript
 * const process = createProcess({
 *   name: 'greeting-process',
 *   steps: [
 *     {
 *       id: 'get-name',
 *       execute: async (context) => {
 *         const name = context.getInput('name') || 'Guest';
 *         return { name };
 *       }
 *     },
 *     {
 *       id: 'create-greeting',
 *       execute: async (context) => {
 *         const { name } = context.getStepResult('get-name');
 *         return { greeting: `Hello, ${name}!` };
 *       }
 *     }
 *   ]
 * });
 *
 * const result = await process.run({ name: 'John' });
 * // Result contains: { greeting: "Hello, John!" }
 * ```
 *
 * @param options Options for creating the process
 * @returns A new Process instance
 */
export function createProcess(options: CreateProcessOptions): SimpleProcess {
  const { name, steps, description } = options;

  return {
    name,
    description,
    steps,

    async run(input: any): Promise<{ output: any }> {
      // Store step results
      const stepResults: Record<string, any> = {};

      // Create context object for steps to use
      const context = {
        getInput(key?: string) {
          if (key) {
            return input[key];
          }
          return input;
        },
        getStepResult(stepId: string) {
          return stepResults[stepId] || null;
        },
        getAllResults() {
          return { ...stepResults };
        },
      };

      // Execute each step in order
      for (const step of steps) {
        // Check if step should be executed
        if (step.condition && !step.condition(context)) {
          continue;
        }

        // Execute the step and store its result
        const result = await step.execute(context);
        stepResults[step.id] = result;
      }

      // If we have steps, return the result of the last one
      if (steps.length > 0) {
        return {
          output: stepResults[steps[steps.length - 1].id],
        };
      }

      // Otherwise return empty result
      return { output: {} };
    },
  };
}

/**
 * Create a sequential process where each step depends on the previous one
 *
 * @param options Process options without the steps
 * @param stepFunctions Array of step functions in order
 * @returns A new Process instance
 */
export function createSequentialProcess(
  options: Omit<CreateProcessOptions, 'steps'>,
  stepFunctions: Array<ProcessStepFunction>
): SimpleProcess {
  // Create step objects with auto-generated IDs
  const steps = stepFunctions.map((fn, index) => ({
    id: `step-${index + 1}`,
    execute: fn,
  }));

  return createProcess({
    ...options,
    steps,
  });
}
