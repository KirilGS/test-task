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
      <p class="brand">
        <span class="mark" aria-hidden="true">РМ</span>
        <span class="brand-name">Руссмаркет</span>
      </p>
      <nav class="nav" aria-label="Разделы">
        <RouterLink to="/">Сводка</RouterLink>
        <RouterLink to="/datasets">Наборы случаев</RouterLink>
        <RouterLink to="/how">Как это работает</RouterLink>
        <RouterLink to="/check">Проверка</RouterLink>
        <RouterLink to="/ai">Подключение ИИ</RouterLink>
      </nav>
    </header>
    <p class="warning">
      <svg class="warning-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 7.2v3.6M8 5.2v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      Это демонстрация. Не вводите настоящие персональные данные.
    </p>
    <RouterView />
    <footer class="footer">
      <p class="footer-mark">Руссмаркет / Digital</p>
      <p class="footer-status">{{ footerText }}</p>
    </footer>
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
  width: min(100% - 2rem, 72rem);
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--space-5) 0 var(--space-4);
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
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-heading);
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.55rem;
  background: var(--color-heading);
  color: var(--color-on-primary);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.brand-name {
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}

.nav a {
  color: var(--color-muted);
  text-decoration: none;
  padding: 0.35rem 0;
  border-bottom: 2px solid transparent;
}

.nav a[aria-current='page'] {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.warning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-note-border);
  border-radius: var(--radius);
  background: var(--color-note-bg);
  color: var(--color-heading);
  font-size: var(--font-size-sm);
}

.warning-icon {
  width: 1rem;
  height: 1rem;
  flex: none;
  color: var(--color-primary);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.footer-mark {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.footer-status {
  letter-spacing: 0;
  text-transform: none;
}

.footer p {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
