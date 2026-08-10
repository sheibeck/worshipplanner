import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface FirebaseHeaderEntry {
  source: string
  headers: Array<{ key: string; value: string }>
}

interface FirebaseHostingConfig {
  hosting: {
    headers?: FirebaseHeaderEntry[]
  }
}

function loadFirebaseConfig(): FirebaseHostingConfig {
  const configPath = resolve(process.cwd(), 'firebase.json')
  const raw = readFileSync(configPath, 'utf-8')
  return JSON.parse(raw) as FirebaseHostingConfig
}

describe('firebase.json hosting headers (R109)', () => {
  it('serves index.html with a no-cache/must-revalidate Cache-Control header', () => {
    const config = loadFirebaseConfig()
    const headers = config.hosting.headers ?? []

    const shellEntry = headers.find((entry) => entry.source.includes('index.html'))
    expect(shellEntry, 'expected a hosting.headers entry targeting index.html').toBeDefined()

    const cacheControl = shellEntry!.headers.find(
      (h) => h.key.toLowerCase() === 'cache-control'
    )
    expect(cacheControl, 'expected a Cache-Control header on the index.html entry').toBeDefined()
    expect(cacheControl!.value).toMatch(/no-cache|max-age=0/)
    expect(cacheControl!.value).toMatch(/must-revalidate/)
  })

  it('does not narrow the Cache-Control of hashed assets/* to no-cache', () => {
    const config = loadFirebaseConfig()
    const headers = config.hosting.headers ?? []

    const narrowsAssets = headers.some((entry) => {
      if (!/assets/.test(entry.source)) return false
      return entry.headers.some(
        (h) => h.key.toLowerCase() === 'cache-control' && /no-cache|max-age=0/.test(h.value)
      )
    })

    expect(narrowsAssets).toBe(false)
  })
})

// No service worker registration exists in this codebase (verified by inspection during
// planning and re-confirmed during execution): no `serviceWorker.register`, no
// `vite-plugin-pwa`, and no `workbox` usage in src/, vite.config.ts, or package.json.
// This means the firebase.json hosting header above is the sole cache authority for the
// SPA shell document — nothing else can cache index.html client-side.
