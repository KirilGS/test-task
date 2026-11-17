import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";

export function attachSitePages(fastify: FastifyInstance, distDir: string): void {
  const indexPath = path.join(distDir, "index.html");
  if (!existsSync(indexPath)) {
    return;
  }

  fastify.route({
    method: ["GET", "HEAD"],
    url: "*",
    handler(request, reply) {
      const pathOnly = request.url.split("?")[0] ?? request.url;
      if (pathOnly === "/api" || pathOnly.startsWith("/api/")) {
        reply.code(404).send({ message: "Страница не найдена" });
        return;
      }
      reply.type("text/html").send(createReadStream(indexPath));
    },
  });
}
