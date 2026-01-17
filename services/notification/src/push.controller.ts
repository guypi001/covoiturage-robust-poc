import { Body, Controller, Post } from '@nestjs/common';
import { PushService } from './push.service';
import { RegisterPushTokenDto, PushTestDto } from './push.dto';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('register')
  async register(@Body() dto: RegisterPushTokenDto) {
    return this.push.registerToken(dto);
  }

  @Post('test')
  async test(@Body() dto: PushTestDto) {
    return this.push.sendTest(dto.ownerId, dto.title, dto.body);
  }
}
