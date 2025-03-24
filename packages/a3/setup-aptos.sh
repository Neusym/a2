#!/bin/bash

# Complete Aptos setup script for a3 platform
echo "🚀 Setting up Aptos for a3 platform"

# Generate a private key if not already created
if [ ! -f "aptos-key.txt" ]; then
  echo "Generating private key..."
  aptos key generate --output-file aptos-key.txt
fi

PRIVATE_KEY=$(cat aptos-key.txt)
PUBLIC_KEY=$(cat aptos-key.txt.pub)
echo "Private key: $PRIVATE_KEY"
echo "Public key: $PUBLIC_KEY"

# Create a profile file for aptos CLI with non-interactive setup
mkdir -p $HOME/.aptos

APTOS_CONFIG="$HOME/.aptos/config.yaml"
echo "Creating Aptos CLI config..."
cat > $APTOS_CONFIG << EOF
---
profiles:
  default:
    private_key: "0x$PRIVATE_KEY"
    public_key: "$PUBLIC_KEY"
    account: null
    rest_url: "https://fullnode.testnet.aptoslabs.com/v1"
    faucet_url: "https://faucet.testnet.aptoslabs.com"
EOF

echo "Deriving account address..."
ADDRESS_OUTPUT=$(aptos account derive-resource-account-address --seed 12345 | grep "Resource account address")
ACCOUNT_ADDRESS=$(echo $ADDRESS_OUTPUT | awk '{print $4}')
echo "Account address: $ACCOUNT_ADDRESS"

# Update the config with account
sed -i '' "s/account: null/account: \"$ACCOUNT_ADDRESS\"/" $APTOS_CONFIG

# Create the .env file
echo "Creating .env file..."
cat > .env << EOF
# Aptos Configuration
APTOS_PRIVATE_KEY=$PRIVATE_KEY
APTOS_NETWORK=testnet
APTOS_ACCOUNT_ADDRESS=$ACCOUNT_ADDRESS
EOF

# Copy the environment file to packages/a3
echo "Copying .env to packages/a3..."
cp .env packages/a3/.env

# Deploy the Move module
echo "Deploying the process registry contract..."
cd packages/a3
mkdir -p src/discovery/aptos/build

echo "Compiling Move module..."
aptos move compile --package-dir src/discovery/aptos --output-dir src/discovery/aptos/build --named-addresses process_registry=$ACCOUNT_ADDRESS

echo "Publishing Move module..."
PUBLISH_OUTPUT=$(aptos move publish --package-dir src/discovery/aptos --named-addresses process_registry=$ACCOUNT_ADDRESS)
echo "$PUBLISH_OUTPUT"

# Extract transaction hash
TX_HASH=$(echo "$PUBLISH_OUTPUT" | grep "transaction hash" | awk '{print $3}')
echo "Transaction hash: $TX_HASH"

# Initialize the registry
echo "Initializing the registry..."
INIT_OUTPUT=$(aptos move run --function-id ${ACCOUNT_ADDRESS}::process_registry::initialize)
echo "$INIT_OUTPUT"

# Update the .env file with the module address
echo "Updating .env file with module address..."
cd ../..
cat > .env << EOF
# Aptos Configuration
APTOS_PRIVATE_KEY=$PRIVATE_KEY
APTOS_NETWORK=testnet
APTOS_MODULE_ADDRESS=$ACCOUNT_ADDRESS
EOF

cp .env packages/a3/.env

echo "✅ Setup complete!"
echo "Your Aptos account is now set up and the Process Registry contract is deployed."
echo "Private key: $PRIVATE_KEY"
echo "Account/Module address: $ACCOUNT_ADDRESS"
echo ""
echo "Next step: Register your process with:"
echo "cd packages/a3 && pnpm run aptos:process-example" 