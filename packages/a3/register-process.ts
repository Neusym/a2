#!/usr/bin/env node

/**
 * A3 Process Registration Script
 * 
 * This script allows you to register a process
 * with the Aptos blockchain via the A3 discovery service.
 * It supports creator profiles and pricing information.
 */

import { Command } from 'commander';

import { registerProcess } from './src/cli/register-process-command';

// Run the command if this script is executed directly
if (require.main === module) {
  const program = new Command()
    .name('register-process')
    .description('Register a process with the Aptos blockchain')
    .option('--name <name>', 'Name of the process', 'Custom Process')
    .option('--description <description>', 'Description of the process', 'A process registered with A3 on Aptos')
    .option('--tags <tags>', 'Comma-separated list of tags', (val) => val.split(','), [])
    .option('--creator-name <name>', 'Name of the creator')
    .option('--creator-description <description>', 'Description of the creator')
    .option('--creator-wallet <address>', 'Wallet address of the creator')
    .option('--creator-website <url>', 'Website of the creator')
    .option('--creator-social <socials>', 'Comma-separated list of social media links in format platform:url')
    .option('--task-price <price>', 'Price for a task')
    .option('--currency <currency>', 'Currency for the task price', 'APT')
    .option('--payment-address <address>', 'Address to receive payments')
    .option('--requires-prepayment <boolean>', 'Whether the process requires prepayment', (val) => val === 'true', true)
    .action(async (options) => {
      try {
        // Parse creator profile if provided
        let creatorProfile: any = undefined;
        if (options.creatorName || options.creatorDescription || options.creatorWallet || options.creatorWebsite || options.creatorSocial) {
          creatorProfile = {};
          
          if (options.creatorName) creatorProfile.name = options.creatorName;
          if (options.creatorDescription) creatorProfile.description = options.creatorDescription;
          if (options.creatorWallet) creatorProfile.walletAddress = options.creatorWallet;
          if (options.creatorWebsite) creatorProfile.website = options.creatorWebsite;
          
          if (options.creatorSocial) {
            creatorProfile.social = {};
            const socialParts = options.creatorSocial.split(',');
            for (const part of socialParts) {
              const [platform, url] = part.split(':');
              if (platform && url && creatorProfile.social) {
                creatorProfile.social[platform] = url;
              }
            }
          }
        }
        
        // Parse pricing if provided
        let pricing: any = undefined;
        if (options.taskPrice) {
          pricing = {
            taskPrice: options.taskPrice,
            currency: options.currency,
            paymentAddress: options.paymentAddress,
            requiresPrepayment: options.requiresPrepayment
          };
        }
        
        // Register the process
        await registerProcess(
          options.name,
          options.description,
          options.tags,
          creatorProfile,
          pricing
        );
      } catch (error) {
        console.error('Registration failed:', error);
        process.exit(1);
      }
    });
  
  program.parse(process.argv);
}

export { registerProcess }; 