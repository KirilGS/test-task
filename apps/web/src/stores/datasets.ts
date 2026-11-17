import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, errorMessage, getDataset, listDatasets } from '@/api/client'
import type { DatasetListItem, DatasetView } from '@/api/types'

export const useDatasetsStore = defineStore('datasets', () => {
  const items = ref<DatasetListItem[]>([])
  const selected = ref<DatasetView | null>(null)
  const listLoading = ref(false)
  const selectedLoading = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  let listRequest = 0
  let itemRequest = 0

  function rememberError(reason: unknown): void {
    if (reason instanceof ApiError) {
      error.value = reason.message
      fieldErrors.value = reason.fieldErrors
      return
    }
    error.value = errorMessage(reason)
    fieldErrors.value = {}
  }

  async function loadList(): Promise<void> {
    const request = ++listRequest
    listLoading.value = true
    error.value = null
    fieldErrors.value = {}
    try {
      const next = await listDatasets()
      if (request !== listRequest) {
        return
      }
      items.value = next
    } catch (reason) {
      if (request !== listRequest) {
        return
      }
      rememberError(reason)
    } finally {
      if (request === listRequest) {
        listLoading.value = false
      }
    }
  }

  async function open(id: string): Promise<void> {
    const request = ++itemRequest
    selectedLoading.value = true
    selected.value = null
    error.value = null
    fieldErrors.value = {}
    try {
      const dataset = await getDataset(id)
      if (request !== itemRequest) {
        return
      }
      selected.value = dataset
    } catch (reason) {
      if (request !== itemRequest) {
        return
      }
      rememberError(reason)
    } finally {
      if (request === itemRequest) {
        selectedLoading.value = false
      }
    }
  }

  return {
    items,
    selected,
    listLoading,
    selectedLoading,
    error,
    fieldErrors,
    loadList,
    open,
  }
})
