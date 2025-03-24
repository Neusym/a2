import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Define Network enum to match the mocked version in discovery-service.ts
export enum Network {
  DEVNET = 'devnet',
  TESTNET = 'testnet',
  MAINNET = 'mainnet'
}

/**
 * Configuration for contract deployment
 */
interface DeployContractConfig {
  /**
   * Network to deploy to (default: testnet)
   */
  network?: Network;
  
  /**
   * Node URL override
   */
  nodeUrl?: string;
  
  /**
   * Private key for deployment
   */
  privateKey: string;
  
  /**
   * Path to the Move module
   */
  modulePath?: string;
  
  /**
   * Path to store the compiled bytecode
   */
  compiledModulePath?: string;
}

/**
 * Deploy the Process Registry smart contract to Aptos blockchain
 * 
 * This function uses the Aptos CLI to deploy the contract.
 * Make sure you have the CLI installed: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli
 * 
 * @param config Deployment configuration
 * @returns Deployment information
 */
export async function deployProcessRegistry(config: DeployContractConfig) {
  // Generate a temporary profile configuration for deployment
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aptos-deploy-'));
  const profilePath = path.join(tempDir, '.aptos', 'config.yaml');
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  
  // Set up profile based on network
  const network = config.network || Network.TESTNET;
  const nodeUrl = config.nodeUrl || getDefaultNodeUrl(network);
  
  // Write profile configuration
  const profileContent = `---
profiles:
  default:
    private_key: "${config.privateKey}"
    public_key: "auto"  # Will be derived from private key
    account: "auto"     # Will be derived from private key
    rest_url: "${nodeUrl}"
    faucet_url: "${getFaucetUrl(network)}"
`;
  
  fs.writeFileSync(profilePath, profileContent);
  
  try {
    console.log(`Using Aptos network: ${network}`);
    
    // Compile the Move module
    const modulePath = config.modulePath || path.resolve(__dirname, './process_registry.move');
    const outputDir = path.dirname(modulePath);
    
    console.log('Compiling Move module...');
    execSync(`aptos move compile --package-dir ${outputDir} --save-metadata --named-addresses process_registry=default`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      stdio: 'inherit'
    });
    
    // Deploy the module
    console.log('Deploying Process Registry module...');
    const publishOutput = execSync(`aptos move publish --package-dir ${outputDir} --named-addresses process_registry=default`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    // Extract transaction hash from output
    const txHashMatch = publishOutput.match(/Transaction hash: ([0-9a-f]+)/);
    const transactionHash = txHashMatch ? txHashMatch[1] : 'unknown';
    
    // Get account address
    const accountInfoOutput = execSync('aptos account list', {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    const accountMatch = accountInfoOutput.match(/Account: ([0-9a-f]+)/);
    const accountAddress = accountMatch ? accountMatch[1] : 'unknown';
    
    console.log(`✅ Process Registry module deployed successfully!`);
    console.log(`Module address: ${accountAddress}`);
    
    // Initialize the registry
    console.log('Initializing registry...');
    const initOutput = execSync(`aptos move run --function-id ${accountAddress}::process_registry::initialize`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    const initTxHashMatch = initOutput.match(/Transaction hash: ([0-9a-f]+)/);
    const initTransactionHash = initTxHashMatch ? initTxHashMatch[1] : 'unknown';
    
    console.log(`✅ Process Registry initialized successfully!`);
    
    return {
      accountAddress,
      transactionHash,
      initTransactionHash
    };
  } catch (error) {
    console.error('Error deploying module:', error);
    throw error;
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Could not clean up temporary directory:', e);
    }
  }
}

/**
 * Get the default node URL for a network
 */
function getDefaultNodeUrl(network: Network): string {
  switch (network) {
    case Network.DEVNET:
      return 'https://fullnode.devnet.aptoslabs.com/v1';
    case Network.MAINNET:
      return 'https://fullnode.mainnet.aptoslabs.com/v1';
    case Network.TESTNET:
    default:
      return 'https://fullnode.testnet.aptoslabs.com/v1';
  }
}

/**
 * Get the faucet URL for a network
 * Note: Mainnet doesn't have a faucet
 */
function getFaucetUrl(network: Network): string {
  switch (network) {
    case Network.DEVNET:
      return 'https://faucet.devnet.aptoslabs.com';
    case Network.TESTNET:
      return 'https://faucet.testnet.aptoslabs.com';
    case Network.MAINNET:
    default:
      return '';
  }
}

// CLI support
if (require.main === module) {
  // Load from .env file if present
  try {
    require('dotenv').config();
  } catch (e) {
    // Optional dependency
  }
  
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  const network = (process.env.APTOS_NETWORK || 'testnet') as Network;
  const nodeUrl = process.env.APTOS_NODE_URL;
  
  if (!privateKey) {
    console.error('Error: APTOS_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }
  
  deployProcessRegistry({
    privateKey,
    network,
    nodeUrl
  })
    .then(result => {
      console.log('Deployment completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
} 