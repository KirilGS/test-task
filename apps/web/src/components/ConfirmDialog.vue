<script setup lang="ts">
import { nextTick, onMounted, useId, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const titleId = useId()
const dialog = useTemplateRef('dialog')

function sync(): void {
  const element = dialog.value
  if (element === null) {
    return
  }
  if (props.open && !element.open) {
    element.showModal()
  }
  if (!props.open && element.open) {
    element.close()
  }
}

function onCancel(event: Event): void {
  event.preventDefault()
  emit('cancel')
}

watch(() => props.open, () => {
  void nextTick(sync)
})

onMounted(sync)
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-labelledby="titleId" @cancel="onCancel">
    <h2 :id="titleId">{{ title }}</h2>
    <p>{{ message }}</p>
    <div class="actions">
      <button type="button" class="button-secondary" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button type="button" class="button-primary" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(32rem, calc(100vw - 2rem));
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text);
}

.dialog::backdrop {
  background: rgb(28 25 23 / 45%);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
