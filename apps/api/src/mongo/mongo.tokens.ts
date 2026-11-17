export const MONGO_DB = "MONGO_DB";

export type DatabasePing = {
  command(command: { ping: 1 }): Promise<unknown>;
};
