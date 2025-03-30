import {
    ProcessorId,
    ProcessorMetadata,
    ProcessorStatus
} from '../../common/types';

// Interface for database operations related to processors
export interface IProcessorRepository {
    /** Initialize the database schema if necessary */
    initialize(): Promise<void>;

    /** 
     * Find a processor by its unique ID 
     * @param processorId The unique identifier of the processor
     * @returns The processor metadata or null if not found
     */
    findById(processorId: ProcessorId): Promise<ProcessorMetadata | null>;

    /**
     * Find processors matching specific criteria
     * @param criteria Filter criteria to match processors against
     * @returns Array of matching processor metadata
     */
    findManyByCriteria(criteria: Record<string, any>): Promise<ProcessorMetadata[]>;

    /**
     * Create a new processor record
     * @param processorData The processor data to create
     * @returns The created processor metadata
     */
    create(processorData: Omit<ProcessorMetadata, 'registeredAt' | 'lastCheckedAt' | 'descriptionEmbedding'>): Promise<ProcessorMetadata>;

    /**
     * Update an existing processor
     * @param processorId The processor to update
     * @param updates The fields to update
     * @returns The updated processor metadata or null if not found
     */
    update(processorId: ProcessorId, updates: Partial<Omit<ProcessorMetadata, 'processorId' | 'registeredAt' | 'descriptionEmbedding'>>): Promise<ProcessorMetadata | null>;

    /**
     * Updates a processor's status and last checked timestamp
     * @param processorId The processor to update
     * @param status The new status
     * @param lastCheckedAt The timestamp of the health check
     * @returns Whether the update was successful
     */
    updateProcessorStatus(
        processorId: ProcessorId,
        status: ProcessorStatus,
        lastCheckedAt: Date
    ): Promise<boolean>;

    /**
     * Gets all active processors, with optional pagination
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     * @returns Array of active processor metadata
     */
    getAllActive(limit?: number, offset?: number): Promise<ProcessorMetadata[]>;

    /** Close database connections */
    close(): Promise<void>;
} 