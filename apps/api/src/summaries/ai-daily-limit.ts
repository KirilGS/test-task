import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppEnv } from "../config/env";
import { DayCounter } from "./summaries.logic";
import { AI_LIMIT_MESSAGE } from "./summaries.tokens";

@Injectable()
export class AiDailyLimit {
  private readonly counter = new DayCounter();

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  take(): void {
    const allowed = this.counter.take(
      new Date(),
      this.config.get("AI_REQUESTS_PER_DAY", { infer: true }),
    );
    if (!allowed) {
      throw new HttpException({ message: AI_LIMIT_MESSAGE }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
