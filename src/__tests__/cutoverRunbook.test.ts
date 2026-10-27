// R453 cutover runbook guard.
// See ADR-0247 (docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md)
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RUNBOOK = resolve(process.cwd(), 'docs/runbooks/worshipbuilder-cutover.md')

const HEADINGS = [
  '## Step 0 — Pre-flight (local, no production change)',
  '## Step 1 — Apply Storage CORS (production)',
  '## Step 2 — Add the authorized domain (production)',
  '## Step 3 — Deploy the app to the new site (production)',
  '## Step 4 — Deploy functions (production)',
  '## Step 5 — Smoke-test the new domain (before the redirect)',
  '## Step 6 — Turn on the old-address redirect (production)',
  '## Step 7 — Each person and each Run computer',
  '## Step 8 — Optional console renames',
  '## Rollback',
  '## Post-cutover smoke checklist',
]

const text = existsSync(RUNBOOK) ? readFileSync(RUNBOOK, 'utf8') : ''
const lines = text.split(/\r?\n/)

// Section = from an H2 line to the next H2 line.
function sections(): Map<string, string> {
  const out = new Map<string, string>()
  let current = ''
  let buf: string[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) out.set(current, buf.join('\n'))
      current = line.trimEnd()
      buf = []
    } else if (current) {
      buf.push(line)
    }
  }
  if (current) out.set(current, buf.join('\n'))
  return out
}

// Fenced lines with the section they sit in.
function fencedLines(): { line: string; section: string }[] {
  const out: { line: string; section: string }[] = []
  let section = ''
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('## ')) section = line.trimEnd()
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) out.push({ line, section })
  }
  return out
}

const secs = sections()
const fenced = fencedLines()

function section(h: string): string {
  return secs.get(h) ?? ''
}

describe('cutover runbook', () => {
  it('exists', () => {
    expect(existsSync(RUNBOOK)).toBe(true)
  })

  it('has the eleven H2 sections in order', () => {
    const h2 = lines.filter((l) => l.startsWith('## ')).map((l) => l.trimEnd())
    const wanted = h2.filter((h) => HEADINGS.includes(h))
    expect(wanted).toEqual(HEADINGS)
  })

  it.each([
    [0, "grep -qE '^SERVICE_SHARE_BASE_URL=https://worshipbuilder\\.web\\.app[[:space:]]*$' functions/.env"],
    [0, "grep -qE '^VITE_FIREBASE_AUTH_DOMAIN=worship-planner-bc515\\.firebaseapp\\.com[[:space:]]*$' .env.local"],
    [0, 'firebase target'],
    [1, 'gcloud storage buckets update gs://worship-planner-bc515.firebasestorage.app --cors-file=storage-cors.json'],
    [3, 'firebase deploy --only hosting:app'],
    [4, 'firebase deploy --only functions'],
    [6, 'firebase deploy --only hosting:legacy'],
    [9, 'firebase hosting:clone worshipbuilder:live worship-planner-bc515:live'],
  ])('first fenced occurrence for step index %i is in its section: %s', (idx, cmd) => {
    const hit = fenced.find((f) => f.line.includes(cmd))
    expect(hit, `command not found in a fence: ${cmd}`).toBeDefined()
    expect(hit!.section).toBe(HEADINGS[idx])
  })

  it('env-file checks are quiet, status-only and CRLF-tolerant', () => {
    const touching = fenced.filter(
      (f) => f.line.includes('functions/.env') || f.line.includes('.env.local'),
    )
    const greps = touching.filter((f) => /\bgrep\b/.test(f.line))
    expect(greps.length).toBeGreaterThanOrEqual(2)
    for (const { line } of greps) {
      expect(line).toMatch(/grep -q/)
      expect(line).toContain('&& echo')
      expect(line).toContain('|| echo')
    }
    for (const { line } of touching.filter((f) => f.line.includes('Select-String'))) {
      expect(line).toContain('-Quiet')
    }
    for (const { line } of fenced) expect(line).not.toContain('grep -qx')
  })

  it('step bodies carry their required phrases', () => {
    const need: [number, string[]][] = [
      [2, ['worshipbuilder.firebaseapp.com']],
      [4, ['links start with https://worshipbuilder.web.app']],
      [5, ['Google sign-in', 'magic link']],
      [6, ['/__/auth/handler', '/__/firebase/init.json', '%{redirect_url}', '302']],
      [7, ['sign in once', 'church', 'monitor setup', 'Window management', 'Automatic Fullscreen']],
      [8, ['Public-facing name', 'OAuth consent screen']],
      [9, ['Roll back', '302']],
    ]
    for (const [idx, phrases] of need) {
      const body = section(HEADINGS[idx]!)
      for (const p of phrases) expect(body, `${HEADINGS[idx]} lacks "${p}"`).toContain(p)
    }
  })

  it('marks production steps owner-confirmed and timed outside a service', () => {
    const n = text.split('Owner confirms before running').length - 1
    expect(n).toBeGreaterThanOrEqual(6)
    expect(text.toLowerCase()).toContain('never during a service')
  })

  it('only targeted deploys appear in fences', () => {
    const deploys = fenced.filter((f) => f.line.includes('firebase deploy'))
    expect(deploys.length).toBeGreaterThanOrEqual(3)
    for (const { line } of deploys) {
      expect(line).toMatch(/--only (hosting:app|hosting:legacy|functions)/)
    }
  })

  it('has no placeholders and never prints an env file wholesale', () => {
    for (const { line } of fenced) {
      expect(line).not.toMatch(/<[A-Za-z_][\w-]*>/)
      expect(line).not.toContain('YOUR_')
      expect(line).not.toContain('cat functions/.env')
      expect(line).not.toContain('Get-Content functions/.env')
      expect(line).not.toContain('type functions')
    }
  })

  it('carries no settings-carry or legacy-build material (owner Amendment 2)', () => {
    const lower = text.toLowerCase()
    for (const banned of ['hand-off', 'handoff', 'wph1', 'build:legacy', 'dist-legacy']) {
      expect(lower, `forbidden wording: ${banned}`).not.toContain(banned)
    }
  })
})
