#!/usr/bin/env node

/**
 * A3 Command Line Interface
 * 
 * This is the main entry point for the A3 CLI, which provides
 * access to all A3 platform functionality from the command line.
 */

import { createCliProgram } from '../cli';

// Run the CLI program
createCliProgram().parse(process.argv); 