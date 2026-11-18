import type {
  Author,
  CaseAssessment,
  CaseType,
  ChatClaim,
  Message,
  Priority,
  RuleCode,
  SupportCase,
} from '@support-summary/core'
import type {
  DatasetListItem,
  DatasetView,
  MetaResponse,
  RuleInfo,
  SummaryFeedbackView,
  SummaryListItem,
  SummaryView,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPriority(value: unknown): value is Priority {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'none'
}

function isCaseType(value: unknown): value is CaseType {
  return value === 'onboarding' || value === 'offboarding' || value === 'card_delivery'
}

function isAuthor(value: unknown): value is Author {
  return (
    value === 'employee' ||
    value === 'manager' ||
    value === 'courier' ||
    value === 'recipient' ||
    value === 'other'
  )
}

function isRuleCode(value: unknown): value is RuleCode {
  return (
    value === 'DEL-1' ||
    value === 'DEL-2' ||
    value === 'DEL-3' ||
    value === 'DEL-4' ||
    value === 'DEL-5' ||
    value === 'DEL-6' ||
    value === 'OFF-1' ||
    value === 'OFF-2' ||
    value === 'OFF-3' ||
    value === 'OFF-4' ||
    value === 'OFF-5' ||
    value === 'ONB-1' ||
    value === 'ONB-2' ||
    value === 'ONB-3' ||
    value === 'ONB-4' ||
    value === 'ONB-5' ||
    value === 'GEN-1' ||
    value === 'GEN-2' ||
    value === 'GEN-3'
  )
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value) || !isAuthor(value.author) || typeof value.text !== 'string') {
    return false
  }
  return typeof value.sentAt === 'string' || value.sentAt === null
}

function isSupportCase(value: unknown): value is SupportCase {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isRecord(value.crm) ||
    !Array.isArray(value.messages) ||
    !value.messages.every(isMessage)
  ) {
    return false
  }
  const crm = value.crm
  if (value.type === 'onboarding') {
    return (
      typeof crm.firstShiftDate === 'string' &&
      (crm.documentsStatus === 'pending' || crm.documentsStatus === 'received') &&
      typeof crm.note === 'string'
    )
  }
  if (value.type === 'offboarding') {
    return (
      typeof crm.lastWorkDate === 'string' &&
      typeof crm.managerConfirmed === 'boolean' &&
      typeof crm.note === 'string'
    )
  }
  if (value.type === 'card_delivery') {
    return (
      (crm.status === 'in_transit' || crm.status === 'accepted') &&
      (typeof crm.plannedBy === 'string' || crm.plannedBy === null) &&
      (typeof crm.acceptedAt === 'string' || crm.acceptedAt === null) &&
      typeof crm.note === 'string'
    )
  }
  return false
}

function isRuleInfo(value: unknown): value is RuleInfo {
  return (
    isRecord(value) &&
    isRuleCode(value.code) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string'
  )
}

function isPriorityLabels(value: unknown): value is Record<Priority, string> {
  return (
    isRecord(value) &&
    typeof value.critical === 'string' &&
    typeof value.high === 'string' &&
    typeof value.medium === 'string' &&
    typeof value.none === 'string'
  )
}

function isCaseTypeLabels(value: unknown): value is Record<CaseType, string> {
  return (
    isRecord(value) &&
    typeof value.onboarding === 'string' &&
    typeof value.offboarding === 'string' &&
    typeof value.card_delivery === 'string'
  )
}

function isAuthorLabels(value: unknown): value is Record<Author, string> {
  return (
    isRecord(value) &&
    typeof value.employee === 'string' &&
    typeof value.manager === 'string' &&
    typeof value.courier === 'string' &&
    typeof value.recipient === 'string' &&
    typeof value.other === 'string'
  )
}

export function isMetaResponse(value: unknown): value is MetaResponse {
  if (!isRecord(value) || !isRecord(value.labels) || !isRecord(value.limits)) {
    return false
  }
  const modelOk = typeof value.aiModel === 'string' || value.aiModel === null
  return (
    typeof value.aiAvailable === 'boolean' &&
    modelOk &&
    Array.isArray(value.rules) &&
    value.rules.every(isRuleInfo) &&
    typeof value.prompt === 'string' &&
    isPriorityLabels(value.labels.priority) &&
    isCaseTypeLabels(value.labels.caseType) &&
    isAuthorLabels(value.labels.author) &&
    isFiniteNumber(value.limits.maxCases) &&
    isFiniteNumber(value.limits.maxMessages) &&
    isFiniteNumber(value.limits.maxMessageLength) &&
    isFiniteNumber(value.limits.aiRequestsPerHour)
  )
}

function hasDatasetCard(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    (typeof value.slug === 'string' || value.slug === null) &&
    typeof value.title === 'string' &&
    typeof value.isDemo === 'boolean' &&
    typeof value.snapshotAt === 'string' &&
    isFiniteNumber(value.version) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

export function isDatasetView(value: unknown): value is DatasetView {
  return (
    isRecord(value) &&
    hasDatasetCard(value) &&
    Array.isArray(value.cases) &&
    value.cases.every(isSupportCase)
  )
}

export function isDatasetListItem(value: unknown): value is DatasetListItem {
  return isRecord(value) && hasDatasetCard(value) && isFiniteNumber(value.casesCount)
}

function isChatClaim(value: unknown): value is ChatClaim {
  if (!isRecord(value)) {
    return false
  }
  const kindOk =
    value.kind === 'documents_sent' ||
    value.kind === 'manager_agreed' ||
    value.kind === 'delivery_delayed' ||
    value.kind === 'delivery_received' ||
    value.kind === 'delivery_problem' ||
    value.kind === 'other'
  return (
    typeof value.caseId === 'string' &&
    isFiniteNumber(value.messageIndex) &&
    kindOk &&
    (typeof value.newEta === 'string' || value.newEta === null) &&
    typeof value.quote === 'string' &&
    typeof value.summary === 'string' &&
    (value.confidence === 'high' || value.confidence === 'low')
  )
}

function isClaimsByCase(value: unknown): value is Record<string, ChatClaim[]> {
  if (!isRecord(value)) {
    return false
  }
  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every(isChatClaim),
  )
}

function isNumberMap(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) {
    return false
  }
  return Object.values(value).every((item) => isFiniteNumber(item))
}

function isAssessment(value: unknown): value is CaseAssessment {
  if (!isRecord(value)) {
    return false
  }
  const deadlineOk = typeof value.deadline === 'string' || value.deadline === null
  return (
    typeof value.caseId === 'string' &&
    isCaseType(value.caseType) &&
    isPriority(value.priority) &&
    typeof value.needsAction === 'boolean' &&
    deadlineOk &&
    isStringArray(value.crmFacts) &&
    isStringArray(value.chatFacts) &&
    isStringArray(value.toCheck) &&
    isStringArray(value.nextSteps) &&
    Array.isArray(value.firedRules) &&
    value.firedRules.every(isRuleCode)
  )
}

function isFeedback(value: unknown): value is SummaryFeedbackView {
  if (!isRecord(value)) {
    return false
  }
  const verdictOk =
    value.verdict === 'correct' || value.verdict === 'wrong' || value.verdict === 'missed'
  return (
    (typeof value.caseId === 'string' || value.caseId === null) &&
    verdictOk &&
    typeof value.comment === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isSummaryMode(value: unknown): value is 'ai' | 'no-ai' {
  return value === 'ai' || value === 'no-ai'
}

function hasSummaryCard(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    typeof value.datasetId === 'string' &&
    typeof value.datasetTitle === 'string' &&
    typeof value.snapshotAt === 'string' &&
    isSummaryMode(value.mode) &&
    typeof value.createdAt === 'string' &&
    isNumberMap(value.rejectedByCase) &&
    isStringArray(value.warnings)
  )
}

export function isSummaryView(value: unknown): value is SummaryView {
  if (!isRecord(value) || !hasSummaryCard(value)) {
    return false
  }
  return (
    Array.isArray(value.assessments) &&
    value.assessments.every(isAssessment) &&
    isClaimsByCase(value.claimsByCase) &&
    typeof value.markdown === 'string' &&
    Array.isArray(value.feedback) &&
    value.feedback.every(isFeedback)
  )
}

function isRemark(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  const verdictOk = value.verdict === 'wrong' || value.verdict === 'missed'
  return (
    (typeof value.caseId === 'string' || value.caseId === null) &&
    verdictOk &&
    typeof value.comment === 'string'
  )
}

export function isSummaryListItem(value: unknown): value is SummaryListItem {
  if (!isRecord(value) || !hasSummaryCard(value) || !isRecord(value.feedback)) {
    return false
  }
  const feedback = value.feedback
  return (
    isFiniteNumber(feedback.correct) &&
    isFiniteNumber(feedback.wrong) &&
    isFiniteNumber(feedback.missed) &&
    Array.isArray(value.remarks) &&
    value.remarks.every(isRemark)
  )
}

export function isDeleted(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}

export function fieldErrorsFrom(body: unknown): Record<string, string> {
  if (!isRecord(body) || !Array.isArray(body.errors)) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const item of body.errors) {
    if (!isRecord(item) || typeof item.path !== 'string' || typeof item.message !== 'string') {
      continue
    }
    const previous = result[item.path]
    result[item.path] = previous === undefined ? item.message : `${previous} ${item.message}`
  }
  return result
}

export function messageFrom(body: unknown): string | null {
  if (!isRecord(body) || typeof body.message !== 'string') {
    return null
  }
  const text = body.message.trim()
  return text.length > 0 ? text : null
}
