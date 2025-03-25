# A3 SDK

The A3 SDK is a TypeScript library that provides a simple and intuitive interface for interacting with the A3 platform on the Aptos blockchain. This SDK allows developers to manage processes, handle payments, interact with contracts, and more on the A3 platform.

## Installation

```bash
# Using npm
npm install sdk

# Using yarn
yarn add sdk

# Using pnpm (recommended)
pnpm add sdk
```

## Quick Start

```typescript
import { createA3Client, loadEnvironment } from 'sdk';

// Load config from environment variables
const envConfig = loadEnvironment();

// Create A3 client
const a3Client = createA3Client({
  ...envConfig,
  apiUrl: process.env.A3_API_URL || 'https://api.a3platform.com',
});

// Now you can use the client to interact with the A3 platform
const processes = await a3Client.discovery.listProcesses();
console.log(processes);
```

## Configuration

The SDK can be configured through the `A3ClientConfig` object:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| privateKey | string | Private key for the Aptos account | - |
| moduleAddress | string | Module address for the A3 platform | - |
| network | 'mainnet' \| 'testnet' \| 'devnet' \| 'local' | Network to connect to | 'testnet' |
| nodeUrl | string | URL for the Aptos node to connect to | 'https://fullnode.testnet.aptoslabs.com/v1' |
| faucetUrl | string | URL for the Aptos faucet (testnet/devnet only) | - |
| apiUrl | string | API URL for A3 platform services | - |
| apiKey | string | API key for authentication with A3 platform services | - |

### Using Environment Variables

You can load configuration from environment variables using the `loadEnvironment()` function:

```typescript
import { createA3Client, loadEnvironment } from 'sdk';

const config = loadEnvironment();
const client = createA3Client(config);
```

The following environment variables are supported:

- `APTOS_PRIVATE_KEY`: Private key for the Aptos account
- `APTOS_MODULE_ADDRESS`: Module address for the A3 platform
- `APTOS_NETWORK`: Network to connect to (mainnet, testnet, devnet, local)
- `APTOS_NODE_URL`: URL for the Aptos node to connect to
- `APTOS_FAUCET_URL`: URL for the Aptos faucet
- `A3_API_URL`: API URL for A3 platform services
- `A3_API_KEY`: API key for authentication with A3 platform services

## Client Services

The A3 client provides access to various services for interacting with the A3 platform:

### Process Service

Manages and interacts with processes on the A3 platform.

```typescript
// Access process service
const processService = a3Client.process;
```

#### Methods

- `registerProcess(name, description, tags?, creatorProfile?, pricing?)`: Registers a new process
- `updateProcess(processId, updates)`: Updates an existing process
- `deleteProcess(processId)`: Deletes a process
- `runProcessWithPayment(processId, userWalletAddress, input?)`: Runs a process with payment verification

### Payment Service

Handles payments on the A3 platform.

```typescript
// Access payment service
const paymentService = a3Client.payment;
```

#### Methods

- `createPayment(fromAddress, toAddress, amount, currency?)`: Creates a new payment
- `verifyPayment(fromAddress, toAddress, amount, currency?)`: Verifies if a payment has been made
- `getPaymentHistory(address, options?)`: Gets payment history for an address

### Discovery Service

Helps find processes on the A3 platform.

```typescript
// Access discovery service
const discoveryService = a3Client.discovery;
```

#### Methods

- `listProcesses(options?)`: Lists available processes with optional filtering
- `getProcess(processId)`: Gets details for a specific process
- `searchProcesses(query, options?)`: Searches for processes by name, description, or tags

### Contract Service

Provides functionality for deploying and interacting with contracts.

```typescript
// Access contract service
const contractService = a3Client.contract;
```

#### Methods

- `deployContract(bytecode, initialParameters?)`: Deploys a new contract
- `callContractMethod(contractAddress, methodName, parameters?)`: Calls a method on a deployed contract
- `getContractState(contractAddress)`: Gets the current state of a contract

### Creator Service

Manages creator profiles on the A3 platform.

```typescript
// Access creator service
const creatorService = a3Client.creator;
```

#### Methods

- `createProfile(profile)`: Creates a new creator profile
- `updateProfile(walletAddress, updates)`: Updates an existing creator profile
- `getProfile(walletAddress)`: Gets a creator profile by wallet address

### Transaction Service

Handles blockchain transactions.

```typescript
// Access transaction service
const transactionService = a3Client.transaction;
```

#### Methods

- `submitTransaction(transaction)`: Submits a transaction to the blockchain
- `getTransactionStatus(hash)`: Gets the status of a transaction
- `waitForTransaction(hash, options?)`: Waits for a transaction to be confirmed

## Data Models

The SDK defines several interfaces for working with data:

- `ProcessMetadata`: Information about a process
- `CreatorProfile`: Information about a creator
- `ProcessPricing`: Pricing information for a process
- `PaymentVerification`: Information about payment verification
- `ContractDeployment`: Information about contract deployment
- `Transaction`: Information about a blockchain transaction

## Error Handling

The SDK provides error handling through catching exceptions:

```typescript
try {
  const result = await a3Client.process.registerProcess('My Process', 'Description');
  console.log('Process registered:', result);
} catch (error) {
  console.error('Failed to register process:', error);
}
```

## Advanced Usage

### Using with Async/Await

All SDK methods are asynchronous and return Promises:

```typescript
async function runMyProcess() {
  try {
    const process = await a3Client.discovery.getProcess('process-id');
    const result = await a3Client.process.runProcessWithPayment(
      'process-id', 
      'my-wallet-address', 
      { param1: 'value1' }
    );
    return result;
  } catch (error) {
    console.error('Error running process:', error);
    throw error;
  }
}
```

### Working with Multiple Networks

You can create multiple clients for different networks:

```typescript
const testnetClient = createA3Client({
  network: 'testnet',
  apiUrl: 'https://api.testnet.a3platform.com',
  // ...other config
});

const mainnetClient = createA3Client({
  network: 'mainnet',
  apiUrl: 'https://api.a3platform.com',
  // ...other config
});
```
