import { ContractService } from './contract';
import { CreatorService } from './creator';
import { DiscoveryService } from './discovery';
import { PaymentService } from './payment';
import { ProcessService } from './process';
import { TransactionService } from './transaction';
import { A3ClientConfig, NetworkType } from './types';

/**
 * Main A3 SDK client that provides access to all platform services
 */
export class A3Client {
  private readonly config: A3ClientConfig;
  private readonly processService: ProcessService;
  private readonly paymentService: PaymentService;
  private readonly discoveryService: DiscoveryService;
  private readonly contractService: ContractService;
  private readonly creatorService: CreatorService;
  private readonly transactionService: TransactionService;

  /**
   * Creates a new A3 SDK client
   *
   * @param config Configuration for the A3 SDK
   */
  constructor(config: A3ClientConfig) {
    // Validate that apiUrl is provided
    if (!config.apiUrl) {
      throw new Error('apiUrl is required in A3ClientConfig');
    }

    this.config = {
      network: 'testnet',
      nodeUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
      ...config,
    };

    // Initialize services
    this.discoveryService = new DiscoveryService(this.config);
    this.paymentService = new PaymentService(this.config);
    this.processService = new ProcessService(
      this.config,
      this.discoveryService,
      this.paymentService
    );
    this.contractService = new ContractService(this.config);
    this.creatorService = new CreatorService(this.config);
    this.transactionService = new TransactionService(this.config);

    // Resolve circular dependency
    this.paymentService.setClient(this);
  }

  /**
   * Get the process service for managing A3 processes
   */
  get process(): ProcessService {
    return this.processService;
  }

  /**
   * Get the payment service for handling payments
   */
  get payment(): PaymentService {
    return this.paymentService;
  }

  /**
   * Get the discovery service for finding processes
   */
  get discovery(): DiscoveryService {
    return this.discoveryService;
  }

  /**
   * Get the contract service for deploying and interacting with contracts
   */
  get contract(): ContractService {
    return this.contractService;
  }

  /**
   * Get the creator service for managing creator profiles
   */
  get creator(): CreatorService {
    return this.creatorService;
  }

  /**
   * Get the transaction service for managing transactions
   */
  get transaction(): TransactionService {
    return this.transactionService;
  }
}

/**
 * Creates and returns a new A3 SDK client
 *
 * @param config Configuration for the A3 SDK
 * @returns A new A3 SDK client instance
 */
export function createA3Client(config: A3ClientConfig): A3Client {
  return new A3Client(config);
}

/**
 * Load environment variables for the A3 client
 */
export function loadEnvironment(): Partial<A3ClientConfig> {
  return {
    privateKey: process.env.APTOS_PRIVATE_KEY,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
    network: process.env.APTOS_NETWORK as NetworkType | undefined,
    nodeUrl: process.env.APTOS_NODE_URL,
    faucetUrl: process.env.APTOS_FAUCET_URL,
    apiUrl: process.env.A3_API_URL,
    apiKey: process.env.A3_API_KEY,
  };
}
