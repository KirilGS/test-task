import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAiSettings, getMeta, saveAiSettings } from '@/api/client'
import type { AiSettingsView, MetaResponse } from '@/api/types'
import { useMetaStore } from '@/stores/meta'
import AiSettingsPage from '@/views/AiSettingsView.vue'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getAiSettings: vi.fn(),
    saveAiSettings: vi.fn(),
    clearAiSettings: vi.fn(),
    getMeta: vi.fn(),
  }
})

const emptyView: AiSettingsView = {
  configured: false,
  provider: null,
  providerLabel: null,
  model: null,
  problem: null,
}

const metaBody: MetaResponse = {
  aiAvailable: true,
  aiModel: 'test-model',
  rules: [],
  prompt: '',
  labels: {
    priority: {
      critical: 'Критично',
      high: 'Высокий',
      medium: 'Средний',
      none: 'Действий не требуется',
    },
    caseType: {
      onboarding: 'Оформление сотрудника',
      offboarding: 'Увольнение сотрудника',
      card_delivery: 'Поставка карт',
    },
    author: {
      employee: 'Сотрудник',
      manager: 'Руководитель',
      courier: 'Курьер',
      recipient: 'Получатель',
      other: 'Другое',
    },
  },
  limits: {
    maxCases: 30,
    maxMessages: 20,
    maxMessageLength: 1000,
    aiRequestsPerHour: 20,
  },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(getAiSettings).mockResolvedValue(emptyView)
  vi.mocked(getMeta).mockResolvedValue(metaBody)
})

describe('страница подключения ИИ', () => {
  it('сохраняет ключ и больше не показывает его', async () => {
    const saved: AiSettingsView = {
      configured: true,
      provider: 'openai',
      providerLabel: 'OpenAI',
      model: 'test-model',
      problem: null,
    }
    vi.mocked(saveAiSettings).mockResolvedValue(saved)
    const meta = useMetaStore()
    meta.meta = { ...metaBody, aiAvailable: false, aiModel: null }
    const wrapper = mount(AiSettingsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    await wrapper.get('#ai-model').setValue('test-model')
    await wrapper.get('#ai-secret').setValue('unit-test-key')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(saveAiSettings).toHaveBeenCalledWith({
      provider: 'openai',
      apiKey: 'unit-test-key',
      model: 'test-model',
    })
    expect(wrapper.text()).toContain('Ключ сохранён')
    expect(wrapper.text()).not.toContain('unit-test-key')
    expect(wrapper.get('#ai-secret').element).toBeInstanceOf(HTMLInputElement)
    const input = wrapper.get('#ai-secret').element
    if (input instanceof HTMLInputElement) {
      expect(input.value).toBe('')
    }
  })
})
