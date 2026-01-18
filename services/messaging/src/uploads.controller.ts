import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'messages');

@Controller('uploads')
export class UploadsController {
  @Get('messages/:filename')
  async serveMessageAttachment(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('file_not_found');
    }
    return res.sendFile(filePath);
  }
}
