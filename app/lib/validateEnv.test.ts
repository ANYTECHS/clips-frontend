import {
  validateRequiredEnv,
  REQUIRED_ENV_VARS,
  REQUIRED_PROD_ENV_VARS,
  OPTIONAL_APPLE_ENV_VARS,
} from './validateEnv';

// Helper: set all vars in a list to a dummy value.
function setAll(vars: readonly string[]) {
  for (const name of vars) {
    process.env[name] = `test-${name}`;
  }
}

// Helper: delete all vars in a list.
function deleteAll(vars: readonly string[]) {
  for (const name of vars) {
    delete process.env[name];
  }
}

describe('validateRequiredEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Start each test in a neutral (non-CI, non-production) state.
    delete process.env.CI;
    process.env.NODE_ENV = 'test';
    deleteAll(OPTIONAL_APPLE_ENV_VARS);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('development / test environment', () => {
    it('warns (does not throw) when core vars are missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      deleteAll(REQUIRED_ENV_VARS);

      expect(() => validateRequiredEnv()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variables')
      );

      warnSpy.mockRestore();
    });

    it('does not warn when all core vars are set', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      setAll(REQUIRED_ENV_VARS);

      expect(() => validateRequiredEnv()).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('warns when Apple Sign-In is only partially configured', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      setAll(REQUIRED_ENV_VARS);
      process.env.APPLE_ID = 'com.example.web';

      expect(() => validateRequiredEnv()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Apple Sign-In is partially configured')
      );

      warnSpy.mockRestore();
    });

    it('does not check production-only vars outside prod/CI', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      setAll(REQUIRED_ENV_VARS);
      deleteAll(REQUIRED_PROD_ENV_VARS); // missing prod vars — should be fine

      expect(() => validateRequiredEnv()).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('CI environment', () => {
    beforeEach(() => {
      process.env.CI = 'true';
    });

    it('throws when core vars are missing', () => {
      deleteAll(REQUIRED_ENV_VARS);

      expect(() => validateRequiredEnv()).toThrow(/Missing required environment variables/);
    });

    it('throws when Apple Sign-In is only partially configured', () => {
      setAll(REQUIRED_ENV_VARS);
      setAll(REQUIRED_PROD_ENV_VARS);
      process.env.APPLE_ID = 'com.example.web';

      expect(() => validateRequiredEnv()).toThrow(
        /Apple Sign-In is partially configured/
      );
    });

    it('throws when production-only vars are missing', () => {
      setAll(REQUIRED_ENV_VARS);
      deleteAll(REQUIRED_PROD_ENV_VARS);

      expect(() => validateRequiredEnv()).toThrow(/Missing required environment variables/);
    });

    it('passes when all vars are set', () => {
      setAll(REQUIRED_ENV_VARS);
      setAll(REQUIRED_PROD_ENV_VARS);

      expect(() => validateRequiredEnv()).not.toThrow();
    });
  });

  describe('production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.CI;
    });

    it('throws when core vars are missing', () => {
      deleteAll(REQUIRED_ENV_VARS);

      expect(() => validateRequiredEnv()).toThrow(/Missing required environment variables/);
    });

    it('throws when production-only vars are missing', () => {
      setAll(REQUIRED_ENV_VARS);
      deleteAll(REQUIRED_PROD_ENV_VARS);

      expect(() => validateRequiredEnv()).toThrow(/Missing required environment variables/);
    });

    it('passes when all vars are set', () => {
      setAll(REQUIRED_ENV_VARS);
      setAll(REQUIRED_PROD_ENV_VARS);

      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('error message includes actionable hint', () => {
      deleteAll(REQUIRED_ENV_VARS);

      expect(() => validateRequiredEnv()).toThrow(/\.env\.example/);
    });
  });
});
