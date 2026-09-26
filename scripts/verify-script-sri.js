#!/usr/bin/env node
/**
 * Verifies that the SRI hashes configured for externally-loaded analytics
 * scripts (issue #801) still match what the vendor currently serves.
 *
 * Only checks scripts that have a configured hash — an unset
 * *_SCRIPT_SRI_HASH var means that script intentionally isn't pinned (see
 * docs/SECURITY.md), so there's nothing to verify for it. Exits non-zero on
 * any mismatch or fetch failure so CI catches a silent vendor-side change
 * before it ships.
 */

const crypto = require('crypto');
const https = require('https');

const CHECKS = [
  {
    name: 'GA4 (gtag.js)',
    url: 'https://www.googletagmanager.com/gtag/js?id=' + (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-PLACEHOLDER'),
    hashEnvVar: 'NEXT_PUBLIC_GA4_SCRIPT_SRI_HASH',
  },
  {
    name: 'Plausible',
    url: process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL || 'https://plausible.io/js/script.js',
    hashEnvVar: 'NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH',
  },
];

function fetchBody(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function computeIntegrity(body, algorithm) {
  const digest = crypto.createHash(algorithm).update(body).digest('base64');
  return `${algorithm}-${digest}`;
}

async function main() {
  let failed = false;

  for (const check of CHECKS) {
    const configuredHash = process.env[check.hashEnvVar];
    if (!configuredHash) {
      console.log(`[skip] ${check.name}: ${check.hashEnvVar} not set, not pinned.`);
      continue;
    }

    const algorithm = configuredHash.split('-')[0];
    if (!['sha256', 'sha384', 'sha512'].includes(algorithm)) {
      console.error(`[fail] ${check.name}: unrecognized integrity algorithm in ${check.hashEnvVar} ("${configuredHash}")`);
      failed = true;
      continue;
    }

    try {
      const body = await fetchBody(check.url);
      const actualHash = computeIntegrity(body, algorithm);

      if (actualHash === configuredHash) {
        console.log(`[ok] ${check.name}: hash matches.`);
      } else {
        console.error(`[fail] ${check.name}: configured hash no longer matches the served script.`);
        console.error(`  configured: ${configuredHash}`);
        console.error(`  actual:     ${actualHash}`);
        failed = true;
      }
    } catch (err) {
      console.error(`[fail] ${check.name}: ${err.message}`);
      failed = true;
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
