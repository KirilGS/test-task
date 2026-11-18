<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  ApiError,
  clearAiSettings,
  errorMessage,
  getAiSettings,
  saveAiSettings,
} from '@/api/client'
import type { AiProviderId } from '@/api/types'
import { useMetaStore } from '@/stores/meta'

const metaStore = useMetaStore()

const provider = ref<AiProviderId>('openai')
const model = ref('')
const secret = ref('')
const savedProvider = ref<AiProviderId | null>(null)
const configured = ref(false)
const loading = ref(true)
const saving = ref(false)
const status = ref('')
const problem = ref('')
const fieldErrors = ref<Record<string, string>>({})
const confirmClear = ref(false)

const keyHint = computed(() => {
  if (!configured.value) {
    return 'Вставьте ключ, который выдала служба.'
  }
  if (savedProvider.value !== null && provider.value !== savedProvider.value) {
    return 'Для другой службы нужен её ключ.'
  }
  return 'Ключ уже сохранён. Введите новый, только если хотите заменить его.'
})

const providerError = computed(() => fieldErrors.value.provider ?? '')
const secretError = computed(() => fieldErrors.value.apiKey ?? '')
const modelError = computed(() => fieldErrors.value.model ?? '')

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  problem.value = ''
  try {
    apply(await getAiSettings())
  } catch (reason) {
    problem.value = errorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  status.value = ''
  problem.value = ''
  fieldErrors.value = {}
  const entered = secret.value
  try {
    const saved = await saveAiSettings({
      provider: provider.value,
      apiKey: entered,
      model: model.value.trim(),
    })
    secret.value = ''
    apply(saved)
    status.value = 'Ключ сохранён. Страница больше его не показывает.'
    await metaStore.refresh()
  } catch (reason) {
    if (reason instanceof ApiError) {
      fieldErrors.value = reason.fieldErrors
      problem.value = reason.message
    } else {
      problem.value = errorMessage(reason)
    }
  } finally {
    saving.value = false
  }
}

function askClear(): void {
  confirmClear.value = true
}

async function clear(): Promise<void> {
  confirmClear.value = false
  saving.value = true
  status.value = ''
  problem.value = ''
  try {
    apply(await clearAiSettings())
    secret.value = ''
    model.value = ''
    status.value = 'Ключ удалён. Сводки снова строятся без чтения переписки.'
    await metaStore.refresh()
  } catch (reason) {
    problem.value = errorMessage(reason)
  } finally {
    saving.value = false
  }
}

function apply(view: {
  configured: boolean
  provider: AiProviderId | null
  model: string | null
  problem: string | null
}): void {
  configured.value = view.configured
  savedProvider.value = view.provider
  problem.value = view.problem ?? ''
  if (view.provider !== null) {
    provider.value = view.provider
  }
  model.value = view.model ?? ''
}
</script>

<template>
  <main class="page">
    <div class="intro">
      <h1>Подключение ИИ</h1>
      <p class="lead">
        ИИ читает сообщения из чатов и находит в них факты. Без него сводка тоже строится, но
        сообщения придётся прочитать самому. Ключ и название модели выдаёт разработчик.
      </p>
    </div>
    <p v-if="loading" role="status">Загружаем…</p>
    <template v-else>
      <p class="state" :class="configured ? 'state-on' : 'state-off'">
        {{ configured ? 'Сейчас ИИ подключён' : 'Сейчас ИИ не подключён' }}
      </p>
      <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
      <p v-if="status" role="status">{{ status }}</p>
      <form class="card" @submit.prevent="save">
        <div class="field">
          <label for="ai-provider">Служба</label>
          <select id="ai-provider" v-model="provider" :disabled="saving">
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          <p v-if="providerError" class="field-error">{{ providerError }}</p>
        </div>
        <div class="field">
          <label for="ai-secret">Ключ</label>
          <input
            id="ai-secret"
            v-model="secret"
            type="password"
            autocomplete="new-password"
            :disabled="saving"
          />
          <p class="hint">{{ keyHint }}</p>
          <p v-if="secretError" class="field-error">{{ secretError }}</p>
        </div>
        <div class="field">
          <label for="ai-model">Модель</label>
          <input id="ai-model" v-model="model" type="text" autocomplete="off" :disabled="saving" />
          <p class="hint">Название модели этой службы. Его можно посмотреть у поставщика.</p>
          <p v-if="modelError" class="field-error">{{ modelError }}</p>
        </div>
        <button type="submit" class="button-primary" :disabled="saving">Сохранить</button>
      </form>
      <button
        v-if="configured"
        type="button"
        class="button-secondary"
        :disabled="saving"
        @click="askClear"
      >
        Отключить
      </button>
    </template>
    <ConfirmDialog
      :open="confirmClear"
      title="Отключить ИИ?"
      message="Ключ будет удалён. Сводки снова будут строиться без чтения переписки."
      confirm-label="Отключить"
      cancel-label="Оставить"
      @confirm="clear"
      @cancel="confirmClear = false"
    />
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.card,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.card {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.card {
  max-width: 40rem;
}

.field label {
  font-weight: 700;
  color: var(--color-heading);
}

.card .button-primary,
.page > .button-secondary {
  align-self: flex-start;
}

.intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.intro h1,
.lead,
.state,
.hint,
.field-error {
  margin: 0;
}

.lead {
  max-width: 44rem;
  color: var(--color-muted);
}

.state {
  align-self: flex-start;
  padding: 0.2rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.state-on {
  background: var(--color-success-bg);
  color: var(--color-success-fg);
}

.state-off {
  background: var(--color-card);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
}

.hint {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.field-error {
  color: var(--color-error-fg);
}
</style>
