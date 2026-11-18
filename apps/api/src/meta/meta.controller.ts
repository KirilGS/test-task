import { Controller, Get } from "@nestjs/common";
import { MetaService } from "./meta.service";
import type { MetaResponse } from "./meta.logic";

@Controller("meta")
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get()
  getMeta(): Promise<MetaResponse> {
    return this.meta.getMeta();
  }
}
