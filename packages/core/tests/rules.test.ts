import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RULE_CATALOG,
  assessCase,
  parseDataset,
  sortAssessments,
  type ChatClaim,
  type DatasetInput,
  type SupportCase,
} from "../src/index.js";

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data",
);

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

function findCase(data: DatasetInput, id: string): SupportCase {
  const found = data.cases.find((item) => item.id === id);
  if (found === undefined) {
    throw new Error(`В наборе нет случая ${id}`);
  }
  return found;
}

function claim(
  caseId: string,
  kind: ChatClaim["kind"],
  extra: Partial<Pick<ChatClaim, "newEta" | "quote" | "confidence" | "summary">> = {},
): ChatClaim {
  return {
    caseId,
    messageIndex: 0,
    kind,
    newEta: extra.newEta ?? null,
    quote: extra.quote ?? "Цитата из сообщения",
    summary: extra.summary ?? "Краткий пересказ факта.",
    confidence: extra.confidence ?? "high",
  };
}

const task = readDataset("input.json");
const extra = readDataset("input-extra.json");
const snapshotAt = task.snapshotAt;

describe("правила по четырём случаям задания", () => {
  const withAi = [
    assessCase(
      findCase(task, "С-17"),
      snapshotAt,
      [claim("С-17", "documents_sent")],
    ),
    assessCase(
      findCase(task, "С-24"),
      snapshotAt,
      [claim("С-24", "manager_agreed")],
    ),
    assessCase(findCase(task, "П-08"), snapshotAt, [
      claim("П-08", "delivery_delayed", {
        newEta: "2026-11-16T13:00:00+03:00",
      }),
    ]),
    assessCase(
      findCase(task, "П-09"),
      snapshotAt,
      [claim("П-09", "delivery_received")],
    ),
  ];

  it("считает срочность с фактами из переписки", () => {
    const byId = Object.fromEntries(withAi.map((item) => [item.caseId, item]));
    expect(byId["С-17"]?.priority).toBe("high");
    expect(byId["С-17"]?.firedRules).toContain("ONB-2");
    expect(byId["С-24"]?.priority).toBe("high");
    expect(byId["С-24"]?.firedRules).toContain("OFF-2");
    expect(byId["П-08"]?.priority).toBe("critical");
    expect(byId["П-08"]?.firedRules).toEqual(
      expect.arrayContaining(["DEL-1", "DEL-2"]),
    );
    expect(byId["П-09"]?.priority).toBe("none");
    expect(byId["П-09"]?.needsAction).toBe(false);
  });

  it("сортирует случаи: П-08, С-24, С-17, П-09", () => {
    expect(sortAssessments(withAi).map((item) => item.caseId)).toEqual([
      "П-08",
      "С-24",
      "С-17",
      "П-09",
    ]);
  });

  it("без ИИ не теряет случаи с сообщениями и сохраняет порядок", () => {
    const withoutAi = task.cases.map((item) =>
      assessCase(item, snapshotAt, null),
    );
    const byId = Object.fromEntries(
      withoutAi.map((item) => [item.caseId, item]),
    );

    expect(byId["П-08"]?.priority).toBe("critical");
    expect(byId["С-24"]?.priority).toBe("high");
    expect(byId["С-17"]?.priority).toBe("high");
    expect(byId["П-09"]?.priority).toBe("medium");
    expect(sortAssessments(withoutAi).map((item) => item.caseId)).toEqual([
      "П-08",
      "С-24",
      "С-17",
      "П-09",
    ]);

    for (const item of withoutAi) {
      expect(
        item.chatFacts.some((line) => line.startsWith("Не обработано ИИ")),
      ).toBe(true);
    }
  });
});

describe("граничные случаи", () => {
  it("считает срок, который наступил ровно в момент сводки, критичным", () => {
    const delivery = findCase(task, "П-08");
    if (delivery.type !== "card_delivery" || delivery.crm.plannedBy === null) {
      throw new Error("У П-08 должен быть срок доставки");
    }
    const result = assessCase(delivery, delivery.crm.plannedBy, []);
    expect(result.priority).toBe("critical");
    expect(result.firedRules).toContain("DEL-1");
  });

  it("до срока учитывает сообщение о задержке только вместе с фактом", () => {
    const earlier = "2026-11-16T09:00:00+03:00";
    const delivery = findCase(task, "П-08");
    const withDelay = assessCase(delivery, earlier, [
      claim("П-08", "delivery_delayed", {
        newEta: "2026-11-16T13:00:00+03:00",
      }),
    ]);
    const withoutAi = assessCase(delivery, earlier, null);

    expect(withDelay.priority).toBe("critical");
    expect(withDelay.firedRules).toContain("DEL-2");
    expect(withoutAi.priority).toBe("medium");
    expect(withoutAi.firedRules).toContain("GEN-3");
  });

  it("повышает увольнение, если последний день уже прошёл", () => {
    const source = findCase(task, "С-24");
    if (source.type !== "offboarding") {
      throw new Error("С-24 должен быть увольнением");
    }
    const result = assessCase(
      {
        ...source,
        crm: { ...source.crm, lastWorkDate: "2026-11-15", managerConfirmed: false },
      },
      snapshotAt,
      [],
    );
    expect(result.priority).toBe("critical");
    expect(result.firedRules).toContain("OFF-1");
  });

  it("повышает оформление, если выход сегодня, а документов нет", () => {
    const source = findCase(task, "С-17");
    if (source.type !== "onboarding") {
      throw new Error("С-17 должен быть оформлением");
    }
    const result = assessCase(
      {
        ...source,
        crm: { ...source.crm, firstShiftDate: "2026-11-16", documentsStatus: "pending" },
      },
      snapshotAt,
      [],
    );
    expect(result.priority).toBe("critical");
    expect(result.firedRules).toContain("ONB-1");
  });

  it("оставляет проблему после приёмки на среднем уровне", () => {
    const result = assessCase(findCase(extra, "П-42"), snapshotAt, [
      claim("П-42", "delivery_problem", { quote: "Пришло 48 карт вместо 50" }),
    ]);
    expect(result.priority).toBe("medium");
    expect(result.firedRules).toContain("DEL-4");
  });

  it("повышает поставку, если получатель пишет, что карты уже у него", () => {
    const result = assessCase(findCase(extra, "П-43"), snapshotAt, [
      claim("П-43", "delivery_received", { quote: "Карты уже у нас" }),
    ]);
    expect(result.priority).toBe("high");
    expect(result.firedRules).toContain("DEL-5");
  });

  it("просит прочитать неоднозначное сообщение", () => {
    const result = assessCase(findCase(task, "С-17"), snapshotAt, [
      claim("С-17", "other", {
        confidence: "low",
        quote: "Не знаю, отправлял ли документы",
      }),
    ]);
    expect(
      result.toCheck.some((line) =>
        line.startsWith("Прочитать сообщение вручную"),
      ),
    ).toBe(true);
  });

  it("не включает ручное чтение, если сообщений нет", () => {
    const result = assessCase(findCase(extra, "С-31"), snapshotAt, null);
    expect(result.firedRules).not.toContain("GEN-3");
    expect(result.priority).toBe("none");
  });

  it("использует только коды из справочника", () => {
    const known = new Set(RULE_CATALOG.map((rule) => rule.code));
    const datasets = [task, extra];
    for (const dataset of datasets) {
      for (const item of dataset.cases) {
        const claimSets: Array<ChatClaim[] | null> = [null, []];
        for (const claims of claimSets) {
          for (const code of assessCase(item, dataset.snapshotAt, claims).firedRules) {
            expect(known.has(code)).toBe(true);
          }
        }
      }
    }
  });

  it("не меняет исходный список при сортировке", () => {
    const items = task.cases.map((item) => assessCase(item, snapshotAt, null));
    const before = items.map((item) => item.caseId);
    sortAssessments(items);
    expect(items.map((item) => item.caseId)).toEqual(before);
  });
});
