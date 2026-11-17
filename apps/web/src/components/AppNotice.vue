<script setup lang="ts">
defineProps<{
  kind: 'success' | 'error'
  message: string
}>()
</script>

<template>
  <p class="notice" :class="kind" :role="kind === 'error' ? 'alert' : 'status'">
    {{ message }}
  </p>
</template>

<style scoped>
.notice {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
}

.success {
  background: var(--color-success-bg);
  color: var(--color-success-fg);
}

.error {
  background: var(--color-error-bg);
  color: var(--color-error-fg);
}
</style>
