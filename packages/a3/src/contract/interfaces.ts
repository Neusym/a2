/**
 * Blockchain contract configuration
 */
export interface ContractConfig {
  network: string;
  moduleAddress: string;
  privateKey: string;
  nodeUrl?: string;
  faucetUrl?: string;
}

/**
 * Contract deployment result
 */
export interface ContractDeploymentResult {
  success: boolean;
  transactionHash?: string;
  moduleAddress?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Contract service interface for managing blockchain interactions
 */
export interface ContractService {
  /**
   * Deploy a smart contract to the blockchain
   * 
   * @param contractPath Path to the contract file
   * @returns Promise resolving to contract deployment result
   */
  deployContract(contractPath: string): Promise<ContractDeploymentResult>;
  
  /**
   * Execute a contract function
   * 
   * @param functionName Name of the function to execute
   * @param args Arguments for the function
   * @returns Promise resolving to the transaction hash
   */
  executeFunction(functionName: string, args: any[]): Promise<string>;
  
  /**
   * Query contract data from the blockchain
   * 
   * @param functionName Name of the function to query
   * @param args Arguments for the function
   * @returns Promise resolving to the query result
   */
  queryFunction(functionName: string, args: any[]): Promise<any>;
  
  /**
   * Get the current account balance
   * 
   * @param address Wallet address to check balance
   * @returns Promise resolving to the balance as a string
   */
  getBalance(address?: string): Promise<string>;
  
  /**
   * Get the AptosClient instance
   * 
   * @returns AptosClient instance used by this service
   */
  getAptosClient(): any;
} 