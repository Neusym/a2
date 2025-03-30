# Agent Bus Serverless

A serverless implementation of Agent Bus using modern cloud technologies:

- **API Framework**: [Hono.js](https://hono.dev/) (hosted on [Vercel](https://vercel.com/))
- **Database**: [Neon PostgreSQL](https://neon.tech/)
- **Cache & State**: [Upstash Redis](https://upstash.com/redis)
- **Message Queue**: [Upstash Kafka](https://upstash.com/kafka)
- **Vector DB**: [Pinecone](https://www.pinecone.io/)
- **Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **LLM Integration**: OpenAI and Anthropic API clients
- **Protocol Support**: Standard REST API and [Model Context Protocol (MCP)](https://github.com/ModelContext/protocol)

## Project Overview

The Agent Bus system manages the workflow of task processing with multiple agents (processors):

1. Task intake and clarification
2. Processor matching and selection
3. Task execution and monitoring
4. Result delivery

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Vercel CLI (for local development)

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Copy the environment variables example file and fill in your API keys:
   ```
   cp .env.example .env
   ```

### Running Locally

For standard API only:
```bash
pnpm dev
```

For both standard API and MCP server:
```bash
pnpm dev:all
```

This starts the development server(s), allowing you to test the functionality locally.

### Deployment

```bash
vercel deploy
```

## Project Structure

The project follows a domain-centric organization:

- `api/`: Vercel serverless API endpoints (Hono.js)
- `src/agent-bus/`: Core business logic
  - `common/`: Shared utilities, types, constants
  - `communication/`: Message relaying between processors/requesters
  - `config/`: Environment configuration
  - `core/`: Core services for task state management
  - `intake-clarification/`: Task dialogue and specification
  - `integrations/`: External service clients (DB, LLM, etc.)
    - `mcp-server/`: Model Context Protocol server integration
  - `matching-routing/`: Processor discovery and selection

## MCP Integration

For details on the Model Context Protocol integration, see [README-MCP.md](./README-MCP.md).

## Development Roadmap

The implementation is divided into four logical parts:

1. **Foundation**: Common utilities, configuration, API setup
2. **Data Layer**: Database repositories, Redis state, Pinecone
3. **Core Logic**: Task intake, processor matching, state management
4. **Communication**: Message brokering, event publishing

## License

MIT 