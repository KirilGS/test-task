import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { AiSettingsService, type AiSettingsView } from "./ai-settings.service";

@Controller("ai-settings")
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  view(): Promise<AiSettingsView> {
    return this.settings.view();
  }

  @Put()
  save(@Body() body: unknown): Promise<AiSettingsView> {
    return this.settings.save(body);
  }

  @Delete()
  clear(): Promise<AiSettingsView> {
    return this.settings.clear();
  }
}
