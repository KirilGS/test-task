<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useMetaStore } from '@/stores/meta'

const metaStore = useMetaStore()
metaStore.ensure()

const footerText = computed(() => {
  const value = metaStore.meta
  if (value === null) {
    return ''
  }
  if (value.aiAvailable && value.aiModel) {
    return `ИИ подключён: ${value.aiModel}`
  }
  return 'ИИ не подключён — сводка строится без ИИ'
})
</script>

<template>
  <div v-if="metaStore.loading" class="gate" role="status">Загружаем…</div>
  <div v-else-if="metaStore.error" class="gate" role="alert">
    <p>{{ metaStore.error }}</p>
    <button type="button" class="button-primary" @click="metaStore.retry()">Повторить</button>
  </div>
  <div v-else class="shell">
    <header class="header">
      <p class="brand">Сводка для support-отдела</p>
      <nav class="nav" aria-label="Разделы">
        <RouterLink to="/">Сводка</RouterLink>
        <RouterLink to="/datasets">Наборы случаев</RouterLink>
        <RouterLink to="/how">Как это работает</RouterLink>
        <RouterLink to="/check">Проверка</RouterLink>
      </nav>
    </header>
    <p class="warning">Это демонстрация. Не вводите настоящие персональные данные.</p>
    <RouterView />
    <footer class="footer">{{ footerText }}</footer>
  </div>
</template>

<style scoped>
.gate {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-4);
  text-align: center;
}

.shell {
  width: min(100%, 1440px);
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.brand {
  margin: 0;
  color: var(--color-heading);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.nav a {
  color: var(--color-primary);
  text-decoration: none;
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius);
}

.nav a[aria-current='page'] {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.warning {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius);
  background: var(--color-warning-bg);
  color: var(--color-warning-fg);
}

.footer {
  margin-top: auto;
  color: var(--color-muted);
  overflow-wrap: anywhere;
}
</style>
