// R450 bucket CORS origins. See ADR-0247 (docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md)
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface CorsRule {
  origin: string[]
  method: string[]
  responseHeader: string[]
  maxAgeSeconds: number
}

const rules = JSON.parse(readFileSync(resolve(process.cwd(), 'storage-cors.json'), 'utf8')) as CorsRule[]

const EXPECTED_ORIGINS = [
  'https://worshipbuilder.web.app',
  'https://worshipbuilder.firebaseapp.com',
  'https://worship-planner-bc515.web.app',
  'https://worship-planner-bc515.firebaseapp.com',
  'http://localhost:5173',
]

describe('storage-cors.json (R450)', () => {
  it('has exactly one rule', () => {
    expect(Array.isArray(rules)).toBe(true)
    expect(rules).toHaveLength(1)
  })

  it('origin set is exactly the new, old and localhost origins (old ones kept)', () => {
    const origins = rules[0]!.origin
    expect(new Set(origins)).toEqual(new Set(EXPECTED_ORIGINS))
    expect(origins).toHaveLength(EXPECTED_ORIGINS.length)
  })

  it('no wildcard, blank, path or trailing-slash origin', () => {
    for (const o of rules[0]!.origin) {
      expect(o).not.toBe('*')
      expect(o.trim()).not.toBe('')
      expect(o).toMatch(/^https?:\/\/[^/\s*]+$/)
    }
  })

  it('methods, headers and max age are unchanged', () => {
    expect(rules[0]!.method).toEqual(['GET', 'HEAD'])
    expect(rules[0]!.responseHeader).toEqual([
      'Content-Type',
      'Content-Disposition',
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'Date',
      'ETag',
    ])
    expect(rules[0]!.maxAgeSeconds).toBe(3600)
  })
})
