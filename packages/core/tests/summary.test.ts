import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSummary,
  parseDataset,
  type AiConfig,
  type ChatClaim,
  type DatasetInput,
} from "../src/index.js";

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data",
);

const ai: AiConfig = {
  apiKey: "test-key-do-not-leak",
  baseUrl: "https://example.test/v1",
  model: "test-model",
  timeoutMs: 1000,
};

function readDataset(fileName: string): DatasetInput {
  const raw: unknown = JSON.parse(
    readFileSync(path.join(dataDir, fileName), "utf8"),
  );
  const parsed = parseDataset(raw);
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((error) => error.message).join("\n"));
  }
  return parsed.data;
}

function claim(
  caseId: string,
  kind: ChatClaim["kind"],
  quote: string,
  newEta: string | null = null,
): ChatClaim {
  return {
    caseId,
    messageIndex: 0,
    kind,
    newEta,
    quote,
    summary: "Краткий пересказ факта.",
    confidence: "high",
  };
}

const taskClaims: Record<string, ChatClaim> = {
  "С-17": claim(
    "С-17",
    "documents_sent",
    "Вчера отправил фотографии документов руководителю в личку.",
  ),
  "С-24": claim("С-24", "manager_agreed", "С руководителем всё обсудили, он в курсе."),
  "П-08": claim(
    "П-08",
    "delivery_delayed",
    "Задерживаюсь, раньше 13:00 не приеду.",
    "2026-11-16T13:00:00+03:00",
  ),
  "П-09": claim("П-09", "delivery_received", "Карты получили, количество проверили."),
};

function caseIdFrom(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") {
    return "";
  }
  const request: unknown = JSON.parse(init.body);
  if (!isRecord(request) || !Array.isArray(request.messages)) {
    return "";
  }
  const user = request.messages.find(
    (item) => isRecord(item) && item.role === "user",
  );
  if (!isRecord(user) || typeof user.content !== "string") {
    return "";
  }
  const content: unknown = JSON.parse(user.content);
  if (!isRecord(content) || typeof content.caseId !== "string") {
    return "";
  }
  return content.caseId;
}

function completion(claims: ChatClaim[]): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claims }) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("buildSummary", () => {
  const task = readDataset("input.json");

  it("строит сводку без ИИ в порядке П-08, С-24, С-17, П-09", async () => {
    const summary = await buildSummary(task, { ai: null });
    expect(summary.mode).toBe("no-ai");
    expect(summary.assessments.map((item) => item.caseId)).toEqual([
      "П-08",
      "С-24",
      "С-17",
      "П-09",
    ]);
  });

  it("строит сводку с ИИ и относит П-09 к случаям без действий", async () => {
    const fetchFn: typeof fetch = async (_input, init) => {
      const caseId = caseIdFrom(init);
      const fact = taskClaims[caseId];
      return completion(fact === undefined ? [] : [fact]);
    };

    const summary = await buildSummary(task, { ai, fetchFn });
    expect(summary.mode).toBe("ai");
    expect(summary.assessments.map((item) => item.caseId)).toEqual([
      "П-08",
      "С-24",
      "С-17",
      "П-09",
    ]);
    expect(summary.markdown).toContain("Не требуют действий");
    expect(summary.markdown).toContain("П-09");
    expect(summary.markdown).toContain("Подтверждено в CRM");
    expect(summary.markdown).toContain("Известно только из переписки");
    expect(summary.markdown).toContain("Начать с: П-08");

    const quiet = summary.markdown.split("## Не требуют действий")[1] ?? "";
    expect(quiet).toContain("П-09");
  });

  it("продолжает сводку, если ИИ не ответил по одному случаю", async () => {
    const fetchFn: typeof fetch = async (_input, init) => {
      const caseId = caseIdFrom(init);
      if (caseId === "С-17") {
        return new Response("ошибка", { status: 400 });
      }
      const fact = taskClaims[caseId];
      return completion(fact === undefined ? [] : [fact]);
    };

    const summary = await buildSummary(task, { ai, fetchFn });
    expect(summary.assessments).toHaveLength(4);
    expect(summary.warnings.some((warning) => warning.includes("С-17"))).toBe(
      true,
    );
    expect(summary.assessments.find((item) => item.caseId === "П-08")?.priority).toBe(
      "critical",
    );
  });

  it("отправляет не больше трёх запросов одновременно", async () => {
    const extra = readDataset("input-extra.json");
    let active = 0;
    let maxActive = 0;
    const fetchFn: typeof fetch = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => {
        setTimeout(resolve, 40);
      });
      active -= 1;
      return completion([]);
    };

    await buildSummary(extra, { ai, fetchFn });
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
