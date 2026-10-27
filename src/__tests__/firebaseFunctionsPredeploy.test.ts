import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Phase 144 WR-03: functions/lib is gitignored build output (package main: lib/index.js),
// so a functions deploy must rebuild it or it ships stale compiled code (e.g. old email copy).
describe('firebase.json functions predeploy (Phase 144 WR-03)', () => {
  it('builds functions before every functions deploy', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf-8')) as {
      functions: Array<{ source: string; predeploy?: string[] }>
    }
    const fn = config.functions.find((f) => f.source === 'functions')
    expect(fn?.predeploy).toContain('npm --prefix functions run build')
  })
})
