import { Module } from "@nestjs/common";
import { loadSystemPrompt } from "@support-summary/core";
import { SummariesModule } from "../summaries/summaries.module";
import { MetaController } from "./meta.controller";
import { MetaService } from "./meta.service";
import { SYSTEM_PROMPT } from "./meta.tokens";

@Module({
  imports: [SummariesModule],
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
