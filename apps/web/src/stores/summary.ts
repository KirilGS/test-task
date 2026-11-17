import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  ApiError,
  addFeedback,
  createSummary,
  createSummaryWithAi,
  errorMessage,
  getSummary,
} from '@/api/client'
import type { FeedbackInput, SummaryCreateInput, SummaryView } from '@/api/types'

export const useSummaryStore = defineStore('summary', () => {
  const current = ref<SummaryView | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  let latest = 0

  function rememberError(reason: unknown): void {
    if (reason instanceof ApiError) {
      error.value = reason.message
      fieldErrors.value = reason.fieldErrors
      return
    }
    error.value = errorMessage(reason)
    fieldErrors.value = {}
  }

  async function track(work: () => Promise<SummaryView>): Promise<void> {
    const request = ++latest
    loading.value = true
    error.value = null
    fieldErrors.value = {}
    try {
      const summary = await work()
      if (request !== latest) {
        return
      }
      current.value = summary
    } catch (reason) {
      if (request !== latest) {
        return
      }
      rememberError(reason)
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  function open(id: string): Promise<void> {
    return track(() => getSummary(id))
  }

  function createPlain(input: SummaryCreateInput): Promise<void> {
    return track(() => createSummary(input))
  }

  function createWithAi(input: SummaryCreateInput): Promise<void> {
    return track(() => createSummaryWithAi(input))
  }

  function sendFeedback(id: string, input: FeedbackInput): Promise<void> {
    return track(() => addFeedback(id, input))
  }

  return {
    current,
    loading,
    error,
    fieldErrors,
    open,
    createPlain,
    createWithAi,
    sendFeedback,
  }
})
