import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@docs': fileURLToPath(new URL('../../docs', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['@support-summary/core'],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
