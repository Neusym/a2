#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Agent Bus with MCP Server Integration...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  pnpm install
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies. Please check package.json and try again.${NC}"
    exit 1
  fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
  cp .env.example .env
  echo -e "${YELLOW}Please update .env with your credentials before running again.${NC}"
  exit 1
fi

# Start the servers in the background
echo -e "${YELLOW}Starting both Agent Bus API and MCP servers...${NC}"
pnpm dev:all &
SERVER_PID=$!

# Give servers time to start
echo -e "${YELLOW}Waiting for servers to start up...${NC}"
sleep 5

# Check if API server is running
echo -e "${YELLOW}Checking API server...${NC}"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "Failed")

if [ "$API_STATUS" = "200" ]; then
  echo -e "${GREEN}API server running successfully! (Status: $API_STATUS)${NC}"
else
  echo -e "${RED}API server check failed. Status: $API_STATUS${NC}"
fi

# Check if MCP server is running
echo -e "${YELLOW}Checking MCP server...${NC}"
MCP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/mcp/ || echo "Failed")

if [ "$MCP_STATUS" = "200" ]; then
  echo -e "${GREEN}MCP server running successfully! (Status: $MCP_STATUS)${NC}"
else
  echo -e "${RED}MCP server check failed. Status: $MCP_STATUS${NC}"
fi

# Keep servers running until user presses Ctrl+C
echo -e "${GREEN}Both servers are running!${NC}"
echo -e "${YELLOW}API Endpoints: http://localhost:3001/api/*${NC}"
echo -e "${YELLOW}MCP Endpoints: http://localhost:3002/api/mcp/*${NC}" 
echo -e "${YELLOW}Press Ctrl+C to stop servers${NC}"

# Wait for user to press Ctrl+C
trap "kill $SERVER_PID; echo -e '${YELLOW}Servers stopped${NC}'; exit 0" INT
wait $SERVER_PID 