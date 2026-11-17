import type { AiConfig } from "../ai/extract.js";
import { extractClaims } from "../ai/extract.js";
import type { ChatClaim, DatasetInput } from "../schemas.js";
import { assessCase, type CaseAssessment } from "../rules/assess.js";
import { sortAssessments } from "../rules/sort.js";
import { renderMarkdown, type MarkdownSource } from "./render.js";

export type SummaryBody = {
  snapshotAt: string;
  mode: "ai" | "no-ai";
  assessments: CaseAssessment[];
  claimsByCase: Record<string, ChatClaim[]>;
  rejectedByCase: Record<string, number>;
  warnings: string[];
};

export type SummaryResult = SummaryBody & {
  markdown: string;
};

export async function buildSummary(
  dataset: DatasetInput,
  options: {
    snapshotAt?: string;
    ai: AiConfig | null;
    fetchFn?: typeof fetch;
  },
): Promise<SummaryResult> {
  const snapshotAt = options.snapshotAt ?? dataset.snapshotAt;
  const claimsByCase: Record<string, ChatClaim[]> = {};
  const rejectedByCase: Record<string, number> = {};
  const warnings: string[] = [];
  const claimsForAssess = new Map<string, ChatClaim[] | null>();

  if (options.ai === null) {
    for (const caseItem of dataset.cases) {
      claimsByCase[caseItem.id] = [];
      rejectedByCase[caseItem.id] = 0;
      claimsForAssess.set(caseItem.id, null);
    }
  } else {
    const ai = options.ai;
    const extracted = await mapLimit(dataset.cases, 3, (caseItem) =>
      extractClaims(caseItem, snapshotAt, ai, options.fetchFn),
    );

    dataset.cases.forEach((caseItem, index) => {
      const result = extracted[index];
      if (result === undefined || !result.ok) {
        claimsByCase[caseItem.id] = [];
        rejectedByCase[caseItem.id] = 0;
        claimsForAssess.set(caseItem.id, null);
        const reason =
          result !== undefined && !result.ok
            ? result.reason
            : "Не удалось обработать переписку.";
        warnings.push(
          `${caseItem.id}: не удалось обработать переписку — ${reason}`,
        );
        return;
      }

      claimsByCase[caseItem.id] = result.claims;
      rejectedByCase[caseItem.id] = result.rejected;
      claimsForAssess.set(caseItem.id, result.claims);
    });
  }

  const assessments = sortAssessments(
    dataset.cases.map((caseItem) =>
      assessCase(
        caseItem,
        snapshotAt,
        claimsForAssess.get(caseItem.id) ?? null,
      ),
    ),
  );

  const body: SummaryBody = {
    snapshotAt,
    mode: options.ai === null ? "no-ai" : "ai",
    assessments,
    claimsByCase,
    rejectedByCase,
    warnings,
  };
  const markdownSource: MarkdownSource = {
    snapshotAt: body.snapshotAt,
    mode: body.mode,
    assessments: body.assessments,
  };

  return { ...body, markdown: renderMarkdown(markdownSource) };
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const slots: Array<R | undefined> = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) {
          continue;
        }
        slots[index] = await worker(item);
      }
    },
  );

  await Promise.all(runners);

  const results: R[] = [];
  for (const slot of slots) {
    if (slot !== undefined) {
      results.push(slot);
    }
  }
  return results;
}
