#!/usr/bin/env node

/**
 * Get A3 Process from Aptos Blockchain
 * 
 * This script retrieves and displays a specific process
 * from the Aptos blockchain using the A3 discovery service.
 */

import * as dotenv from 'dotenv';

import { createAptosDiscoveryService } from './src';

// Load environment variables
dotenv.config();

/**
 * Get a specific process from the Aptos blockchain by ID
 */
async function getProcess(processId: string) {
  console.log('🔍 A3 Process Lookup');
  console.log('==================');
  
  // Check for required environment variables
  if (!process.env.APTOS_PRIVATE_KEY) {
    throw new Error('APTOS_PRIVATE_KEY environment variable is required');
  }
  
  if (!process.env.APTOS_MODULE_ADDRESS) {
    throw new Error('APTOS_MODULE_ADDRESS environment variable is required');
  }
  
  if (!processId) {
    throw new Error('Process ID is required');
  }
  
  try {
    console.log('1. Creating Aptos discovery service...');
    // Create the discovery service using factory function
    const discoveryService = createAptosDiscoveryService();
    console.log('✅ Discovery service created');
    
    console.log(`2. Retrieving process ${processId} from blockchain...`);
    // Get the specific process by ID
    const processData = await discoveryService.getProcess(processId);
    
    if (!processData) {
      console.log(`\n❌ Process with ID "${processId}" not found.`);
      return {
        success: false,
        message: 'Process not found'
      };
    }
    
    console.log('✅ Process found');
    
    // Display process details
    console.log('\nProcess Details:');
    console.log('--------------');
    console.log(`ID: ${processData.id}`);
    console.log(`Name: ${processData.name}`);
    console.log(`Description: ${processData.description}`);
    console.log(`Owner: ${processData.owner}`);
    console.log(`Status: ${processData.status}`);
    console.log(`Created: ${new Date(processData.createdAt).toLocaleString()}`);
    console.log(`Updated: ${new Date(processData.updatedAt).toLocaleString()}`);
    
    if (processData.tags && processData.tags.length > 0) {
      console.log(`Tags: ${processData.tags.join(', ')}`);
    }
    
    // Get network and module address from environment variables
    const network = process.env.APTOS_NETWORK || 'testnet';
    const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
    
    console.log('\n🔗 View on Aptos Explorer:');
    console.log(`https://${network}.aptos.dev/account/${moduleAddress}`);
    
    return {
      success: true,
      process: processData
    };
  } catch (error) {
    console.error('Process lookup failed:', error);
    throw error;
  }
}

// Get process ID from command line arguments
const processId = process.argv[2];

// Run the process lookup if this script is executed directly
if (require.main === module) {
  getProcess(processId)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Lookup failed:', error);
      process.exit(1);
    });
}

export { getProcess }; 