import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataset, getMeta, OFFLINE_MESSAGE } from '../client'

const metaBody = {
  aiAvailable: false,
  aiModel: null,
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('запросы к серверу', () => {
  it('читает справочник', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(metaBody)))
    const meta = await getMeta()
    expect(meta.aiAvailable).toBe(false)
    expect(meta.labels.priority.critical).toBe('Критично')
  })

  it('показывает текст сервера и ошибку у поля', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        jsonResponse(
          {
            message: 'Проверьте заполнение полей',
            errors: [{ path: 'title', message: 'Укажите название набора' }],
          },
          400,
        ),
      ),
    )
    const input = { title: '', snapshotAt: '2026-11-16T10:00:00+03:00', cases: [] }
    await expect(createDataset(input)).rejects.toMatchObject({
      message: 'Проверьте заполнение полей',
      fieldErrors: { title: 'Укажите название набора' },
    })
  })

  it('заменяет ответ сервера при внутренней ошибке', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'stack trace' }, 500)),
    )
    await expect(getMeta()).rejects.toMatchObject({
      message: 'Что-то пошло не так. Попробуйте ещё раз.',
      fieldErrors: {},
    })
  })

  it('объясняет, что сервер недоступен', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getMeta()).rejects.toMatchObject({ message: OFFLINE_MESSAGE })
  })
})
