import { Controller, Get, Res, HttpStatus } from '@nestjs/common'; import { Response } from 'express';
@Controller() export class HealthController {
  @Get('/health') health(){ return { ok: true }; }
  @Get('/ready') async ready(@Res() res: Response){ return res.status(HttpStatus.OK).json({ ready: true }); }
}
