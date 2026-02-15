import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';

const PROFILE_DIR = path.join(process.cwd(), 'uploads', 'profile');
const COMPANY_DIR = path.join(process.cwd(), 'uploads', 'company');

@Controller('uploads')
export class UploadsController {
  private async assertFileExists(filePath: string) {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  @Get('profile/:filename')
  async serveProfilePhoto(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(PROFILE_DIR, safeName);
    const exists = await this.assertFileExists(filePath);
    if (!exists) {
      throw new NotFoundException('file_not_found');
    }
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
    return res.sendFile(filePath);
  }

  @Get('company/:filename')
  async serveCompanyDoc(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(COMPANY_DIR, safeName);
    const exists = await this.assertFileExists(filePath);
    if (!exists) {
      throw new NotFoundException('file_not_found');
    }
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
    return res.sendFile(filePath);
  }
}
