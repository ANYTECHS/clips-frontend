import { JwtService } from '@nestjs/jwt';
import {
  getJwtSigningSecret,
  getJwtVerificationSecrets,
  jwtSecretOrKeyProvider,
  verifyJwtWithRotation,
} from './jwt-keys';

const OLD_KEY = 'old-signing-key-0123456789abcdef';
const NEW_KEY = 'new-signing-key-fedcba9876543210';

function signWith(secret: string, expiresIn = 3600): string {
  return new JwtService({ secret }).sign(
    { sub: 42, email: 'user@example.com', emailVerified: true },
    { expiresIn },
  );
}

function resolveKey(token: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    jwtSecretOrKeyProvider({}, token, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

describe('JWT signing-key rotation', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalPrevious = process.env.JWT_SECRET_PREVIOUS;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalPrevious === undefined) delete process.env.JWT_SECRET_PREVIOUS;
    else process.env.JWT_SECRET_PREVIOUS = originalPrevious;
  });

  describe('during the overlap window', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = NEW_KEY;
      process.env.JWT_SECRET_PREVIOUS = OLD_KEY;
    });

    it('signs new tokens with the current key only', () => {
      expect(getJwtSigningSecret()).toBe(NEW_KEY);
      expect(getJwtVerificationSecrets()).toEqual([NEW_KEY, OLD_KEY]);
    });

    it('still validates tokens signed by the old key', () => {
      const oldToken = signWith(OLD_KEY);

      const payload = verifyJwtWithRotation<{ sub: number }>(oldToken);

      expect(payload.sub).toBe(42);
    });

    it('validates tokens signed by the new key', () => {
      const payload = verifyJwtWithRotation<{ sub: number }>(signWith(NEW_KEY));
      expect(payload.sub).toBe(42);
    });

    it('hands passport-jwt the key that signed the token', async () => {
      await expect(resolveKey(signWith(OLD_KEY))).resolves.toBe(OLD_KEY);
      await expect(resolveKey(signWith(NEW_KEY))).resolves.toBe(NEW_KEY);
    });

    it('rejects tokens signed by an unknown key', () => {
      expect(() => verifyJwtWithRotation(signWith('some-other-key'))).toThrow();
    });

    it('still rejects expired old-key tokens', () => {
      const expired = signWith(OLD_KEY, -10);
      expect(() => verifyJwtWithRotation(expired)).toThrow();
    });
  });

  describe('after the overlap window ends', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = NEW_KEY;
      delete process.env.JWT_SECRET_PREVIOUS;
    });

    it('rejects tokens signed by the old key', () => {
      expect(getJwtVerificationSecrets()).toEqual([NEW_KEY]);
      expect(() => verifyJwtWithRotation(signWith(OLD_KEY))).toThrow();
    });
  });
});
