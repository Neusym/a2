# a2 - Agent to Agent Framework

<p align="center">
  <img src="https://via.placeholder.com/200x200?text=a2" alt="a2 Logo" width="200" height="200">
</p>

<p align="center">
  <strong>A powerful TypeScript framework for building, orchestrating, and connecting AI-powered agents</strong>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#examples">Examples</a> •
  <a href="#api-reference">API</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

## Overview

The a2 framework is a TypeScript-based library designed for building, orchestrating, and connecting AI-powered agents. It provides a flexible and extensible foundation for creating applications that leverage the power of Large Language Models (LLMs) and other AI components.

## Key Features

- **Agent-Centric**: Build autonomous agents with customizable instructions, goals, and roles
- **Modular Design**: Utilize components like Memory, Tools, and Resources to enhance agent capabilities
- **Extensible**: Easily integrate custom AI models, memory systems, and tools
- **Workflow Orchestration**: Define and execute complex workflows involving multiple agents and steps
- **Process Management**: Create processes that coordinate multiple agents and workflows working together
- **Multi-Agent Collaboration**: Enable agents to communicate and work together within processes
- **Vercel AI SDK Integration**: Seamlessly works with the Vercel AI SDK for LLM interaction
- **Typesafe**: Built with TypeScript for robust type checking and improved developer experience


## Usage

### Basic Agent Example

```typescript
import { Agent, createAgent } from 'a2';

// Create a simple agent
const researchAgent = createAgent({
  name: 'ResearchAgent',
  description: 'Performs research on a given topic',
  instructions: 'Research the topic thoroughly and provide factual information.',
  model: 'gpt-4-turbo',
});

// Use the agent
const result = await researchAgent.run({
  input: 'What are the latest developments in fusion energy?'
});

console.log(result);
```

### Multi-Agent Process Example

```typescript
import { createProcess, createAgent, createWorkflow } from 'a2';

// Create specialized agents
const researchAgent = createAgent({
  name: 'Researcher',
  description: 'Performs in-depth research',
  instructions: 'Find accurate information on the topic',
});

const summaryAgent = createAgent({
  name: 'Summarizer',
  description: 'Creates concise summaries',
  instructions: 'Summarize information into clear points',
});

// Define a workflow
const researchWorkflow = createWorkflow({
  name: 'ResearchProcess',
  steps: [
    {
      name: 'research',
      agent: researchAgent,
      input: (context) => context.input,
    },
    {
      name: 'summarize', 
      agent: summaryAgent,
      input: (context) => context.steps.research.output,
    }
  ]
});

// Create a process
const process = createProcess({
  workflows: [researchWorkflow],
});

// Execute the process
const result = await process.run({
  input: 'Explain quantum computing'
});

console.log(result);
```

## Architecture

The a2 framework follows a modular architecture with these core concepts:

### Agents

Agents are the primary building blocks, powered by LLMs or other AI systems. They can:
- Execute tasks based on instructions
- Use tools to interact with external systems
- Access memory to maintain context
- Process inputs and generate outputs

### Workflows

Workflows define sequences of steps that can be executed by agents. They enable:
- Sequential and parallel execution of tasks
- Data passing between steps
- Conditional branching based on results
- Error handling and retries

### Processes

Processes coordinate multiple agents and workflows to accomplish complex tasks:
- Manage multi-agent communication
- Orchestrate workflow execution
- Maintain shared context
- Track state and progress

### Tools

Tools extend agent capabilities by allowing them to:
- Retrieve information from external sources
- Perform computations
- Interact with APIs
- Handle file operations

### Memory

Memory systems allow agents to:
- Store and retrieve information
- Maintain conversation history
- Build knowledge bases
- Share information across agents

## Examples

Check out example implementations in the [examples](./examples) directory:

- Basic agent usage
- Multi-agent collaboration
- Tool integration
- Custom memory systems
- Complex workflows
- Process orchestration


## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
