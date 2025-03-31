import { put, del, head, list, PutCommandOptions, PutBlobResult, HeadBlobResult, ListBlobResult } from '@vercel/blob';
import { ILogger } from '../../common/utils/logger';
import { config } from '../../config';
import { StorageError, ConfigurationError } from '../../common/utils/error.handler';
import axios from 'axios'; // Import axios for fetching JSON

// Interface for storage operations
export interface IStorageClient {
    /** Stores JSON data and returns the public URL */
    storeJson(pathname: string, data: any, options?: PutCommandOptions): Promise<string>;

    /** Stores raw data (string or buffer) and returns the public URL */
    storeRaw(pathname: string, data: string | Buffer | Blob | ReadableStream | File, options?: PutCommandOptions): Promise<string>;

    /** Retrieves JSON data from a stored blob URL */
    getJson<T = any>(url: string): Promise<T | null>;

    /** Retrieves metadata for a stored blob */
    getMetadata(url: string): Promise<HeadBlobResult | null>;

    /** Deletes blobs by URL */
    delete(...urls: string[]): Promise<void>;

    /** Lists blobs (use with caution, potentially large results) */
    listBlobs(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<ListBlobResult>;
}

export class VercelBlobStorageClient implements IStorageClient {
    private readonly logger: ILogger;
    private readonly defaultOptions: PutCommandOptions;

    constructor(logger: ILogger) {
        this.logger = logger.child({ service: 'VercelBlobStorageClient' });

        if (!config.BLOB_READ_WRITE_TOKEN) {
            throw new ConfigurationError('Missing Vercel Blob read/write token (BLOB_READ_WRITE_TOKEN)');
        }

        // Set default options, including the token via environment variable (Vercel does this automatically)
        this.defaultOptions = {
            access: 'public', // Blobs need to be publicly accessible via URL
             // token: config.BLOB_READ_WRITE_TOKEN // Token is usually read from env by the SDK
        };
        this.logger.info('Vercel Blob storage client configured.');
    }

    async storeJson(pathname: string, data: any, options?: PutCommandOptions): Promise<string> {
        const cleanPathname = pathname.startsWith('/') ? pathname.substring(1) : pathname; // Ensure pathname doesn't start with /
        this.logger.debug(`Storing JSON data to Vercel Blob at path: ${cleanPathname}`);
        try {
            const jsonData = JSON.stringify(data);
            const blobResult = await put(cleanPathname, jsonData, {
                ...this.defaultOptions,
                contentType: 'application/json', // Set correct content type
                addRandomSuffix: false, // Usually false for predictable JSON paths
                ...options,
            });
            this.logger.info(`JSON data stored successfully. URL: ${blobResult.url}`);
            return blobResult.url;
        } catch (error) {
            this.logger.error(`Failed to store JSON data to Vercel Blob at ${cleanPathname}`, { error });
            throw new StorageError(`Failed to store JSON: ${error instanceof Error ? error.message : String(error)}`, { pathname: cleanPathname }, error instanceof Error ? error : undefined);
        }
    }

    async storeRaw(pathname: string, data: string | Buffer | Blob | ReadableStream | File, options?: PutCommandOptions): Promise<string> {
        const cleanPathname = pathname.startsWith('/') ? pathname.substring(1) : pathname;
        this.logger.debug(`Storing raw data to Vercel Blob at path: ${cleanPathname}`);
        try {
            const blobResult = await put(cleanPathname, data, {
                ...this.defaultOptions,
                addRandomSuffix: true, // Often true for raw files to avoid name clashes
                ...options,
            });
            this.logger.info(`Raw data stored successfully. URL: ${blobResult.url}`);
            return blobResult.url;
        } catch (error) {
            this.logger.error(`Failed to store raw data to Vercel Blob at ${cleanPathname}`, { error });
            throw new StorageError(`Failed to store raw data: ${error instanceof Error ? error.message : String(error)}`, { pathname: cleanPathname }, error instanceof Error ? error : undefined);
        }
    }

    async getJson<T = any>(url: string): Promise<T | null> {
        this.logger.debug(`Getting JSON from Vercel Blob URL: ${url}`);
        try {
            // Fetch the content using axios (or native fetch)
            const response = await axios.get(url, {
                responseType: 'json',
                // Optional: Add timeout
                timeout: 10000, // 10 seconds
            });

            if (response.status === 200 && response.data) {
                // TODO: Add Zod validation here if possible/needed
                return response.data as T;
            } else {
                 this.logger.warn(`Received non-200 status (${response.status}) or no data when fetching JSON from ${url}.`);
                 return null;
            }
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                 if (error.response?.status === 404) {
                     this.logger.warn(`Blob not found at URL: ${url}`);
                     return null;
                 }
                 const status = error.response?.status || 'N/A';
                 this.logger.error(`Failed to fetch JSON from ${url}: Axios error status ${status}`, { error: error.message });
                 throw new StorageError(`Failed to fetch JSON: Status ${status}`, { url }, error);
            } else {
                 this.logger.error(`Failed to fetch or parse JSON from URL ${url}`, { error });
                 throw new StorageError(`Failed to fetch/parse JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`, { url }, error instanceof Error ? error : undefined);
            }
        }
    }


    async getMetadata(url: string): Promise<HeadBlobResult | null> {
        this.logger.debug(`Getting metadata for Vercel Blob URL: ${url}`);
        try {
            const metadata = await head(url, {
                 // token: config.BLOB_READ_WRITE_TOKEN // Token might be needed for head operation too
            });
            return metadata;
        } catch (error: any) {
             // head throws error if not found (e.g., 404)
             // Check error structure from @vercel/blob documentation/source if needed
             if (error && error.status === 404) {
                 this.logger.warn(`Blob not found via head request for URL: ${url}`);
                 return null;
             }
             this.logger.error(`Failed to get metadata for Vercel Blob URL ${url}`, { status: error?.status, error });
             throw new StorageError(`Failed to get metadata: ${error.message || String(error)}`, { url }, error);
        }
    }

    async delete(...urls: string[]): Promise<void> {
        if (urls.length === 0) return;
        this.logger.debug(`Deleting ${urls.length} blobs from Vercel Blob.`);
        try {
            await del(urls, {
                 // token: config.BLOB_READ_WRITE_TOKEN // Token definitely needed for delete
            });
            this.logger.info(`Successfully submitted deletion request for ${urls.length} blobs.`);
        } catch (error) {
            this.logger.error(`Failed to delete blobs from Vercel Blob`, { urls, error });
            throw new StorageError(`Failed to delete blobs: ${error instanceof Error ? error.message : String(error)}`, { urls }, error instanceof Error ? error : undefined);
        }
    }

    async listBlobs(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<ListBlobResult> {
        this.logger.debug(`Listing blobs with options: ${JSON.stringify(options)}`);
        try {
            const result = await list({
                 ...options,
                 // token: config.BLOB_READ_WRITE_TOKEN // Token needed for list
            });
            return result;
        } catch (error) {
             this.logger.error(`Failed to list blobs`, { options, error });
            throw new StorageError(`Failed to list blobs: ${error instanceof Error ? error.message : String(error)}`, { options }, error instanceof Error ? error : undefined);
        }
    }
} 