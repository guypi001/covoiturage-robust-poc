import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'] as string | undefined;
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing_token');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('missing_token');
    }

    try {
      const payload = await this.jwt.verifyAsync(token);
      const account = await this.accounts.findOne({ where: { id: payload.sub } });
      if (!account) {
        throw new UnauthorizedException('invalid_token');
      }
      if (account.status !== 'ACTIVE') {
        throw new ForbiddenException('account_suspended');
      }
      request.user = {
        sub: account.id,
        email: account.email,
        type: account.type,
        role: account.role,
        status: account.status,
      };
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('invalid_token');
    }
  }
}
