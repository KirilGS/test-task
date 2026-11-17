import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  ApiError,
  addFeedback,
  createSummary,
  createSummaryWithAi,
  errorMessage,
  getSummary,
  listSummaries,
} from '@/api/client'
import type { FeedbackInput, SummaryCreateInput, SummaryListItem, SummaryView } from '@/api/types'

export type SummaryLoadResult =
  | { status: 'ready'; summary: SummaryView }
  | { status: 'stale' }
  | { status: 'error' }

export const useSummaryStore = defineStore('summary', () => {
  const current = ref<SummaryView | null>(null)
  const history = ref<SummaryListItem[]>([])
  const loading = ref(false)
  const savingFeedback = ref(false)
  const historyLoading = ref(false)
  const error = ref<string | null>(null)
  const historyError = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  let latest = 0
  let historyRequest = 0

  function rememberError(reason: unknown): void {
    if (reason instanceof ApiError) {
      error.value = reason.message
      fieldErrors.value = reason.fieldErrors
      return
    }
    error.value = errorMessage(reason)
    fieldErrors.value = {}
  }

  async function track(
    kind: 'summary' | 'feedback',
    work: () => Promise<SummaryView>,
  ): Promise<SummaryLoadResult> {
    const request = ++latest
    if (kind === 'summary') {
      loading.value = true
      savingFeedback.value = false
    } else {
      savingFeedback.value = true
    }
    error.value = null
    fieldErrors.value = {}
    try {
      const summary = await work()
      if (request !== latest) {
        return { status: 'stale' }
      }
      current.value = summary
      return { status: 'ready', summary }
    } catch (reason) {
      if (request !== latest) {
        return { status: 'stale' }
      }
      rememberError(reason)
      return { status: 'error' }
    } finally {
      if (request === latest) {
        loading.value = false
        savingFeedback.value = false
      }
    }
  }

  function open(id: string): Promise<SummaryLoadResult> {
    return track('summary', () => getSummary(id))
  }

  function createPlain(input: SummaryCreateInput): Promise<SummaryLoadResult> {
    return track('summary', () => createSummary(input))
  }

  function createWithAi(input: SummaryCreateInput): Promise<SummaryLoadResult> {
    return track('summary', () => createSummaryWithAi(input))
  }

  function sendFeedback(id: string, input: FeedbackInput): Promise<SummaryLoadResult> {
    return track('feedback', () => addFeedback(id, input))
  }

  async function loadHistory(datasetId: string): Promise<void> {
    const request = ++historyRequest
    historyLoading.value = true
    historyError.value = null
    try {
      const items = await listSummaries(datasetId, 6)
      if (request !== historyRequest) {
        return
      }
      history.value = items
    } catch (reason) {
      if (request !== historyRequest) {
        return
      }
      history.value = []
      historyError.value = errorMessage(reason)
    } finally {
      if (request === historyRequest) {
        historyLoading.value = false
      }
    }
  }

  return {
    current,
    history,
    loading,
    savingFeedback,
    historyLoading,
    error,
    historyError,
    fieldErrors,
    open,
    createPlain,
    createWithAi,
    sendFeedback,
    loadHistory,
  }
})
