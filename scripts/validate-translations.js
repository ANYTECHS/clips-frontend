#!/usr/bin/env node
/**
 * Validate that all translation keys in en.json exist in all other locale files
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../app/lib/i18n/locales');
const enPath = path.join(localesDir, 'en.json');
const otherLocales = ['es', 'fr', 'pt'];

// Read en.json to get all keys
const enContent = fs.readFileSync(enPath, 'utf-8');
const enData = JSON.parse(enContent);

// Extract all keys from en.json
function extractKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...extractKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = extractKeys(enData);

// Check each other locale file
let hasErrors = false;

for (const locale of otherLocales) {
  const localePath = path.join(localesDir, `${locale}.json`);
  const localeContent = fs.readFileSync(localePath, 'utf-8');
  const localeData = JSON.parse(localeContent);
  const localeKeys = extractKeys(localeData);

  // Find missing keys
  const missingKeys = enKeys.filter(key => !localeKeys.includes(key));

  if (missingKeys.length > 0) {
    console.error(`❌ Missing keys in ${locale}.json:`);
    missingKeys.forEach(key => console.error(`   - ${key}`));
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nPlease add the missing translation keys to the locale files.');
  process.exit(1);
}

console.log('✅ All translation keys are present in all locale files.');
process.exit(0);
