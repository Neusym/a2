import { ProcessorId, ProcessorMetadata, ProcessorStatus } from '../../common/types';
import { ILogger } from '../../common/utils/logger';
import { handleServiceError } from '../../common/utils/error.handler';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';

// Zod schema for strict validation of data received from the registry
// Make fields optional where appropriate if registry might omit them
const ProcessorMetadataSchemaFromRegistry = z.object({
    processorId: z.string(),
    name: z.string(),
    description: z.string().optional().default(''), // Allow optional/empty
    capabilitiesTags: z.array(z.string()).optional().default([]),
    inputSchema: z.record(z.any()).optional(), // Basic object check
    outputSchema: z.record(z.any()).optional(),
    endpointUrl: z.string().url(),
    status: z.nativeEnum(ProcessorStatus).optional().default(ProcessorStatus.Active),
    ownerAddress: z.string().optional(), // Optional owner address
    // Registry might not provide all fields, make them optional
    registeredAt: z.preprocess((arg) => {
        // Ensure arg is not null or undefined before passing to Date constructor
        if (arg !== null && arg !== undefined && (typeof arg === 'string' || typeof arg === 'number' || arg instanceof Date)) {
            try {
                return new Date(arg);
            } catch (e) {
                // Ignore invalid date values
                return undefined;
            }
        }
        return undefined; // Return undefined if input is null, undefined, or wrong type
    }, z.date().optional()),
    lastCheckedAt: z.preprocess((arg) => {
        if (arg !== null && arg !== undefined && (typeof arg === 'string' || typeof arg === 'number' || arg instanceof Date)) {
            try {
                return new Date(arg);
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    }, z.date().optional()),
    reputationScore: z.number().min(0).max(5).optional(),
    completedTasks: z.number().int().nonnegative().optional(),
    successRate: z.number().min(0).max(1).optional(),
    averageExecutionTimeMs: z.number().int().nonnegative().optional(),
    pricing: z.object({
        model: z.enum(['fixed', 'per_call', 'usage_based']),
        price: z.number().nonnegative().optional(),
        unit: z.string().optional()
    }).optional(),
    // Registry likely won't provide embeddings
    // descriptionEmbedding: z.array(z.number()).optional().nullable(),
}).transform(data => ({ // Ensure defaults match the ProcessorMetadata type exactly, even if optional
    ...data,
    description: data.description ?? '',
    capabilitiesTags: data.capabilitiesTags ?? [],
    status: data.status ?? ProcessorStatus.Active,
    // Provide default Date if missing? Or leave as potentially undefined? Leave undefined.
    // registeredAt: data.registeredAt ?? new Date(0), // Default to epoch if missing?
}));

// Type derived from Zod schema
type ValidatedProcessorMetadata = z.infer<typeof ProcessorMetadataSchemaFromRegistry>;


export interface IProcessorRegistryClient {
    /** Look up processor metadata by ID */
    getProcessorById(processorId: ProcessorId): Promise<ProcessorMetadata | null>;

    /** Find processors based on capabilities (e.g., tags, keywords) */
    findProcessorsByCapabilities(capabilities: string[]): Promise<ProcessorMetadata[]>;
}

export class ProcessorRegistryClient implements IProcessorRegistryClient {
    private readonly logger: ILogger;
    private readonly registryUrl: string | undefined;
    private readonly axiosInstance;
    private readonly isEnabled: boolean;

    constructor(registryUrl: string | undefined, logger: ILogger) {
        this.logger = logger.child({ service: 'ProcessorRegistryClient' });
        this.registryUrl = registryUrl;
        this.isEnabled = !!this.registryUrl;

        if (!this.isEnabled) {
             this.logger.warn('Processor Registry Client initialized without a URL. It will operate in disabled mode.');
             this.axiosInstance = axios.create({ baseURL: 'http://mock-registry-url.invalid' }); // Dummy instance
        } else {
            this.logger.info(`Processor Registry Client configured for URL: ${this.registryUrl}`);
            this.axiosInstance = axios.create({
                baseURL: this.registryUrl,
                timeout: 10000, // 10 second timeout
                headers: { 'Accept': 'application/json' }
            });
        }
    }

    async getProcessorById(processorId: ProcessorId): Promise<ProcessorMetadata | null> {
        if (!this.isEnabled) {
             this.logger.debug(`Processor Registry Client disabled. Cannot fetch processor ${processorId}.`);
             return null;
        }
        this.logger.debug(`Querying external registry for processor ID: ${processorId}`);
        try {
            const response = await this.axiosInstance.get(`/processors/${processorId}`);

            if (response.status === 200 && response.data) {
                const validationResult = ProcessorMetadataSchemaFromRegistry.safeParse(response.data);
                if (validationResult.success) {
                    this.logger.info(`Found and validated processor ${processorId} in external registry.`);
                    // Cast needed because Zod output type might be slightly different if transforms aren't perfect
                    // Add missing fields with defaults if necessary to match ProcessorMetadata type fully
                    const validatedData = validationResult.data;
                    return {
                         ...validatedData,
                         // Explicitly add potentially missing non-optional fields with defaults if needed
                         // Example: registeredAt is optional in schema, but required in ProcessorMetadata
                         registeredAt: validatedData.registeredAt ?? new Date(0), // Default to epoch if registry omits it
                         // descriptionEmbedding is not expected from registry
                         descriptionEmbedding: undefined,
                    } as ProcessorMetadata;
                } else {
                    this.logger.error(`Invalid processor data format from registry for ${processorId}`, { errors: validationResult.error.flatten() });
                    return null;
                }
            }
            this.logger.warn(`Received non-200 status (${response.status}) or no data from registry for ${processorId}.`);
            return null;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                this.logger.debug(`Processor ${processorId} not found in external registry.`);
                return null;
            }
             const msg = error.message || 'Unknown error';
             this.logger.error(`Error querying external processor registry for ID ${processorId}: ${msg}`, { error });
            // Don't throw, return null to indicate not found or error during lookup
            return null;
        }
    }

    async findProcessorsByCapabilities(capabilities: string[]): Promise<ProcessorMetadata[]> {
        if (!this.isEnabled || capabilities.length === 0) {
             this.logger.debug(`Processor Registry Client disabled or no capabilities provided. Skipping search.`);
             return [];
        }
        this.logger.debug(`Querying external registry for capabilities: ${capabilities.join(', ')}`);
        try {
            const response = await this.axiosInstance.get(`/processors`, {
                 params: { capabilities: capabilities.join(',') } // Assuming API supports comma-separated list
             });

             if (response.status === 200 && Array.isArray(response.data)) {
                 const validatedProcessors: ProcessorMetadata[] = [];
                 response.data.forEach(item => {
                     const validationResult = ProcessorMetadataSchemaFromRegistry.safeParse(item);
                     if (validationResult.success) {
                          const validatedData = validationResult.data;
                          validatedProcessors.push({
                               ...validatedData,
                               registeredAt: validatedData.registeredAt ?? new Date(0),
                               descriptionEmbedding: undefined,
                          } as ProcessorMetadata);
                     } else {
                          this.logger.warn('Skipping invalid processor data received from registry query', { processorId: item?.processorId || 'unknown', errors: validationResult.error.flatten() });
                     }
                 });
                 this.logger.info(`Found ${validatedProcessors.length} valid processors in external registry matching capabilities.`);
                 return validatedProcessors;
             }
             this.logger.warn(`Received non-200 status (${response.status}) or non-array data from registry capability query.`);
             return [];
        } catch (error: any) {
             const msg = error.message || 'Unknown error';
             this.logger.error(`Error querying external processor registry by capabilities: ${msg}`, { error });
             return []; // Return empty array on error
        }
    }
} 