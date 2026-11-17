import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const config = app.get(ConfigService<AppEnv, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
