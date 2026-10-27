// R449 no old-origin URL literals in app/function code. See ADR-0247 (docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md)
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

// Old project id + .web.app / .firebaseapp.com host. Does not match the bare project id
// or the storage bucket host (worship-planner-bc515.firebasestorage.app).
const OLD_ORIGIN = /worship-planner-bc515\.(web\.app|firebaseapp\.com)/

function walk(dir: string): string[] {
  return readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).map(
    (p) => `${dir}/${p.replace(/\\/g, '/')}`,
  )
}

function isTestPath(p: string): boolean {
  return /\.(test|spec)\.ts$/.test(p) || /(^|\/)(__tests__|__fixtures__|__mocks__)\//.test(p)
}

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8')
}

const scanned: string[] = [
  'index.html',
  ...walk('src').filter((p) => /\.(ts|vue|html)$/.test(p) && !isTestPath(p)),
  ...walk('functions/src').filter((p) => p.endsWith('.ts') && !isTestPath(p)),
]

describe('old-origin URL literals (R449)', () => {
  it('no scanned app or function file contains an old-origin URL (comments included)', () => {
    const offenders = scanned.filter((f) => OLD_ORIGIN.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('scans a non-trivial file set and functions/src/params.ts carries the new default', () => {
    expect(scanned.length).toBeGreaterThan(50)
    expect(scanned).toContain('functions/src/params.ts')
    expect(read('functions/src/params.ts')).toContain('https://worshipbuilder.web.app')
  })

  it('detector self-test', () => {
    expect(OLD_ORIGIN.test('https://worship-planner-bc515.web.app/share/x')).toBe(true)
    expect(OLD_ORIGIN.test('worship-planner-bc515.firebaseapp.com')).toBe(true)
    expect(OLD_ORIGIN.test('worship-planner-bc515')).toBe(false)
    expect(OLD_ORIGIN.test('worship-planner-bc515.firebasestorage.app')).toBe(false)
  })
})
