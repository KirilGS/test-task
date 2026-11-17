import {
  aiClaimsResponseSchema,
  type ChatClaim,
  type SupportCase,
} from "../schemas.js";
import { buildMessages } from "./prompt.js";

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export type ExtractClaimsResult =
  | { ok: true; claims: ChatClaim[]; rejected: number }
  | { ok: false; reason: string };

export async function extractClaims(
  caseItem: SupportCase,
  snapshotAt: string,
  config: AiConfig,
  fetchFn: typeof fetch = fetch,
): Promise<ExtractClaimsResult> {
  if (caseItem.messages.length === 0) {
    return { ok: true, claims: [], rejected: 0 };
  }

  try {
    return await requestClaims(caseItem, snapshotAt, config, fetchFn);
  } catch {
    return { ok: false, reason: "Не удалось обработать переписку." };
  }
}

async function requestClaims(
  caseItem: SupportCase,
  snapshotAt: string,
  config: AiConfig,
  fetchFn: typeof fetch,
): Promise<ExtractClaimsResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = JSON.stringify({
    model: config.model,
    temperature: 0,
    messages: buildMessages(caseItem, snapshotAt),
  });

  let lastReason = "Не удалось получить ответ ИИ.";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch {
      lastReason = "Не удалось связаться с ИИ. Попробуйте ещё раз.";
      continue;
    }

    if (response.ok) {
      return readClaims(response, caseItem);
    }

    lastReason =
      response.status === 429
        ? "ИИ сейчас перегружен. Попробуйте ещё раз чуть позже."
        : "ИИ не смог обработать переписку.";

    if (response.status !== 429 && response.status < 500) {
      return { ok: false, reason: lastReason };
    }
  }

  return { ok: false, reason: lastReason };
}

async function readClaims(
  response: Response,
  caseItem: SupportCase,
): Promise<ExtractClaimsResult> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "ИИ вернул ответ, который не удалось прочитать." };
  }

  const content = readContent(payload);
  if (content === null) {
    return { ok: false, reason: "В ответе ИИ нет текста с фактами." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripCodeFence(content));
  } catch {
    return { ok: false, reason: "ИИ вернул не список фактов, а обычный текст." };
  }

  const parsed = aiClaimsResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, reason: "ИИ вернул факты в неожиданном виде." };
  }

  const claims: ChatClaim[] = [];
  let rejected = 0;
  for (const fact of parsed.data.claims) {
    const message = caseItem.messages[fact.messageIndex];
    const quoteMatches =
      message !== undefined && message.text.includes(fact.quote);
    if (fact.caseId === caseItem.id && quoteMatches) {
      claims.push(fact);
    } else {
      rejected += 1;
    }
  }

  return { ok: true, claims, rejected };
}

function readContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }
  const first = payload.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    return null;
  }
  return typeof first.message.content === "string" ? first.message.content : null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  const lines = trimmed.split("\n");
  const body = lines.slice(1);
  const last = body.at(-1);
  if (last !== undefined && last.trim() === "```") {
    body.pop();
  }
  return body.join("\n").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
