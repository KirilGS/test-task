import { buildMeta } from "./meta.logic";

describe("справочная информация", () => {
  it("отдаёт модель и не отдаёт ключ или адрес", () => {
    const secret = "secret-key-should-not-appear";
    const meta = buildMeta({
      ai: {
        apiKey: secret,
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-6-luna",
        timeoutMs: 1000,
      },
      prompt: "Системный промпт",
      aiRequestsPerHour: 20,
    });
    const text = JSON.stringify(meta);

    expect(meta.aiAvailable).toBe(true);
    expect(meta.aiModel).toBe("gpt-6-luna");
    expect(text).not.toContain(secret);
    expect(text).not.toContain("api.openai.com");
    expect(meta.rules.length).toBeGreaterThan(0);
    expect(meta.limits.maxCases).toBe(30);
  });

  it("сообщает, что ИИ выключен", () => {
    const meta = buildMeta({ ai: null, prompt: "Системный промпт", aiRequestsPerHour: 20 });
    expect(meta.aiAvailable).toBe(false);
    expect(meta.aiModel).toBeNull();
  });
});
