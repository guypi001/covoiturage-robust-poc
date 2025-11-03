import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AdminSendRideDigestDto } from './dto';
import { JwtAuthGuard } from './jwt.guard';
import { AdminGuard } from './admin.guard';
import { AdminRideService } from './admin-rides.service';

@Controller('admin/tools')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminToolsController {
  constructor(private readonly adminRides: AdminRideService) {}

  @Post('rides/share')
  async shareRides(@Body() dto: AdminSendRideDigestDto, @Req() req: any) {
    const actorId = ((req as any)?.user?.sub as string) || undefined;
    return this.adminRides.sendRideDigest(dto, actorId);
  }
}
