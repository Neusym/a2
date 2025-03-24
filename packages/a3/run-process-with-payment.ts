#!/usr/bin/env node

/**
 * Run A3 Process with Payment Verification
 * 
 * This script demonstrates how to run a process with payment verification
 * for the Aptos blockchain. It will check if payment has been made
 * before executing the process.
 */

import * as dotenv from 'dotenv';

import { createAptosServices, ExtendedProcess } from './src';

// Load environment variables
dotenv.config();

/**
 * Run a process with payment verification
 * 
 * @param processId The ID of the process to run
 * @param userWalletAddress The wallet address of the user running the process
 */
async function runProcessWithPayment(processId: string, userWalletAddress: string): Promise<void> {
  console.log('🚀 A3 Process Execution with Payment Verification');
  console.log('===============================================');
  
  // Check for required environment variables
  if (!process.env.APTOS_PRIVATE_KEY) {
    throw new Error('APTOS_PRIVATE_KEY environment variable is required');
  }
  
  if (!process.env.APTOS_MODULE_ADDRESS) {
    throw new Error('APTOS_MODULE_ADDRESS environment variable is required');
  }
  
  try {
    console.log('1. Creating Aptos services...');
    // Create the services using factory function
    const { discoveryService, paymentService } = createAptosServices();
    console.log('✅ Services created');
    
    console.log(`2. Retrieving process ${processId}...`);
    // Get the process metadata from the discovery service
    const processMetadata = await discoveryService.getProcess(processId);
    
    if (!processMetadata) {
      throw new Error(`Process with ID ${processId} not found`);
    }
    
    console.log('✅ Process found');
    console.log(`    Name: ${processMetadata.name}`);
    console.log(`    Description: ${processMetadata.description}`);
    
    // Check if the process requires payment
    if (processMetadata.pricing) {
      console.log(`    Price: ${processMetadata.pricing.taskPrice} ${processMetadata.pricing.currency || 'APT'}`);
      console.log(`    Requires Prepayment: ${processMetadata.pricing.requiresPrepayment ? 'Yes' : 'No'}`);
      if (processMetadata.pricing.paymentAddress) {
        console.log(`    Payment Address: ${processMetadata.pricing.paymentAddress}`);
      }
    } else {
      console.log('    No pricing information available (process is free to use)');
    }
    
    // Check if the process has a creator profile
    if (processMetadata.creatorProfile) {
      console.log('    Creator Information:');
      if (processMetadata.creatorProfile.name) {
        console.log(`      Creator: ${processMetadata.creatorProfile.name}`);
      }
      if (processMetadata.creatorProfile.walletAddress) {
        console.log(`      Creator Wallet: ${processMetadata.creatorProfile.walletAddress}`);
      }
    }
    
    // Create an ExtendedProcess instance from the metadata
    console.log('3. Creating process instance...');
    const process = new ExtendedProcess({
      discoveryService,
      paymentService,
      metadata: {
        name: processMetadata.name,
        description: processMetadata.description,
        tags: processMetadata.tags,
        owner: processMetadata.owner,
        creatorProfile: processMetadata.creatorProfile,
        pricing: processMetadata.pricing
      }
    });
    
    console.log('✅ Process instance created');
    
    // Run the process with payment verification
    console.log('4. Verifying payment and running process...');
    console.log(`    User wallet: ${userWalletAddress}`);
    
    try {
      await process.runWithPaymentCheck(userWalletAddress);
      console.log('✅ Process execution successful');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Payment required')) {
        console.error('❌ Payment verification failed');
        console.error(error.message);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Process execution failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let processId: string | undefined;
let userWalletAddress: string | undefined;

// Parse simple command-line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--process-id' && args[i+1]) {
    processId = args[i+1];
    i++;
  } else if (args[i] === '--user-wallet' && args[i+1]) {
    userWalletAddress = args[i+1];
    i++;
  }
}

// Check for required arguments
if (!processId || !userWalletAddress) {
  const missingArgs = [];
  if (!processId) missingArgs.push('--process-id');
  if (!userWalletAddress) missingArgs.push('--user-wallet');
  
  throw new Error(`Missing required arguments: ${missingArgs.join(', ')}`);
}

// Run the process with payment verification if executed directly
if (require.main === module) {
  runProcessWithPayment(processId, userWalletAddress)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Execution failed:', error);
      process.exit(1);
    });
}

export { runProcessWithPayment }; 