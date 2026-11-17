import type { CaseAssessment } from "../rules/assess.js";
import {
  CASE_TYPE_LABELS,
  PRIORITY_LABELS,
} from "../rules/catalog.js";

export type MarkdownSource = {
  snapshotAt: string;
  mode: "ai" | "no-ai";
  assessments: CaseAssessment[];
};

export function renderMarkdown(result: MarkdownSource): string {
  const stamp = formatStamp(result.snapshotAt);
  const lines: string[] = [
    `# Сводка support-отдела на ${stamp} (МСК)`,
    "",
    startLine(result),
    "",
  ];

  const actionable = result.assessments.filter((item) => item.needsAction);
  const quiet = result.assessments.filter((item) => !item.needsAction);

  if (actionable.length > 0) {
    lines.push("## Требуют действий", "");
    actionable.forEach((item, index) => {
      lines.push(
        `### ${index + 1}. ${item.caseId} · ${CASE_TYPE_LABELS[item.caseType]} · ${PRIORITY_LABELS[item.priority]}`,
        `**Срок:** ${item.deadline === null ? "не указан" : formatDeadline(item.deadline, result.snapshotAt)}`,
      );
      if (item.crmFacts.length > 0) {
        lines.push("**Подтверждено в CRM:**", ...item.crmFacts.map((fact) => `- ${fact}`));
      }
      lines.push(
        "**Известно только из переписки:**",
        ...(item.chatFacts.length > 0
          ? item.chatFacts.map((fact) => `- ${fact}`)
          : ["- нет сообщений"]),
      );
      if (item.toCheck.length > 0) {
        lines.push(
          "**Проверить перед действием:**",
          ...item.toCheck.map((fact) => `- ${fact}`),
        );
      }
      if (item.nextSteps.length > 0) {
        lines.push(
          "**Что делать дальше:**",
          ...item.nextSteps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`),
        );
      }
      lines.push("");
    });
  }

  if (quiet.length > 0) {
    lines.push("## Не требуют действий");
    for (const item of quiet) {
      const reason = item.crmFacts[0] ?? "Дополнительных сведений нет.";
      lines.push(
        `- ${item.caseId} · ${CASE_TYPE_LABELS[item.caseType]} — ${reason}`,
      );
    }
    lines.push("");
  }

  const mode =
    result.mode === "ai"
      ? "с ИИ"
      : "без ИИ: переписку нужно прочитать вручную";
  lines.push(
    "---",
    `Режим: «${mode}».`,
    "Сводка подготовлена автоматически. Решение принимает сотрудник support.",
  );

  return lines.join("\n");
}

function startLine(result: MarkdownSource): string {
  const first = result.assessments.find((item) => item.needsAction);
  if (first === undefined) {
    return "**Начать с:** Срочных случаев нет.";
  }
  const step = first.nextSteps[0];
  if (step === undefined) {
    return `**Начать с: ${first.caseId}**`;
  }
  return `**Начать с: ${first.caseId}** — ${step}`;
}

function formatStamp(iso: string): string {
  const shifted = shiftToSnapshotZone(iso, iso);
  return `${pad(shifted.getUTCDate())}.${pad(shifted.getUTCMonth() + 1)}.${shifted.getUTCFullYear()}, ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function formatDeadline(iso: string, snapshotAt: string): string {
  const shifted = shiftToSnapshotZone(iso, snapshotAt);
  return `${pad(shifted.getUTCDate())}.${pad(shifted.getUTCMonth() + 1)} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function shiftToSnapshotZone(iso: string, snapshotAt: string): Date {
  return new Date(Date.parse(iso) + offsetMinutes(snapshotAt) * 60_000);
}

function offsetMinutes(snapshotAt: string): number {
  if (snapshotAt.endsWith("Z")) {
    return 0;
  }
  const suffix = snapshotAt.slice(-6);
  const sign = suffix.startsWith("-") ? -1 : 1;
  return sign * (Number(suffix.slice(1, 3)) * 60 + Number(suffix.slice(4, 6)));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
