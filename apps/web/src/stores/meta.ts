import { defineStore } from 'pinia'
import { ref } from 'vue'
import { errorMessage, getMeta } from '@/api/client'
import type { MetaResponse } from '@/api/types'

export const useMetaStore = defineStore('meta', () => {
  const meta = ref<MetaResponse | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let started = false

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      meta.value = await getMeta()
    } catch (reason) {
      meta.value = null
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  function ensure(): void {
    if (started) {
      return
    }
    started = true
    void load()
  }

  function retry(): Promise<void> {
    return load()
  }

  async function refresh(): Promise<void> {
    try {
      meta.value = await getMeta()
      error.value = null
    } catch (reason) {
      if (meta.value === null) {
        error.value = errorMessage(reason)
      }
    }
  }

  return { meta, loading, error, ensure, retry, refresh }
})
