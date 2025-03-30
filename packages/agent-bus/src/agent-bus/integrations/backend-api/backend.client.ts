import axios, { AxiosError, AxiosResponse } from 'axios';
import {
    TaskCreationPayload,
    TaskId,
    CandidateSubmissionPayload,
    TaskStatus,
    TaskDetails // If backend provides task details
} from '../../common/types';
import { ILogger } from '../../common/utils/logger';
import { config } from '../../config';
import { handleServiceError, AgentBusError } from '../../common/utils/error.handler';
// Removed IStorageClient import - not needed here

// Define expected response shapes from the backend API

// Interface for Backend API interactions related to tasks
// This client might interact with a separate backend service that handles
// blockchain interactions, user management, etc.
export interface IBackendClient {
    /** Calls backend endpoint to register the task (potentially triggering contract call) */
    createTaskOnContract(payload: TaskCreationPayload): Promise<{ taskId: TaskId | null; success: boolean; error?: string }>;

    /** Calls backend endpoint to submit candidates/workflow URI for a task */
    updateTaskCandidates(payload: CandidateSubmissionPayload): Promise<boolean>;

     /** Calls backend endpoint to update task status */
     updateTaskStatus(taskId: TaskId, status: TaskStatus, errorMessage?: string): Promise<boolean>;

     /** Fetches task details from the backend (if needed) */
     getTaskDetailsFromBackend(taskId: TaskId): Promise<TaskDetails | null>; // Using TaskDetails from Neon structure
}

export class BackendClient implements IBackendClient {
    private readonly logger: ILogger;
    private readonly axiosInstance;
    private readonly isEnabled: boolean;

    constructor(
        logger: ILogger,
    ) {
        this.logger = logger.child({ service: 'BackendClient' });
        this.isEnabled = !!config.BACKEND_API_URL; // Check if URL is configured

        if (!this.isEnabled) {
            this.logger.warn('BACKEND_API_URL not configured. BackendClient will operate in mock/disabled mode.');
            // Create a dummy axios instance to avoid errors, but it won't make real calls
            this.axiosInstance = axios.create({ baseURL: 'http://mock-backend-url.invalid' });
        } else {
             this.axiosInstance = axios.create({
                 baseURL: config.BACKEND_API_URL,
                 timeout: 15000, // 15 seconds timeout
                 headers: {
                     'Content-Type': 'application/json',
                     'Accept': 'application/json',
                     ...(config.BACKEND_API_KEY && { 'Authorization': `Bearer ${config.BACKEND_API_KEY}` }),
                 },
             });
             this.logger.info(`Backend API client configured for URL: ${config.BACKEND_API_URL}`);
        }
    }

    // Removed prepareTaskCreationPayload - Storage is handled by StorageClient before calling this

    async createTaskOnContract(payload: TaskCreationPayload): Promise<{ taskId: TaskId | null; success: boolean; error?: string }> {
        if (!this.isEnabled) {
             this.logger.warn('BackendClient disabled. Simulating successful task creation.');
             // Simulate success in disabled mode, return a mock TaskId
             const mockTaskId = `mock_task_${generateSimpleId()}`;
             return { taskId: mockTaskId, success: true };
        }

        this.logger.info(`Calling backend POST /tasks to create task. Requester: ${payload.requester}, Spec URI: ${payload.specificationUri}`);
        try {
            // Define expected response structure (adjust based on actual backend)
            const response: AxiosResponse<{ taskId: string; message?: string; /* other fields */ }> = await this.axiosInstance.post('/tasks', payload);

            if ((response.status === 201 || response.status === 200) && response.data?.taskId) {
                this.logger.info(`Backend successfully initiated task creation. TaskID: ${response.data.taskId}`);
                return { taskId: response.data.taskId, success: true };
            } else {
                 const errorMsg = `Backend returned unexpected status ${response.status} or missing taskId for task creation.`;
                 this.logger.error(errorMsg, { status: response.status, data: response.data });
                 return { taskId: null, success: false, error: `Backend error: ${errorMsg} Data: ${JSON.stringify(response.data)}` };
            }
        } catch (error) {
            const errorMessage = this.formatAxiosError(error, 'create task');
            this.logger.error(`Backend task creation failed: ${errorMessage}`, { payload });
            return { taskId: null, success: false, error: errorMessage };
        }
    }

    async updateTaskCandidates(payload: CandidateSubmissionPayload): Promise<boolean> {
         if (!this.isEnabled) {
             this.logger.warn(`BackendClient disabled. Simulating successful candidate update for task ${payload.taskId}.`);
             return true; // Simulate success
         }

         this.logger.info(`Calling backend PUT /tasks/${payload.taskId}/candidates to submit candidates/workflow URI.`);
         try {
             const response = await this.axiosInstance.put(`/tasks/${payload.taskId}/candidates`, payload);

             // Accept 200 OK or 204 No Content as success
             if (response.status === 200 || response.status === 204) {
                 this.logger.info(`Backend successfully updated candidates/workflow for task ${payload.taskId}`);
                 return true;
             } else {
                  this.logger.error(`Backend failed to update candidates for task ${payload.taskId}: Status ${response.status}`, { data: response.data });
                  return false;
             }
         } catch (error) {
             const errorMessage = this.formatAxiosError(error, 'update candidates');
             this.logger.error(`Backend candidate update failed for task ${payload.taskId}: ${errorMessage}`);
             return false;
         }
    }

    async updateTaskStatus(taskId: TaskId, status: TaskStatus, errorMessage?: string): Promise<boolean> {
        if (!this.isEnabled) {
            this.logger.warn(`BackendClient disabled. Simulating successful status update for task ${taskId} to ${status}.`);
            return true; // Simulate success
        }

        this.logger.info(`Calling backend PATCH /tasks/${taskId}/status to update status to ${status}`);
        try {
            const payload = { status, ...(errorMessage && { error: errorMessage }) };
            const response = await this.axiosInstance.patch(`/tasks/${taskId}/status`, payload);

             // Accept 200 OK or 204 No Content as success
             if (response.status === 200 || response.status === 204) {
                 this.logger.info(`Backend successfully updated status for task ${taskId} to ${status}`);
                 return true;
             } else {
                  this.logger.error(`Backend failed to update status for task ${taskId}: Status ${response.status}`, { data: response.data });
                  return false;
             }
        } catch (error) {
            const errorMessage = this.formatAxiosError(error, 'update status');
            this.logger.error(`Backend status update failed for task ${taskId}: ${errorMessage}`);
            return false;
        }
    }

     async getTaskDetailsFromBackend(taskId: TaskId): Promise<TaskDetails | null> {
         if (!this.isEnabled) {
             this.logger.warn(`BackendClient disabled. Cannot fetch task details for ${taskId}.`);
             return null;
         }

         this.logger.debug(`Calling backend GET /tasks/${taskId} to fetch task details.`);
         try {
             const response: AxiosResponse<TaskDetails> = await this.axiosInstance.get(`/tasks/${taskId}`);

             if (response.status === 200 && response.data) {
                 // TODO: Add Zod validation to ensure response matches TaskDetails
                 this.logger.debug(`Successfully fetched task details for ${taskId} from backend.`);
                 // Convert date strings to Date objects if necessary (Axios might do this automatically)
                 response.data.createdAt = new Date(response.data.createdAt);
                 response.data.updatedAt = new Date(response.data.updatedAt);
                 return response.data;
             } else {
                 this.logger.warn(`Backend returned unexpected status or data fetching task ${taskId}: ${response.status}`);
                 return null;
             }
         } catch (error) {
             if (axios.isAxiosError(error) && error.response?.status === 404) {
                this.logger.debug(`Task ${taskId} not found in backend.`);
                return null;
             }
             const errorMessage = this.formatAxiosError(error, 'get task details');
             this.logger.error(`Backend fetch task details failed for task ${taskId}: ${errorMessage}`);
             return null; // Return null on error
         }
     }

    // Helper to format Axios errors for logging
    private formatAxiosError(error: unknown, operation: string): string {
         if (axios.isAxiosError(error)) {
             const axiosError = error as AxiosError;
             const status = axiosError.response?.status || 'N/A';
             const method = axiosError.config?.method?.toUpperCase() || 'N/A';
             const url = axiosError.config?.url || 'N/A';
             let responseDetail = 'No response data';
             if (axiosError.response?.data) {
                try {
                    // Limit logged response size
                    const responseString = JSON.stringify(axiosError.response.data);
                    responseDetail = responseString.length > 500 ? responseString.substring(0, 500) + '...' : responseString;
                } catch {
                    responseDetail = String(axiosError.response.data);
                }
             }
             return `Backend API error during '${operation}' (${method} ${url}): Status ${status} - Response: ${responseDetail} - Message: ${axiosError.message}`;
         }
         // Handle non-Axios errors
         return `Backend API error during '${operation}': ${error instanceof Error ? error.message : String(error)}`;
    }
}

// Helper needed if BackendClient is disabled
function generateSimpleId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
} 