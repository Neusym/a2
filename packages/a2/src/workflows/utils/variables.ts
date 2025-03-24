import { WorkflowContext } from '../types';

/**
 * Resolves variables in a template string, using ${var} syntax
 */
export function resolveTemplateString(template: string, context: WorkflowContext): string {
  return template.replace(/\${([^}]+)}/g, (match, path) => {
    const value = resolveVariablePath(path.trim(), context);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Resolves a variable from a path in the context
 */
export function resolveVariablePath(path: string, context: WorkflowContext): any {
  // Check if this is a special path
  if (path.startsWith('steps.')) {
    // Extract step ID and possibly property path
    const stepPathParts = path.substring(6).split('.');
    const stepId = stepPathParts[0];

    if (stepPathParts.length === 1) {
      // Just the step result itself
      return context.steps[stepId]?.output;
    }

    // A property within the step result
    const remainingPath = stepPathParts.slice(1).join('.');
    const stepResult = context.steps[stepId]?.output;

    if (stepResult === undefined) {
      return undefined;
    }

    return getNestedProperty(stepResult, remainingPath);
  }

  if (path.startsWith('trigger.')) {
    // Access trigger data
    const triggerPath = path.substring(8);
    return getNestedProperty(context.triggerData, triggerPath);
  }

  if (path.startsWith('variables.')) {
    // Access custom variables
    const variablePath = path.substring(10);
    return getNestedProperty(context.variables, variablePath);
  }

  // Try direct variable lookup
  if (context.variables[path] !== undefined) {
    return context.variables[path];
  }

  // Try direct property lookup on the context
  return getNestedProperty(context, path);
}

/**
 * Gets a nested property from an object using dot notation
 */
function getNestedProperty(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array indices in the path (e.g., items.0.name)
    if (/^\d+$/.test(part) && Array.isArray(current)) {
      current = current[parseInt(part, 10)];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Resolves all variables in an object (recursively)
 */
export function resolveVariables(obj: any, context: WorkflowContext): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveTemplateString(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariables(item, context));
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveVariables(value, context);
    }

    return result;
  }

  return obj;
}
