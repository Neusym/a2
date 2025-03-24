#!/usr/bin/env node

/**
 * Deploy Aptos Smart Contract
 * 
 * This script deploys a smart contract to the Aptos blockchain
 * using the contract service.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

import { createAptosContractService } from './src';

// Load environment variables
dotenv.config();

/**
 * Deploy a contract to the Aptos blockchain
 * 
 * @param contractPath Path to the contract file
 */
async function deployContract(contractPath: string): Promise<void> {
  console.log('🚀 A3 Contract Deployment');
  console.log('=======================');
  
  // Check if contract file exists
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }
  
  // Check for required environment variables
  if (!process.env.APTOS_PRIVATE_KEY) {
    throw new Error('APTOS_PRIVATE_KEY environment variable is required');
  }
  
  if (!process.env.APTOS_MODULE_ADDRESS) {
    throw new Error('APTOS_MODULE_ADDRESS environment variable is required');
  }
  
  try {
    console.log('1. Creating Aptos contract service...');
    // Create the contract service using factory function
    const contractService = createAptosContractService();
    console.log('✅ Contract service created');
    
    // Get contract details
    const contractName = path.basename(contractPath, path.extname(contractPath));
    const contractDir = path.dirname(contractPath);
    
    console.log(`2. Deploying contract ${contractName}...`);
    console.log(`    Path: ${contractPath}`);
    console.log(`    Network: ${process.env.APTOS_NETWORK || 'testnet'}`);
    console.log(`    Module Address: ${process.env.APTOS_MODULE_ADDRESS}`);
    
    // Deploy the contract
    const result = await contractService.deployContract(contractPath);
    
    if (result.success) {
      console.log('✅ Contract deployed successfully');
      if (result.transactionHash) {
        console.log(`    Transaction Hash: ${result.transactionHash}`);
      }
      console.log(`    Module Address: ${result.moduleAddress}`);
      console.log(`    Timestamp: ${result.timestamp}`);
      
      // Print explorer link
      const network = process.env.APTOS_NETWORK || 'testnet';
      console.log('\nView your contract on the Aptos Explorer:');
      console.log(`https://${network}.aptos.dev/account/${result.moduleAddress}`);
    } else {
      console.error('❌ Contract deployment failed');
      if (result.error) {
        console.error(`    Error: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Contract deployment failed:', error);
    throw error;
  }
}

// Parse command line arguments
let contractPath: string | undefined = undefined;
let i = 0;
const args = process.argv.slice(2);
console.log('Command arguments:', args);

while (i < args.length) {
  if (args[i] === '--path' || args[i] === '-p') {
    if (i + 1 < args.length) {
      contractPath = args[i+1];
      i++;
    }
  } else if (!contractPath) {
    // If the argument isn't a flag, treat it as the path
    contractPath = args[i];
  }
  i++;
}

console.log('Contract path from args:', contractPath);

// Use current directory's Move.toml file if no path provided
if (!contractPath) {
  const defaultPath = path.join(process.cwd(), 'Move.toml');
  if (fs.existsSync(defaultPath)) {
    contractPath = defaultPath;
  } else {
    throw new Error('No contract path provided and no Move.toml found in current directory');
  }
}

// Ensure the path exists
if (!fs.existsSync(contractPath)) {
  // If the path doesn't exist, try to add .toml extension or check if it's a directory
  if (fs.existsSync(`${contractPath}.toml`)) {
    contractPath = `${contractPath}.toml`;
  } else if (fs.existsSync(path.join(contractPath, 'Move.toml'))) {
    contractPath = path.join(contractPath, 'Move.toml');
  } else {
    throw new Error(`Contract file not found: ${contractPath}`);
  }
}

console.log('Final contract path:', contractPath);

// Run the deployment if executed directly
if (require.main === module) {
  deployContract(contractPath)
    .then((result) => {
      console.log('Deployment result:', JSON.stringify(result, null, 2));
      
      // Get path to Move.toml
      const movePath = path.resolve(contractPath);
      console.log('Move path:', movePath);
      
      // Display environment variables
      console.log('Environment variables:');
      console.log('- APTOS_PRIVATE_KEY:', process.env.APTOS_PRIVATE_KEY?.substring(0, 8) + '...');
      console.log('- APTOS_MODULE_ADDRESS:', process.env.APTOS_MODULE_ADDRESS);
      console.log('- APTOS_NETWORK:', process.env.APTOS_NETWORK);
      console.log('- APTOS_NODE_URL:', process.env.APTOS_NODE_URL);
      
      // Try to run a direct CLI command for diagnostic purposes
      const { exec } = require('child_process');
      console.log('\nRunning direct Aptos CLI command for diagnostics:');
      exec('aptos account list', (error: Error | null, stdout: string, stderr: string) => {
        console.log('Aptos CLI output:', stdout);
        if (error || stderr) {
          console.error('Aptos CLI error:', error || stderr);
        }
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

export { deployContract }; 