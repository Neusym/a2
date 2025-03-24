/**
 * a3 Platform
 * 
 * Extensions to a2 core with platform capabilities including:
 * - Discovery services with Aptos blockchain integration
 * - Extended process with discovery registration
 * - Creator profile management
 * - Payment verification and processing
 * - Contract deployment and interaction
 */

// Export platform-specific modules
export * from './discovery';
export * from './process';

// Export new modules
export * from './creator/interfaces';
export * from './payment/interfaces';
export * from './payment/aptos-payment-service';
export * from './contract/interfaces';
export * from './contract/aptos-contract-service';

// Factory functions
export * from './factories';

// Utilities
export * from './utils';

// CLI
export * from './cli';

// Add additional platform modules here as they are developed 