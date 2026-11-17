import { existsSync } from "node:fs";
import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { envFilePath, validateEnv, type AppEnv } from "./config/env";
import { DatasetsModule } from "./datasets/datasets.module";
import { HealthController } from "./health.controller";
import { MetaModule } from "./meta/meta.module";
import { MongoModule } from "./mongo/mongo.module";
import { UnknownErrorFilter } from "./security/unknown-error.filter";
import { SummariesModule } from "./summaries/summaries.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath(),
      validate: validateEnv,
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const rootPath = config.get("WEB_DIST_DIR", { infer: true });
        if (!existsSync(rootPath)) {
          Logger.warn("Собранный интерфейс не найден. Страницы сайта пока недоступны.", "Web");
          return [];
        }
        return [
          {
            rootPath,
            // Не используем общий шаблон: он перехватил бы адреса API и совпал с файлом index.html.
            renderPath: "/__site",
          },
        ];
      },
    }),
    MongoModule,
    DatasetsModule,
    SummariesModule,
    MetaModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: UnknownErrorFilter,
    },
  ],
})
export class AppModule {}
