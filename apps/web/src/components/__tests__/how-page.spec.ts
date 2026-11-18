import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { MetaResponse } from '@/api/types'
import { useMetaStore } from '@/stores/meta'
import HowView from '@/views/HowView.vue'

const metaBody: MetaResponse = {
  aiAvailable: false,
  aiModel: null,
  rules: [
    {
      code: 'DEL-1',
      title: 'Срок доставки уже наступил',
      description: 'Доставка всё ещё в пути, а срок уже наступил.',
    },
  ],
  prompt: 'Как читать переписку',
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

describe('страница «Как это работает»', () => {
  it('показывает пять разделов, правила и текст промпта', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const meta = useMetaStore()
    meta.meta = metaBody
    meta.loading = false

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'summary', component: HowView }],
    })
    const wrapper = mount(HowView, { global: { plugins: [pinia, router] } })
    const text = wrapper.text()

    expect(text).toContain('Как устроена обработка')
    expect(text).toContain('Как читать сводку')
    expect(text).toContain('С чего начать')
    expect(text).toContain('Критично')
    expect(text).toContain('Поставка карт')
    expect(wrapper.get('a.button-primary').text()).toBe('Открыть сводку')
    expect(text).toContain('Данные из CRM и сообщения из чатов')
    expect(text).toContain('ИИ находит в сообщениях факты')
    expect(text).toContain('Правила считают срочность по CRM')
    expect(text).toContain('Сводка для support-отдела')
    expect(text).toContain('Правила')
    expect(text).toContain('DEL-1')
    expect(text).toContain('Срок доставки уже наступил')
    expect(text).toContain('Промпт для ИИ')
    expect(text).toContain('Как читать переписку')
    expect(text).toContain('Первый запуск')
    expect(text).toContain('Что проверено и что нет')
    expect(text).toContain('Этот раздел ещё готовится')
    expect(wrapper.html()).not.toContain('<script')
  })
})
