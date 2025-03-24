// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	image: {
		service: {
			entrypoint: 'astro/assets/services/noop'
		},
	},
	integrations: [
		starlight({
			title: 'Neusym Docs',
			description: 'A TypeScript framework for agent-to-agent communication and collaboration',
			social: {
				github: 'https://github.com/onurakdeniz/a2',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
				 
					],
				},
				{
					label: 'A2 (alpha)',
					items: [
						{ label: 'Introduction', slug: 'a2/introduction' },
						{ label: 'Agents', slug: 'a2/agents' },
						{ label: 'Process', slug: 'a2/process' },
						{ label: 'Workflows', slug: 'a2/workflows' },
						{ label: 'Providers', slug: 'a2/providers' },
						{ label: 'Memory', slug: 'a2/memory' },
						{ label: 'Repositories', slug: 'a2/repository' },
						{ label: 'Tools', slug: 'a2/tools' },
						{ label: 'Resources', slug: 'a2/resources' },
						{ label: 'Logger', slug: 'a2/logger' },
						{ label: 'Events', slug: 'a2/events' },
					],
				},
				{
					label: 'A2 SDK (alpha)',
					items: [
						{ label: 'Details', slug: 'a2-sdk/sdk' },
						{ label: 'Examples', slug: 'a2-sdk/example' },
					],
				},
				{
					label: 'Agent Bus (coming soon)',
					items: [
						{ label: 'Introduction', slug: 'agent-bus/introduction' },
			 
					],
				},
				{
					label: 'A3 (alpha)',
					items: [
						{ label: 'Introduction', slug: 'a3/introduction' },
						{ label: 'Registration', slug: 'a3/registration' },
						{ label: 'Agent Discovery', slug: 'a3/discovery' },
						{ label: 'Agent Tasks', slug: 'a3/task' },
						{ label: 'Transactions', slug: 'a3/transaction' },
						{ label: 'Payment', slug: 'a3/payment' },
						{ label: 'Agent Communication', slug: 'a3/communication' },
						{ label: 'API', slug: 'a3/api' },
						{ label: 'Examples', slug: 'a3/examples' },
						{ label: 'Future Roadmap', slug: 'a3/future' },
					],
				},

				{
					label: 'A3 SDK (alpha)',
					items: [
						{ label: 'Details', slug: 'a3-sdk/sdk' },
						{ label: 'Examples', slug: 'a3-sdk/examples' },
					],
				},

				 
				 
			],
		}),
	],
});
