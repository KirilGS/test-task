import "./e2e-env";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { AiConfig } from "@support-summary/core";
import { MongoClient } from "mongodb";
import { databaseName } from "../src/config/env";
import { configureApp } from "../src/security/configure-app";
import { AI_CONFIG, AI_FETCH, AI_LIMIT_MESSAGE } from "../src/summaries/summaries.tokens";
import { AppModule } from "../src/app.module";

jest.setTimeout(60000);

const TEST_URI = "mongodb://127.0.0.1:27017/support_summary_test";
const FAKE_KEY = "fake-key-e2e";
const SITE_PASSWORD = "proverka";

function withAuth(): { authorization: string } {
  return {
    authorization: `Basic ${Buffer.from(`гость:${SITE_PASSWORD}`).toString("base64")}`,
  };
}

const fakeConfig: AiConfig = {
  apiKey: FAKE_KEY,
  baseUrl: "https://example.test/v1",
  model: "test-model",
  timeoutMs: 1000,
};

const deliveryCase = {
  id: "П-01",
  type: "card_delivery",
  crm: {
    status: "in_transit",
    plannedBy: null,
    acceptedAt: null,
    note: "",
  },
  messages: [],
};

type DatasetCard = {
  id: string;
  slug: string | null;
  title: string;
  isDemo: boolean;
};

type DatasetBody = DatasetCard & {
  snapshotAt: string;
  cases: unknown[];
  version: number;
};

type SummaryBody = {
  id: string;
  mode: string;
  assessments: Array<{ caseId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDatasetCard(value: unknown): value is DatasetCard {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (typeof value.slug === "string" || value.slug === null) &&
    typeof value.title === "string" &&
    typeof value.isDemo === "boolean"
  );
}

function isDatasetBody(value: unknown): value is DatasetBody {
  if (!isRecord(value)) {
    return false;
  }
  const snapshotAt = value.snapshotAt;
  const cases = value.cases;
  const version = value.version;
  return (
    isDatasetCard(value) &&
    typeof snapshotAt === "string" &&
    Array.isArray(cases) &&
    typeof version === "number"
  );
}

function isSummaryBody(value: unknown): value is SummaryBody {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.mode !== "string") {
    return false;
  }
  if (!Array.isArray(value.assessments)) {
    return false;
  }
  return value.assessments.every(
    (item) => isRecord(item) && typeof item.caseId === "string",
  );
}

function readJson(response: { json: () => unknown }): unknown {
  return response.json();
}

function createFakeFetch(): { fetchFn: typeof fetch; calls: { count: number } } {
  const calls = { count: 0 };
  const fetchFn: typeof fetch = async () => {
    calls.count += 1;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"claims":[]}' } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { fetchFn, calls };
}

async function createApp(fetchFn: typeof fetch): Promise<NestFastifyApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AI_CONFIG)
    .useValue(fakeConfig)
    .overrideProvider(AI_FETCH)
    .useValue(fetchFn)
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function demoCounts(): Promise<{ task: number; extra: number }> {
  const client = new MongoClient(TEST_URI);
  await client.connect();
  try {
    const db = client.db(databaseName(TEST_URI));
    return {
      task: await db.collection("datasets").countDocuments({ slug: "demo-task" }),
      extra: await db.collection("datasets").countDocuments({ slug: "demo-extra" }),
    };
  } finally {
    await client.close();
  }
}

async function dropTestDatabase(): Promise<void> {
  if (databaseName(TEST_URI) !== "support_summary_test") {
    throw new Error("Тестовая база указана неверно.");
  }
  const client = new MongoClient(TEST_URI);
  await client.connect();
  try {
    await client.db("support_summary_test").dropDatabase();
  } finally {
    await client.close();
  }
}

describe("сервер", () => {
  let app: NestFastifyApplication;
  const ai = createFakeFetch();

  beforeAll(async () => {
    const first = await createApp(ai.fetchFn);
    await first.close();
    app = await createApp(ai.fetchFn);
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase();
  });

  it("создаёт два демонстрационных набора и не плодит копии", async () => {
    const response = await app.inject({ method: "GET", url: "/api/datasets", headers: withAuth() });
    expect(response.statusCode).toBe(200);
    const payload = readJson(response);
    expect(Array.isArray(payload)).toBe(true);
    if (!Array.isArray(payload)) {
      return;
    }
    const demos = payload.filter(isDatasetCard).filter((item) => item.isDemo);
    expect(demos.map((item) => item.slug).sort()).toEqual(["demo-extra", "demo-task"]);
    expect(await demoCounts()).toEqual({ task: 1, extra: 1 });
  });

  it("не даёт менять пример, а копию даёт", async () => {
    const list = await app.inject({ method: "GET", url: "/api/datasets", headers: withAuth() });
    const payload = readJson(list);
    if (!Array.isArray(payload)) {
      throw new Error("Список наборов пришёл в неожиданном виде");
    }
    const card = payload.filter(isDatasetCard).find((item) => item.slug === "demo-task");
    if (card === undefined) {
      throw new Error("Нет набора «Случаи из задания»");
    }

    const loaded = await app.inject({
      method: "GET",
      url: `/api/datasets/${card.id}`,
      headers: withAuth(),
    });
    const dataset = readJson(loaded);
    if (!isDatasetBody(dataset)) {
      throw new Error("Набор пришёл в неожиданном виде");
    }

    const denied = await app.inject({
      method: "PUT",
      url: `/api/datasets/${dataset.id}`,
      headers: withAuth(),
      payload: {
        title: dataset.title,
        snapshotAt: dataset.snapshotAt,
        cases: dataset.cases,
        version: dataset.version,
      },
    });
    expect(denied.statusCode).toBe(403);
    expect(JSON.stringify(readJson(denied))).toContain("Пример из задания нельзя менять");

    const copy = await app.inject({
      method: "POST",
      url: `/api/datasets/${dataset.id}/copy`,
      headers: withAuth(),
    });
    expect(copy.statusCode).toBe(201);
    const copied = readJson(copy);
    if (!isDatasetBody(copied)) {
      throw new Error("Копия пришла в неожиданном виде");
    }
    expect(copied.isDemo).toBe(false);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/datasets/${copied.id}`,
      headers: withAuth(),
      payload: {
        title: "Копия для проверки",
        snapshotAt: copied.snapshotAt,
        cases: copied.cases,
        version: copied.version,
      },
    });
    expect(updated.statusCode).toBe(200);
    const saved = readJson(updated);
    if (!isDatasetBody(saved)) {
      throw new Error("Сохранённая копия пришла в неожиданном виде");
    }
    expect(saved.version).toBe(copied.version + 1);
    expect(saved.title).toBe("Копия для проверки");
  });

  it("второй одновременный запрос с той же версией отклоняет", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/datasets",
      headers: withAuth(),
      payload: {
        title: "Для конфликта",
        snapshotAt: "2026-11-16T10:00:00+03:00",
        cases: [deliveryCase],
      },
    });
    expect(created.statusCode).toBe(201);
    const dataset = readJson(created);
    if (!isDatasetBody(dataset)) {
      throw new Error("Новый набор пришёл в неожиданном виде");
    }

    const body = {
      title: dataset.title,
      snapshotAt: dataset.snapshotAt,
      cases: dataset.cases,
      version: dataset.version,
    };
    const first = await app.inject({
      method: "PUT",
      url: `/api/datasets/${dataset.id}`,
      headers: withAuth(),
      payload: body,
    });
    const second = await app.inject({
      method: "PUT",
      url: `/api/datasets/${dataset.id}`,
      headers: withAuth(),
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(JSON.stringify(readJson(second))).toContain("Набор изменил кто-то другой");
  });

  it("показывает ошибку поля по-русски", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/datasets",
      headers: withAuth(),
      payload: {
        title: "",
        snapshotAt: "2026-11-16T10:00:00+03:00",
        cases: [deliveryCase],
      },
    });
    expect(response.statusCode).toBe(400);
    const payload = readJson(response);
    expect(isRecord(payload) && Array.isArray(payload.errors)).toBe(true);
    if (!isRecord(payload) || !Array.isArray(payload.errors)) {
      return;
    }
    const titleError = payload.errors.find(
      (error) => isRecord(error) && error.path === "title" && typeof error.message === "string",
    );
    expect(titleError).toBeDefined();
    if (isRecord(titleError) && typeof titleError.message === "string") {
      expect(titleError.message).toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("строит сводку без ИИ в порядке П-08, С-24, С-17, П-09", async () => {
    const task = await demoTask(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/summaries",
      headers: withAuth(),
      payload: { datasetId: task.id },
    });
    expect(response.statusCode).toBe(201);
    const summary = readJson(response);
    if (!isSummaryBody(summary)) {
      throw new Error("Сводка пришла в неожиданном виде");
    }
    expect(summary.mode).toBe("no-ai");
    expect(summary.assessments.map((item) => item.caseId)).toEqual(["П-08", "С-24", "С-17", "П-09"]);
  });

  it("вызывает ИИ для каждого случая с сообщениями", async () => {
    const task = await demoTask(app);
    const before = ai.calls.count;
    const response = await app.inject({
      method: "POST",
      url: "/api/summaries/ai",
      headers: withAuth(),
      payload: { datasetId: task.id },
    });
    expect(response.statusCode).toBe(201);
    const summary = readJson(response);
    if (!isSummaryBody(summary)) {
      throw new Error("Сводка с ИИ пришла в неожиданном виде");
    }
    expect(summary.mode).toBe("ai");
    expect(ai.calls.count - before).toBe(task.messages);
  });

  it("останавливает второй запрос к ИИ, когда часовой предел равен одному", async () => {
    const task = await demoTask(app);
    const second = await app.inject({
      method: "POST",
      url: "/api/summaries/ai",
      headers: withAuth(),
      payload: { datasetId: task.id },
    });
    expect(second.statusCode).toBe(429);
    expect(JSON.stringify(readJson(second))).toContain(AI_LIMIT_MESSAGE);
  });

  it("принимает отзыв и показывает его в счётчике", async () => {
    const task = await demoTask(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/summaries",
      headers: withAuth(),
      payload: { datasetId: task.id },
    });
    const summary = readJson(created);
    if (!isSummaryBody(summary)) {
      throw new Error("Сводка для отзыва пришла в неожиданном виде");
    }

    const missed = await app.inject({
      method: "POST",
      url: `/api/summaries/${summary.id}/feedback`,
      headers: withAuth(),
      payload: { caseId: "П-08", verdict: "missed" },
    });
    expect(missed.statusCode).toBe(400);
    expect(JSON.stringify(readJson(missed))).toContain("Опишите, что пропущено");

    const saved = await app.inject({
      method: "POST",
      url: `/api/summaries/${summary.id}/feedback`,
      headers: withAuth(),
      payload: { caseId: "П-08", verdict: "correct", comment: "Порядок верный" },
    });
    expect(saved.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: `/api/summaries?datasetId=${task.id}`,
      headers: withAuth(),
    });
    const payload = readJson(list);
    if (!Array.isArray(payload)) {
      throw new Error("Список сводок пришёл в неожиданном виде");
    }
    const item = payload.find((entry) => isRecord(entry) && entry.id === summary.id);
    expect(isRecord(item) && isRecord(item.feedback) && item.feedback.correct).toBe(1);
  });

  it("отдаёт сводки без набора и комментарии к ошибкам", async () => {
    const task = await demoTask(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/summaries",
      headers: withAuth(),
      payload: { datasetId: task.id },
    });
    const summary = readJson(created);
    if (!isSummaryBody(summary)) {
      throw new Error("Сводка для списка пришла в неожиданном виде");
    }

    const saved = await app.inject({
      method: "POST",
      url: `/api/summaries/${summary.id}/feedback`,
      headers: withAuth(),
      payload: { caseId: "С-24", verdict: "wrong", comment: "Срок указан неверно" },
    });
    expect(saved.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/summaries",
      headers: withAuth(),
    });
    expect(list.statusCode).toBe(200);
    const payload = readJson(list);
    if (!Array.isArray(payload)) {
      throw new Error("Общий список сводок пришёл в неожиданном виде");
    }
    const item = payload.find((entry) => isRecord(entry) && entry.id === summary.id);
    expect(isRecord(item) && isRecord(item.feedback) && item.feedback.wrong).toBe(1);
    expect(isRecord(item) && Array.isArray(item.remarks)).toBe(true);
    if (!isRecord(item) || !Array.isArray(item.remarks)) {
      return;
    }
    const remark = item.remarks.find(
      (entry) => isRecord(entry) && entry.comment === "Срок указан неверно",
    );
    expect(isRecord(remark) && remark.verdict).toBe("wrong");
    expect(isRecord(remark) && remark.caseId).toBe("С-24");
  });

  it("не показывает фиктивный ключ в справочнике", async () => {
    const response = await app.inject({ method: "GET", url: "/api/meta", headers: withAuth() });
    expect(response.statusCode).toBe(200);
    const text = JSON.stringify(readJson(response));
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain("example.test");
    expect(text).toContain("test-model");
  });

  it("с паролем закрывает запросы, кроме проверки работоспособности", async () => {
    const health = await app.inject({ method: "GET", url: "/api/health" });
    const closed = await app.inject({ method: "GET", url: "/api/datasets" });
    expect(health.statusCode).toBe(200);
    expect(closed.statusCode).toBe(401);
    expect(closed.headers["www-authenticate"]).toBe(
      'Basic realm="Support summary", charset="UTF-8"',
    );
  });
});

async function demoTask(
  app: NestFastifyApplication,
): Promise<{ id: string; messages: number }> {
  const list = await app.inject({ method: "GET", url: "/api/datasets", headers: withAuth() });
  const payload = readJson(list);
  if (!Array.isArray(payload)) {
    throw new Error("Список наборов пришёл в неожиданном виде");
  }
  const card = payload.filter(isDatasetCard).find((item) => item.slug === "demo-task");
  if (card === undefined) {
    throw new Error("Нет набора «Случаи из задания»");
  }
  const loaded = await app.inject({
    method: "GET",
    url: `/api/datasets/${card.id}`,
    headers: withAuth(),
  });
  const dataset = readJson(loaded);
  if (!isDatasetBody(dataset)) {
    throw new Error("Набор пришёл в неожиданном виде");
  }
  const messages = dataset.cases.filter(
    (item) => isRecord(item) && Array.isArray(item.messages) && item.messages.length > 0,
  ).length;
  return { id: card.id, messages };
}
