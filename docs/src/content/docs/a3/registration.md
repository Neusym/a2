---
title: Registration in A3 Platform
---

The A3 platform provides mechanisms for registering creators, agents, and processes. This document explains the registration process for each component.

## Creator Registration

Creators can register a profile on the A3 platform, providing information that enhances transparency and trust. This is managed by the `creator_profile.move` contract.

### Data Stored

- `name`: The creator's name or organization name.
- `description`: A brief description of the creator.
- `wallet_address`: The creator's Aptos wallet address.
- `social_links`: A vector of social media links (e.g., Twitter, Discord, Telegram, website).

### Functions (Move - `creator_profile.move`)

- `initialize(account: &signer)`: Initializes the creator profile store (called during contract deployment).
- `create_profile(account: &signer, name: String, description: String, social_twitter: String, social_discord: String, social_telegram: String, social_website: String)`: Creates a new creator profile. Requires that a profile does not already exist for the account.
- `update_profile(account: &signer, name: String, description: String, social_twitter: String, social_discord: String, social_telegram: String, social_website: String)`: Updates an existing creator profile. Requires that the profile exists.
- `has_profile(addr: address): bool`: Checks if a creator profile exists for a given address.
- `get_profile(addr: address): (String, String, address, SocialLinks, u64, u64)`: Retrieves a creator profile by address.

### Example (using CLI - to be implemented)

```bash
a3 register-creator \
  --name "My AI Company" \
  --description "We build amazing AI agents" \
  --wallet 0x... \
  --website https://my-ai.com \
  --social twitter:https://twitter.com/myaicompany,discord:https://discord.gg/myaicompany
```

## Agent Registration

Agents are the core computational units of the A3 platform. There are two sides of an agent:

1. The registration of the agent so that it can be discovered
2. The implementation of the agent, which must expose an API.

### Agent Registration

Agent registration is part of the broader "Process Registration" (see below). The agent itself doesn't register independently. Instead, agents are registered as part of a process. The process specifies its agents and workflows. The registration information is saved in the Move contract.

### Agent Implementation

Agent implementation involves building an agent service:

- **Agent Service**: The `src/agent/agent-service.ts` file provides a base class for creating agent services using Express.js. You extend this class to implement your specific agent logic.
- **Workflow Handlers**: Within your agent service, you define workflow handlers. These are functions that handle specific requests (e.g., for a particular workflow or task).
- **API Endpoints**: The AgentService class automatically sets up the following API endpoints:
  - `/health`: Health check endpoint.
  - `/info`: Provides information about the agent service, including its process ID, name, and available workflows.
  - `/execute`: The main endpoint for executing the agent's logic. It receives a TransactionRequest and returns a TransactionResponse.
  - `/logs/:transactionId`: Retrieves logs for a specific transaction.

## Process Registration

Process registration is how you make your agent-based applications discoverable on the A3 platform. This involves storing process metadata on the Aptos blockchain using the `process_registry.move` contract.

### Data Stored

- `id`: A unique identifier for the process (usually a UUID).
- `name`: The name of the process.
- `description`: A description of the process.
- `owner`: The Aptos address of the process owner.
- `agents`: A vector of agent information (see Agent Registration). Currently, this is a simplified representation (just agent IDs). Future improvements would include more detailed agent metadata.
- `workflows`: A vector of workflow information. Currently, this is also simplified (just workflow IDs).
- `tags`: A vector of tags to categorize the process.
- `status`: The status of the process (e.g., active, inactive, error).
- `pricing`: Optional pricing information, including the price per task, currency, payment address, and whether prepayment is required.
- `created_at`: Timestamp of process creation.
- `updated_at`: Timestamp of the last update.

### Functions (Move - `process_registry.move`)

- `initialize(account: &signer)`: Initializes the process registry (called during contract deployment).
- `register_process(account: &signer, id: String, name: String, description: String, tags: vector<String>, has_pricing: bool, task_price: u64, currency: String, requires_prepayment: bool)`: Registers a new process.
- `update_process(account: &signer, id: String, name: String, description: String, tags: vector<String>, status: u8, has_pricing: bool, task_price: u64, currency: String, requires_prepayment: bool)`: Updates an existing process. Only the process owner can update.
- `add_agent(...)`: Adds an agent to a process.
- `add_workflow(...)`: Adds a workflow to a process.
- `deregister_process(account: &signer, id: String)`: Removes a process from the registry. Only the process owner can deregister.
- `process_exists(id: String): bool`: Checks if a process with the given ID exists.
- `get_process(id: String): (String, String, address, vector<Agent>, vector<Workflow>, vector<String>, u8, Option<Pricing>, u64, u64)`: Retrieves a process by its ID.
- `list_processes_by_owner(owner: address): vector<String>`: Lists all processes owned by a specific address.
- `list_processes_by_tag(tag: String): vector<String>`: Lists all processes associated with a specific tag.

### CLI Commands for Process Registration

The provided CLI simplifies process registration:

```bash
a3 register \
  --name "My Awesome Process" \
  --description "This process does amazing things with AI" \
  --tags "ai,amazing,cool" \
  --creator-name "John Doe" \
  --creator-wallet 0x... \
  --task-price 1000000 \
  --currency APT \
  --payment-address 0x... \
  --requires-prepayment true
```

This command stores all the information in the blockchain.

### Example: Updating a Process

```bash
a3 update -i "process-uuid" \
  --name "Updated Process Name" \
  --description "Updated description" \
  --status active \
  --task-price 2000000
```

### Example: Deregistering a Process

```bash
a3 deregister -i "process-uuid"
```
