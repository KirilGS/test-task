import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from "@nestjs/common";
import { MONGO_DB, type DatabasePing } from "./mongo/mongo.tokens";

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(MONGO_DB) private readonly db: DatabasePing) {}

  @Get()
  async getHealth(): Promise<{ status: "ok" }> {
    try {
      await this.db.command({ ping: 1 });
      return { status: "ok" };
    } catch {
      this.logger.error("База данных не отвечает");
      throw new HttpException({ status: "error" }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
