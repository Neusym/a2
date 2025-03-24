import { AptosAccount } from 'aptos';

import { AgentGatewayServer, GatewayConfig } from './agent-gateway';

/**
 * Custom Agent Gateway Server that implements the missing methods
 */
export class CustomAgentGatewayServer extends AgentGatewayServer {
  constructor(config: GatewayConfig) {
    super(config);
  }
  
  /**
   * Override the protected method with a working implementation
   */
  protected getAccountFromPrivateKey(): any {
    const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('APTOS_PRIVATE_KEY environment variable is required');
    }
    
    // Convert hex string to Uint8Array and create account
    const privateKeyBytes = new Uint8Array(
      Buffer.from(privateKeyHex.replace(/^0x/i, ''), 'hex')
    );
    
    return new AptosAccount(privateKeyBytes);
  }
} 