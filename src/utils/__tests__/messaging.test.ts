import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEFAULT_ORG_SETTINGS } from '@/types/organization'

// Getter-mock precedent: src/utils/__tests__/claudeApi.test.ts's
// mockAiEnabled shape. A module-scope mutable variable read through a
// getter lets a test flip the toggle mid-suite without re-importing the
// module under test. Defaults to false to match
// DEFAULT_ORG_SETTINGS.messaging.enabled (R130's fail-closed default).
let mockMessagingEnabled = false
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    settings: {
      messaging: {
        get enabled() {
          return mockMessagingEnabled
        },
      },
    },
  }),
}))

afterEach(() => {
  mockMessagingEnabled = false
})

import { isMessagingEnabled } from '@/utils/messaging'

describe('DEFAULT_ORG_SETTINGS.messaging (R130)', () => {
  it('defaults enabled to false — the kill-switch fails closed for a fresh org', () => {
    expect(DEFAULT_ORG_SETTINGS.messaging.enabled).toBe(false)
  })

  it('defaults lockNotifyDefault and reminderEnabled to false (conservative opt-in)', () => {
    expect(DEFAULT_ORG_SETTINGS.messaging.lockNotifyDefault).toBe(false)
    expect(DEFAULT_ORG_SETTINGS.messaging.reminderEnabled).toBe(false)
  })

  it('defaults reminderDaysBefore to 7', () => {
    expect(DEFAULT_ORG_SETTINGS.messaging.reminderDaysBefore).toBe(7)
  })

  it('defaults timezone to America/Chicago', () => {
    expect(DEFAULT_ORG_SETTINGS.timezone).toBe('America/Chicago')
  })
})

describe('isMessagingEnabled (R130 — single choke point)', () => {
  it('returns true when the auth store settings.messaging.enabled is true', () => {
    mockMessagingEnabled = true
    expect(isMessagingEnabled()).toBe(true)
  })

  it('returns false when the auth store settings.messaging.enabled is false', () => {
    mockMessagingEnabled = false
    expect(isMessagingEnabled()).toBe(false)
  })
})
