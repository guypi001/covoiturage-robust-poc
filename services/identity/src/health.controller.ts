import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MailerService } from './mailer.service';

@Controller()
export class HealthController {
  constructor(private readonly mailer: MailerService) {}

  @Get('/health')
  health() {
    return { ok: true };
  }

  @Get('/ready')
  async ready(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({ ready: true });
  }

  @Get('/health/email')
  async healthEmail(@Query('verify') verify: string | undefined, @Res() res: Response) {
    if (verify === '1' || verify === 'true') {
      await this.mailer.verifySmtpNow();
    }
    const status = this.mailer.getSmtpStatus();
    return res.status(status.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(status);
  }
}
