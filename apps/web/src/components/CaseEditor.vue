<script setup lang="ts">
import type { Author } from '@support-summary/core'
import { computed, ref, useId } from 'vue'
import type { CaseDraft } from '@/utils/datasetForm'
import { caseHeading } from '@/utils/datasetForm'
import { parseChat, type ParsedChatLine } from '@/utils/parseChat'

const draft = defineModel<CaseDraft>({ required: true })

const props = defineProps<{
  index: number
  open: boolean
  readonly: boolean
  caseTypeLabel: string
  authors: readonly { value: Author; label: string }[]
  errors: Record<string, string>
  maxMessages: number
  maxMessageLength: number
  canRemove: boolean
}>()

const emit = defineEmits<{
  toggle: [open: boolean]
  remove: []
  removeMessage: [index: number]
}>()

const baseId = useId()
const pasteOpen = ref(false)
const pasteText = ref('')
const pasteStatus = ref('')

const heading = computed(() => caseHeading(draft.value, props.caseTypeLabel))
const parsed = computed(() => parseChat(pasteText.value, props.maxMessageLength))
const parsedMessages = computed(() => parsed.value.filter(isMessage))
const parsedErrors = computed(() => parsed.value.filter(isParseError))

function isMessage(line: ParsedChatLine): line is Extract<ParsedChatLine, { ok: true }> {
  return line.ok
}

function isParseError(line: ParsedChatLine): line is Extract<ParsedChatLine, { ok: false }> {
  return !line.ok
}
const atMessageLimit = computed(() => draft.value.messages.length >= props.maxMessages)
const room = computed(() => Math.max(0, props.maxMessages - draft.value.messages.length))
const pasteFits = computed(() => parsedMessages.value.length <= room.value)
const canAddPasted = computed(
  () =>
    !props.readonly &&
    parsedMessages.value.length > 0 &&
    parsedErrors.value.length === 0 &&
    pasteFits.value,
)
const documentsStatus = computed(() =>
  draft.value.type === 'onboarding' ? draft.value.documentsStatus : 'pending',
)
const firstShiftDate = computed(() =>
  draft.value.type === 'onboarding' ? draft.value.firstShiftDate : '',
)
const lastWorkDate = computed(() =>
  draft.value.type === 'offboarding' ? draft.value.lastWorkDate : '',
)
const managerValue = computed(() => {
  if (draft.value.type !== 'offboarding') {
    return 'no'
  }
  return draft.value.managerConfirmed ? 'yes' : 'no'
})
const deliveryStatus = computed(() =>
  draft.value.type === 'card_delivery' ? draft.value.status : 'in_transit',
)
const plannedBy = computed(() => (draft.value.type === 'card_delivery' ? draft.value.plannedBy : ''))
const acceptedAt = computed(() =>
  draft.value.type === 'card_delivery' ? draft.value.acceptedAt : '',
)

function idFor(name: string): string {
  return `${baseId}-${name}`
}

function path(suffix: string): string {
  return `cases.${props.index}.${suffix}`
}

function error(suffix: string): string {
  return props.errors[path(suffix)] ?? ''
}

function messageError(messageIndex: number): string {
  const text = error(`messages.${messageIndex}.text`)
  if (text !== '') {
    return text
  }
  return error(`messages.${messageIndex}.author`)
}

function eventValue(event: Event): string {
  const target = event.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target.value
  }
  return ''
}

function isAuthor(value: string): value is Author {
  return (
    value === 'employee' ||
    value === 'manager' ||
    value === 'courier' ||
    value === 'recipient' ||
    value === 'other'
  )
}

function onToggle(event: Event): void {
  const details = event.currentTarget
  if (!(details instanceof HTMLDetailsElement)) {
    return
  }
  if (details.open !== props.open) {
    emit('toggle', details.open)
  }
}

function setId(event: Event): void {
  draft.value = { ...draft.value, id: eventValue(event) }
}

function setNote(event: Event): void {
  draft.value = { ...draft.value, note: eventValue(event) }
}

function setFirstShift(event: Event): void {
  if (draft.value.type !== 'onboarding') {
    return
  }
  draft.value = { ...draft.value, firstShiftDate: eventValue(event) }
}

function setDocuments(event: Event): void {
  if (draft.value.type !== 'onboarding') {
    return
  }
  const value = eventValue(event)
  if (value !== 'pending' && value !== 'received') {
    return
  }
  draft.value = { ...draft.value, documentsStatus: value }
}

function setLastWork(event: Event): void {
  if (draft.value.type !== 'offboarding') {
    return
  }
  draft.value = { ...draft.value, lastWorkDate: eventValue(event) }
}

function setManager(event: Event): void {
  if (draft.value.type !== 'offboarding') {
    return
  }
  const value = eventValue(event)
  if (value !== 'yes' && value !== 'no') {
    return
  }
  draft.value = { ...draft.value, managerConfirmed: value === 'yes' }
}

function setStatus(event: Event): void {
  if (draft.value.type !== 'card_delivery') {
    return
  }
  const value = eventValue(event)
  if (value !== 'in_transit' && value !== 'accepted') {
    return
  }
  draft.value = { ...draft.value, status: value }
}

function setPlanned(event: Event): void {
  if (draft.value.type !== 'card_delivery') {
    return
  }
  draft.value = { ...draft.value, plannedBy: eventValue(event) }
}

function setAccepted(event: Event): void {
  if (draft.value.type !== 'card_delivery') {
    return
  }
  draft.value = { ...draft.value, acceptedAt: eventValue(event) }
}

function setMessageText(messageIndex: number, event: Event): void {
  const text = eventValue(event)
  draft.value = {
    ...draft.value,
    messages: draft.value.messages.map((message, position) =>
      position === messageIndex ? { ...message, text } : message,
    ),
  }
}

function setAuthor(messageIndex: number, event: Event): void {
  const value = eventValue(event)
  if (!isAuthor(value)) {
    return
  }
  draft.value = {
    ...draft.value,
    messages: draft.value.messages.map((message, position) =>
      position === messageIndex ? { ...message, author: value } : message,
    ),
  }
}

function addMessage(): void {
  if (props.readonly || atMessageLimit.value) {
    return
  }
  const author = props.authors[0]?.value ?? 'employee'
  draft.value = {
    ...draft.value,
    messages: [...draft.value.messages, { author, text: '' }],
  }
}

function authorLabel(author: Author): string {
  const found = props.authors.find((item) => item.value === author)
  return found?.label ?? ''
}

function addPasted(): void {
  if (!canAddPasted.value) {
    return
  }
  const messages = parsedMessages.value.map((line) => ({ author: line.author, text: line.text }))
  draft.value = { ...draft.value, messages: [...draft.value.messages, ...messages] }
  pasteText.value = ''
  pasteStatus.value = 'Сообщения добавлены в случай'
}

function onPasteInput(): void {
  pasteStatus.value = ''
}
</script>

<template>
  <details class="case-block" :open="open" @toggle="onToggle">
    <summary>{{ heading }}</summary>
    <div class="case-body">
      <div class="field" :data-field="path('id')">
        <label :for="idFor('id')">Номер случая</label>
        <input
          :id="idFor('id')"
          :value="draft.id"
          :disabled="readonly"
          maxlength="20"
          :aria-invalid="error('id') !== ''"
          :aria-describedby="error('id') ? idFor('id-error') : idFor('id-hint')"
          @input="setId"
        />
        <p :id="idFor('id-hint')" class="hint">Например, П-10 или С-25</p>
        <p v-if="error('id')" :id="idFor('id-error')" class="field-error">{{ error('id') }}</p>
      </div>

      <template v-if="draft.type === 'onboarding'">
        <div class="field" :data-field="path('crm.firstShiftDate')">
          <label :for="idFor('shift')">Дата первого выхода</label>
          <input
            :id="idFor('shift')"
            type="date"
            :value="firstShiftDate"
            :disabled="readonly"
            :aria-invalid="error('crm.firstShiftDate') !== ''"
            @input="setFirstShift"
          />
          <p v-if="error('crm.firstShiftDate')" class="field-error">
            {{ error('crm.firstShiftDate') }}
          </p>
        </div>
        <div class="field" :data-field="path('crm.documentsStatus')">
          <label :for="idFor('documents')">Документы</label>
          <select
            :id="idFor('documents')"
            :value="documentsStatus"
            :disabled="readonly"
            :aria-invalid="error('crm.documentsStatus') !== ''"
            @change="setDocuments"
          >
            <option value="pending">Ожидаются</option>
            <option value="received">Получены</option>
          </select>
          <p v-if="error('crm.documentsStatus')" class="field-error">
            {{ error('crm.documentsStatus') }}
          </p>
        </div>
      </template>

      <template v-if="draft.type === 'offboarding'">
        <div class="field" :data-field="path('crm.lastWorkDate')">
          <label :for="idFor('last')">Последний рабочий день</label>
          <input
            :id="idFor('last')"
            type="date"
            :value="lastWorkDate"
            :disabled="readonly"
            :aria-invalid="error('crm.lastWorkDate') !== ''"
            @input="setLastWork"
          />
          <p v-if="error('crm.lastWorkDate')" class="field-error">{{ error('crm.lastWorkDate') }}</p>
        </div>
        <div class="field" :data-field="path('crm.managerConfirmed')">
          <label :for="idFor('manager')">Подтверждение руководителя в CRM</label>
          <select
            :id="idFor('manager')"
            :value="managerValue"
            :disabled="readonly"
            :aria-invalid="error('crm.managerConfirmed') !== ''"
            @change="setManager"
          >
            <option value="yes">Есть</option>
            <option value="no">Нет</option>
          </select>
          <p v-if="error('crm.managerConfirmed')" class="field-error">
            {{ error('crm.managerConfirmed') }}
          </p>
        </div>
      </template>

      <template v-if="draft.type === 'card_delivery'">
        <div class="field" :data-field="path('crm.status')">
          <label :for="idFor('status')">Статус</label>
          <select
            :id="idFor('status')"
            :value="deliveryStatus"
            :disabled="readonly"
            :aria-invalid="error('crm.status') !== ''"
            @change="setStatus"
          >
            <option value="in_transit">В пути</option>
            <option value="accepted">Принято</option>
          </select>
          <p v-if="error('crm.status')" class="field-error">{{ error('crm.status') }}</p>
        </div>
        <div class="field" :data-field="path('crm.plannedBy')">
          <label :for="idFor('planned')">Срок доставки (МСК)</label>
          <input
            :id="idFor('planned')"
            type="datetime-local"
            :value="plannedBy"
            :disabled="readonly"
            :aria-invalid="error('crm.plannedBy') !== ''"
            @input="setPlanned"
          />
          <p class="hint">Необязательно</p>
          <p v-if="error('crm.plannedBy')" class="field-error">{{ error('crm.plannedBy') }}</p>
        </div>
        <div v-if="deliveryStatus === 'accepted'" class="field" :data-field="path('crm.acceptedAt')">
          <label :for="idFor('accepted')">Время приёмки (МСК)</label>
          <input
            :id="idFor('accepted')"
            type="datetime-local"
            :value="acceptedAt"
            :disabled="readonly"
            :aria-invalid="error('crm.acceptedAt') !== ''"
            @input="setAccepted"
          />
          <p v-if="error('crm.acceptedAt')" class="field-error">{{ error('crm.acceptedAt') }}</p>
        </div>
      </template>

      <div class="field" :data-field="path('crm.note')">
        <label :for="idFor('note')">Комментарий из CRM</label>
        <textarea
          :id="idFor('note')"
          :value="draft.note"
          :disabled="readonly"
          rows="3"
          maxlength="500"
          :aria-invalid="error('crm.note') !== ''"
          @input="setNote"
        />
        <p v-if="error('crm.note')" class="field-error">{{ error('crm.note') }}</p>
      </div>

      <section class="messages">
        <h3>Сообщения из чатов</h3>
        <p v-if="error('messages')" class="field-error">{{ error('messages') }}</p>
        <div
          v-for="(message, messageIndex) in draft.messages"
          :key="`${draft.key}-${messageIndex}`"
          class="message"
          :data-field="path(`messages.${messageIndex}.text`)"
        >
          <div class="field">
            <label :for="idFor(`author-${messageIndex}`)">Автор</label>
            <select
              :id="idFor(`author-${messageIndex}`)"
              :value="message.author"
              :disabled="readonly"
              @change="setAuthor(messageIndex, $event)"
            >
              <option v-for="author in authors" :key="author.value" :value="author.value">
                {{ author.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label :for="idFor(`text-${messageIndex}`)">Текст</label>
            <textarea
              :id="idFor(`text-${messageIndex}`)"
              :value="message.text"
              :disabled="readonly"
              rows="2"
              :maxlength="maxMessageLength"
              :aria-invalid="messageError(messageIndex) !== ''"
              @input="setMessageText(messageIndex, $event)"
            />
            <p v-if="messageError(messageIndex)" class="field-error">
              {{ messageError(messageIndex) }}
            </p>
          </div>
          <button
            v-if="!readonly"
            type="button"
            class="button-secondary"
            @click="emit('removeMessage', messageIndex)"
          >
            Удалить
          </button>
        </div>
        <p v-if="draft.messages.length === 0" class="hint">Сообщений пока нет.</p>
        <template v-if="!readonly">
          <button
            type="button"
            class="button-secondary"
            :disabled="atMessageLimit"
            @click="addMessage"
          >
            Добавить сообщение
          </button>
          <p v-if="atMessageLimit" class="hint">
            В случае может быть не больше {{ maxMessages }} сообщений
          </p>
          <button
            type="button"
            class="button-secondary"
            :aria-expanded="pasteOpen"
            @click="pasteOpen = !pasteOpen"
          >
            Вставить переписку целиком
          </button>
          <div v-if="pasteOpen" class="paste">
            <label :for="idFor('paste')">Переписка</label>
            <textarea
              :id="idFor('paste')"
              v-model="pasteText"
              rows="6"
              @input="onPasteInput"
            />
            <p class="hint">
              Каждое сообщение — с новой строки. В начале строки можно указать автора через
              двоеточие, например: «Курьер: Задерживаюсь до 13:00»
            </p>
            <div v-if="parsed.length > 0">
              <p class="hint">Вот что получилось</p>
              <ul class="preview">
                <li v-for="(line, lineIndex) in parsed" :key="`${lineIndex}-${line.ok}`">
                  <template v-if="line.ok">{{ authorLabel(line.author) }}: {{ line.text }}</template>
                  <span v-else class="field-error">{{ line.message }}</span>
                </li>
              </ul>
            </div>
            <p v-if="parsedErrors.length > 0" class="hint">
              Исправьте строки с ошибками, затем добавьте сообщения в случай.
            </p>
            <p v-else-if="parsedMessages.length > room" class="hint">
              В случае может быть не больше {{ maxMessages }} сообщений
            </p>
            <p v-if="pasteStatus" role="status">{{ pasteStatus }}</p>
            <button
              type="button"
              class="button-secondary"
              :disabled="!canAddPasted"
              @click="addPasted"
            >
              Добавить в случай
            </button>
          </div>
        </template>
      </section>

      <button v-if="!readonly && canRemove" type="button" class="button-secondary" @click="emit('remove')">
        Удалить случай
      </button>
      <p v-else-if="!readonly" class="hint">В наборе должен остаться хотя бы один случай</p>
    </div>
  </details>
</template>

<style scoped>
.case-block {
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.case-block summary {
  cursor: pointer;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.case-body,
.messages,
.paste,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.case-body,
.messages,
.paste {
  margin-top: var(--space-4);
  gap: var(--space-3);
}

.messages h3,
.hint,
.field-error,
.preview {
  margin: 0;
}

.field input,
.field select,
.field textarea,
.paste textarea {
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.field input,
.field select {
  min-height: 2.75rem;
}

.message {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}

.hint {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.field-error {
  color: var(--color-error-fg);
}

.preview {
  padding-left: 1.2rem;
}

.case-body > .button-secondary,
.messages > .button-secondary,
.paste > .button-secondary {
  align-self: flex-start;
}
</style>
