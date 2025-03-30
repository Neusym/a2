import * as dotenv from 'dotenv';
import { ZodError } from 'zod'; // Import ZodError explicitly
import { ConfigSchema, AgentBusConfig } from './config.schema';
import { ConfigurationError } from '../common/utils/error.handler';

// Load .env file into process.env
// Vercel handles environment variables automatically, but this is useful for local dev
dotenv.config();

function loadConfig(): AgentBusConfig {
    try {
        // Zod automatically picks up process.env values
        const validatedConfig = ConfigSchema.parse(process.env);
        return validatedConfig;
    } catch (error: unknown) { // Catch unknown type
        if (error instanceof ZodError) { // Type guard for ZodError
            console.error('❌ Configuration validation failed:', JSON.stringify(error.flatten().fieldErrors, null, 2));
            // Construct a more informative error message from Zod issues
            const errorMessages = Object.entries(error.flatten().fieldErrors)
                .map(([key, messages]) => `${key}: ${messages?.join(', ')}`)
                .join('; ');
            throw new ConfigurationError(`Configuration validation failed: ${errorMessages}`, { errors: error.flatten() });
        }
        // Handle other potential errors during loading
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Unexpected error loading configuration:', error);
        throw new ConfigurationError(`Unexpected error loading configuration: ${message}`, {}, error instanceof Error ? error : undefined);
    }
}

export const config: AgentBusConfig = loadConfig();

// Log non-sensitive config on startup (optional)
const { // Destructure to exclude sensitive keys
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    NEON_DATABASE_URL, // Keep URL? Often less sensitive than tokens/passwords
    UPSTASH_REDIS_TOKEN,
    PINECONE_API_KEY,
    BLOB_READ_WRITE_TOKEN,
    BACKEND_API_KEY,
    ...safeConfig // The rest are considered safe to log
} = config;

// Use console.log here as logger might not be fully initialized yet depending on import order
console.log(`✅ Configuration loaded for NODE_ENV=${config.NODE_ENV}`);
// console.log('Safe Config:', safeConfig); // Uncomment carefully to view non-sensitive config 