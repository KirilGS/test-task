import type { Author, CaseType, DatasetInput, Message, SupportCase } from '@support-summary/core'
import { parseDataset } from '@support-summary/core'
import { formatMsk, fromInputValue, toInputValue } from './datetime'

export type MessageDraft = {
  author: Author
  text: string
}

export type CaseDraft = {
  key: string
  id: string
  note: string
  messages: MessageDraft[]
} & (
  | {
      type: 'onboarding'
      firstShiftDate: string
      documentsStatus: 'pending' | 'received'
    }
  | {
      type: 'offboarding'
      lastWorkDate: string
      managerConfirmed: boolean
    }
  | {
      type: 'card_delivery'
      status: 'in_transit' | 'accepted'
      plannedBy: string
      acceptedAt: string
    }
)

export type DatasetForm = {
  title: string
  snapshotAt: string
  cases: CaseDraft[]
}

export type FormLimits = {
  maxCases: number
  maxMessages: number
  maxMessageLength: number
}

let caseKey = 0

function nextKey(): string {
  caseKey += 1
  return `case-${caseKey}`
}

function pushError(errors: Record<string, string>, path: string, message: string): void {
  if (errors[path] === undefined) {
    errors[path] = message
  }
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

function formatCalendar(value: string): string {
  if (!isCalendarDate(value)) {
    return 'дата не указана'
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const year = match?.[1]
  const month = match?.[2]
  const day = match?.[3]
  if (year === undefined || month === undefined || day === undefined) {
    return 'дата не указана'
  }
  return `${day}.${month}.${year}`
}

function formatLocal(value: string): string {
  const iso = fromInputValue(value)
  if (iso === null) {
    return 'дата не указана'
  }
  return formatMsk(iso)
}

function caseBrief(draft: CaseDraft): string {
  if (draft.type === 'onboarding') {
    const documents =
      draft.documentsStatus === 'received' ? 'документы получены' : 'документы ожидаются'
    return `Первый выход ${formatCalendar(draft.firstShiftDate)}, ${documents}`
  }
  if (draft.type === 'offboarding') {
    const confirmed = draft.managerConfirmed ? 'есть подтверждение' : 'подтверждения нет'
    return `Последний день ${formatCalendar(draft.lastWorkDate)}, ${confirmed}`
  }
  if (draft.status === 'accepted') {
    const when = draft.acceptedAt.trim() === '' ? 'время не указано' : formatLocal(draft.acceptedAt)
    return `Принято, ${when}`
  }
  const when = draft.plannedBy.trim() === '' ? 'срок не указан' : formatLocal(draft.plannedBy)
  return `В пути, ${when}`
}

export function caseHeading(draft: CaseDraft, typeLabel: string): string {
  const id = draft.id.trim() === '' ? 'Без номера' : draft.id.trim()
  return `${id} · ${typeLabel} · ${caseBrief(draft)}`
}

export function casesCountText(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  let word = 'случаев'
  if (mod10 === 1 && mod100 !== 11) {
    word = 'случай'
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = 'случая'
  }
  return `${count} ${word}`
}

export function nextCaseId(cases: readonly { id: string }[]): string {
  const used = new Set(cases.map((item) => item.id.trim()))
  let number = 10
  while (used.has(`П-${number}`)) {
    number += 1
  }
  return `П-${number}`
}

function messageDrafts(messages: Message[]): MessageDraft[] {
  return messages.map((message) => ({ author: message.author, text: message.text }))
}

export function caseToDraft(item: SupportCase): CaseDraft {
  const key = nextKey()
  const messages = messageDrafts(item.messages)
  if (item.type === 'onboarding') {
    return {
      key,
      id: item.id,
      type: 'onboarding',
      firstShiftDate: item.crm.firstShiftDate,
      documentsStatus: item.crm.documentsStatus,
      note: item.crm.note,
      messages,
    }
  }
  if (item.type === 'offboarding') {
    return {
      key,
      id: item.id,
      type: 'offboarding',
      lastWorkDate: item.crm.lastWorkDate,
      managerConfirmed: item.crm.managerConfirmed,
      note: item.crm.note,
      messages,
    }
  }
  return {
    key,
    id: item.id,
    type: 'card_delivery',
    status: item.crm.status,
    plannedBy: item.crm.plannedBy === null ? '' : toInputValue(item.crm.plannedBy),
    acceptedAt: item.crm.acceptedAt === null ? '' : toInputValue(item.crm.acceptedAt),
    note: item.crm.note,
    messages,
  }
}

export function blankCase(type: CaseType, id: string): CaseDraft {
  const key = nextKey()
  if (type === 'onboarding') {
    return {
      key,
      id,
      type,
      firstShiftDate: '2026-11-16',
      documentsStatus: 'pending',
      note: '',
      messages: [],
    }
  }
  if (type === 'offboarding') {
    return {
      key,
      id,
      type,
      lastWorkDate: '2026-11-16',
      managerConfirmed: false,
      note: '',
      messages: [],
    }
  }
  return {
    key,
    id,
    type: 'card_delivery',
    status: 'in_transit',
    plannedBy: '',
    acceptedAt: '',
    note: '',
    messages: [],
  }
}

export function datasetToForm(input: DatasetInput): DatasetForm {
  return {
    title: input.title,
    snapshotAt: toInputValue(input.snapshotAt),
    cases: input.cases.map((item) => caseToDraft(item)),
  }
}

function signatureCase(item: CaseDraft): object {
  const messages = item.messages.map((message) => ({
    author: message.author,
    text: message.text,
  }))
  if (item.type === 'onboarding') {
    return {
      id: item.id,
      type: item.type,
      firstShiftDate: item.firstShiftDate,
      documentsStatus: item.documentsStatus,
      note: item.note,
      messages,
    }
  }
  if (item.type === 'offboarding') {
    return {
      id: item.id,
      type: item.type,
      lastWorkDate: item.lastWorkDate,
      managerConfirmed: item.managerConfirmed,
      note: item.note,
      messages,
    }
  }
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    plannedBy: item.plannedBy,
    acceptedAt: item.acceptedAt,
    note: item.note,
    messages,
  }
}

export function formSignature(form: DatasetForm): string {
  return JSON.stringify({
    title: form.title,
    snapshotAt: form.snapshotAt,
    cases: form.cases.map((item) => signatureCase(item)),
  })
}

function readId(
  draft: CaseDraft,
  index: number,
  seen: Set<string>,
  errors: Record<string, string>,
): string | null {
  const id = draft.id.trim()
  if (id === '') {
    pushError(errors, `cases.${index}.id`, 'Укажите номер случая')
    return null
  }
  if (id.length > 20) {
    pushError(errors, `cases.${index}.id`, 'Номер случая не длиннее 20 символов')
    return null
  }
  if (seen.has(id)) {
    pushError(errors, `cases.${index}.id`, `Случай с номером ${id} уже есть в наборе`)
    return null
  }
  seen.add(id)
  return id
}

function readNote(draft: CaseDraft, index: number, errors: Record<string, string>): string | null {
  const note = draft.note.trim()
  if (note.length > 500) {
    pushError(errors, `cases.${index}.crm.note`, 'Комментарий из CRM не длиннее 500 символов')
    return null
  }
  return note
}

function readDate(
  value: string,
  path: string,
  message: string,
  errors: Record<string, string>,
): boolean {
  if (!isCalendarDate(value)) {
    pushError(errors, path, message)
    return false
  }
  return true
}

function readMessages(
  draft: CaseDraft,
  index: number,
  limits: FormLimits,
  errors: Record<string, string>,
): Message[] | null {
  let failed = false
  if (draft.messages.length > limits.maxMessages) {
    pushError(
      errors,
      `cases.${index}.messages`,
      `В случае может быть не больше ${limits.maxMessages} сообщений`,
    )
    failed = true
  }
  const messages: Message[] = []
  draft.messages.forEach((message, messageIndex) => {
    const text = message.text.trim()
    if (text === '') {
      pushError(
        errors,
        `cases.${index}.messages.${messageIndex}.text`,
        'Текст сообщения не может быть пустым',
      )
      failed = true
      return
    }
    if (text.length > limits.maxMessageLength) {
      pushError(
        errors,
        `cases.${index}.messages.${messageIndex}.text`,
        `Текст сообщения не длиннее ${limits.maxMessageLength} символов`,
      )
      failed = true
      return
    }
    messages.push({ author: message.author, text, sentAt: null })
  })
  if (failed) {
    return null
  }
  return messages
}

function readOptionalDateTime(
  value: string,
  path: string,
  message: string,
  errors: Record<string, string>,
): { ok: true; value: string | null } | { ok: false } {
  if (value.trim() === '') {
    return { ok: true, value: null }
  }
  const iso = fromInputValue(value.trim())
  if (iso === null) {
    pushError(errors, path, message)
    return { ok: false }
  }
  return { ok: true, value: iso }
}

function readRequiredDateTime(
  value: string,
  path: string,
  message: string,
  errors: Record<string, string>,
): string | null {
  const iso = fromInputValue(value.trim())
  if (iso === null) {
    pushError(errors, path, message)
    return null
  }
  return iso
}

function toCase(
  draft: CaseDraft,
  index: number,
  limits: FormLimits,
  seen: Set<string>,
  errors: Record<string, string>,
): SupportCase | null {
  const id = readId(draft, index, seen, errors)
  const messages = readMessages(draft, index, limits, errors)
  const note = readNote(draft, index, errors)
  if (draft.type === 'onboarding') {
    const dateOk = readDate(
      draft.firstShiftDate,
      `cases.${index}.crm.firstShiftDate`,
      'Укажите дату первого выхода',
      errors,
    )
    if (id === null || messages === null || note === null || !dateOk) {
      return null
    }
    return {
      id,
      type: 'onboarding',
      crm: {
        firstShiftDate: draft.firstShiftDate,
        documentsStatus: draft.documentsStatus,
        note,
      },
      messages,
    }
  }
  if (draft.type === 'offboarding') {
    const dateOk = readDate(
      draft.lastWorkDate,
      `cases.${index}.crm.lastWorkDate`,
      'Укажите последний рабочий день',
      errors,
    )
    if (id === null || messages === null || note === null || !dateOk) {
      return null
    }
    return {
      id,
      type: 'offboarding',
      crm: {
        lastWorkDate: draft.lastWorkDate,
        managerConfirmed: draft.managerConfirmed,
        note,
      },
      messages,
    }
  }
  const planned = readOptionalDateTime(
    draft.plannedBy,
    `cases.${index}.crm.plannedBy`,
    'Укажите срок доставки',
    errors,
  )
  let accepted: string | null = null
  let acceptedOk = true
  if (draft.status === 'accepted') {
    accepted = readRequiredDateTime(
      draft.acceptedAt,
      `cases.${index}.crm.acceptedAt`,
      'Для статуса «Принято» укажите время приёмки',
      errors,
    )
    acceptedOk = accepted !== null
  }
  if (id === null || messages === null || note === null || !planned.ok || !acceptedOk) {
    return null
  }
  return {
    id,
    type: 'card_delivery',
    crm: {
      status: draft.status,
      plannedBy: planned.value,
      acceptedAt: accepted,
      note,
    },
    messages,
  }
}

export function buildInput(
  form: DatasetForm,
  limits: FormLimits,
): { ok: true; value: DatasetInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const title = form.title.trim()
  if (title === '') {
    pushError(errors, 'title', 'Укажите название набора')
  } else if (title.length > 100) {
    pushError(errors, 'title', 'Название набора не длиннее 100 символов')
  }
  const snapshotAt = fromInputValue(form.snapshotAt.trim())
  if (snapshotAt === null) {
    pushError(errors, 'snapshotAt', 'Укажите момент сводки')
  }
  if (form.cases.length === 0) {
    pushError(errors, 'cases', 'Добавьте хотя бы один случай')
  } else if (form.cases.length > limits.maxCases) {
    pushError(errors, 'cases', `В наборе может быть не больше ${limits.maxCases} случаев`)
  }
  const seen = new Set<string>()
  const cases: SupportCase[] = []
  form.cases.forEach((draft, index) => {
    const item = toCase(draft, index, limits, seen, errors)
    if (item !== null) {
      cases.push(item)
    }
  })
  if (snapshotAt === null || Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: { title, snapshotAt, cases } }
}

export function datasetFromFile(
  raw: unknown,
): { ok: true; form: DatasetForm } | { ok: false; errors: Record<string, string> } {
  const parsed = parseDataset(raw)
  if (!parsed.ok) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.errors) {
      const path = issue.path === '' ? 'file' : issue.path
      pushError(errors, path, issue.message)
    }
    if (Object.keys(errors).length === 0) {
      errors.file = 'Файл заполнен неверно'
    }
    return { ok: false, errors }
  }
  return { ok: true, form: datasetToForm(parsed.data) }
}
