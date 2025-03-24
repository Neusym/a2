import * as dotenv from 'dotenv';

// Load environment variables once at the module level
dotenv.config();

/**
 * Validates required environment variables and returns them
 * @throws Error if any required variable is missing
 */
export function validateEnv() {
  const requiredVars = [
    'APTOS_PRIVATE_KEY',
    'APTOS_MODULE_ADDRESS'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  return {
    privateKey: process.env.APTOS_PRIVATE_KEY!,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS!,
    network: process.env.APTOS_NETWORK || 'testnet',
    nodeUrl: process.env.APTOS_NODE_URL,
    faucetUrl: process.env.APTOS_FAUCET_URL
  };
} 