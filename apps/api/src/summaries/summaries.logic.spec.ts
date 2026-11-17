import {
  DayCounter,
  parseFeedback,
  parseSummaryListQuery,
  parseSummaryRequest,
} from "./summaries.logic";

describe("запрос сводки", () => {
  it("принимает набор и необязательный момент сводки", () => {
    const parsed = parseSummaryRequest({
      datasetId: "507f1f77bcf86cd799439011",
      snapshotAt: "2026-11-16T10:00:00+03:00",
    });
    expect(parsed.ok).toBe(true);
  });

  it("показывает ошибку ссылки по-русски", () => {
    const parsed = parseSummaryRequest({ datasetId: "нет" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((error) => error.path === "datasetId")).toBe(true);
      expect(parsed.errors.some((error) => error.message === "Неверная ссылка на набор")).toBe(
        true,
      );
    }
  });

  it("требует описание пропущенного", () => {
    const missing = parseFeedback({ caseId: "П-08", verdict: "missed" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors).toEqual([
        { path: "comment", message: "Опишите, что пропущено" },
      ]);
    }

    const filled = parseFeedback({
      caseId: null,
      verdict: "missed",
      comment: "  Не увидели задержку  ",
    });
    expect(filled).toEqual({
      ok: true,
      data: { caseId: null, verdict: "missed", comment: "Не увидели задержку" },
    });
  });

  it("по умолчанию показывает 20 сводок и не больше 50", () => {
    expect(parseSummaryListQuery("507f1f77bcf86cd799439011", undefined)).toEqual({
      ok: true,
      datasetId: "507f1f77bcf86cd799439011",
      limit: 20,
    });
    const tooMany = parseSummaryListQuery("507f1f77bcf86cd799439011", "51");
    expect(tooMany.ok).toBe(false);
  });

  it("сбрасывает суточный счётчик в полночь по Москве", () => {
    const counter = new DayCounter();
    const evening = new Date("2026-11-17T20:30:00Z");
    const nextMidnight = new Date("2026-11-17T21:00:00Z");
    expect(counter.take(evening, 1)).toBe(true);
    expect(counter.take(new Date("2026-11-17T20:40:00Z"), 1)).toBe(false);
    expect(counter.take(nextMidnight, 1)).toBe(true);
  });
});
