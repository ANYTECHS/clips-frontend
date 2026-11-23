import { JwtService } from '@nestjs/jwt';

/**
 * JWT signing-key rotation helpers.
 *
 * Tokens are always SIGNED with `JWT_SECRET`. During a rotation the old value
 * is moved to `JWT_SECRET_PREVIOUS`, and tokens signed with either key are
 * accepted until the overlap window ends (at most the access-token lifetime,
 * `JWT_EXPIRES`). After that, `JWT_SECRET_PREVIOUS` is removed.
 *
 * See docs/SESSION_SECURITY.md for the rotation runbook.
 */

const DEV_JWT_SECRET = 'dev_jwt_secret';

const verifier = new JwtService();

/** The key new tokens are signed with. */
export function getJwtSigningSecret(): string {
  return process.env.JWT_SECRET || DEV_JWT_SECRET;
}

/**
 * Keys accepted when verifying a token, current key first. Includes the
 * previous key only while `JWT_SECRET_PREVIOUS` is set.
 */
export function getJwtVerificationSecrets(): string[] {
  const current = getJwtSigningSecret();
  const previous = process.env.JWT_SECRET_PREVIOUS?.trim();
  return previous && previous !== current ? [current, previous] : [current];
}

/**
 * Verify a JWT against the current key, then the previous key.
 * Throws the error from the current key when no key validates the token.
 */
export function verifyJwtWithRotation<T extends object = Record<string, unknown>>(
  token: string,
  options: { ignoreExpiration?: boolean } = {},
): T {
  const secrets = getJwtVerificationSecrets();
  let firstError: unknown;
  for (const secret of secrets) {
    try {
      return verifier.verify<T>(token, { ...options, secret });
    } catch (err) {
      firstError ??= err;
    }
  }
  throw firstError;
}

/**
 * `secretOrKeyProvider` for passport-jwt: picks whichever accepted key
 * produced the token's signature, so passport can then run its normal
 * signature + expiry verification with that key.
 */
export function jwtSecretOrKeyProvider(
  _request: unknown,
  rawJwtToken: string,
  done: (err: unknown, secretOrKey?: string) => void,
): void {
  const secrets = getJwtVerificationSecrets();
  const match = secrets.find((secret) => {
    try {
      // Expiry is checked afterwards by passport-jwt itself.
      verifier.verify(rawJwtToken, { secret, ignoreExpiration: true });
      return true;
    } catch {
      return false;
    }
  });
  // Fall back to the current key so passport reports the usual
  // "invalid signature" failure.
  done(null, match ?? secrets[0]);
}
