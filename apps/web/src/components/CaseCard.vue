<script setup lang="ts">
import type { CaseAssessment, ChatClaim } from '@support-summary/core'
import { computed, ref, useId } from 'vue'
import type { RuleInfo } from '@/api/types'
import PriorityBadge from '@/components/PriorityBadge.vue'
import { useMetaStore } from '@/stores/meta'
import { formatMsk } from '@/utils/datetime'

const props = defineProps<{
  assessment: CaseAssessment
  claims: ChatClaim[]
  rejected: number
  rules: RuleInfo[]
  saved: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  correct: []
  wrong: [comment: string]
}>()

const metaStore = useMetaStore()
const wrongOpen = ref(false)
const wrongComment = ref('')
const wrongError = ref('')
const commentId = useId()

const typeLabel = computed(
  () => metaStore.meta?.labels.caseType[props.assessment.caseType] ?? '',
)

const deadline = computed(() => {
  const value = props.assessment.deadline
  if (value === null) {
    return 'не указан'
  }
  return formatMsk(value)
})

const fired = computed(() =>
  props.assessment.firedRules.flatMap((code) => {
    const rule = props.rules.find((item) => item.code === code)
    return rule === undefined ? [] : [rule]
  }),
)

const rejectedText = computed(() => factsSentence(props.rejected))

function factsSentence(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  let noun = 'фактов'
  let which = 'которых нет'
  let ending = 'Они не учтены'
  if (mod10 === 1 && mod100 !== 11) {
    noun = 'факт'
    which = 'которого нет'
    ending = 'Он не учтён'
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    noun = 'факта'
  }
  return `ИИ предложил ${count} ${noun}, ${which} в сообщениях. ${ending}`
}

function submitWrong(): void {
  const comment = wrongComment.value.trim()
  if (comment === '') {
    wrongError.value = 'Опишите, что не так'
    return
  }
  wrongError.value = ''
  emit('wrong', comment)
}
</script>

<template>
  <article class="card">
    <div class="head">
      <h3 class="case-id">{{ assessment.caseId }}</h3>
      <span>{{ typeLabel }}</span>
      <PriorityBadge :priority="assessment.priority" />
    </div>
    <p class="deadline">Срок: {{ deadline }}</p>

    <section class="facts facts-crm">
      <h4>
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
      </h4>
      <ul v-if="assessment.crmFacts.length">
        <li v-for="(fact, index) in assessment.crmFacts" :key="`${fact}-${index}`">{{ fact }}</li>
      </ul>
      <p v-else>Нет сведений</p>
    </section>

    <section class="facts facts-chat">
      <h4>
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
      </h4>
      <p class="unconfirmed">не подтверждено</p>
      <ul v-if="assessment.chatFacts.length">
        <li v-for="(fact, index) in assessment.chatFacts" :key="`${fact}-${index}`">{{ fact }}</li>
      </ul>
      <p v-else>Нет сообщений</p>
    </section>

    <section v-if="assessment.toCheck.length">
      <h4>Проверить перед действием</h4>
      <ul>
        <li v-for="(item, index) in assessment.toCheck" :key="`${item}-${index}`">{{ item }}</li>
      </ul>
    </section>

    <section v-if="assessment.nextSteps.length">
      <h4>Что делать дальше</h4>
      <ol>
        <li v-for="(step, index) in assessment.nextSteps" :key="`${step}-${index}`">{{ step }}</li>
      </ol>
    </section>

    <details>
      <summary>Почему такая срочность</summary>
      <ul v-if="fired.length" class="rules">
        <li v-for="rule in fired" :key="rule.code">
          <strong>{{ rule.title }}</strong>
          <p>{{ rule.description }}</p>
        </li>
      </ul>
      <p v-else>Правила для этого случая не найдены.</p>
      <h4 v-if="claims.length">Факты из переписки</h4>
      <ul v-if="claims.length" class="claims">
        <li v-for="(claim, index) in claims" :key="`${claim.quote}-${index}`">
          <p>{{ claim.summary }}</p>
          <blockquote>{{ claim.quote }}</blockquote>
          <p v-if="claim.confidence === 'low'">ИИ не уверен</p>
        </li>
      </ul>
      <p v-if="rejected > 0">{{ rejectedText }}</p>
    </details>

    <div v-if="saved" class="thanks" role="status">Спасибо, отзыв сохранён</div>
    <div v-else class="review">
      <button type="button" class="button-secondary" :disabled="saving" @click="emit('correct')">
        Верно
      </button>
      <button type="button" class="button-secondary" :disabled="saving" @click="wrongOpen = true">
        Ошибка
      </button>
      <form v-if="wrongOpen" class="wrong" @submit.prevent="submitWrong">
        <label :for="commentId">Что не так?</label>
        <textarea :id="commentId" v-model="wrongComment" rows="3" />
        <p v-if="wrongError" class="field-error">{{ wrongError }}</p>
        <button type="submit" class="button-secondary" :disabled="saving">Отправить</button>
      </form>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.case-id,
h4 {
  margin: 0;
}

.deadline,
.unconfirmed,
.field-error,
blockquote,
.claims p,
.rules p {
  margin: 0;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
}

.facts h4,
.review,
.wrong {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.facts-crm {
  border: 2px solid var(--color-success-fg);
  background: var(--color-success-bg);
}

.facts-chat {
  border: 2px dashed var(--color-primary);
  background: var(--color-surface);
}

.icon {
  width: 1rem;
  height: 1rem;
  flex: none;
}

.unconfirmed {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.wrong {
  flex-direction: column;
  align-items: stretch;
  width: 100%;
}

textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.field-error {
  color: var(--color-error-fg);
}

blockquote {
  padding-left: var(--space-3);
  border-left: 3px solid var(--color-border);
  overflow-wrap: anywhere;
}

ul,
ol {
  margin: 0;
  padding-left: 1.25rem;
}

details {
  min-width: 0;
}
</style>
