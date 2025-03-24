import { z } from 'zod';

/**
 * Options for creating a resource
 */
export interface CreateResourceOptions {
  /**
   * Unique identifier for the resource
   */
  id: string;
  
  /**
   * Name of the resource
   */
  name: string;
  
  /**
   * Description of what the resource contains
   */
  description: string;
  
  /**
   * Schema for validating resource data
   */
  schema: z.ZodType<any>;
  
  /**
   * Initial data for the resource
   */
  data?: any;
}

/**
 * Simple Resource implementation compatible with a2/core
 */
export interface SimpleResource {
  id: string;
  name: string;
  description: string;
  schema: z.ZodType<any>;
  data: any;
  
  /**
   * Get the current data
   */
  getData(): any;
  
  /**
   * Set resource data
   */
  setData(data: any): void;
  
  /**
   * Validate data against the schema
   */
  validate(data: any): boolean;
}

/**
 * Create a resource with simplified options
 * 
 * @example
 * ```typescript
 * const userResource = createResource({
 *   id: 'users',
 *   name: 'Users',
 *   description: 'Collection of user information',
 *   schema: z.array(z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string().email()
 *   })),
 *   data: [
 *     { id: '1', name: 'John Doe', email: 'john@example.com' }
 *   ]
 * });
 * ```
 * 
 * @param options Options for creating the resource
 * @returns A new Resource instance
 */
export function createResource(options: CreateResourceOptions): SimpleResource {
  const { id, name, description, schema, data: initialData } = options;
  
  let currentData = initialData !== undefined ? initialData : null;
  
  // Return a simple resource implementation
  return {
    id,
    name,
    description,
    schema,
    get data() {
      return currentData;
    },
    getData() {
      return currentData;
    },
    setData(data: any) {
      // Validate data before setting
      try {
        schema.parse(data);
        currentData = data;
      } catch (error) {
        throw new Error(`Invalid data for resource ${id}: ${error}`);
      }
    },
    validate(data: any) {
      try {
        schema.parse(data);
        return true;
      } catch (error) {
        return false;
      }
    }
  };
}

/**
 * Simple resource manager implementation
 */
export interface SimpleResourceManager {
  resources: Map<string, SimpleResource>;
  
  /**
   * Register a resource with the manager
   */
  register(resource: SimpleResource): void;
  
  /**
   * Get a resource by ID
   */
  getResource(id: string): SimpleResource | undefined;
  
  /**
   * Get all registered resources
   */
  getAllResources(): SimpleResource[];
}

/**
 * Options for creating a resource manager
 */
export interface CreateResourceManagerOptions {
  /**
   * Initial resources to include
   */
  resources?: SimpleResource[];
}

/**
 * Create a resource manager with the given resources
 * 
 * @param options Options for creating the resource manager
 * @returns A new ResourceManager instance
 */
export function createResourceManager(options: CreateResourceManagerOptions = {}): SimpleResourceManager {
  const { resources = [] } = options;
  
  const resourceMap = new Map<string, SimpleResource>();
  
  // Register initial resources
  resources.forEach(resource => {
    resourceMap.set(resource.id, resource);
  });
  
  // Return a simple manager implementation
  return {
    resources: resourceMap,
    register(resource: SimpleResource) {
      resourceMap.set(resource.id, resource);
    },
    getResource(id: string) {
      return resourceMap.get(id);
    },
    getAllResources() {
      return Array.from(resourceMap.values());
    }
  };
}

/**
 * Create a set of resources and a manager to manage them
 * 
 * @param resourceOptions Array of options for creating resources
 * @returns A resource manager with the created resources
 */
export function createResourceSet(resourceOptions: CreateResourceOptions[]): SimpleResourceManager {
  // Create resources
  const resources = resourceOptions.map(options => createResource(options));
  
  // Create resource manager with the resources
  return createResourceManager({ resources });
} 