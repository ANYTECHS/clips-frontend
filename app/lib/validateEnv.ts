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

function isMissing(value: string | undefined): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  return trimmed.length === 0;
}

export function validateRequiredEnv(options?: { ciOnly?: boolean }): void {
  const ciOnly = options?.ciOnly ?? true;
  if (ciOnly && process.env.CI !== 'true') {
    return;
  }

  const missing = REQUIRED_ENV_VARS.filter((name) =>
    isMissing(process.env[name])
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. See .env.example at the repository root.`
    );
  }
}

export { REQUIRED_ENV_VARS };
