import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalGuard implements CanActivate {
  private readonly key = (process.env.INTERNAL_API_KEY || '').trim();

  canActivate(context: ExecutionContext): boolean {
    if (!this.key) {
      throw new UnauthorizedException('internal_key_not_configured');
    }
    const request = context.switchToHttp().getRequest();
    const header = (request.headers?.['x-internal-key'] ?? request.headers?.['X-Internal-Key']) as
      | string
      | undefined;
    if (!header || header !== this.key) {
      throw new UnauthorizedException('invalid_internal_key');
    }
    return true;
  }
}
