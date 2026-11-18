<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { copyDataset, createDataset, deleteDataset, errorMessage } from '@/api/client'
import type { DatasetListItem } from '@/api/types'
import AppNotice from '@/components/AppNotice.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useDatasetsStore } from '@/stores/datasets'
import { casesCountText } from '@/utils/datasetForm'
import { formatMsk } from '@/utils/datetime'

const store = useDatasetsStore()
const router = useRouter()
const busy = ref(false)
const actionError = ref<string | null>(null)
const actionStatus = ref('')
const confirmOpen = ref(false)
const pendingDelete = ref<DatasetListItem | null>(null)
let actionToken = 0

const deleteMessage = computed(() => {
  const title = pendingDelete.value?.title ?? 'этот набор'
  return `Набор «${title}» будет удалён.`
})

onMounted(() => {
  void store.loadList()
})

async function create(): Promise<void> {
  if (busy.value) {
    return
  }
  const token = begin('Создаём набор…')
  try {
    const created = await createDataset({
      title: 'Новый набор',
      snapshotAt: '2026-11-16T10:00:00+03:00',
      cases: [
        {
          id: 'П-10',
          type: 'card_delivery',
          crm: {
            status: 'in_transit',
            plannedBy: null,
            acceptedAt: null,
            note: '',
          },
          messages: [],
        },
      ],
    })
    if (token !== actionToken) {
      return
    }
    await router.push({ name: 'dataset', params: { id: created.id } })
  } catch (reason) {
    if (token !== actionToken) {
      return
    }
    fail(reason)
  } finally {
    if (token === actionToken) {
      busy.value = false
    }
  }
}

async function copy(id: string): Promise<void> {
  if (busy.value) {
    return
  }
  const token = begin('Делаем копию…')
  try {
    const created = await copyDataset(id)
    if (token !== actionToken) {
      return
    }
    await router.push({ name: 'dataset', params: { id: created.id } })
  } catch (reason) {
    if (token !== actionToken) {
      return
    }
    fail(reason)
  } finally {
    if (token === actionToken) {
      busy.value = false
    }
  }
}

function askDelete(item: DatasetListItem): void {
  if (busy.value || item.isDemo) {
    return
  }
  pendingDelete.value = item
  confirmOpen.value = true
}

function cancelDelete(): void {
  confirmOpen.value = false
  pendingDelete.value = null
}

async function confirmDelete(): Promise<void> {
  const item = pendingDelete.value
  confirmOpen.value = false
  pendingDelete.value = null
  if (item === null || busy.value) {
    return
  }
  const token = begin('Удаляем набор…')
  try {
    await deleteDataset(item.id)
    if (token !== actionToken) {
      return
    }
    actionStatus.value = ''
    await store.loadList()
  } catch (reason) {
    if (token !== actionToken) {
      return
    }
    fail(reason)
  } finally {
    if (token === actionToken) {
      busy.value = false
    }
  }
}

function begin(status: string): number {
  actionToken += 1
  busy.value = true
  actionError.value = null
  actionStatus.value = status
  return actionToken
}

function fail(reason: unknown): void {
  actionError.value = errorMessage(reason)
  actionStatus.value = ''
}
</script>

<template>
  <main class="page">
    <h1>Наборы случаев</h1>
    <button type="button" class="button-primary" :disabled="busy" @click="create">
      Создать набор
    </button>
    <p v-if="actionStatus" role="status">{{ actionStatus }}</p>
    <AppNotice v-if="actionError" kind="error" :message="actionError" />
    <AppNotice v-if="store.error" kind="error" :message="store.error" />
    <button
      v-if="store.error"
      type="button"
      class="button-secondary"
      @click="store.loadList()"
    >
      Повторить
    </button>
    <p v-if="store.listLoading" role="status">Загружаем наборы…</p>
    <p v-else-if="store.items.length === 0" class="empty">
      Пока нет наборов. Создайте набор, чтобы собрать сводку.
    </p>
    <div v-else class="list">
      <article v-for="item in store.items" :key="item.id" class="card">
        <h2>{{ item.title }}</h2>
        <p>{{ casesCountText(item.casesCount) }}</p>
        <p v-if="item.isDemo"><span class="badge">Пример</span></p>
        <p>Изменён: {{ formatMsk(item.updatedAt) }}</p>
        <div class="actions">
          <RouterLink class="button-secondary" :to="{ name: 'dataset', params: { id: item.id } }">
            Открыть
          </RouterLink>
          <button type="button" class="button-secondary" :disabled="busy" @click="copy(item.id)">
            Сделать копию
          </button>
          <button
            v-if="!item.isDemo"
            type="button"
            class="button-secondary"
            :disabled="busy"
            @click="askDelete(item)"
          >
            Удалить
          </button>
        </div>
      </article>
    </div>
    <ConfirmDialog
      :open="confirmOpen"
      title="Удалить набор?"
      :message="deleteMessage"
      confirm-label="Удалить"
      cancel-label="Оставить"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  min-width: 0;
}

.page h1,
.card h2,
.empty {
  margin: 0;
}

.page > .button-primary,
.page > .button-secondary {
  align-self: flex-start;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  min-width: 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.card h2 {
  color: var(--color-heading);
  font-size: var(--font-size-lg);
  overflow-wrap: anywhere;
}

.card p {
  margin: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0 0.6rem;
  border-radius: var(--radius-pill);
  background: var(--color-warning-bg);
  color: var(--color-warning-fg);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
