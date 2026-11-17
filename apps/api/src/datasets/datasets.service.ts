import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseDataset, type FieldError } from "@support-summary/core";
import { type Collection, type ObjectId, type WithId } from "mongodb";
import type { AppEnv } from "../config/env";
import { MONGO_DB } from "../mongo/mongo.tokens";
import type { Db } from "mongodb";
import {
  copyTitle,
  parseDatasetId,
  parseUpdateBody,
  updateMiss,
} from "./datasets.logic";
import type {
  DatasetDocument,
  DatasetListItem,
  DatasetView,
} from "./datasets.types";

const DATASET_LIMIT = 500;

const DEMOS = [
  { slug: "demo-task", fileName: "input.json" },
  { slug: "demo-extra", fileName: "input-extra.json" },
] as const;

type DatasetListRaw = {
  _id: ObjectId;
  slug: string | null;
  title: string;
  isDemo: boolean;
  snapshotAt: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  casesCount: number;
};

@Injectable()
export class DatasetsService implements OnModuleInit {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const collection = this.collection();
    await collection.createIndex(
      { slug: 1 },
      {
        unique: true,
        partialFilterExpression: { slug: { $type: "string" } },
      },
    );
    await collection.createIndex({ isDemo: -1, updatedAt: -1 });
    for (const demo of DEMOS) {
      await this.seedDemo(demo.slug, demo.fileName);
    }
  }

  async list(): Promise<DatasetListItem[]> {
    const rows = await this.collection()
      .aggregate<DatasetListRaw>([
        { $sort: { isDemo: -1, updatedAt: -1 } },
        { $limit: 50 },
        {
          $project: {
            slug: 1,
            title: 1,
            isDemo: 1,
            snapshotAt: 1,
            version: 1,
            createdAt: 1,
            updatedAt: 1,
            casesCount: { $size: "$cases" },
          },
        },
      ])
      .toArray();

    return rows.map((row) => ({
      id: row._id.toHexString(),
      slug: row.slug,
      title: row.title,
      isDemo: row.isDemo,
      snapshotAt: row.snapshotAt,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      casesCount: row.casesCount,
    }));
  }

  async get(id: string): Promise<DatasetView> {
    const document = await this.collection().findOne({ _id: this.objectId(id) });
    if (document === null) {
      this.fail(HttpStatus.NOT_FOUND, "Набор не найден");
    }
    return toView(document);
  }

  async create(raw: unknown): Promise<DatasetView> {
    const parsed = parseDataset(raw);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const collection = this.collection();
    const count = await collection.countDocuments();
    if (count >= DATASET_LIMIT) {
      this.fail(
        HttpStatus.CONFLICT,
        "Достигнут предел числа наборов. Удалите ненужные наборы",
      );
    }

    const now = new Date();
    const inserted = await collection.insertOne({
      slug: null,
      title: parsed.data.title,
      isDemo: false,
      snapshotAt: parsed.data.snapshotAt,
      cases: parsed.data.cases,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    return toView({
      _id: inserted.insertedId,
      slug: null,
      title: parsed.data.title,
      isDemo: false,
      snapshotAt: parsed.data.snapshotAt,
      cases: parsed.data.cases,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  async copy(id: string): Promise<DatasetView> {
    const source = await this.collection().findOne({ _id: this.objectId(id) });
    if (source === null) {
      this.fail(HttpStatus.NOT_FOUND, "Набор не найден");
    }

    return this.create({
      title: copyTitle(source.title),
      snapshotAt: source.snapshotAt,
      cases: source.cases,
    });
  }

  async update(id: string, raw: unknown): Promise<DatasetView> {
    const parsed = parseUpdateBody(raw);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const objectId = this.objectId(id);
    const collection = this.collection();
    const result = await collection.updateOne(
      { _id: objectId, version: parsed.data.version, isDemo: false },
      {
        $set: {
          title: parsed.data.title,
          snapshotAt: parsed.data.snapshotAt,
          cases: parsed.data.cases,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
    );

    if (result.matchedCount === 0) {
      const current = await collection.findOne({ _id: objectId });
      const miss = updateMiss(current);
      this.fail(miss.status, miss.message);
    }

    const saved = await collection.findOne({ _id: objectId });
    if (saved === null) {
      this.fail(HttpStatus.NOT_FOUND, "Набор не найден");
    }
    return toView(saved);
  }

  async remove(id: string): Promise<{ id: string }> {
    const objectId = this.objectId(id);
    const collection = this.collection();
    const result = await collection.deleteOne({ _id: objectId, isDemo: false });
    if (result.deletedCount === 1) {
      return { id: objectId.toHexString() };
    }

    const current = await collection.findOne({ _id: objectId });
    if (current?.isDemo === true) {
      this.fail(HttpStatus.FORBIDDEN, "Пример из задания нельзя менять. Сделайте копию");
    }
    this.fail(HttpStatus.NOT_FOUND, "Набор не найден");
  }

  private collection(): Collection<DatasetDocument> {
    return this.db.collection<DatasetDocument>("datasets");
  }

  private async seedDemo(slug: string, fileName: string): Promise<void> {
    const filePath = path.join(this.config.get("DATA_DIR", { infer: true }), fileName);
    const raw = await readJson(filePath);
    const parsed = parseDataset(raw);
    if (!parsed.ok) {
      const details = parsed.errors.map((error) => error.message).join(" ");
      throw new Error(`Демонстрационный набор «${fileName}» заполнен неверно. ${details}`);
    }

    const now = new Date();
    try {
      await this.collection().updateOne(
        { slug },
        {
          $setOnInsert: {
            slug,
            title: parsed.data.title,
            isDemo: true,
            snapshotAt: parsed.data.snapshotAt,
            cases: parsed.data.cases,
            version: 1,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
  }

  private objectId(id: string): ObjectId {
    const parsed = parseDatasetId(id);
    if (parsed === null) {
      this.fail(HttpStatus.BAD_REQUEST, "Неверная ссылка на набор");
    }
    return parsed;
  }

  private invalid(errors: FieldError[]): never {
    throw new HttpException(
      { message: "Проверьте заполнение полей", errors },
      HttpStatus.BAD_REQUEST,
    );
  }

  private fail(status: HttpStatus, message: string): never {
    throw new HttpException({ message }, status);
  }
}

function toView(document: WithId<DatasetDocument>): DatasetView {
  return {
    id: document._id.toHexString(),
    slug: document.slug,
    title: document.title,
    isDemo: document.isDemo,
    snapshotAt: document.snapshotAt,
    cases: document.cases,
    version: document.version,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function readJson(filePath: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    throw new Error("Не удалось прочитать демонстрационный набор.");
  }

  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    throw new Error("Демонстрационный набор записан не в формате JSON.");
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
