import { Module } from "@nestjs/common";
import { loadSystemPrompt } from "@support-summary/core";
import { AiSettingsModule } from "../settings/ai-settings.module";
import { SummariesModule } from "../summaries/summaries.module";
import { MetaController } from "./meta.controller";
import { MetaService } from "./meta.service";
import { SYSTEM_PROMPT } from "./meta.tokens";

@Module({
  imports: [SummariesModule, AiSettingsModule],
  controllers: [MetaController],
  providers: [
    MetaService,
    {
      provide: SYSTEM_PROMPT,
      useFactory: (): string => loadSystemPrompt(),
    },
  ],
})
export class MetaModule {}
