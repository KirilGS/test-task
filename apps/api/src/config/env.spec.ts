import { resolveAiConfig, validateEnv } from "./env";

const base = {
  MONGODB_URI: "mongodb://localhost:27017/support_summary",
};

describe("настройки ИИ", () => {
  it("без выбранного провайдера работает без ИИ", () => {
    const env = validateEnv({
      ...base,
      OPENAI_API_KEY: "secret-openai",
      OPENAI_MODEL: "gpt-6-luna",
    });
    expect(resolveAiConfig(env)).toBeNull();
  });

  it("берёт ключ и модель выбранного провайдера", () => {
    const env = validateEnv({
      ...base,
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "secret-claude",
      ANTHROPIC_MODEL: "claude-sonnet-5-5",
      OPENAI_API_KEY: "secret-openai",
      OPENAI_MODEL: "gpt-6-luna",
    });
    expect(resolveAiConfig(env)).toEqual({
      apiKey: "secret-claude",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-5-5",
      timeoutMs: 30000,
    });
  });

  it("просит ключ и модель, если провайдер выбран", () => {
    expect(() =>
      validateEnv({
        ...base,
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "secret-router",
      }),
    ).toThrow("Для провайдера OpenRouter укажите ключ и модель.");
  });

  it("не принимает неизвестного провайдера и не показывает ключ", () => {
    expect(() =>
      validateEnv({
        ...base,
        AI_PROVIDER: "другой",
        OPENAI_API_KEY: "secret-should-stay-hidden",
      }),
    ).toThrow(/openai, claude или openrouter/);

    try {
      validateEnv({
        ...base,
        AI_PROVIDER: "другой",
        OPENAI_API_KEY: "secret-should-stay-hidden",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("secret-should-stay-hidden");
    }
  });
});
