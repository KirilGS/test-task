import { validateEnv } from "./env";

const base = {
  MONGODB_URI: "mongodb://localhost:27017/support_summary",
};

describe("переменные окружения", () => {
  it("не читает провайдера, ключ и модель ИИ", () => {
    const env = validateEnv({
      ...base,
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "secret-should-stay-hidden",
      OPENAI_MODEL: "some-model",
      ANTHROPIC_API_KEY: "secret-should-stay-hidden",
      OPENROUTER_API_KEY: "secret-should-stay-hidden",
    });

    expect("AI_PROVIDER" in env).toBe(false);
    expect("OPENAI_API_KEY" in env).toBe(false);
    expect(JSON.stringify(env)).not.toContain("secret-should-stay-hidden");
  });

  it("не показывает лишнее значение в тексте ошибки", () => {
    expect(() =>
      validateEnv({
        OPENAI_API_KEY: "secret-should-stay-hidden",
      }),
    ).toThrow(/Укажите адрес базы данных/);

    try {
      validateEnv({ OPENAI_API_KEY: "secret-should-stay-hidden" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("secret-should-stay-hidden");
    }
  });
});
