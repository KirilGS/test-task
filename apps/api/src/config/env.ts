import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AiConfig } from "@support-summary/core";

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

export const aiProviderSchema = z.enum(["openai", "claude", "openrouter"], {
  error: "Провайдера ИИ укажите так: openai, claude или openrouter",
});

export type AiProviderId = z.infer<typeof aiProviderSchema>;

const PROVIDER_BASE_URL: Record<AiProviderId, string> = {
  openai: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const PROVIDER_LABEL: Record<AiProviderId, string> = {
  openai: "OpenAI",
  claude: "Claude",
  openrouter: "OpenRouter",
};

export const envSchema = z
  .object({
  PORT: wholeNumber(3000, "Порт должен быть целым числом больше нуля"),
  MONGODB_URI: z
    .string({ error: "Укажите адрес базы данных" })
    .min(1, "Укажите адрес базы данных"),
  AI_PROVIDER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    aiProviderSchema.optional(),
  ),
  OPENAI_API_KEY: optionalText,
  OPENAI_MODEL: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  ANTHROPIC_MODEL: optionalText,
  OPENROUTER_API_KEY: optionalText,
  OPENROUTER_MODEL: optionalText,
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
})
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER === undefined) {
      return;
    }
    const credentials = providerCredentials(data.AI_PROVIDER, data);
    if (credentials.key === undefined || credentials.model === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Для провайдера ${PROVIDER_LABEL[data.AI_PROVIDER]} укажите ключ и модель.`,
        path: ["AI_PROVIDER"],
        input: data.AI_PROVIDER,
      });
    }
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
    AI_PROVIDER: blankToUndefined(config.AI_PROVIDER),
    OPENAI_API_KEY: blankToUndefined(config.OPENAI_API_KEY),
    OPENAI_MODEL: blankToUndefined(config.OPENAI_MODEL),
    ANTHROPIC_API_KEY: blankToUndefined(config.ANTHROPIC_API_KEY),
    ANTHROPIC_MODEL: blankToUndefined(config.ANTHROPIC_MODEL),
    OPENROUTER_API_KEY: blankToUndefined(config.OPENROUTER_API_KEY),
    OPENROUTER_MODEL: blankToUndefined(config.OPENROUTER_MODEL),
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

export function resolveAiConfig(
  env: Pick<
    AppEnv,
    | "AI_PROVIDER"
    | "OPENAI_API_KEY"
    | "OPENAI_MODEL"
    | "ANTHROPIC_API_KEY"
    | "ANTHROPIC_MODEL"
    | "OPENROUTER_API_KEY"
    | "OPENROUTER_MODEL"
    | "AI_TIMEOUT_MS"
  >,
): AiConfig | null {
  if (env.AI_PROVIDER === undefined) {
    return null;
  }
  const credentials = providerCredentials(env.AI_PROVIDER, env);
  if (credentials.key === undefined || credentials.model === undefined) {
    return null;
  }
  return {
    apiKey: credentials.key,
    baseUrl: PROVIDER_BASE_URL[env.AI_PROVIDER],
    model: credentials.model,
    timeoutMs: env.AI_TIMEOUT_MS,
  };
}

function providerCredentials(
  provider: AiProviderId,
  data: {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
    OPENROUTER_API_KEY?: string;
    OPENROUTER_MODEL?: string;
  },
): { key?: string; model?: string } {
  if (provider === "openai") {
    return { key: data.OPENAI_API_KEY, model: data.OPENAI_MODEL };
  }
  if (provider === "claude") {
    return { key: data.ANTHROPIC_API_KEY, model: data.ANTHROPIC_MODEL };
  }
  return { key: data.OPENROUTER_API_KEY, model: data.OPENROUTER_MODEL };
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
