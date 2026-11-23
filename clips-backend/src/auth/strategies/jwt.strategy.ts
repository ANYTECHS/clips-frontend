import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtSecretOrKeyProvider } from '../jwt-keys';

export type JwtPayload = {
  sub: number;
  email: string | null;
  emailVerified?: boolean;
  role?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Accepts JWT_SECRET and, during rotation, JWT_SECRET_PREVIOUS.
      secretOrKeyProvider: jwtSecretOrKeyProvider,
    });
  }

  validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException();
    if (payload.emailVerified === false) {
      throw new UnauthorizedException(
        'Please verify your email to access this feature',
      );
    }
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      emailVerified: payload.emailVerified,
      role: payload.role ?? 'user',
    };
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { jwtSecretOrKeyProvider } from '../jwt-keys';

/**
 * JWT payload structure.
 * Issued by AuthService.issueTokens() and verified by JwtStrategy.
 */
export interface JwtPayload {
  /** User ID (sub claim) */
  sub: number;
  /** User email address */
  email: string | null;
  /** Whether email is verified */
  emailVerified: boolean;
  /** Issued at (standard JWT claim) */
  iat?: number;
  /** Expires at (standard JWT claim) */
  exp?: number;
}

/**
 * JWT Passport Strategy.
 *
 * Validates JWT tokens and extracts the payload.
 * Used by JwtAuthGuard to verify tokens from the Authorization header.
 *
 * Configuration:
 * - Secret: process.env.JWT_SECRET or 'dev_jwt_secret'; JWT_SECRET_PREVIOUS
 *   is also accepted during a key rotation (see docs/SESSION_SECURITY.md)
 * - Extraction: Bearer token from Authorization header
 * - Validation: Signature verification and expiration check (done by Passport)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Accepts JWT_SECRET and, during rotation, JWT_SECRET_PREVIOUS.
      secretOrKeyProvider: jwtSecretOrKeyProvider,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
