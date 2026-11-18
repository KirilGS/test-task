import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from "@nestjs/common";
import {
  buildSummary,
  type AiConfig,
  type FieldError,
} from "@support-summary/core";
import { ObjectId, type Collection, type WithId } from "mongodb";
import { DatasetsService } from "../datasets/datasets.service";
import { MONGO_DB } from "../mongo/mongo.tokens";
import { AiSettingsService } from "../settings/ai-settings.service";
import type { Db } from "mongodb";
import { AiDailyLimit } from "./ai-daily-limit";
import {
  parseFeedback,
  parseSummaryId,
  parseSummaryListQuery,
  parseSummaryRequest,
} from "./summaries.logic";
import { AI_CONFIG, AI_FETCH } from "./summaries.tokens";
import type {
  SummaryDocument,
  SummaryListItem,
  SummaryRemark,
  SummaryView,
} from "./summaries.types";

const NOT_CONFIGURED =
  "ИИ не подключён. Откройте «Подключение ИИ», введите ключ и модель, затем сформируйте сводку ещё раз";
const SUMMARY_MISSING = "Сводка не найдена";
const FEEDBACK_LIMIT = "Для этой сводки собрано максимальное число отзывов";

type SummaryListRaw = {
  _id: ObjectId;
  datasetId: ObjectId;
  datasetTitle: string;
  snapshotAt: string;
  mode: "ai" | "no-ai";
  createdAt: Date;
  rejectedByCase: Record<string, number>;
  warnings: string[];
  correct: number;
  wrong: number;
  missed: number;
  remarks: unknown;
};

@Injectable()
export class SummariesService implements OnModuleInit {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly datasets: DatasetsService,
    private readonly dailyLimit: AiDailyLimit,
    private readonly settings: AiSettingsService,
    @Inject(AI_CONFIG) private readonly aiConfig: AiConfig | null,
    @Inject(AI_FETCH) private readonly fetchFn: typeof fetch,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collection().createIndex({ datasetId: 1, createdAt: -1 });
    await this.collection().createIndex({ createdAt: -1 });
  }

  async create(raw: unknown, mode: "ai" | "no-ai"): Promise<SummaryView> {
    const parsed = parseSummaryRequest(raw);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const dataset = await this.datasets.get(parsed.data.datasetId);
    const ai = await this.aiFor(mode);
    const result = await buildSummary(
      {
        title: dataset.title,
        snapshotAt: dataset.snapshotAt,
        cases: dataset.cases,
      },
      {
        snapshotAt: parsed.data.snapshotAt,
        ai,
        fetchFn: this.fetchFn,
      },
    );

    const now = new Date();
    const document: SummaryDocument = {
      datasetId: new ObjectId(dataset.id),
      datasetTitle: dataset.title,
      snapshotAt: result.snapshotAt,
      mode: result.mode,
      createdAt: now,
      assessments: result.assessments,
      claimsByCase: result.claimsByCase,
      rejectedByCase: result.rejectedByCase,
      warnings: result.warnings,
      markdown: result.markdown,
      feedback: [],
    };
    const inserted = await this.collection().insertOne(document);
    return toView({ _id: inserted.insertedId, ...document });
  }

  async list(datasetId: unknown, limit: unknown): Promise<SummaryListItem[]> {
    const parsed = parseSummaryListQuery(datasetId, limit);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const filter =
      parsed.datasetId === null ? {} : { datasetId: new ObjectId(parsed.datasetId) };
    const rows = await this.collection()
      .aggregate<SummaryListRaw>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $limit: parsed.limit },
        {
          $project: {
            datasetId: 1,
            datasetTitle: 1,
            snapshotAt: 1,
            mode: 1,
            createdAt: 1,
            rejectedByCase: 1,
            warnings: 1,
            correct: verdictCount("correct"),
            wrong: verdictCount("wrong"),
            missed: verdictCount("missed"),
            remarks: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$feedback", []] },
                    as: "item",
                    cond: { $in: ["$$item.verdict", ["wrong", "missed"]] },
                  },
                },
                as: "item",
                in: {
                  caseId: "$$item.caseId",
                  verdict: "$$item.verdict",
                  comment: "$$item.comment",
                },
              },
            },
          },
        },
      ])
      .toArray();

    return rows.map((row) => ({
      id: row._id.toHexString(),
      datasetId: row.datasetId.toHexString(),
      datasetTitle: row.datasetTitle,
      snapshotAt: row.snapshotAt,
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      rejectedByCase: row.rejectedByCase,
      warnings: row.warnings,
      feedback: { correct: row.correct, wrong: row.wrong, missed: row.missed },
      remarks: remarksFrom(row.remarks),
    }));
  }

  async get(id: string): Promise<SummaryView> {
    const document = await this.collection().findOne({ _id: this.objectId(id) });
    if (document === null) {
      this.fail(HttpStatus.NOT_FOUND, SUMMARY_MISSING);
    }
    return toView(document);
  }

  async addFeedback(id: string, raw: unknown): Promise<SummaryView> {
    const parsed = parseFeedback(raw);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const objectId = this.objectId(id);
    const result = await this.collection().updateOne(
      { _id: objectId, "feedback.199": { $exists: false } },
      {
        $push: {
          feedback: {
            caseId: parsed.data.caseId,
            verdict: parsed.data.verdict,
            comment: parsed.data.comment,
            createdAt: new Date(),
          },
        },
      },
    );

    if (result.matchedCount === 0) {
      const current = await this.collection().findOne({ _id: objectId });
      if (current === null) {
        this.fail(HttpStatus.NOT_FOUND, SUMMARY_MISSING);
      }
      this.fail(HttpStatus.CONFLICT, FEEDBACK_LIMIT);
    }

    const saved = await this.collection().findOne({ _id: objectId });
    if (saved === null) {
      this.fail(HttpStatus.NOT_FOUND, SUMMARY_MISSING);
    }
    return toView(saved);
  }

  private async aiFor(mode: "ai" | "no-ai"): Promise<AiConfig | null> {
    if (mode === "no-ai") {
      return null;
    }
    const configured = this.aiConfig ?? (await this.settings.resolve());
    if (configured === null) {
      this.fail(HttpStatus.BAD_REQUEST, NOT_CONFIGURED);
    }
    this.dailyLimit.take();
    return configured;
  }

  private collection(): Collection<SummaryDocument> {
    return this.db.collection<SummaryDocument>("summaries");
  }

  private objectId(id: string): ObjectId {
    if (parseSummaryId(id) === null) {
      this.fail(HttpStatus.BAD_REQUEST, "Неверная ссылка на сводку");
    }
    return new ObjectId(id);
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

function remarksFrom(value: unknown): SummaryRemark[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const remarks: SummaryRemark[] = [];
  for (const item of value) {
    if (isRemark(item)) {
      remarks.push({ caseId: item.caseId, verdict: item.verdict, comment: item.comment });
    }
  }
  return remarks;
}

function isRemark(
  value: unknown,
): value is { caseId: string | null; verdict: "wrong" | "missed"; comment: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("caseId" in value) || !("verdict" in value) || !("comment" in value)) {
    return false;
  }
  const caseOk = typeof value.caseId === "string" || value.caseId === null;
  const verdictOk = value.verdict === "wrong" || value.verdict === "missed";
  return caseOk && verdictOk && typeof value.comment === "string";
}

function verdictCount(verdict: "correct" | "wrong" | "missed") {
  return {
    $size: {
      $filter: {
        input: "$feedback",
        as: "item",
        cond: { $eq: ["$$item.verdict", verdict] },
      },
    },
  };
}

function toView(document: WithId<SummaryDocument>): SummaryView {
  return {
    id: document._id.toHexString(),
    datasetId: document.datasetId.toHexString(),
    datasetTitle: document.datasetTitle,
    snapshotAt: document.snapshotAt,
    mode: document.mode,
    createdAt: document.createdAt.toISOString(),
    assessments: document.assessments,
    claimsByCase: document.claimsByCase,
    rejectedByCase: document.rejectedByCase,
    warnings: document.warnings,
    markdown: document.markdown,
    feedback: document.feedback.map((item) => ({
      caseId: item.caseId,
      verdict: item.verdict,
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}
