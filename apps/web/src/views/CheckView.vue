<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { errorMessage, listSummaries } from '@/api/client'
import type { SummaryListItem } from '@/api/types'
import { scenarios } from '@/data/scenarios'
import { useMetaStore } from '@/stores/meta'
import { formatMsk } from '@/utils/datetime'

const STORAGE_KEY = 'support-summary.checked-scenarios'

const metaStore = useMetaStore()
const checkedIds = ref<string[]>(readChecked())
const resetStatus = ref('')
const reviews = ref<SummaryListItem[]>([])
const reviewsStatus = ref('Загружаем отзывы.')
const reviewsError = ref('')
let reviewsToken = 0

const aiReady = computed(() => metaStore.meta?.aiAvailable === true)
const checkedCount = computed(
  () => scenarios.filter((scenario) => checkedIds.value.includes(scenario.id)).length,
)
const correctMarks = computed(() =>
  reviews.value.reduce((sum, item) => sum + item.feedback.correct, 0),
)
const totalMarks = computed(() =>
  reviews.value.reduce(
    (sum, item) => sum + item.feedback.correct + item.feedback.wrong + item.feedback.missed,
    0,
  ),
)

const notes = computed(() => {
  const result: Array<{ key: string; summaryId: string; comment: string }> = []
  for (const item of reviews.value) {
    item.remarks.forEach((remark, index) => {
      const comment = remark.comment.trim()
      if (comment === '') {
        return
      }
      result.push({ key: `${item.id}-${index}`, summaryId: item.id, comment })
    })
  }
  return result
})

onMounted(() => {
  void loadReviews()
})

function knownId(value: string): boolean {
  return scenarios.some((scenario) => scenario.id === value)
}

function readChecked(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string' && knownId(item))
  } catch {
    return []
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds.value))
}

function onToggle(id: string, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  const next = new Set(checkedIds.value)
  if (target.checked) {
    next.add(id)
  } else {
    next.delete(id)
  }
  checkedIds.value = scenarios.map((scenario) => scenario.id).filter((item) => next.has(item))
  persist()
  resetStatus.value = ''
}

function resetMarks(): void {
  checkedIds.value = []
  localStorage.removeItem(STORAGE_KEY)
  resetStatus.value = 'Отметки сброшены.'
}

async function loadReviews(): Promise<void> {
  const token = ++reviewsToken
  reviewsStatus.value = 'Загружаем отзывы.'
  reviewsError.value = ''
  try {
    const items = await listSummaries(undefined, 20)
    if (token !== reviewsToken) {
      return
    }
    reviews.value = items
    reviewsStatus.value = ''
  } catch (reason) {
    if (token !== reviewsToken) {
      return
    }
    reviews.value = []
    reviewsStatus.value = ''
    reviewsError.value = errorMessage(reason)
  }
}

function modeText(mode: SummaryListItem['mode']): string {
  return mode === 'ai' ? 'с ИИ' : 'без ИИ'
}

function scoreText(item: SummaryListItem): string {
  return `${item.feedback.correct} / ${item.feedback.wrong} / ${item.feedback.missed}`
}
</script>

<template>
  <main class="page">
    <div class="intro">
      <h1>Проверка</h1>
      <p class="lead">
        Пройдите сценарии по порядку. Каждый начинается на странице «Сводка». Отметьте сценарий,
        когда результат совпал с ожиданием.
      </p>
      <RouterLink class="button-primary" to="/">Перейти к сводке</RouterLink>
    </div>

    <section>
      <h2>Сценарии проверки</h2>
      <div class="toolbar">
        <div class="progress-wrap">
          <label for="check-progress">Проверено {{ checkedCount }} из {{ scenarios.length }}</label>
          <progress id="check-progress" :value="checkedCount" :max="scenarios.length" />
        </div>
        <button type="button" class="button-secondary" @click="resetMarks">Сбросить отметки</button>
      </div>
      <p v-if="resetStatus" class="status" role="status">{{ resetStatus }}</p>
      <div class="scenarios">
        <article
          v-for="(scenario, index) in scenarios"
          :key="scenario.id"
          class="scenario"
          :class="{ done: checkedIds.includes(scenario.id) }"
        >
          <div class="scenario-head">
            <span class="number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ scenario.title }}</h3>
          </div>
          <p v-if="scenario.needsAi && !aiReady" class="needs-ai">Нужен ИИ</p>
          <ol>
            <li v-for="step in scenario.steps" :key="step">{{ step }}</li>
          </ol>
          <h4>Что должно получиться</h4>
          <ul>
            <li v-for="item in scenario.expected" :key="item">{{ item }}</li>
          </ul>
          <label class="check">
            <input
              type="checkbox"
              :checked="checkedIds.includes(scenario.id)"
              @change="onToggle(scenario.id, $event)"
            />
            Проверено
          </label>
        </article>
      </div>
    </section>

    <section>
      <h2 id="reviews-title">Отзывы</h2>
      <p v-if="reviewsStatus" class="status" role="status">{{ reviewsStatus }}</p>
      <template v-if="reviewsError">
        <p class="field-error" role="alert">{{ reviewsError }}</p>
        <button type="button" class="button-secondary" @click="loadReviews">Повторить</button>
      </template>
      <template v-else-if="reviewsStatus === '' && reviews.length === 0">
        <p>Отзывов пока нет. Сформируйте сводку и отметьте, верно ли разобран случай.</p>
        <RouterLink class="button-secondary" to="/">Перейти к сводке</RouterLink>
      </template>
      <template v-else-if="reviews.length > 0">
        <table class="reviews" aria-labelledby="reviews-title">
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Набор</th>
              <th scope="col">Режим</th>
              <th scope="col">Верно / Ошибка / Пропущено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in reviews" :key="item.id">
              <td data-label="Дата">{{ formatMsk(item.createdAt) }}</td>
              <td data-label="Набор">{{ item.datasetTitle }}</td>
              <td data-label="Режим">{{ modeText(item.mode) }}</td>
              <td data-label="Верно / Ошибка / Пропущено">{{ scoreText(item) }}</td>
            </tr>
          </tbody>
        </table>
        <p>Верно: {{ correctMarks }} из {{ totalMarks }} отметок</p>
        <h3>Комментарии</h3>
        <p v-if="notes.length === 0">Комментариев к ошибкам и пропускам нет.</p>
        <ul v-else class="notes">
          <li v-for="note in notes" :key="note.key">
            <p>{{ note.comment }}</p>
            <RouterLink :to="{ name: 'summary-saved', params: { id: note.summaryId } }">
              Открыть сводку
            </RouterLink>
          </li>
        </ul>
      </template>
    </section>
  </main>
</template>

<style scoped>
.page,
section,
.toolbar,
.scenario,
.notes li {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.page {
  gap: var(--space-5);
}

.page h1,
section h2,
.scenario h3,
.scenario h4,
.toolbar p,
.status,
.field-error,
.scenario p,
.notes p {
  margin: 0;
}

.intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.intro h1,
.lead {
  margin: 0;
}

.lead {
  max-width: 44rem;
  color: var(--color-muted);
}

.toolbar {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1 1 16rem;
  max-width: 28rem;
}

.progress-wrap label {
  font-weight: 700;
  color: var(--color-heading);
}

progress {
  width: 100%;
  height: 0.6rem;
  accent-color: var(--color-primary);
}

.scenarios {
  display: grid;
  gap: var(--space-3);
}

.scenario-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.number {
  color: var(--color-primary);
  font-weight: 700;
}

.scenario ol,
.scenario ul {
  margin: 0;
  padding-left: 1.25rem;
}

.scenario .check {
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  font-weight: 700;
}

.scenario.done {
  border-color: var(--color-success-fg);
  background: var(--color-success-bg);
}

.scenario,
.reviews {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

@media (min-width: 56rem) {
  .scenarios {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.reviews {
  width: 100%;
  border-collapse: collapse;
}

.reviews th,
.reviews td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.needs-ai {
  align-self: flex-start;
  margin: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-warning-bg);
  color: var(--color-warning-fg);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
}

.check input {
  width: 1.25rem;
  height: 1.25rem;
}

.field-error {
  color: var(--color-error-fg);
}

.page .button-primary,
.page .button-secondary {
  align-self: flex-start;
}

@media (max-width: 39.99rem) {
  .reviews thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .reviews,
  .reviews tbody,
  .reviews tr,
  .reviews th,
  .reviews td {
    display: block;
    width: 100%;
  }

  .reviews tr {
    padding: var(--space-3) 0;
  }

  .reviews td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: var(--space-1);
    font-weight: 700;
  }
}
</style>
