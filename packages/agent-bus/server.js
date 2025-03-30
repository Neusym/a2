// Simple development server for local testing
// Uses Hono with the node-server adapter

const { serve } = require('@hono/node-server');
const fs = require('fs');
const path = require('path');

// Need to use dynamic import since the file contains special characters in the name
// that Node.js require doesn't handle well
async function startServer() {
  console.log('Starting development server...');
  
  try {
    // First transpile the TypeScript file
    const { exec } = require('child_process');
    
    // Create the dist directory if it doesn't exist
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist');
    }
    if (!fs.existsSync('dist/api')) {
      fs.mkdirSync('dist/api');
    }
    
    console.log('Transpiling TypeScript...');
    
    // Use npx to ensure TypeScript is available
    exec('npx tsc --target es2022 --module commonjs --esModuleInterop --outDir dist/temp api/[[...route]].ts', 
      async (error, stdout, stderr) => {
        if (error) {
          console.error(`Error transpiling TypeScript: ${error.message}`);
          console.error(stderr);
          return;
        }
        
        console.log('TypeScript transpiled successfully');
        
        // Now load the transpiled JavaScript
        try {
          const { app } = require('./dist/temp/api/[[...route]]');
          const PORT = process.env.PORT || 3001;
          
          serve({
            fetch: app.fetch,
            port: PORT
          }, (info) => {
            console.log(`🚀 Server is running on http://localhost:${info.port}`);
          });
        } catch (err) {
          console.error('Error loading the transpiled module:', err);
        }
      }
    );
  } catch (err) {
    console.error('Error starting server:', err);
  }
}

startServer(); 