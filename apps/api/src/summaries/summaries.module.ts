import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AppEnv } from "../config/env";
import { DatasetsModule } from "../datasets/datasets.module";
import { MongoModule } from "../mongo/mongo.module";
import { AiSettingsModule } from "../settings/ai-settings.module";
import { AiDailyLimit } from "./ai-daily-limit";
import { SummariesController } from "./summaries.controller";
import { SummariesService } from "./summaries.service";
import { AI_CONFIG, AI_FETCH, AI_LIMIT_MESSAGE } from "./summaries.tokens";

const HOUR_MS = 60 * 60 * 1000;

@Module({
  imports: [
    MongoModule,
    DatasetsModule,
    AiSettingsModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        errorMessage: AI_LIMIT_MESSAGE,
        throttlers: [
          {
            name: "ai",
            ttl: HOUR_MS,
            limit: config.get("AI_REQUESTS_PER_HOUR", { infer: true }),
          },
        ],
      }),
    }),
  ],
  controllers: [SummariesController],
  exports: [AI_CONFIG],
  providers: [
    SummariesService,
    AiDailyLimit,
    {
      provide: AI_CONFIG,
      useValue: null,
    },
    {
      provide: AI_FETCH,
      useValue: fetch,
    },
  ],
})
export class SummariesModule {}
