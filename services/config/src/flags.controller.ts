import { Body, Controller, Get, Post } from '@nestjs/common';
const FLAGS: Record<string, any> = { 'risk.enabled': false };
@Controller('flags') export class FlagsController {
  @Get() all(){ return FLAGS; }
  @Post() set(@Body() body:{ key:string, value:any }){ FLAGS[body.key]=body.value; return { ok:true, key: body.key, value: body.value }; }
}
