import { Command } from 'commander';

import { configureRegisterProcessCommand } from './register-process-command';

/**
 * Create and configure the root CLI program
 */
export function createCliProgram(): Command {
  const program = new Command()
    .name('a3')
    .description('A3 Command Line Interface')
    .version('0.1.0');
  
  // Add register command
  program.addCommand(configureRegisterProcessCommand());
  
  return program;
}

// Export individual command configurators
export { configureRegisterProcessCommand }; 