import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class InternalGuard implements CanActivate {
  private readonly secret = process.env.INTERNAL_API_KEY;

  canActivate(context: ExecutionContext): boolean {
    if (!this.secret) {
      throw new UnauthorizedException('internal_api_disabled');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tokenHeader =
      request.headers['x-internal-api-key'] ?? request.headers['x-internal-secret'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    if (token && token === this.secret) {
      return true;
    }

    throw new UnauthorizedException('invalid_internal_api_key');
  }
}
