import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { AppEnv } from "../config/env";
import { passwordFromBasicHeader, passwordsMatch, requestNeedsPassword } from "./basic-auth";

export function configureApp(app: NestFastifyApplication): void {
  app.setGlobalPrefix("api");
  const config = app.get(ConfigService<AppEnv, true>);
  const password = config.get("DEMO_PASSWORD", { infer: true });
  if (password === undefined) {
    return;
  }

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook("onRequest", async (request, reply) => {
    if (!requestNeedsPassword(request.method, request.url)) {
      return;
    }
    const header = request.headers.authorization;
    const provided = passwordFromBasicHeader(typeof header === "string" ? header : undefined);
    if (provided !== null && passwordsMatch(provided, password)) {
      return;
    }
    reply.header("WWW-Authenticate", 'Basic realm="Support summary", charset="UTF-8"');
    return reply.code(401).send({ message: "Введите пароль" });
  });
}
