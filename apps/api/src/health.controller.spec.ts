import { HttpException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import type { DatabasePing } from "./mongo/mongo.tokens";

describe("HealthController", () => {
  it("returns ok when the database answers", async () => {
    const db: DatabasePing = {
      command: async () => ({ ok: 1 }),
    };
    const controller = new HealthController(db);
    await expect(controller.getHealth()).resolves.toEqual({ status: "ok" });
  });

  it("returns 503 when the database does not answer", async () => {
    const db: DatabasePing = {
      command: async () => {
        throw new Error("нет связи");
      },
    };
    const controller = new HealthController(db);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(HttpException);
    try {
      await controller.getHealth();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(503);
        expect(error.getResponse()).toEqual({ status: "error" });
      }
    }
  });
});
