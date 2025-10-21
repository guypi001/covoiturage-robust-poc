import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common'; import { MeiliService } from './meili.service'; import { Response } from 'express';
@Controller('search') export class SearchController {
  constructor(private meili:MeiliService){} @Get() async search(@Query() q:any, @Res() res:Response){
    try{ const data = await this.meili.search(q); return res.status(HttpStatus.OK).json(data); } catch{ return res.status(HttpStatus.OK).json([]); } }
}
