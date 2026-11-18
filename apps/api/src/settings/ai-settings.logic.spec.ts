import { parseAiSettings } from "./ai-settings.logic";

describe("проверка подключения ИИ", () => {
  it("принимает службу, ключ и модель", () => {
    const parsed = parseAiSettings({
      provider: "claude",
      apiKey: "unit-test-key",
      model: "test-model",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.provider).toBe("claude");
      expect(parsed.data.model).toBe("test-model");
    }
  });

  it("разрешает пустой ключ, чтобы оставить уже сохранённый", () => {
    const parsed = parseAiSettings({ provider: "openai", apiKey: "  ", model: "test-model" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.apiKey).toBe("");
    }
  });

  it("просит модель и не принимает неизвестную службу", () => {
    const parsed = parseAiSettings({ provider: "другой", apiKey: "unit-test-key", model: "" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.map((item) => item.path)).toEqual(["provider", "model"]);
      expect(JSON.stringify(parsed.errors)).not.toContain("unit-test-key");
    }
  });
});
