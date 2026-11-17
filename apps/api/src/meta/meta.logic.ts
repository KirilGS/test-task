import {
  AUTHOR_LABELS,
  CASE_TYPE_LABELS,
  MAX_CASES,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES,
  PRIORITY_LABELS,
  RULE_CATALOG,
  type AiConfig,
} from "@support-summary/core";

export type MetaResponse = {
  aiAvailable: boolean;
  aiModel: string | null;
  rules: typeof RULE_CATALOG;
  prompt: string;
  labels: {
    priority: typeof PRIORITY_LABELS;
    caseType: typeof CASE_TYPE_LABELS;
    author: typeof AUTHOR_LABELS;
  };
  limits: {
    maxCases: number;
    maxMessages: number;
    maxMessageLength: number;
    aiRequestsPerHour: number;
  };
};

export function buildMeta(input: {
  ai: AiConfig | null;
  prompt: string;
  aiRequestsPerHour: number;
}): MetaResponse {
  return {
    aiAvailable: input.ai !== null,
    aiModel: input.ai === null ? null : input.ai.model,
    rules: RULE_CATALOG,
    prompt: input.prompt,
    labels: {
      priority: PRIORITY_LABELS,
      caseType: CASE_TYPE_LABELS,
      author: AUTHOR_LABELS,
    },
    limits: {
      maxCases: MAX_CASES,
      maxMessages: MAX_MESSAGES,
      maxMessageLength: MAX_MESSAGE_LENGTH,
      aiRequestsPerHour: input.aiRequestsPerHour,
    },
  };
}
