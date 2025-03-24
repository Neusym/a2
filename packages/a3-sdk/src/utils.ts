import { A3ClientConfig } from './types';

/**
 * Build a complete URL from the base URL and path
 *
 * @param baseUrl Base URL
 * @param path Path to append to the base URL
 * @param queryParams Optional query parameters
 * @returns Complete URL
 */
export function buildUrl(baseUrl: string, path: string, queryParams?: Record<string, any>): string {
  // Remove trailing slash from base URL if it exists
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Add leading slash to path if it doesn't exist
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  let url = `${cleanBaseUrl}${cleanPath}`;

  // Add query parameters if provided
  if (queryParams && Object.keys(queryParams).length > 0) {
    const queryString = Object.entries(queryParams)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return url;
}

/**
 * Load environment variables from .env file
 *
 * @returns Object with environment variables
 */
export function loadEnvConfig(): A3ClientConfig {
  try {
    require('dotenv').config();

    return {
      privateKey: process.env.APTOS_PRIVATE_KEY,
      moduleAddress: process.env.APTOS_MODULE_ADDRESS,
      network: (process.env.APTOS_NETWORK || 'testnet') as A3ClientConfig['network'],
      nodeUrl: process.env.APTOS_NODE_URL,
      faucetUrl: process.env.APTOS_FAUCET_URL,
    };
  } catch (error) {
    console.warn('Error loading environment variables:', error);
    return {};
  }
}

/**
 * Format an amount with the appropriate currency symbol
 *
 * @param amount Amount to format
 * @param currency Currency code
 * @returns Formatted amount string
 */
export function formatAmount(amount: string | number, currency: string = 'APT'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${numAmount} ${currency}`;
}

/**
 * Generate a random process ID
 *
 * @returns Random process ID
 */
export function generateProcessId(): string {
  return `p-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Sleep for a specified duration
 *
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates that required parameters are present
 *
 * @param params Object containing parameters
 * @param requiredKeys Array of keys that must be present
 * @throws Error if any required key is missing
 */
export function validateRequiredParams(params: Record<string, any>, requiredKeys: string[]): void {
  const missingKeys = requiredKeys.filter(key => params[key] === undefined || params[key] === null);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required parameters: ${missingKeys.join(', ')}`);
  }
}

/**
 * Validates wallet address format
 *
 * @param address Wallet address to validate
 * @returns True if the address is valid, false otherwise
 */
export function isValidWalletAddress(address: string): boolean {
  // Simple validation: address should start with 0x and have a total length of at least 10 characters
  return address.startsWith('0x') && address.length >= 10;
}

/**
 * Validates amount format
 *
 * @param amount Amount to validate
 * @returns True if the amount is valid, false otherwise
 */
export function isValidAmount(amount: string): boolean {
  // Amount should be a positive number
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}
