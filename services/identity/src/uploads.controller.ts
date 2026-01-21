import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';

const PROFILE_DIR = path.join(process.cwd(), 'uploads', 'profile');
const COMPANY_DIR = path.join(process.cwd(), 'uploads', 'company');

@Controller('uploads')
export class UploadsController {
  @Get('profile/:filename')
  async serveProfilePhoto(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(PROFILE_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('file_not_found');
    }
    return res.sendFile(filePath);
  }

  @Get('company/:filename')
  async serveCompanyDoc(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(COMPANY_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('file_not_found');
    }
    return res.sendFile(filePath);
  }
}
