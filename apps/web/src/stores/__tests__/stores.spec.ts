import type { SummaryView } from '@/api/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getMeta, getSummary, OFFLINE_MESSAGE } from '@/api/client'
import { useMetaStore } from '@/stores/meta'
import { useSummaryStore } from '@/stores/summary'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getMeta: vi.fn(),
    getSummary: vi.fn(),
  }
})

const metaBody = {
  aiAvailable: true,
  aiModel: 'test-model',
  rules: [],
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

function summary(id: string): SummaryView {
  return {
    id,
    datasetId: '507f1f77bcf86cd799439011',
    datasetTitle: 'Случаи из задания',
    snapshotAt: '2026-11-16T10:00:00+03:00',
    mode: 'no-ai',
    createdAt: '2026-11-16T07:00:00.000Z',
    assessments: [
      {
        caseId: 'П-08',
        caseType: 'card_delivery',
        priority: 'critical',
        needsAction: true,
        deadline: '2026-11-16T10:00:00+03:00',
        crmFacts: [],
        chatFacts: [],
        toCheck: [],
        nextSteps: [],
        firedRules: ['DEL-1'],
      },
    ],
    claimsByCase: {},
    rejectedByCase: {},
    warnings: [],
    markdown: '',
    feedback: [],
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('справочник', () => {
  it('загружается один раз при старте', async () => {
    vi.mocked(getMeta).mockResolvedValue(metaBody)
    const store = useMetaStore()
    store.ensure()
    store.ensure()
    await vi.waitFor(() => {
      expect(store.loading).toBe(false)
    })
    expect(getMeta).toHaveBeenCalledTimes(1)
    expect(store.meta?.aiModel).toBe('test-model')
  })

  it('показывает сообщение, если сервер недоступен', async () => {
    vi.mocked(getMeta).mockRejectedValue(
      new ApiError({ message: OFFLINE_MESSAGE, fieldErrors: {}, status: 0 }),
    )
    const store = useMetaStore()
    await store.retry()
    expect(store.loading).toBe(false)
    expect(store.meta).toBeNull()
    expect(store.error).toBe(
      'Нет связи с сервером. Проверьте, что приложение запущено, и обновите страницу.',
    )
  })
})

describe('сводка', () => {
  it('оставляет последнюю сводку, если более ранний ответ пришёл позже', async () => {
    const first = deferred<SummaryView>()
    const second = deferred<SummaryView>()
    vi.mocked(getSummary)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const store = useSummaryStore()
    const older = store.open('older')
    const newer = store.open('newer')
    second.resolve(summary('newer'))
    await newer
    first.resolve(summary('older'))
    await older
    expect(store.current?.id).toBe('newer')
    expect(store.loading).toBe(false)
  })
})
