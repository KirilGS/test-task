import { createRouter, createWebHistory } from 'vue-router'
import CheckView from '@/views/CheckView.vue'
import DatasetEditorView from '@/views/DatasetEditorView.vue'
import DatasetListView from '@/views/DatasetListView.vue'
import HowView from '@/views/HowView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import SummaryPage from '@/views/SummaryPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'summary', component: SummaryPage },
    { path: '/summaries/:id', name: 'summary-saved', component: SummaryPage },
    { path: '/datasets', name: 'datasets', component: DatasetListView },
    { path: '/datasets/:id', name: 'dataset', component: DatasetEditorView },
    { path: '/how', name: 'how', component: HowView },
    { path: '/check', name: 'check', component: CheckView },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

export default router
