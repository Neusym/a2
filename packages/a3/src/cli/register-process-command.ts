import { Command } from 'commander';

import { ExtendedProcess, createAptosServices, CreatorProfile } from '..';
import { Logger } from '../utils';

const logger = new Logger('Register Process');

/**
 * Register a process with the Aptos blockchain
 */
export async function registerProcess(
  name: string, 
  description: string, 
  tags: string[] = [],
  creatorProfile?: CreatorProfile,
  pricing?: {
    taskPrice: string;
    currency?: string;
    paymentAddress?: string;
    requiresPrepayment?: boolean;
  }
): Promise<{ success: boolean; processId: string }> {
  logger.section('Process Registration');
  
  try {
    logger.info('Creating Aptos services...');
    // Create services using factory function
    const { discoveryService, paymentService } = createAptosServices();
    logger.success('Services created');
    
    const owner = process.env.PROCESS_OWNER || 'custom-user';
    
    logger.info(`Creating process "${name}"...`);
    // Create an extended process with the services
    const processInstance = new ExtendedProcess({
      // Provide the services
      discoveryService,
      paymentService,
      
      // Provide metadata for the process
      metadata: {
        name,
        description,
        tags: [...tags],
        owner,
        creatorProfile,
        pricing: pricing ? {
          ...pricing,
          requiresPrepayment: pricing.requiresPrepayment ?? true
        } : undefined
      }
    });
    
    logger.success('Process created');
    logger.detail('Process ID', processInstance.getProcessId());
    
    logger.info('Initializing and registering process...');
    // Initialize the process (this will register it with the discovery service)
    await processInstance.initialize();
    logger.success('Process initialized and registered on Aptos blockchain');
    
    // Get network and module address from environment variables
    const network = process.env.APTOS_NETWORK || 'testnet';
    const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
    
    logger.info('Process registration successful!');
    logger.info(`View your process on the Aptos Explorer:`);
    logger.info(`https://${network}.aptos.dev/account/${moduleAddress}`);
    
    return {
      success: true,
      processId: processInstance.getProcessId()
    };
  } catch (error) {
    logger.error('Process registration failed', error);
    throw error;
  }
}

/**
 * Configure the register process command
 */
export function configureRegisterProcessCommand(): Command {
  const command = new Command('register')
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
        let creatorProfile: CreatorProfile | undefined;
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
        let pricing: {
          taskPrice: string;
          currency?: string;
          paymentAddress?: string;
          requiresPrepayment?: boolean;
        } | undefined;
        
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
        
        process.exit(0);
      } catch (error) {
        logger.error('Registration failed', error);
        process.exit(1);
      }
    });
    
  return command;
} 