import { describe, it, expect } from 'vitest'
import { DEFAULT_APP_CONFIG, mergeAppConfig, isExplicitlySet } from '../appConfigDefaults'
// WR-03: the drift-guard below imports functions/src/appConfig.ts's OWN
// DEFAULT_APP_CONFIG directly, rather than comparing against a second
// hand-typed literal in this file (which could only ever catch someone
// editing appConfigDefaults.ts alone — never the actual documented risk of
// functions/src/appConfig.ts drifting out from under this client mirror).
// functions/src/appConfig.ts's only external import
// (`import type { Firestore } from "firebase-admin/firestore"`) is a
// TYPE-ONLY import, erased at compile time by esbuild — confirmed
// empirically that this import resolves and runs clean under jsdom with no
// firebase-admin runtime code pulled in.
import { DEFAULT_APP_CONFIG as FUNCTIONS_DEFAULT_APP_CONFIG } from '../../../functions/src/appConfig'

describe('appConfigDefaults', () => {
  describe('mergeAppConfig', () => {
    it('deep-equals DEFAULT_APP_CONFIG when given undefined', () => {
      expect(mergeAppConfig(undefined)).toEqual(DEFAULT_APP_CONFIG)
    })

    it('sets an explicit leaf while preserving sibling defaults (per-group merge, not whole-object replacement)', () => {
      const resolved = mergeAppConfig({ cleanup: { mediaEnabled: true } })
      expect(resolved.cleanup.mediaEnabled).toBe(true)
      expect(resolved.cleanup.pptxRenderEnabled).toBe(false)
      expect(resolved.cleanup.backgroundEnabled).toBe(false)
      expect(resolved.cleanup.pptxSourceEnabled).toBe(false)
    })

    it('carries updatedBy/updatedAt through only when present in the raw doc', () => {
      const withoutProvenance = mergeAppConfig({ cleanup: { mediaEnabled: true } })
      expect(withoutProvenance.updatedBy).toBeUndefined()
      expect(withoutProvenance.updatedAt).toBeUndefined()

      const withProvenance = mergeAppConfig({
        updatedBy: 'owner@example.com',
        updatedAt: 'sentinel-timestamp',
      })
      expect(withProvenance.updatedBy).toBe('owner@example.com')
      expect(withProvenance.updatedAt).toBe('sentinel-timestamp')
    })

    it('falls back deleteCapPerRun to the default when absent', () => {
      expect(mergeAppConfig({}).deleteCapPerRun).toBe(500)
      expect(mergeAppConfig({ deleteCapPerRun: 100 }).deleteCapPerRun).toBe(100)
    })
  })

  describe('isExplicitlySet', () => {
    it('returns true when the nested leaf is present in the raw doc', () => {
      expect(isExplicitlySet({ retention: { mediaDays: 30 } }, 'retention.mediaDays')).toBe(true)
    })

    it('returns false when the raw doc is undefined', () => {
      expect(isExplicitlySet(undefined, 'retention.mediaDays')).toBe(false)
    })

    it('returns false when the raw doc is an empty object', () => {
      expect(isExplicitlySet({}, 'deleteCapPerRun')).toBe(false)
    })

    it('returns false when an intermediate segment is missing', () => {
      expect(isExplicitlySet({ cleanup: {} }, 'cleanup.mediaEnabled')).toBe(false)
    })

    it('returns false when a top-level scalar leaf is absent', () => {
      expect(isExplicitlySet({ cleanup: { mediaEnabled: true } }, 'deleteCapPerRun')).toBe(false)
    })

    it('returns true for a present top-level scalar leaf, even value 0', () => {
      expect(isExplicitlySet({ deleteCapPerRun: 0 }, 'deleteCapPerRun')).toBe(true)
    })
  })

  describe('drift guard — DEFAULT_APP_CONFIG cross-check against functions/src/appConfig.ts', () => {
    // This is a REAL cross-file guard (WR-03 fix), not a same-file
    // regression guard against a second hand-typed literal (the prior
    // version of this test). It will fail if EITHER file's
    // DEFAULT_APP_CONFIG values change without a matching change in the
    // other — e.g. someone bumps functions/src/appConfig.ts's
    // rateLimitPerDay and forgets this file exists, or edits this file's
    // mirror alone.
    //
    // What this test DOES catch: any values-level mismatch between the two
    // DEFAULT_APP_CONFIG constants.
    //
    // What this test does NOT catch: a shape/interface drift (a field
    // renamed/added/removed in one file's AppConfig type but not the
    // other) that happens not to produce a values-level mismatch on this
    // particular run — e.g. a brand-new optional field added to only one
    // side with no default asserted elsewhere. That class of drift is
    // TypeScript's job (a genuinely new required field would fail to
    // type-check at its call sites), not this runtime equality check's.
    it('matches functions/src/appConfig.ts DEFAULT_APP_CONFIG exactly', () => {
      expect(DEFAULT_APP_CONFIG).toEqual(FUNCTIONS_DEFAULT_APP_CONFIG)
    })
  })
})
