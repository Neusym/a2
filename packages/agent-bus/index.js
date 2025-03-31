// Simple wrapper to run the standalone server
const { exec } = require('child_process');
const { spawn } = require('child_process');

console.log('Starting development server...');

// Run the ts-node command directly
const server = spawn('npx', ['ts-node', 'src/index.ts'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.kill('SIGTERM');
}); 