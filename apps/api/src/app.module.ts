import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envFilePath, validateEnv } from "./config/env";
import { DatasetsModule } from "./datasets/datasets.module";
import { HealthController } from "./health.controller";
import { MetaModule } from "./meta/meta.module";
import { MongoModule } from "./mongo/mongo.module";
import { SummariesModule } from "./summaries/summaries.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath(),
      validate: validateEnv,
    }),
    MongoModule,
    DatasetsModule,
    SummariesModule,
    MetaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
