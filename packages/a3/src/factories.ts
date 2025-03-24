import { AptosContractService } from './contract/aptos-contract-service';
import { ContractService } from './contract/interfaces';
import { createAptosDiscoveryService } from './discovery';
import { DiscoveryService } from './discovery/interfaces';
import { AptosPaymentService } from './payment/aptos-payment-service';
import { PaymentService } from './payment/interfaces';
import { validateEnv } from './utils';

/**
 * Create an Aptos Contract Service from environment variables
 * 
 * @returns ContractService instance
 */
export function createAptosContractService(): ContractService {
  const env = validateEnv();
  
  return new AptosContractService({
    network: env.network,
    moduleAddress: env.moduleAddress,
    privateKey: env.privateKey,
    nodeUrl: env.nodeUrl,
    faucetUrl: env.faucetUrl
  });
}

/**
 * Create an Aptos Payment Service from environment variables
 * 
 * @param contractService Optional contract service to use
 * @returns PaymentService instance
 */
export function createAptosPaymentService(contractService?: ContractService): PaymentService {
  const env = validateEnv();
  const contractSvc = contractService || createAptosContractService();
  
  return new AptosPaymentService({
    moduleAddress: env.moduleAddress,
    aptosClient: contractSvc.getAptosClient()
  });
}

/**
 * Create an instance with both discovery and payment services
 * 
 * @returns Object containing discovery and payment services
 */
export function createAptosServices(): {
  discoveryService: DiscoveryService;
  paymentService: PaymentService;
  contractService: ContractService;
} {
  validateEnv();
  
  // Create services in a way that avoids multiple instances
  const contractService = createAptosContractService();
  const paymentService = createAptosPaymentService(contractService);
  const discoveryService = createAptosDiscoveryService();
  
  return {
    discoveryService,
    paymentService,
    contractService
  };
} 