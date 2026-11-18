import type { DatasetView } from '@/api/types'
import { ApiError, getDataset, updateDataset } from '@/api/client'
import type { MetaResponse } from '@/api/types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useMetaStore } from '@/stores/meta'
import DatasetEditorView from '@/views/DatasetEditorView.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getDataset: vi.fn(),
    updateDataset: vi.fn(),
    copyDataset: vi.fn(),
  }
})

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

const dataset: DatasetView = {
  id: 'abc',
  slug: null,
  title: 'Проверка',
  isDemo: false,
  snapshotAt: '2026-11-16T10:00:00+03:00',
  version: 1,
  createdAt: '2026-11-16T07:00:00.000Z',
  updatedAt: '2026-11-16T07:00:00.000Z',
  cases: [
    {
      id: 'П-10',
      type: 'card_delivery',
      crm: { status: 'in_transit', plannedBy: null, acceptedAt: null, note: '' },
      messages: [],
    },
    {
      id: 'П-11',
      type: 'onboarding',
      crm: { firstShiftDate: '2026-11-16', documentsStatus: 'pending', note: '' },
      messages: [],
    },
  ],
}

async function mountEditor() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const meta = useMetaStore()
  meta.meta = metaBody
  meta.loading = false
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'summary', component: { template: '<div>Сводка</div>' } },
      { path: '/datasets', name: 'datasets', component: { template: '<div>Список</div>' } },
      { path: '/datasets/:id', name: 'dataset', component: DatasetEditorView },
    ],
  })
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [pinia, router] } })
  await router.push('/datasets/abc')
  await router.isReady()
  await flushPromises()
  return { wrapper, router }
}

async function clickSave(wrapper: Awaited<ReturnType<typeof mountEditor>>['wrapper']) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('редактор набора', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false
    }
    vi.mocked(getDataset).mockResolvedValue(dataset)
    vi.mocked(updateDataset).mockReset()
  })

  it('показывает ошибку сервера рядом с полем и раскрывает случай', async () => {
    vi.mocked(updateDataset).mockRejectedValue(
      new ApiError({
        message: 'Проверьте заполнение полей',
        fieldErrors: { 'cases.1.crm.note': 'Проверочная ошибка у комментария' },
        status: 400,
      }),
    )
    const { wrapper } = await mountEditor()
    const blocks = wrapper.findAll('details.case-block')
    expect(blocks[1]?.attributes('open')).toBeUndefined()
    await clickSave(wrapper)
    const note = wrapper.get('[data-field="cases.1.crm.note"]')
    expect(note.text()).toContain('Проверочная ошибка у комментария')
    expect(wrapper.findAll('details.case-block')[1]?.attributes('open')).toBe('')
  })

  it('объясняет, что набор уже изменили', async () => {
    vi.mocked(updateDataset).mockRejectedValue(
      new ApiError({
        message: 'Набор изменил кто-то другой. Обновите страницу',
        fieldErrors: {},
        status: 409,
      }),
    )
    const { wrapper } = await mountEditor()
    await clickSave(wrapper)
    expect(wrapper.text()).toContain(
      'Этот набор кто-то изменил. Обновите страницу, чтобы увидеть новую версию',
    )
  })

  it('не уходит со страницы, пока изменения не сохранены', async () => {
    const { wrapper, router } = await mountEditor()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    await wrapper.get('#dataset-title').setValue('Другое название')
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)

    const navigation = router.push('/')
    await flushPromises()
    await nextTick()
    expect(wrapper.getComponent(ConfirmDialog).props('open')).toBe(true)
    const stay = wrapper.findAll('button').find((button) => button.text() === 'Остаться')
    if (stay === undefined) {
      throw new Error('Нет кнопки «Остаться»')
    }
    await stay.trigger('click')
    await navigation.catch(() => undefined)
    expect(router.currentRoute.value.name).toBe('dataset')
    const input = wrapper.get('#dataset-title').element
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Нет поля названия')
    }
    expect(input.value).toBe('Другое название')
  })
})
