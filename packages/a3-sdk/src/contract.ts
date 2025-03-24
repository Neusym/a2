import axios from 'axios';

import { A3ClientConfig, ContractDeployment } from './types';
import { buildUrl } from './utils';

/**
 * Service for managing contracts on the Aptos blockchain
 */
export class ContractService {
  private readonly config: A3ClientConfig;

  /**
   * Creates a new contract service
   *
   * @param config SDK configuration
   */
  constructor(config: A3ClientConfig) {
    this.config = config;
  }

  /**
   * Deploy a Move contract to the Aptos blockchain
   *
   * @param contractCode Contract source code or compiled bytecode
   * @param isCompiled Whether the provided code is already compiled
   * @returns Contract deployment result
   */
  async deployContract(
    contractCode: string,
    isCompiled: boolean = false
  ): Promise<ContractDeployment> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to deploy a contract');
      }

      const url = buildUrl(this.config.apiUrl || '', '/contracts/deploy');

      const response = await axios.post(
        url,
        {
          contractCode,
          isCompiled,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.privateKey}`,
          },
        }
      );

      return {
        success: true,
        transactionHash: response.data.transactionHash,
        contractAddress: response.data.contractAddress,
      };
    } catch (error) {
      console.error('Error deploying contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy a Move contract from a file to the Aptos blockchain
   *
   * @param fileContent Contract file content
   * @param fileName Original file name (optional)
   * @param isCompiled Whether the file contains compiled bytecode
   * @returns Contract deployment result
   */
  async deployContractFromFile(
    fileContent: string | ArrayBuffer,
    fileName: string = 'contract.move',
    isCompiled: boolean = false
  ): Promise<ContractDeployment> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to deploy a contract');
      }

      const url = buildUrl(this.config.apiUrl || '', '/contracts/deploy-file');

      // Create form data
      const formData = new FormData();
      formData.append('isCompiled', isCompiled.toString());

      // Create a blob from the file content
      // This works in both browser and Node.js environments
      const blob =
        typeof fileContent === 'string'
          ? new Blob([fileContent], { type: 'text/plain' })
          : new Blob([fileContent], { type: 'application/octet-stream' });

      formData.append('contract', blob, fileName);

      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${this.config.privateKey}`,
        },
      });

      return {
        success: true,
        transactionHash: response.data.transactionHash,
        contractAddress: response.data.contractAddress,
      };
    } catch (error) {
      console.error('Error deploying contract from file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Call a function on a deployed contract
   *
   * @param contractAddress Address of the contract
   * @param functionName Name of the function to call
   * @param args Arguments to pass to the function
   * @param gasLimit Optional gas limit for the transaction
   * @returns Transaction hash if successful, null otherwise
   */
  async callContract(
    contractAddress: string,
    functionName: string,
    args: any[] = [],
    gasLimit?: number
  ): Promise<string | null> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to call a contract');
      }

      const url = buildUrl(this.config.apiUrl || '', '/contracts/call');

      const response = await axios.post(
        url,
        {
          contractAddress,
          functionName,
          args,
          gasLimit,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.privateKey}`,
          },
        }
      );

      return response.data.transactionHash;
    } catch (error) {
      console.error('Error calling contract:', error);
      return null;
    }
  }
}
