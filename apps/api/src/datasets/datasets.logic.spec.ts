import { copyTitle, parseDatasetId, parseUpdateBody, updateMiss } from "./datasets.logic";

const dataset = {
  title: "Проверка",
  snapshotAt: "2026-11-16T10:00:00+03:00",
  cases: [
    {
      id: "П-01",
      type: "card_delivery",
      crm: {
        status: "in_transit",
        plannedBy: null,
        acceptedAt: null,
        note: "",
      },
      messages: [],
    },
  ],
};

describe("наборы случаев", () => {
  it("не принимает ссылку, которая не похожа на идентификатор", () => {
    expect(parseDatasetId("не-ссылка")).toBeNull();
    expect(parseDatasetId("507f1f77bcf86cd799439011")).not.toBeNull();
  });

  it("укладывает название копии в допустимую длину", () => {
    const title = copyTitle("я".repeat(100));
    expect(title.startsWith("Копия — ")).toBe(true);
    expect(title.length).toBe(100);
  });

  it("объясняет, почему правка не применилась", () => {
    expect(updateMiss(null)).toEqual({ status: 404, message: "Набор не найден" });
    expect(updateMiss({ isDemo: true })).toEqual({
      status: 403,
      message: "Пример из задания нельзя менять. Сделайте копию",
    });
    expect(updateMiss({ isDemo: false })).toEqual({
      status: 409,
      message: "Набор изменил кто-то другой. Обновите страницу",
    });
  });

  it("просит версию и показывает ошибку поля по-русски", () => {
    const missingVersion = parseUpdateBody(dataset);
    expect(missingVersion.ok).toBe(false);
    if (!missingVersion.ok) {
      expect(missingVersion.errors.some((error) => error.path === "version")).toBe(true);
    }

    const badCase = parseUpdateBody({
      ...dataset,
      version: 1,
      cases: [{ ...dataset.cases[0], id: "" }],
    });
    expect(badCase.ok).toBe(false);
    if (!badCase.ok) {
      expect(badCase.errors.some((error) => error.path === "cases.0.id")).toBe(true);
      expect(badCase.errors.some((error) => error.message.includes("номер"))).toBe(true);
    }
  });
});
