import 'reflect-metadata'; import * as dotenv from 'dotenv'; dotenv.config();
import { NestFactory } from '@nestjs/core'; import { AppModule } from './module'; import { ValidationPipe } from '@nestjs/common';
async function bootstrap() { const app = await NestFactory.create(AppModule); app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
const port = process.env.PORT || 3000; await app.listen(port as number); console.log('config listening on', port); }
bootstrap();
