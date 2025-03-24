import {
  ConditionSpec,
  SimplePredicate,
  LogicalGroup,
  ConditionFn,
  WorkflowContext,
} from '../types';

/**
 * Evaluates a condition against a workflow context
 */
export async function evaluateCondition(
  condition: ConditionSpec,
  context: WorkflowContext,
): Promise<boolean> {
  // If it's a function, call it with the context
  if (typeof condition === 'function') {
    return await condition(context);
  }

  // If it's a simple predicate
  if ('path' in condition) {
    return evaluatePredicate(condition, context);
  }

  // If it's a logical group
  if ('operator' in condition && 'conditions' in condition) {
    return evaluateLogicalGroup(condition, context);
  }

  throw new Error(`Unknown condition type: ${JSON.stringify(condition)}`);
}

/**
 * Evaluates a simple predicate against a context
 */
function evaluatePredicate(predicate: SimplePredicate, context: WorkflowContext): boolean {
  const { path, operator, value } = predicate;

  // Get the actual value from the context using the path
  const actualValue = getValueFromPath(path, context);

  // Compare based on the operator
  switch (operator) {
    case '==':
      return actualValue == value;
    case '!=':
      return actualValue != value;
    case '>':
      return actualValue > value;
    case '>=':
      return actualValue >= value;
    case '<':
      return actualValue < value;
    case '<=':
      return actualValue <= value;
    case 'contains':
      if (typeof actualValue === 'string') {
        return actualValue.includes(String(value));
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(value);
      }
      return false;
    case 'startsWith':
      return typeof actualValue === 'string' && actualValue.startsWith(String(value));
    case 'endsWith':
      return typeof actualValue === 'string' && actualValue.endsWith(String(value));
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Evaluates a logical group against a context
 */
async function evaluateLogicalGroup(
  group: LogicalGroup,
  context: WorkflowContext,
): Promise<boolean> {
  const { operator, conditions } = group;

  if (conditions.length === 0) {
    return operator === 'and'; // Empty AND is true, empty OR is false
  }

  if (operator === 'and') {
    // For AND, all conditions must be true
    for (const condition of conditions) {
      if (!(await evaluateCondition(condition, context))) {
        return false;
      }
    }
    return true;
  } else if (operator === 'or') {
    // For OR, at least one condition must be true
    for (const condition of conditions) {
      if (await evaluateCondition(condition, context)) {
        return true;
      }
    }
    return false;
  }

  throw new Error(`Unknown logical operator: ${operator}`);
}

/**
 * Gets a value from a dot-notation path in an object
 */
function getValueFromPath(path: string, obj: any): any {
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
