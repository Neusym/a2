---
title: A2 SDK Multi-Agent Example
description: Example of creating multi-agent workflows with the A2 SDK
---

# Multi-Agent and Multi-Workflow Example

This example demonstrates how to build a complex system using multiple agents and workflows with the A2 SDK. We'll create a content creation and management system that performs research, drafts content, provides feedback, and prepares it for publication.

## Setting Up

First, let's install the necessary packages:

```bash
pnpm add @a2/sdk @ai-sdk/openai @ai-sdk/anthropic dotenv
```

Create a `.env` file with your API keys:

```
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Let's set up our main file:

```typescript
// content-system.ts
import { A2SDK } from '@a2/sdk';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables
config();

// Initialize the SDK
const sdk = new A2SDK({
  apiKey: process.env.OPENAI_API_KEY,
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
});
```

## Creating Specialized Agents

Let's create multiple specialized agents for different tasks:

```typescript
// Create a researcher agent using OpenAI models
const researchAgent = sdk.createAgent({
  name: 'Research Specialist',
  instructions: `
    You are a research specialist who excels at finding detailed information on topics.
    Provide comprehensive, factual information with specific details.
    Always include key statistics, main concepts, historical context, and current trends.
    Format your research with clear sections and bullet points for readability.
  `,
  model: 'gpt-4o',
  provider: 'openai',
});

// Create a content writer agent using Anthropic's model
const writerAgent = sdk.createAgent({
  name: 'Content Writer',
  instructions: `
    You are an expert content writer who specializes in creating engaging, well-structured content.
    Use the research provided to write compelling narratives.
    Follow these writing principles:
    - Start with a hook and compelling introduction
    - Use clear headings and subheadings
    - Include examples and illustrations for complex concepts
    - End with a strong conclusion and call-to-action if appropriate
    - Maintain a conversational but professional tone
  `,
  model: 'claude-3-opus-20240229',
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create an editor agent that reviews and improves content
const editorAgent = sdk.createAgent({
  name: 'Content Editor',
  instructions: `
    You are a meticulous editor who refines content for clarity, accuracy, and style.
    Improve the content by:
    - Correcting grammar and spelling errors
    - Enhancing sentence structure and flow
    - Ensuring consistent style and tone
    - Verifying factual accuracy based on the original research
    - Adding formatting recommendations (bold, italics, etc.) where appropriate
    - Optimizing for readability and engagement
  `,
  model: 'gpt-4o',
});

// Create an SEO specialist agent
const seoAgent = sdk.createAgent({
  name: 'SEO Specialist',
  instructions: `
    You are an SEO expert who optimizes content for search engines.
    Analyze the content and provide:
    - Recommended title tags and meta descriptions
    - Keyword density analysis
    - Suggestions for heading structure (H1, H2, H3)
    - Internal and external linking recommendations
    - Content structure improvements for better SERP performance
    Do not change the core message of the content, only enhance its SEO potential.
  `,
  model: 'gpt-4o',
});
```

## Creating Helper Tools

Let's create some tools that our agents can use:

```typescript
// Create a tool for saving content to a file
const saveToFileTools = sdk.createTool({
  name: 'saveToFile',
  description: 'Save content to a file on disk',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Name of the file to save to' },
      content: { type: 'string', description: 'Content to save to the file' },
    },
    required: ['filename', 'content'],
  },
  handler: async ({ filename, content }) => {
    try {
      fs.writeFileSync(filename, content, 'utf8');
      return `Successfully saved content to ${filename}`;
    } catch (error) {
      return `Error saving to file: ${error.message}`;
    }
  },
});

// Create a tool for reading from a file
const readFileTools = sdk.createTool({
  name: 'readFromFile',
  description: 'Read content from a file on disk',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Name of the file to read from' },
    },
    required: ['filename'],
  },
  handler: async ({ filename }) => {
    try {
      const content = fs.readFileSync(filename, 'utf8');
      return content;
    } catch (error) {
      return `Error reading file: ${error.message}`;
    }
  },
});

// Attach tools to agents that need them
editorAgent.addTool('saveToFile', saveToFileTools);
editorAgent.addTool('readFromFile', readFileTools);
seoAgent.addTool('readFromFile', readFileTools);
```

## Creating Individual Workflows

Now let's create individual workflows for different parts of the content system:

```typescript
// Research workflow
const researchWorkflow = sdk.createWorkflow({
  name: 'Research Process',
  agents: {
    researcher: researchAgent,
  },
  flowDefinition: [
    {
      id: 'initial-research',
      agent: 'researcher',
      input: '{{topic}}',
      output: 'initialResearch',
    },
    {
      id: 'deep-research',
      agent: 'researcher',
      input:
        'Based on this initial research: {{initialResearch}}, please provide deeper analysis and additional details.',
      output: 'detailedResearch',
    },
  ],
});

// Content creation workflow
const contentCreationWorkflow = sdk.createWorkflow({
  name: 'Content Creation Process',
  agents: {
    writer: writerAgent,
    editor: editorAgent,
  },
  flowDefinition: [
    {
      id: 'draft-content',
      agent: 'writer',
      input: 'Create content based on this research: {{research}}. Topic: {{topic}}',
      output: 'draftContent',
    },
    {
      id: 'edit-content',
      agent: 'editor',
      input: 'Edit this draft content: {{draftContent}}. Research reference: {{research}}',
      output: 'editedContent',
    },
  ],
});

// SEO optimization workflow
const seoWorkflow = sdk.createWorkflow({
  name: 'SEO Optimization Process',
  agents: {
    seo: seoAgent,
    editor: editorAgent,
  },
  flowDefinition: [
    {
      id: 'seo-analysis',
      agent: 'seo',
      input: 'Analyze this content for SEO: {{content}}. Target keywords: {{keywords}}',
      output: 'seoRecommendations',
    },
    {
      id: 'seo-implementation',
      agent: 'editor',
      input:
        'Implement these SEO recommendations: {{seoRecommendations}}. Original content: {{content}}',
      output: 'seoOptimizedContent',
    },
  ],
});
```

## Creating a Master Process

Now, let's create a master process that orchestrates all these workflows:

```typescript
// Create the master content production process
const contentProductionProcess = sdk.createProcess({
  name: 'End-to-End Content Production',
  steps: [
    {
      name: 'Research Phase',
      handler: async (input, context) => {
        console.log('Starting research phase...');

        const researchResult = await researchWorkflow.run({
          topic: input.topic,
        });

        // Save research to file for reference
        await saveToFileTools.handler({
          filename: `research-${Date.now()}.md`,
          content: researchResult.detailedResearch.text,
        });

        console.log('Research phase completed.');
        return {
          topic: input.topic,
          research: researchResult.detailedResearch.text,
        };
      },
    },
    {
      name: 'Content Creation Phase',
      handler: async (input, context) => {
        console.log('Starting content creation phase...');

        const contentResult = await contentCreationWorkflow.run({
          topic: input.topic,
          research: input.research,
        });

        console.log('Content creation phase completed.');
        return {
          ...input,
          content: contentResult.editedContent.text,
        };
      },
    },
    {
      name: 'SEO Optimization Phase',
      handler: async (input, context) => {
        console.log('Starting SEO optimization phase...');

        // Extract keywords from topic if none provided
        if (!input.keywords) {
          const keywordAgent = sdk.createAgent({
            name: 'Keyword Extractor',
            instructions: 'Extract the most relevant SEO keywords from a topic.',
          });

          const keywordResponse = await keywordAgent.generate(
            `Extract 5-7 important SEO keywords from this topic: ${input.topic}`
          );

          input.keywords = keywordResponse.text;
        }

        const seoResult = await seoWorkflow.run({
          content: input.content,
          keywords: input.keywords,
        });

        console.log('SEO optimization phase completed.');
        return {
          ...input,
          finalContent: seoResult.seoOptimizedContent.text,
        };
      },
    },
    {
      name: 'Publication Preparation Phase',
      handler: async (input, context) => {
        console.log('Preparing for publication...');

        // Create a final review agent
        const finalReviewAgent = sdk.createAgent({
          name: 'Publication Reviewer',
          instructions: 'Perform final checks on content before publication.',
        });

        // Final review
        const finalReview = await finalReviewAgent.generate(
          `Perform a final review of this content: ${input.finalContent}`
        );

        // Save final version
        const filename = `final-${input.topic.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
        await saveToFileTools.handler({
          filename,
          content: input.finalContent,
        });

        console.log(`Publication ready! Saved as ${filename}`);
        return {
          ...input,
          publishReady: true,
          filename,
          reviewNotes: finalReview.text,
        };
      },
    },
  ],
});
```

## Running the System

Finally, let's run our content production system:

```typescript
// Function to run the entire process
async function produceContent(topic: string, keywords?: string) {
  console.log(`Starting content production for topic: ${topic}`);

  try {
    const result = await contentProductionProcess.run({
      topic,
      keywords,
    });

    console.log('Content production completed successfully!');
    console.log('------ SUMMARY ------');
    console.log(`Topic: ${result.topic}`);
    console.log(`File: ${result.filename}`);
    console.log(`Review Notes: ${result.reviewNotes}`);

    return result;
  } catch (error) {
    console.error('Error in content production:', error);
  }
}

// Run the system
produceContent('The Impact of Artificial Intelligence on Modern Business')
  .then(() => console.log('Process completed'))
  .catch(err => console.error('Process failed:', err));
```

## Advanced: Adding Parallel Processing

For more complex scenarios, we can add parallel processing capabilities:

```typescript
// Create a parallel processing workflow
const parallelResearchWorkflow = sdk.createWorkflow({
  name: 'Parallel Research',
  agents: {
    techResearcher: sdk.createAgent({
      name: 'Technology Researcher',
      instructions: 'Research technical aspects of topics'
    }),
    businessResearcher: sdk.createAgent({
      name: 'Business Researcher',
      instructions: 'Research business implications and use cases'
    }),
    trendResearcher: sdk.createAgent({
      name: 'Trend Researcher',
      instructions: 'Research current trends and future predictions'
    })
  },
  flowDefinition: [
    // These three steps run in parallel
    {
      id: 'tech-research',
      agent: 'techResearcher',
      input: 'Research technical aspects of: {{topic}}',
      output: 'techResearch',
      parallel: true
    },
    {
      id: 'business-research',
      agent: 'businessResearcher',
      input: 'Research business implications of: {{topic}}',
      output: 'businessResearch',
      parallel: true
    },
    {
      id: 'trend-research',
      agent: 'trendResearcher',
      input: 'Research current trends for: {{topic}}',
      output: 'trendResearch',
      parallel: true
    },
    // Final step to consolidate results
    {
      id: 'consolidate',
      agent: 'trendResearcher', // Reusing agent for consolidation
      input: 'Consolidate these research findings:\n\nTechnical: {{techResearch}}\n\nBusiness: {{businessResearch}}\n\nTrends: {{trendResearch}}',
      output: 'consolidatedResearch'
    }
  ]
});

// Integrating the parallel workflow into our master process
// You would replace the Research Phase in contentProductionProcess with:
{
  name: 'Enhanced Research Phase',
  handler: async (input, context) => {
    console.log('Starting enhanced parallel research phase...');

    const researchResult = await parallelResearchWorkflow.run({
      topic: input.topic
    });

    await saveToFileTools.handler({
      filename: `research-${Date.now()}.md`,
      content: researchResult.consolidatedResearch.text
    });

    console.log('Enhanced research phase completed.');
    return {
      topic: input.topic,
      research: researchResult.consolidatedResearch.text
    };
  }
}
```

## Conclusion

This example demonstrates the power and flexibility of the A2 SDK for building complex multi-agent systems. Key points to note:

1. **Agent Specialization**: Each agent is specialized for a specific task
2. **Multiple Workflows**: Breaking the process into discrete workflows makes the system modular
3. **Process Orchestration**: The master process coordinates all workflows
4. **Tools Integration**: Custom tools extend the system's capabilities
5. **Parallel Processing**: For more efficiency, tasks can run in parallel

By following this pattern, you can build sophisticated agent systems for a wide range of applications, from content creation to data analysis, customer support, and more.
