import { Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Db, MongoClient } from "mongodb";
import { databaseName, type AppEnv } from "../config/env";
import { MONGO_DB } from "./mongo.tokens";

export { MONGO_DB } from "./mongo.tokens";

@Module({
  providers: [
    {
      provide: MongoClient,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<AppEnv, true>) => {
        const uri = config.getOrThrow("MONGODB_URI");
        const client = new MongoClient(uri);
        try {
          await client.connect();
        } catch {
          throw new Error("Не удалось подключиться к базе данных.");
        }
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MongoClient, ConfigService],
      useFactory: (client: MongoClient, config: ConfigService<AppEnv, true>): Db => {
        const uri = config.getOrThrow("MONGODB_URI");
        return client.db(databaseName(uri));
      },
    },
  ],
  exports: [MongoClient, MONGO_DB],
})
export class MongoModule implements OnApplicationShutdown {
  constructor(@Inject(MongoClient) private readonly client: MongoClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
