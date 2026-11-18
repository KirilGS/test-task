import type { FieldError } from "@support-summary/core";
import type { AiProviderId } from "../config/env";

const PROVIDERS: readonly AiProviderId[] = ["openai", "claude", "openrouter"];
const MODEL_LIMIT = 200;
const KEY_LIMIT = 4000;

export type AiSettingsInput = {
  provider: AiProviderId;
  apiKey: string;
  model: string;
};

export type ParseAiSettingsResult =
  | { ok: true; data: AiSettingsInput }
  | { ok: false; errors: FieldError[] };

export function parseAiSettings(body: unknown): ParseAiSettingsResult {
  if (!isRecord(body)) {
    return { ok: false, errors: [{ path: "provider", message: "Выберите службу" }] };
  }

  const errors: FieldError[] = [];
  const provider = readProvider(body.provider);
  if (provider === null) {
    errors.push({ path: "provider", message: "Выберите службу из списка" });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (typeof body.apiKey !== "string") {
    errors.push({ path: "apiKey", message: "Введите ключ" });
  } else if (apiKey.length > KEY_LIMIT) {
    errors.push({ path: "apiKey", message: "Ключ слишком длинный" });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (model.length === 0) {
    errors.push({ path: "model", message: "Укажите модель" });
  } else if (model.length > MODEL_LIMIT) {
    errors.push({ path: "model", message: "Название модели слишком длинное" });
  }

  if (provider === null || errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { provider, apiKey, model } };
}

export function isProvider(value: unknown): value is AiProviderId {
  return typeof value === "string" && PROVIDERS.some((item) => item === value);
}

function readProvider(value: unknown): AiProviderId | null {
  return isProvider(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
