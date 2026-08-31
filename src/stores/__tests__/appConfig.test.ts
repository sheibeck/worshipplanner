/**
 * Regression guard for the appConfig store's saveField write shape.
 *
 * Bug (fixed 2026-08-31): saveField wrote `{ [dotPath]: value }` via
 * setDoc(..., {merge:true}). setDoc treats a dotted KEY as a LITERAL field name
 * (only updateDoc interprets dots as nesting), so `onboarding.emailsEnabled`
 * was persisted as a flat field literally named "onboarding.emailsEnabled" that
 * mergeAppConfig (reading the nested key) never saw — every Owner Console toggle
 * silently failed to persist. saveField now expands the dot-path into a nested
 * object so the value round-trips.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSetDoc = vi.fn((..._args: unknown[]) => Promise.resolve())
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  onSnapshot: vi.fn(() => () => {}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => '__ts__'),
}))
vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { email: 'owner@example.com' } }),
}))
vi.mock('@/utils/firestoreListener', () => ({ isPermissionDenied: () => false }))

import { useAppConfigStore } from '@/stores/appConfig'
import { mergeAppConfig } from '@/config/appConfigDefaults'

describe('appConfig store — saveField', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSetDoc.mockClear()
  })

  it('writes a NESTED object for a dotted path (not a literal dotted key)', async () => {
    const store = useAppConfigStore()
    await store.saveField('onboarding.emailsEnabled', true)

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [, data, options] = mockSetDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown]
    // The bug wrote a flat "onboarding.emailsEnabled" key; the fix writes nested.
    expect(data).not.toHaveProperty(['onboarding.emailsEnabled'])
    expect(data.onboarding).toEqual({ emailsEnabled: true })
    expect(data.updatedBy).toBe('owner@example.com')
    expect(options).toEqual({ merge: true })
  })

  it('round-trips through mergeAppConfig — the written value reads back nested', async () => {
    const store = useAppConfigStore()
    await store.saveField('onboarding.emailsEnabled', true)
    const [, data] = mockSetDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown]

    // Simulate the doc coming back through the snapshot merge (strip provenance).
    const raw = { onboarding: data.onboarding as { emailsEnabled?: boolean } }
    expect(mergeAppConfig(raw).onboarding.emailsEnabled).toBe(true)
  })

  it('handles a single-segment path as a plain top-level field', async () => {
    const store = useAppConfigStore()
    await store.saveField('deleteCapPerRun', 250)
    const [, data] = mockSetDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown]
    expect(data.deleteCapPerRun).toBe(250)
  })
})
