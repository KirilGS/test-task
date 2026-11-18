import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AiConfig, FieldError } from "@support-summary/core";
import type { Collection, Db } from "mongodb";
import {
  providerBaseUrl,
  providerLabel,
  type AiProviderId,
  type AppEnv,
} from "../config/env";
import { MONGO_DB } from "../mongo/mongo.tokens";
import { isProvider, parseAiSettings, type AiSettingsInput } from "./ai-settings.logic";
import { openText, sealText, type SealedBox } from "./secret-box";

const DOCUMENT_ID = "ai";
const SECRET_MISSING =
  "Сохранить ключ пока нельзя. Попросите того, кто запускал приложение, проверить настройки сервера.";
const UNREADABLE = "Сохранённый ключ не удалось прочитать. Введите его ещё раз.";
const KEY_REQUIRED = "Введите ключ";
const KEY_FOR_OTHER = "Для другой службы введите её ключ";

export type AiSettingsView = {
  configured: boolean;
  provider: AiProviderId | null;
  providerLabel: string | null;
  model: string | null;
  problem: string | null;
};

type StoredSecret = {
  provider: AiProviderId;
  apiKey: string;
  model: string;
};

type AiSettingsDocument = SealedBox & {
  _id: string;
  updatedAt: Date;
};

type ReadResult =
  | { kind: "empty" }
  | { kind: "problem"; message: string }
  | { kind: "ready"; secret: StoredSecret };

@Injectable()
export class AiSettingsService {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async view(): Promise<AiSettingsView> {
    const read = await this.read();
    if (read.kind === "ready") {
      return this.readyView(read.secret);
    }
    if (read.kind === "problem") {
      return this.emptyView(read.message);
    }
    return this.emptyView(this.serverProblem());
  }

  async save(body: unknown): Promise<AiSettingsView> {
    const parsed = parseAiSettings(body);
    if (!parsed.ok) {
      this.invalid(parsed.errors);
    }

    const current = await this.read();
    const nextKey = this.nextKey(parsed.data, current);
    const secret = this.serverSecret();
    if (secret === null) {
      this.fail(HttpStatus.SERVICE_UNAVAILABLE, SECRET_MISSING);
    }

    const sealed = sealText(
      JSON.stringify({
        provider: parsed.data.provider,
        apiKey: nextKey,
        model: parsed.data.model,
      }),
      secret,
    );
    await this.collection().updateOne(
      { _id: DOCUMENT_ID },
      { $set: { ...sealed, updatedAt: new Date() } },
      { upsert: true },
    );

    return this.readyView({
      provider: parsed.data.provider,
      apiKey: nextKey,
      model: parsed.data.model,
    });
  }

  async clear(): Promise<AiSettingsView> {
    await this.collection().deleteOne({ _id: DOCUMENT_ID });
    return this.emptyView(this.serverProblem());
  }

  async resolve(): Promise<AiConfig | null> {
    const read = await this.read();
    if (read.kind !== "ready") {
      return null;
    }
    return {
      apiKey: read.secret.apiKey,
      baseUrl: providerBaseUrl(read.secret.provider),
      model: read.secret.model,
      timeoutMs: this.config.get("AI_TIMEOUT_MS", { infer: true }),
    };
  }

  private nextKey(input: AiSettingsInput, current: ReadResult): string {
    if (input.apiKey.length > 0) {
      return input.apiKey;
    }
    if (current.kind === "ready" && current.secret.provider === input.provider) {
      return current.secret.apiKey;
    }
    this.invalid([
      {
        path: "apiKey",
        message: current.kind === "ready" ? KEY_FOR_OTHER : KEY_REQUIRED,
      },
    ]);
  }

  private async read(): Promise<ReadResult> {
    const document = await this.collection().findOne({ _id: DOCUMENT_ID });
    if (document === null) {
      return { kind: "empty" };
    }
    const secret = this.serverSecret();
    if (secret === null) {
      return { kind: "problem", message: SECRET_MISSING };
    }
    const opened = openText(document, secret);
    if (opened === null) {
      return { kind: "problem", message: UNREADABLE };
    }
    const stored = parseStored(opened);
    if (stored === null) {
      return { kind: "problem", message: UNREADABLE };
    }
    return { kind: "ready", secret: stored };
  }

  private readyView(stored: StoredSecret): AiSettingsView {
    return {
      configured: true,
      provider: stored.provider,
      providerLabel: providerLabel(stored.provider),
      model: stored.model,
      problem: null,
    };
  }

  private emptyView(problem: string | null): AiSettingsView {
    return {
      configured: false,
      provider: null,
      providerLabel: null,
      model: null,
      problem,
    };
  }

  private serverProblem(): string | null {
    return this.serverSecret() === null ? SECRET_MISSING : null;
  }

  private serverSecret(): string | null {
    const value = this.config.get("SETTINGS_SECRET", { infer: true });
    return value === undefined ? null : value;
  }

  private collection(): Collection<AiSettingsDocument> {
    return this.db.collection<AiSettingsDocument>("ai_settings");
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

function parseStored(plain: string): StoredSecret | null {
  let value: unknown;
  try {
    value = JSON.parse(plain);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isProvider(value.provider)) {
    return null;
  }
  if (typeof value.apiKey !== "string" || value.apiKey.length === 0) {
    return null;
  }
  if (typeof value.model !== "string" || value.model.trim().length === 0) {
    return null;
  }
  return { provider: value.provider, apiKey: value.apiKey, model: value.model.trim() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
