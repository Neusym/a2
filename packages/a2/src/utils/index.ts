/**
 * Framework utilities
 *
 * This module provides common utility functions and helpers for the a2 framework.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique identifier
 * @returns A UUID v4 string
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Create a deep clone of an object
 * @param obj Object to clone
 * @returns Deep clone of the input object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  return Object.fromEntries(
    Object.entries(obj as Record<string, any>).map(([key, value]) => [key, deepClone(value)]),
  ) as T;
}

/**
 * Sleep for a specified duration
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a value is a promise
 * @param value Value to check
 * @returns True if the value is a promise
 */
export function isPromise<T>(value: any): value is Promise<T> {
  return (
    value instanceof Promise ||
    (value !== null && typeof value === 'object' && typeof value.then === 'function')
  );
}

/**
 * Merge multiple objects together
 * Creates a new object with properties from all sources
 * @param target The target object to merge into
 * @param sources Source objects to merge from
 * @returns A new merged object
 */
export function merge<T extends Record<string, any>>(
  target: T,
  ...sources: Record<string, any>[]
): T {
  if (!target) {
    return {} as T;
  }

  // Create a new object with the target's properties
  const result = { ...target } as Record<string, any>;

  // Merge in each source
  sources.forEach((source) => {
    if (!source) return;

    Object.entries(source).forEach(([key, value]) => {
      if (value === undefined) return;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        // Recursively merge nested objects
        const merged = merge(result[key] as Record<string, any>, value as Record<string, any>);
        result[key] = merged;
      } else {
        // Direct assignment for non-objects
        result[key] = value;
      }
    });
  });

  return result as T;
}

/**
 * Format a date to ISO string with timezone
 * @param date Date to format (defaults to now)
 * @returns Formatted date string
 */
export function formatDate(date = new Date()): string {
  return date.toISOString();
}

/**
 * Debounce a function call
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function (...args: Parameters<T>): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function call
 * @param fn Function to throttle
 * @param limit Limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T> | undefined;

  return function (...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();

    if (now - lastCall >= limit) {
      lastCall = now;
      lastResult = fn(...args);
    }

    return lastResult;
  };
}

/**
 * Safely get a nested property from an object
 * @param obj Object to get property from
 * @param path Path to the property (dot notation)
 * @param defaultValue Default value if property doesn't exist
 * @returns Property value or default value
 */
export function get<T = any>(
  obj: Record<string, any>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }

    current = current[key];
  }

  return (current === undefined ? defaultValue : current) as T | undefined;
}

/**
 * Safely set a nested property on an object
 * @param obj Object to set property on
 * @param path Path to the property (dot notation)
 * @param value Value to set
 * @returns Updated object
 */
export function set<T extends Record<string, any>>(obj: T, path: string, value: any): T {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current: Record<string, any> = obj;

  for (const key of keys) {
    if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }

    current = current[key] as Record<string, any>;
  }

  current[lastKey] = value;
  return obj;
}

/**
 * Memoize a function (cache results)
 * @param fn Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  } as T;
}
