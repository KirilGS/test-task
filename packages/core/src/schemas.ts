import { z } from "zod";

export const MAX_CASES = 30;
export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_LENGTH = 1000;

const MAX_TITLE_LENGTH = 100;
const MAX_ID_LENGTH = 20;
const MAX_NOTE_LENGTH = 500;

const dateTime = (message: string) =>
  z.iso.datetime({ offset: true, error: message });

const calendarDate = (message: string) => z.iso.date(message);

const noteSchema = z
  .string({ error: "Комментарий из CRM должен быть текстом" })
  .max(MAX_NOTE_LENGTH, "Комментарий из CRM не длиннее 500 символов");

export const messageSchema = z.object({
  author: z.enum(["employee", "manager", "courier", "recipient", "other"], {
    error: "Укажите автора сообщения",
  }),
  text: z
    .string({ error: "Текст сообщения не может быть пустым" })
    .min(1, "Текст сообщения не может быть пустым")
    .max(MAX_MESSAGE_LENGTH, "Текст сообщения не длиннее 1000 символов"),
  sentAt: dateTime("Укажите время сообщения").nullable(),
});

const messagesSchema = z
  .array(messageSchema, { error: "Список сообщений заполнен неверно" })
  .max(MAX_MESSAGES, "В случае может быть не больше 20 сообщений");

const caseIdSchema = z
  .string({ error: "Укажите номер случая" })
  .min(1, "Укажите номер случая")
  .max(MAX_ID_LENGTH, "Номер случая не длиннее 20 символов");

const onboardingCaseSchema = z.object({
  type: z.literal("onboarding"),
  id: caseIdSchema,
  crm: z.object({
    firstShiftDate: calendarDate("Укажите дату первого выхода"),
    documentsStatus: z.enum(["pending", "received"], {
      error: "Укажите, ожидаются документы или уже получены",
    }),
    note: noteSchema,
  }),
  messages: messagesSchema,
});

const offboardingCaseSchema = z.object({
  type: z.literal("offboarding"),
  id: caseIdSchema,
  crm: z.object({
    lastWorkDate: calendarDate("Укажите последний рабочий день"),
    managerConfirmed: z.boolean({
      error: "Укажите, есть ли подтверждение руководителя",
    }),
    note: noteSchema,
  }),
  messages: messagesSchema,
});

const cardDeliveryCaseSchema = z.object({
  type: z.literal("card_delivery"),
  id: caseIdSchema,
  crm: z.object({
    status: z.enum(["in_transit", "accepted"], {
      error: "Укажите статус поставки",
    }),
    plannedBy: dateTime("Укажите срок доставки").nullable(),
    acceptedAt: dateTime("Укажите время приёмки").nullable(),
    note: noteSchema,
  }),
  messages: messagesSchema,
});

export const supportCaseSchema = z.discriminatedUnion(
  "type",
  [onboardingCaseSchema, offboardingCaseSchema, cardDeliveryCaseSchema],
  { error: "Укажите тип случая" },
);

export const datasetInputSchema = z
  .object({
    title: z
      .string({ error: "Укажите название набора" })
      .min(1, "Укажите название набора")
      .max(MAX_TITLE_LENGTH, "Название набора не длиннее 100 символов"),
    snapshotAt: dateTime("Укажите момент сводки"),
    cases: z
      .array(supportCaseSchema, { error: "Список случаев заполнен неверно" })
      .min(1, "Добавьте хотя бы один случай")
      .max(MAX_CASES, "В наборе может быть не больше 30 случаев"),
  })
  .superRefine((data, ctx) => {
    const seenIds = new Set<string>();

    data.cases.forEach((caseItem, index) => {
      if (seenIds.has(caseItem.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Случай с номером ${caseItem.id} уже есть в наборе`,
          path: ["cases", index, "id"],
          input: caseItem.id,
        });
      } else {
        seenIds.add(caseItem.id);
      }

      if (
        caseItem.type === "card_delivery" &&
        caseItem.crm.status === "accepted" &&
        caseItem.crm.acceptedAt === null
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Для статуса «Принято» укажите время приёмки",
          path: ["cases", index, "crm", "acceptedAt"],
          input: caseItem.crm.acceptedAt,
        });
      }
    });
  });

export const chatClaimSchema = z.object({
  caseId: z
    .string({ error: "Укажите номер случая" })
    .min(1, "Укажите номер случая"),
  messageIndex: z
    .int("Номер сообщения должен быть целым числом")
    .min(0, "Номер сообщения не может быть отрицательным"),
  kind: z.enum(
    [
      "documents_sent",
      "manager_agreed",
      "delivery_delayed",
      "delivery_received",
      "delivery_problem",
      "other",
    ],
    { error: "Укажите тип факта из переписки" },
  ),
  newEta: dateTime("Укажите новое время доставки").nullable(),
  quote: z
    .string({ error: "Цитата не может быть пустой" })
    .min(1, "Цитата не может быть пустой"),
  summary: z
    .string({ error: "Пересказ факта не может быть пустым" })
    .min(1, "Пересказ факта не может быть пустым"),
  confidence: z.enum(["high", "low"], {
    error: "Укажите, насколько факт однозначен",
  }),
});

export const aiClaimsResponseSchema = z.object({
  claims: z.array(chatClaimSchema, {
    error: "Список фактов из переписки заполнен неверно",
  }),
});

export type Message = z.infer<typeof messageSchema>;
export type SupportCase = z.infer<typeof supportCaseSchema>;
export type DatasetInput = z.infer<typeof datasetInputSchema>;
export type ChatClaim = z.infer<typeof chatClaimSchema>;
export type AiClaimsResponse = z.infer<typeof aiClaimsResponseSchema>;

export type FieldError = {
  path: string;
  message: string;
};

export type ParseDatasetResult =
  | { ok: true; data: DatasetInput }
  | { ok: false; errors: FieldError[] };

export function parseDataset(raw: unknown): ParseDatasetResult {
  const result = datasetInputSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.map((part) => String(part)).join("."),
      message: issue.message,
    })),
  };
}
