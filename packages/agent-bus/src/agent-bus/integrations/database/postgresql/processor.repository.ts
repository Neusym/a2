import { Pool, PoolClient } from 'pg';
import { ProcessorId, ProcessorMetadata, ProcessorStatus } from '../../../common/types';
import { ILogger } from '../../../common/utils/logger';
import { DatabaseError } from '../../../common/utils/error.handler';
import { IProcessorRepository } from '../processor.repository';

export class PostgresProcessorRepository implements IProcessorRepository {
    private readonly logger: ILogger;
    private pool: Pool; // Use standard Pool

    constructor(
        connectionString: string, // Use Neon's connection string directly
        logger: ILogger
    ) {
        this.logger = logger.child({ service: 'PostgresProcessorRepository' });
        try {
            this.pool = new Pool({
                connectionString: connectionString,
                // Neon recommends specific SSL settings for non-Vercel environments
                // ssl: {
                //   rejectUnauthorized: false, // Adjust based on Neon's requirements/your setup
                // },
                // Consider pool size limits in serverless environments
                max: 5, // Example: Limit max connections
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            this.logger.info('PostgreSQL (Neon) Processor Repository pool initialized.');

            this.pool.on('error', (err, client) => {
                this.logger.error('Unexpected error on idle PostgreSQL client', { error: err });
                // Optional: attempt to remove the client from the pool or handle recovery
            });

        } catch (error) {
            this.logger.error('Failed to initialize PostgreSQL pool', { error });
            throw new DatabaseError('Failed to initialize database connection pool', {}, error instanceof Error ? error : undefined);
        }
    }

    // Get a client from the pool for a single operation
    private async getClient(): Promise<PoolClient> {
        try {
            const client = await this.pool.connect();
            return client;
        } catch (error) {
            this.logger.error('Failed to get database client from pool', { error });
            throw new DatabaseError('Failed to acquire database connection', {}, error instanceof Error ? error : undefined);
        }
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing processors schema...');
        const client = await this.getClient();
        try {
            // Note: TEXT PRIMARY KEY might be less performant than UUID or INT depending on scale
            // Ensure vector extension is enabled if storing embeddings here (though Pinecone is used)
            await client.query(`
                CREATE TABLE IF NOT EXISTS processors (
                    processor_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    capabilities_tags TEXT[],
                    input_schema JSONB,
                    output_schema JSONB,
                    endpoint_url TEXT NOT NULL,
                    status TEXT NOT NULL,
                    owner_address TEXT,
                    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_checked_at TIMESTAMPTZ,
                    reputation_score REAL,
                    completed_tasks INTEGER,
                    success_rate REAL,
                    average_execution_time_ms INTEGER,
                    pricing JSONB
                    -- description_embedding vector(1536) -- Example if using pgvector instead of Pinecone
                );
            `);
             // Add indexes for frequently queried columns
             await client.query(`CREATE INDEX IF NOT EXISTS idx_processors_status ON processors (status);`);
             // Use GIN index for array containment checks on tags
             await client.query(`CREATE INDEX IF NOT EXISTS idx_processors_tags ON processors USING GIN (capabilities_tags);`);

            this.logger.info('Processors table schema verified/created.');
        } catch (error) {
            this.logger.error('Failed to initialize processors table', { error });
            throw new DatabaseError('Failed to initialize database schema', {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    async findById(processorId: ProcessorId): Promise<ProcessorMetadata | null> {
        this.logger.debug(`Finding processor by ID: ${processorId}`);
        const client = await this.getClient();
        try {
            const result = await client.query(
                'SELECT * FROM processors WHERE processor_id = $1',
                [processorId]
            );
            return result.rows.length > 0 ? this.mapRowToProcessorMetadata(result.rows[0]) : null;
        } catch (error) {
            this.logger.error(`Error finding processor by ID: ${processorId}`, { error });
            throw new DatabaseError(`Database query failed for findById: ${processorId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    async findManyByCriteria(criteria: Record<string, any>): Promise<ProcessorMetadata[]> {
        this.logger.debug('Finding processors by criteria:', criteria);
        const client = await this.getClient();
        try {
            let query = 'SELECT * FROM processors WHERE 1=1';
            const params: any[] = [];
            let paramIndex = 1;

            if (criteria.status) {
                query += ` AND status = $${paramIndex++}`;
                params.push(criteria.status);
            }

            // Use && operator for array overlap with tags (GIN index compatible)
            if (criteria.tags && criteria.tags.$in && Array.isArray(criteria.tags.$in) && criteria.tags.$in.length > 0) {
                query += ` AND capabilities_tags && $${paramIndex++}::text[]`;
                params.push(criteria.tags.$in);
            }

            // Use = ANY() for matching multiple IDs
            if (criteria.processorId && criteria.processorId.$in && Array.isArray(criteria.processorId.$in) && criteria.processorId.$in.length > 0) {
                query += ` AND processor_id = ANY($${paramIndex++}::text[])`;
                params.push(criteria.processorId.$in);
            }
            // Add more criteria mappings as needed

            this.logger.debug(`Executing query: ${query} with params: ${JSON.stringify(params)}`);
            const result = await client.query(query, params);
            return result.rows.map(row => this.mapRowToProcessorMetadata(row));
        } catch (error) {
            this.logger.error('Error finding processors by criteria', { error, criteria });
            throw new DatabaseError('Database query failed for findManyByCriteria', { criteria }, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    async create(processorData: Omit<ProcessorMetadata, 'registeredAt' | 'lastCheckedAt' | 'descriptionEmbedding'>): Promise<ProcessorMetadata> {
        this.logger.debug(`Creating new processor: ${processorData.processorId}`);
        const client = await this.getClient();
        try {
             // Use INSERT ... ON CONFLICT DO NOTHING to handle potential race conditions or duplicate IDs gracefully
            const query = `
                INSERT INTO processors (
                    processor_id, name, description, capabilities_tags, input_schema,
                    output_schema, endpoint_url, status, owner_address, registered_at,
                    reputation_score, completed_tasks, success_rate, average_execution_time_ms, pricing
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, $13, $14
                )
                ON CONFLICT (processor_id) DO NOTHING
                RETURNING *;
            `;
            const params = [
                processorData.processorId,
                processorData.name,
                processorData.description || null,
                processorData.capabilitiesTags || [],
                processorData.inputSchema || null, // Already JSONB
                processorData.outputSchema || null, // Already JSONB
                processorData.endpointUrl,
                processorData.status || ProcessorStatus.Active,
                processorData.ownerAddress || null,
                // registered_at uses DEFAULT NOW()
                processorData.reputationScore ?? null,
                processorData.completedTasks ?? null,
                processorData.successRate ?? null,
                processorData.averageExecutionTimeMs ?? null,
                processorData.pricing || null, // Already JSONB
            ];

            const result = await client.query(query, params);

             if (result.rows.length === 0) {
                 // This means the processor already existed (due to ON CONFLICT DO NOTHING)
                 this.logger.warn(`Processor with ID ${processorData.processorId} already exists. Fetching existing.`);
                 // Fetch and return the existing one instead of throwing error
                 const existing = await this.findById(processorData.processorId);
                 if (!existing) {
                     // Should not happen if insert failed due to conflict, but handle defensively
                     throw new DatabaseError(`Processor ${processorData.processorId} already exists but could not be fetched.`);
                 }
                 return existing;
             }

            this.logger.info(`Processor ${result.rows[0].processor_id} created successfully.`);
            return this.mapRowToProcessorMetadata(result.rows[0]);
        } catch (error) {
            this.logger.error(`Error creating processor: ${processorData.processorId}`, { error });
            throw new DatabaseError(`Database query failed for create processor: ${processorData.processorId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    async update(processorId: ProcessorId, updates: Partial<Omit<ProcessorMetadata, 'processorId' | 'registeredAt' | 'descriptionEmbedding'>>): Promise<ProcessorMetadata | null> {
        this.logger.debug(`Updating processor: ${processorId}`, { updates });
        if (Object.keys(updates).length === 0) {
            this.logger.warn(`Update called for ${processorId} with no changes.`);
            return this.findById(processorId); // Return current data if no updates
        }
        const client = await this.getClient();
        try {
            // Build dynamic SET clause
            const setClauses: string[] = [];
            const params: any[] = [processorId];
            let paramIndex = 2;

            // Map JS keys to DB columns and prepare params
            for (const [key, value] of Object.entries(updates)) {
                if (value === undefined) continue; // Skip undefined values

                const dbColumn = this.camelToSnakeCase(key);
                // Ensure the column exists in the table to prevent errors
                 const validColumns = ['name', 'description', 'capabilities_tags', 'input_schema', 'output_schema', 'endpoint_url', 'status', 'owner_address', 'last_checked_at', 'reputation_score', 'completed_tasks', 'success_rate', 'average_execution_time_ms', 'pricing'];
                 if (!validColumns.includes(dbColumn)) {
                     this.logger.warn(`Skipping update for unknown column: ${key} (mapped to ${dbColumn})`);
                     continue;
                 }

                setClauses.push(`${dbColumn} = $${paramIndex++}`);
                 // PG client handles JSON/array serialization for JSONB/TEXT[] types
                 params.push(value);
            }

             // Automatically update last_checked_at if status is being updated
             if (updates.status && !updates.lastCheckedAt) {
                 // Add last_checked_at update only if not already present
                 if (!setClauses.some(clause => clause.startsWith('last_checked_at'))) {
                     setClauses.push(`last_checked_at = $${paramIndex++}`);
                     params.push(new Date());
                 }
             }

            if (setClauses.length === 0) {
                 this.logger.warn(`No valid fields to update for processor ${processorId}.`);
                 return this.findById(processorId);
            }

            const query = `
                UPDATE processors
                SET ${setClauses.join(', ')}
                WHERE processor_id = $1
                RETURNING *;
            `;

            this.logger.debug(`Executing update query: ${query} with params: ${JSON.stringify(params)}`);
            const result = await client.query(query, params);

            if (result.rows.length === 0) {
                this.logger.warn(`Processor not found for update: ${processorId}`);
                return null;
            }

            this.logger.info(`Processor ${processorId} updated successfully.`);
            return this.mapRowToProcessorMetadata(result.rows[0]);
        } catch (error) {
            this.logger.error(`Error updating processor: ${processorId}`, { error, updates });
            throw new DatabaseError(`Database query failed for update processor: ${processorId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    async updateProcessorStatus(processorId: ProcessorId, status: ProcessorStatus, lastCheckedAt: Date): Promise<boolean> {
        this.logger.debug(`Updating status for processor ${processorId} to ${status}`);
        const client = await this.getClient();
        try {
            const result = await client.query(
                'UPDATE processors SET status = $1, last_checked_at = $2 WHERE processor_id = $3',
                [status, lastCheckedAt, processorId]
            );
            const success = result.rowCount !== null && result.rowCount > 0;
            if (!success) {
                this.logger.warn(`Processor ${processorId} not found or status unchanged.`);
            }
            return success;
        } catch (error) {
            this.logger.error(`Error updating status for processor: ${processorId}`, { error });
            throw new DatabaseError(`Database query failed for updateProcessorStatus: ${processorId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // No updateEmbedding method needed here as embeddings are in Pinecone

    async getAllActive(limit: number = 50, offset: number = 0): Promise<ProcessorMetadata[]> {
        this.logger.debug(`Getting active processors (limit: ${limit}, offset: ${offset})`);
        const client = await this.getClient();
        try {
            const query = 'SELECT * FROM processors WHERE status = $1 ORDER BY registered_at DESC LIMIT $2 OFFSET $3';
            const params = [ProcessorStatus.Active, limit, offset];
            const result = await client.query(query, params);
            return result.rows.map(row => this.mapRowToProcessorMetadata(row));
        } catch (error) {
            this.logger.error('Error getting active processors', { error });
            throw new DatabaseError('Database query failed for getAllActive', {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // --- Helper Methods ---

    private mapRowToProcessorMetadata(row: Record<string, any>): ProcessorMetadata {
        // No descriptionEmbedding mapping needed here
        return {
            processorId: row.processor_id,
            name: row.name,
            description: row.description || '', // Ensure description is string
            capabilitiesTags: row.capabilities_tags || [],
            inputSchema: row.input_schema, // Already parsed JSONB
            outputSchema: row.output_schema, // Already parsed JSONB
            endpointUrl: row.endpoint_url,
            status: row.status as ProcessorStatus,
            ownerAddress: row.owner_address,
            registeredAt: row.registered_at, // TIMESTAMPTZ is parsed as Date by pg driver
            lastCheckedAt: row.last_checked_at,
            reputationScore: row.reputation_score,
            completedTasks: row.completed_tasks,
            successRate: row.success_rate,
            averageExecutionTimeMs: row.average_execution_time_ms,
            pricing: row.pricing, // Already parsed JSONB
        };
    }

    private camelToSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    // Close the pool when the application shuts down
    async close(): Promise<void> {
        this.logger.info('Closing PostgreSQL connection pool...');
        await this.pool.end();
        this.logger.info('PostgreSQL connection pool closed.');
    }
} 