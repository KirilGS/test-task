import { describe, expect, it } from "vitest";
import { buildMessages, loadSystemPrompt } from "../src/index.js";
import type { SupportCase } from "../src/index.js";

const sample: SupportCase = {
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

describe("промпт для извлечения фактов", () => {
  it("читается и не содержит случаи из задания", () => {
    const prompt = loadSystemPrompt();
    expect(prompt).toContain("Ты помогаешь support-отделу");
    expect(prompt).toContain("quote");
    expect(prompt).not.toContain("С-17");
    expect(prompt).not.toContain("С-24");
    expect(prompt).not.toContain("П-08");
    expect(prompt).not.toContain("П-09");
  });

  it("собирает системное сообщение и JSON одного случая", () => {
    const messages = buildMessages(sample, "2026-11-18T09:00:00+03:00");
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toContain("\"caseId\":\"К-02\"");
    expect(messages[1]?.content).toContain("\"index\":0");
  });
});
