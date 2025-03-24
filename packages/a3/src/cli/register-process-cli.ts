#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

import { AptosAccount, AptosClient, HexString } from 'aptos';
import { Command } from 'commander';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import { v4 as uuid } from 'uuid';

import { AptosDiscoveryService } from '../discovery/aptos-discovery-service';

// Load environment variables
dotenv.config();

// Create a new program
const program = new Command();

// Set program info
program
  .name('a3-register-process')
  .description('CLI tool for registering agent processes with the A3 platform')
  .version('1.0.0');

// Register command
program
  .command('register')
  .description('Register a new agent process')
  .option('-c, --config <path>', 'Path to process config file')
  .option('-p, --private-key <key>', 'Private key for the creator account')
  .option('-m, --module-address <address>', 'Module address')
  .option('-n, --network <network>', 'Aptos network (mainnet, testnet, devnet)', 'testnet')
  .action(async (options) => {
    try {
      // Get account from private key
      const privateKey = options.privateKey || process.env.APTOS_PRIVATE_KEY;
      if (!privateKey) {
        console.error('Error: Private key is required. Provide it with --private-key or set APTOS_PRIVATE_KEY in your environment.');
        process.exit(1);
      }
      
      // Parse private key and create account
      const hexKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const account = new AptosAccount(HexString.ensure(hexKey).toUint8Array());
      
      // Get module address
      const moduleAddress = options.moduleAddress || process.env.APTOS_MODULE_ADDRESS;
      if (!moduleAddress) {
        console.error('Error: Module address is required. Provide it with --module-address or set APTOS_MODULE_ADDRESS in your environment.');
        process.exit(1);
      }
      
      // Get network and create client
      const network = options.network || process.env.APTOS_NETWORK || 'testnet';
      const networkUrl = getNetworkUrl(network);
      const client = new AptosClient(networkUrl);
      
      // Process config
      let processConfig: any = {};
      
      // If config file is provided, load it
      if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`Error: Config file not found at ${configPath}`);
          process.exit(1);
        }
        
        try {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          processConfig = JSON.parse(fileContent);
        } catch (error) {
          console.error(`Error parsing config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      } else {
        // Prompt for details if no config file
        processConfig = await promptForProcessDetails();
      }
      
      // Create discovery service
      const discoveryService = new AptosDiscoveryService({
        moduleAddress,
        aptosClient: client
      });
      
      console.log(`\nRegistering process on ${network}...`);
      
      // Register process
      const processId = await discoveryService.registerProcess(account, {
        id: uuid(),
        name: processConfig.name,
        description: processConfig.description,
        owner: account.address().toString(),
        agents: processConfig.agents,
        workflows: processConfig.workflows,
        tags: processConfig.tags,
        status: processConfig.status || 'active',
        pricing: processConfig.pricing,
        url: processConfig.url,
        created_at: Date.now(),
        updated_at: Date.now()
      });
      
      console.log(`\n✅ Process registered successfully!`);
      console.log(`Process ID: ${processId}`);
      console.log(`\nYou can now call this process through the A3 platform.`);
      
    } catch (error) {
      console.error(`\n❌ Error registering process: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Update command
program
  .command('update')
  .description('Update an existing agent process')
  .requiredOption('-i, --id <id>', 'Process ID to update')
  .option('-c, --config <path>', 'Path to updated process config file')
  .option('-p, --private-key <key>', 'Private key for the creator account')
  .option('-m, --module-address <address>', 'Module address')
  .option('-n, --network <network>', 'Aptos network (mainnet, testnet, devnet)', 'testnet')
  .action(async (options) => {
    try {
      // Get account from private key
      const privateKey = options.privateKey || process.env.APTOS_PRIVATE_KEY;
      if (!privateKey) {
        console.error('Error: Private key is required. Provide it with --private-key or set APTOS_PRIVATE_KEY in your environment.');
        process.exit(1);
      }
      
      // Parse private key and create account
      const hexKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const account = new AptosAccount(HexString.ensure(hexKey).toUint8Array());
      
      // Get module address
      const moduleAddress = options.moduleAddress || process.env.APTOS_MODULE_ADDRESS;
      if (!moduleAddress) {
        console.error('Error: Module address is required. Provide it with --module-address or set APTOS_MODULE_ADDRESS in your environment.');
        process.exit(1);
      }
      
      // Get network and create client
      const network = options.network || process.env.APTOS_NETWORK || 'testnet';
      const networkUrl = getNetworkUrl(network);
      const client = new AptosClient(networkUrl);
      
      // Create discovery service
      const discoveryService = new AptosDiscoveryService({
        moduleAddress,
        aptosClient: client
      });
      
      // Get current process
      console.log(`Fetching current process details for ${options.id}...`);
      const currentProcess = await discoveryService.getProcess(options.id);
      
      if (!currentProcess) {
        console.error(`Error: Process with ID ${options.id} not found.`);
        process.exit(1);
      }
      
      // Process config
      let processConfig: any = {};
      
      // If config file is provided, load it
      if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`Error: Config file not found at ${configPath}`);
          process.exit(1);
        }
        
        try {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          processConfig = JSON.parse(fileContent);
        } catch (error) {
          console.error(`Error parsing config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      } else {
        // Prompt for details if no config file, using current values as defaults
        processConfig = await promptForProcessDetails(currentProcess);
      }
      
      console.log(`\nUpdating process on ${network}...`);
      
      // Update process
      await discoveryService.updateProcess(account, options.id, {
        name: processConfig.name,
        description: processConfig.description,
        agents: processConfig.agents,
        workflows: processConfig.workflows,
        tags: processConfig.tags,
        status: processConfig.status || 'active',
        pricing: processConfig.pricing,
        url: processConfig.url
      });
      
      console.log(`\n✅ Process updated successfully!`);
      console.log(`Process ID: ${options.id}`);
      
    } catch (error) {
      console.error(`\n❌ Error updating process: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Deregister command
program
  .command('deregister')
  .description('Deregister an existing agent process')
  .requiredOption('-i, --id <id>', 'Process ID to deregister')
  .option('-p, --private-key <key>', 'Private key for the creator account')
  .option('-m, --module-address <address>', 'Module address')
  .option('-n, --network <network>', 'Aptos network (mainnet, testnet, devnet)', 'testnet')
  .action(async (options) => {
    try {
      // Get account from private key
      const privateKey = options.privateKey || process.env.APTOS_PRIVATE_KEY;
      if (!privateKey) {
        console.error('Error: Private key is required. Provide it with --private-key or set APTOS_PRIVATE_KEY in your environment.');
        process.exit(1);
      }
      
      // Parse private key and create account
      const hexKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const account = new AptosAccount(HexString.ensure(hexKey).toUint8Array());
      
      // Get module address
      const moduleAddress = options.moduleAddress || process.env.APTOS_MODULE_ADDRESS;
      if (!moduleAddress) {
        console.error('Error: Module address is required. Provide it with --module-address or set APTOS_MODULE_ADDRESS in your environment.');
        process.exit(1);
      }
      
      // Get network and create client
      const network = options.network || process.env.APTOS_NETWORK || 'testnet';
      const networkUrl = getNetworkUrl(network);
      const client = new AptosClient(networkUrl);
      
      // Create discovery service
      const discoveryService = new AptosDiscoveryService({
        moduleAddress,
        aptosClient: client
      });
      
      // Confirm deregistration
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to deregister process ${options.id}?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log('Deregistration cancelled.');
        process.exit(0);
      }
      
      console.log(`\nDeregistering process on ${network}...`);
      
      // Deregister process
      await discoveryService.deregisterProcess(account, options.id);
      
      console.log(`\n✅ Process deregistered successfully!`);
      console.log(`Process ID: ${options.id}`);
      
    } catch (error) {
      console.error(`\n❌ Error deregistering process: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List registered agent processes')
  .option('-o, --owner <address>', 'Filter by owner address')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('-s, --status <status>', 'Filter by status')
  .option('-m, --module-address <address>', 'Module address')
  .option('-n, --network <network>', 'Aptos network (mainnet, testnet, devnet)', 'testnet')
  .action(async (options) => {
    try {
      // Get module address
      const moduleAddress = options.moduleAddress || process.env.APTOS_MODULE_ADDRESS;
      if (!moduleAddress) {
        console.error('Error: Module address is required. Provide it with --module-address or set APTOS_MODULE_ADDRESS in your environment.');
        process.exit(1);
      }
      
      // Get network and create client
      const network = options.network || process.env.APTOS_NETWORK || 'testnet';
      const networkUrl = getNetworkUrl(network);
      const client = new AptosClient(networkUrl);
      
      // Create discovery service
      const discoveryService = new AptosDiscoveryService({
        moduleAddress,
        aptosClient: client
      });
      
      // Build search options
      const searchOptions: any = {};
      if (options.owner) searchOptions.owner = options.owner;
      if (options.tag) searchOptions.tags = [options.tag];
      if (options.status) searchOptions.status = options.status;
      
      console.log(`Listing processes on ${network}...`);
      
      // List processes
      const processes = await discoveryService.listProcesses(searchOptions);
      
      console.log(`\nFound ${processes.length} processes:`);
      
      // Display processes
      processes.forEach((process, index) => {
        console.log(`\n${index + 1}. ${process.name} (ID: ${process.id})`);
        console.log(`   Description: ${process.description}`);
        console.log(`   Owner: ${process.owner}`);
        console.log(`   Status: ${process.status}`);
        console.log(`   Tags: ${process.tags.join(', ')}`);
        console.log(`   URL: ${process.url}`);
        console.log(`   Created: ${new Date(process.created_at).toLocaleString()}`);
      });
      
    } catch (error) {
      console.error(`\n❌ Error listing processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Helper functions

/**
 * Get Aptos network URL
 */
function getNetworkUrl(network: string): string {
  const networks: Record<string, string> = {
    mainnet: 'https://fullnode.mainnet.aptoslabs.com/v1',
    testnet: 'https://fullnode.testnet.aptoslabs.com/v1',
    devnet: 'https://fullnode.devnet.aptoslabs.com/v1'
  };
  
  return networks[network] || networks.testnet;
}

/**
 * Prompt for process details
 */
async function promptForProcessDetails(currentProcess?: any): Promise<any> {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Process name:',
      default: currentProcess?.name || ''
    },
    {
      type: 'input',
      name: 'description',
      message: 'Process description:',
      default: currentProcess?.description || ''
    },
    {
      type: 'input',
      name: 'url',
      message: 'Process URL:',
      default: currentProcess?.url || '',
      validate: (input: string) => {
        if (!input) return 'URL is required';
        try {
          new URL(input);
          return true;
        } catch (error) {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Process tags (comma-separated):',
      default: currentProcess?.tags?.join(',') || '',
      filter: (input: string) => input.split(',').map(tag => tag.trim()).filter(Boolean)
    },
    {
      type: 'list',
      name: 'status',
      message: 'Process status:',
      choices: ['active', 'inactive', 'maintenance'],
      default: currentProcess?.status || 'active'
    },
    {
      type: 'input',
      name: 'agents',
      message: 'Agent addresses (comma-separated):',
      default: currentProcess?.agents?.join(',') || '',
      filter: (input: string) => input.split(',').map(agent => agent.trim()).filter(Boolean)
    },
    {
      type: 'input',
      name: 'workflows',
      message: 'Workflow IDs (comma-separated):',
      default: currentProcess?.workflows?.join(',') || '',
      filter: (input: string) => input.split(',').map(workflow => workflow.trim()).filter(Boolean)
    },
    {
      type: 'number',
      name: 'taskPrice',
      message: 'Task price:',
      default: currentProcess?.pricing?.taskPrice || 0
    },
    {
      type: 'input',
      name: 'currency',
      message: 'Currency:',
      default: currentProcess?.pricing?.currency || 'APT'
    },
    {
      type: 'input',
      name: 'paymentAddress',
      message: 'Payment address:',
      default: currentProcess?.pricing?.paymentAddress || ''
    },
    {
      type: 'confirm',
      name: 'requiresPrepayment',
      message: 'Requires prepayment?',
      default: currentProcess?.pricing?.requiresPrepayment || false
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  // Format pricing
  answers.pricing = {
    taskPrice: answers.taskPrice,
    currency: answers.currency,
    paymentAddress: answers.paymentAddress,
    requiresPrepayment: answers.requiresPrepayment
  };
  
  // Remove individual pricing fields
  delete answers.taskPrice;
  delete answers.currency;
  delete answers.paymentAddress;
  delete answers.requiresPrepayment;
  
  return answers;
}

// Parse arguments
program.parse(process.argv);

// If no arguments, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 