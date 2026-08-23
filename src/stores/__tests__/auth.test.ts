import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

// Mock firebase/auth module
vi.mock('firebase/auth', () => {
  const mockOnAuthStateChangedCallbacks: ((user: unknown) => void)[] = []

  class MockGoogleAuthProvider {
    providerId = 'google.com'
  }

  return {
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: MockGoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signOut: vi.fn(),
    // 40-03 (R075/P-01) — the forced-refresh mechanism under test. Default
    // resolves with no claims at all, matching a token that predates the
    // rollout; individual tests override this to drive the retry.
    getIdTokenResult: vi.fn(() => Promise.resolve({ claims: {} })),
    onAuthStateChanged: vi.fn((auth, callback) => {
      mockOnAuthStateChangedCallbacks.push(callback)
      // Store reference for tests to call
      ;(globalThis as Record<string, unknown>).__authCallbacks = mockOnAuthStateChangedCallbacks
      // Return unsubscribe function
      return () => {}
    }),
  }
})

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => false,
      data: () => null,
    }),
  ),
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => new Date()),
}))

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

// CR-01 (46-REVIEW.md) — loadOrgContext eager-loads the org's chosen slide
// font. Only `loadFontCss` is mocked/asserted on directly; `snapWeight`/
// `SLIDE_FONTS` stay real so the family/weight resolution under test is the
// actual logic, not a stand-in for it.
vi.mock('@/utils/slideTypography', async () => {
  const actual = await vi.importActual<typeof import('@/utils/slideTypography')>(
    '@/utils/slideTypography',
  )
  return {
    ...actual,
    loadFontCss: vi.fn().mockResolvedValue(undefined),
  }
})

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  getIdTokenResult,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { DEFAULT_ORG_SETTINGS } from '@/types/organization'
import { loadFontCss } from '@/utils/slideTypography'

const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
}

// 40-03 (R075/P-01) discovered defect: the `firebase/auth` mock factory's
// mockOnAuthStateChangedCallbacks array is created once per test FILE (the
// vi.mock factory runs once), and every useAuthStore() call across every
// test pushes a new callback into it -- clearAllMocks() resets call counts
// but never shrinks this array. Only invoking the LATEST registration (this
// test file's current store instance) keeps behavior identical for every
// existing assertion while fixing a leak that would otherwise silently
// re-invoke every prior test's callback and inflate call-count assertions
// like getIdTokenResult's (see "org claim refresh (R075 / P-01)" below).
async function triggerAuthStateChange(user: unknown) {
  const callbacks = (globalThis as Record<string, unknown>).__authCallbacks as
    | ((user: unknown) => void | Promise<void>)[]
    | undefined
  if (callbacks && callbacks.length > 0) {
    await callbacks[callbacks.length - 1]?.(user)
  }
}

/** Path-aware doc()/getDoc() mock setup for loadOrgContext coverage. */
function mockOrgDocPath(orgData: Record<string, unknown> | null) {
  vi.mocked(doc).mockImplementation(
    (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
  )
  vi.mocked(getDoc).mockImplementation((ref: unknown) => {
    const path = (ref as { path?: string }).path
    if (path === 'users/test-uid') {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ orgIds: ['org-1'] }),
      }) as never
    }
    if (path === 'organizations/org-1') {
      return Promise.resolve({
        exists: () => orgData !== null,
        data: () => orgData,
      }) as never
    }
    return Promise.resolve({ exists: () => false, data: () => null }) as never
  })
}

/**
 * 40-03 (R075/P-01) — same shape as mockOrgDocPath, plus an invite waiting at
 * inviteLookup/test@example.com for org-1. Drives ensureUserDocument's
 * invite-acceptance path, which is what actually reports membershipCreated
 * true and exercises the just-joined retry in loadOrgContext.
 */
function mockOrgDocPathWithInvite(orgData: Record<string, unknown> | null) {
  vi.mocked(doc).mockImplementation(
    (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
  )
  vi.mocked(getDoc).mockImplementation((ref: unknown) => {
    const path = (ref as { path?: string }).path
    if (path === 'users/test-uid') {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ orgIds: ['org-1'] }),
      }) as never
    }
    if (path === 'organizations/org-1') {
      return Promise.resolve({
        exists: () => orgData !== null,
        data: () => orgData,
      }) as never
    }
    if (path === 'inviteLookup/test@example.com') {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ orgId: 'org-1', role: 'editor' }),
      }) as never
    }
    return Promise.resolve({ exists: () => false, data: () => null }) as never
  })
}

/**
 * v2.0 — a user who belongs to more than one org (orgIds: ['org-1','org-2']).
 * Drives loadOrgContext's church-picker population + the org-selection gate.
 */
function mockMultiOrg() {
  vi.mocked(doc).mockImplementation(
    (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
  )
  vi.mocked(getDoc).mockImplementation((ref: unknown) => {
    const path = (ref as { path?: string }).path
    if (path === 'users/test-uid') {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ orgIds: ['org-1', 'org-2'] }),
      }) as never
    }
    if (path === 'organizations/org-1') {
      return Promise.resolve({ exists: () => true, data: () => ({ name: 'Org One' }) }) as never
    }
    if (path === 'organizations/org-2') {
      return Promise.resolve({ exists: () => true, data: () => ({ name: 'Org Two' }) }) as never
    }
    return Promise.resolve({ exists: () => false, data: () => null }) as never
  })
}

/** v2.0 — a signed-in user who belongs to NO organization (orgIds: []). */
function mockNoOrg() {
  vi.mocked(doc).mockImplementation(
    (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
  )
  vi.mocked(getDoc).mockImplementation((ref: unknown) => {
    const path = (ref as { path?: string }).path
    if (path === 'users/test-uid') {
      return Promise.resolve({ exists: () => true, data: () => ({ orgIds: [] }) }) as never
    }
    return Promise.resolve({ exists: () => false, data: () => null }) as never
  })
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset auth callbacks
    ;(globalThis as Record<string, unknown>).__authCallbacks = []
    // v2.0 — the church choice is remembered in sessionStorage; clear between
    // tests so a prior selection never leaks into the next.
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom may not expose sessionStorage in every config */
    }
  })

  describe('initial state', () => {
    it('starts with user as null', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('starts with isReady as false', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.isReady).toBe(false)
    })

    it('isAuthenticated is false when user is null', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('isReady', () => {
    it('becomes true after onAuthStateChanged fires', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.isReady).toBe(false)
      triggerAuthStateChange(null)
      expect(store.isReady).toBe(true)
    })

    it('isAuthenticated becomes true when user is set via onAuthStateChanged', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      triggerAuthStateChange(mockUser)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('loginWithGoogle', () => {
    it('calls signInWithPopup with GoogleAuthProvider', async () => {
      vi.mocked(signInWithPopup).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof signInWithPopup> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.loginWithGoogle()
      expect(signInWithPopup).toHaveBeenCalledOnce()
    })

    it('returns user on success', async () => {
      vi.mocked(signInWithPopup).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof signInWithPopup> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.loginWithGoogle()
      expect(result).toEqual(mockUser)
    })

    it('returns null when popup is closed by user', async () => {
      vi.mocked(signInWithPopup).mockRejectedValueOnce({
        code: 'auth/popup-closed-by-user',
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.loginWithGoogle()
      expect(result).toBeNull()
    })
  })

  describe('loginWithEmail', () => {
    it('calls signInWithEmailAndPassword with correct args', async () => {
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof signInWithEmailAndPassword> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.loginWithEmail('test@example.com', 'password123')
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123',
      )
    })

    it('auto-creates account on auth/user-not-found', async () => {
      vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({
        code: 'auth/user-not-found',
      })
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof createUserWithEmailAndPassword> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.loginWithEmail('new@example.com', 'password123')
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'password123',
      )
    })

    it('also auto-creates account on auth/invalid-credential', async () => {
      vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce({
        code: 'auth/invalid-credential',
      })
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof createUserWithEmailAndPassword> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.loginWithEmail('new@example.com', 'password123')
      expect(createUserWithEmailAndPassword).toHaveBeenCalled()
    })
  })

  describe('registerWithEmail', () => {
    it('calls createUserWithEmailAndPassword directly', async () => {
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof createUserWithEmailAndPassword> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.registerWithEmail('new@example.com', 'password123')
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'password123',
      )
    })
  })

  describe('resetPassword', () => {
    it('calls sendPasswordResetEmail with provided email', async () => {
      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.resetPassword('test@example.com')
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'test@example.com')
    })
  })

  describe('logout', () => {
    it('calls signOut', async () => {
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.logout()
      expect(signOut).toHaveBeenCalledOnce()
    })

    it('user becomes null after logout', async () => {
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      // Set user first
      triggerAuthStateChange(mockUser)
      expect(store.user).toEqual(mockUser)
      // Logout
      await store.logout()
      triggerAuthStateChange(null)
      expect(store.user).toBeNull()
    })
  })

  describe('ensureUserDocument', () => {
    it('creates user document after login', async () => {
      const { setDoc } = await import('firebase/firestore')
      vi.mocked(signInWithPopup).mockResolvedValueOnce({
        user: mockUser,
      } as ReturnType<typeof signInWithPopup> extends Promise<infer T> ? T : never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.loginWithGoogle()
      expect(setDoc).toHaveBeenCalled()
    })

    // v2.0 — signing in must NEVER auto-provision an organization. Orgs are
    // created only by a super-admin via onboardOrganization. An un-invited user
    // gets no org and no writeBatch (which the removed auto-create path used).
    it('does NOT auto-create an organization for an un-invited user', async () => {
      const { writeBatch } = await import('firebase/firestore')
      mockOrgDocPath({ name: 'Test Org' }) // no inviteLookup entry → no invite
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.ensureUserDocument(mockUser as never)
      expect(result).toEqual({ membershipCreated: false })
      expect(writeBatch).not.toHaveBeenCalled()
    })

    // v2.0 — a pending invite is now the ONLY way login grants membership.
    it('consumes a pending invite and joins the invited org', async () => {
      const { writeBatch } = await import('firebase/firestore')
      mockOrgDocPathWithInvite({ name: 'Org One' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.ensureUserDocument(mockUser as never)
      expect(result).toEqual({ membershipCreated: true })
      expect(writeBatch).toHaveBeenCalled()
    })
  })

  // v2.0 — multi-church login picker + org-selection gate state.
  describe('multi-org selection', () => {
    it('a user in multiple orgs must pick one — memberships populated, no active org yet', async () => {
      mockMultiOrg()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-1', name: 'Org One', active: true },
        { id: 'org-2', name: 'Org Two', active: true },
      ])
      expect(store.orgId).toBeNull()
      expect(store.needsOrgSelection).toBe(true)
      expect(store.requiresOrgSelection).toBe(true)
    })

    it('selectOrg activates the chosen org and clears the selection requirement', async () => {
      mockMultiOrg()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      await store.selectOrg('org-2')
      expect(store.orgId).toBe('org-2')
      expect(store.orgName).toBe('Org Two')
      expect(store.needsOrgSelection).toBe(false)
      expect(store.requiresOrgSelection).toBe(false)
    })

    it('selectOrg ignores an org the user does not belong to', async () => {
      mockMultiOrg()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      await store.selectOrg('org-not-mine')
      expect(store.orgId).toBeNull()
      expect(store.needsOrgSelection).toBe(true)
    })

    it('a single-org user goes straight in (no selection required)', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.orgId).toBe('org-1')
      expect(store.needsOrgSelection).toBe(false)
      expect(store.requiresOrgSelection).toBe(false)
    })

    it('hasNoOrg is true when the user belongs to no organization', async () => {
      mockNoOrg()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([])
      expect(store.orgId).toBeNull()
      expect(store.hasNoOrg).toBe(true)
      expect(store.requiresOrgSelection).toBe(true)
    })

    // v2.0 — an org whose name can't be read (orphaned id / denied read) must
    // fall back to its id in the picker, never blank or break the whole list.
    it('falls back to the org id when an org name cannot be read', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: ['org-1', 'org-2'] }),
          }) as never
        }
        if (path === 'organizations/org-1') {
          return Promise.resolve({ exists: () => true, data: () => ({ name: 'Org One' }) }) as never
        }
        if (path === 'organizations/org-2') {
          return Promise.reject(new Error('permission-denied')) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-1', name: 'Org One', active: true },
        { id: 'org-2', name: 'org-2', active: false },
      ])
      expect(store.needsOrgSelection).toBe(true)
    })
  })

  // ── 76-02 (R213) ─────────────────────────────────────────────────────────
  // Client login-block: once 76-01-PLAN.md's firestore.rules ship, a
  // deactivated org's own (non-super-admin) member has the org-doc read
  // DENIED (rejects) rather than handed back `{active:false}` data. These
  // tests simulate that rejection directly, mirroring the "falls back to the
  // org id" fixture pattern above.
  describe('deactivated org login-block (R213, Phase 76)', () => {
    /** A single-org user whose sole org's doc read REJECTS (simulated deactivation). */
    function mockSingleOrgDeactivated() {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: ['org-1'] }),
          }) as never
        }
        if (path === 'organizations/org-1') {
          return Promise.reject(new Error('permission-denied')) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
    }

    /**
     * A multi-org user where org-1's doc read REJECTS (deactivated) and
     * org-2's succeeds (active) — drives selectOrg between the two.
     */
    function mockMultiOrgWithDeactivation() {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: ['org-1', 'org-2'] }),
          }) as never
        }
        if (path === 'organizations/org-1') {
          return Promise.reject(new Error('permission-denied')) as never
        }
        if (path === 'organizations/org-2') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ name: 'Org Two', active: true }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
    }

    it('a single-org user whose org-doc read is denied ends with orgId null and deactivatedOrgMessage set', async () => {
      mockSingleOrgDeactivated()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.orgId).toBeNull()
      expect(store.deactivatedOrgMessage).toBe(
        'This church is deactivated — contact your administrator.',
      )
    })

    it('resets every other org-context field to its no-org default on a denied org-doc read', async () => {
      mockSingleOrgDeactivated()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.orgName).toBeNull()
      expect(store.orgSlug).toBeNull()
      expect(store.userRole).toBeNull()
      expect(store.pcAppId).toBeNull()
      expect(store.pcSecret).toBeNull()
      expect(store.vwModeEnabled).toBe(true)
      expect(store.settings).toEqual(DEFAULT_ORG_SETTINGS)
    })

    it('requiresOrgSelection is true for the single-org-deactivated case even though memberships.length === 1', async () => {
      mockSingleOrgDeactivated()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships.length).toBe(1)
      expect(store.needsOrgSelection).toBe(false)
      expect(store.hasNoOrg).toBe(false)
      expect(store.requiresOrgSelection).toBe(true)
    })

    it('a multi-org user with one deactivated org gets {active:false} for it and {active:true} for the active one', async () => {
      mockMultiOrgWithDeactivation()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-1', name: 'org-1', active: false },
        { id: 'org-2', name: 'Org Two', active: true },
      ])
    })

    it('deactivatedOrgMessage clears to null after selectOrg successfully switches to a different, active org', async () => {
      mockMultiOrgWithDeactivation()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)

      await store.selectOrg('org-1')
      expect(store.orgId).toBeNull()
      expect(store.deactivatedOrgMessage).toBe(
        'This church is deactivated — contact your administrator.',
      )

      await store.selectOrg('org-2')
      expect(store.orgId).toBe('org-2')
      expect(store.deactivatedOrgMessage).toBeNull()
    })

    it('a super-admin whose own read of a deactivated org succeeds is NOT blocked', async () => {
      mockOrgDocPath({ name: 'Test Org', active: false })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgId: 'org-1', superAdmin: true },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
      expect(store.deactivatedOrgMessage).toBeNull()
    })

    it('(defensive layer) treats a successfully-read active:false org as deactivated for a non-super-admin', async () => {
      mockOrgDocPath({ name: 'Test Org', active: false })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.orgId).toBeNull()
      expect(store.deactivatedOrgMessage).toBe(
        'This church is deactivated — contact your administrator.',
      )
    })

    it('resets deactivatedOrgMessage to null on logout', async () => {
      mockSingleOrgDeactivated()
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.deactivatedOrgMessage).not.toBeNull()

      await store.logout()
      expect(store.deactivatedOrgMessage).toBeNull()
    })

    it('resets deactivatedOrgMessage to null on a sign-out onAuthStateChanged event', async () => {
      mockSingleOrgDeactivated()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.deactivatedOrgMessage).not.toBeNull()

      await triggerAuthStateChange(null)
      expect(store.deactivatedOrgMessage).toBeNull()
    })
  })

  describe('vwModeEnabled (D-15/D-16)', () => {
    it('defaults to true after loadOrgContext when the org doc has no vwModeEnabled field', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.vwModeEnabled).toBe(true)
    })

    it('reflects an explicit false vwModeEnabled field on the org doc', async () => {
      mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.vwModeEnabled).toBe(false)
    })

    it('resets to true on logout', async () => {
      mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false })
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.vwModeEnabled).toBe(false)

      await store.logout()
      expect(store.vwModeEnabled).toBe(true)
    })

    // R073 regression: this is the case CLAUDE.md/39-CONTEXT.md call out as the
    // single most important test in the phase. A naive `settings?.vwModeEnabled
    // ?? true` (dropping the flat-field fallback) would silently flip a
    // deliberately-off church's Vertical Worship setting back ON, with no error
    // and no other failing test. This org document has NO `settings` key at
    // all — only the legacy flat field — so the dual-read must fall through to
    // it rather than landing on the hardcoded `true` default.
    //
    // Both `store.vwModeEnabled` (the standalone ref) AND
    // `store.settings.vwModeEnabled` (the typed OrgSettings object) must
    // agree — CR-01: a prior defaults-merge bug computed these two values
    // independently, so the standalone ref resolved correctly while
    // `settings.vwModeEnabled` silently fell through to the hardcoded
    // `DEFAULT_ORG_SETTINGS.vwModeEnabled` (`true`), re-enabling Vertical
    // Worship for any consumer reading the canonical `settings` object.
    it('keeps a flat vwModeEnabled false when there is no settings key', async () => {
      mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.vwModeEnabled).toBe(false)
      expect(store.settings.vwModeEnabled).toBe(false)
    })
  })

  describe('OrgSettings (R073)', () => {
    it('resolves full OrgSettings from defaults when the org document has no settings key', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings).toEqual(DEFAULT_ORG_SETTINGS)
      expect(store.vwModeEnabled).toBe(true)
    })

    it('resolves an absent key to its default when settings is partially populated', async () => {
      mockOrgDocPath({ name: 'Test Org', settings: { aiEnabled: false } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.aiEnabled).toBe(false)
      expect(store.settings.pcEnabled).toBe(true)
      expect(store.settings.vwModeEnabled).toBe(true)
    })

    it('prefers a nested settings value over the flat legacy field', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        settings: { vwModeEnabled: true },
        vwModeEnabled: false,
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.vwModeEnabled).toBe(true)
    })

    it('does not write to Firestore while loading an org document that lacks settings', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('resets settings to defaults when the user belongs to no organization', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: [] }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings).toEqual(DEFAULT_ORG_SETTINGS)
    })

    it('resets settings to defaults on logout', async () => {
      mockOrgDocPath({ name: 'Test Org', settings: { aiEnabled: false, pcEnabled: false } })
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.aiEnabled).toBe(false)

      await store.logout()
      expect(store.settings).toEqual(DEFAULT_ORG_SETTINGS)
    })

    // WR-01 (46-REVIEW.md): `slideTypography` must be deep-merged, not
    // shallow-replaced — a partial stored value (hand-edited Firestore
    // document, or any future write path that persists fewer than all
    // three leaf keys) must still resolve its missing sibling fields to
    // their per-field defaults, never `undefined`.
    it('deep-merges a partial stored slideTypography — missing leaf fields fall back to their own defaults', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        settings: { slideTypography: { fontFamily: 'Poppins' } },
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.slideTypography).toEqual({
        fontFamily: 'Poppins',
        fontWeight: DEFAULT_ORG_SETTINGS.slideTypography.fontWeight,
        fontScale: DEFAULT_ORG_SETTINGS.slideTypography.fontScale,
      })
    })
  })

  // R130/R132/R133 (Phase 58) — messaging must be deep-merged the same way
  // slideTypography is above; timezone is a flat field covered by the outer
  // spread.
  describe('OrgSettings.messaging + timezone (R130/R132/R133, Phase 58)', () => {
    it('deep-merges a partial stored messaging object — unset leaves fall back to their own defaults', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        settings: { messaging: { enabled: true } },
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.messaging.enabled).toBe(true)
      expect(store.settings.messaging.reminderDaysBefore).toBe(7)
      expect(store.settings.messaging.lockNotifyDefault).toBe(false)
    })

    it('resolves the full DEFAULT_ORG_SETTINGS.messaging when the org doc has no messaging key at all', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.messaging).toEqual(DEFAULT_ORG_SETTINGS.messaging)
      expect(store.settings.messaging.enabled).toBe(false)
    })

    it('prefers a stored timezone over the default', async () => {
      mockOrgDocPath({ name: 'Test Org', settings: { timezone: 'America/New_York' } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.timezone).toBe('America/New_York')
    })

    it('resolves timezone to America/Chicago when the org doc omits it', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.timezone).toBe('America/Chicago')
    })
  })

  describe('OrgSettings.bibleVersion (R090)', () => {
    // The DEFAULT constant itself — the owner's locked override (45-CONTEXT.md
    // § Area 1) is NLT, NOT the "preserve current behavior" ESV default.
    it('DEFAULT_ORG_SETTINGS.bibleVersion is NLT (owner override, not ESV)', () => {
      expect(DEFAULT_ORG_SETTINGS.bibleVersion).toBe('NLT')
    })

    // Default resolution: an org whose stored settings omit bibleVersion
    // entirely resolves to NLT through the existing `...DEFAULT_ORG_SETTINGS`
    // spread — no second merge point needed.
    it('resolves bibleVersion to NLT for an org that has never configured it', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.bibleVersion).toBe('NLT')
    })

    // Stored-value-wins: an org that has already chosen ESV must not be
    // silently switched to the new NLT default by this phase.
    it('prefers a stored ESV bibleVersion over the NLT default', async () => {
      mockOrgDocPath({ name: 'Test Org', settings: { bibleVersion: 'ESV' } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.bibleVersion).toBe('ESV')
    })
  })

  // CR-01 (46-REVIEW.md) — loadOrgContext must eager-load the org's actual
  // chosen slide face, not just resolve the settings object, so the Slides
  // grid and Edit Slide drawer (soft-gate surfaces) don't silently fall
  // back to a system font before Settings or the Presenter has had a
  // chance to load it in the current session.
  describe('OrgSettings.slideTypography font eager-load (R093, CR-01)', () => {
    it('does not call loadFontCss for the default Inter family — it is already eager-imported in main.ts', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.settings.slideTypography.fontFamily).toBe('Inter')
      expect(loadFontCss).not.toHaveBeenCalled()
    })

    it('calls loadFontCss with the resolved family/weight for a non-default stored family', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        settings: { slideTypography: { fontFamily: 'Lora', fontWeight: 600, fontScale: 'md' } },
      })
      const { useAuthStore } = await import('../auth')
      useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(loadFontCss).toHaveBeenCalledWith('Lora', 600)
    })

    it('snaps an unreachable stored weight to 400 before calling loadFontCss', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        // Lora does not ship 300 (46-01-SUMMARY.md's corrected ramp).
        settings: { slideTypography: { fontFamily: 'Lora', fontWeight: 300, fontScale: 'md' } },
      })
      const { useAuthStore } = await import('../auth')
      useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(loadFontCss).toHaveBeenCalledWith('Lora', 400)
    })

    it('does not call loadFontCss when the user belongs to no organization', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({ exists: () => true, data: () => ({ orgIds: [] }) }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(loadFontCss).not.toHaveBeenCalled()
    })
  })

  // ── 40-03 (R075/P-01) ─────────────────────────────────────────────────────────
  // Forced claim refresh on every org-context load, bounded retry scoped to the
  // just-created-membership path only. Call-count assertions are the point: a
  // naive unconditional retry would pass a test that only checked "a refresh
  // happened", so every case below asserts exactly how many times
  // getIdTokenResult fired.
  describe('org claim refresh (R075 / P-01)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('performs the forced refresh exactly once on the ordinary (already-a-member) load, with no delay', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(getIdTokenResult).toHaveBeenCalledTimes(1)
      expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, true)
      expect(store.orgId).toBe('org-1')
    })

    it('performs no forced refresh when the user belongs to no organization', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: [] }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(getIdTokenResult).not.toHaveBeenCalled()
      expect(store.orgId).toBeNull()
    })

    it('just-joined, claim present on the first refresh: exactly one refresh, no delay', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: { orgId: 'org-1' } } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(getIdTokenResult).toHaveBeenCalledTimes(1)
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
    })

    it('just-joined, claim absent then present on the third attempt: three refreshes, two delays, then stops', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: { orgId: 'org-1' } } as never)
      const { useAuthStore, CLAIM_REFRESH_DELAY_MS } = await import('../auth')
      const store = useAuthStore()

      const authChangePromise = triggerAuthStateChange(mockUser)
      await vi.advanceTimersByTimeAsync(CLAIM_REFRESH_DELAY_MS * 2)
      await authChangePromise

      expect(getIdTokenResult).toHaveBeenCalledTimes(3)
      expect(store.orgId).toBe('org-1')
    })

    it('just-joined, claim never arrives: exactly CLAIM_REFRESH_MAX_ATTEMPTS refreshes, then gives up silently', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValue({ claims: {} } as never)
      const { useAuthStore, CLAIM_REFRESH_MAX_ATTEMPTS, CLAIM_REFRESH_DELAY_MS } =
        await import('../auth')
      const store = useAuthStore()

      const authChangePromise = triggerAuthStateChange(mockUser)
      await vi.advanceTimersByTimeAsync(CLAIM_REFRESH_DELAY_MS * (CLAIM_REFRESH_MAX_ATTEMPTS - 1))
      await authChangePromise

      expect(getIdTokenResult).toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS)
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
    })

    it('just-joined, claim present but for a different org: the retry continues rather than stopping', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValue({ claims: { orgId: 'some-other-org' } } as never)
      const { useAuthStore, CLAIM_REFRESH_MAX_ATTEMPTS, CLAIM_REFRESH_DELAY_MS } =
        await import('../auth')
      const store = useAuthStore()

      const authChangePromise = triggerAuthStateChange(mockUser)
      await vi.advanceTimersByTimeAsync(CLAIM_REFRESH_DELAY_MS * (CLAIM_REFRESH_MAX_ATTEMPTS - 1))
      await authChangePromise

      expect(getIdTokenResult).toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS)
      expect(store.orgId).toBe('org-1')
    })

    it('a throwing refresh is logged and swallowed: org context is still fully populated', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(getIdTokenResult).mockRejectedValueOnce(new Error('token refresh boom'))
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[auth] refreshOrgClaim:', expect.any(Error))
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
      consoleErrorSpy.mockRestore()
    })
  })

  // ── 68-04 (R177) ──────────────────────────────────────────────────────────────
  // isSuperAdmin is read from the SAME getIdTokenResult call refreshOrgClaim
  // already performs — no second Firestore/Auth round-trip. These tests assert
  // the claim value flows through, not just that a refresh happened.
  describe('isSuperAdmin (R177)', () => {
    it('defaults to false before any auth state change', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.isSuperAdmin).toBe(false)
    })

    it('becomes true when the refreshed token carries claims.superAdmin === true', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgId: 'org-1', superAdmin: true },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.isSuperAdmin).toBe(true)
    })

    it('stays false when the refreshed token has no superAdmin claim', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgId: 'org-1' },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.isSuperAdmin).toBe(false)
    })

    it('resets to false on logout', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgId: 'org-1', superAdmin: true },
      } as never)
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.isSuperAdmin).toBe(true)

      await store.logout()
      expect(store.isSuperAdmin).toBe(false)
    })

    it('resets to false when onAuthStateChanged fires with no user (sign-out event)', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgId: 'org-1', superAdmin: true },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.isSuperAdmin).toBe(true)

      await triggerAuthStateChange(null)
      expect(store.isSuperAdmin).toBe(false)
    })
  })

  // ── 68-04 (R177, Pitfall 4) ──────────────────────────────────────────────────
  // refreshSuperAdminClaim is the router guard's dedicated force-refresh action —
  // distinct from refreshOrgClaim's org-scoped retry loop.
  describe('refreshSuperAdminClaim (R177, Pitfall 4)', () => {
    it('forces a fresh getIdTokenResult read and sets isSuperAdmin from it', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { superAdmin: true },
      } as never)

      await store.refreshSuperAdminClaim()

      expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, true)
      expect(store.isSuperAdmin).toBe(true)
    })

    it('sets isSuperAdmin to false when there is no signed-in user', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.refreshSuperAdminClaim()
      expect(store.isSuperAdmin).toBe(false)
    })

    it('a throwing refresh is logged and swallowed, leaving isSuperAdmin unchanged', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      vi.mocked(getIdTokenResult).mockRejectedValueOnce(new Error('token refresh boom'))

      await store.refreshSuperAdminClaim()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[auth] refreshSuperAdminClaim:',
        expect.any(Error),
      )
      expect(store.isSuperAdmin).toBe(false)
      consoleErrorSpy.mockRestore()
    })
  })

  // ── 68-REVIEW.md WR-03 ────────────────────────────────────────────────────
  // waitForReady mirrors waitForRole's wait shape but gates on isReady rather
  // than userRole, giving the requiresSuperAdmin router guard the same
  // explicit "don't read user state before it's populated" guarantee
  // requiresEditor's waitForRole already has.
  describe('waitForReady (WR-03, 68-REVIEW.md)', () => {
    it('resolves immediately when isReady is already true', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(null)
      expect(store.isReady).toBe(true)

      let resolved = false
      await store.waitForReady().then(() => {
        resolved = true
      })
      expect(resolved).toBe(true)
    })

    it('waits until isReady becomes true before resolving', async () => {
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      expect(store.isReady).toBe(false)

      let resolved = false
      const waitPromise = store.waitForReady().then(() => {
        resolved = true
      })

      // Not yet resolved -- onAuthStateChanged has not fired.
      await Promise.resolve()
      expect(resolved).toBe(false)

      await triggerAuthStateChange(mockUser)
      await waitPromise
      expect(resolved).toBe(true)
      expect(store.isReady).toBe(true)
    })
  })

  describe('ensureUserDocument membershipCreated reporting (P-01)', () => {
    it('reports membershipCreated true on the invite-acceptance path', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'inviteLookup/test@example.com') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgId: 'org-1', role: 'editor' }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.ensureUserDocument(mockUser as never)
      expect(result).toEqual({ membershipCreated: true })
    })

    // v2.0 — the auto-create-new-org path was REMOVED: signing in never
    // provisions an org. An org-less, un-invited user now reports
    // membershipCreated false and triggers no write batch.
    it('reports membershipCreated false for an org-less, un-invited user (no auto-create)', async () => {
      const { writeBatch } = await import('firebase/firestore')
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation(() => {
        // No user doc, no invite -> nothing to join, and no org is created.
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.ensureUserDocument(mockUser as never)
      expect(result).toEqual({ membershipCreated: false })
      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('reports membershipCreated false on the already-a-member path', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      const result = await store.ensureUserDocument(mockUser as never)
      expect(result).toEqual({ membershipCreated: false })
    })
  })

  // ── 34-12 Task 1 — DIAGNOSIS for owner UAT finding F5 ────────────────────────────
  // pcSecret is a live secret and this file is committed. Every fixture below uses an
  // obviously-synthetic placeholder string, and every assertion is on hasPcCredentials
  // or on ref presence/absence (=== null / !== null) — never on a credential value.
  describe('hasPcCredentials (34-12 Task 1 — field-shape matrix)', () => {
    it('is true when both pcAppId and pcSecret are present on the org document', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        pcAppId: 'placeholder-app-id',
        pcSecret: 'placeholder-secret',
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(true)
    })

    it('is false when pcAppId is absent from the org document', async () => {
      mockOrgDocPath({ name: 'Test Org', pcSecret: 'placeholder-secret' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcAppId).toBeNull()
    })

    it('is false when pcSecret is absent from the org document', async () => {
      mockOrgDocPath({ name: 'Test Org', pcAppId: 'placeholder-app-id' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcSecret).toBeNull()
    })

    it('is false when pcAppId is the empty string', async () => {
      mockOrgDocPath({ name: 'Test Org', pcAppId: '', pcSecret: 'placeholder-secret' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
    })

    it('is false when pcSecret is the empty string', async () => {
      mockOrgDocPath({ name: 'Test Org', pcAppId: 'placeholder-app-id', pcSecret: '' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
    })

    it('is false when the org document does not exist at all', async () => {
      mockOrgDocPath(null)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcAppId).toBeNull()
      expect(store.pcSecret).toBeNull()
    })

    it('is false when the user belongs to no organization', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: [] }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcAppId).toBeNull()
      expect(store.pcSecret).toBeNull()
    })

    it('is false after logout, even when the org had credentials configured', async () => {
      mockOrgDocPath({
        name: 'Test Org',
        pcAppId: 'placeholder-app-id',
        pcSecret: 'placeholder-secret',
      })
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(true)

      await store.logout()
      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcAppId).toBeNull()
      expect(store.pcSecret).toBeNull()
    })

    // OBSERVATION, not an endorsement: auth.ts's hasPcCredentials checks `!== ''` only,
    // not `.trim()`, so a whitespace-only pcAppId currently reads as "present". Settings
    // trims on write (SettingsView.vue), so this value cannot arrive through that form —
    // only through a manual document write. This plan does not change that behaviour.
    it('records the CURRENT behaviour for a whitespace-only pcAppId (observation, not endorsement)', async () => {
      mockOrgDocPath({ name: 'Test Org', pcAppId: '   ', pcSecret: 'placeholder-secret' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.hasPcCredentials).toBe(true)
    })
  })

  describe('Planning Center credential load order (34-12 Task 1 — reactivity)', () => {
    it('hasPcCredentials is false while the org-document read is in flight, and true once it resolves — same store instance, no remount', async () => {
      let resolveOrgDoc: (value: unknown) => void = () => {}
      const orgDocPromise = new Promise((resolve) => {
        resolveOrgDoc = resolve
      })

      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: ['org-1'] }),
          }) as never
        }
        if (path === 'organizations/org-1') {
          return orgDocPromise as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })

      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()

      const authChangePromise = triggerAuthStateChange(mockUser)
      // Drain the microtask queue: ensureUserDocument's own reads/writes and
      // loadOrgContext's user-document read all run before the org-document read is
      // reached, so this only settles once the store is genuinely blocked on it.
      await flushPromises()

      expect(store.hasPcCredentials).toBe(false)
      expect(store.pcAppId).toBeNull()

      resolveOrgDoc({
        exists: () => true,
        data: () => ({ pcAppId: 'placeholder-app-id', pcSecret: 'placeholder-secret' }),
      })
      await authChangePromise

      expect(store.hasPcCredentials).toBe(true)
    })
  })

  // ── 78-02 (R224/R226/R227) ────────────────────────────────────────────────
  // enterOrgAsSuperAdmin / exitSuperAdminView — a super-admin with zero
  // memberships switches active org context to ANY org, editor-equivalent,
  // WITHOUT a membership document. See 78-RESEARCH.md Pattern 4.
  describe('enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78)', () => {
    /** A super-admin with zero memberships (memberships.value === []). */
    function mockSuperAdminNoMemberships() {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: [] }),
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
    }

    async function signInSuperAdminNoMemberships() {
      mockSuperAdminNoMemberships()
      vi.mocked(getIdTokenResult).mockResolvedValue({
        claims: { superAdmin: true },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      store.isSuperAdmin = true
      return store
    }

    /** Registers the org-doc getDoc response entering() reads for targetOrgId. */
    function mockTargetOrgDoc(targetOrgId: string, orgData: Record<string, unknown> | null) {
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: [] }),
          }) as never
        }
        if (path === `organizations/${targetOrgId}`) {
          return Promise.resolve({
            exists: () => orgData !== null,
            data: () => orgData,
          }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })
    }

    it('sets orgId/orgName/userRole/viewingAsSuperAdmin while leaving memberships empty (R226 — picker never grows)', async () => {
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X', slug: 'church-x' })

      await store.enterOrgAsSuperAdmin('church-x')

      expect(store.orgId).toBe('church-x')
      expect(store.orgName).toBe('Church X')
      expect(store.orgSlug).toBe('church-x')
      expect(store.userRole).toBe('editor')
      expect(store.viewingAsSuperAdmin).toBe('church-x')
      expect(store.memberships).toEqual([])
    })

    it('hasNoOrg is false and requiresOrgSelection is false after entering (Pitfall 1 router-strand fix)', async () => {
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X' })

      expect(store.hasNoOrg).toBe(true)
      await store.enterOrgAsSuperAdmin('church-x')

      expect(store.hasNoOrg).toBe(false)
      expect(store.requiresOrgSelection).toBe(false)
    })

    it('never calls setDoc/writeBatch (R226 — no member doc is created)', async () => {
      const { setDoc, writeBatch } = await import('firebase/firestore')
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X' })
      vi.mocked(setDoc).mockClear()
      vi.mocked(writeBatch).mockClear()

      await store.enterOrgAsSuperAdmin('church-x')

      expect(setDoc).not.toHaveBeenCalled()
      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('leaves orgId/viewingAsSuperAdmin at null when the target org doc does not exist', async () => {
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-missing', null)

      await store.enterOrgAsSuperAdmin('church-missing')

      expect(store.orgId).toBeNull()
      expect(store.viewingAsSuperAdmin).toBeNull()
    })

    it('exitSuperAdminView clears orgId/userRole/viewingAsSuperAdmin back to null', async () => {
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X' })
      await store.enterOrgAsSuperAdmin('church-x')
      expect(store.orgId).toBe('church-x')

      store.exitSuperAdminView()

      expect(store.orgId).toBeNull()
      expect(store.userRole).toBeNull()
      expect(store.viewingAsSuperAdmin).toBeNull()
    })

    it('viewingAsSuperAdmin is cleared to null after logout (Pitfall 4 — not left stale across sign-out)', async () => {
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X' })
      await store.enterOrgAsSuperAdmin('church-x')
      expect(store.viewingAsSuperAdmin).toBe('church-x')

      await store.logout()

      expect(store.viewingAsSuperAdmin).toBeNull()
    })

    // WR-01 (78-REVIEW.md) — a stale non-null deactivatedOrgMessage (from an
    // earlier deactivated-org bounce in the same session) used to survive
    // enterOrgAsSuperAdmin's resetOrgContext(), keeping hasDeactivatedOrg (and
    // therefore requiresOrgSelection) true and stranding the super-admin at
    // /select-church on the very next navigation.
    it('clears a stale deactivatedOrgMessage on enter, keeping requiresOrgSelection false (Pitfall 1 sibling-flag fix)', async () => {
      const store = await signInSuperAdminNoMemberships()
      // Seed a stale deactivation message directly -- simulates the super-admin
      // having earlier hit a deactivated-org read on some other org.
      store.deactivatedOrgMessage = 'This church is deactivated — contact your administrator.'
      expect(store.hasDeactivatedOrg).toBe(true)

      mockTargetOrgDoc('church-x', { name: 'Church X' })
      await store.enterOrgAsSuperAdmin('church-x')

      expect(store.deactivatedOrgMessage).toBeNull()
      expect(store.hasDeactivatedOrg).toBe(false)
      expect(store.requiresOrgSelection).toBe(false)
    })

    // WR-03 (78-REVIEW.md) — enterOrgAsSuperAdmin now signals success/failure
    // instead of silently no-oping on a missing/stale org doc, so the caller
    // (OrganizationsTab's onEnterChurch) can branch instead of navigating
    // unconditionally.
    it('resolves true on success and false when the target org doc does not exist', async () => {
      const store = await signInSuperAdminNoMemberships()
      mockTargetOrgDoc('church-x', { name: 'Church X' })
      await expect(store.enterOrgAsSuperAdmin('church-x')).resolves.toBe(true)

      mockTargetOrgDoc('church-missing', null)
      await expect(store.enterOrgAsSuperAdmin('church-missing')).resolves.toBe(false)
    })
  })
})
