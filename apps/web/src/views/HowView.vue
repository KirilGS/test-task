<script setup lang="ts">
import approachSource from '@docs/approach.md?raw'
import firstLaunchSource from '@docs/first-launch.md?raw'
import verificationSource from '@docs/verification.md?raw'
import type { CaseType, Priority } from '@support-summary/core'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PriorityBadge from '@/components/PriorityBadge.vue'
import { useMetaStore } from '@/stores/meta'
import { renderDoc } from '@/utils/markdown'

const PLACEHOLDER = 'Будет заполнено на этапе 10'

const steps = [
  {
    title: 'Данные из CRM и сообщения из чатов',
    text: 'Программа берёт статус каждого случая из CRM и сообщения из рабочих чатов.',
  },
  {
    title: 'ИИ находит в сообщениях факты',
    text: 'ИИ выписывает, что сказали люди, и приводит дословную цитату. Срочность он не решает.',
  },
  {
    title: 'Правила считают срочность по CRM',
    text: 'Обычные правила смотрят на сроки и статусы в CRM. Слова из чата не понижают срочность.',
  },
  {
    title: 'Сводка для support-отдела',
    text: 'Случаи выстроены от самого срочного. У каждого видно, что известно и что делать.',
  },
]

const processes: Array<{ type: CaseType; text: string }> = [
  {
    type: 'onboarding',
    text: 'Документы нового сотрудника должны быть в CRM до его первого выхода.',
  },
  {
    type: 'offboarding',
    text: 'Руководитель должен подтвердить увольнение в CRM до последнего рабочего дня.',
  },
  {
    type: 'card_delivery',
    text: 'Карты должны приехать на точку в срок, а приёмка должна быть отмечена в CRM.',
  },
]

const levels: Array<{ priority: Priority; text: string }> = [
  { priority: 'critical', text: 'Срок уже наступил или сорван. Заняться в первую очередь.' },
  { priority: 'high', text: 'Срок сегодня или завтра. Решить в течение дня.' },
  {
    priority: 'medium',
    text: 'Срок через несколько дней, есть вопрос для уточнения или сообщения, которые нужно прочитать самому.',
  },
  { priority: 'none', text: 'По CRM всё в порядке или до срока ещё далеко.' },
]

const ruleGroups: Array<{ prefix: string; type: CaseType | null }> = [
  { prefix: 'DEL', type: 'card_delivery' },
  { prefix: 'OFF', type: 'offboarding' },
  { prefix: 'ONB', type: 'onboarding' },
  { prefix: 'GEN', type: null },
]

function docHtml(source: string): string {
  return source.trim() === PLACEHOLDER ? '' : renderDoc(source)
}

const approachHtml = docHtml(approachSource)
const firstLaunchHtml = docHtml(firstLaunchSource)
const verificationHtml = docHtml(verificationSource)

const metaStore = useMetaStore()
const rules = computed(() => metaStore.meta?.rules ?? [])
const prompt = computed(() => metaStore.meta?.prompt ?? '')
const copied = ref(false)
const copyError = ref('')

const groupedRules = computed(() =>
  ruleGroups
    .map((group) => ({
      key: group.prefix,
      title: group.type === null ? 'Для всех случаев' : typeLabel(group.type),
      items: rules.value.filter((rule) => rule.code.startsWith(group.prefix)),
    }))
    .filter((group) => group.items.length > 0),
)

function typeLabel(type: CaseType): string {
  return metaStore.meta?.labels.caseType[type] ?? ''
}

async function copyPrompt(): Promise<void> {
  if (prompt.value === '') {
    return
  }
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(prompt.value)
    copied.value = true
  } catch {
    copied.value = false
    copyError.value = 'Не удалось скопировать. Выделите текст и скопируйте его сами.'
  }
}
</script>

<template>
  <main class="page">
    <div class="intro">
      <h1>Как это работает</h1>
      <p class="lead">
        Программа помогает support-отделу каждое утро понять, какие случаи требуют внимания. Она
        сверяет статусы из CRM с сообщениями из рабочих чатов и составляет список дел: что срочно,
        что проверить и что сделать.
      </p>
    </div>

    <section>
      <h2>За чем следит программа</h2>
      <ul class="processes">
        <li v-for="item in processes" :key="item.type" class="tile">
          <h3>{{ typeLabel(item.type) }}</h3>
          <p>{{ item.text }}</p>
        </li>
      </ul>
    </section>

    <section>
      <h2>Как устроена обработка</h2>
      <ol class="flow">
        <li v-for="step in steps" :key="step.title" class="step">
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </li>
      </ol>
      <p class="note">
        Если ИИ не подключён, сводка всё равно строится. Сообщения тогда показываются целиком, их
        нужно прочитать самому.
      </p>
      <div v-if="approachHtml" class="doc" v-html="approachHtml" />
    </section>

    <section>
      <h2>Как читать сводку</h2>
      <h3>Срочность</h3>
      <ul class="levels">
        <li v-for="level in levels" :key="level.priority" class="level">
          <PriorityBadge :priority="level.priority" />
          <p>{{ level.text }}</p>
        </li>
      </ul>

      <h3>Два источника сведений</h3>
      <div class="sources">
        <div class="source source-crm">
          <p class="source-title">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path
                d="M5 8.2 7.1 10.2 11 6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Подтверждено в CRM
          </p>
          <p>Сплошная зелёная рамка. Этим сведениям можно доверять.</p>
        </div>
        <div class="source source-chat">
          <p class="source-title">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2.8 3.2h10.4v7.2H6.4L2.8 13.2Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
            Известно только из переписки
            <span class="unconfirmed">не подтверждено</span>
          </p>
          <p>Пунктирная рамка. Это слова людей в чате. Проверьте их, прежде чем действовать.</p>
        </div>
      </div>
      <p class="note">
        В карточке каждого случая есть ещё «Проверить перед действием» и «Что делать дальше». Если
        разбор неверный, нажмите «Ошибка» и напишите, что не так.
      </p>
    </section>

    <section class="start">
      <h2>С чего начать</h2>
      <ol class="start-steps">
        <li>Откройте «Сводка» и выберите набор «Случаи из задания».</li>
        <li>Нажмите «Сформировать сводку».</li>
        <li>Начните со случая из блока «С чего начать» вверху сводки.</li>
      </ol>
      <p class="note">
        Свои случаи можно добавить в «Наборы случаев», а готовые сценарии проверки есть на странице
        «Проверка».
      </p>
      <RouterLink class="button-primary" to="/">Открыть сводку</RouterLink>
    </section>

    <section>
      <h2>Правила</h2>
      <p class="note">
        Так программа решает, насколько срочен случай. Те же правила видны у каждого случая в блоке
        «Почему такая срочность». В скобках — номер правила.
      </p>
      <p v-if="rules.length === 0">Правила ещё не загружены.</p>
      <div v-else class="rule-groups">
        <section v-for="group in groupedRules" :key="group.key" class="tile rule-group">
          <h3>{{ group.title }}</h3>
          <ul class="rules">
            <li v-for="rule in group.items" :key="rule.code">
              <p class="rule-title">
                {{ rule.title }} <span class="code">({{ rule.code }})</span>
              </p>
              <p>{{ rule.description }}</p>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <section>
      <h2>Для проверяющих задание</h2>
      <p class="note">Подробности для тех, кто оценивает решение. Нажмите на заголовок, чтобы открыть.</p>

      <details class="more">
        <summary>Промпт для ИИ</summary>
        <div class="more-body">
          <p class="note">Текст, по которому ИИ читает переписку.</p>
          <pre id="prompt-text" class="prompt">{{ prompt }}</pre>
          <p v-if="prompt === ''" class="note">Текст для ИИ ещё не загружен.</p>
          <button
            type="button"
            class="button-secondary"
            :disabled="prompt === ''"
            aria-live="polite"
            @click="copyPrompt"
          >
            {{ copied ? 'Скопировано' : 'Скопировать' }}
          </button>
          <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
        </div>
      </details>

      <details class="more">
        <summary>Первый запуск</summary>
        <div class="more-body">
          <div v-if="firstLaunchHtml" class="doc" v-html="firstLaunchHtml" />
          <p v-else class="note">Этот раздел ещё готовится.</p>
        </div>
      </details>

      <details class="more">
        <summary>Что проверено и что нет</summary>
        <div class="more-body">
          <div v-if="verificationHtml" class="doc" v-html="verificationHtml" />
          <p v-else class="note">Этот раздел ещё готовится.</p>
        </div>
      </details>
    </section>
  </main>
</template>

<style scoped>
.page,
section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.page {
  gap: var(--space-6);
}

.intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.intro h1,
section h2,
section h3,
.lead,
.note,
.field-error,
.tile p,
.step p,
.level p,
.source p,
.rules p,
.doc :deep(p) {
  margin: 0;
}

.lead {
  max-width: 46rem;
  color: var(--color-muted);
  font-size: var(--font-size-lg);
}

section h3 {
  font-size: var(--font-size);
}

.note {
  max-width: 46rem;
  color: var(--color-muted);
}

.processes,
.levels,
.rules,
.flow,
.rule-groups {
  margin: 0;
  padding: 0;
  list-style: none;
}

.processes,
.rule-groups {
  display: grid;
  gap: var(--space-3);
}

.tile,
.step {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.tile h3 {
  color: var(--color-primary);
}

.flow {
  display: grid;
  gap: var(--space-3);
  counter-reset: step;
}

.step {
  counter-increment: step;
}

.step::before {
  content: counter(step, decimal-leading-zero);
  color: var(--color-primary);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.levels {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.level {
  display: grid;
  gap: var(--space-1) var(--space-3);
  align-items: center;
}

.level :deep(.badge) {
  justify-self: start;
  white-space: nowrap;
}

.sources {
  display: grid;
  gap: var(--space-3);
}

.source {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
}

.source-crm {
  border: 2px solid var(--color-success-fg);
  background: var(--color-success-bg);
}

.source-chat {
  border: 2px dashed var(--color-primary);
  background: var(--color-surface);
}

.source-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-heading);
  font-weight: 700;
}

.icon {
  width: 1rem;
  height: 1rem;
  flex: none;
}

.unconfirmed {
  padding: 0 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  font-weight: 400;
}

.start {
  align-items: flex-start;
  padding: var(--space-5);
  border: 1px solid var(--color-note-border);
  border-radius: var(--radius-card);
  background: var(--color-note-bg);
}

.start-steps {
  margin: 0;
  padding-left: 1.25rem;
}

.start-steps li + li {
  margin-top: var(--space-1);
}

.rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.rule-title {
  color: var(--color-heading);
  font-weight: 700;
}

.code {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  font-weight: 400;
}

.more {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.more summary {
  padding: var(--space-3) var(--space-4);
  color: var(--color-heading);
  font-weight: 700;
  cursor: pointer;
}

.more-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
  min-width: 0;
}

.more-body .doc {
  align-self: stretch;
}

.prompt {
  align-self: stretch;
  margin: 0;
  padding: var(--space-4);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
}

.field-error {
  color: var(--color-error-fg);
}

.doc :deep(p + p) {
  margin-top: var(--space-3);
}

@media (min-width: 40rem) {
  .level {
    grid-template-columns: 15rem minmax(0, 1fr);
  }

  .sources {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 56rem) {
  .processes {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .flow {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .rule-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
