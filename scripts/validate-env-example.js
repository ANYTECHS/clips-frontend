#!/usr/bin/env node
/**
 * Validate that all environment variables in validateEnv.ts are documented in .env.example
 */

const fs = require('fs');
const path = require('path');

// Read validateEnv.ts to extract required variables
const validateEnvPath = path.join(__dirname, '../app/lib/validateEnv.ts');
const validateEnvContent = fs.readFileSync(validateEnvPath, 'utf-8');

// Extract REQUIRED_ENV_VARS and REQUIRED_PROD_ENV_VARS arrays
const requiredEnvMatch = validateEnvContent.match(/REQUIRED_ENV_VARS = \[([\s\S]*?)\]/);
const requiredProdMatch = validateEnvContent.match(/REQUIRED_PROD_ENV_VARS = \[([\s\S]*?)\]/);

if (!requiredEnvMatch || !requiredProdMatch) {
  console.error('Failed to extract env var arrays from validateEnv.ts');
  process.exit(1);
}

const extractVars = (match) => {
  const content = match[1];
  const vars = [];
  const varRegex = /'([^']+)'/g;
  let matchResult;
  while ((matchResult = varRegex.exec(content)) !== null) {
    vars.push(matchResult[1]);
  }
  return vars;
};

const requiredVars = extractVars(requiredEnvMatch);
const requiredProdVars = extractVars(requiredProdMatch);
const allRequiredVars = [...requiredVars, ...requiredProdVars];

// Read .env.example
const envExamplePath = path.join(__dirname, '../.env.example');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');

// Check each required var is documented
const missing = [];
for (const varName of allRequiredVars) {
  if (!envExampleContent.includes(varName)) {
    missing.push(varName);
  }
}

if (missing.length > 0) {
  console.error('❌ Missing environment variables in .env.example:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease add these variables to .env.example with documentation.');
  process.exit(1);
}

console.log('✅ All required environment variables are documented in .env.example');
process.exit(0);
