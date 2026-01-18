import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { UpdateCompanyProfileDto, UpdateIndividualProfileDto } from './dto';
import type { AccountRole, AccountStatus, AccountType } from './entities';
import { Request } from 'express';
import { diskStorage } from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

type JwtPayload = {
  sub: string;
  email: string;
  type: AccountType;
  role: AccountRole;
  status: AccountStatus;
};

const PROFILE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profile');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ensureUploadDir = () => {
  fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
};

const profileStorage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, PROFILE_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const deleteProfileFile = (value?: string | null) => {
  if (!value) return;
  if (!value.startsWith('/uploads/profile/')) return;
  const filename = path.basename(value);
  const filePath = path.join(PROFILE_UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore delete errors
  }
};

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly auth: AuthService) {}

  private getPayload(req: Request): JwtPayload {
    const payload = (req as any).user as JwtPayload | undefined;
    if (!payload) {
      throw new UnauthorizedException('missing_token');
    }
    return payload;
  }

  @Get('me')
  async me(@Req() req: Request) {
    const payload = this.getPayload(req);
    return this.auth.getProfile(payload.sub);
  }

  @Post('me/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: profileStorage,
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('invalid_file_type'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(@Req() req: Request, @UploadedFile() file?: Express.Multer.File) {
    const payload = this.getPayload(req);
    if (!file) {
      throw new BadRequestException('file_required');
    }
    const photoPath = `/uploads/profile/${file.filename}`;
    const previous = await this.auth.getProfile(payload.sub);
    if (payload.type === 'COMPANY') {
      const updated = await this.auth.updateCompanyProfile(payload.sub, { profilePhotoUrl: photoPath });
      deleteProfileFile(previous?.profilePhotoUrl);
      return updated;
    }
    const updated = await this.auth.updateIndividualProfile(payload.sub, { profilePhotoUrl: photoPath });
    deleteProfileFile(previous?.profilePhotoUrl);
    return updated;
  }

  @Delete('me/photo')
  async deletePhoto(@Req() req: Request) {
    const payload = this.getPayload(req);
    const previous = await this.auth.getProfile(payload.sub);
    if (!previous?.profilePhotoUrl) {
      return { ok: true };
    }
    const updated =
      payload.type === 'COMPANY'
        ? await this.auth.updateCompanyProfile(payload.sub, { removeProfilePhoto: true })
        : await this.auth.updateIndividualProfile(payload.sub, { removeProfilePhoto: true });
    deleteProfileFile(previous.profilePhotoUrl);
    return updated;
  }

  @Patch('me/individual')
  async updateIndividual(@Req() req: Request, @Body() dto: UpdateIndividualProfileDto) {
    const payload = this.getPayload(req);
    if (payload.type !== 'INDIVIDUAL') {
      throw new ForbiddenException('invalid_account_type');
    }
    return this.auth.updateIndividualProfile(payload.sub, dto);
  }

  @Patch('me/company')
  async updateCompany(@Req() req: Request, @Body() dto: UpdateCompanyProfileDto) {
    const payload = this.getPayload(req);
    if (payload.type !== 'COMPANY') {
      throw new ForbiddenException('invalid_account_type');
    }
    return this.auth.updateCompanyProfile(payload.sub, dto);
  }

  @Get('lookup')
  async lookup(@Req() req: Request, @Query('email') email?: string) {
    this.getPayload(req); // assure que l'appelant est authentifié
    if (!email?.trim()) {
      throw new BadRequestException('email_required');
    }
    const account = await this.auth.lookupByEmail(email);
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    return account;
  }

  @Get(':id/public')
  async publicProfile(@Req() req: Request, @Param('id') id: string) {
    this.getPayload(req);
    if (!id?.trim()) {
      throw new BadRequestException('id_required');
    }
    const account = await this.auth.getPublicProfile(id);
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    return account;
  }
}
