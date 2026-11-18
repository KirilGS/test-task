import type { MetaResponse, SummaryListItem } from '@/api/types'
import { listSummaries } from '@/api/client'
import { useMetaStore } from '@/stores/meta'
import CheckView from '@/views/CheckView.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    listSummaries: vi.fn(),
  }
})

const STORAGE_KEY = 'support-summary.checked-scenarios'

const metaBody: MetaResponse = {
  aiAvailable: false,
  aiModel: null,
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

const review: SummaryListItem = {
  id: '507f1f77bcf86cd799439011',
  datasetId: '507f1f77bcf86cd799439012',
  datasetTitle: 'Случаи из задания',
  snapshotAt: '2026-11-16T10:00:00+03:00',
  mode: 'no-ai',
  createdAt: '2026-11-16T07:00:00.000Z',
  rejectedByCase: {},
  warnings: [],
  feedback: { correct: 1, wrong: 1, missed: 0 },
  remarks: [{ caseId: 'П-08', verdict: 'wrong', comment: 'Срок указан неверно' }],
}

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/summaries/:id', name: 'summary-saved', component: { template: '<div />' } },
      { path: '/check', component: CheckView },
    ],
  })
}

async function mountPage(): Promise<ReturnType<typeof mount>> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const meta = useMetaStore()
  meta.meta = metaBody
  meta.loading = false
  const history = router()
  await history.push('/check')
  const wrapper = mount(CheckView, { global: { plugins: [pinia, history] } })
  await flushPromises()
  return wrapper
}

describe('страница «Проверка»', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(listSummaries).mockReset()
    vi.mocked(listSummaries).mockResolvedValue([review])
  })

  it('показывает девять сценариев и сохраняет отметку', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('Сводка по заданию без ИИ')
    expect(text).toContain('Сводка по заданию с ИИ')
    expect(text).toContain('Переписка не заменяет CRM')
    expect(text).toContain('Подтверждение в CRM снимает вопрос')
    expect(text).toContain('Сообщение о задержке до наступления срока')
    expect(text).toContain('Новые случаи')
    expect(text).toContain('Вставка переписки')
    expect(text).toContain('Понятные ошибки')
    expect(text).toContain('Отзыв')
    expect(text).toContain('Проверено 0 из 9')
    expect(text).toContain('Нужен ИИ')
    expect(text).toContain('П-08')
    expect(text).toContain('С-24')

    const boxes = wrapper.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(9)
    await boxes[0]?.setValue(true)
    expect(wrapper.text()).toContain('Проверено 1 из 9')
    expect(localStorage.getItem(STORAGE_KEY)).toContain('task-no-ai')

    wrapper.unmount()
    const again = await mountPage()
    expect(again.text()).toContain('Проверено 1 из 9')
    const element = again.find('input[type="checkbox"]').element
    expect(element instanceof HTMLInputElement && element.checked).toBe(true)

    const reset = again.findAll('button').find((button) => button.text() === 'Сбросить отметки')
    if (reset === undefined) {
      throw new Error('Ожидалась кнопка «Сбросить отметки»')
    }
    await reset.trigger('click')
    expect(again.text()).toContain('Отметки сброшены.')
    expect(again.text()).toContain('Проверено 0 из 9')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('показывает отзывы и комментарий со ссылкой на сводку', async () => {
    const wrapper = await mountPage()
    expect(listSummaries).toHaveBeenCalledWith(undefined, 20)
    expect(wrapper.text()).toContain('Случаи из задания')
    expect(wrapper.text()).toContain('без ИИ')
    expect(wrapper.text()).toContain('16.11.2026, 10:00 (МСК)')
    expect(wrapper.text()).toContain('1 / 1 / 0')
    expect(wrapper.text()).toContain('Верно: 1 из 2 отметок')
    expect(wrapper.text()).toContain('Срок указан неверно')
    const link = wrapper.get('a[href="/summaries/507f1f77bcf86cd799439011"]')
    expect(link.text()).toBe('Открыть сводку')
  })
})
