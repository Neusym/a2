#!/usr/bin/env node

/**
 * List A3 Processes on Aptos Blockchain
 * 
 * This script retrieves and displays all processes registered
 * on the Aptos blockchain via the A3 discovery service.
 */

import * as dotenv from 'dotenv';

import { createAptosDiscoveryService } from './src';

// Load environment variables
dotenv.config();

/**
 * List all processes registered on the Aptos blockchain
 */
async function listAllProcesses(filterTags?: string[]) {
  console.log('📋 A3 Process Listing');
  console.log('===================');
  
  // Check for required environment variables
  if (!process.env.APTOS_PRIVATE_KEY) {
    throw new Error('APTOS_PRIVATE_KEY environment variable is required');
  }
  
  if (!process.env.APTOS_MODULE_ADDRESS) {
    throw new Error('APTOS_MODULE_ADDRESS environment variable is required');
  }
  
  try {
    console.log('1. Creating Aptos discovery service...');
    // Create the discovery service using factory function
    const discoveryService = createAptosDiscoveryService();
    console.log('✅ Discovery service created');
    
    console.log('2. Retrieving processes from blockchain...');
    // Create query filters if tags are provided
    const filters = filterTags && filterTags.length > 0 ? { tags: filterTags } : undefined;
    
    // List processes with optional filters
    const processes = await discoveryService.listProcesses(filters);
    
    console.log(`✅ Retrieved ${processes.length} processes`);
    
    if (processes.length === 0) {
      console.log('\nNo processes found.');
      if (filterTags && filterTags.length > 0) {
        console.log(`No processes matched the tags: ${filterTags.join(', ')}`);
      }
    } else {
      console.log('\nRegistered Processes:');
      console.log('-------------------');
      
      // Display process details
      processes.forEach((process, index) => {
        console.log(`\n[${index + 1}] Process ID: ${process.id}`);
        console.log(`    Name: ${process.name}`);
        console.log(`    Description: ${process.description}`);
        console.log(`    Owner: ${process.owner}`);
        console.log(`    Status: ${process.status}`);
        console.log(`    Created: ${new Date(process.createdAt).toLocaleString()}`);
        console.log(`    Updated: ${new Date(process.updatedAt).toLocaleString()}`);
        if (process.tags && process.tags.length > 0) {
          console.log(`    Tags: ${process.tags.join(', ')}`);
        }
        
        // Display creator profile if available
        if (process.creatorProfile) {
          console.log(`    Creator Profile:`);
          if (process.creatorProfile.name) {
            console.log(`      Name: ${process.creatorProfile.name}`);
          }
          if (process.creatorProfile.description) {
            console.log(`      Description: ${process.creatorProfile.description}`);
          }
          if (process.creatorProfile.walletAddress) {
            console.log(`      Wallet: ${process.creatorProfile.walletAddress}`);
          }
          if (process.creatorProfile.website) {
            console.log(`      Website: ${process.creatorProfile.website}`);
          }
          if (process.creatorProfile.social && Object.keys(process.creatorProfile.social).length > 0) {
            console.log(`      Social:`);
            for (const [platform, url] of Object.entries(process.creatorProfile.social)) {
              console.log(`        ${platform}: ${url}`);
            }
          }
        }
        
        // Display pricing information if available
        if (process.pricing) {
          console.log(`    Pricing:`);
          console.log(`      Task Price: ${process.pricing.taskPrice} ${process.pricing.currency || 'APT'}`);
          if (process.pricing.paymentAddress) {
            console.log(`      Payment Address: ${process.pricing.paymentAddress}`);
          }
          console.log(`      Requires Prepayment: ${process.pricing.requiresPrepayment ? 'Yes' : 'No'}`);
        }
      });
    }
    
    // Get network and module address from environment variables
    const network = process.env.APTOS_NETWORK || 'testnet';
    const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
    
    console.log('\n📊 View all processes on the Aptos Explorer:');
    console.log(`https://${network}.aptos.dev/account/${moduleAddress}`);
    
    return {
      success: true,
      count: processes.length,
      processes
    };
  } catch (error) {
    console.error('Failed to list processes:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let filterTags: string[] | undefined;

// Parse simple command-line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tags' && args[i+1]) {
    filterTags = args[i+1].split(',');
    i++;
  }
}

// Run the listing if this script is executed directly
if (require.main === module) {
  listAllProcesses(filterTags)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Listing failed:', error);
      process.exit(1);
    });
}

export { listAllProcesses }; 