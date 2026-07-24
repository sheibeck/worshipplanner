/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const gitHash = execSync('git log -1 --format=%h -- src/').toString().trim()

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  // Load NON-VITE_ secrets for the dev proxy only. Because they are not VITE_
  // prefixed, they are never exposed to `import.meta.env` / the client bundle —
  // they exist only in this Node dev-server process, mirroring the prod Cloud
  // Function proxy which injects the same keys server-side.
  const env = loadEnv(mode, process.cwd(), '')

  // Fail the production build loudly if the Firebase client config is missing.
  // Vite statically inlines `import.meta.env.VITE_FIREBASE_*` at build time, so
  // a build with these unset silently ships an empty apiKey → runtime
  // `auth/invalid-api-key`. Guard only `vite build` (never dev/serve/test).
  if (command === 'build') {
    const requiredFirebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ]
    const missing = requiredFirebaseVars.filter((key) => !env[key])
    if (missing.length) {
      throw new Error(
        `Production build aborted: missing required Firebase env vars: ${missing.join(', ')}. ` +
          'Populate .env.local (or the build environment) before running `npm run build`.',
      )
    }
  }

  return {
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
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void; removeHeader: (k: string) => void }) => {
              proxyReq.removeHeader('x-app-auth')
              if (env.CLAUDE_API_KEY) proxyReq.setHeader('x-api-key', env.CLAUDE_API_KEY)
            })
          },
        },
        '/api/esv': {
          target: 'https://api.esv.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/esv/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void; removeHeader: (k: string) => void }) => {
              proxyReq.removeHeader('x-app-auth')
              if (env.ESV_API_KEY) proxyReq.setHeader('authorization', `Token ${env.ESV_API_KEY}`)
            })
          },
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
  }
})
