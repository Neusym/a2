import * as dotenv from 'dotenv';

import { ProcessMetadata } from '../interfaces';

import { AptosDiscoveryService } from './index';

// Load environment variables
dotenv.config();

/**
 * Example client for the Aptos discovery service
 */
async function main() {
  // Check for required environment variables
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
  
  if (!privateKey) {
    console.error('Error: APTOS_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }
  
  if (!moduleAddress) {
    console.error('Error: APTOS_MODULE_ADDRESS environment variable is required');
    process.exit(1);
  }
  
  // Create the discovery service
  const discoveryService = new AptosDiscoveryService({
    network: (process.env.APTOS_NETWORK || 'testnet') as any,
    nodeUrl: process.env.APTOS_NODE_URL,
    privateKey,
    moduleAddress,
    moduleName: 'process_registry'
  });
  
  console.log('Initialized Aptos discovery service');
  
  // Create a unique process ID
  const processId = `process-${Date.now()}`;
  
  // Create process metadata
  const metadata: ProcessMetadata = {
    id: processId,
    name: 'Example Process',
    description: 'A demonstration process for the Aptos blockchain',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agents: [
      {
        id: 'agent-1',
        name: 'Main Agent',
        instructions: 'Handle the core process logic',
        goal: 'Complete the task efficiently',
        role: 'executor'
      },
      {
        id: 'agent-2',
        name: 'Helper Agent',
        instructions: 'Assist the main agent with subtasks',
        goal: 'Support the main agent',
        role: 'assistant'
      }
    ],
    workflows: [
      {
        id: 'workflow-1',
        name: 'Main Workflow',
        description: 'Core execution flow'
      }
    ],
    tags: ['example', 'aptos', 'blockchain'],
    owner: 'example-user',
    status: 'active'
  };
  
  try {
    // Register the process
    console.log(`Registering process ${processId}...`);
    await discoveryService.registerProcess(processId, metadata);
    console.log('Process registered successfully');
    
    // Retrieve the process metadata
    console.log(`Retrieving process ${processId}...`);
    const retrievedProcess = await discoveryService.getProcess(processId);
    console.log('Retrieved process:');
    console.log(JSON.stringify(retrievedProcess, null, 2));
    
    // Update the process
    console.log(`Updating process ${processId}...`);
    await discoveryService.updateProcess(processId, {
      status: 'inactive',
      updatedAt: new Date().toISOString(),
      description: 'Updated description for the demonstration process'
    });
    console.log('Process updated successfully');
    
    // Retrieve the updated process
    console.log(`Retrieving updated process ${processId}...`);
    const updatedProcess = await discoveryService.getProcess(processId);
    console.log('Updated process:');
    console.log(JSON.stringify(updatedProcess, null, 2));
    
    // List all processes
    console.log('Listing all processes...');
    const processes = await discoveryService.listProcesses();
    console.log(`Found ${processes.length} processes`);
    
    // List processes with filters
    console.log('Listing processes with "inactive" status...');
    const inactiveProcesses = await discoveryService.listProcesses({ status: 'inactive' });
    console.log(`Found ${inactiveProcesses.length} inactive processes`);
    
    // Deregister the process
    if (process.env.CLEANUP === 'true') {
      console.log(`Deregistering process ${processId}...`);
      await discoveryService.deregisterProcess(processId);
      console.log('Process deregistered successfully');
    } else {
      console.log('Skipping process deregistration (set CLEANUP=true to clean up)');
    }
    
    console.log('Example completed successfully');
  } catch (error) {
    console.error('Error during example execution:', error);
    process.exit(1);
  }
}

// Run the example if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { main as runExample }; 