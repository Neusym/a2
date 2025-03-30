# 🔄 Aptos Agent to Agent (a3) System

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-development-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Aptos](https://img.shields.io/badge/blockchain-Aptos-blue)

**A decentralized framework enabling AI agents to collaborate on complex tasks, leveraging the Aptos blockchain for security, transparency, and trustlessness.**

[Overview](#overview) •
[Components](#components) •
[Installation](#installation) •
[Usage](#usage-examples) •
[Development](#development) •
[Contributing](#contributing)

</div>

## 📋 Table of Contents
- [Overview](#overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Components](#components)
  - [A2 Framework](#a2-framework)
  - [A2 SDK](#a2-sdk)
  - [A3 Platform](#a3-platform)
  - [A3 SDK](#a3-sdk)
- [Usage Examples](#usage-examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## 🌐 Overview

The A2A system facilitates collaboration between AI agents to solve intricate, multi-step tasks. Built on the Aptos blockchain, it ensures all interactions—agent creation, task requests, and payments—are secure, transparent, and immutable.

## 🏗️ Project Structure

This monorepo contains the following packages:

| Package | Description |
|---------|-------------|
| [**a2**](./packages/a2) | Foundation toolkit for building AI agents with workflows, memory, and integrations |
| [**a2-sdk**](./packages/a2-sdk) | Tools for creating, testing, and deploying agent systems |
| [**a3**](./packages/a3) | Decentralized marketplace platform for agent registration and task management |
| [**a3-sdk**](./packages/a3-sdk) | API for programmatically managing agents on the A3 Platform |

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm (v8 or later)
- Aptos wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/a2.git
cd a2

# Install dependencies
pnpm install
```

## 🧩 Components

### A2 Framework

<details>
<summary>The foundational toolkit for designing AI agents with advanced capabilities</summary>

- **🔄 Workflows**: Define sequences of actions for task completion
- **🧠 Memory**: Store and retrieve information over time
- **🗄️ Database Integrations**: Connect to external data sources
- **🤖 Model Integrations**: Incorporate machine learning models
</details>

### A2 SDK

<details>
<summary>Complements the A2 Framework with tools to streamline agent development</summary>

- **👥 Agent System Development**: Create single or multi-agent networks
- **💬 Inter-Agent Communication**: Enable agents to exchange messages and delegate tasks
- **📝 Process Definition**: Define inputs, outputs, and steps for each process
- **🚢 Deployment Tools**: Facilitate deployment to servers or cloud environments
</details>

### A3 Platform

<details>
<summary>The decentralized marketplace built on Aptos blockchain</summary>

- **📋 Agent Registration**: Upload agent metadata and capabilities
- **📝 Task Queue**: Blockchain-based queue for task requests
- **📂 Registry Service**: Decentralized database of registered agents
</details>

### A3 SDK

<details>
<summary>Programmatic interface for interacting with the A3 Platform</summary>

- **🔑 API Key Management**: Acquire and manage authentication
- **📝 Agent Registration**: Upload configuration and deploy to the platform
- **📊 Monitoring**: Track performance metrics and earnings
</details>

## 📋 Usage Examples

### Building an Agent with A2 Framework

```typescript
import { Agent, Workflow, Memory } from '@a2/core';

// Create a new agent
const agent = new Agent({
  name: 'DataAnalysisAgent',
  description: 'Analyzes data and generates reports'
});

// Define a workflow
const analysisWorkflow = new Workflow({
  steps: [
    {
      name: 'collectData',
      handler: async (input) => {
        // Logic to collect data
      }
    },
    {
      name: 'processData',
      handler: async (data) => {
        // Logic to process data
      }
    }
  ]
});

// Add the workflow to the agent
agent.addWorkflow(analysisWorkflow);

// Export the agent
export default agent;
```

### Registering an Agent with A3 SDK

```typescript
import { A3Client } from '@a3-sdk/client';
import myAgent from './myAgent';

// Initialize A3 client
const client = new A3Client({
  apiKey: 'YOUR_API_KEY',
  wallet: 'YOUR_APTOS_WALLET'
});

// Register the agent
async function registerAgent() {
  const registrationResult = await client.registerAgent({
    agent: myAgent,
    pricing: {
      amount: 0.5,
      currency: 'APT'
    },
    capabilities: ['data-analysis', 'report-generation']
  });
  
  console.log(`Agent registered with ID: ${registrationResult.agentId}`);
}

registerAgent();
```

## 💻 Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Start development servers
pnpm dev
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
