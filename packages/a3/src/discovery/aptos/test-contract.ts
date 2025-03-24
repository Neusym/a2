import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ProcessMetadata } from '../interfaces';
import { deployProcessRegistry } from './deploy-contract';
// Import Network enum from deploy-contract
import { Network } from './deploy-contract';

// Load environment variables
dotenv.config();

/**
 * Test the Aptos smart contract directly using CLI commands
 */
async function testContract() {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('APTOS_PRIVATE_KEY environment variable is required');
  }

  console.log('Starting Aptos contract test...');
  console.log('1. Deploying contract to local testnet or devnet...');
  
  // Deploy the contract
  const deployResult = await deployProcessRegistry({
    privateKey,
    network: Network.DEVNET,
    // Use devnet for testing to avoid affecting real data
  });
  
  const moduleAddress = deployResult.accountAddress;
  console.log(`Contract deployed at address: ${moduleAddress}`);

  // Create a temporary profile for testing
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aptos-test-'));
  const profilePath = path.join(tempDir, '.aptos', 'config.yaml');
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  
  // Write profile configuration
  const profileContent = `---
profiles:
  default:
    private_key: "${privateKey}"
    public_key: "auto"
    account: "auto"
    rest_url: "https://fullnode.devnet.aptoslabs.com/v1"
    faucet_url: "https://faucet.devnet.aptoslabs.com"
`;
  
  fs.writeFileSync(profilePath, profileContent);
  
  try {
    console.log('2. Creating test process data...');
    // Create a test process
    const processId = `test-process-${Date.now()}`;
    const metadata: ProcessMetadata = {
      id: processId,
      name: 'Test Process',
      description: 'A test process for the contract',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agents: [{ id: 'agent-1', name: 'Test Agent' }],
      workflows: [{ id: 'workflow-1', name: 'Test Workflow' }],
      tags: ['test'],
      owner: 'test-user',
      status: 'active'
    };
    
    const metadataJson = JSON.stringify(metadata);
    
    console.log('3. Registering test process...');
    // Register a process
    const registerOutput = execSync(`aptos move run --function-id ${moduleAddress}::process_registry::register_process --args string:${processId} string:'${metadataJson}'`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    console.log('Registration output:', registerOutput);
    
    // Wait for transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('4. Fetching process data...');
    // Get process data (need to use the CLI view command)
    const getOutput = execSync(`aptos move view --function-id ${moduleAddress}::process_registry::get_process --args address:${moduleAddress} string:${processId}`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    console.log('Process data:', getOutput);
    
    console.log('5. Updating process...');
    // Update process
    const updatedMetadata = {
      ...metadata,
      status: 'inactive',
      description: 'Updated test description',
      updatedAt: new Date().toISOString()
    };
    
    const updateOutput = execSync(`aptos move run --function-id ${moduleAddress}::process_registry::update_process --args string:${processId} string:'${JSON.stringify(updatedMetadata)}'`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    console.log('Update output:', updateOutput);
    
    // Wait for transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('6. Fetching all processes...');
    // List all processes
    const listOutput = execSync(`aptos move view --function-id ${moduleAddress}::process_registry::list_processes --args address:${moduleAddress}`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    console.log('Process list:', listOutput);
    
    console.log('7. Deregistering process...');
    // Deregister process
    const deregisterOutput = execSync(`aptos move run --function-id ${moduleAddress}::process_registry::deregister_process --args string:${processId}`, {
      env: { ...process.env, APTOS_CONFIG: profilePath },
      encoding: 'utf8'
    });
    
    console.log('Deregistration output:', deregisterOutput);
    
    console.log('✅ Contract test completed successfully!');
    return {
      success: true,
      moduleAddress
    };
  } catch (error) {
    console.error('Contract test failed:', error);
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

// Run the test if this script is executed directly
if (require.main === module) {
  testContract()
    .then(result => {
      console.log('Test result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testContract }; 