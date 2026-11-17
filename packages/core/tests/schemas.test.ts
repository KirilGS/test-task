import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDataset, type DatasetInput } from "../src/index.js";

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data",
);

function readDataset(fileName: string): unknown {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8"));
}

function requireDataset(fileName: string): DatasetInput {
  const parsed = parseDataset(readDataset(fileName));
  if (!parsed.ok) {
    throw new Error(
      parsed.errors.map((error) => `${error.path}: ${error.message}`).join("\n"),
    );
  }
  return parsed.data;
}

const cyrillic = /[а-яё]/i;

describe("parseDataset", () => {
  it("принимает оба демонстрационных файла", () => {
    expect(parseDataset(readDataset("input.json")).ok).toBe(true);
    expect(parseDataset(readDataset("input-extra.json")).ok).toBe(true);
  });

  it("в случаях из задания ровно четыре номера", () => {
    const data = requireDataset("input.json");
    expect(data.cases.map((item) => item.id)).toEqual([
      "С-17",
      "С-24",
      "П-08",
      "П-09",
    ]);
  });

  it("не принимает приёмку без времени", () => {
    const data = requireDataset("input.json");
    const delivery = data.cases.find((item) => item.id === "П-09");
    if (delivery?.type !== "card_delivery") {
      throw new Error("П-09 должен быть поставкой карт");
    }

    const invalid = {
      ...data,
      cases: [
        {
          ...delivery,
          crm: { ...delivery.crm, acceptedAt: null },
        },
      ],
    };
    const parsed = parseDataset(invalid);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(
        parsed.errors.some((error) => error.path.endsWith("crm.acceptedAt")),
      ).toBe(true);
    }
  });

  it("не принимает два случая с одним номером", () => {
    const data = requireDataset("input.json");
    const first = data.cases[0];
    if (first === undefined) {
      throw new Error("В наборе нет случаев");
    }

    const parsed = parseDataset({
      ...data,
      cases: [first, { ...first }],
    });

    expect(parsed.ok).toBe(false);
  });

  it("требует момент сводки", () => {
    const data = requireDataset("input.json");
    const { snapshotAt: _snapshotAt, ...withoutSnapshot } = data;
    const parsed = parseDataset(withoutSnapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((error) => error.path === "snapshotAt")).toBe(
        true,
      );
    }
  });

  it("пишет ошибки по-русски", () => {
    const data = requireDataset("input.json");
    const first = data.cases[0];
    const delivery = data.cases.find((item) => item.id === "П-09");
    if (first === undefined || delivery?.type !== "card_delivery") {
      throw new Error("Демонстрационные случаи не найдены");
    }

    const samples = [
      {},
      { ...data, snapshotAt: undefined },
      {
        ...data,
        cases: [
          {
            ...delivery,
            crm: { ...delivery.crm, acceptedAt: null },
          },
        ],
      },
      { ...data, cases: [first, { ...first }] },
      {
        ...data,
        cases: [
          {
            ...first,
            messages: [{ author: "employee", text: "", sentAt: null }],
          },
        ],
      },
    ];

    const messages = samples.flatMap((sample) => {
      const parsed = parseDataset(sample);
      return parsed.ok ? [] : parsed.errors.map((error) => error.message);
    });

    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).toMatch(cyrillic);
    }
  });
});
