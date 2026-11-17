import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { loadProjectEnv } from "./config/env";
import { AppModule } from "./app.module";
import { configureApp } from "./security/configure-app";
import { attachSitePages } from "./web/site-pages";

const BODY_LIMIT = 1024 * 1024;

async function bootstrap(): Promise<void> {
  const env = loadProjectEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: env.TRUST_PROXY === "true",
      bodyLimit: BODY_LIMIT,
    }),
  );
  app.enableShutdownHooks();
  configureApp(app);

  const fastify = app.getHttpAdapter().getInstance();
  await app.init();
  attachSitePages(fastify, env.WEB_DIST_DIR);
  await app.listen(env.PORT, "0.0.0.0");
  Logger.log(`Сервер слушает порт ${env.PORT}`, "Bootstrap");
}

void bootstrap();
