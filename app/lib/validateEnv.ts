// Variables required in every environment (dev, CI, production).
const REQUIRED_ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_ID',
  'APPLE_TEAM_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_KEY_ID',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

// Additional variables that must be present in production (and CI).
const REQUIRED_PROD_ENV_VARS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_AI_API_URL',
  'AI_BACKEND_CALLBACK_SECRET',
  'CLOUD_STORAGE_PROVIDER',
  'CLOUD_STORAGE_BUCKET',
  'CLOUD_STORAGE_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'REDIS_URL',
] as const;

type RequiredVar =
  | (typeof REQUIRED_ENV_VARS)[number]
  | (typeof REQUIRED_PROD_ENV_VARS)[number];

function isMissing(value: string | undefined): boolean {
  if (value === undefined || value === null) return true;
  return value.trim().length === 0;
}

function isValidRedisUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'redis:' || url.protocol === 'rediss:';
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatError(missing: string[], invalid: string[]): string {
  const messages: string[] = [];

  if (missing.length > 0) {
    messages.push(`Missing required environment variables: ${missing.join(', ')}.`);
  }

  if (invalid.length > 0) {
    messages.push(`Invalid environment variable${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}.`);

    if (invalid.includes('REDIS_URL')) {
      messages.push(`REDIS_URL must be a valid redis:// or rediss:// URL.`);
    }

    if (invalid.includes('NEXT_PUBLIC_API_URL')) {
      messages.push(`NEXT_PUBLIC_API_URL must be a valid http:// or https:// URL.`);
    }
  }

  return (
    `${messages.join(' ')}\n` +
    `Copy .env.example to .env.local and fill in the missing values.`
  );
}

export function validateRequiredEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isCI = process.env.CI === 'true';
  const isDevelopment = !isProduction && !isCI;

  // Always check the core auth/session vars.
  const missingCore = (REQUIRED_ENV_VARS as readonly string[]).filter((name) =>
    isMissing(process.env[name])
  );

  // Check production-only vars in prod and CI.
  const missingProd =
    isProduction || isCI
      ? (REQUIRED_PROD_ENV_VARS as readonly string[]).filter((name) =>
          isMissing(process.env[name])
        )
      : [];

  const missing: string[] = [...missingCore, ...missingProd];
  const invalid: string[] =
    isProduction || isCI
      ? process.env.REDIS_URL && !isValidRedisUrl(process.env.REDIS_URL)
        ? ['REDIS_URL']
        : []
      : [];

  // Validate NEXT_PUBLIC_API_URL when running in production/CI
  if (isProduction || isCI) {
    if (process.env.NEXT_PUBLIC_API_URL && !isValidHttpUrl(process.env.NEXT_PUBLIC_API_URL)) {
      invalid.push('NEXT_PUBLIC_API_URL');
    }
  }

  if (missing.length === 0 && invalid.length === 0) return;

  const message = formatError(missing, invalid);

  if (isDevelopment) {
    // Warn so the dev server still starts, but the problem is visible.
    console.warn(`\n⚠️  [validateEnv] ${message}\n`);
  } else {
    // Hard fail in CI and production — a misconfigured deployment must not proceed.
    throw new Error(message);
  }
}

export { REQUIRED_ENV_VARS, REQUIRED_PROD_ENV_VARS };
export type { RequiredVar };
