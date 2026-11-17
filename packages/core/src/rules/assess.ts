import type { ChatClaim, SupportCase } from "../schemas.js";
import {
  AUTHOR_LABELS,
  type Priority,
  type RuleCode,
} from "./catalog.js";

export type CaseAssessment = {
  caseId: string;
  caseType: SupportCase["type"];
  priority: Priority;
  needsAction: boolean;
  deadline: string | null;
  crmFacts: string[];
  chatFacts: string[];
  toCheck: string[];
  nextSteps: string[];
  firedRules: RuleCode[];
};

const PRIORITY_RANK: Record<Priority, number> = {
  none: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const DELIVERY_NEXT_STEPS = [
  "Связаться с курьером или службой доставки и подтвердить новое время.",
  "Предупредить точку о задержке.",
  "Обновить срок доставки в CRM.",
];

const OFFBOARDING_CHECK = "Подтверждает ли руководитель увольнение.";
const OFFBOARDING_STEP =
  "Связаться с ответственным руководителем и получить подтверждение в CRM до конца последнего рабочего дня.";

export function assessCase(
  caseItem: SupportCase,
  snapshotAt: string,
  claims: ChatClaim[] | null,
): CaseAssessment {
  const today = snapshotAt.slice(0, 10);
  const facts = claims ?? [];
  const crmFacts: string[] = [];
  const chatFacts: string[] = [];
  const toCheck: string[] = [];
  const nextSteps: string[] = [];
  const firedRules: RuleCode[] = [];
  let priority: Priority = "none";

  const raise = (next: Priority): void => {
    if (PRIORITY_RANK[next] > PRIORITY_RANK[priority]) {
      priority = next;
    }
  };

  const fire = (code: RuleCode): void => {
    firedRules.push(code);
  };

  if (caseItem.type === "card_delivery") {
    assessDelivery(caseItem, snapshotAt, facts, {
      raise,
      fire,
      crmFacts,
      chatFacts,
      toCheck,
      nextSteps,
    });
  } else if (caseItem.type === "offboarding") {
    assessOffboarding(caseItem, today, facts, {
      raise,
      fire,
      crmFacts,
      chatFacts,
      toCheck,
      nextSteps,
    });
  } else {
    assessOnboarding(caseItem, today, facts, {
      raise,
      fire,
      crmFacts,
      chatFacts,
      toCheck,
      nextSteps,
    });
  }

  if (facts.length > 0) {
    fire("GEN-1");
  }

  for (const fact of facts) {
    if (fact.confidence === "low" || fact.kind === "other") {
      toCheck.push(`Прочитать сообщение вручную: «${fact.quote}».`);
    }
  }
  if (
    facts.some((fact) => fact.confidence === "low" || fact.kind === "other")
  ) {
    fire("GEN-2");
  }

  if (claims === null && caseItem.messages.length > 0) {
    for (const message of caseItem.messages) {
      chatFacts.push(
        `Не обработано ИИ, прочитать вручную. ${AUTHOR_LABELS[message.author]}: «${message.text}»`,
      );
    }
    if (priority === "none") {
      priority = "medium";
      toCheck.push("Прочитать сообщения вручную: ИИ их не обрабатывал.");
    }
    fire("GEN-3");
  }

  return {
    caseId: caseItem.id,
    caseType: caseItem.type,
    priority,
    needsAction: priority !== "none",
    deadline: deadlineFor(caseItem, snapshotAt),
    crmFacts: unique(crmFacts),
    chatFacts: unique(chatFacts),
    toCheck: unique(toCheck),
    nextSteps: unique(nextSteps),
    firedRules: unique(firedRules),
  };
}

type Draft = {
  raise: (priority: Priority) => void;
  fire: (code: RuleCode) => void;
  crmFacts: string[];
  chatFacts: string[];
  toCheck: string[];
  nextSteps: string[];
};

function assessDelivery(
  caseItem: Extract<SupportCase, { type: "card_delivery" }>,
  snapshotAt: string,
  facts: ChatClaim[],
  draft: Draft,
): void {
  const { status, plannedBy, acceptedAt } = caseItem.crm;

  if (status === "accepted") {
    draft.fire("DEL-3");
    draft.crmFacts.push(
      acceptedAt === null
        ? "Приёмка подтверждена."
        : `Приёмка подтверждена в ${formatClock(acceptedAt, snapshotAt)}.`,
    );
    if (facts.some((fact) => fact.kind === "delivery_problem")) {
      draft.fire("DEL-4");
      draft.raise("medium");
      draft.toCheck.push(
        "Сообщение о проблеме противоречит подтверждённой приёмке в CRM. Уточнить у получателя.",
      );
    }
    return;
  }

  const overdue =
    plannedBy !== null && instant(plannedBy) <= instant(snapshotAt);
  if (overdue && plannedBy !== null) {
    draft.fire("DEL-1");
    draft.raise("critical");
    draft.crmFacts.push(
      `Доставка запланирована до ${formatClock(plannedBy, snapshotAt)}, статус «В пути», приёмка не подтверждена.`,
    );
    draft.toCheck.push("Где сейчас карты и когда точно их доставят.");
    draft.nextSteps.push(...DELIVERY_NEXT_STEPS);
  }

  const delays = facts.filter((fact) => fact.kind === "delivery_delayed");
  const raisedDelay = delays.some(
    (fact) =>
      plannedBy === null ||
      (fact.newEta !== null && instant(fact.newEta) > instant(plannedBy)),
  );
  if (raisedDelay) {
    draft.fire("DEL-2");
    draft.raise(plannedBy === null ? "high" : "critical");
    for (const fact of delays) {
      if (fact.newEta !== null) {
        draft.chatFacts.push(
          `Курьер пишет, что приедет не раньше ${formatClock(fact.newEta, snapshotAt)}. В CRM это не отражено.`,
        );
      }
    }
    if (!overdue) {
      draft.nextSteps.push(...DELIVERY_NEXT_STEPS);
    }
  }

  if (facts.some((fact) => fact.kind === "delivery_received")) {
    draft.fire("DEL-5");
    draft.raise("high");
    draft.chatFacts.push(
      "Получатель пишет, что карты получены, но в CRM приёмка не подтверждена.",
    );
    draft.nextSteps.push("Попросить получателя подтвердить приёмку в CRM.");
  }

  const stillAhead = plannedBy === null || instant(plannedBy) > instant(snapshotAt);
  if (stillAhead && delays.length === 0) {
    draft.fire("DEL-6");
    draft.crmFacts.push(
      plannedBy === null
        ? "Доставка в пути, срок не указан."
        : `Доставка в пути, срок — ${formatClock(plannedBy, snapshotAt)}.`,
    );
  }
}

function assessOffboarding(
  caseItem: Extract<SupportCase, { type: "offboarding" }>,
  today: string,
  facts: ChatClaim[],
  draft: Draft,
): void {
  const { lastWorkDate, managerConfirmed } = caseItem.crm;

  if (managerConfirmed) {
    draft.fire("OFF-5");
    draft.crmFacts.push("Увольнение подтверждено руководителем.");
  } else {
    const days = daysUntil(today, lastWorkDate);
    const code = offboardingCode(days);
    draft.fire(code);
    draft.raise(offboardingPriority(code));
    draft.crmFacts.push(
      `Последний рабочий день — ${formatDayMonth(lastWorkDate)}. Подтверждения ответственного руководителя в CRM нет.`,
    );
    if (code !== "OFF-4") {
      draft.toCheck.push(OFFBOARDING_CHECK);
      draft.nextSteps.push(OFFBOARDING_STEP);
    }
  }

  for (const fact of facts) {
    if (fact.kind !== "manager_agreed" || managerConfirmed) {
      continue;
    }
    const author = authorLabel(caseItem, fact.messageIndex);
    draft.chatFacts.push(
      `${author} пишет, что руководитель в курсе или согласен. Это не подтверждено в CRM.`,
    );
  }
}

function assessOnboarding(
  caseItem: Extract<SupportCase, { type: "onboarding" }>,
  today: string,
  facts: ChatClaim[],
  draft: Draft,
): void {
  const { firstShiftDate, documentsStatus } = caseItem.crm;

  if (documentsStatus === "received") {
    draft.fire("ONB-5");
    draft.crmFacts.push("Документы получены.");
  } else {
    const days = daysUntil(today, firstShiftDate);
    const code = onboardingCode(days);
    draft.fire(code);
    draft.raise(onboardingPriority(code));
    draft.crmFacts.push(
      `Первый выход — ${formatDayMonth(firstShiftDate)}. Документы в CRM не поступили.`,
    );
    if (code !== "ONB-4") {
      draft.nextSteps.push("Получить документы в CRM до первого выхода.");
    }
  }

  if (
    documentsStatus === "pending" &&
    facts.some((fact) => fact.kind === "documents_sent")
  ) {
    draft.chatFacts.push(
      "Сотрудник пишет, что отправил документы руководителю в личные сообщения. В CRM документов нет.",
    );
    draft.toCheck.push(
      "Получил ли руководитель документы и все ли они на месте.",
    );
    draft.nextSteps.push(
      "Попросить загрузить документы в CRM, а не пересылать их в личных сообщениях: это персональные данные.",
    );
  }
}

function offboardingCode(days: number): RuleCode {
  if (days < 0) {
    return "OFF-1";
  }
  if (days === 0) {
    return "OFF-2";
  }
  if (days <= 3) {
    return "OFF-3";
  }
  return "OFF-4";
}

function offboardingPriority(code: RuleCode): Priority {
  if (code === "OFF-1") {
    return "critical";
  }
  if (code === "OFF-2") {
    return "high";
  }
  if (code === "OFF-3") {
    return "medium";
  }
  return "none";
}

function onboardingCode(days: number): RuleCode {
  if (days <= 0) {
    return "ONB-1";
  }
  if (days === 1) {
    return "ONB-2";
  }
  if (days <= 3) {
    return "ONB-3";
  }
  return "ONB-4";
}

function onboardingPriority(code: RuleCode): Priority {
  if (code === "ONB-1") {
    return "critical";
  }
  if (code === "ONB-2") {
    return "high";
  }
  if (code === "ONB-3") {
    return "medium";
  }
  return "none";
}

function deadlineFor(caseItem: SupportCase, snapshotAt: string): string | null {
  const zone = zoneSuffix(snapshotAt);
  if (caseItem.type === "onboarding") {
    return `${caseItem.crm.firstShiftDate}T00:00:00${zone}`;
  }
  if (caseItem.type === "offboarding") {
    return `${caseItem.crm.lastWorkDate}T23:59:59${zone}`;
  }
  return caseItem.crm.plannedBy;
}

function authorLabel(caseItem: SupportCase, messageIndex: number): string {
  const message = caseItem.messages[messageIndex];
  if (message === undefined) {
    return "Автор";
  }
  return AUTHOR_LABELS[message.author];
}

function daysUntil(today: string, target: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${target}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function instant(iso: string): number {
  return Date.parse(iso);
}

function zoneSuffix(snapshotAt: string): string {
  if (snapshotAt.endsWith("Z")) {
    return "Z";
  }
  return snapshotAt.slice(-6);
}

function offsetMinutes(snapshotAt: string): number {
  const suffix = zoneSuffix(snapshotAt);
  if (suffix === "Z") {
    return 0;
  }
  const sign = suffix.startsWith("-") ? -1 : 1;
  const hours = Number(suffix.slice(1, 3));
  const minutes = Number(suffix.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

function formatClock(iso: string, snapshotAt: string): string {
  const shifted = new Date(instant(iso) + offsetMinutes(snapshotAt) * 60_000);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDayMonth(isoDate: string): string {
  return `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
}

function unique<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
