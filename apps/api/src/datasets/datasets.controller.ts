import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { DatasetsService } from "./datasets.service";
import type { DatasetListItem, DatasetView } from "./datasets.types";

@Controller("datasets")
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Get()
  list(): Promise<DatasetListItem[]> {
    return this.datasets.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<DatasetView> {
    return this.datasets.get(id);
  }

  @Post()
  create(@Body() body: unknown): Promise<DatasetView> {
    return this.datasets.create(body);
  }

  @Post(":id/copy")
  copy(@Param("id") id: string): Promise<DatasetView> {
    return this.datasets.copy(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: unknown): Promise<DatasetView> {
    return this.datasets.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ id: string }> {
    return this.datasets.remove(id);
  }
}
