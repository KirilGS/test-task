import type { CaseAssessment } from '@support-summary/core'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createSummary, listDatasets, listSummaries } from '@/api/client'
import type { MetaResponse } from '@/api/types'
import CaseCard from '@/components/CaseCard.vue'
import { useMetaStore } from '@/stores/meta'
import SummaryPage from '@/views/SummaryPage.vue'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    listDatasets: vi.fn(),
    listSummaries: vi.fn(),
    createSummary: vi.fn(),
    createSummaryWithAi: vi.fn(),
    getSummary: vi.fn(),
  }
})

const DATASET_ID = '507f1f77bcf86cd799439011'

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

const cardCase: CaseAssessment = {
  caseId: 'П-08',
  caseType: 'card_delivery',
  priority: 'critical',
  needsAction: true,
  deadline: '2026-11-16T10:00:00+03:00',
  crmFacts: ['Карты в пути, срок уже наступил'],
  chatFacts: ['Курьер написал о задержке'],
  toCheck: [],
  nextSteps: ['Связаться с курьером'],
  firedRules: ['DEL-1'],
}

function buttonDisabled(element: Element): boolean {
  return element instanceof HTMLButtonElement && element.disabled
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(listDatasets).mockResolvedValue([
    {
      id: DATASET_ID,
      slug: 'demo-task',
      title: 'Случаи из задания',
      isDemo: true,
      snapshotAt: '2026-11-16T10:00:00+03:00',
      version: 1,
      createdAt: '2026-11-16T07:00:00.000Z',
      updatedAt: '2026-11-16T07:00:00.000Z',
      casesCount: 4,
    },
  ])
  vi.mocked(listSummaries).mockResolvedValue([])
})

describe('карточка случая', () => {
  it('показывает сведения из CRM и из переписки отдельно', () => {
    const meta = useMetaStore()
    meta.meta = metaBody
    const wrapper = mount(CaseCard, {
      props: {
        assessment: cardCase,
        claims: [],
        rejected: 0,
        rules: metaBody.rules,
        saved: false,
        saving: false,
      },
    })
    expect(wrapper.text()).toContain('Подтверждено в CRM')
    expect(wrapper.text()).toContain('Карты в пути, срок уже наступил')
    expect(wrapper.text()).toContain('Известно только из переписки')
    expect(wrapper.text()).toContain('не подтверждено')
    expect(wrapper.text()).toContain('Курьер написал о задержке')
  })

  it('предупреждает, если ИИ предложил факты не из сообщений', () => {
    const meta = useMetaStore()
    meta.meta = metaBody
    const wrapper = mount(CaseCard, {
      props: {
        assessment: cardCase,
        claims: [],
        rejected: 2,
        rules: metaBody.rules,
        saved: false,
        saving: false,
      },
    })
    expect(wrapper.text()).toContain(
      'ИИ предложил 2 факта, которых нет в сообщениях. Они не учтены',
    )
  })
})

describe('кнопка расчёта', () => {
  it('недоступна, пока сводка считается', async () => {
    vi.mocked(createSummary).mockImplementation(() => new Promise(() => undefined))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'summary', component: SummaryPage },
        { path: '/summaries/:id', name: 'summary-saved', component: SummaryPage },
        { path: '/ai', name: 'ai', component: SummaryPage },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(SummaryPage, { global: { plugins: [router] } })
    await flushPromises()
    const select = wrapper.get('#dataset').element
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Ожидался список наборов')
    }
    expect(select.value).toBe(DATASET_ID)
    const button = wrapper.get('button.button-primary')
    expect(buttonDisabled(button.element)).toBe(false)
    void wrapper.get('form').trigger('submit')
    await vi.waitFor(() => {
      expect(buttonDisabled(button.element)).toBe(true)
    })
    expect(wrapper.text()).toContain('Проверяем сроки и читаем переписку')
  })
})
