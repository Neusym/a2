# A3 - Aptos Agent to Agent

The A3 (Aptos Agent to Agent) Platform is a decentralized system built on the Aptos blockchain for creating, discovering, executing, and managing autonomous agent processes. It combines the power of Move smart contracts with a TypeScript/Node.js SDK and CLI to provide a robust and flexible environment for agent-based applications.

## Key Concepts

- **Agent**: A self-contained unit of computation that can perform specific tasks. Agents have instructions, goals, and roles. Agents can be implemented as services that expose an API endpoint.
- **Process**: A collection of agents and workflows that collaborate to achieve a larger goal. Processes have associated metadata, such as a name, description, owner, tags, and optionally, pricing information.
- **Workflow**: A defined sequence of tasks within a process, specifying the execution order and dependencies between tasks. Workflows define how agents interact to complete a process.
- **Discovery Service**: A decentralized registry of processes, built on the Aptos blockchain. It enables users and systems to find and register processes.
- **Payment Service**: A mechanism for handling payments between users and agents, or between agents themselves. It utilizes an escrow system on the Aptos blockchain to ensure secure and reliable transactions.
- **Transaction Queue**: An on-chain queue that manages transactions submitted to processes. This supports asynchronous execution, prioritization, and transaction tracking.
- **Creator Profile**: A profile associated with process creators, storing information like name, description, wallet address, and social links. This enhances transparency and accountability.
- **Agent Gateway**: The primary entry point for executing agent processes. It handles payment verification, submits transactions to the blockchain, and routes requests to the appropriate agent service.
- **Agent Service**: A service that hosts and executes an agent's logic. It exposes an API endpoint to receive requests and return results.

## Architecture

The A3 platform consists of the following core components:

- **User/Client**: Interacts with the A3 platform via the CLI, SDK, or by directly calling the Agent Gateway's API.
- **Agent Gateway**: Acts as a reverse proxy and intermediary between users and agent services. It handles:
  - Authentication and authorization
  - Payment verification
  - Submitting transactions to the Aptos blockchain
  - Routing requests to the appropriate Agent Service
- **Agent Service**: Runs the actual agent logic. It's a separate service that exposes an HTTP API.
- **Aptos Blockchain (Move Contracts)**: Provides the decentralized infrastructure for the A3 platform, including:
  - Discovery Service (`process_registry.move`)
  - Payment Service (`payment.move`)
  - Transaction Queue (`queue.move`)
  - Creator Profiles (`creator_profile.move`)
  - A3 Manager (`a3_manager.move`)
  - Workflows (`workflow.move`)

## Getting Started

These steps guide you through setting up the A3 platform and deploying the core contracts.

### Prerequisites

- **Node.js and npm**: Ensure you have Node.js (version 18 or later) and npm (or pnpm/yarn) installed.
- **Aptos CLI**: Install the Aptos CLI by following the instructions on the Aptos Developer Network.
- **Move CLI**: The Aptos CLI includes the Move CLI.
- **Aptos Account**: You need an Aptos account with some testnet tokens (if deploying to testnet).

### Installation

1. **Clone the Repository**:

```bash
git clone <repository_url> # Replace with the actual repository URL
cd <repository_name>
```

2. **Install Dependencies**:

```bash
pnpm install
```

3. **Environment Setup**:

Create a `.env` file in the root directory of the project with the following variables:

```
APTOS_PRIVATE_KEY=<your_aptos_private_key>  # Your Aptos account's private key
APTOS_NETWORK=testnet                       # Or devnet, mainnet
APTOS_MODULE_ADDRESS=<your_module_address>  # This will be set after contract deployment
# Optional:
# APTOS_NODE_URL=<custom_node_url>          # If using a custom Aptos node
# APTOS_FAUCET_URL=<custom_faucet_url>      # If using a custom faucet
```

4. **Deploy the Smart Contracts**:

Using the Setup Script (Recommended):

```bash
./setup-aptos.sh
```

This script will:
- Generate an Aptos private key (if you don't have one)
- Create an Aptos profile
- Derive the account address
- Compile and publish the process_registry Move module
- Initialize the registry
- Update your .env file with the APTOS_MODULE_ADDRESS
- Copy the .env file over to the Move folder

5. **Build the TypeScript Code**:

```bash
pnpm run build
```

6. **Run Tests (Optional)**:

```bash
pnpm test
```
