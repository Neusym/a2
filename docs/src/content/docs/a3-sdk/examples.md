---
title: A3 SDK Examples
description: Practical examples for using the A3 SDK to interact with the A3 platform
---

# A3 SDK Examples

This page provides practical examples for using the A3 SDK in various scenarios.

## Setup and Initialization

### Basic Initialization

```typescript
import { createA3Client, loadEnvironment } from '@a3/sdk';

// Option 1: Create client with explicit configuration
const client = createA3Client({
  apiUrl: 'https://api.a3platform.com',
  network: 'testnet',
  privateKey: 'your-private-key', // Don't hardcode in production!
});

// Option 2: Load configuration from environment variables
const envConfig = loadEnvironment();
const clientFromEnv = createA3Client(envConfig);
```

### Environment Variables Setup (.env file)

```
# Aptos Configuration
APTOS_PRIVATE_KEY=your-private-key
APTOS_MODULE_ADDRESS=0x1234567890abcdef
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.testnet.aptoslabs.com

# A3 Platform Configuration
A3_API_URL=https://api.a3platform.com
A3_API_KEY=your-api-key
```

## Process Management

### Create a New Process

```typescript
import { createA3Client } from '@a3/sdk';

async function createNewProcess() {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const process = await client.process.registerProcess(
    'AI Image Generator',
    'Generate AI images based on text prompts',
    ['ai', 'image', 'generation'],
    {
      name: 'CreativeAI Studio',
      description: 'AI-powered creative tools',
      walletAddress: '0xabcdef1234567890',
      website: 'https://creativeai.studio',
      social: {
        twitter: '@creativeai_studio',
        discord: 'https://discord.gg/creativeai',
      },
    },
    {
      taskPrice: '0.5',
      currency: 'APT',
      requiresPrepayment: true,
    }
  );

  console.log('New process created:', process);
  return process;
}
```

### Update a Process

```typescript
async function updateProcess(processId) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const updatedProcess = await client.process.updateProcess(processId, {
    description: 'Updated description for the AI Image Generator',
    pricing: {
      taskPrice: '0.75', // Updated price
      currency: 'APT',
      requiresPrepayment: true,
    },
  });

  console.log('Process updated:', updatedProcess);
  return updatedProcess;
}
```

### Run a Process

```typescript
async function runImageGeneration(processId, prompt, walletAddress) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const result = await client.process.runProcessWithPayment(processId, walletAddress, {
    prompt: prompt,
    resolution: '1024x1024',
    style: 'photorealistic',
  });

  console.log('Image generation result:', result);
  return result;
}
```

## Payment Handling

### Create and Verify Payment

```typescript
async function handlePayment(fromAddress, toAddress, amount) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  // Create payment (this might trigger a wallet for signing)
  const payment = await client.payment.createPayment(fromAddress, toAddress, amount, 'APT');

  console.log('Payment created:', payment);

  // Verify that payment was successful
  const verification = await client.payment.verifyPayment(fromAddress, toAddress, amount, 'APT');

  console.log('Payment verified:', verification);
  return verification;
}
```

### Get Payment History

```typescript
async function getWalletPaymentHistory(walletAddress) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const history = await client.payment.getPaymentHistory(walletAddress, {
    limit: 10,
    offset: 0,
    sortDirection: 'desc',
  });

  console.log('Payment history:', history);
  return history;
}
```

## Discovery

### Search for Processes

```typescript
async function searchAIProcesses() {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
  });

  const processes = await client.discovery.searchProcesses('AI', {
    limit: 10,
    sortBy: 'popularity',
  });

  console.log('AI processes found:', processes);
  return processes;
}
```

### List All Processes

```typescript
async function listAllProcesses() {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
  });

  const processes = await client.discovery.listProcesses({
    limit: 20,
    offset: 0,
    sortBy: 'newest',
  });

  console.log('All processes:', processes);
  return processes;
}
```

### Get Process Details

```typescript
async function getProcessDetails(processId) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
  });

  const process = await client.discovery.getProcess(processId);

  console.log('Process details:', process);
  return process;
}
```

## Contract Operations

### Deploy a Contract

```typescript
async function deployAIContract(bytecode) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
  });

  const deployment = await client.contract.deployContract(bytecode, {
    initialSupply: 1000,
    name: 'AI Access Token',
    symbol: 'AAT',
  });

  console.log('Contract deployed:', deployment);
  return deployment;
}
```

### Call Contract Method

```typescript
async function mintTokens(contractAddress, amount, recipientAddress) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const result = await client.contract.callContractMethod(contractAddress, 'mint', {
    amount: amount,
    recipient: recipientAddress,
  });

  console.log('Mint result:', result);
  return result;
}
```

## Creator Profile Management

### Create a Creator Profile

```typescript
async function createCreatorProfile() {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const profile = await client.creator.createProfile({
    name: 'Digital Creations Labs',
    description: 'Building innovative digital experiences on blockchain',
    walletAddress: '0x1234567890abcdef',
    website: 'https://digitalcreationslabs.com',
    social: {
      twitter: '@digicreateLabs',
      github: 'github.com/digicreateLabs',
    },
  });

  console.log('Creator profile created:', profile);
  return profile;
}
```

### Update a Creator Profile

```typescript
async function updateCreatorProfile(walletAddress) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  const updatedProfile = await client.creator.updateProfile(walletAddress, {
    description: 'Updated company description with our new focus on AI',
    social: {
      twitter: '@digicreateLabs',
      github: 'github.com/digicreateLabs',
      discord: 'discord.gg/digicreateLabs',
    },
  });

  console.log('Creator profile updated:', updatedProfile);
  return updatedProfile;
}
```

## Transaction Management

### Submit and Track a Transaction

```typescript
async function submitAndTrackTransaction(transaction) {
  const client = createA3Client({
    apiUrl: process.env.A3_API_URL,
    privateKey: process.env.APTOS_PRIVATE_KEY,
  });

  // Submit the transaction
  const hash = await client.transaction.submitTransaction(transaction);
  console.log('Transaction submitted with hash:', hash);

  // Wait for the transaction to complete
  const result = await client.transaction.waitForTransaction(hash, {
    timeoutMs: 30000, // 30 seconds timeout
    checkIntervalMs: 1000, // Check every second
  });

  console.log('Transaction result:', result);
  return result;
}
```

## Full Application Example

### AI Image Marketplace

This example demonstrates a complete flow for an AI image generation marketplace:

```typescript
import { createA3Client, loadEnvironment } from '@a3/sdk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runAIImageMarketplace() {
  // Initialize the client
  const config = loadEnvironment();
  const client = createA3Client({
    ...config,
    apiUrl: process.env.A3_API_URL,
  });

  try {
    // 1. Search for AI image generation processes
    const aiProcesses = await client.discovery.searchProcesses('AI image', {
      limit: 5,
      sortBy: 'popularity',
    });
    console.log('Available AI image generators:', aiProcesses);

    if (aiProcesses.length === 0) {
      console.log('No AI image generators found.');
      return;
    }

    // 2. Select the first process
    const selectedProcess = aiProcesses[0];
    console.log(`Selected process: ${selectedProcess.name}`);

    // 3. Check pricing
    if (selectedProcess.pricing) {
      console.log(
        `Price per generation: ${selectedProcess.pricing.taskPrice} ${selectedProcess.pricing.currency || 'APT'}`
      );
    }

    // 4. Create payment if required
    if (selectedProcess.pricing && selectedProcess.pricing.requiresPrepayment) {
      const userWalletAddress = process.env.USER_WALLET_ADDRESS;
      const paymentAddress =
        selectedProcess.pricing.paymentAddress || selectedProcess.creatorProfile?.walletAddress;

      if (!paymentAddress) {
        throw new Error('No payment address specified for this process');
      }

      console.log(
        `Creating payment of ${selectedProcess.pricing.taskPrice} ${selectedProcess.pricing.currency || 'APT'} to ${paymentAddress}`
      );

      await client.payment.createPayment(
        userWalletAddress,
        paymentAddress,
        selectedProcess.pricing.taskPrice,
        selectedProcess.pricing.currency || 'APT'
      );
    }

    // 5. Run the process
    const result = await client.process.runProcessWithPayment(
      selectedProcess.id,
      process.env.USER_WALLET_ADDRESS,
      {
        prompt: 'A futuristic city with flying cars and neon lights',
        resolution: '1024x1024',
      }
    );

    console.log('Image generation successful!');
    console.log('Image URL:', result.imageUrl);

    // 6. Get transaction details
    if (result.transactionHash) {
      const transaction = await client.transaction.getTransactionStatus(result.transactionHash);
      console.log('Transaction details:', transaction);
    }

    return result;
  } catch (error) {
    console.error('Error in AI Image Marketplace:', error);
    throw error;
  }
}

runAIImageMarketplace().catch(console.error);
```

## Integration with React Application

```tsx
import React, { useState, useEffect } from 'react';
import { createA3Client } from '@a3/sdk';

// A3 Process List Component
const A3ProcessList = () => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        const client = createA3Client({
          apiUrl: process.env.REACT_APP_A3_API_URL,
        });

        const fetchedProcesses = await client.discovery.listProcesses({
          limit: 10,
          sortBy: 'newest',
        });

        setProcesses(fetchedProcesses);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchProcesses();
  }, []);

  if (loading) return <div>Loading processes...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="process-list">
      <h2>Available A3 Processes</h2>
      {processes.length === 0 ? (
        <p>No processes found.</p>
      ) : (
        <ul>
          {processes.map(process => (
            <li key={process.id}>
              <h3>{process.name}</h3>
              <p>{process.description}</p>
              {process.pricing && (
                <p className="price">
                  Price: {process.pricing.taskPrice} {process.pricing.currency || 'APT'}
                </p>
              )}
              <button>Run Process</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default A3ProcessList;
```

## Working with NextJS

```typescript
// pages/api/run-process.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createA3Client } from '@a3/sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { processId, walletAddress, input } = req.body;

    if (!processId || !walletAddress) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const client = createA3Client({
      apiUrl: process.env.A3_API_URL,
      privateKey: process.env.APTOS_PRIVATE_KEY,
    });

    const result = await client.process.runProcessWithPayment(processId, walletAddress, input);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error running process:', error);
    return res.status(500).json({ message: 'Error running process', error: error.message });
  }
}
```
