---
title: Payment Service
---

The Payment Service handles payments for process execution. It uses an escrow system implemented in the `payment.move` contract. The `AptosPaymentService` class (`src/payment/aptos-payment-service.ts`) provides the TypeScript interface.

## Key Functions

- `makePayment(account: AptosAccount, request: PaymentRequest): Promise<string>`: Makes a payment for a process. The funds are held in escrow.
- `verifyPayment(userAddress: string, processId: string): Promise<boolean>`: Verifies that a payment has been made by a user for a specific process.
- `getPaymentDetails(userAddress: string, processId: string): Promise<PaymentDetails | null>`: Retrieves details about a payment.
- `releasePayment(account: AptosAccount, request: PaymentReleaseRequest): Promise<string>`: Releases the payment from escrow to the process owner (typically after task completion and approval).
- `requestRefund(account: AptosAccount, request: RefundRequest): Promise<string>`: Requests a refund for a payment (if the task was not completed or was canceled).

## Move Contract Functions

The payment functionality is implemented in the `payment.move` contract.

### Functions (Move - `payment.move`)

- `initialize(account: &signer)`: Initializes the payment module.
- `make_payment(account: &signer, process_id: String, task_id: String, amount: u64)`: Makes a payment and places it in escrow.
- `release_payment(account: &signer, process_id: String, task_id: String)`: Releases the payment from escrow to the process owner.
- `request_refund(account: &signer, process_id: String, task_id: String)`: Requests a refund for a payment.
- `verify_payment(process_id: String, task_id: String, payer_addr: address): bool`: Checks if a payment has been made.
- `payment_exists(process_id: String, task_id: String, payer_addr: address): bool`: Checks if a payment record exists.
- `get_payment(process_id: String, task_id: String, payer_addr: address): (String, String, address, address, u64, String, u8, u64, u64)`: Retrieves payment details.

## Escrow Mechanism

The escrow mechanism is a key part of the Payment Service. It ensures that funds are securely held until a task is completed, providing protection for both users and process owners.

### How Escrow Works

1. **Payment**: When a user wants to run a process, they call `make_payment`. The specified amount of tokens is withdrawn from the user's account and transferred to the A3 module's account, where it's held in an Escrow resource.

2. **Payment Record**: A Payment record is created, storing details like the process ID, payer, receiver, amount, currency, and status (initially ESCROW).

3. **Task Completion/Approval**: After the agent service completes the task, the `workflow.move` contract's `approve_task_and_release_payment` function is called. This function verifies that:

   - The task exists.
   - The caller is authorized to approve the task (typically the requester).
   - The task is in the COMPLETED state.
   - A corresponding payment exists.

4. **Payment Release**: If all checks pass, the `release_payment` function in `payment.move` is called. This transfers the funds from the escrow to the process owner's account and updates the Payment record's status to COMPLETED.

5. **Refunds**: If a task is canceled or fails, the `request_refund` function can be called (within a specified time window). This returns the funds from escrow to the payer and updates the Payment record's status to REFUNDED.

### Payment Flow Diagram

```
User                  A3 Module               Process Owner
 |                        |                         |
 |--- make_payment ------>|                         |
 |                        |                         |
 |<-- Payment in Escrow --|                         |
 |                        |                         |
 |                        | (Task Execution)        |
 |                        |                         |
 |--- approve_task ------>|                         |
 |                        |                         |
 |                        |--- release_payment ---->|
 |                        |                         |
 |<-- Payment Complete -->|<-- Payment Received ----|
```

### Payment Statuses

- `ESCROW (0)`: The payment has been made and is being held in escrow.
- `COMPLETED (1)`: The payment has been released to the process owner.
- `REFUNDED (2)`: The payment has been refunded to the payer.
- `CANCELED (3)`: The payment has been canceled.

## Example Usage

### Making a Payment

```typescript
import { createAptosPaymentService, PaymentRequest } from 'platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

// Create a payment service instance
const paymentService = createAptosPaymentService({
  privateKey: process.env.APTOS_PRIVATE_KEY,
  moduleAddress: process.env.APTOS_MODULE_ADDRESS,
});

// Create an Aptos account from a private key
const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

// Define the payment request
const request: PaymentRequest = {
  processId: 'my-process-id',
  taskId: 'task-1', // Can be the same as the transaction ID
  amount: '1000000', // In octas (1 APT = 100,000,000 octas)
};

// Make the payment
try {
  const transactionHash = await paymentService.makePayment(account, request);
  console.log(`Payment made. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to make payment:', error);
}
```

### Verifying a Payment

```typescript
// Verify that a payment has been made
const userAddress = '0x123...';
const processId = 'my-process-id';

const isVerified = await paymentService.verifyPayment(userAddress, processId);
if (isVerified) {
  console.log('Payment verified.');
} else {
  console.log('No payment found or payment not in escrow.');
}
```

### Getting Payment Details

```typescript
// Get payment details
const paymentDetails = await paymentService.getPaymentDetails(userAddress, processId);
if (paymentDetails) {
  console.log('Payment details:', paymentDetails);
  // {
  //   processId: 'my-process-id',
  //   taskId: 'task-1',
  //   payer: '0x123...',
  //   receiver: '0x456...',
  //   amount: '1000000',
  //   currency: 'APT',
  //   status: 0, // ESCROW
  //   createdAt: 1626100000,
  //   updatedAt: 1626100000
  // }
} else {
  console.log('No payment found.');
}
```

### Releasing a Payment

```typescript
// This is typically called automatically after task completion
// But can also be called manually if needed
const releaseRequest = {
  processId: 'my-process-id',
  taskId: 'task-1',
};

try {
  const transactionHash = await paymentService.releasePayment(account, releaseRequest);
  console.log(`Payment released. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to release payment:', error);
}
```

### Requesting a Refund

```typescript
// Can be called if the task was not completed or was canceled
const refundRequest = {
  processId: 'my-process-id',
  taskId: 'task-1',
};

try {
  const transactionHash = await paymentService.requestRefund(account, refundRequest);
  console.log(`Refund requested. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to request refund:', error);
}
```

## Integration with Agent Gateway

The Payment Service is integrated with the Agent Gateway to verify payments before executing processes:

```typescript
// In the Agent Gateway's execute endpoint handler
app.post('/api/execute/:processId', async (req, res) => {
  const processId = req.params.processId;
  const { userAddress } = req.body;

  try {
    // Get process details to check if payment is required
    const process = await discoveryService.getProcess(processId);
    if (!process) {
      return res.status(404).json({
        success: false,
        error: 'Process not found',
        processId,
      });
    }

    // Check if payment is required
    if (process.pricing && process.pricing.requiresPrepayment) {
      // Verify payment
      const isVerified = await paymentService.verifyPayment(userAddress, processId);
      if (!isVerified) {
        return res.status(400).json({
          success: false,
          error: 'Payment required',
          processId,
        });
      }
    }

    // Continue with process execution...
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
});
```

## API Endpoints

The Agent Gateway provides the following API endpoints for payment-related operations:

### Make a Payment

```
POST /api/payment
```

Request Body:

```json
{
  "processId": "string",
  "amount": "string",
  "userAddress": "string"
}
```

Response:

```json
{
  "success": true,
  "transactionHash": "string",
  "processId": "string",
  "amount": "string",
  "userAddress": "string",
  "timestamp": "date"
}
```

### Verify a Payment

```
GET /api/payment/verify/:processId/:userAddress
```

Response:

```json
{
  "success": true,
  "verified": true,
  "processId": "string",
  "userAddress": "string",
  "timestamp": "date"
}
```
