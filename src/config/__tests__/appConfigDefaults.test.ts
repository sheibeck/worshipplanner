import { describe, it, expect } from 'vitest'
import { DEFAULT_APP_CONFIG, mergeAppConfig, isExplicitlySet } from '../appConfigDefaults'

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

  describe('drift guard — DEFAULT_APP_CONFIG snapshot', () => {
    // Hard-coded against functions/src/appConfig.ts's DEFAULT_APP_CONFIG
    // (verified 2026-08-20). If this test fails, either this file's mirror
    // or the functions/ source was changed without updating the other —
    // see 70-RESEARCH.md Pitfall 2.
    it('matches the known-current default values', () => {
      expect(DEFAULT_APP_CONFIG).toEqual({
        cleanup: {
          mediaEnabled: false,
          pptxRenderEnabled: false,
          backgroundEnabled: false,
          pptxSourceEnabled: false,
        },
        retention: {
          mediaDays: 30,
          orphanRenderStaleHours: 24,
          backgroundDays: 30,
          pptxSourceDays: 30,
        },
        deleteCapPerRun: 500,
        aiProxy: {
          rateLimitPerMin: 20,
          rateLimitPerDay: 500,
          allowedModels: ['claude-haiku-4-5-20251001'],
          maxTokensCeiling: 2048,
        },
        messaging: {
          scheduledCronEnabled: false,
          maxRecipients: 200,
          orgDailyEmailQuota: 1000,
        },
        sender: {
          fromName: '',
          fromAddress: 'onboarding@resend.dev',
        },
      })
    })
  })
})
