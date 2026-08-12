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

  // Fail the production build loudly if any emulator host reached the bundle.
  //
  // Sibling of the guard above, and added for the same reason: on 2026-08-05 a
  // production build shipped with `connectAuthEmulator(auth, 'http://127.0.0.1:9099')`
  // wired up, and the live site tried to authenticate against localhost. Root cause
  // was that `src/firebase/index.ts` gated emulator wiring on VITE_USE_EMULATORS
  // alone — and **Vite loads `.env.local` during a production build too**, so the
  // dev flag was inlined into the shipped bundle. Every upstream signal was green:
  // build succeeded, deploy succeeded, tests passed. It surfaced only at sign-in.
  //
  // The source-level fix is the `import.meta.env.DEV &&` conjunct in
  // src/firebase/index.ts, which lets Vite tree-shake the block out entirely. This
  // guard is the backstop that proves it worked, by inspecting the EMITTED CHUNKS
  // rather than the source — the only place the bug was ever visible.
  const assertNoEmulatorHostsInBundle = {
    name: 'assert-no-emulator-hosts-in-bundle',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      // Split so this file's own literals never match themselves.
      const LOOPBACK = ['127.0.0', '.1'].join('')
      const offenders: string[] = []
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code) continue
        if (chunk.code.includes(LOOPBACK) || chunk.code.includes('localhost:9099')) {
          offenders.push(fileName)
        }
      }
      if (offenders.length) {
        throw new Error(
          `Production build aborted: emulator host found in emitted bundle (${offenders.join(', ')}). ` +
            'The Firebase emulator wiring in src/firebase/index.ts must be gated on `import.meta.env.DEV` ' +
            'so it is tree-shaken from production builds. Note that Vite loads .env.local during ' +
            '`vite build`, so VITE_USE_EMULATORS=true alone does NOT mean "dev only".',
        )
      }
    },
  }

  return {
    plugins: [vue(), tailwindcss(), assertNoEmulatorHostsInBundle],
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
        '/api/nlt': {
          // Dev-only mirror of the prod Cloud Function's nlt branch. NLT auth
          // is a `key` QUERY PARAMETER (not a header like esv/anthropic), so
          // it must be injected into the URL here, exactly as
          // functions/src/index.ts::buildUpstreamUrl does server-side. Without
          // this entry `/api/nlt/...` fell through to the SPA and returned
          // index.html, which has no #bibletext → "Could not load passage".
          target: 'https://api.nlt.to',
          changeOrigin: true,
          rewrite: (path: string) => {
            const stripped = path.replace(/^\/api\/nlt/, '')
            const url = new URL(stripped, 'https://api.nlt.to')
            // Always SET (overwrite any inbound key) — mirrors the prod proxy.
            if (env.NLT_API_KEY) url.searchParams.set('key', env.NLT_API_KEY)
            return url.pathname + url.search
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: { removeHeader: (k: string) => void }) => {
              proxyReq.removeHeader('x-app-auth')
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
      exclude: [
        'src/rules.test.ts',
        '**/node_modules/**',
        // `functions/lib/` is gitignored TypeScript build output. Its compiled
        // `*.test.js` files were being collected by this root jsdom run, where
        // they fail on a node-only environment — two permanent failures in the
        // baseline that masked real ones. The Cloud Functions suite has its own
        // config (`functions/vitest.config.ts`) which correctly runs the TS
        // sources under node.
        'functions/lib/**',
        // `render-service/` is a standalone package with its OWN vitest
        // (4.1.10, pinned in render-service/package.json) and its OWN
        // `render-service/vitest.config.ts` running under a node environment.
        // Collected by this root jsdom run it fails two ways at once: the root
        // vitest (4.0.x) mis-handles render.test.ts's `vi.mock("node:child_process")`
        // ("No 'default' export…"), and a node service has no business under
        // jsdom. Run it via `cd render-service && npm test` (39 tests pass).
        // Same rationale as `functions/lib/**` above.
        'render-service/**',
      ],
    },
  }
})
