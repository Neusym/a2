---
title: Code Examples
---

# Code Examples

This document provides practical code examples for working with the A3 platform, demonstrating common use cases and workflows.

## Registering a Process (CLI)

This example shows how to register a new process using the CLI.

```bash
# Register a process using command-line arguments
a3 register \
  --name "My New Process" \
  --description "A description of my new process." \
  --url "http://localhost:3001" \
  --tags "ai,example,test" \
  --task-price "1000000" \
  --currency "APT" \
  --requires-prepayment true
```

Alternatively, you can use a configuration file:

```json
// process-config.json
{
  "name": "My Configured Process",
  "description": "A process defined in a config file.",
  "url": "http://localhost:3002",
  "tags": ["config", "example"],
  "pricing": {
    "taskPrice": "2000000",
    "currency": "APT",
    "requiresPrepayment": true
  }
}
```

```bash
# Register a process using a config file
a3 register --config process-config.json
```

## Listing Processes (CLI)

List all registered processes:

```bash
a3 list
```

List processes owned by a specific address:

```bash
a3 list --owner 0x123abc...
```

List processes with a specific tag:

```bash
a3 list --tag ai
```

## Getting a Process (CLI)

To retrieve information about a specific process by its ID:

```bash
a3 get-process process-12345
```

## Running a Process (CLI)

To run a process with optional payment:

```bash
# Run a process without a payment
a3 run -i "process-12345" -d '{"query": "What is the weather today?"}'

# Run a process with a payment
a3 run -i "process-12345" -d '{"query": "What is the weather today?"}' --pay --amount 1000000
```

## Creating an Agent Service

This example demonstrates how to create a simple agent service using the `AgentService` class.

```typescript
// my-agent-service.ts
import { AgentService, AgentRequest, AgentResponse } from 'a3-platform';

const port = 3001;
const processId = 'your-process-id'; // Replace with your process ID
const processName = 'My Agent Service';

// Define a custom workflow handler
const myWorkflowHandler = async (request: AgentRequest): Promise<AgentResponse> => {
  try {
    // Log the start of execution
    console.log(`Starting execution for transaction ${request.transactionId}`);

    // Your agent logic here
    const result = {
      message: 'Hello from My Agent!',
      receivedData: request.data,
    };

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Create the agent service
const service = new AgentService({
  port,
  processId,
  processName,
  workflowHandlers: {
    myWorkflow: myWorkflowHandler, // Register the handler
    default: myWorkflowHandler, // Set as the default handler
  },
});

// Start the service
service
  .start()
  .then(() => {
    console.log(`Agent service started on port ${port}`);
  })
  .catch(error => {
    console.error('Failed to start agent service:', error);
  });
```

## Using the Discovery Service

This example shows how to use the Discovery Service to register, update, and query processes.

```typescript
import { createAptosDiscoveryService, ProcessMetadata } from 'a3-platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

async function main() {
  // Create a discovery service instance
  const discoveryService = createAptosDiscoveryService({
    privateKey: process.env.APTOS_PRIVATE_KEY,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
    network: 'testnet',
  });

  // Create an Aptos account from a private key
  const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

  // Register a new process
  const processId = `process-${Date.now()}`;
  const processMetadata: ProcessMetadata = {
    id: processId,
    name: 'Example Process',
    description: 'An example process for demonstration purposes',
    tags: ['example', 'demo'],
    status: 'active',
    pricing: {
      taskPrice: '1000000', // In octas (1 APT = 100,000,000 octas)
      currency: 'APT',
      requiresPrepayment: true,
    },
  };

  try {
    // Register the process
    const registered = await discoveryService.registerProcess(account, processMetadata);
    if (registered) {
      console.log(`Process ${processId} registered successfully!`);
    } else {
      console.error('Failed to register process.');
      return;
    }

    // Get the registered process
    const process = await discoveryService.getProcess(processId);
    console.log('Registered process:', process);

    // Update the process
    const updated = await discoveryService.updateProcess(account, processId, {
      description: 'Updated description',
      status: 'inactive',
    });
    if (updated) {
      console.log(`Process ${processId} updated successfully!`);
    } else {
      console.error('Failed to update process.');
    }

    // List all processes
    const allProcesses = await discoveryService.listProcesses();
    console.log(`Found ${allProcesses.length} processes`);

    // List processes with a specific tag
    const taggedProcesses = await discoveryService.listProcesses({ tag: 'example' });
    console.log(`Found ${taggedProcesses.length} processes with tag 'example'`);

    // Deregister the process
    const deregistered = await discoveryService.deregisterProcess(account, processId);
    if (deregistered) {
      console.log(`Process ${processId} deregistered successfully!`);
    } else {
      console.error('Failed to deregister process.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## Using the Payment Service

This example demonstrates how to make and verify payments using the Payment Service.

```typescript
import { createAptosPaymentService, PaymentRequest } from 'a3-platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

async function main() {
  // Create a payment service instance
  const paymentService = createAptosPaymentService({
    privateKey: process.env.APTOS_PRIVATE_KEY,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
    network: 'testnet',
  });

  // Create an Aptos account from a private key
  const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

  const processId = 'process-12345';
  const taskId = 'task-1';
  const userAddress = account.address().toString();

  try {
    // Define the payment request
    const request: PaymentRequest = {
      processId,
      taskId,
      amount: '1000000', // In octas (1 APT = 100,000,000 octas)
    };

    // Make a payment
    const transactionHash = await paymentService.makePayment(account, request);
    console.log(`Payment made. Transaction hash: ${transactionHash}`);

    // Verify the payment
    const verified = await paymentService.verifyPayment(userAddress, processId);
    console.log(`Payment verified: ${verified}`);

    // Get payment details
    const details = await paymentService.getPaymentDetails(userAddress, processId);
    console.log('Payment details:', details);

    // Release the payment (typically called after task completion)
    const releaseRequest = {
      processId,
      taskId,
    };
    const releaseHash = await paymentService.releasePayment(account, releaseRequest);
    console.log(`Payment released. Transaction hash: ${releaseHash}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## Working with Workflows and Tasks

This example shows how to create workflows and tasks and manage their execution.

```typescript
import { createAptosWorkflowService, WorkflowStatus, TaskStatus } from 'a3-platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

async function main() {
  // Create a workflow service instance
  const workflowService = createAptosWorkflowService({
    privateKey: process.env.APTOS_PRIVATE_KEY,
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
    network: 'testnet',
  });

  // Create an Aptos account from a private key
  const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

  const processId = 'process-12345';
  const workflowId = `workflow-${Date.now()}`;

  try {
    // Create a workflow
    const workflowHash = await workflowService.createWorkflow(
      account,
      workflowId,
      'Example Workflow',
      'A workflow for demonstration purposes'
    );
    console.log(`Workflow created. Transaction hash: ${workflowHash}`);

    // Add a task to the workflow
    const task1 = {
      id: 'task-1',
      name: 'Data Collection',
      description: 'Collect data from various sources',
      assignee: account.address().toString(),
      requester: account.address().toString(),
      processId,
      dependencies: [],
    };

    const task1Hash = await workflowService.addTask(account, workflowId, task1);
    console.log(`Task 1 added. Transaction hash: ${task1Hash}`);

    // Add a second task that depends on the first task
    const task2 = {
      id: 'task-2',
      name: 'Data Processing',
      description: 'Process the collected data',
      assignee: account.address().toString(),
      requester: account.address().toString(),
      processId,
      dependencies: ['task-1'],
    };

    const task2Hash = await workflowService.addTask(account, workflowId, task2);
    console.log(`Task 2 added. Transaction hash: ${task2Hash}`);

    // Activate the workflow
    const activateHash = await workflowService.updateWorkflowStatus(
      account,
      workflowId,
      WorkflowStatus.ACTIVE
    );
    console.log(`Workflow activated. Transaction hash: ${activateHash}`);

    // Get workflow details
    const workflow = await workflowService.getWorkflow(workflowId);
    console.log('Workflow details:', workflow);

    // Get workflow tasks
    const tasks = await workflowService.getWorkflowTasks(workflowId);
    console.log(`Found ${tasks.length} tasks:`, tasks);

    // Update task status to IN_PROGRESS
    const updateHash1 = await workflowService.updateTaskStatus(
      account,
      workflowId,
      'task-1',
      TaskStatus.IN_PROGRESS
    );
    console.log(`Task 1 status updated to IN_PROGRESS. Transaction hash: ${updateHash1}`);

    // Update task status to COMPLETED
    const updateHash2 = await workflowService.updateTaskStatus(
      account,
      workflowId,
      'task-1',
      TaskStatus.COMPLETED
    );
    console.log(`Task 1 status updated to COMPLETED. Transaction hash: ${updateHash2}`);

    // Approve task and release payment
    const approveHash = await workflowService.approveTaskAndReleasePayment(
      account,
      workflowId,
      'task-1'
    );
    console.log(`Task 1 approved and payment released. Transaction hash: ${approveHash}`);

    // Complete the workflow
    const completeHash = await workflowService.updateWorkflowStatus(
      account,
      workflowId,
      WorkflowStatus.COMPLETED
    );
    console.log(`Workflow completed. Transaction hash: ${completeHash}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## Creating a Complex Agent

This example shows how to create a more complex agent that handles different workflows and integrates with external services.

```typescript
import { AgentService, AgentRequest, AgentResponse } from 'a3-platform';
import axios from 'axios';

class WeatherAgent extends AgentService {
  private apiKey: string;

  constructor(options: { port: number; processId: string; processName: string; apiKey: string }) {
    // Create workflow handlers
    const handlers = {
      getCurrentWeather: this.getCurrentWeather.bind(this),
      getForecast: this.getForecast.bind(this),
      default: this.getCurrentWeather.bind(this),
    };

    // Initialize the base class
    super({
      port: options.port,
      processId: options.processId,
      processName: options.processName,
      workflowHandlers: handlers,
    });

    this.apiKey = options.apiKey;
  }

  // Handler for the "getCurrentWeather" workflow
  async getCurrentWeather(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logTransaction(request.transactionId, 'Getting current weather...');

      // Extract location from request data
      const { location } = request.data as { location: string };
      if (!location) {
        throw new Error('Location is required');
      }

      // Call weather API
      const response = await axios.get(
        `https://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${encodeURIComponent(location)}`
      );

      // Extract relevant data
      const weather = {
        location: response.data.location.name,
        country: response.data.location.country,
        temperature: response.data.current.temp_c,
        condition: response.data.current.condition.text,
        humidity: response.data.current.humidity,
        windSpeed: response.data.current.wind_kph,
      };

      this.logTransaction(request.transactionId, `Weather data retrieved for ${location}`);

      return {
        success: true,
        result: weather,
        executionTime: Date.now() - new Date(request.timestamp || Date.now()).getTime(),
      };
    } catch (error) {
      this.logTransaction(
        request.transactionId,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - new Date(request.timestamp || Date.now()).getTime(),
      };
    }
  }

  // Handler for the "getForecast" workflow
  async getForecast(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logTransaction(request.transactionId, 'Getting weather forecast...');

      // Extract location and days from request data
      const { location, days = 3 } = request.data as { location: string; days?: number };
      if (!location) {
        throw new Error('Location is required');
      }

      // Call weather API
      const response = await axios.get(
        `https://api.weatherapi.com/v1/forecast.json?key=${this.apiKey}&q=${encodeURIComponent(location)}&days=${days}`
      );

      // Extract relevant data
      const forecast = {
        location: response.data.location.name,
        country: response.data.location.country,
        days: response.data.forecast.forecastday.map((day: any) => ({
          date: day.date,
          maxTemp: day.day.maxtemp_c,
          minTemp: day.day.mintemp_c,
          condition: day.day.condition.text,
          chanceOfRain: day.day.daily_chance_of_rain,
        })),
      };

      this.logTransaction(request.transactionId, `Forecast data retrieved for ${location}`);

      return {
        success: true,
        result: forecast,
        executionTime: Date.now() - new Date(request.timestamp || Date.now()).getTime(),
      };
    } catch (error) {
      this.logTransaction(
        request.transactionId,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - new Date(request.timestamp || Date.now()).getTime(),
      };
    }
  }
}

// Create and start the weather agent
const weatherAgent = new WeatherAgent({
  port: 3001,
  processId: 'weather-process-123',
  processName: 'Weather Agent',
  apiKey: process.env.WEATHER_API_KEY || '',
});

weatherAgent
  .start()
  .then(() => {
    console.log('Weather agent started on port 3001');
  })
  .catch(error => {
    console.error('Failed to start weather agent:', error);
  });
```

## Using the Transaction Handler

This example demonstrates how to use the Transaction Handler to submit and manage transactions.

```typescript
import { TransactionHandler } from 'a3-platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  // Create a transaction handler instance
  const transactionHandler = new TransactionHandler({
    moduleAddress: process.env.APTOS_MODULE_ADDRESS,
    nodeUrl: process.env.APTOS_NODE_URL,
  });

  // Create an Aptos account from a private key (gateway service account)
  const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

  const processId = 'process-12345';
  const transactionId = uuidv4();
  const userAddress = '0x123abc...'; // Replace with actual user address

  try {
    // Define the transaction request
    const request = {
      processId,
      transactionId,
      userAddress,
      data: { input: 'Hello, world!' },
      priority: 1, // PRIORITY_NORMAL
    };

    // Submit the transaction
    const txId = await transactionHandler.submitTransaction(request, account);
    console.log(`Transaction submitted: ${txId}`);

    // Get queue size
    const queueSize = await transactionHandler.getQueueSize(account.address().toString());
    console.log(`Queue size: ${queueSize}`);

    // Get pending transaction count
    const pendingCount = await transactionHandler.getPendingTransactionCount(
      account.address().toString()
    );
    console.log(`Pending transactions: ${pendingCount}`);

    // Forward to agent service
    const response = await transactionHandler.forwardToAgentService(transactionId, request);
    console.log('Agent response:', response);

    // Update transaction status based on response
    if (response.success) {
      await transactionHandler.updateTransactionStatus(
        transactionId,
        2, // COMPLETED
        account
      );
      console.log('Transaction status updated to COMPLETED');
    } else {
      await transactionHandler.updateTransactionStatus(
        transactionId,
        3, // FAILED
        account
      );
      console.log('Transaction status updated to FAILED');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

These examples illustrate the fundamental operations of the A3 platform and can be used as a starting point for building more complex applications.
