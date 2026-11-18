import type { FieldError } from "@support-summary/core";
import { z } from "zod";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const summaryRequestSchema = z.object({
  datasetId: z
    .string({ error: "Неверная ссылка на набор" })
    .regex(OBJECT_ID, "Неверная ссылка на набор"),
  snapshotAt: z.iso
    .datetime({ offset: true, error: "Укажите момент сводки" })
    .optional(),
});

const feedbackSchema = z
  .object({
    caseId: z
      .string({ error: "Укажите номер случая" })
      .min(1, "Укажите номер случая")
      .nullable(),
    verdict: z.enum(["correct", "wrong", "missed"], {
      error: "Укажите, верна оценка или нет",
    }),
    comment: z
      .string({ error: "Комментарий должен быть текстом" })
      .max(500, "Комментарий не длиннее 500 символов")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.verdict === "missed" && (data.comment ?? "").trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Опишите, что пропущено",
        path: ["comment"],
        input: data.comment,
      });
    }
  });

const limitSchema = z.coerce
  .number({ error: "Укажите, сколько сводок показать: от 1 до 50" })
  .int("Укажите, сколько сводок показать: от 1 до 50")
  .min(1, "Укажите, сколько сводок показать: от 1 до 50")
  .max(50, "Укажите, сколько сводок показать: от 1 до 50");

export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
export type FeedbackInput = {
  caseId: string | null;
  verdict: "correct" | "wrong" | "missed";
  comment: string;
};

export function moscowDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export class DayCounter {
  private day = "";
  private count = 0;

  take(now: Date, limit: number): boolean {
    const day = moscowDay(now);
    if (day !== this.day) {
      this.day = day;
      this.count = 0;
    }
    if (this.count >= limit) {
      return false;
    }
    this.count += 1;
    return true;
  }
}

export function parseSummaryRequest(
  raw: unknown,
): { ok: true; data: SummaryRequest } | { ok: false; errors: FieldError[] } {
  return parsed(summaryRequestSchema, raw);
}

export function parseFeedback(
  raw: unknown,
): { ok: true; data: FeedbackInput } | { ok: false; errors: FieldError[] } {
  const result = feedbackSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: fieldErrors(result.error) };
  }
  return {
    ok: true,
    data: {
      caseId: result.data.caseId,
      verdict: result.data.verdict,
      comment: (result.data.comment ?? "").trim(),
    },
  };
}

export function parseSummaryListQuery(
  datasetId: unknown,
  limit: unknown,
): { ok: true; datasetId: string | null; limit: number } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  let parsedId: string | null = null;
  if (datasetId === undefined) {
    parsedId = null;
  } else if (typeof datasetId === "string" && OBJECT_ID.test(datasetId)) {
    parsedId = datasetId;
  } else {
    errors.push({ path: "datasetId", message: "Неверная ссылка на набор" });
  }

  let parsedLimit = 20;
  if (limit !== undefined && limit !== "") {
    const result = limitSchema.safeParse(limit);
    if (result.success) {
      parsedLimit = result.data;
    } else {
      errors.push({
        path: "limit",
        message: "Укажите, сколько сводок показать: от 1 до 50",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, datasetId: parsedId, limit: parsedLimit };
}

export function parseSummaryId(id: string): string | null {
  return OBJECT_ID.test(id) ? id : null;
}

function parsed<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldError[] } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: fieldErrors(result.error) };
  }
  return { ok: true, data: result.data };
}

function fieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    message: issue.message,
  }));
}
