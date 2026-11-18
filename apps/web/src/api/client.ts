import type { DatasetInput } from '@support-summary/core'
import {
  fieldErrorsFrom,
  isDatasetListItem,
  isDatasetView,
  isDeleted,
  isMetaResponse,
  isSummaryListItem,
  isSummaryView,
  messageFrom,
} from './parse'
import type {
  ApiFailure,
  DatasetListItem,
  DatasetUpdate,
  DatasetView,
  FeedbackInput,
  MetaResponse,
  SummaryCreateInput,
  SummaryListItem,
  SummaryView,
} from './types'

export const OFFLINE_MESSAGE =
  'Нет связи с сервером. Проверьте, что приложение запущено, и обновите страницу.'

export const SERVER_FAILURE_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.'

const UNREADABLE_MESSAGE = 'Не получилось прочитать ответ. Обновите страницу.'

export class ApiError extends Error {
  readonly fieldErrors: Record<string, string>
  readonly status: number

  constructor(failure: ApiFailure) {
    super(failure.message)
    this.name = 'ApiError'
    this.fieldErrors = failure.fieldErrors
    this.status = failure.status
  }
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof ApiError) {
    return reason.message
  }
  return SERVER_FAILURE_MESSAGE
}

export function failureFromStatus(status: number, body: unknown): ApiFailure {
  if (status >= 500) {
    return { message: SERVER_FAILURE_MESSAGE, fieldErrors: {}, status }
  }
  return {
    message: messageFrom(body) ?? SERVER_FAILURE_MESSAGE,
    fieldErrors: fieldErrorsFrom(body),
    status,
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.trim() === '') {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    return value
  } catch {
    return null
  }
}

async function request(path: string, method: Method, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { accept: 'application/json' }
  let payload: string | undefined
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(path, { method, headers, body: payload })
  } catch {
    throw new ApiError({ message: OFFLINE_MESSAGE, fieldErrors: {}, status: 0 })
  }

  const parsed = await readJson(response)
  if (!response.ok) {
    throw new ApiError(failureFromStatus(response.status, parsed))
  }
  return parsed
}

function unreadable(): never {
  throw new ApiError({ message: UNREADABLE_MESSAGE, fieldErrors: {}, status: 0 })
}

function one<T>(value: unknown, check: (item: unknown) => item is T): T {
  if (!check(value)) {
    unreadable()
  }
  return value
}

function many<T>(value: unknown, check: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) {
    unreadable()
  }
  const items: T[] = []
  for (const item of value) {
    if (!check(item)) {
      unreadable()
    }
    items.push(item)
  }
  return items
}

export function getMeta(): Promise<MetaResponse> {
  return request('/api/meta', 'GET').then((body) => one(body, isMetaResponse))
}

export function listDatasets(): Promise<DatasetListItem[]> {
  return request('/api/datasets', 'GET').then((body) => many(body, isDatasetListItem))
}

export function getDataset(id: string): Promise<DatasetView> {
  return request(`/api/datasets/${encodeURIComponent(id)}`, 'GET').then((body) =>
    one(body, isDatasetView),
  )
}

export function createDataset(input: DatasetInput): Promise<DatasetView> {
  return request('/api/datasets', 'POST', input).then((body) => one(body, isDatasetView))
}

export function copyDataset(id: string): Promise<DatasetView> {
  return request(`/api/datasets/${encodeURIComponent(id)}/copy`, 'POST').then((body) =>
    one(body, isDatasetView),
  )
}

export function updateDataset(id: string, input: DatasetUpdate): Promise<DatasetView> {
  return request(`/api/datasets/${encodeURIComponent(id)}`, 'PUT', input).then((body) =>
    one(body, isDatasetView),
  )
}

export function deleteDataset(id: string): Promise<{ id: string }> {
  return request(`/api/datasets/${encodeURIComponent(id)}`, 'DELETE').then((body) =>
    one(body, isDeleted),
  )
}

export function createSummary(input: SummaryCreateInput): Promise<SummaryView> {
  return request('/api/summaries', 'POST', input).then((body) => one(body, isSummaryView))
}

export function createSummaryWithAi(input: SummaryCreateInput): Promise<SummaryView> {
  return request('/api/summaries/ai', 'POST', input).then((body) => one(body, isSummaryView))
}

export function listSummaries(datasetId: string, limit?: number): Promise<SummaryListItem[]> {
  const query = new URLSearchParams({ datasetId })
  if (limit !== undefined) {
    query.set('limit', String(limit))
  }
  return request(`/api/summaries?${query.toString()}`, 'GET').then((body) =>
    many(body, isSummaryListItem),
  )
}

export function getSummary(id: string): Promise<SummaryView> {
  return request(`/api/summaries/${encodeURIComponent(id)}`, 'GET').then((body) =>
    one(body, isSummaryView),
  )
}

export function addFeedback(id: string, input: FeedbackInput): Promise<SummaryView> {
  return request(`/api/summaries/${encodeURIComponent(id)}/feedback`, 'POST', input).then((body) =>
    one(body, isSummaryView),
  )
}
