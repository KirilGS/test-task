import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupportCase } from "../schemas.js";

export type ModelMessage = {
  role: "system" | "user";
  content: string;
};

let cachedPrompt: string | null = null;

export function loadSystemPrompt(): string {
  if (cachedPrompt !== null) {
    return cachedPrompt;
  }

  const filePath = path.join(packageRoot(), "prompts", "extract-chat-claims.md");
  cachedPrompt = readFileSync(filePath, "utf8");
  return cachedPrompt;
}

export function buildMessages(
  caseItem: SupportCase,
  snapshotAt: string,
): ModelMessage[] {
  const payload = {
    snapshotAt,
    caseId: caseItem.id,
    type: caseItem.type,
    crm: caseItem.crm,
    messages: caseItem.messages.map((message, index) => ({
      index,
      author: message.author,
      text: message.text,
      sentAt: message.sentAt,
    })),
  };

  return [
    { role: "system", content: loadSystemPrompt() },
    { role: "user", content: JSON.stringify(payload) },
  ];
}

function packageRoot(): string {
  let dir = __dirname;
  for (let step = 0; step < 6; step += 1) {
    const manifestPath = path.join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (isNamedPackage(raw, "@support-summary/core")) {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return path.resolve(__dirname, "..", "..");
}

function isNamedPackage(value: unknown, name: string): boolean {
  if (typeof value !== "object" || value === null || !("name" in value)) {
    return false;
  }
  return value.name === name;
}
