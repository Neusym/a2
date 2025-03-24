---
title: Transaction Management
---

The A3 platform uses a transaction queue (`queue.move`) to manage requests to execute processes. This allows for asynchronous execution and prioritization. The `TransactionHandler` class (`src/transaction/transaction-handler.ts`) handles the transaction lifecycle.

## Transaction Flow

1. **Receiving Transaction Requests**: The Agent Gateway receives requests to execute a process.
2. **Payment Verification**: The `TransactionHandler` uses the `PaymentService` to verify that the user has made the required payment (if applicable).
3. **Registering the Transaction**: The `TransactionHandler` registers the transaction in the on-chain transaction queue (`queue.move`).
4. **Forwarding to Agent Service**: The `TransactionHandler` forwards the request to the appropriate Agent Service via an HTTP POST request to the `/execute` endpoint.
5. **Updating Transaction Status**: After the Agent Service completes (or fails), the `TransactionHandler` updates the transaction status on the blockchain.

## Transaction Queue Contract

The transaction queue is implemented in the `queue.move` contract.

### Functions (Move - `queue.move`)

- `initialize_queue(account: &signer, queue_name: String, processing_limit: u64)`: Initializes a new transaction queue.
- `submit_transaction(account: &signer, process_id: String, transaction_id: String, workflow_id_option: Option<String>, task_id_option: Option<String>, priority: u8, data: vector<u8>)`: Submits a transaction to the queue.
- `update_transaction_status(account: &signer, transaction_id: String, new_status: u8)`: Updates the status of a transaction.
- `cancel_transaction(account: &signer, transaction_id: String)`: Cancels a pending or processing transaction.
- `get_next_transaction(owner: address): (String, String, Option<String>, Option<String>, address, vector<u8>)`: Retrieves the next transaction to process (based on priority).
- `get_queue_size(owner: address): u64`: Returns the total number of transactions in the queue.
- `get_pending_transaction_count(owner: address): u64`: Returns the number of pending transactions.

## Transaction Statuses

- `PENDING (0)`: The transaction has been submitted but not yet processed.
- `PROCESSING (1)`: The transaction is currently being processed by an agent.
- `COMPLETED (2)`: The transaction has been successfully completed.
- `FAILED (3)`: The transaction failed to execute.
- `CANCELED (4)`: The transaction was canceled.

## Transaction Priorities

- `PRIORITY_LOW (0)`
- `PRIORITY_NORMAL (1)`
- `PRIORITY_HIGH (2)`
- `PRIORITY_URGENT (3)`

## Transaction Handler TypeScript Interface

The `TransactionHandler` class provides a TypeScript interface for managing transactions:

```typescript
class TransactionHandler {
  constructor(options: TransactionHandlerOptions);

  async submitTransaction(request: TransactionRequest, account: AptosAccount): Promise<string>;

  async forwardToAgentService(
    transactionId: string,
    request: TransactionRequest
  ): Promise<AgentResponse>;

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    account: AptosAccount
  ): Promise<void>;

  async cancelTransaction(transactionId: string, account: AptosAccount): Promise<void>;

  async getNextTransaction(owner: string): Promise<TransactionDetails | null>;

  async getQueueSize(owner: string): Promise<number>;

  async getPendingTransactionCount(owner: string): Promise<number>;
}
```

## Example Usage

### Submitting a Transaction

```typescript
import { TransactionHandler } from 'platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

// Create a transaction handler instance
const transactionHandler = new TransactionHandler({
  moduleAddress: process.env.APTOS_MODULE_ADDRESS,
  nodeUrl: process.env.APTOS_NODE_URL,
});

// Create an Aptos account (usually from the gateway service's private key)
const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

// Define the transaction request
const request = {
  processId: 'my-process-id',
  transactionId: 'unique-transaction-id', // Usually a UUID
  userAddress: '0x123...', // The user's Aptos address
  data: {
    /* request data */
  },
  workflowId: 'workflow-1', // Optional
  taskId: 'task-1', // Optional
  priority: 1, // PRIORITY_NORMAL
};

// Submit the transaction
try {
  const transactionId = await transactionHandler.submitTransaction(request, account);
  console.log(`Transaction submitted: ${transactionId}`);

  // Forward to agent service
  const response = await transactionHandler.forwardToAgentService(transactionId, request);

  if (response.success) {
    // Update transaction status to COMPLETED
    await transactionHandler.updateTransactionStatus(transactionId, 2 /* COMPLETED */, account);
    console.log('Transaction completed successfully:', response.result);
  } else {
    // Update transaction status to FAILED
    await transactionHandler.updateTransactionStatus(transactionId, 3 /* FAILED */, account);
    console.error('Transaction failed:', response.error);
  }
} catch (error) {
  console.error('Error processing transaction:', error);
}
```

### Checking Queue Status

```typescript
// Get the total number of transactions in the queue
const queueSize = await transactionHandler.getQueueSize('0x123...');
console.log(`Queue size: ${queueSize}`);

// Get the number of pending transactions
const pendingCount = await transactionHandler.getPendingTransactionCount('0x123...');
console.log(`Pending transactions: ${pendingCount}`);

// Get the next transaction to process
const nextTransaction = await transactionHandler.getNextTransaction('0x123...');
if (nextTransaction) {
  console.log('Next transaction:', nextTransaction);
} else {
  console.log('No transactions in the queue.');
}
```

## Integration with Agent Gateway

The Agent Gateway is responsible for receiving transaction requests from users and submitting them to the transaction queue. It also handles forwarding requests to the appropriate Agent Service and updating transaction statuses.

```typescript
// In the Agent Gateway's execute endpoint handler
app.post('/api/execute/:processId', async (req, res) => {
  const processId = req.params.processId;
  const { userAddress, data, workflowId, taskId, priority } = req.body;

  // Generate a unique transaction ID
  const transactionId = uuidv4();

  // Create the transaction request
  const request = {
    processId,
    transactionId,
    userAddress,
    data,
    workflowId,
    taskId,
    priority: priority || 1, // Default to PRIORITY_NORMAL
  };

  try {
    // Verify payment (if required)
    const paymentRequired = await paymentService.isPaymentRequired(processId);
    if (paymentRequired) {
      const paymentVerified = await paymentService.verifyPayment(userAddress, processId);
      if (!paymentVerified) {
        return res.status(400).json({
          success: false,
          error: 'Payment required',
          processId,
        });
      }
    }

    // Submit the transaction
    await transactionHandler.submitTransaction(request, account);

    // Forward to agent service
    const response = await transactionHandler.forwardToAgentService(transactionId, request);

    // Update transaction status based on the response
    if (response.success) {
      await transactionHandler.updateTransactionStatus(transactionId, 2 /* COMPLETED */, account);
      res.status(200).json({
        success: true,
        transactionId,
        processId,
        status: 'completed',
        result: response.result,
        timestamp: new Date().toISOString(),
      });
    } else {
      await transactionHandler.updateTransactionStatus(transactionId, 3 /* FAILED */, account);
      res.status(400).json({
        success: false,
        transactionId,
        processId,
        status: 'failed',
        error: response.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error processing transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
});
```
