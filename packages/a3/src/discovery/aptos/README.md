# Aptos Process Registry

This module provides a blockchain-based discovery service for a3 processes using the Aptos blockchain.

## Overview

The Aptos Process Registry enables:

- Registration of process metadata on the Aptos blockchain
- Discovery of processes across different instances and environments
- Secure and decentralized process management

## Smart Contract

The `process_registry.move` file contains a Move smart contract that:

1. Stores process metadata on the blockchain
2. Provides functions to register, update, and deregister processes
3. Allows querying of process information

## Deployment

### Prerequisites

1. Install the [Aptos CLI](https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli)
2. Generate an Aptos account and fund it (for testnet/devnet)

### Option 1: Using the Deployment Script

The easiest way to deploy the contract is to use the included deployment script:

```bash
# Set environment variables
export APTOS_PRIVATE_KEY=your_private_key
export APTOS_NETWORK=testnet  # or devnet/mainnet

# Run the deployment script
npx ts-node src/discovery/aptos/deploy-contract.ts
```

### Option 2: Manual Deployment

1. Compile the Move module:

```bash
aptos move compile --package-dir packages/a3/src/discovery/aptos --save-metadata --named-addresses process_registry=<your-address>
```

2. Publish the module:

```bash
aptos move publish --package-dir packages/a3/src/discovery/aptos --named-addresses process_registry=<your-address>
```

3. Initialize the registry:

```bash
aptos move run --function-id <your-address>::process_registry::initialize
```

## Usage

### Using the AptosDiscoveryService

The `AptosDiscoveryService` class provides an implementation of the `DiscoveryService` interface that interacts with the deployed smart contract.

```typescript
import { AptosDiscoveryService } from '@a3/platform/discovery/aptos';

// Create an instance of the discovery service
const discoveryService = new AptosDiscoveryService({
  network: 'testnet',  // or 'devnet', 'mainnet'
  privateKey: 'your_private_key',
  moduleAddress: 'deployed_contract_address', // optional, defaults to account address
});

// Register a process
await discoveryService.registerProcess('process-123', {
  id: 'process-123',
  name: 'My Process',
  description: 'A sample process',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  agents: [
    { id: 'agent-1', name: 'Worker Agent' }
  ],
  workflows: [
    { id: 'workflow-1', name: 'Main Workflow' }
  ],
  tags: ['sample', 'demo'],
  owner: 'user123',
  status: 'active'
});

// Retrieve a process
const process = await discoveryService.getProcess('process-123');
console.log(process);

// List processes
const processes = await discoveryService.listProcesses({ status: 'active' });
console.log(processes);

// Update a process
await discoveryService.updateProcess('process-123', {
  status: 'inactive',
  updatedAt: new Date().toISOString()
});

// Deregister a process
await discoveryService.deregisterProcess('process-123');
```

## Security Considerations

- The contract allows only the process owner to update or deregister processes they own
- Process data is stored as serialized JSON on the blockchain (consider data privacy)
- In production, use a secure private key management solution
- The contract uses Aptos's account-based access control model

## Testing

For local testing, it's recommended to use the Aptos local testnet:

```bash
aptos node run-local-testnet --with-faucet
```

Then deploy the contract to the local network using the deployment script:

```bash
APTOS_NETWORK=local APTOS_NODE_URL=http://localhost:8080/v1 npx ts-node src/discovery/aptos/deploy-contract.ts
```

## Resources

- [Aptos Documentation](https://aptos.dev/)
- [Move Language Documentation](https://move-language.github.io/move/)
- [Aptos TypeScript SDK](https://aptos.dev/sdks/ts-sdk/) 