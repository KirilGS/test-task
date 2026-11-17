import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { SummariesService } from "./summaries.service";
import type { SummaryListItem, SummaryView } from "./summaries.types";

@Controller("summaries")
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Post()
  create(@Body() body: unknown): Promise<SummaryView> {
    return this.summaries.create(body, "no-ai");
  }

  @Post("ai")
  @UseGuards(ThrottlerGuard)
  createWithAi(@Body() body: unknown): Promise<SummaryView> {
    return this.summaries.create(body, "ai");
  }

  @Get()
  list(
    @Query("datasetId") datasetId: unknown,
    @Query("limit") limit: unknown,
  ): Promise<SummaryListItem[]> {
    return this.summaries.list(datasetId, limit);
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<SummaryView> {
    return this.summaries.get(id);
  }

  @Post(":id/feedback")
  addFeedback(@Param("id") id: string, @Body() body: unknown): Promise<SummaryView> {
    return this.summaries.addFeedback(id, body);
  }
}
