import fs from 'fs';
import path from 'path';

import {
  Resource,
  ResourceLibrary,
  PromptTemplate,
  PromptLibrary,
  ResourceManager,
  ResourceManagerConfig,
} from './types';

/**
 * Default implementation of the ResourceManager
 */
export class DefaultResourceManager implements ResourceManager {
  private resourceLibrary: ResourceLibrary = {};
  private promptLibrary: PromptLibrary = {};
  private resourceDirectory?: string;

  constructor(config: ResourceManagerConfig = {}) {
    this.resourceLibrary = config.resourceLibrary || {};
    this.promptLibrary = config.promptLibrary || {};
    this.resourceDirectory = config.resourceDirectory;

    // Initialize resource directory if provided
    if (this.resourceDirectory && !fs.existsSync(this.resourceDirectory)) {
      fs.mkdirSync(this.resourceDirectory, { recursive: true });
    }
  }

  getResource(resourceId: string): Resource {
    if (!this.resourceLibrary[resourceId]) {
      throw new Error(`Resource "${resourceId}" not found in library`);
    }

    return this.resourceLibrary[resourceId];
  }

  addResource(resource: Resource): void {
    this.resourceLibrary[resource.id] = resource;
  }

  updateResource(resourceId: string, resource: Partial<Resource>): boolean {
    if (!this.resourceLibrary[resourceId]) {
      return false;
    }

    this.resourceLibrary[resourceId] = {
      ...this.resourceLibrary[resourceId],
      ...resource,
    };

    return true;
  }

  removeResource(resourceId: string): boolean {
    if (!this.resourceLibrary[resourceId]) {
      return false;
    }

    delete this.resourceLibrary[resourceId];
    return true;
  }

  listResources(): string[] {
    return Object.keys(this.resourceLibrary);
  }

  getResourcesByType(type: string): Resource[] {
    return Object.values(this.resourceLibrary).filter((resource) => resource.type === type);
  }

  loadResourceFromFile(
    filePath: string,
    type?: string,
    metadata: Record<string, any> = {},
  ): Resource {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const id = path.basename(filePath);

      const resourceType = type || this.inferTypeFromFile(filePath);

      const resource: Resource = {
        id,
        content,
        type: resourceType,
        metadata: {
          ...metadata,
          filepath: filePath,
          loadedAt: new Date().toISOString(),
        },
      };

      this.addResource(resource);
      return resource;
    } catch (error) {
      throw new Error(`Failed to load resource from file ${filePath}: ${error}`);
    }
  }

  saveResourceToFile(resourceId: string, filePath: string): boolean {
    try {
      const resource = this.getResource(resourceId);
      fs.writeFileSync(filePath, resource.content, 'utf-8');

      // Update resource metadata
      this.updateResource(resourceId, {
        metadata: {
          ...resource.metadata,
          filepath: filePath,
          savedAt: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error(`Failed to save resource to file ${filePath}: ${error}`);
      return false;
    }
  }

  loadResourcesFromDirectory(directoryPath: string, type?: string): Resource[] {
    try {
      const files = fs.readdirSync(directoryPath);
      const resources: Resource[] = [];

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          try {
            const resourceType = type || this.inferTypeFromFile(filePath);
            const resource = this.loadResourceFromFile(filePath, resourceType);
            resources.push(resource);
          } catch (error) {
            console.warn(`Failed to load resource from ${filePath}: ${error}`);
          }
        }
      }

      return resources;
    } catch (error) {
      throw new Error(`Failed to load resources from directory ${directoryPath}: ${error}`);
    }
  }

  exportResourcesToDirectory(resourceIds: string[], directoryPath: string): boolean {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      let success = true;

      for (const resourceId of resourceIds) {
        try {
          const resource = this.getResource(resourceId);
          const filePath = path.join(directoryPath, `${resourceId}`);

          if (!this.saveResourceToFile(resourceId, filePath)) {
            success = false;
          }
        } catch (error) {
          console.error(`Failed to export resource ${resourceId}: ${error}`);
          success = false;
        }
      }

      return success;
    } catch (error) {
      console.error(`Failed to export resources to directory ${directoryPath}: ${error}`);
      return false;
    }
  }

  // Prompt-related methods
  getPrompt(promptName: string): string | PromptTemplate {
    if (!this.promptLibrary[promptName]) {
      throw new Error(`Prompt "${promptName}" not found in library`);
    }

    return this.promptLibrary[promptName];
  }

  renderPrompt(promptName: string, params: Record<string, any> = {}): string {
    const prompt = this.getPrompt(promptName);

    if (typeof prompt === 'string') {
      // Simple template string replacement
      return this.interpolateTemplate(prompt, params);
    } else if (typeof prompt === 'function') {
      // Call the template function
      return prompt(params);
    }

    throw new Error(`Invalid prompt type for "${promptName}"`);
  }

  addPrompt(promptName: string, prompt: string | PromptTemplate): void {
    this.promptLibrary[promptName] = prompt;
  }

  updatePrompt(promptName: string, prompt: string | PromptTemplate): boolean {
    if (!this.promptLibrary[promptName]) {
      return false;
    }

    this.promptLibrary[promptName] = prompt;
    return true;
  }

  removePrompt(promptName: string): boolean {
    if (!this.promptLibrary[promptName]) {
      return false;
    }

    delete this.promptLibrary[promptName];
    return true;
  }

  listPrompts(): string[] {
    return Object.keys(this.promptLibrary);
  }

  composePrompt(promptNames: string[], params: Record<string, any> = {}): string {
    return promptNames.map((name) => this.renderPrompt(name, params)).join('\n\n');
  }

  // Helper methods
  private interpolateTemplate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
    });
  }

  private inferTypeFromFile(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case '.txt':
        return 'text';
      case '.json':
        return 'json';
      case '.md':
        return 'markdown';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.csv':
        return 'csv';
      case '.prompt':
        return 'prompt';
      default:
        return 'unknown';
    }
  }
}
