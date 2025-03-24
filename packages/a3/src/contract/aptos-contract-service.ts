import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { AptosClient } from 'aptos';

import { ContractConfig, ContractDeploymentResult, ContractService } from './interfaces';

const execPromise = promisify(exec);

/**
 * Aptos Contract Service implementation
 * 
 * Handles contract deployment and interaction with the Aptos blockchain
 */
export class AptosContractService implements ContractService {
  private config: ContractConfig;
  private aptosClient: AptosClient;
  
  /**
   * Create a new Aptos Contract Service
   * 
   * @param config Aptos contract configuration
   */
  constructor(config: ContractConfig) {
    this.config = config;
    this.aptosClient = new AptosClient(config.nodeUrl || 'https://fullnode.testnet.aptoslabs.com/v1');
  }
  
  /**
   * Get the AptosClient instance
   * 
   * @returns AptosClient instance used by this service
   */
  getAptosClient(): AptosClient {
    return this.aptosClient;
  }
  
  /**
   * Deploy a smart contract to the Aptos blockchain
   * 
   * @param contractPath Path to the contract file
   * @returns Promise resolving to contract deployment result
   */
  async deployContract(contractPath: string): Promise<ContractDeploymentResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(contractPath)) {
        return {
          success: false,
          error: `Contract file not found: ${contractPath}`
        };
      }
      
      // Get directory and filename from path
      const contractDir = path.dirname(contractPath);
      const contractName = path.basename(contractPath, path.extname(contractPath));
      
      // Create temp file with private key
      const privateKeyPath = path.join(contractDir, '.temp-key.txt');
      fs.writeFileSync(privateKeyPath, this.config.privateKey);
      
      try {
        // Run deployment command
        const deployCommand = `cd ${contractDir} && aptos move publish ` +
          `--package-dir . ` +
          `--named-addresses a3=${this.config.moduleAddress} ` +
          `--private-key-file ${privateKeyPath} ` +
          `--url ${this.config.nodeUrl || `https://fullnode.${this.config.network}.aptoslabs.com/v1`}`;
        
        console.log('Executing command:', deployCommand.replace(this.config.privateKey, '[PRIVATE_KEY]'));
        
        const { stdout, stderr } = await execPromise(deployCommand);
        
        console.log('Deployment stdout:', stdout);
        if (stderr) {
          console.log('Deployment stderr:', stderr);
        }
        
        // Parse the output to get the transaction hash
        const txHashMatch = stdout.match(/Transaction hash: (0x[a-f0-9]+)/i);
        const txHash = txHashMatch ? txHashMatch[1] : undefined;
        
        return {
          success: true,
          transactionHash: txHash,
          moduleAddress: this.config.moduleAddress,
          timestamp: new Date().toISOString()
        };
      } finally {
        // Clean up private key file
        if (fs.existsSync(privateKeyPath)) {
          fs.unlinkSync(privateKeyPath);
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Execute a contract function on the Aptos blockchain
   * 
   * @param functionName Name of the function to execute
   * @param args Arguments for the function
   * @returns Promise resolving to the transaction hash
   */
  async executeFunction(functionName: string, args: any[]): Promise<string> {
    try {
      // Format the arguments as a JSON string
      const argsJson = JSON.stringify(args);
      
      // Create temp file with private key
      const tempDir = fs.mkdtempSync('aptos-');
      const privateKeyPath = path.join(tempDir, 'key.txt');
      fs.writeFileSync(privateKeyPath, this.config.privateKey);
      
      try {
        // Run execution command
        const { stdout } = await execPromise(
          `aptos move run ` +
          `--function ${this.config.moduleAddress}::${functionName} ` +
          `--args ${argsJson} ` +
          `--private-key-file ${privateKeyPath} ` +
          `--url ${this.config.nodeUrl || `https://${this.config.network}.aptoslabs.com/v1`}`
        );
        
        // Parse the output to get the transaction hash
        const txHashMatch = stdout.match(/Transaction hash: (0x[a-f0-9]+)/i);
        if (!txHashMatch) {
          throw new Error('Could not find transaction hash in output');
        }
        
        return txHashMatch[1];
      } finally {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir, { recursive: true });
        }
      }
    } catch (error) {
      console.error('Error executing contract function:', error);
      throw error;
    }
  }
  
  /**
   * Query contract data from the Aptos blockchain
   * 
   * @param functionName Name of the function to query
   * @param args Arguments for the function
   * @returns Promise resolving to the query result
   */
  async queryFunction(functionName: string, args: any[]): Promise<any> {
    try {
      // Format the arguments as a JSON string
      const argsJson = JSON.stringify(args);
      
      // Run query command
      const { stdout } = await execPromise(
        `aptos move view ` +
        `--function ${this.config.moduleAddress}::${functionName} ` +
        `--args ${argsJson} ` +
        `--url ${this.config.nodeUrl || `https://${this.config.network}.aptoslabs.com/v1`}`
      );
      
      // Parse the output as JSON
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Error querying contract function:', error);
      throw error;
    }
  }
  
  /**
   * Get the current account balance
   * 
   * @param address Wallet address to check balance (default: config.moduleAddress)
   * @returns Promise resolving to the balance as a string
   */
  async getBalance(address?: string): Promise<string> {
    try {
      const targetAddress = address || this.config.moduleAddress;
      
      // Run balance query command
      const { stdout } = await execPromise(
        `aptos account list ` +
        `--account ${targetAddress} ` +
        `--url ${this.config.nodeUrl || `https://${this.config.network}.aptoslabs.com/v1`}`
      );
      
      // Parse the output to get the balance
      const balanceMatch = stdout.match(/Coin balance: (\d+(\.\d+)?)/i);
      if (!balanceMatch) {
        throw new Error('Could not find balance in output');
      }
      
      return balanceMatch[1];
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw error;
    }
  }
} 