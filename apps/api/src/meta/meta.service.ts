import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AiConfig } from "@support-summary/core";
import type { AppEnv } from "../config/env";
import { AiSettingsService } from "../settings/ai-settings.service";
import { AI_CONFIG } from "../summaries/summaries.tokens";
import { buildMeta, type MetaResponse } from "./meta.logic";
import { SYSTEM_PROMPT } from "./meta.tokens";

@Injectable()
export class MetaService {
  constructor(
    @Inject(AI_CONFIG) private readonly ai: AiConfig | null,
    @Inject(SYSTEM_PROMPT) private readonly prompt: string,
    private readonly settings: AiSettingsService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async getMeta(): Promise<MetaResponse> {
    const stored = this.ai ?? (await this.settings.resolve());
    return buildMeta({
      ai: stored,
      prompt: this.prompt,
      aiRequestsPerHour: this.config.get("AI_REQUESTS_PER_HOUR", { infer: true }),
    });
  }
}
