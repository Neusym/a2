import path from 'path';

import { DefaultResourceManager } from '../manager';

/**
 * Load sample resources and prompts
 */
export async function loadSampleResources() {
  // Create a resource manager
  const resourceManager = new DefaultResourceManager();

  // Get the base directory for sample resources
  const samplesDir = path.join(__dirname);

  // Load template prompts
  console.log('Loading template prompts...');
  const templatesDir = path.join(samplesDir, 'templates');
  const promptTemplates = resourceManager.loadResourcesFromDirectory(templatesDir);

  // Add the greeting prompt template from the file
  const greetingResource = promptTemplates.find((r) => r.id === 'greeting.prompt');
  if (greetingResource) {
    resourceManager.addPrompt('greeting', greetingResource.content);
    console.log('Added greeting prompt template');
  }

  // Load data resources
  console.log('\nLoading data resources...');
  const dataDir = path.join(samplesDir, 'data');
  const dataResources = resourceManager.loadResourcesFromDirectory(dataDir);

  // Load document resources
  console.log('\nLoading document resources...');
  const docsDir = path.join(samplesDir, 'documents');
  const docResources = resourceManager.loadResourcesFromDirectory(docsDir);

  // Add function-based prompt template
  resourceManager.addPrompt('product-info', (params) => {
    const { productName, productId, price } = params;
    return `
      Product Information
      -------------------
      Name: ${productName}
      ID: ${productId}
      Price: $${price.toFixed(2)}
      
      For more information, please contact our sales team.
    `;
  });

  console.log('\nResource loading complete!');
  console.log(`Loaded ${resourceManager.listResources().length} resources`);
  console.log(`Loaded ${resourceManager.listPrompts().length} prompts`);

  // Demonstrate rendering prompts
  console.log('\nDemonstrating prompt rendering:');

  // Render the greeting prompt
  const renderedGreeting = resourceManager.renderPrompt('greeting', {
    name: 'John',
    topic: 'product',
    company: 'AI Solutions Inc.',
  });

  console.log('\nRendered greeting prompt:');
  console.log(renderedGreeting);

  // Render the product info prompt
  const renderedProductInfo = resourceManager.renderPrompt('product-info', {
    productName: 'AI Assistant Pro',
    productId: 'P1001',
    price: 49.99,
  });

  console.log('\nRendered product info prompt:');
  console.log(renderedProductInfo);

  return resourceManager;
}

// Uncomment to run the sample loader
// loadSampleResources()
//   .then(manager => console.log('Sample resources loaded successfully'))
//   .catch(error => console.error('Error loading samples:', error));
