import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth, mockGetIdToken, mockUseAuthStore } = vi.hoisted(() => {
  const mockGetIdToken = vi.fn()
  return {
    mockGetIdToken,
    mockAuth: { currentUser: null as null | { getIdToken: typeof mockGetIdToken } },
    mockUseAuthStore: vi.fn(),
  }
})

vi.mock('@/firebase', () => ({ auth: mockAuth }))
vi.mock('@/stores/auth', () => ({ useAuthStore: (...args: unknown[]) => mockUseAuthStore(...args) }))

import { getAppAuthHeaders } from '@/utils/appAuth'

describe('getAppAuthHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.currentUser = null
    mockGetIdToken.mockResolvedValue('tok-123')
    mockUseAuthStore.mockReturnValue({ orgId: 'orgB' })
  })

  it('returns an empty object when no user is signed in', async () => {
    mockAuth.currentUser = null
    expect(await getAppAuthHeaders()).toEqual({})
  })

  it('includes X-App-Auth and the active org (X-Org-Id)', async () => {
    mockAuth.currentUser = { getIdToken: mockGetIdToken }
    mockUseAuthStore.mockReturnValue({ orgId: 'orgB' })
    expect(await getAppAuthHeaders()).toEqual({ 'X-App-Auth': 'tok-123', 'X-Org-Id': 'orgB' })
  })

  it('omits X-Org-Id when there is no active org', async () => {
    mockAuth.currentUser = { getIdToken: mockGetIdToken }
    mockUseAuthStore.mockReturnValue({ orgId: null })
    expect(await getAppAuthHeaders()).toEqual({ 'X-App-Auth': 'tok-123' })
  })

  it('still returns X-App-Auth when the store is unavailable (Pinia not active)', async () => {
    mockAuth.currentUser = { getIdToken: mockGetIdToken }
    mockUseAuthStore.mockImplementation(() => {
      throw new Error('no active pinia')
    })
    expect(await getAppAuthHeaders()).toEqual({ 'X-App-Auth': 'tok-123' })
  })
})
