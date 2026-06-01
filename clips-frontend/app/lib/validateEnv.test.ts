import { validateRequiredEnv, REQUIRED_ENV_VARS } from './validateEnv';

describe('validateRequiredEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips validation outside CI by default', () => {
    delete process.env.CI;
    for (const name of REQUIRED_ENV_VARS) {
      delete process.env[name];
    }
    expect(() => validateRequiredEnv()).not.toThrow();
  });

  it('throws in CI when required variables are missing', () => {
    process.env.CI = 'true';
    for (const name of REQUIRED_ENV_VARS) {
      delete process.env[name];
    }
    expect(() => validateRequiredEnv()).toThrow(/Missing required environment variables/);
  });

  it('passes in CI when all required variables are set', () => {
    process.env.CI = 'true';
    for (const name of REQUIRED_ENV_VARS) {
      process.env[name] = `test-${name}`;
    }
    expect(() => validateRequiredEnv()).not.toThrow();
  });
});
