---
title: API Reference
---

# API Reference

This document provides a comprehensive reference for the APIs and CLI commands available in the A3 platform.

## Agent Gateway API

The Agent Gateway is an Express.js server that provides the following API endpoints:

### Health Check

```
GET /health
```

Checks the health of the gateway.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

### Execute Process

```
POST /api/execute/:processId
```

Executes a process.

**Request Body:**

```json
{
  "userAddress": "0x...", // The user's Aptos address
  "data": {}, // Input data for the process
  "workflowId": "...", // Optional workflow ID
  "taskId": "...", // Optional task ID
  "priority": 1 // Optional priority (0-3)
}
```

**Response (200 OK - Success):**

```json
{
  "success": true,
  "transactionId": "...",
  "processId": "...",
  "status": "completed",
  "result": {}, // The result from the agent process
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

**Response (400 Bad Request - Failure):**

```json
{
  "success": false,
  "transactionId": "...",
  "processId": "...",
  "status": "failed",
  "error": "...", // Error message
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

### Make Payment

```
POST /api/payment
```

Make a payment to a specific process.

**Request Body:**

```json
{
  "processId": "string",
  "amount": "string",
  "userAddress": "string"
}
```

**Response:**

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

### Verify Payment

```
GET /api/payment/verify/:processId/:userAddress
```

Verify that a payment has been made.

**Response:**

```json
{
  "success": true,
  "verified": true,
  "processId": "string",
  "userAddress": "string",
  "timestamp": "date"
}
```

### Get Process

```
GET /api/process/:processId
```

Get the process information based on a processID.

**Response:**

```json
{
  "success": true,
  "process": {
    "id": "string",
    "name": "string",
    "description": "string",
    "owner": "string",
    "agents": ["string"],
    "workflows": ["string"],
    "tags": ["string"],
    "status": "string",
    "pricing": {
      "taskPrice": "string",
      "currency": "string",
      "requiresPrepayment": true
    },
    "createdAt": "date",
    "updatedAt": "date"
  },
  "timestamp": "date"
}
```

### List Processes

```
GET /api/processes
```

List all of the registered processes. Can add query parameters to filter the result.

**Query Parameters:**

- `owner`: Filter by owner address
- `tag`: Filter by tag
- `status`: Filter by status

**Response:**

```json
{
  "success": true,
  "processes": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "owner": "string",
      "agents": ["string"],
      "workflows": ["string"],
      "tags": ["string"],
      "status": "string",
      "pricing": {
        "taskPrice": "string",
        "currency": "string",
        "requiresPrepayment": true
      },
      "createdAt": "date",
      "updatedAt": "date"
    }
  ],
  "count": 1,
  "timestamp": "date"
}
```

## Agent Service API

The Agent Service is an Express.js server that provides the following API endpoints:

### Health Check

```
GET /health
```

Checks the health of the agent service.

**Response (200 OK):**

```json
{
  "status": "ok",
  "process": {
    "id": "...",
    "name": "..."
  },
  "uptime": 1234.567,
  "memory": {
    "rss": 12345678,
    "heapTotal": 9876543,
    "heapUsed": 5432109,
    "external": 1234567
  },
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

### Get Info

```
GET /info
```

Returns information about the agent service.

**Response (200 OK):**

```json
{
  "process": {
    "id": "...",
    "name": "..."
  },
  "workflows": ["workflow-1", "default"],
  "uptime": 1234.567,
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

### Execute

```
POST /execute
```

Executes the agent's logic.

**Request Body (AgentRequest):**

```json
{
  "transactionId": "...",
  "processId": "...",
  "userAddress": "...",
  "data": {}, // Input data for the agent
  "workflowId": "...", // Optional workflow ID
  "taskId": "...", // Optional task ID
  "priority": 1 // Optional priority
}
```

**Response (200 OK - Success):**

```json
{
  "success": true,
  "result": {}, // The result from the agent
  "executionTime": 123.45,
  "logs": ["...", "..."]
}
```

**Response (400 Bad Request - Failure):**

```json
{
  "success": false,
  "error": "...", // Error message
  "executionTime": 123.45,
  "logs": ["...", "..."]
}
```

### Get Logs

```
GET /logs/:transactionId
```

Returns logs for a specific transaction.

**Response (200 OK):**

```json
{
  "transactionId": "...",
  "logs": ["...", "..."],
  "timestamp": "2024-07-24T12:00:00.000Z"
}
```

## CLI Commands

The A3 platform provides a command-line interface (CLI) for interacting with the system. The main entry point is `a3` (defined in `src/bin/a3.ts`). The CLI uses the `commander` library for argument parsing.

### Register Process

Registers a new agent process with the A3 platform.

```bash
a3 register [options]
```

**Options:**

- `-c, --config <path>`: Path to a JSON configuration file containing process details. If provided, other options are overridden by the config file.
- `-p, --private-key <key>`: The private key of the Aptos account registering the process. Can also be provided via the `APTOS_PRIVATE_KEY` environment variable. **Required.**
- `-m, --module-address <address>`: The Aptos address where the `process_registry` contract is deployed. Can also be provided via the `APTOS_MODULE_ADDRESS` environment variable. **Required.**
- `-n, --network <network>`: The Aptos network to use (mainnet, testnet, devnet). Defaults to `testnet`. Can also be set via the `APTOS_NETWORK` environment variable.
- `--name <name>`: The name of the process.
- `--description <description>`: A description of the process.
- `--url <url>`: The URL of the agent service.
- `--tags <tags>`: A comma-separated list of tags for the process.
- `--status <status>`: The initial status of the process (`active`, `inactive`, `maintenance`). Defaults to `active`.
- `--agents <agents>`: Comma-separated list of agent addresses.
- `--workflows <workflows>`: Comma-separated list of workflow IDs.
- `--task-price <price>`: Price of a task.
- `--currency <currency>`: Currency used, defaults to APT.
- `--payment-address <address>`: Address to receive payments.
- `--requires-prepayment <boolean>`: Specify if the process requires prepayment or not.

**Example:**

```bash
a3 register --name "My AI Process" --description "A process that does AI stuff" --url http://localhost:3001 --tags ai,ml --task-price 1000 --currency APT --requires-prepayment true
```

### Update Process

Updates an existing agent process.

```bash
a3 update -i <process_id> [options]
```

**Options:**

- `-i, --id <id>`: The ID of the process to update. **Required.**
- `-c, --config <path>`: Path to a JSON configuration file containing updated process details.
- `-p, --private-key <key>`: The private key.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.
- `--name <name>`: The updated name of the process.
- `--description <description>`: The updated description.
- `--url <url>`: The updated URL.
- `--tags <tags>`: Updated tags.
- `--status <status>`: Updated status.
- `--agents <agents>`: Updated agents.
- `--workflows <workflows>`: Updated workflows.
- `--task-price <price>`: Updated task price.
- `--currency <currency>`: Updated currency.
- `--payment-address <address>`: Updated payment address.
- `--requires-prepayment <boolean>`: Updated prepayment requirement.

**Example:**

```bash
a3 update -i "process-123" --name "Updated Process Name" --status inactive
```

### Deregister Process

Deregisters (removes) an agent process.

```bash
a3 deregister -i <process_id> [options]
```

**Options:**

- `-i, --id <id>`: The ID of the process to deregister. **Required.**
- `-p, --private-key <key>`: The private key.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 deregister -i "process-123"
```

### List Processes

Lists registered agent processes.

```bash
a3 list [options]
```

**Options:**

- `-o, --owner <address>`: Filter by owner address.
- `-t, --tag <tag>`: Filter by tag.
- `-s, --status <status>`: Filter by status.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 list --tag ai --status active
```

### Get Process

Retrieves information about a specific process.

```bash
a3 get-process <process_id> [options]
```

**Options:**

- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 get-process "process-123"
```

### Run Process

Runs a process (with optional payment).

```bash
a3 run -i <process_id> [options]
```

**Options:**

- `-i, --id <id>`: The ID of the process to run. **Required.**
- `-p, --private-key <key>`: The private key of the user's Aptos account.
- `-d, --data <data>`: JSON string or path to a JSON file containing input data.
- `-w, --workflow <id>`: Workflow ID to execute.
- `-t, --task <id>`: Task ID to execute.
- `--priority <priority>`: Priority level (0-3).
- `--pay`: Make a payment before running the process.
- `--amount <amount>`: Payment amount (required if --pay is used).

**Example:**

```bash
a3 run -i "process-123" -d '{"input": "Hello, world!"}' --pay --amount 1000000
```

### Make Payment

Makes a payment for a process.

```bash
a3 pay -i <process_id> -a <amount> [options]
```

**Options:**

- `-i, --id <id>`: The ID of the process to pay for. **Required.**
- `-a, --amount <amount>`: The payment amount. **Required.**
- `-p, --private-key <key>`: The private key of the user's Aptos account.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 pay -i "process-123" -a 1000000
```

### Verify Payment

Verifies if a payment has been made for a process.

```bash
a3 verify-payment -i <process_id> -u <user_address> [options]
```

**Options:**

- `-i, --id <id>`: The ID of the process to check. **Required.**
- `-u, --user <address>`: The user's Aptos address. **Required.**
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 verify-payment -i "process-123" -u "0x123..."
```

### Create Workflow

Creates a new workflow.

```bash
a3 create-workflow -i <workflow_id> --name <name> [options]
```

**Options:**

- `-i, --id <id>`: The ID for the new workflow. **Required.**
- `--name <name>`: The name of the workflow. **Required.**
- `--description <description>`: A description of the workflow.
- `-p, --private-key <key>`: The private key.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 create-workflow -i "workflow-123" --name "My Workflow" --description "A workflow that processes data"
```

### Add Task

Adds a task to a workflow.

```bash
a3 add-task --workflow <workflow_id> --task <task_id> --name <name> [options]
```

**Options:**

- `--workflow <id>`: The ID of the workflow to add the task to. **Required.**
- `--task <id>`: The ID for the new task. **Required.**
- `--name <name>`: The name of the task. **Required.**
- `--description <description>`: A description of the task.
- `--assignee <address>`: The Aptos address of the assignee.
- `--requester <address>`: The Aptos address of the requester.
- `--process <id>`: The ID of the process this task belongs to.
- `--dependencies <ids>`: Comma-separated list of task IDs that must be completed before this task.
- `-p, --private-key <key>`: The private key.
- `-m, --module-address <address>`: The module address.
- `-n, --network <network>`: The network.

**Example:**

```bash
a3 add-task --workflow "workflow-123" --task "task-1" --name "Data Processing" --description "Process input data" --assignee "0x456..." --process "process-123"
```
