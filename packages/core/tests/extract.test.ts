import { describe, expect, it } from "vitest";
import { extractClaims, type AiConfig, type SupportCase } from "../src/index.js";

const apiKey = "test-key-do-not-leak";

const config: AiConfig = {
  apiKey,
  baseUrl: "https://example.test/v1",
  model: "test-model",
  timeoutMs: 1000,
};

const delivery: SupportCase = {
  id: "К-02",
  type: "card_delivery",
  crm: {
    status: "in_transit",
    plannedBy: null,
    acceptedAt: null,
    note: "",
  },
  messages: [
    { author: "courier", text: "Буду минут через 40, пробка", sentAt: null },
  ],
};

const validClaim = {
  caseId: "К-02",
  messageIndex: 0,
  kind: "delivery_delayed",
  newEta: null,
  quote: "Буду минут через 40, пробка",
  summary: "Курьер пишет, что задерживается.",
  confidence: "high",
};

function completion(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("extractClaims", () => {
  it("возвращает факты из корректного ответа", async () => {
    const fetchFn: typeof fetch = async () =>
      completion(JSON.stringify({ claims: [validClaim] }));

    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toEqual([validClaim]);
      expect(result.rejected).toBe(0);
    }
  });

  it("разбирает ответ в блоке Markdown", async () => {
    const fetchFn: typeof fetch = async () =>
      completion("```json\n" + JSON.stringify({ claims: [validClaim] }) + "\n```");

    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toHaveLength(1);
    }
  });

  it("отклоняет ответ, который не является JSON", async () => {
    const fetchFn: typeof fetch = async () => completion("это не json");
    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(result.ok).toBe(false);
  });

  it("отбрасывает факт с цитатой, которой нет в сообщении", async () => {
    const fetchFn: typeof fetch = async () =>
      completion(
        JSON.stringify({
          claims: [{ ...validClaim, quote: "этой фразы не было" }],
        }),
      );

    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toEqual([]);
      expect(result.rejected).toBe(1);
    }
  });

  it("повторяет запрос после ошибки сервера", async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("ошибка", { status: 500 });
      }
      return completion(JSON.stringify({ claims: [validClaim] }));
    };

    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("не повторяет запрос при ошибке в данных", async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      return new Response("плохо", { status: 400 });
    };

    const result = await extractClaims(delivery, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
  });

  it("не вызывает модель, если сообщений нет", async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      return completion("{}");
    };
    const empty: SupportCase = { ...delivery, messages: [] };

    const result = await extractClaims(empty, "2026-11-18T09:00:00+03:00", config, fetchFn);
    expect(calls).toBe(0);
    expect(result).toEqual({ ok: true, claims: [], rejected: 0 });
  });

  it("не показывает ключ в причине ошибки", async () => {
    const failures: Array<typeof fetch> = [
      async () => completion("это не json"),
      async () => new Response("плохо", { status: 400 }),
      async () => {
        throw new Error(`сеть ${apiKey}`);
      },
    ];

    for (const fetchFn of failures) {
      const result = await extractClaims(
        delivery,
        "2026-11-18T09:00:00+03:00",
        config,
        fetchFn,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).not.toContain(apiKey);
      }
    }
  });
});
