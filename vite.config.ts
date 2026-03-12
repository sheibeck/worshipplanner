/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const gitHash = execSync('git log -1 --format=%h -- src/').toString().trim()

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(gitHash),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
      '/api/planningcenter': {
        target: 'https://api.planningcenteronline.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/planningcenter/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['src/rules.test.ts', '**/node_modules/**'],
  },
})
