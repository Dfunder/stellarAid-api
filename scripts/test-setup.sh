#!/bin/bash

# Integration Test Setup Script for stellarAid-api
# This script initializes the test environment and database

set -e

echo "🚀 Setting up Integration Test Environment"
echo "==========================================="

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
echo -e "${BLUE}📋 Checking PostgreSQL connection...${NC}"
if ! pg_isready -h localhost -U postgres &> /dev/null; then
  echo -e "${YELLOW}⚠️  PostgreSQL is not running. Starting PostgreSQL...${NC}"
  
  if command -v brew &> /dev/null; then
    brew services start postgresql
  elif command -v systemctl &> /dev/null; then
    sudo systemctl start postgresql
  else
    echo "Please start PostgreSQL manually and re-run this script."
    exit 1
  fi
  
  sleep 2
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Create test database
echo -e "${BLUE}📦 Creating test database...${NC}"
dropdb lumora_test 2>/dev/null || true
createdb lumora_test

echo -e "${GREEN}✓ Test database created${NC}"

# Setup environment variables
echo -e "${BLUE}⚙️  Setting up environment variables...${NC}"
if [ ! -f .env.test ]; then
  cat > .env.test << EOF
# Test Environment Variables
DATABASE_URL=postgresql://postgres:@localhost:5432/lumora_test
JWT_SECRET=test-secret-key-for-testing-only
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=test
EOF
  echo -e "${GREEN}✓ Created .env.test file${NC}"
else
  echo -e "${GREEN}✓ .env.test file already exists${NC}"
fi

# Run database migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
npx prisma migrate deploy --skip-generate --skip-seed

echo -e "${GREEN}✓ Migrations completed${NC}"

# Install dependencies if needed
echo -e "${BLUE}📚 Installing dependencies...${NC}"
npm install --legacy-peer-deps

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build the project
echo -e "${BLUE}🏗️  Building project...${NC}"
npm run build

echo -e "${GREEN}✓ Project built${NC}"

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "${BLUE}You can now run the integration tests:${NC}"
echo "  npm run test:e2e                    # Run all tests"
echo "  npm run test:e2e -- --watch         # Run in watch mode"
echo "  npm run test:e2e -- --coverage      # Run with coverage report"
echo ""
echo -e "${BLUE}Run specific test suites:${NC}"
echo "  npm run test:e2e -- database.integration.spec.ts"
echo "  npm run test:e2e -- auth.integration.e2e-spec.ts"
echo "  npm run test:e2e -- api-endpoints.integration.e2e-spec.ts"
echo "  npm run test:e2e -- stellar.integration.e2e-spec.ts"
echo ""
echo -e "${YELLOW}Note: Make sure Redis is running:${NC}"
echo "  brew services start redis          # macOS"
echo "  sudo systemctl start redis-server  # Linux"
echo ""
