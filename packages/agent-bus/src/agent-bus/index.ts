// Barrel file exporting key components of the Agent Bus module

// Common
export * from './common/types';
export * from './common/constants';
export * from './common/utils/logger';
export * from './common/utils/error.handler';
export * from './common/utils/helpers';

// Config & Dependencies
export * from './config';
export * from './dependencies'; // Exports setup and shutdown functions, and Dependencies type

// Core Services & Managers
export * from './core/event.publisher';
export * from './core/task.state.manager';

// Feature Modules (exporting main service/interface)
export * from './intake-clarification'; // Exports IntakeClarificationService etc.
export * from './matching-routing'; // Exports IMatchingRoutingService, MatchingService etc.
export * from './communication'; // Exports CommunicationService, MessageHandler

// Integration Interfaces (useful for mocking or alternative implementations)
export * from './integrations/backend-api/backend.client'; // Export interface IBackendClient
export * from './integrations/database'; // Exports repository/client interfaces
export * from './integrations/llm'; // Exports factory, service interfaces/classes
export * from './integrations/message-queue/upstash.queue.client'; // Export interface IMessageQueueClient
export * from './integrations/processor-registry/registry.client'; // Export interface IProcessorRegistryClient
export * from './integrations/storage/vercel.blob.storage.client'; // Export interface IStorageClient

console.log("Agent Bus Module Loaded (Exports Ready)"); // Log only once when module loads 