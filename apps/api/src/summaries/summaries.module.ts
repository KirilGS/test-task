import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AiConfig } from "@support-summary/core";
import { resolveAiConfig, type AppEnv } from "../config/env";
import { DatasetsModule } from "../datasets/datasets.module";
import { MongoModule } from "../mongo/mongo.module";
import { AiDailyLimit } from "./ai-daily-limit";
import { SummariesController } from "./summaries.controller";
import { SummariesService } from "./summaries.service";
import { AI_CONFIG, AI_FETCH, AI_LIMIT_MESSAGE } from "./summaries.tokens";

const HOUR_MS = 60 * 60 * 1000;

@Module({
  imports: [
    MongoModule,
    DatasetsModule,
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
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): AiConfig | null =>
        resolveAiConfig({
          AI_PROVIDER: config.get("AI_PROVIDER", { infer: true }),
          OPENAI_API_KEY: config.get("OPENAI_API_KEY", { infer: true }),
          OPENAI_MODEL: config.get("OPENAI_MODEL", { infer: true }),
          ANTHROPIC_API_KEY: config.get("ANTHROPIC_API_KEY", { infer: true }),
          ANTHROPIC_MODEL: config.get("ANTHROPIC_MODEL", { infer: true }),
          OPENROUTER_API_KEY: config.get("OPENROUTER_API_KEY", { infer: true }),
          OPENROUTER_MODEL: config.get("OPENROUTER_MODEL", { infer: true }),
          AI_TIMEOUT_MS: config.get("AI_TIMEOUT_MS", { infer: true }),
        }),
    },
    {
      provide: AI_FETCH,
      useValue: fetch,
    },
  ],
})
export class SummariesModule {}
