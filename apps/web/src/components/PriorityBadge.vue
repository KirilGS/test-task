<script setup lang="ts">
import type { Priority } from '@support-summary/core'
import { computed } from 'vue'
import { useMetaStore } from '@/stores/meta'

const props = defineProps<{
  priority: Priority
}>()

const metaStore = useMetaStore()
const label = computed(() => metaStore.meta?.labels.priority[props.priority] ?? '')
</script>

<template>
  <span class="badge" :data-level="priority">
    <svg v-if="priority === 'critical'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 4.2v4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.2" r="0.8" fill="currentColor" />
    </svg>
    <svg v-else-if="priority === 'high'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 2.2 14.2 13.2H1.8Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M8 6.2v3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
    </svg>
    <svg v-else-if="priority === 'medium'" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 5v3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="11" r="0.7" fill="currentColor" />
    </svg>
    <svg v-else class="icon" viewBox="0 0 16 16" aria-hidden="true">
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
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.15rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: 1.4;
}

.icon {
  width: 1rem;
  height: 1rem;
  flex: none;
}

.badge[data-level='critical'] {
  background: var(--color-priority-critical-bg);
  color: var(--color-priority-critical-fg);
}

.badge[data-level='high'] {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-fg);
}

.badge[data-level='medium'] {
  background: var(--color-priority-medium-bg);
  color: var(--color-priority-medium-fg);
}

.badge[data-level='none'] {
  background: var(--color-priority-none-bg);
  color: var(--color-priority-none-fg);
}
</style>
