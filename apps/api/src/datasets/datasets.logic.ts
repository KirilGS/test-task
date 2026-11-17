import {
  parseDataset,
  type DatasetInput,
  type FieldError,
} from "@support-summary/core";
import { ObjectId } from "mongodb";
import { z } from "zod";

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const COPY_PREFIX = "Копия — ";
const MAX_TITLE_LENGTH = 100;

const updateVersionSchema = z.object({
  version: z.int("Укажите версию набора").positive("Укажите версию набора"),
});

export function parseDatasetId(id: string): ObjectId | null {
  if (!OBJECT_ID.test(id)) {
    return null;
  }
  return new ObjectId(id);
}

export function copyTitle(title: string): string {
  const room = MAX_TITLE_LENGTH - COPY_PREFIX.length;
  return COPY_PREFIX + title.slice(0, Math.max(0, room));
}

export function updateMiss(current: { isDemo: boolean } | null):
  | { status: 404; message: "Набор не найден" }
  | { status: 403; message: "Пример из задания нельзя менять. Сделайте копию" }
  | { status: 409; message: "Набор изменил кто-то другой. Обновите страницу" } {
  if (current === null) {
    return { status: 404, message: "Набор не найден" };
  }
  if (current.isDemo) {
    return {
      status: 403,
      message: "Пример из задания нельзя менять. Сделайте копию",
    };
  }
  return {
    status: 409,
    message: "Набор изменил кто-то другой. Обновите страницу",
  };
}

export function parseUpdateBody(
  raw: unknown,
):
  | { ok: true; data: DatasetInput & { version: number } }
  | { ok: false; errors: FieldError[] } {
  const dataset = parseDataset(raw);
  const version = updateVersionSchema.safeParse(raw);
  if (dataset.ok && version.success) {
    return { ok: true, data: { ...dataset.data, version: version.data.version } };
  }

  const errors: FieldError[] = [];
  if (!dataset.ok) {
    errors.push(...dataset.errors);
  }
  if (!version.success) {
    errors.push(...fieldErrors(version.error));
  }
  return { ok: false, errors };
}

function fieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    message: issue.message,
  }));
}
