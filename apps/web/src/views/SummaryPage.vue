<script setup lang="ts">
import type { CaseType } from '@support-summary/core'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppNotice from '@/components/AppNotice.vue'
import CaseCard from '@/components/CaseCard.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import { useDatasetsStore } from '@/stores/datasets'
import { useMetaStore } from '@/stores/meta'
import { useSummaryStore } from '@/stores/summary'
import { formatFileDate, formatMsk, fromInputValue, toInputValue } from '@/utils/datetime'

const route = useRoute()
const router = useRouter()
const metaStore = useMetaStore()
const datasetsStore = useDatasetsStore()
const summaryStore = useSummaryStore()

const datasetId = ref('')
const momentValue = ref('')
const useAi = ref(false)
const calculating = ref(false)
const showBuilt = ref(false)
const copied = ref(false)
const copyError = ref('')
const momentError = ref('')
const missedOpen = ref(false)
const missedCaseId = ref('')
const missedComment = ref('')
const missedError = ref('')
let buildTicket = 0

const summaryId = computed(() => {
  const value = route.params.id
  return typeof value === 'string' ? value : ''
})

const requestedDatasetId = computed(() => {
  const value = route.query.dataset
  return typeof value === 'string' ? value : ''
})

const aiReady = computed(() => metaStore.meta?.aiAvailable === true)

const visibleSummary = computed(() => {
  const current = summaryStore.current
  if (current === null) {
    return null
  }
  if (summaryId.value !== '') {
    return current.id === summaryId.value ? current : null
  }
  return showBuilt.value ? current : null
})

const opening = computed(
  () =>
    summaryStore.loading &&
    !calculating.value &&
    summaryId.value !== '' &&
    visibleSummary.value === null,
)

const actionable = computed(
  () => visibleSummary.value?.assessments.filter((item) => item.needsAction) ?? [],
)

const quiet = computed(
  () => visibleSummary.value?.assessments.filter((item) => !item.needsAction) ?? [],
)

const first = computed(() => actionable.value[0] ?? null)

const previous = computed(() => {
  const currentId = visibleSummary.value?.id ?? ''
  return summaryStore.history.filter((item) => item.id !== currentId).slice(0, 5)
})

const momentFieldError = computed(
  () => momentError.value || summaryStore.fieldErrors.snapshotAt || '',
)

const datasetFieldError = computed(() => summaryStore.fieldErrors.datasetId ?? '')

const missedSaved = computed(
  () => visibleSummary.value?.feedback.some((item) => item.verdict === 'missed') ?? false,
)

const historyEmptyText = computed(() =>
  visibleSummary.value
    ? 'По этому набору ещё не было других сводок.'
    : 'По этому набору ещё не было сводок.',
)

function typeLabel(type: CaseType): string {
  return metaStore.meta?.labels.caseType[type] ?? ''
}

function reviewSaved(caseId: string): boolean {
  return (
    visibleSummary.value?.feedback.some(
      (item) => item.caseId === caseId && (item.verdict === 'correct' || item.verdict === 'wrong'),
    ) ?? false
  )
}

function claimsFor(caseId: string) {
  return visibleSummary.value?.claimsByCase[caseId] ?? []
}

function rejectedFor(caseId: string): number {
  return visibleSummary.value?.rejectedByCase[caseId] ?? 0
}

function modeLabel(mode: 'ai' | 'no-ai'): string {
  return mode === 'ai' ? 'с ИИ' : 'без ИИ'
}

function chooseInitial(): void {
  if (datasetId.value !== '' || summaryId.value !== '') {
    return
  }
  const fromQuery = datasetsStore.items.find((item) => item.id === requestedDatasetId.value)
  const demo = datasetsStore.items.find((item) => item.title === 'Случаи из задания')
  const chosen = fromQuery ?? demo ?? datasetsStore.items[0]
  if (chosen === undefined) {
    return
  }
  datasetId.value = chosen.id
  momentValue.value = toInputValue(chosen.snapshotAt)
}

function onDatasetChange(): void {
  const item = datasetsStore.items.find((entry) => entry.id === datasetId.value)
  if (item) {
    momentValue.value = toInputValue(item.snapshotAt)
  }
  momentError.value = ''
}

function syncSavedForm(): void {
  const summary = summaryStore.current
  if (summary === null || summary.id !== summaryId.value) {
    return
  }
  datasetId.value = summary.datasetId
  momentValue.value = toInputValue(summary.snapshotAt)
}

function openSaved(): void {
  const id = summaryId.value
  if (id === '' || summaryStore.current?.id === id) {
    return
  }
  void summaryStore.open(id)
}

async function build(): Promise<void> {
  momentError.value = ''
  copyError.value = ''
  copied.value = false
  const snapshotAt = fromInputValue(momentValue.value)
  if (snapshotAt === null) {
    momentError.value = 'Укажите момент сводки'
    return
  }
  if (datasetId.value === '') {
    return
  }
  const ticket = ++buildTicket
  calculating.value = true
  const input = { datasetId: datasetId.value, snapshotAt }
  const result =
    useAi.value && aiReady.value
      ? await summaryStore.createWithAi(input)
      : await summaryStore.createPlain(input)
  if (ticket !== buildTicket || result.status === 'stale') {
    return
  }
  if (result.status !== 'ready') {
    calculating.value = false
    return
  }
  showBuilt.value = true
  calculating.value = false
  await router.replace({ name: 'summary-saved', params: { id: result.summary.id } })
  await summaryStore.loadHistory(result.summary.datasetId)
}

async function copySummary(): Promise<void> {
  const text = visibleSummary.value?.markdown
  if (text === undefined) {
    return
  }
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
  } catch {
    copied.value = false
    copyError.value = 'Не удалось скопировать. Выделите текст сводки и скопируйте его сами.'
  }
}

function downloadSummary(): void {
  const summary = visibleSummary.value
  if (summary === null) {
    return
  }
  const stamp = formatFileDate(summary.snapshotAt)
  const name = stamp === '' ? 'svodka.md' : `svodka-${stamp}.md`
  const blob = new Blob([summary.markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

async function sendCorrect(caseId: string): Promise<void> {
  const summary = visibleSummary.value
  if (summary === null || summaryStore.savingFeedback || reviewSaved(caseId)) {
    return
  }
  await summaryStore.sendFeedback(summary.id, { caseId, verdict: 'correct' })
}

async function sendWrong(caseId: string, comment: string): Promise<void> {
  const summary = visibleSummary.value
  if (summary === null || summaryStore.savingFeedback || reviewSaved(caseId)) {
    return
  }
  await summaryStore.sendFeedback(summary.id, { caseId, verdict: 'wrong', comment })
}

async function sendMissed(): Promise<void> {
  const summary = visibleSummary.value
  if (summary === null || summaryStore.savingFeedback || missedSaved.value) {
    return
  }
  const comment = missedComment.value.trim()
  if (comment === '') {
    missedError.value = 'Опишите, что пропущено'
    return
  }
  missedError.value = ''
  const caseId = missedCaseId.value.trim() === '' ? null : missedCaseId.value.trim()
  const result = await summaryStore.sendFeedback(summary.id, {
    caseId,
    verdict: 'missed',
    comment,
  })
  if (result.status === 'error') {
    missedError.value = summaryStore.fieldErrors.comment ?? summaryStore.error ?? ''
  }
}

watch(() => datasetsStore.items, chooseInitial)
watch(datasetId, (id) => {
  if (id !== '') {
    void summaryStore.loadHistory(id)
  }
})
watch(summaryId, () => {
  if (route.name === 'summary') {
    showBuilt.value = false
  }
  openSaved()
})
watch(() => summaryStore.current?.id ?? '', syncSavedForm)

onMounted(() => {
  void datasetsStore.loadList()
  openSaved()
  syncSavedForm()
})
</script>

<template>
  <main class="page">
    <h1>Сводка</h1>

    <form class="settings" @submit.prevent="build">
      <div class="pair">
        <div class="field">
          <label for="dataset">Набор случаев</label>
          <select id="dataset" v-model="datasetId" @change="onDatasetChange">
            <option value="" disabled>Выберите набор</option>
            <option v-for="item in datasetsStore.items" :key="item.id" :value="item.id">
              {{ item.title }}
            </option>
          </select>
          <p v-if="datasetsStore.listLoading" role="status">Загружаем наборы…</p>
          <p v-if="datasetFieldError" class="field-error">{{ datasetFieldError }}</p>
        </div>
        <div class="field">
          <label for="moment">Момент сводки (МСК)</label>
          <input id="moment" v-model="momentValue" type="datetime-local" />
          <p class="hint">Сводка считает сроки относительно этого момента</p>
          <p v-if="momentFieldError" class="field-error">{{ momentFieldError }}</p>
        </div>
      </div>

      <div class="field">
        <label class="check" for="use-ai">
          <input id="use-ai" v-model="useAi" type="checkbox" :disabled="!aiReady" />
          Читать переписку с помощью ИИ
        </label>
        <p v-if="!aiReady" class="hint">
          ИИ не подключён: сообщения будут показаны для ручного чтения
        </p>
      </div>

      <button
        type="submit"
        class="button-primary"
        :disabled="calculating || summaryStore.loading || datasetId === ''"
      >
        Сформировать сводку
      </button>
    </form>

    <p v-if="calculating" role="status">
      Проверяем сроки и читаем переписку… С ИИ это может занять до минуты.
    </p>
    <p v-else-if="opening" role="status">Открываем сводку…</p>
    <AppNotice
      v-if="summaryStore.error && !calculating"
      kind="error"
      :message="summaryStore.error"
    />
    <AppNotice v-if="datasetsStore.error" kind="error" :message="datasetsStore.error" />

    <p v-if="visibleSummary === null && !calculating && !opening && !summaryStore.error" class="empty">
      Выберите набор случаев и нажмите «Сформировать сводку».
    </p>

    <template v-if="visibleSummary">
      <section class="start">
        <h2>С чего начать</h2>
        <template v-if="first">
          <p class="start-id">{{ first.caseId }}</p>
          <p>{{ typeLabel(first.caseType) }}</p>
          <PriorityBadge :priority="first.priority" />
          <p v-if="first.nextSteps[0]" class="start-step">{{ first.nextSteps[0] }}</p>
        </template>
        <p v-else>Срочных случаев нет.</p>
      </section>

      <p class="stats">
        Требуют действий: {{ actionable.length }} · Без действий: {{ quiet.length }} · Режим:
        {{ modeLabel(visibleSummary.mode) }} · Момент: {{ formatMsk(visibleSummary.snapshotAt) }}
      </p>

      <div v-if="visibleSummary.warnings.length" class="warnings" role="status">
        <p v-for="(warning, index) in visibleSummary.warnings" :key="`${warning}-${index}`">
          {{ warning }}
        </p>
      </div>

      <p v-if="summaryStore.savingFeedback" role="status">Сохраняем отзыв…</p>
      <div class="cards">
        <CaseCard
          v-for="item in actionable"
          :key="item.caseId"
          :assessment="item"
          :claims="claimsFor(item.caseId)"
          :rejected="rejectedFor(item.caseId)"
          :rules="metaStore.meta?.rules ?? []"
          :saved="reviewSaved(item.caseId)"
          :saving="summaryStore.savingFeedback"
          @correct="sendCorrect(item.caseId)"
          @wrong="sendWrong(item.caseId, $event)"
        />
      </div>

      <section v-if="quiet.length">
        <h2>Не требуют действий</h2>
        <ul class="quiet">
          <li v-for="item in quiet" :key="item.caseId">
            {{ item.caseId }} · {{ typeLabel(item.caseType) }} —
            {{ item.crmFacts[0] ?? 'Дополнительных сведений нет.' }}
          </li>
        </ul>
      </section>

      <section class="missed">
        <h2>Что-то пропущено?</h2>
        <p v-if="missedSaved" role="status">Спасибо, отзыв сохранён</p>
        <template v-else>
          <button type="button" class="button-secondary" @click="missedOpen = true">
            Что-то пропущено?
          </button>
          <form v-if="missedOpen" class="missed-form" @submit.prevent="sendMissed">
            <div class="field">
              <label for="missed-case">Номер случая (необязательно)</label>
              <input id="missed-case" v-model="missedCaseId" type="text" />
            </div>
            <div class="field">
              <label for="missed-comment">Что пропущено</label>
              <textarea id="missed-comment" v-model="missedComment" rows="3" required />
              <p v-if="missedError" class="field-error">{{ missedError }}</p>
            </div>
            <button type="submit" class="button-secondary" :disabled="summaryStore.savingFeedback">
              Отправить
            </button>
          </form>
        </template>
      </section>

      <div class="export">
        <button type="button" class="button-secondary" @click="copySummary">
          {{ copied ? 'Скопировано' : 'Скопировать текст сводки' }}
        </button>
        <button type="button" class="button-secondary" @click="downloadSummary">Скачать файл</button>
      </div>
      <AppNotice v-if="copyError" kind="error" :message="copyError" />
    </template>

    <section v-if="datasetId" class="history">
      <h2>Предыдущие сводки по этому набору</h2>
      <p v-if="summaryStore.historyLoading" role="status">Загружаем предыдущие сводки…</p>
      <AppNotice v-if="summaryStore.historyError" kind="error" :message="summaryStore.historyError" />
      <ul v-if="previous.length">
        <li v-for="item in previous" :key="item.id">
          <RouterLink :to="{ name: 'summary-saved', params: { id: item.id } }">
            {{ formatMsk(item.createdAt) }} · {{ modeLabel(item.mode) }} · верно
            {{ item.feedback.correct }}, ошибки {{ item.feedback.wrong }}, пропущено
            {{ item.feedback.missed }}
          </RouterLink>
        </li>
      </ul>
      <p v-else-if="!summaryStore.historyLoading && !summaryStore.historyError">
        {{ historyEmptyText }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.settings,
.start,
.warnings,
.missed,
.history {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.settings,
.pair,
.field,
.missed-form,
.cards,
.export {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pair {
  display: grid;
  gap: var(--space-4);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.field input[type='checkbox'] {
  width: 1.25rem;
  min-height: 1.25rem;
  padding: 0;
}

.settings .button-primary {
  align-self: flex-start;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hint,
.field-error,
.empty,
.stats,
.start-step {
  margin: 0;
}

.hint {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.field-error {
  color: var(--color-error-fg);
}

.start-id {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.warnings {
  background: var(--color-warning-bg);
  color: var(--color-warning-fg);
  border-color: var(--color-warning-border);
}

.warnings p,
.quiet,
.history ul {
  margin: 0;
}

.export,
.head-actions {
  flex-direction: row;
  flex-wrap: wrap;
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-lg);
}

ul {
  padding-left: 1.25rem;
}

@media (min-width: 40rem) {
  .pair {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
