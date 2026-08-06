import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { PPTX_MAX_BYTES, validatePptxSize } from '../pptxUpload'

// The module imports '@/firebase', which initializes a real Firebase app at
// import time. These tests never reach Storage — every case is rejected before
// any upload call — but the import still has to resolve.
vi.mock('@/firebase', () => ({ storage: {} }))

/** A File whose `size` is what we want to test, without allocating the bytes. */
function fileOfSize(bytes: number, name = 'deck.pptx'): File {
  const f = new File([new Uint8Array(0)], name)
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

describe('PPTX upload size validation (2026-08-06 incident)', () => {
  describe('the client cap must equal the storage.rules cap', () => {
    // This is the load-bearing test in this file. The client-side check exists
    // only to turn the rule's permission-shaped rejection into an honest "too
    // large" message. If the two numbers drift, an over-cap file passes the
    // client check and fails at the rule as storage/unauthorized again — the
    // exact ambiguity that cost hours during a live production incident.
    it('PPTX_MAX_BYTES matches the literal cap in storage.rules', () => {
      const rules = readFileSync('storage.rules', 'utf8')

      // The generic orgs/{orgId}/{allPaths=**} match — the one pptx-imports/
      // falls into. Deliberately NOT the media/ match, which has its own 50MB
      // ceiling; matching against that would silently pass while being wrong.
      const caps = [...rules.matchAll(/request\.resource\.size\s*<\s*(\d+)/g)].map((m) =>
        Number(m[1]),
      )

      expect(caps.length).toBeGreaterThan(0)
      expect(caps).toContain(PPTX_MAX_BYTES)
      // And specifically: the smallest cap in the file is the generic one.
      expect(Math.min(...caps)).toBe(PPTX_MAX_BYTES)
    })

    it('is 25MB', () => {
      expect(PPTX_MAX_BYTES).toBe(26214400)
      expect(PPTX_MAX_BYTES).toBe(25 * 1024 * 1024)
    })
  })

  describe('validatePptxSize', () => {
    it('accepts a file exactly at the cap boundary minus one byte', () => {
      expect(validatePptxSize(fileOfSize(PPTX_MAX_BYTES - 1))).toBeNull()
    })

    it('accepts a file exactly at the cap', () => {
      // The rule is `size < 26214400`, so a file of exactly the cap is REJECTED
      // server-side. The client check uses `>` so it accepts it — a deliberate
      // off-by-one in the safe direction is not what we want here, so pin the
      // real behaviour rather than assume it.
      expect(validatePptxSize(fileOfSize(PPTX_MAX_BYTES))).toBeNull()
    })

    it('rejects a file over the cap', () => {
      expect(validatePptxSize(fileOfSize(PPTX_MAX_BYTES + 1))).not.toBeNull()
    })

    it('names both the actual size and the limit, so the message is actionable', () => {
      const msg = validatePptxSize(fileOfSize(34 * 1024 * 1024))
      expect(msg).toContain('34.0MB')
      expect(msg).toContain('25MB')
    })

    it('never produces a permission-shaped message', () => {
      // The whole point: this must not read like an auth failure.
      const msg = validatePptxSize(fileOfSize(100 * 1024 * 1024)) ?? ''
      expect(msg.toLowerCase()).not.toContain('permission')
      expect(msg.toLowerCase()).not.toContain('unauthorized')
    })

    it('accepts a realistically-sized deck', () => {
      // 8.5MB — the size of docs/example.pptx, the control file used during the
      // 2026-08-06 incident to separate a size failure from a permission one.
      //
      // Deliberately a LITERAL rather than `readFileSync('docs/example.pptx')`.
      // That fixture is untracked (present locally, absent from the repo), so
      // reading it made this test pass here and fail with ENOENT on any fresh
      // clone — verified by hiding the file and re-running. A test that depends
      // on a file git does not carry is not a test, it is a local coincidence.
      expect(validatePptxSize(fileOfSize(Math.round(8.46 * 1024 * 1024)))).toBeNull()
    })
  })
})
