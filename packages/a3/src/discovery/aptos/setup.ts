#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import * as dotenv from 'dotenv';

import { deployProcessRegistry, Network } from './deploy-contract';



// Load environment variables
dotenv.config();

/**
 * Interactive setup for the Aptos Process Registry
 */
async function setup() {
  console.log('🚀 a3 Aptos Process Registry Setup');
  console.log('==================================');
  console.log('This script will help you deploy the Process Registry contract to Aptos blockchain');
  console.log('and configure your environment for using the AptosDiscoveryService.');
  console.log('\n');
  
  // Check if Aptos CLI is installed
  try {
    execSync('aptos --version', { stdio: 'pipe' });
  } catch (e) {
    console.error('❌ Aptos CLI is not installed or not in PATH');
    console.log('Please install the Aptos CLI: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli');
    process.exit(1);
  }
  
  // Create interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Promisify readline question
  const question = (query: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(query, resolve);
    });
  };
  
  try {
    // Get private key
    let privateKey = process.env.APTOS_PRIVATE_KEY;
    if (!privateKey) {
      privateKey = await question('Enter your Aptos private key (or create a new account with "aptos account create"): ');
      if (!privateKey) {
        throw new Error('Private key is required');
      }
    }
    
    // Get network
    const networkOptions = ['testnet', 'devnet', 'mainnet'];
    const defaultNetwork = process.env.APTOS_NETWORK || 'testnet';
    
    let networkInput = await question(`Choose network (${networkOptions.join('/')}) [${defaultNetwork}]: `);
    networkInput = networkInput || defaultNetwork;
    
    if (!networkOptions.includes(networkInput)) {
      throw new Error(`Invalid network: ${networkInput}. Must be one of: ${networkOptions.join(', ')}`);
    }
    
    const network = networkInput as Network;
    
    // Get node URL (optional)
    const defaultNodeUrl = getDefaultNodeUrl(network);
    const nodeUrlInput = await question(`Node URL [${defaultNodeUrl}]: `);
    const nodeUrl = nodeUrlInput || defaultNodeUrl;
    
    console.log('\n🔧 Deploying Process Registry contract...');
    
    // Deploy the contract
    const deployResult = await deployProcessRegistry({
      privateKey,
      network: network as Network,
      nodeUrl
    });
    
    const moduleAddress = deployResult.accountAddress;
    
    console.log('\n✅ Contract deployed successfully!');
    console.log(`Module address: ${moduleAddress}`);
    
    // Create .env file for the user
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = `# Aptos Process Registry Configuration
APTOS_PRIVATE_KEY=${privateKey}
APTOS_NETWORK=${network}
APTOS_NODE_URL=${nodeUrl}
APTOS_MODULE_ADDRESS=${moduleAddress}
`;
    
    const updateEnv = fs.existsSync(envPath) 
      ? await question('\nA .env file already exists. Update it with Aptos configuration? (y/n) [y]: ')
      : 'y';
    
    if (updateEnv === '' || updateEnv.toLowerCase() === 'y') {
      if (fs.existsSync(envPath)) {
        // Read existing .env and append our values, replacing any existing Aptos values
        let existingEnv = fs.readFileSync(envPath, 'utf8');
        const aptosRegex = /^APTOS_[A-Z_]+=.*/gm;
        existingEnv = existingEnv.replace(aptosRegex, '');
        
        // Remove empty lines
        existingEnv = existingEnv.replace(/\n+/g, '\n');
        
        fs.writeFileSync(envPath, existingEnv + '\n' + envContent);
      } else {
        fs.writeFileSync(envPath, envContent);
      }
      
      console.log('✅ Environment configuration saved to .env file');
    }
    
    // Create a sample implementation file
    const createExample = await question('\nCreate an example implementation file? (y/n) [y]: ');
    
    if (createExample === '' || createExample.toLowerCase() === 'y') {
      const examplePath = path.resolve(process.cwd(), 'aptos-discovery-example.ts');
      
      const exampleContent = `import { AptosDiscoveryService } from '@a3/platform/discovery/aptos';
import { ProcessMetadata } from '@a3/platform/discovery/interfaces';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Create the discovery service
  const discoveryService = new AptosDiscoveryService({
    network: process.env.APTOS_NETWORK as any,
    nodeUrl: process.env.APTOS_NODE_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY!,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS!,
    moduleName: 'process_registry'
  });
  
  // Create a unique process ID
  const processId = \`process-\${Date.now()}\`;
  
  // Create process metadata
  const metadata: ProcessMetadata = {
    id: processId,
    name: 'Example Process',
    description: 'A demonstration process',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agents: [
      { id: 'agent-1', name: 'Worker Agent' }
    ],
    workflows: [
      { id: 'workflow-1', name: 'Main Workflow' }
    ],
    tags: ['example'],
    owner: 'user123',
    status: 'active'
  };
  
  // Register the process
  console.log(\`Registering process \${processId}...\`);
  await discoveryService.registerProcess(processId, metadata);
  console.log('Process registered successfully');
  
  // Retrieve the process
  const process = await discoveryService.getProcess(processId);
  console.log('Retrieved process:', process);
}

main()
  .then(() => console.log('Example completed successfully'))
  .catch(error => console.error('Error:', error));
`;
      
      fs.writeFileSync(examplePath, exampleContent);
      console.log(`✅ Example implementation saved to ${examplePath}`);
    }
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Use the AptosDiscoveryService in your code:');
    console.log('```typescript');
    console.log(`import { AptosDiscoveryService } from '@a3/platform/discovery/aptos';

const discoveryService = new AptosDiscoveryService({
  network: '${network}',
  privateKey: process.env.APTOS_PRIVATE_KEY!,
  moduleAddress: '${moduleAddress}',
  moduleName: 'process_registry'
});`);
    console.log('```');
    
    console.log('\n2. Run the example (if created):');
    console.log('```bash');
    console.log('npx ts-node aptos-discovery-example.ts');
    console.log('```');
    
    return {
      success: true,
      privateKey,
      network,
      nodeUrl,
      moduleAddress
    };
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    rl.close();
  }
}

/**
 * Get the default node URL for a network
 */
function getDefaultNodeUrl(network: Network | string): string {
  switch (network) {
    case Network.DEVNET:
    case 'devnet':
      return 'https://fullnode.devnet.aptoslabs.com/v1';
    case Network.MAINNET:
    case 'mainnet':
      return 'https://fullnode.mainnet.aptoslabs.com/v1';
    case Network.TESTNET:
    case 'testnet':
    default:
      return 'https://fullnode.testnet.aptoslabs.com/v1';
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setup()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setup }; 