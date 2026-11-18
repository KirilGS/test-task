<script setup lang="ts">
import type { Author, CaseType } from '@support-summary/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ApiError,
  copyDataset,
  errorMessage,
  getDataset,
  updateDataset,
} from '@/api/client'
import type { DatasetView } from '@/api/types'
import AppNotice from '@/components/AppNotice.vue'
import CaseEditor from '@/components/CaseEditor.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useMetaStore } from '@/stores/meta'
import {
  blankCase,
  buildInput,
  datasetFromFile,
  datasetToForm,
  formSignature,
  nextCaseId,
  type DatasetForm,
  type FormLimits,
} from '@/utils/datasetForm'

const CONFLICT_MESSAGE =
  'Этот набор кто-то изменил. Обновите страницу, чтобы увидеть новую версию'

const AUTHOR_ORDER: readonly Author[] = ['employee', 'manager', 'courier', 'recipient', 'other']
const CASE_TYPES: readonly CaseType[] = ['onboarding', 'offboarding', 'card_delivery']
const CASE_NOTES: Record<CaseType, string> = {
  onboarding: 'Первый выход и документы',
  offboarding: 'Последний день и подтверждение руководителя',
  card_delivery: 'Статус и срок доставки',
}

const route = useRoute()
const router = useRouter()
const metaStore = useMetaStore()
const page = useTemplateRef('page')
const fileInput = useTemplateRef('fileInput')

const form = ref<DatasetForm>({ title: '', snapshotAt: '', cases: [] })
const loaded = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)
const version = ref(0)
const isDemo = ref(false)
const datasetId = ref('')
const savedSignature = ref('')
const fieldErrors = ref<Record<string, string>>({})
const openByKey = ref<Record<string, boolean>>({})
const notice = ref<{ kind: 'success' | 'error'; message: string } | null>(null)
const savedVisible = ref(false)
const saving = ref(false)
const copying = ref(false)
const fileNotice = ref<string | null>(null)
const fileErrors = ref<string[]>([])
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('Подтвердить')
const cancelLabel = ref('Отмена')
const leaveConfirmed = ref(false)
let onYes: (() => void) | null = null
let onNo: (() => void) | null = null
let loadToken = 0
let saveToken = 0

const limits = computed<FormLimits>(() => {
  const value = metaStore.meta?.limits
  if (value === undefined) {
    return { maxCases: 30, maxMessages: 20, maxMessageLength: 1000 }
  }
  return {
    maxCases: value.maxCases,
    maxMessages: value.maxMessages,
    maxMessageLength: value.maxMessageLength,
  }
})

const labels = computed(() => metaStore.meta?.labels ?? null)
const ready = computed(() => loaded.value && labels.value !== null)
const headingTitle = computed(() => {
  const title = form.value.title.trim()
  return title === '' ? 'Набор случаев' : title
})
const dirty = computed(
  () => loaded.value && !isDemo.value && formSignature(form.value) !== savedSignature.value,
)
const atCaseLimit = computed(() => form.value.cases.length >= limits.value.maxCases)
const authors = computed(() => {
  const authorLabels = labels.value?.author
  if (authorLabels === undefined) {
    return []
  }
  return AUTHOR_ORDER.map((value) => ({ value, label: authorLabels[value] }))
})

watch(dirty, (value) => {
  if (!value) {
    return
  }
  savedVisible.value = false
  if (notice.value?.kind === 'success') {
    notice.value = null
  }
})

watch(
  () => {
    const value = route.params.id
    return typeof value === 'string' ? value : ''
  },
  (id) => {
    void load(id)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

onBeforeRouteLeave(() => {
  if (!dirty.value || leaveConfirmed.value) {
    return true
  }
  return askLeave()
})

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!dirty.value) {
    return
  }
  event.preventDefault()
}

async function load(id: string): Promise<void> {
  const token = ++loadToken
  loading.value = true
  loaded.value = false
  loadError.value = null
  notice.value = null
  savedVisible.value = false
  fileNotice.value = null
  fileErrors.value = []
  fieldErrors.value = {}
  leaveConfirmed.value = false
  if (id === '') {
    loading.value = false
    loadError.value = 'Набор не найден'
    return
  }
  try {
    const dataset = await getDataset(id)
    if (token !== loadToken) {
      return
    }
    applyDataset(dataset)
  } catch (reason) {
    if (token !== loadToken) {
      return
    }
    loadError.value = errorMessage(reason)
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

function applyDataset(dataset: DatasetView): void {
  const next = datasetToForm(dataset)
  savedSignature.value = formSignature(next)
  form.value = next
  version.value = dataset.version
  isDemo.value = dataset.isDemo
  datasetId.value = dataset.id
  fieldErrors.value = {}
  const opened: Record<string, boolean> = {}
  next.cases.forEach((item, index) => {
    opened[item.key] = index === 0
  })
  openByKey.value = opened
  loaded.value = true
}

function replaceCase(index: number, next: DatasetForm['cases'][number]): void {
  if (form.value.cases[index] === undefined) {
    return
  }
  form.value.cases[index] = next
}

function setOpen(key: string, open: boolean): void {
  openByKey.value = { ...openByKey.value, [key]: open }
}

function addCase(type: CaseType): void {
  if (!loaded.value || isDemo.value || atCaseLimit.value) {
    return
  }
  const item = blankCase(type, nextCaseId(form.value.cases))
  form.value.cases.push(item)
  openByKey.value = { ...openByKey.value, [item.key]: true }
}

async function save(): Promise<void> {
  if (!loaded.value || isDemo.value || saving.value) {
    return
  }
  const built = buildInput(form.value, limits.value)
  if (!built.ok) {
    fieldErrors.value = built.errors
    revealErrors(built.errors)
    notice.value = { kind: 'error', message: 'Проверьте заполнение полей' }
    savedVisible.value = false
    return
  }
  const token = ++saveToken
  saving.value = true
  notice.value = null
  fieldErrors.value = {}
  try {
    const saved = await updateDataset(datasetId.value, {
      ...built.value,
      version: version.value,
    })
    if (token !== saveToken) {
      return
    }
    applyDataset(saved)
    savedVisible.value = true
    notice.value = { kind: 'success', message: 'Сохранено' }
    fileNotice.value = null
    fileErrors.value = []
  } catch (reason) {
    if (token !== saveToken) {
      return
    }
    savedVisible.value = false
    showFailure(reason)
  } finally {
    if (token === saveToken) {
      saving.value = false
    }
  }
}

async function makeCopy(): Promise<void> {
  if (copying.value || datasetId.value === '') {
    return
  }
  if (dirty.value) {
    const agreed = await askLeave()
    if (!agreed) {
      return
    }
    leaveConfirmed.value = true
  }
  copying.value = true
  try {
    const created = await copyDataset(datasetId.value)
    leaveConfirmed.value = true
    await router.push({ name: 'dataset', params: { id: created.id } })
  } catch (reason) {
    leaveConfirmed.value = false
    showFailure(reason)
  } finally {
    copying.value = false
  }
}

function showFailure(reason: unknown): void {
  if (reason instanceof ApiError && reason.status === 409) {
    notice.value = { kind: 'error', message: CONFLICT_MESSAGE }
    fieldErrors.value = reason.fieldErrors
    revealErrors(reason.fieldErrors)
    return
  }
  if (reason instanceof ApiError) {
    notice.value = { kind: 'error', message: reason.message }
    fieldErrors.value = reason.fieldErrors
    revealErrors(reason.fieldErrors)
    return
  }
  notice.value = { kind: 'error', message: errorMessage(reason) }
  fieldErrors.value = {}
}

function revealErrors(errors: Record<string, string>): void {
  const opened = { ...openByKey.value }
  for (const path of Object.keys(errors)) {
    const match = /^cases\.(\d+)(?:\.|$)/.exec(path)
    const indexText = match?.[1]
    if (indexText === undefined) {
      continue
    }
    const item = form.value.cases[Number(indexText)]
    if (item === undefined) {
      continue
    }
    opened[item.key] = true
  }
  openByKey.value = opened
  void nextTick(() => {
    const root = page.value
    if (root === null) {
      return
    }
    const first = root.querySelector('[aria-invalid="true"]')
    if (first instanceof HTMLElement) {
      first.focus()
    }
  })
}

function pickFile(): void {
  if (isDemo.value) {
    return
  }
  fileInput.value?.click()
}

function download(): void {
  const built = buildInput(form.value, limits.value)
  if (!built.ok) {
    fieldErrors.value = built.errors
    revealErrors(built.errors)
    fileNotice.value = 'Сначала исправьте поля, отмеченные ошибками.'
    fileErrors.value = []
    return
  }
  const blob = new Blob([JSON.stringify(built.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'nabor.json'
  link.click()
  URL.revokeObjectURL(url)
  fileNotice.value = 'Файл скачан.'
  fileErrors.value = []
}

async function onFile(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  const file = input.files?.item(0) ?? null
  input.value = ''
  if (file === null || isDemo.value) {
    return
  }
  let raw: unknown
  try {
    raw = parseJson(await file.text())
  } catch {
    fileNotice.value = 'Не удалось прочитать файл. Проверьте, что это набор случаев.'
    fileErrors.value = []
    return
  }
  const read = datasetFromFile(raw)
  if (!read.ok) {
    fileNotice.value = 'Файл не подошёл. Исправьте замечания и загрузите его снова.'
    fileErrors.value = Object.entries(read.errors).map(([path, message]) =>
      path === 'file' ? message : `${fileFieldName(path)}: ${message}`,
    )
    return
  }
  form.value = read.form
  const opened: Record<string, boolean> = {}
  read.form.cases.forEach((item, index) => {
    opened[item.key] = index === 0
  })
  openByKey.value = opened
  fieldErrors.value = {}
  fileErrors.value = []
  fileNotice.value = 'Набор загружен из файла. Нажмите «Сохранить», чтобы записать его.'
}

function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text)
  return value
}

function fileFieldName(path: string): string {
  if (path === 'title') {
    return 'Название'
  }
  if (path === 'snapshotAt') {
    return 'Момент сводки'
  }
  const match = /^cases\.(\d+)/.exec(path)
  const indexText = match?.[1]
  if (indexText !== undefined) {
    return `Случай ${Number(indexText) + 1}`
  }
  return 'Поле'
}

function askRemoveCase(index: number): void {
  const item = form.value.cases[index]
  if (item === undefined) {
    return
  }
  const name = item.id.trim() === '' ? 'этот случай' : `случай ${item.id.trim()}`
  openConfirm(
    'Удалить случай?',
    `Удалить ${name}? Если передумаете, не сохраняйте набор.`,
    'Удалить',
    'Оставить',
    () => {
      const current = form.value.cases[index]
      if (current === undefined) {
        return
      }
      form.value.cases.splice(index, 1)
      const next: Record<string, boolean> = {}
      for (const [key, isOpen] of Object.entries(openByKey.value)) {
        if (key !== current.key) {
          next[key] = isOpen
        }
      }
      openByKey.value = next
    },
    () => undefined,
  )
}

function askRemoveMessage(caseIndex: number, messageIndex: number): void {
  openConfirm(
    'Удалить сообщение?',
    'Сообщение исчезнет из случая. Если передумаете, не сохраняйте набор.',
    'Удалить',
    'Оставить',
    () => {
      const item = form.value.cases[caseIndex]
      if (item === undefined) {
        return
      }
      const messages = item.messages.filter((_, position) => position !== messageIndex)
      form.value.cases[caseIndex] = { ...item, messages }
    },
    () => undefined,
  )
}

function askLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    openConfirm(
      'Уйти без сохранения?',
      'Изменения ещё не сохранены. Если уйти, они пропадут.',
      'Уйти',
      'Остаться',
      () => resolve(true),
      () => resolve(false),
    )
  })
}

function openConfirm(
  title: string,
  message: string,
  confirm: string,
  cancel: string,
  yes: () => void,
  no: () => void,
): void {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmLabel.value = confirm
  cancelLabel.value = cancel
  onYes = yes
  onNo = no
  confirmOpen.value = true
}

function confirmYes(): void {
  const action = onYes
  closeConfirm()
  action?.()
}

function confirmNo(): void {
  const action = onNo
  closeConfirm()
  action?.()
}

function closeConfirm(): void {
  confirmOpen.value = false
  onYes = null
  onNo = null
}
</script>

<template>
  <main ref="page" class="page">
    <p class="back">
      <RouterLink to="/datasets">К списку наборов</RouterLink>
    </p>
    <h1>{{ ready ? headingTitle : 'Набор случаев' }}</h1>
    <p v-if="loading" role="status">Загружаем набор…</p>
    <template v-else-if="loadError">
      <AppNotice kind="error" :message="loadError" />
    </template>
    <form v-else-if="ready && labels" class="editor" @submit.prevent="save">
      <section v-if="isDemo" class="demo-banner">
        <p>
          Это пример из задания, его нельзя менять. Сделайте копию, чтобы поэкспериментировать
        </p>
        <button type="button" class="button-primary" :disabled="copying" @click="makeCopy">
          Сделать копию
        </button>
      </section>
      <AppNotice v-if="notice" :kind="notice.kind" :message="notice.message" />
      <div class="field" data-field="title">
        <label for="dataset-title">Название</label>
        <input
          id="dataset-title"
          v-model="form.title"
          :disabled="isDemo"
          maxlength="100"
          :aria-invalid="fieldErrors.title !== undefined"
        />
        <p v-if="fieldErrors.title" class="field-error">{{ fieldErrors.title }}</p>
      </div>
      <div class="field" data-field="snapshotAt">
        <label for="dataset-snapshot">Момент сводки (МСК)</label>
        <input
          id="dataset-snapshot"
          v-model="form.snapshotAt"
          type="datetime-local"
          :disabled="isDemo"
          :aria-invalid="fieldErrors.snapshotAt !== undefined"
        />
        <p v-if="fieldErrors.snapshotAt" class="field-error">{{ fieldErrors.snapshotAt }}</p>
      </div>
      <p v-if="fieldErrors.cases" class="field-error">{{ fieldErrors.cases }}</p>
      <div class="cases">
        <CaseEditor
          v-for="(item, index) in form.cases"
          :key="item.key"
          :model-value="item"
          :index="index"
          :open="openByKey[item.key] === true"
          :readonly="isDemo"
          :case-type-label="labels.caseType[item.type]"
          :authors="authors"
          :errors="fieldErrors"
          :max-messages="limits.maxMessages"
          :max-message-length="limits.maxMessageLength"
          :can-remove="form.cases.length > 1"
          @update:model-value="replaceCase(index, $event)"
          @toggle="setOpen(item.key, $event)"
          @remove="askRemoveCase(index)"
          @remove-message="askRemoveMessage(index, $event)"
        />
      </div>
      <fieldset v-if="!isDemo" class="add-case">
        <legend>Добавить случай</legend>
        <div class="choices">
          <button
            v-for="type in CASE_TYPES"
            :key="type"
            type="button"
            class="button-secondary choice"
            :disabled="atCaseLimit"
            @click="addCase(type)"
          >
            <span class="choice-title">{{ labels.caseType[type] }}</span>
            <span class="choice-note">{{ CASE_NOTES[type] }}</span>
          </button>
        </div>
        <p v-if="atCaseLimit" class="hint">
          В наборе может быть не больше {{ limits.maxCases }} случаев
        </p>
      </fieldset>
      <div v-if="!isDemo" class="actions">
        <button type="submit" class="button-primary" :disabled="saving">Сохранить</button>
        <button type="button" class="button-secondary" :disabled="copying" @click="makeCopy">
          Сделать копию
        </button>
        <RouterLink
          v-if="savedVisible && !dirty"
          class="button-secondary"
          :to="{ name: 'summary', query: { dataset: datasetId } }"
        >
          Сформировать сводку по этому набору
        </RouterLink>
      </div>
      <p v-if="saving" role="status">Сохраняем набор…</p>
      <p v-if="copying" role="status">Делаем копию…</p>
      <details class="developer">
        <summary>Для разработчиков</summary>
        <div class="actions">
          <button type="button" class="button-secondary" @click="download">
            Скачать набор файлом
          </button>
          <button type="button" class="button-secondary" :disabled="isDemo" @click="pickFile">
            Загрузить набор из файла
          </button>
          <input
            ref="fileInput"
            class="visually-hidden"
            tabindex="-1"
            type="file"
            accept=".json,application/json"
            :disabled="isDemo"
            @change="onFile"
          />
        </div>
        <p v-if="isDemo" class="hint">Пример из задания нельзя менять. Сделайте копию.</p>
        <p v-if="fileNotice" role="status">{{ fileNotice }}</p>
        <ul v-if="fileErrors.length" class="file-errors">
          <li v-for="(item, index) in fileErrors" :key="index">{{ item }}</li>
        </ul>
      </details>
    </form>
    <ConfirmDialog
      :open="confirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      :cancel-label="cancelLabel"
      @confirm="confirmYes"
      @cancel="confirmNo"
    />
  </main>
</template>

<style scoped>
.page,
.editor,
.field,
.cases,
.add-case,
.choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.page {
  gap: var(--space-4);
}

.page h1,
.demo-banner p,
.hint,
.field-error,
.file-errors,
.choice-title,
.choice-note {
  margin: 0;
}

.back {
  margin: 0;
}

.demo-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.field input {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.hint,
.choice-note {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.field-error,
.file-errors {
  color: var(--color-error-fg);
}

.add-case {
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.choices {
  gap: var(--space-2);
}

.choice {
  align-items: flex-start;
  flex-direction: column;
  min-height: 4.5rem;
  text-align: left;
}

.choice-title {
  font-weight: 700;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.developer {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.developer summary {
  cursor: pointer;
  font-weight: 700;
}

.developer .actions,
.developer .hint,
.developer .file-errors {
  margin-top: var(--space-3);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.file-errors {
  padding-left: 1.2rem;
}

@media (min-width: 40rem) {
  .choices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
