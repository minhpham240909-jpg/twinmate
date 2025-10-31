#!/bin/bash

echo "📦 Installing QA Testing Dependencies..."

# Install Vitest and related packages
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vitejs/plugin-react

# Install tsx for running TypeScript scripts
npm install --save-dev tsx

# Make scripts executable
chmod +x scripts/*.ts

echo "✅ QA dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run qa:full' to run all tests"
echo "2. Check QA_TESTING_GUIDE.md for full documentation"
echo "3. Run 'npm run generate-tests:scan' to generate tests for existing components"
