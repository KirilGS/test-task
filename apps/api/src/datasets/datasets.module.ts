import { Module } from "@nestjs/common";
import { MongoModule } from "../mongo/mongo.module";
import { DatasetsController } from "./datasets.controller";
import { DatasetsService } from "./datasets.service";

@Module({
  imports: [MongoModule],
  controllers: [DatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
