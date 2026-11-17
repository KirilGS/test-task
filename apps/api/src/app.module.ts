import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envFilePath, validateEnv } from "./config/env";
import { HealthController } from "./health.controller";
import { MongoModule } from "./mongo/mongo.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath(),
      validate: validateEnv,
    }),
    MongoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
