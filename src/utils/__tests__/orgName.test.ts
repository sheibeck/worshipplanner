import { describe, it, expect, vi, beforeEach } from 'vitest'

// normalizeOrgName is pure. claimOrgName's create-only + own-org-idempotency
// logic is exercised here with mocked setDoc/getDoc; its end-to-end rule
// enforcement is covered by the emulator-backed rules test (orgNames block).
// Mock firebase/firestore + @/firebase so importing doesn't init a real app.
const { mockSetDoc, mockGetDoc } = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ col, id })),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))
vi.mock('@/firebase', () => ({ db: {} }))

import { normalizeOrgName, claimOrgName } from '@/utils/orgName'

describe('normalizeOrgName', () => {
  it('lowercases and collapses whitespace so case/spacing variants collide', () => {
    expect(normalizeOrgName('Grace Church')).toBe('grace church')
    expect(normalizeOrgName('  grace   church  ')).toBe('grace church')
    expect(normalizeOrgName('GRACE CHURCH')).toBe('grace church')
  })

  it('keeps distinct names distinct', () => {
    expect(normalizeOrgName('Grace Church')).not.toBe(normalizeOrgName('Grace Chapel'))
  })

  it('folds the Firestore-forbidden "/" character to a space (id-safe)', () => {
    expect(normalizeOrgName('St. John / First Baptist')).toBe('st. john first baptist')
    expect(normalizeOrgName('St. John / First Baptist')).not.toMatch(/\//)
  })

  it('falls back to the slug when the name has no usable id characters', () => {
    // Only dots → not a valid Firestore doc id ('.'/'..'); slug of '...' is ''.
    expect(normalizeOrgName('...')).toBe('')
    // A '/'-only name folds to spaces → empty → slug ('') too.
    expect(normalizeOrgName('/')).toBe('')
  })
})

describe('claimOrgName', () => {
  beforeEach(() => {
    mockSetDoc.mockReset()
    mockGetDoc.mockReset()
  })

  it('returns true when the create-only write succeeds (name free)', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined)
    await expect(claimOrgName('grace church', 'orgA')).resolves.toBe(true)
    expect(mockSetDoc).toHaveBeenCalledWith(expect.objectContaining({ col: 'orgNames', id: 'grace church' }), {
      orgId: 'orgA',
    })
  })

  it('returns false when another org already holds the name', async () => {
    mockSetDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ orgId: 'orgB' }) })
    await expect(claimOrgName('grace church', 'orgA')).resolves.toBe(false)
  })

  it('returns true idempotently when the existing claim is already OUR org', async () => {
    mockSetDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ orgId: 'orgA' }) })
    await expect(claimOrgName('grace church', 'orgA')).resolves.toBe(true)
  })

  it('treats an empty key as nothing to claim (true, no write)', async () => {
    await expect(claimOrgName('', 'orgA')).resolves.toBe(true)
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('rethrows a non-permission error', async () => {
    mockSetDoc.mockRejectedValueOnce({ code: 'unavailable' })
    await expect(claimOrgName('grace church', 'orgA')).rejects.toEqual({ code: 'unavailable' })
  })
})
