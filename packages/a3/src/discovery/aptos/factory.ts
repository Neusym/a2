import * as dotenv from 'dotenv';

import { DiscoveryService } from '../interfaces';

import { Network } from './deploy-contract';
import { AptosDiscoveryService, AptosDiscoveryConfig } from './discovery-service';


// Try to load .env file
dotenv.config();

/**
 * Options for creating an Aptos discovery service
 */
export interface CreateAptosDiscoveryOptions {
  /**
   * Private key for Aptos account
   */
  privateKey?: string;
  
  /**
   * Network to connect to (default: 'testnet')
   */
  network?: string;
  
  /**
   * Node URL override
   */
  nodeUrl?: string;
  
  /**
   * Module address where the registry contract is deployed
   */
  moduleAddress?: string;
  
  /**
   * Name of the registry module (default: 'process_registry')
   */
  moduleName?: string;
}

/**
 * Creates an Aptos discovery service with environment or provided configuration
 * 
 * This factory function simplifies creating an Aptos discovery service by:
 * 1. Using environment variables when not explicitly provided
 * 2. Providing sensible defaults
 * 
 * Environment variables used:
 * - APTOS_PRIVATE_KEY: Private key for Aptos account
 * - APTOS_NETWORK: Network to connect to (testnet, devnet, mainnet)
 * - APTOS_NODE_URL: Node URL override
 * - APTOS_MODULE_ADDRESS: Module address where the registry contract is deployed
 * 
 * @param options Configuration options
 * @returns Configured Aptos discovery service
 */
export function createAptosDiscoveryService(options: CreateAptosDiscoveryOptions = {}): DiscoveryService {
  // Get private key from options or environment
  const privateKey = options.privateKey || process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('No private key provided. Set APTOS_PRIVATE_KEY environment variable or pass privateKey option.');
  }
  
  // Get module address from options or environment
  const moduleAddress = options.moduleAddress || process.env.APTOS_MODULE_ADDRESS;
  if (!moduleAddress) {
    throw new Error('No module address provided. Set APTOS_MODULE_ADDRESS environment variable or pass moduleAddress option.');
  }
  
  // Build configuration with defaults
  const config: AptosDiscoveryConfig = {
    privateKey,
    moduleAddress,
    network: (options.network || process.env.APTOS_NETWORK || 'testnet') as Network,
    moduleName: options.moduleName || 'process_registry'
  };
  
  // Add optional node URL if provided
  if (options.nodeUrl || process.env.APTOS_NODE_URL) {
    config.nodeUrl = options.nodeUrl || process.env.APTOS_NODE_URL;
  }
  
  // Create and return the discovery service
  return new AptosDiscoveryService(config);
} 