import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { throwUnauthorized } from '../../common/helpers/auth-error.helper';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Requests already authenticated by ApiKeyAuthGuard (Issue #1402) carry
    // req.apiKey + req.user — no JWT to verify, let them through.
    const request = context.switchToHttp().getRequest();
    if (request?.apiKey) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throwUnauthorized({
        message: 'Authentication required',
        errorCode: 'UNAUTHORIZED',
        reason: err instanceof Error ? err.message : undefined,
      });
    }

    return user;
  }
}
