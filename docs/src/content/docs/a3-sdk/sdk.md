---
title: A3 SDK Documentation
description: Complete documentation for the A3 SDK for interacting with the A3 platform on Aptos blockchain
---

# A3 SDK

The A3 SDK is a TypeScript library that provides a simple and intuitive interface for interacting with the A3 platform on the Aptos blockchain. This SDK allows developers to manage processes, handle payments, interact with contracts, and more on the A3 platform.

## Installation

```bash
# Using npm
npm install @a3/sdk

# Using yarn
yarn add @a3/sdk

# Using pnpm (recommended)
pnpm add @a3/sdk
```

## Quick Start

```typescript
import { createA3Client, loadEnvironment } from '@a3/sdk';

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

| Property        | Type                                            | Description                                          | Default                                       |
| --------------- | ----------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `privateKey`    | `string`                                        | Private key for the Aptos account                    | -                                             |
| `moduleAddress` | `string`                                        | Module address for the A3 platform                   | -                                             |
| `network`       | `'mainnet' \| 'testnet' \| 'devnet' \| 'local'` | Network to connect to                                | `'testnet'`                                   |
| `nodeUrl`       | `string`                                        | URL for the Aptos node to connect to                 | `'https://fullnode.testnet.aptoslabs.com/v1'` |
| `faucetUrl`     | `string`                                        | URL for the Aptos faucet (testnet/devnet only)       | -                                             |
| `apiUrl`        | `string`                                        | API URL for A3 platform services                     | -                                             |
| `apiKey`        | `string`                                        | API key for authentication with A3 platform services | -                                             |

### Using Environment Variables

You can load configuration from environment variables using the `loadEnvironment()` function:

```typescript
import { createA3Client, loadEnvironment } from '@a3/sdk';

const config = loadEnvironment();
const client = createA3Client(config);
```

The following environment variables are supported:

- `APTOS_PRIVATE_KEY`: Private key for the Aptos account
- `APTOS_MODULE_ADDRESS`: Module address for the A3 platform
- `APTOS_NETWORK`: Network to connect to (`mainnet`, `testnet`, `devnet`, `local`)
- `APTOS_NODE_URL`: URL for the Aptos node to connect to
- `APTOS_FAUCET_URL`: URL for the Aptos faucet
- `A3_API_URL`: API URL for A3 platform services
- `A3_API_KEY`: API key for authentication with A3 platform services

## Client Services

The A3 client provides access to various services for interacting with the A3 platform. Each service is specialized for specific functionality.

### Process Service

The Process Service allows managing and interacting with processes on the A3 platform. Processes are the core units of functionality that can be executed on the A3 platform.

```typescript
// Access process service
const processService = a3Client.process;
```

#### Methods

##### registerProcess

Registers a new process on the A3 platform.

```typescript
async registerProcess(
  name: string,
  description: string,
  tags: string[] = [],
  creatorProfile?: CreatorProfile,
  pricing?: ProcessPricing
): Promise<ProcessMetadata | null>
```

**Parameters:**

- `name` (string): Name of the process. Should be descriptive and unique.
- `description` (string): Detailed description of what the process does.
- `tags` (string[]): Optional array of tags for categorizing the process.
- `creatorProfile` (CreatorProfile): Optional creator profile information.
- `pricing` (ProcessPricing): Optional pricing information for the process.

**Returns:**

- A Promise that resolves to a ProcessMetadata object if successful, or null if registration failed.

**Example:**

```typescript
const process = await a3Client.process.registerProcess(
  'Data Analysis Process',
  'Analyzes user-provided data and returns insights',
  ['data', 'analysis', 'ai'],
  {
    name: 'Data Science Team',
    walletAddress: '0x1234...',
  },
  {
    taskPrice: '0.5',
    currency: 'APT',
    requiresPrepayment: true,
  }
);

if (process) {
  console.log(`Process registered with ID: ${process.id}`);
} else {
  console.error('Failed to register process');
}
```

**Possible Errors:**

- Missing private key
- Network connectivity issues
- API authentication errors

##### updateProcess

Updates an existing process on the platform.

```typescript
async updateProcess(
  processId: string,
  updates: Partial<ProcessMetadata>
): Promise<ProcessMetadata | null>
```

**Parameters:**

- `processId` (string): ID of the process to update.
- `updates` (Partial<ProcessMetadata>): Object containing the fields to update. Only the provided fields will be modified.

**Returns:**

- A Promise that resolves to the updated ProcessMetadata object if successful, or null if the update failed.

**Example:**

```typescript
const updatedProcess = await a3Client.process.updateProcess('process-123', {
  description: 'Updated description with new capabilities',
  pricing: {
    taskPrice: '0.75',
    currency: 'APT',
  },
});

if (updatedProcess) {
  console.log('Process updated successfully');
} else {
  console.error('Failed to update process');
}
```

**Possible Errors:**

- Process not found
- Insufficient permissions to update
- Missing private key
- Network connectivity issues

##### deleteProcess

Deletes a process from the platform.

```typescript
async deleteProcess(processId: string): Promise<boolean>
```

**Parameters:**

- `processId` (string): ID of the process to delete.

**Returns:**

- A Promise that resolves to a boolean indicating success (true) or failure (false).

**Example:**

```typescript
const success = await a3Client.process.deleteProcess('process-123');

if (success) {
  console.log('Process deleted successfully');
} else {
  console.error('Failed to delete process');
}
```

**Possible Errors:**

- Process not found
- Insufficient permissions to delete
- Missing private key
- Network connectivity issues

##### runProcessWithPayment

Runs a process with payment verification, ensuring the user has paid the required amount before execution.

```typescript
async runProcessWithPayment(
  processId: string,
  userWalletAddress: string,
  input?: any
): Promise<any>
```

**Parameters:**

- `processId` (string): ID of the process to run.
- `userWalletAddress` (string): Wallet address of the user running the process.
- `input` (any): Optional input data for the process, specific to the process being run.

**Returns:**

- A Promise that resolves to the result of the process execution, or null if execution failed.

**Example:**

```typescript
const result = await a3Client.process.runProcessWithPayment('process-123', '0xmywalletaddress', {
  dataUrl: 'https://example.com/data.json',
  analysisType: 'comprehensive',
});

if (result) {
  console.log('Process executed successfully:', result);
} else {
  console.error('Failed to run process');
}
```

**Possible Errors:**

- Process not found
- Payment verification failed
- Missing or invalid input data
- Network connectivity issues

### Payment Service

The Payment Service handles payments on the A3 platform.

```typescript
// Access payment service
const paymentService = a3Client.payment;
```

#### Methods

| Method                                                     | Description                        |
| ---------------------------------------------------------- | ---------------------------------- |
| `createPayment(fromAddress, toAddress, amount, currency?)` | Create a new payment               |
| `verifyPayment(fromAddress, toAddress, amount, currency?)` | Verify if a payment has been made  |
| `getPaymentHistory(address, options?)`                     | Get payment history for an address |

##### createPayment

Creates a new payment transaction on the blockchain.

```typescript
async createPayment(
  fromAddress: string,
  toAddress: string,
  amount: string,
  currency: string = 'APT'
): Promise<{
  success: boolean,
  transactionHash?: string,
  error?: string
}>
```

**Parameters:**

- `fromAddress` (string): Wallet address of the sender.
- `toAddress` (string): Wallet address of the recipient.
- `amount` (string): Amount to transfer as a string (e.g., '0.5').
- `currency` (string): Currency to use, defaults to 'APT' (Aptos token).

**Returns:**

- A Promise that resolves to an object containing:
  - `success` (boolean): Whether the payment was successful.
  - `transactionHash` (string): Hash of the transaction if successful.
  - `error` (string): Error message if the payment failed.

**Example:**

```typescript
const payment = await a3Client.payment.createPayment(
  '0xmywalletaddress',
  '0xrecipientaddress',
  '0.5',
  'APT'
);

if (payment.success) {
  console.log(`Payment successful. Transaction hash: ${payment.transactionHash}`);
} else {
  console.error(`Payment failed: ${payment.error}`);
}
```

**Possible Errors:**

- Insufficient funds in sender's wallet
- Invalid addresses
- Network connectivity issues
- Blockchain transaction errors

##### verifyPayment

Verifies if a payment has been made from one address to another.

```typescript
async verifyPayment(
  fromAddress: string,
  toAddress: string,
  amount: string,
  currency: string = 'APT'
): Promise<PaymentVerification>
```

**Parameters:**

- `fromAddress` (string): Wallet address of the sender.
- `toAddress` (string): Wallet address of the recipient.
- `amount` (string): Expected amount as a string (e.g., '0.5').
- `currency` (string): Currency to check, defaults to 'APT'.

**Returns:**

- A Promise that resolves to a PaymentVerification object:
  - `verified` (boolean): Whether the payment was verified.
  - `transactionHash` (string): Hash of the verified transaction.
  - `amount` (string): Amount that was paid.
  - `fromAddress` (string): Address that made the payment.
  - `toAddress` (string): Address that received the payment.
  - `error` (string): Error message if verification failed.

**Example:**

```typescript
const verification = await a3Client.payment.verifyPayment(
  '0xsenderaddress',
  '0xrecipientaddress',
  '0.5',
  'APT'
);

if (verification.verified) {
  console.log(`Payment verified. Transaction hash: ${verification.transactionHash}`);
} else {
  console.error(`Payment verification failed: ${verification.error}`);
}
```

**Possible Errors:**

- No matching transaction found
- Amount mismatch
- Network connectivity issues
- Blockchain API errors

##### getPaymentHistory

Retrieves the payment history for a wallet address.

```typescript
async getPaymentHistory(
  address: string,
  options?: {
    limit?: number,
    offset?: number,
    sortDirection?: 'asc' | 'desc',
    startTime?: number,
    endTime?: number
  }
): Promise<{
  transactions: Array<{
    hash: string,
    timestamp: number,
    fromAddress: string,
    toAddress: string,
    amount: string,
    currency: string
  }>,
  total: number
}>
```

**Parameters:**

- `address` (string): Wallet address to get payment history for.
- `options` (object): Optional parameters for filtering and pagination:
  - `limit` (number): Maximum number of transactions to return.
  - `offset` (number): Number of transactions to skip.
  - `sortDirection` (string): Sort direction ('asc' or 'desc').
  - `startTime` (number): Start timestamp for filtering transactions.
  - `endTime` (number): End timestamp for filtering transactions.

**Returns:**

- A Promise that resolves to an object containing:
  - `transactions` (array): Array of transaction objects.
  - `total` (number): Total number of transactions matching the criteria.

**Example:**

```typescript
const history = await a3Client.payment.getPaymentHistory('0xmywalletaddress', {
  limit: 10,
  offset: 0,
  sortDirection: 'desc',
});

console.log(`Found ${history.total} transactions`);
history.transactions.forEach(tx => {
  console.log(`${tx.fromAddress} -> ${tx.toAddress}: ${tx.amount} ${tx.currency}`);
});
```

**Possible Errors:**

- Invalid wallet address
- Network connectivity issues
- API rate limits

### Discovery Service

The Discovery Service helps find processes on the A3 platform.

```typescript
// Access discovery service
const discoveryService = a3Client.discovery;
```

#### Methods

| Method                             | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| `listProcesses(options?)`          | List available processes with optional filtering   |
| `getProcess(processId)`            | Get details for a specific process                 |
| `searchProcesses(query, options?)` | Search for processes by name, description, or tags |

##### listProcesses

Lists available processes on the platform with optional filtering.

```typescript
async listProcesses(options?: {
  limit?: number,
  offset?: number,
  sortBy?: 'newest' | 'popularity' | 'price',
  tags?: string[],
  creator?: string,
  minPrice?: string,
  maxPrice?: string
}): Promise<{
  processes: ProcessMetadata[],
  total: number
}>
```

**Parameters:**

- `options` (object): Optional parameters for filtering and pagination:
  - `limit` (number): Maximum number of processes to return.
  - `offset` (number): Number of processes to skip.
  - `sortBy` (string): Field to sort by ('newest', 'popularity', 'price').
  - `tags` (string[]): Filter by tags.
  - `creator` (string): Filter by creator wallet address.
  - `minPrice` (string): Filter by minimum price.
  - `maxPrice` (string): Filter by maximum price.

**Returns:**

- A Promise that resolves to an object containing:
  - `processes` (array): Array of ProcessMetadata objects.
  - `total` (number): Total number of processes matching the criteria.

**Example:**

```typescript
const result = await a3Client.discovery.listProcesses({
  limit: 10,
  offset: 0,
  sortBy: 'newest',
  tags: ['ai', 'image'],
});

console.log(`Found ${result.total} processes`);
result.processes.forEach(process => {
  console.log(`${process.name}: ${process.description}`);
});
```

**Possible Errors:**

- Invalid filter parameters
- Network connectivity issues
- API rate limits

##### getProcess

Gets detailed information about a specific process.

```typescript
async getProcess(processId: string): Promise<ProcessMetadata | null>
```

**Parameters:**

- `processId` (string): ID of the process to retrieve.

**Returns:**

- A Promise that resolves to a ProcessMetadata object if found, or null if not found.

**Example:**

```typescript
const process = await a3Client.discovery.getProcess('process-123');

if (process) {
  console.log(`Process name: ${process.name}`);
  console.log(`Description: ${process.description}`);
  console.log(`Creator: ${process.creatorProfile?.name}`);
  if (process.pricing) {
    console.log(`Price: ${process.pricing.taskPrice} ${process.pricing.currency || 'APT'}`);
  }
} else {
  console.error('Process not found');
}
```

**Possible Errors:**

- Process not found
- Network connectivity issues

##### searchProcesses

Searches for processes by name, description, or tags.

```typescript
async searchProcesses(
  query: string,
  options?: {
    limit?: number,
    offset?: number,
    sortBy?: 'relevance' | 'newest' | 'popularity' | 'price'
  }
): Promise<{
  processes: ProcessMetadata[],
  total: number
}>
```

**Parameters:**

- `query` (string): Search query string.
- `options` (object): Optional parameters for search results:
  - `limit` (number): Maximum number of processes to return.
  - `offset` (number): Number of processes to skip.
  - `sortBy` (string): Field to sort by ('relevance', 'newest', 'popularity', 'price').

**Returns:**

- A Promise that resolves to an object containing:
  - `processes` (array): Array of ProcessMetadata objects matching the search.
  - `total` (number): Total number of processes matching the search.

**Example:**

```typescript
const results = await a3Client.discovery.searchProcesses('image generation', {
  limit: 5,
  sortBy: 'relevance',
});

console.log(`Found ${results.total} processes matching "image generation"`);
results.processes.forEach(process => {
  console.log(`${process.name}: ${process.description}`);
});
```

**Possible Errors:**

- Empty search results
- Network connectivity issues
- API rate limits

### Contract Service

The Contract Service provides functionality for deploying and interacting with contracts.

```typescript
// Access contract service
const contractService = a3Client.contract;
```

#### Methods

| Method                                                         | Description                             |
| -------------------------------------------------------------- | --------------------------------------- |
| `deployContract(bytecode, initialParameters?)`                 | Deploy a new contract to the blockchain |
| `callContractMethod(contractAddress, methodName, parameters?)` | Call a method on a deployed contract    |
| `getContractState(contractAddress)`                            | Get the current state of a contract     |

##### deployContract

Deploys a new smart contract to the blockchain.

```typescript
async deployContract(
  bytecode: string,
  initialParameters?: Record<string, any>
): Promise<ContractDeployment>
```

**Parameters:**

- `bytecode` (string): Compiled bytecode of the contract to deploy.
- `initialParameters` (Record<string, any>): Optional initialization parameters for the contract.

**Returns:**

- A Promise that resolves to a ContractDeployment object:
  - `success` (boolean): Whether deployment was successful.
  - `transactionHash` (string): Hash of the deployment transaction.
  - `contractAddress` (string): Address of the deployed contract.
  - `error` (string): Error message if deployment failed.

**Example:**

```typescript
const deployment = await a3Client.contract.deployContract(
  '0x01234...', // Contract bytecode
  {
    initialSupply: 1000,
    tokenName: 'MyToken',
    tokenSymbol: 'MTK',
  }
);

if (deployment.success) {
  console.log(`Contract deployed at: ${deployment.contractAddress}`);
  console.log(`Transaction hash: ${deployment.transactionHash}`);
} else {
  console.error(`Deployment failed: ${deployment.error}`);
}
```

**Possible Errors:**

- Invalid bytecode
- Insufficient funds for deployment
- Missing private key
- Contract compilation errors
- Network connectivity issues

##### callContractMethod

Calls a method on a deployed contract.

```typescript
async callContractMethod(
  contractAddress: string,
  methodName: string,
  parameters?: Record<string, any>
): Promise<{
  success: boolean,
  result?: any,
  transactionHash?: string,
  error?: string
}>
```

**Parameters:**

- `contractAddress` (string): Address of the deployed contract.
- `methodName` (string): Name of the contract method to call.
- `parameters` (Record<string, any>): Optional parameters to pass to the method.

**Returns:**

- A Promise that resolves to an object containing:
  - `success` (boolean): Whether the call was successful.
  - `result` (any): Result of the method call if applicable.
  - `transactionHash` (string): Hash of the transaction if it was a state-changing call.
  - `error` (string): Error message if the call failed.

**Example:**

```typescript
const result = await a3Client.contract.callContractMethod('0xcontractaddress', 'transfer', {
  to: '0xrecipientaddress',
  amount: 100,
});

if (result.success) {
  console.log(`Method call successful. Transaction hash: ${result.transactionHash}`);
  console.log(`Result:`, result.result);
} else {
  console.error(`Method call failed: ${result.error}`);
}
```

**Possible Errors:**

- Contract not found
- Method not found in contract
- Invalid parameters
- Execution errors in contract
- Insufficient gas
- Network connectivity issues

##### getContractState

Gets the current state of a deployed contract.

```typescript
async getContractState(
  contractAddress: string
): Promise<{
  success: boolean,
  state?: Record<string, any>,
  error?: string
}>
```

**Parameters:**

- `contractAddress` (string): Address of the deployed contract.

**Returns:**

- A Promise that resolves to an object containing:
  - `success` (boolean): Whether the state retrieval was successful.
  - `state` (Record<string, any>): Current state of the contract.
  - `error` (string): Error message if state retrieval failed.

**Example:**

```typescript
const contractState = await a3Client.contract.getContractState('0xcontractaddress');

if (contractState.success) {
  console.log('Contract state:', contractState.state);
  console.log(`Total supply: ${contractState.state.totalSupply}`);
  console.log(`Owner: ${contractState.state.owner}`);
} else {
  console.error(`Failed to get contract state: ${contractState.error}`);
}
```

**Possible Errors:**

- Contract not found
- Network connectivity issues
- Blockchain API errors

### Creator Service

The Creator Service manages creator profiles on the A3 platform.

```typescript
// Access creator service
const creatorService = a3Client.creator;
```

#### Methods

| Method                                  | Description                             |
| --------------------------------------- | --------------------------------------- |
| `createProfile(profile)`                | Create a new creator profile            |
| `updateProfile(walletAddress, updates)` | Update an existing creator profile      |
| `getProfile(walletAddress)`             | Get a creator profile by wallet address |

##### createProfile

Creates a new creator profile.

```typescript
async createProfile(
  profile: CreatorProfile
): Promise<CreatorProfile | null>
```

**Parameters:**

- `profile` (CreatorProfile): Creator profile information to create.

**Returns:**

- A Promise that resolves to the created CreatorProfile object if successful, or null if creation failed.

**Example:**

```typescript
const profile = await a3Client.creator.createProfile({
  name: 'Digital Creator',
  description: 'Creating AI-powered digital content',
  walletAddress: '0xmywalletaddress',
  website: 'https://mycreatorsite.com',
  social: {
    twitter: '@digitalcreator',
    discord: 'discord.gg/digitalcreator',
  },
});

if (profile) {
  console.log('Creator profile created successfully');
} else {
  console.error('Failed to create creator profile');
}
```

**Possible Errors:**

- Missing required profile information
- Wallet address already has a profile
- Missing private key
- Network connectivity issues

##### updateProfile

Updates an existing creator profile.

```typescript
async updateProfile(
  walletAddress: string,
  updates: Partial<CreatorProfile>
): Promise<CreatorProfile | null>
```

**Parameters:**

- `walletAddress` (string): Wallet address of the profile to update.
- `updates` (Partial<CreatorProfile>): Object containing the fields to update.

**Returns:**

- A Promise that resolves to the updated CreatorProfile object if successful, or null if the update failed.

**Example:**

```typescript
const updatedProfile = await a3Client.creator.updateProfile('0xmywalletaddress', {
  description: 'Updated creator description with new focus on AI art',
  social: {
    twitter: '@digitalcreator',
    instagram: '@digitalcreator_art',
  },
});

if (updatedProfile) {
  console.log('Creator profile updated successfully');
} else {
  console.error('Failed to update creator profile');
}
```

**Possible Errors:**

- Profile not found
- Insufficient permissions to update
- Missing private key
- Network connectivity issues

##### getProfile

Gets a creator profile by wallet address.

```typescript
async getProfile(
  walletAddress: string
): Promise<CreatorProfile | null>
```

**Parameters:**

- `walletAddress` (string): Wallet address of the profile to retrieve.

**Returns:**

- A Promise that resolves to the CreatorProfile object if found, or null if not found.

**Example:**

```typescript
const profile = await a3Client.creator.getProfile('0xcreatoraddress');

if (profile) {
  console.log(`Creator name: ${profile.name}`);
  console.log(`Description: ${profile.description}`);
  console.log(`Website: ${profile.website}`);
  console.log('Social links:', profile.social);
} else {
  console.error('Creator profile not found');
}
```

**Possible Errors:**

- Profile not found
- Network connectivity issues

### Transaction Service

The Transaction Service handles blockchain transactions.

```typescript
// Access transaction service
const transactionService = a3Client.transaction;
```

#### Methods

| Method                               | Description                            |
| ------------------------------------ | -------------------------------------- |
| `submitTransaction(transaction)`     | Submit a transaction to the blockchain |
| `getTransactionStatus(hash)`         | Get the status of a transaction        |
| `waitForTransaction(hash, options?)` | Wait for a transaction to be confirmed |

##### submitTransaction

Submits a transaction to the blockchain.

```typescript
async submitTransaction(
  transaction: any
): Promise<string>
```

**Parameters:**

- `transaction` (any): Transaction object to submit to the blockchain.

**Returns:**

- A Promise that resolves to the transaction hash (string) if submission was successful.

**Example:**

```typescript
try {
  const txHash = await a3Client.transaction.submitTransaction({
    function: '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: ['0xrecipientaddress', '1000000'], // 0.01 APT (6 decimal places)
  });

  console.log(`Transaction submitted. Hash: ${txHash}`);
} catch (error) {
  console.error('Transaction submission failed:', error);
}
```

**Possible Errors:**

- Invalid transaction format
- Insufficient funds
- Missing private key
- Network connectivity issues
- Blockchain validation errors

##### getTransactionStatus

Gets the status of a submitted transaction.

```typescript
async getTransactionStatus(
  hash: string
): Promise<Transaction | null>
```

**Parameters:**

- `hash` (string): Hash of the transaction to check.

**Returns:**

- A Promise that resolves to a Transaction object if found, or null if not found.

**Example:**

```typescript
const status = await a3Client.transaction.getTransactionStatus('0xtransactionhash');

if (status) {
  console.log(`Transaction status: ${status.status}`);
  console.log(`Sender: ${status.sender}`);
  console.log(`Timestamp: ${new Date(status.timestamp).toISOString()}`);

  if (status.status === 'failed') {
    console.error(`Error: ${status.error}`);
  }
} else {
  console.error('Transaction not found');
}
```

**Possible Errors:**

- Transaction not found
- Network connectivity issues
- Blockchain API errors

##### waitForTransaction

Waits for a transaction to be confirmed on the blockchain.

```typescript
async waitForTransaction(
  hash: string,
  options?: {
    timeoutMs?: number,
    checkIntervalMs?: number
  }
): Promise<Transaction>
```

**Parameters:**

- `hash` (string): Hash of the transaction to wait for.
- `options` (object): Optional parameters:
  - `timeoutMs` (number): Maximum time to wait in milliseconds (default: 60000).
  - `checkIntervalMs` (number): Interval between status checks in milliseconds (default: 1000).

**Returns:**

- A Promise that resolves to a Transaction object when the transaction is confirmed.

**Example:**

```typescript
try {
  console.log('Waiting for transaction confirmation...');

  const txResult = await a3Client.transaction.waitForTransaction('0xtransactionhash', {
    timeoutMs: 30000, // 30 seconds timeout
    checkIntervalMs: 2000, // Check every 2 seconds
  });

  console.log(`Transaction confirmed! Status: ${txResult.status}`);
  console.log(`Gas used: ${txResult.gasUsed}`);
} catch (error) {
  console.error('Transaction confirmation failed:', error);
}
```

**Possible Errors:**

- Transaction timeout
- Transaction failed on blockchain
- Network connectivity issues
- Blockchain API errors

## Data Models

### Process Metadata

```typescript
interface ProcessMetadata {
  id?: string; // Process ID (set by the system)
  name: string; // Name of the process
  description: string; // Description of the process
  tags?: string[]; // Tags for categorizing the process
  owner?: string; // Owner/creator of the process
  creatorProfile?: CreatorProfile; // Creator profile information
  pricing?: ProcessPricing; // Pricing information
}
```

### Creator Profile

```typescript
interface CreatorProfile {
  name?: string; // Name of the creator
  description?: string; // Description of the creator
  walletAddress?: string; // Wallet address of the creator
  website?: string; // Website URL of the creator
  social?: Record<string, string>; // Social media links
}
```

### Process Pricing

```typescript
interface ProcessPricing {
  taskPrice: string; // Price for executing a task
  currency?: string; // Currency for the task price (default: 'APT')
  paymentAddress?: string; // Address to receive payments
  requiresPrepayment?: boolean; // Whether the process requires prepayment (default: true)
}
```

### Payment Verification

```typescript
interface PaymentVerification {
  verified: boolean; // Whether the payment is verified
  transactionHash?: string; // Transaction hash for the payment
  amount?: string; // Amount that was paid
  fromAddress?: string; // Address that made the payment
  toAddress?: string; // Address that received the payment
  error?: string; // Error message if verification failed
}
```

### Contract Deployment

```typescript
interface ContractDeployment {
  success: boolean; // Whether the deployment was successful
  transactionHash?: string; // Transaction hash for the deployment
  contractAddress?: string; // Address of the deployed contract
  error?: string; // Error message if deployment failed
}
```

### Transaction

```typescript
interface Transaction {
  hash: string; // Transaction hash
  status: TransactionStatus; // Status of the transaction ('pending' | 'completed' | 'failed')
  sender: string; // Sender address
  timestamp: number; // Timestamp when the transaction was created
  gasUsed?: string; // Gas used by the transaction
  error?: string; // Error message if the transaction failed
}
```

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

All SDK methods that interact with the blockchain or API are asynchronous and return Promises, making them easy to use with async/await:

```typescript
async function runMyProcess() {
  try {
    // Get process details
    const process = await a3Client.discovery.getProcess('process-id');

    // Run the process
    const result = await a3Client.process.runProcessWithPayment('process-id', 'my-wallet-address', {
      param1: 'value1',
    });

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

## Best Practices

1. **Security**: Never hardcode private keys in your code. Use environment variables or secure key management services.
2. **Error Handling**: Always implement proper error handling for all SDK method calls.
3. **Validation**: Validate user input before passing it to the SDK.
4. **Testing**: Test your integration with the SDK on testnet before deploying to mainnet.
5. **Logging**: Implement logging for SDK interactions to help with debugging issues.

## Troubleshooting

Common issues and their solutions:

1. **Connection Issues**: If you're having trouble connecting to the API, check your API URL and network settings.
2. **Authentication Errors**: Ensure your private key and API key are correctly set.
3. **Transaction Failed**: Check if you have enough funds in your account and that the transaction parameters are correct.
4. **Process Not Found**: Verify that the process ID is correct and that the process exists on the current network.
