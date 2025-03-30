import axios, { AxiosError } from 'axios';
import { ProcessorMetadata, ProcessorStatus, ProcessorId } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { config } from '../config';
import { IProcessorRepository } from '../integrations/database/processor.repository'; // Neon DB Repo Interface
import { handleServiceError } from '../common/utils/error.handler';

export class ProcessorHealthChecker {
    private readonly logger: ILogger;
    private readonly processorRepo: IProcessorRepository; // Use Interface

    constructor(
        processorRepo: IProcessorRepository, // Inject interface
        logger: ILogger
    ) {
        this.processorRepo = processorRepo;
        this.logger = logger.child({ service: 'ProcessorHealthChecker' });
    }

    /**
     * Checks the health of a list of processors concurrently and updates their status in the database.
     * @param processors - The list of processors to check.
     * @returns A list of processors that passed the health check.
     */
    async filterHealthyProcessors(processors: ProcessorMetadata[]): Promise<ProcessorMetadata[]> {
        if (!processors || processors.length === 0) {
            return [];
        }
        this.logger.info(`Checking health for ${processors.length} processors concurrently.`);
        const startTime = Date.now();

        const healthCheckPromises = processors.map(processor =>
             // Wrap the check and update logic to return the processor if healthy, or null otherwise
             this.checkAndUpdateProcessorHealth(processor).then(isHealthy => isHealthy ? processor : null)
        );

        // Wait for all checks to complete (settle)
        const results = await Promise.allSettled(healthCheckPromises);

        const healthyProcessors: ProcessorMetadata[] = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                // result.value is the processor object if healthy
                healthyProcessors.push(result.value);
            } else if (result.status === 'rejected') {
                 // Log errors during the check/update process itself
                 this.logger.error(`Health check/update failed unexpectedly for processor ${processors[index]?.processorId}`, { reason: result.reason });
            }
            // Logging of individual health status and DB updates are handled within checkAndUpdateProcessorHealth
        });

        const duration = Date.now() - startTime;
        this.logger.info(`Health check completed in ${duration}ms. ${healthyProcessors.length} of ${processors.length} processors are healthy.`);
        return healthyProcessors;
    }

    /**
     * Checks a single processor's health and updates its status in the database if changed.
     * @param processor The processor metadata.
     * @returns True if healthy, false otherwise.
     */
    private async checkAndUpdateProcessorHealth(processor: ProcessorMetadata): Promise<boolean> {
        const isCurrentlyHealthy = await this.performHealthCheck(processor);
        const newStatus = isCurrentlyHealthy ? ProcessorStatus.Active : ProcessorStatus.Unhealthy;
        const oldStatus = processor.status;

        // Update DB only if status changed or if it's Unhealthy (to update lastCheckedAt)
        if (oldStatus !== newStatus || newStatus === ProcessorStatus.Unhealthy) {
            this.logger.debug(`Status for ${processor.processorId} is ${newStatus} (was ${oldStatus}). Updating DB.`);
            try {
                await this.processorRepo.updateProcessorStatus(processor.processorId, newStatus, new Date());
                // Update the status on the passed-in object for consistency if needed elsewhere, though filterHealthyProcessors uses original array index
                // processor.status = newStatus;
            } catch (dbError) {
                 // Log DB error but don't fail the health check itself because of DB update failure
                 this.logger.error(`Failed to update status in DB for processor ${processor.processorId}`, { error: dbError });
                 // Consider the processor unhealthy if DB update fails? Or trust the HTTP check? Trust HTTP check for now.
            }
        } else {
             this.logger.debug(`Processor ${processor.processorId} status (${newStatus}) unchanged. No DB update needed.`);
             // Optionally update lastCheckedAt even if status is unchanged Active?
             // Could be done via a separate, non-critical background task or less frequently.
        }

        return isCurrentlyHealthy;
    }


    /**
     * Performs the actual HTTP health check request.
     * @param processor - The metadata of the processor to check.
     * @returns True if the health check endpoint responds successfully (2xx), false otherwise.
     */
    private async performHealthCheck(processor: ProcessorMetadata): Promise<boolean> {
        if (!processor.endpointUrl || typeof processor.endpointUrl !== 'string') {
            this.logger.warn(`Processor ${processor.processorId} has invalid or missing endpoint URL. Marking as unhealthy.`);
            return false;
        }

        // Determine health check URL (append '/health' if not present, handle trailing slash)
        let healthEndpoint = processor.endpointUrl;
        try {
            const url = new URL(processor.endpointUrl);
            // Basic heuristic: append '/health' if not already the last path segment
            const path = url.pathname;
            if (!path.endsWith('/health') && !path.endsWith('/health/')) {
                 // Ensure trailing slash before appending health if path is not just root '/'
                 const basePath = path === '/' ? '/' : (path.endsWith('/') ? path : path + '/');
                 healthEndpoint = url.origin + basePath + 'health';
            } else {
                // Already has /health or /health/
                healthEndpoint = url.origin + path;
            }
        } catch (e) {
             this.logger.warn(`Invalid endpoint URL format for ${processor.processorId}: ${processor.endpointUrl}. Marking as unhealthy. Error: ${e instanceof Error ? e.message : String(e)}`);
             return false;
        }


        this.logger.debug(`Performing health check for ${processor.processorId} at ${healthEndpoint}`);
        try {
            const response = await axios.get(healthEndpoint, {
                timeout: config.HEALTH_CHECK_TIMEOUT_MS,
                validateStatus: status => status >= 200 && status < 300, // Only 2xx are healthy
                 // Add headers if needed by processors
                 // headers: { 'Accept': 'application/json' }
            });

            // Optional: Check response body for specific "ok" status if needed
            // if (response.data?.status !== 'ok') {
            //     this.logger.warn(`Processor ${processor.processorId} health check at ${healthEndpoint} returned 2xx but body status is not 'ok'. Marking unhealthy.`, { body: response.data });
            //     return false;
            // }

            this.logger.debug(`Processor ${processor.processorId} health check successful (Status: ${response.status})`);
            return true;

        } catch (error) {
             if (axios.isAxiosError(error)) {
                const status = error.response?.status || 'N/A';
                // Log timeout specifically
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                     this.logger.warn(`Processor ${processor.processorId} health check timed out at ${healthEndpoint} (>${config.HEALTH_CHECK_TIMEOUT_MS}ms).`);
                } else {
                     const reason = error.response ? `Status ${status}` : 'Network Error/No Response';
                     this.logger.warn(`Processor ${processor.processorId} health check failed at ${healthEndpoint}. Reason: ${reason}`);
                }
            } else {
                this.logger.warn(`Processor ${processor.processorId} health check failed at ${healthEndpoint} with non-HTTP error: ${error instanceof Error ? error.message : String(error)}`);
            }
            return false;
        }
    }
} 