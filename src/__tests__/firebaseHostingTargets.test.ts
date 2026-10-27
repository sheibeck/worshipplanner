// R448/R451 hosting targets and the old-address redirect.
// See ADR-0247 (docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface Redirect {
  source?: string
  regex?: string
  destination: string
  type: number
}

interface HostingBlock {
  target?: string
  public?: string
  predeploy?: string[]
  ignore?: string[]
  rewrites?: Array<{ source: string; destination?: string; function?: string }>
  headers?: Array<{ source: string }>
  redirects?: Redirect[]
  cleanUrls?: boolean
  trailingSlash?: boolean
  i18n?: unknown
}

interface Firebaserc {
  projects: { default: string }
  targets: Record<string, { hosting: Record<string, string[]> }>
}

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf-8')

const config = JSON.parse(read('firebase.json')) as { hosting: HostingBlock[] }
const firebaserc = JSON.parse(read('.firebaserc')) as Firebaserc
const legacyPage = read('legacy-site/index.html')

const NEW_ORIGIN = 'https://worshipbuilder.web.app'
const IGNORE = ['firebase.json', '**/.*', '**/node_modules/**']

const blocks = config.hosting
const app = blocks.find((b) => b.target === 'app')!
const legacy = blocks.find((b) => b.target === 'legacy')!

// First matching legacy rule wins; `:1` is the first unnamed capture group.
function redirectFor(path: string): string | null {
  for (const rule of legacy.redirects ?? []) {
    const m = new RegExp(rule.regex!, 'u').exec(path)
    if (!m) continue
    return rule.destination.replace(':1', m[1] ?? '')
  }
  return null
}

describe('firebase.json hosting targets (R448)', () => {
  it('is an array of exactly two blocks, each with a target', () => {
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks).toHaveLength(2)
    for (const b of blocks) {
      expect(typeof b.target).toBe('string')
      expect(b.target).toBeTruthy()
    }
    expect(blocks.map((b) => b.target).sort()).toEqual(['app', 'legacy'])
  })

  it('app block serves dist as a SPA with the /api function rewrite', () => {
    expect(app.public).toBe('dist')
    expect(app.predeploy).toEqual(['npm run build'])
    expect(app.ignore).toEqual(IGNORE)
    expect(app.rewrites).toEqual([
      { source: '/api/**', function: 'api' },
      { source: '**', destination: '/index.html' },
    ])
    expect(app.redirects).toBeUndefined()
  })

  it('no rewrite, redirect or header source starts with /__', () => {
    for (const b of blocks) {
      const sources = [
        ...(b.rewrites ?? []).map((r) => r.source),
        ...(b.redirects ?? []).map((r) => r.source ?? ''),
        ...(b.headers ?? []).map((h) => h.source),
      ]
      for (const s of sources) expect(s.startsWith('/__')).toBe(false)
    }
  })
})

describe('legacy block is a plain redirect (R451)', () => {
  it('has exactly target, public, ignore and redirects', () => {
    expect(Object.keys(legacy).sort()).toEqual(['ignore', 'public', 'redirects', 'target'])
    expect(legacy.public).toBe('legacy-site')
    expect(legacy.ignore).toEqual(IGNORE)
  })

  it('has exactly the two type-302 regex rules, in order', () => {
    expect(legacy.redirects).toEqual([
      { regex: '^/$', destination: `${NEW_ORIGIN}/`, type: 302 },
      {
        regex: '^/((?:[^_]|_(?:[^_]|$)).*)$',
        destination: `${NEW_ORIGIN}/:1`,
        type: 302,
      },
    ])
  })

  it('every rule is a 302 to the constant new origin', () => {
    for (const r of legacy.redirects!) {
      expect(r.type).toBe(302)
      expect(r.destination.startsWith(`${NEW_ORIGIN}/`)).toBe(true)
    }
  })

  it.each([
    ['/', `${NEW_ORIGIN}/`],
    ['/services/abc/', `${NEW_ORIGIN}/services/abc/`],
    ['/share/tok123', `${NEW_ORIGIN}/share/tok123`],
    ['/volunteer/verify', `${NEW_ORIGIN}/volunteer/verify`],
    ['/_x/y', `${NEW_ORIGIN}/_x/y`],
    ['/_', `${NEW_ORIGIN}/_`],
    ['//evil.com/x', `${NEW_ORIGIN}//evil.com/x`],
  ])('redirects %s to the same path on the new origin', (path, expected) => {
    expect(redirectFor(path)).toBe(expected)
  })

  it.each([
    '/',
    '/services/abc/',
    '/share/tok123',
    '/volunteer/verify',
    '/_x/y',
    '/_',
    '//evil.com/x',
    '/@evil.com',
    '/share/a%20b',
  ])('never changes the host for %s', (path) => {
    const result = redirectFor(path)
    expect(result).not.toBeNull()
    expect(new URL(result!).origin).toBe(NEW_ORIGIN)
  })

  it.each([
    '/__/auth/handler',
    '/__/auth/iframe',
    '/__/auth/action',
    '/__/firebase/init.json',
    '/__',
  ])('leaves reserved path %s alone', (path) => {
    expect(redirectFor(path)).toBeNull()
  })
})

describe('legacy-site/index.html (R451)', () => {
  it('is a static noindex page linking the new origin, with no script', () => {
    expect(legacyPage).toContain('href="https://worshipbuilder.web.app/"')
    expect(legacyPage).toContain('name="robots" content="noindex"')
    expect(legacyPage).not.toMatch(/<script/i)
  })

  it('does not mention the old-origin host', () => {
    expect(legacyPage).not.toMatch(/worship-planner-bc515\.(web\.app|firebaseapp\.com)/)
  })
})

describe('.firebaserc target mapping (R448)', () => {
  it('maps app -> worshipbuilder and legacy -> worship-planner-bc515', () => {
    expect(firebaserc.projects.default).toBe('worship-planner-bc515')
    const t = firebaserc.targets['worship-planner-bc515']!.hosting
    expect(t.app).toEqual(['worshipbuilder'])
    expect(t.legacy).toEqual(['worship-planner-bc515'])
  })
})
