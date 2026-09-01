import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── firebase/firestore mock (copied in shape from SettingsView.test.ts /
//    src/stores/__tests__/auth.test.ts) — this store's actual write call is
//    setDoc, not updateDoc, so mockSetDoc is hoisted for payload assertions.
//    onSnapshot's success/error callbacks are captured so the test can drive
//    them directly without a component mount. ──
const { mockSetDoc, mockOnSnapshot, mockServerTimestamp } = vi.hoisted(() => {
  return {
    mockSetDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>, _opts?: unknown) =>
      Promise.resolve(),
    ),
    mockOnSnapshot: vi.fn(
      (
        _ref: unknown,
        _onNext: (snap: unknown) => void,
        _onError: (err: unknown) => void,
      ) => () => {},
    ),
    mockServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP_SENTINEL'),
  }
})

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'appConfig/global' })),
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: mockServerTimestamp,
}))

vi.mock('@/firebase', () => ({
  db: {},
}))

let mockUserEmail: string | null = 'owner@example.com'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() {
      return { email: mockUserEmail }
    },
  }),
}))

import { useAppConfigStore } from './appConfig'
import { DEFAULT_APP_CONFIG, mergeAppConfig } from '@/config/appConfigDefaults'

describe('useAppConfigStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSetDoc.mockClear()
    mockOnSnapshot.mockClear()
    mockUserEmail = 'owner@example.com'
  })

  describe('subscribe', () => {
    it('resolves the config with the doc present, siblings still default', () => {
      const store = useAppConfigStore()
      store.subscribe()

      const [, onNext] = mockOnSnapshot.mock.calls[0] as [
        unknown,
        (snap: unknown) => void,
        (err: unknown) => void,
      ]
      onNext({
        exists: () => true,
        data: () => ({ retention: { mediaDays: 45 } }),
      })

      expect(store.rawDoc).toEqual({ retention: { mediaDays: 45 } })
      expect(store.resolvedConfig.retention.mediaDays).toBe(45)
      expect(store.resolvedConfig.retention.orphanRenderStaleHours).toBe(
        DEFAULT_APP_CONFIG.retention.orphanRenderStaleHours,
      )
      expect(store.loaded).toBe(true)
    })

    it('resolves rawDoc undefined and resolvedConfig to DEFAULT_APP_CONFIG when the doc does not exist', () => {
      const store = useAppConfigStore()
      store.subscribe()

      const [, onNext] = mockOnSnapshot.mock.calls[0] as [
        unknown,
        (snap: unknown) => void,
        (err: unknown) => void,
      ]
      onNext({ exists: () => false, data: () => null })

      expect(store.rawDoc).toBeUndefined()
      expect(store.resolvedConfig).toEqual(mergeAppConfig(undefined))
      expect(store.loaded).toBe(true)
    })

    it('sets loadError to a non-null string and loaded true on the error callback', () => {
      const store = useAppConfigStore()
      store.subscribe()

      const [, , onError] = mockOnSnapshot.mock.calls[0] as [
        unknown,
        (snap: unknown) => void,
        (err: unknown) => void,
      ]
      onError(new Error('permission-denied'))

      expect(store.loadError).not.toBeNull()
      expect(typeof store.loadError).toBe('string')
      expect(store.loaded).toBe(true)
    })
  })

  describe('saveField', () => {
    it('calls setDoc exactly once with the nested-object payload, email, serverTimestamp, and merge:true', async () => {
      const store = useAppConfigStore()
      await store.saveField('retention.mediaDays', 45)

      expect(mockSetDoc).toHaveBeenCalledTimes(1)
      const [, payload, opts] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>, unknown]
      // saveField expands the dot-path into a NESTED object (buildNestedField) because
      // setDoc(...,{merge:true}) treats a dotted key as a literal field name, not a path
      // (only updateDoc interprets dots). See appConfig.ts saveField (bug fix 2026-08-31).
      expect(payload).toEqual({
        retention: { mediaDays: 45 },
        updatedBy: 'owner@example.com',
        updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      })
      expect(opts).toEqual({ merge: true })
    })

    it('writes updatedBy as "unknown" when the auth store has no email', async () => {
      mockUserEmail = null
      const store = useAppConfigStore()
      await store.saveField('deleteCapPerRun', 100)

      const [, payload] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>, unknown]
      expect(payload.updatedBy).toBe('unknown')
    })
  })
})
