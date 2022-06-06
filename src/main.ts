import { NestFactory } from '@nestjs/core';
import { MainModule } from './modules/main.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(MainModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  app.setGlobalPrefix('/api/v1');

  const configService = app.get(ConfigService);
  await app.listen(configService.get('LISTEN_PORT'));
}
bootstrap().then(() => console.log('MetEast Backend Service start successfully ✅ '));
