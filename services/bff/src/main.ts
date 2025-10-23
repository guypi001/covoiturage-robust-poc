import 'reflect-metadata'; import * as dotenv from 'dotenv'; dotenv.config();
import { NestFactory } from '@nestjs/core'; import { AppModule } from './module'; import { ValidationPipe } from '@nestjs/common';
async function bootstrap() { const app = await NestFactory.create(AppModule); app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
app.enableCors({ origin:['http://localhost:3006','http://localhost:5173'], methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] });
const port = process.env.PORT || 3000; await app.listen(port as number); console.log('bff listening on', port); }
bootstrap();
