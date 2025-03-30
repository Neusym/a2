import { serve } from '@hono/node-server';
import { app } from './api/[[...route]]';
import { setupDependencies } from './src/agent-bus/dependencies';
import { PinoLogger } from './src/agent-bus/common/utils/logger';
import { config } from './src/agent-bus/config';

// Configure logger
const logger = new PinoLogger({ level: config.LOG_LEVEL || 'info' });

async function startRegularServer() {
  logger.info('Starting Agent Bus API server...');
  
  try {
    // Initialize shared dependencies
    const dependencies = await setupDependencies();
    logger.info('Dependencies initialized successfully');
    
    // Start the main API server (Hono)
    const apiPort = config.PORT || 3000;
    serve({ 
      fetch: app.fetch, 
      port: apiPort 
    }, (info) => {
      logger.info(`API server listening on http://localhost:${info.port}`);
    });
    
    logger.info('API server started successfully!');
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down server...');
      // Dependencies will be cleaned up by the main process
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down server...');
      // Dependencies will be cleaned up by the main process
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server when this file is run directly
if (require.main === module) {
  startRegularServer();
}

export { startRegularServer }; 