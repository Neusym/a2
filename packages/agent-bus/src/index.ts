// Main application entry point - typically not needed for Vercel Serverless Functions
// The entry point is api/[[...route]].ts

// This file can be used for potentially running scheduled tasks or local development scripts
// if needed, but the primary execution starts from the API route handler.

import { config } from './agent-bus/config';
import { setupDependencies, shutdownDependencies } from './agent-bus/dependencies';
import { PinoLogger } from './agent-bus/common/utils/logger'; // Use concrete class for initial log
import { serve } from '@hono/node-server';
import { app } from '../api/[[...route]]'; // Import the Hono app

// Use a basic logger instance here, dependencies setup will create the main one
const logger = new PinoLogger({ level: config.LOG_LEVEL || 'info' });

async function startLocalDevServer() {
    logger.info(`Starting Agent Bus in local development mode (NODE_ENV=${config.NODE_ENV})...`);
    try {
        await setupDependencies(); // Initialize dependencies
        logger.info("Local development setup complete. Starting Hono server...");
        
        // Start a standalone Hono server for local development
        const port = config.PORT || 3000;
        serve({ 
            fetch: app.fetch, 
            port: port 
        }, (info) => {
            logger.info(`Local Hono server listening on http://localhost:${info.port}`);
        });

    } catch (error) {
        logger.error("Failed to start local development setup:", error);
        process.exit(1);
    }
}

// Graceful shutdown for local dev
async function shutdownLocalDevServer() {
    logger.info("Shutting down local development server...");
    await shutdownDependencies();
    logger.info("Local development server shut down complete.");
    process.exit(0); // Exit cleanly
}

// Check if running directly
if (require.main === module) {
    startLocalDevServer();

    // Handle SIGTERM/SIGINT for graceful shutdown during local development
    process.on('SIGTERM', shutdownLocalDevServer);
    process.on('SIGINT', shutdownLocalDevServer);
}

// Export config and potentially setup function if needed by other scripts
export { config, setupDependencies }; 