<script setup lang="ts">
import approachSource from '@docs/approach.md?raw'
import firstLaunchSource from '@docs/first-launch.md?raw'
import verificationSource from '@docs/verification.md?raw'
import { computed, ref } from 'vue'
import { useMetaStore } from '@/stores/meta'
import { renderDoc } from '@/utils/markdown'

const steps = [
  'Данные из CRM и сообщения из чатов',
  'ИИ находит в сообщениях факты',
  'Правила считают срочность по CRM',
  'Сводка для support-отдела',
]

const approachHtml = renderDoc(approachSource)
const firstLaunchHtml = renderDoc(firstLaunchSource)
const verificationHtml = renderDoc(verificationSource)

const metaStore = useMetaStore()
const rules = computed(() => metaStore.meta?.rules ?? [])
const prompt = computed(() => metaStore.meta?.prompt ?? '')
const copied = ref(false)
const copyError = ref('')

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
    <h1>Как это работает</h1>

    <section>
      <h2>Как устроена обработка</h2>
      <div class="flow">
        <template v-for="(step, index) in steps" :key="step">
          <p class="step">{{ step }}</p>
          <span v-if="index < steps.length - 1" class="arrow" aria-hidden="true">→</span>
        </template>
      </div>
      <div class="doc" v-html="approachHtml" />
    </section>

    <section>
      <h2 id="rules-title">Правила</h2>
      <p v-if="rules.length === 0">Правила ещё не загружены.</p>
      <table v-else class="rules" aria-labelledby="rules-title">
        <thead>
          <tr>
            <th scope="col">Код</th>
            <th scope="col">Правило</th>
            <th scope="col">Описание</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in rules" :key="rule.code">
            <th scope="row">{{ rule.code }}</th>
            <td data-label="Правило">{{ rule.title }}</td>
            <td data-label="Описание">{{ rule.description }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="prompt-section">
      <h2 id="prompt-title">Промпт для ИИ</h2>
      <pre id="prompt-text" class="prompt" aria-labelledby="prompt-title">{{ prompt }}</pre>
      <p v-if="prompt === ''" class="hint">Текст для ИИ ещё не загружен.</p>
      <button
        type="button"
        class="button-primary"
        :disabled="prompt === ''"
        aria-live="polite"
        @click="copyPrompt"
      >
        {{ copied ? 'Скопировано' : 'Скопировать' }}
      </button>
      <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
    </section>

    <section>
      <h2>Первый запуск</h2>
      <div class="doc" v-html="firstLaunchHtml" />
    </section>

    <section>
      <h2>Что проверено и что нет</h2>
      <div class="doc" v-html="verificationHtml" />
    </section>
  </main>
</template>

<style scoped>
.page,
section,
.prompt-section {
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
.step,
.hint,
.field-error,
.doc :deep(p) {
  margin: 0;
}

.flow {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
  counter-reset: step;
}

.step {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
  counter-increment: step;
}

.step::before {
  content: counter(step, decimal-leading-zero);
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.arrow {
  align-self: center;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  line-height: 1;
  transform: rotate(90deg);
}

.rules {
  width: 100%;
  border-collapse: collapse;
}

.rules th,
.rules td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.rules th {
  font-weight: 700;
}

.rules th[scope='row'] {
  color: var(--color-primary);
}

.prompt {
  margin: 0;
  padding: var(--space-4);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
  font-family: var(--font-family-mono);
}

.prompt-section .button-primary {
  align-self: flex-start;
}

.hint {
  color: var(--color-muted);
}

.field-error {
  color: var(--color-error-fg);
}

.doc :deep(p + p) {
  margin-top: var(--space-3);
}

@media (max-width: 39.99rem) {
  .rules thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .rules,
  .rules tbody,
  .rules tr,
  .rules th,
  .rules td {
    display: block;
    width: 100%;
  }

  .rules tr {
    padding: var(--space-3) 0;
  }

  .rules td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: var(--space-1);
    font-weight: 700;
  }
}

@media (min-width: 40rem) {
  .flow {
    flex-direction: row;
    align-items: stretch;
  }

  .step {
    flex: 1 1 0;
  }

  .arrow {
    align-self: center;
    transform: none;
  }
}
</style>
