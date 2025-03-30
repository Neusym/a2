import { Pool, PoolClient } from 'pg';
import { TaskId, TaskStatus, TaskDetails, WorkflowPlan, TaskSpecification } from '../../../common/types';
import { ProcessorId } from '../../../common/types';
import { ITaskRepository } from '../task.repository';
import { ILogger } from '../../../common/utils/logger';
import { DatabaseError } from '../../../common/utils/error.handler';

// This repository manages the core, persistent Task data in Neon DB.
// It references specifications/workflows stored in Vercel Blob via URIs.
export class PostgresTaskRepository implements ITaskRepository {
    private readonly logger: ILogger;
    private pool: Pool;

    constructor(
        connectionString: string, // Neon connection string
        logger: ILogger
    ) {
        this.logger = logger.child({ service: 'PostgresTaskRepository' });
         try {
            this.pool = new Pool({
                connectionString: connectionString,
                // ssl: { rejectUnauthorized: false }, // Adjust based on Neon/env
                 max: 5,
                 idleTimeoutMillis: 30000,
                 connectionTimeoutMillis: 2000,
            });
            this.logger.info('PostgreSQL (Neon) Task Repository pool initialized.');

            this.pool.on('error', (err, client) => {
                this.logger.error('Unexpected error on idle PostgreSQL client', { error: err });
            });

        } catch (error) {
            this.logger.error('Failed to initialize PostgreSQL pool', { error });
            throw new DatabaseError('Failed to initialize database connection pool', {}, error instanceof Error ? error : undefined);
        }
    }

     // Get a client from the pool
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
        this.logger.info('Initializing tasks schema...');
        const client = await this.getClient();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    requester_id TEXT NOT NULL,
                    specification_uri TEXT NOT NULL, -- Vercel Blob URL
                    status TEXT NOT NULL,
                    assigned_processor_id TEXT,
                    workflow_plan_uri TEXT,      -- Vercel Blob URL
                    result_uri TEXT,             -- Vercel Blob URL
                    error TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            `);
             // Add indexes
             await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);`);
             await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_requester_id ON tasks (requester_id);`);
             await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_processor_id ON tasks (assigned_processor_id);`);

            // Function to automatically update updated_at timestamp
            await client.query(`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                   NEW.updated_at = NOW();
                   RETURN NEW;
                END;
                $$ language 'plpgsql';
            `);

            // Trigger to call the function before any update
            await client.query(`
                DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks; -- Drop existing trigger first
                CREATE TRIGGER update_tasks_updated_at
                BEFORE UPDATE ON tasks
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            `);


            this.logger.info('Tasks table schema verified/created.');
        } catch (error) {
            this.logger.error('Failed to initialize tasks table', { error });
            throw new DatabaseError('Failed to initialize database schema', {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // This method is now primarily used by the BackendClient after creating the task record
    // The Agent Bus services might fetch using this, but creation is externalized.
    async getTaskById(taskId: TaskId): Promise<TaskDetails | null> {
        this.logger.debug(`Getting task details for TaskID: ${taskId}`);
        const client = await this.getClient();
        try {
            const result = await client.query(
                'SELECT * FROM tasks WHERE task_id = $1',
                [taskId]
            );
            return result.rows.length > 0 ? this.mapRowToTaskDetails(result.rows[0]) : null;
        } catch (error) {
            this.logger.error(`Error getting task by ID: ${taskId}`, { error });
            throw new DatabaseError(`Database query failed for getTaskById: ${taskId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // This method is likely called by the BackendClient or a dedicated task update service
    async updateTaskStatus(taskId: TaskId, status: TaskStatus, error?: string): Promise<boolean> {
        this.logger.debug(`Updating status for TaskID ${taskId} to ${status}`);
        const client = await this.getClient();
        try {
             // updated_at is handled by the trigger
            const query = `
                UPDATE tasks
                SET status = $1, error = $2
                WHERE task_id = $3;
            `;
            const params = [status, error || null, taskId];
            const result = await client.query(query, params);
            const success = result.rowCount !== null && result.rowCount > 0;
            if (!success) {
                this.logger.warn(`Task ${taskId} not found or status unchanged during update.`);
            }
            return success;
        } catch (error) {
            this.logger.error(`Error updating task status: ${taskId}`, { error });
            throw new DatabaseError(`Database query failed for updateTaskStatus: ${taskId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // Called by MatchingService or BackendClient after confirmation
    async assignProcessor(taskId: TaskId, processorId: ProcessorId): Promise<boolean> {
        this.logger.debug(`Assigning processor ${processorId} to task ${taskId}`);
        const client = await this.getClient();
        try {
             // updated_at is handled by the trigger
            const result = await client.query(
                'UPDATE tasks SET assigned_processor_id = $1 WHERE task_id = $2',
                [processorId, taskId]
            );
             const success = result.rowCount !== null && result.rowCount > 0;
             if (!success) {
                 this.logger.warn(`Task ${taskId} not found during processor assignment.`);
             }
             return success;
        } catch (error) {
            this.logger.error(`Error assigning processor to task: ${taskId}`, { error });
            throw new DatabaseError(`Database query failed for assignProcessor: ${taskId}`, {}, error instanceof Error ? error : undefined);
        } finally {
            client.release();
        }
    }

    // Called by MatchingService or BackendClient after confirmation
    async assignWorkflowUri(taskId: TaskId, workflowPlanUri: string): Promise<boolean> {
        this.logger.debug(`Assigning workflow URI ${workflowPlanUri} to task ${taskId}`);
        const client = await this.getClient();
        try {
             // updated_at is handled by the trigger
             const result = await client.query(
                 'UPDATE tasks SET workflow_plan_uri = $1 WHERE task_id = $2',
                 [workflowPlanUri, taskId]
             );
              const success = result.rowCount !== null && result.rowCount > 0;
              if (!success) {
                  this.logger.warn(`Task ${taskId} not found during workflow URI assignment.`);
              }
              return success;
        } catch (error) {
             this.logger.error(`Error assigning workflow URI to task: ${taskId}`, { error });
             throw new DatabaseError(`Database query failed for assignWorkflowUri: ${taskId}`, {}, error instanceof Error ? error : undefined);
        } finally {
             client.release();
        }
    }

     // Method to create a task - likely called by BackendClient logic, not directly by AgentBus
     async createTask(taskId: TaskId, requesterId: string, specificationUri: string): Promise<TaskDetails | null> {
         this.logger.info(`Creating task record: ${taskId}`);
         const client = await this.getClient();
         try {
             const query = `
                 INSERT INTO tasks (task_id, requester_id, specification_uri, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW())
                 RETURNING *;
             `;
             const params = [taskId, requesterId, specificationUri, TaskStatus.PendingMatch]; // Initial status
             const result = await client.query(query, params);

             if (result.rows.length === 0) {
                 this.logger.error(`Failed to create task record ${taskId}, INSERT RETURNING yielded no rows.`);
                 return null;
             }
             this.logger.info(`Task record ${taskId} created successfully.`);
             return this.mapRowToTaskDetails(result.rows[0]);

         } catch (error) {
             this.logger.error(`Error creating task record: ${taskId}`, { error });
             // Check for duplicate key violation
             if (error instanceof Error && (error as any).code === '23505') { // PostgreSQL unique violation code
                 throw new DatabaseError(`Task with ID ${taskId} already exists.`, { taskId }, error);
             }
             throw new DatabaseError(`Database query failed for createTask: ${taskId}`, {}, error instanceof Error ? error : undefined);
         } finally {
             client.release();
         }
     }


    // Helper method to convert database row to TaskDetails
    private mapRowToTaskDetails(row: Record<string, any>): TaskDetails {
        return {
            taskId: row.task_id,
            requesterId: row.requester_id,
            specificationUri: row.specification_uri,
            status: row.status as TaskStatus,
            assignedProcessorId: row.assigned_processor_id,
            workflowPlanUri: row.workflow_plan_uri,
            resultUri: row.result_uri,
            error: row.error,
            createdAt: row.created_at, // Already Date object
            updatedAt: row.updated_at, // Already Date object
        };
    }

    // Close the pool
    async close(): Promise<void> {
        this.logger.info('Closing PostgreSQL connection pool...');
        await this.pool.end();
        this.logger.info('PostgreSQL connection pool closed.');
    }
} 