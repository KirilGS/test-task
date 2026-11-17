import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

function wholeNumber(fallback: number, message: string) {
  return z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.coerce
      .number({ error: message })
      .int(message)
      .positive(message)
      .default(fallback),
  );
}

export const envSchema = z.object({
  PORT: wholeNumber(3000, "Порт должен быть целым числом больше нуля"),
  MONGODB_URI: z
    .string({ error: "Укажите адрес базы данных" })
    .min(1, "Укажите адрес базы данных"),
  AI_API_KEY: optionalText,
  AI_BASE_URL: optionalText,
  AI_MODEL: optionalText,
  AI_TIMEOUT_MS: wholeNumber(30000, "Таймаут ИИ должен быть целым числом больше нуля"),
  AI_REQUESTS_PER_HOUR: wholeNumber(
    20,
    "Лимит запросов к ИИ в час должен быть целым числом больше нуля",
  ),
  AI_REQUESTS_PER_DAY: wholeNumber(
    300,
    "Лимит запросов к ИИ в сутки должен быть целым числом больше нуля",
  ),
  DEMO_PASSWORD: optionalText,
  TRUST_PROXY: z.enum(["true", "false"], {
    error: "Параметр доверия к прокси может быть только true или false",
  }).default("false"),
  WEB_DIST_DIR: z.string().min(1),
  DATA_DIR: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

export function projectRoot(): string {
  let dir = process.cwd();
  for (let step = 0; step < 6; step += 1) {
    const manifestPath = path.join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (isRecord(raw) && raw.name === "support-summary") {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return process.cwd();
}

export function envFilePath(): string {
  return path.join(projectRoot(), ".env");
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const root = projectRoot();
  const source = {
    PORT: blankToUndefined(config.PORT),
    MONGODB_URI: blankToUndefined(config.MONGODB_URI),
    AI_API_KEY: blankToUndefined(config.AI_API_KEY),
    AI_BASE_URL: blankToUndefined(config.AI_BASE_URL),
    AI_MODEL: blankToUndefined(config.AI_MODEL),
    AI_TIMEOUT_MS: blankToUndefined(config.AI_TIMEOUT_MS),
    AI_REQUESTS_PER_HOUR: blankToUndefined(config.AI_REQUESTS_PER_HOUR),
    AI_REQUESTS_PER_DAY: blankToUndefined(config.AI_REQUESTS_PER_DAY),
    DEMO_PASSWORD: blankToUndefined(config.DEMO_PASSWORD),
    TRUST_PROXY: blankToUndefined(config.TRUST_PROXY),
    WEB_DIST_DIR:
      blankToUndefined(config.WEB_DIST_DIR) ?? path.join(root, "apps", "web", "dist"),
    DATA_DIR: blankToUndefined(config.DATA_DIR) ?? path.join(root, "data"),
  };

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    throw new Error(`Проверьте настройки сервера. ${messages.join(" ")}`);
  }
  return parsed.data;
}

export function databaseName(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("Адрес базы данных указан неверно.");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (name.length === 0) {
    throw new Error("В адресе базы данных не указано её имя.");
  }
  return name;
}

function blankToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
