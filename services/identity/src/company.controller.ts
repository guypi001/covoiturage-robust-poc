import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDocument } from './entities';
import { JwtAuthGuard } from './jwt.guard';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AuthService } from './auth.service';

const DOC_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'company');

const ensureUploadDir = () => {
  fs.mkdirSync(DOC_UPLOAD_DIR, { recursive: true });
};

const docStorage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, DOC_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(
    @InjectRepository(CompanyDocument)
    private readonly docs: Repository<CompanyDocument>,
    private readonly auth: AuthService,
  ) {}

  private async requireCompany(req: Request) {
    const payload = (req as any).user;
    if (!payload?.sub) {
      throw new BadRequestException('missing_token');
    }
    const profile = await this.auth.getProfile(payload.sub);
    if (!profile || profile.type !== 'COMPANY') {
      throw new ForbiddenException('company_only');
    }
    return profile;
  }

  @Get('me/verification')
  async verificationStatus(@Req() req: Request) {
    const profile = await this.requireCompany(req);
    const documents = await this.docs.find({
      where: { accountId: profile.id },
      order: { createdAt: 'DESC' },
    });
    return {
      companyId: profile.id,
      verifiedAt: profile.companyVerifiedAt ?? null,
      documents,
    };
  }

  @Post('me/verification/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: docStorage,
      limits: { fileSize: 6 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('invalid_file_type'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocument(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('type') type?: string,
  ) {
    const profile = await this.requireCompany(req);
    if (!file) {
      throw new BadRequestException('file_required');
    }
    const docType = type?.trim() || 'legal';
    const doc = this.docs.create({
      accountId: profile.id,
      type: docType,
      fileUrl: `/uploads/company/${file.filename}`,
      status: 'PENDING',
    });
    return this.docs.save(doc);
  }
}
