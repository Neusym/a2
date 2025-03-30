import { z } from 'zod';

// Zod schema for environment variable validation
export const ConfigSchema = z.object({
    // General
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    PORT: z.coerce.number().positive().optional().default(3001), // Port for local Hono dev server
    MCP_PORT: z.coerce.number().positive().optional().default(3002), // Port for MCP server

    // LLM Providers
    LLM_PROVIDER: z.enum(['openai', 'anthropic', 'custom']).default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    CUSTOM_LLM_ENDPOINT: z.string().url().optional(), // Ensure URL format if provided

    // LLM Models
    CLARIFICATION_MODEL: z.string().default('gpt-4-turbo-preview'),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
    MATCHING_REASONING_MODEL: z.string().default('claude-3-opus-20240229'),
    WORKFLOW_GENERATION_MODEL: z.string().default('claude-3-opus-20240229'),

    // Agent Bus Logic
    DISABLE_PROCESSOR_FILTERING: z.coerce.boolean().default(false),
    DISABLE_MULTI_STEP_WORKFLOW: z.coerce.boolean().default(false),
    HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().positive().default(5000),
    DEFAULT_MAX_CANDIDATES: z.coerce.number().positive().default(5),

    // Neon Database (PostgreSQL) - REQUIRED
    NEON_DATABASE_URL: z.string().url("NEON_DATABASE_URL must be a valid URL"),
    // --- Optional Neon Vars (from .env) ---
    DATABASE_URL: z.string().url().optional(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
    PGHOST: z.string().optional(),
    PGHOST_UNPOOLED: z.string().optional(),
    PGUSER: z.string().optional(),
    PGDATABASE: z.string().optional(),
    PGPASSWORD: z.string().optional(),
    // --- Vercel Postgres Format (Optional) ---
    POSTGRES_URL: z.string().url().optional(),
    POSTGRES_URL_NON_POOLING: z.string().url().optional(),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_HOST: z.string().optional(),
    POSTGRES_PASSWORD: z.string().optional(),
    POSTGRES_DATABASE: z.string().optional(),
    POSTGRES_URL_NO_SSL: z.string().url().optional(),
    POSTGRES_PRISMA_URL: z.string().url().optional(),

    // Upstash Redis - REQUIRED
    UPSTASH_REDIS_URL: z.string().url("UPSTASH_REDIS_URL must be a valid URL"),
    UPSTASH_REDIS_TOKEN: z.string().min(1, "UPSTASH_REDIS_TOKEN is required"),
    REDIS_TTL_SECONDS: z.coerce.number().positive().optional().default(86400), // 24 hours
    // --- Optional Redis/KV Vars (from .env) ---
    KV_URL: z.string().url().optional(),
    KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
    REDIS_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
    KV_REST_API_URL: z.string().url().optional(),

    // Upstash QStash - REQUIRED
    QSTASH_TOKEN: z.string().min(1, "QSTASH_TOKEN is required"),
    QSTASH_URL: z.string().url("QSTASH_URL must be a valid URL"), // URL QStash will call (e.g., Vercel function endpoint)
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1, "QSTASH_CURRENT_SIGNING_KEY is required"),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1, "QSTASH_NEXT_SIGNING_KEY is required"),
    // --- Common Queue/Topic Names ---
    TASK_EVENT_TOPIC: z.string().default('agent-bus-task-events'), // QStash queue/URL suffix
    MESSAGE_QUEUE_TOPIC: z.string().default('agent-bus-messages'), // For processor/requester comms

    // Pinecone Vector DB - REQUIRED
    PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
    PINECONE_INDEX_NAME: z.string().min(1, "PINECONE_INDEX_NAME is required"),
    PINECONE_HOST: z.string().url("PINECONE_HOST must be a valid URL"),
    PINECONE_ENVIRONMENT: z.string().min(1, "PINECONE_ENVIRONMENT is required"),
    PINECONE_METRIC: z.string().min(1, "PINECONE_METRIC is required"),
    PINECONE_DIMENSIONS: z.coerce.number().positive("PINECONE_DIMENSIONS must be a positive number"),
    PINECONE_NAMESPACE: z.string().optional().default('default'),

    // Vercel Blob Storage - REQUIRED
    BLOB_READ_WRITE_TOKEN: z.string().min(1, "BLOB_READ_WRITE_TOKEN is required"),

    // Backend API (Optional - for interacting with another service)
    BACKEND_API_URL: z.string().url().optional(),
    BACKEND_API_KEY: z.string().optional(),

    // External Processor Registry (Optional)
    PROCESSOR_REGISTRY_URL: z.string().url().optional(),

}).refine(data => !(data.LLM_PROVIDER === 'openai' && !data.OPENAI_API_KEY), {
    message: 'OPENAI_API_KEY is required when LLM_PROVIDER is openai',
    path: ['OPENAI_API_KEY'],
}).refine(data => !(data.LLM_PROVIDER === 'anthropic' && !data.ANTHROPIC_API_KEY), {
    message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER is anthropic',
    path: ['ANTHROPIC_API_KEY'],
}).refine(data => !(data.LLM_PROVIDER === 'custom' && !data.CUSTOM_LLM_ENDPOINT), {
    message: 'CUSTOM_LLM_ENDPOINT is required when LLM_PROVIDER is custom',
    path: ['CUSTOM_LLM_ENDPOINT'],
});
// Removed redundant checks for required fields already covered by non-optional types (e.g., NEON_DATABASE_URL)

// Type helper for inferred config
export type AgentBusConfig = z.infer<typeof ConfigSchema>; 