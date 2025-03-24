/**
 * Utility functions for the memory system
 */

import type {
  AssistantContent,
  CoreMessage,
  ToolCall as AiToolCall,
  ToolContent,
  ToolResultPart,
  UserContent,
} from 'ai';

import { MessageType, Role } from './types';

/**
 * Convert messages to CoreMessage format
 */
export function parseMessages(messages: MessageType[]): CoreMessage[] {
  return messages.map((msg) => ({
    ...msg,
    content:
      typeof msg.content === 'string' &&
      (msg.content.startsWith('[') || msg.content.startsWith('{'))
        ? JSON.parse((msg as MessageType).content as string)
        : typeof msg.content === 'number'
          ? String(msg.content)
          : msg.content,
  }));
}

/**
 * Convert assistant content to tool calls
 */
export function extractToolCalls(content: AssistantContent): {
  toolNames: string[];
  toolCallIds: string[];
  toolCallArgs: Record<string, unknown>[];
} | null {
  if (!Array.isArray(content)) {
    return null;
  }

  const toolCalls = content.filter((item) => item.type === 'tool-call') as Extract<
    AssistantContent[number],
    { type: 'tool-call' }
  >[];

  if (toolCalls.length === 0) {
    return null;
  }

  return {
    toolNames: toolCalls.map((call) => call.toolName),
    toolCallIds: toolCalls.map((call) => call.toolCallId),
    toolCallArgs: toolCalls.map((call) => call.args as Record<string, unknown>),
  };
}

/**
 * Generate a tool content array from tool result
 */
export function createToolContent(
  toolCallId: string,
  toolName: string,
  result: string | Record<string, unknown>,
): ToolContent {
  return [
    {
      type: 'tool-result',
      toolCallId,
      toolName,
      result: typeof result === 'string' ? result : JSON.stringify(result),
    },
  ];
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source?: Partial<T>): T {
  if (!source) return target;

  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], sourceValue);
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}
