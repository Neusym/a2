---
title: Discovery Service
---

The Discovery Service allows users and applications to find registered processes. The primary implementation is the `AptosDiscoveryService` (`src/discovery/aptos-discovery-service.ts`), which interacts with the `process_registry.move` contract on the Aptos blockchain.

## Key Functions

- `registerProcess(account: AptosAccount, metadata: ProcessMetadata): Promise<boolean>`: Registers a new process.
- `updateProcess(account: AptosAccount, processId: string, metadata: Partial<ProcessMetadata>): Promise<boolean>`: Updates an existing process.
- `getProcess(processId: string): Promise<ProcessMetadata | null>`: Retrieves a process by ID.
- `listProcesses(options?: ProcessSearchOptions): Promise<ProcessMetadata[]>`: Lists processes, optionally filtering by owner, tags, or status.
- `deregisterProcess(account: AptosAccount, processId: string): Promise<boolean>`: Removes a process from the registry.

## Implementation Details

The Discovery Service is built on top of the Aptos blockchain, using the Move smart contract language. The core functionality is implemented in the `process_registry.move` contract, which stores metadata about registered processes.

The TypeScript SDK provides a convenient wrapper around this contract, allowing developers to interact with the Discovery Service using familiar JavaScript/TypeScript patterns.

## Factory Function

The `createAptosDiscoveryService` function (in `src/discovery/aptos/factory.ts` and re-exported in `src/discovery/index.ts`) simplifies creating an `AptosDiscoveryService` instance:

```typescript
import { createAptosDiscoveryService } from 'platform';

const discoveryService = createAptosDiscoveryService({
  privateKey: process.env.APTOS_PRIVATE_KEY, // Required
  moduleAddress: process.env.APTOS_MODULE_ADDRESS, // Required
  network: process.env.APTOS_NETWORK, // Optional, defaults to testnet
  nodeUrl: process.env.APTOS_NODE_URL, // Optional, custom node URL
});
```

## Using the Discovery Service

### Registering a Process

```typescript
import { createAptosDiscoveryService, ProcessMetadata } from 'platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

// Create a discovery service instance
const discoveryService = createAptosDiscoveryService({
  privateKey: process.env.APTOS_PRIVATE_KEY,
  moduleAddress: process.env.APTOS_MODULE_ADDRESS,
});

// Create an Aptos account from a private key
const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

// Define process metadata
const processMetadata: ProcessMetadata = {
  id: 'unique-process-id',
  name: 'My Process',
  description: 'A process that does something amazing',
  tags: ['ai', 'example'],
  status: 'active',
  pricing: {
    taskPrice: '1000000', // In octas (1 APT = 100,000,000 octas)
    currency: 'APT',
    requiresPrepayment: true,
  },
};

// Register the process
const success = await discoveryService.registerProcess(account, processMetadata);
if (success) {
  console.log('Process registered successfully!');
} else {
  console.error('Failed to register process.');
}
```

### Retrieving a Process

```typescript
const processId = 'unique-process-id';
const process = await discoveryService.getProcess(processId);

if (process) {
  console.log('Process found:', process);
} else {
  console.log('Process not found.');
}
```

### Listing Processes

```typescript
// List all processes
const allProcesses = await discoveryService.listProcesses();
console.log(`Found ${allProcesses.length} processes:`, allProcesses);

// List processes by owner
const ownerAddress = '0x...'; // Replace with the actual address
const ownerProcesses = await discoveryService.listProcesses({ owner: ownerAddress });
console.log(`Found ${ownerProcesses.length} processes owned by ${ownerAddress}:`, ownerProcesses);

// List processes by tag
const tag = 'ai';
const aiProcesses = await discoveryService.listProcesses({ tag });
console.log(`Found ${aiProcesses.length} processes with tag '${tag}':`, aiProcesses);

// List active processes
const activeProcesses = await discoveryService.listProcesses({ status: 'active' });
console.log(`Found ${activeProcesses.length} active processes:`, activeProcesses);
```

### Updating a Process

```typescript
const processId = 'unique-process-id';
const updates = {
  name: 'Updated Process Name',
  description: 'Updated description',
  status: 'inactive',
};

const success = await discoveryService.updateProcess(account, processId, updates);
if (success) {
  console.log('Process updated successfully!');
} else {
  console.error('Failed to update process.');
}
```

### Deregistering a Process

```typescript
const processId = 'unique-process-id';
const success = await discoveryService.deregisterProcess(account, processId);
if (success) {
  console.log('Process deregistered successfully!');
} else {
  console.error('Failed to deregister process.');
}
```

## CLI Interface

The Discovery Service is also accessible through the A3 CLI:

```bash
# List all processes
a3 list

# List processes by owner
a3 list --owner 0x...

# List processes by tag
a3 list --tag ai

# Get a specific process
a3 get-process process-id

# Register a process (see registration.md for details)
a3 register --name "..." --description "..." ...

# Update a process
a3 update -i process-id --name "..." --description "..." ...

# Deregister a process
a3 deregister -i process-id
```
