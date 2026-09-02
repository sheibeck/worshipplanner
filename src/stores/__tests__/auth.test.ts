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
//
// mockBatchUpdate (Task 1, quick 260830-l9c) — a STABLE, persistent spy
// shared across every writeBatch() call, so a test can assert what args
// batch.update() was called with. Previously writeBatch() returned a FRESH
// object with a fresh vi.fn() per call, so nothing was assertable.
const mockBatchUpdate = vi.fn()
// ARCH-001 (Phase 111) — every onSnapshot() call gets its OWN trackable
// vi.fn() unsubscribe spy (pushed to mockOnSnapshotUnsubs in call order), so
// a test can assert exactly which listeners were created and whether each
// one was ever torn down — the epoch-guard regression test below needs both.
const mockOnSnapshotUnsubs: ReturnType<typeof vi.fn>[] = []
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
  onSnapshot: vi.fn(() => {
    const unsub = vi.fn()
    mockOnSnapshotUnsubs.push(unsub)
    return unsub
  }),
  updateDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: mockBatchUpdate,
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => new Date()),
  arrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
}))

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

// Bug 2a (quick 260830-l9c) — logout() dynamically imports orgScopedStores
// (same pattern selectOrg/enterOrgAsSuperAdmin/exitSuperAdminView already
// use); a no-op spy here is harmless for THOSE tests (they assert org
// state, not teardown) and lets the new logout ordering test below assert
// resetOrgScopedStores actually ran, and ran before signOut.
vi.mock('../orgScopedStores', () => ({
  resetOrgScopedStores: vi.fn(),
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
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'
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
    // ARCH-001 — vi.clearAllMocks() resets each spy's own call history but
    // does not shrink this plain array; clear it directly per test.
    mockOnSnapshotUnsubs.length = 0
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

    // Bug 2a (quick 260830-l9c) — all 11 org-scoped store listeners MUST be
    // torn down before the token is revoked, or they fail their Firestore
    // rules mid-signOut ("Uncaught Error in snapshot listener").
    it('resets org-scoped stores before signOut', async () => {
      const { resetOrgScopedStores } = await import('../orgScopedStores')
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()

      await store.logout()

      expect(resetOrgScopedStores).toHaveBeenCalled()
      expect(vi.mocked(resetOrgScopedStores).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(signOut).mock.invocationCallOrder[0]!,
      )
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

    // Bug 1a (quick 260830-l9c) — accepting a second church's invite must
    // APPEND to orgIds via arrayUnion, never REPLACE it (which clobbered the
    // original primary org down to a single element).
    it('appends orgIds via arrayUnion on invite accept — does not replace the array', async () => {
      const { doc: docFn } = await import('firebase/firestore')
      mockOrgDocPathWithInvite({ name: 'Org One' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await store.ensureUserDocument(mockUser as never)
      const userRef = vi.mocked(docFn).mock.results.find(
        (r) => (r.value as { path?: string }).path === 'users/test-uid',
      )?.value
      expect(mockBatchUpdate).toHaveBeenCalledWith(userRef, {
        orgIds: { __arrayUnion: 'org-1' },
      })
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
        { id: 'org-1', name: 'Org One', active: true, role: 'viewer' },
        { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
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
        { id: 'org-1', name: 'Org One', active: true, role: 'viewer' },
        { id: 'org-2', name: 'org-2', active: false, role: 'viewer' },
      ])
      expect(store.needsOrgSelection).toBe(true)
    })

    // Bug 1b (quick 260830-l9c) — self-heal: a clobbered orgIds (down to one
    // element by the pre-1a REPLACE bug) still self-heals from the
    // authoritative `orgs` custom claim, which the server computes from a
    // full collectionGroup('members') scan and so never loses an org. The
    // union must drive BOTH memberships AND activeId — activeId stays null
    // here (union length 2) so the picker shows, rather than auto-entering
    // the single clobbered orgIds entry.
    it('self-heals the picker from claims.orgs when orgIds was clobbered to one element', async () => {
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return Promise.resolve({
            exists: () => true,
            data: () => ({ orgIds: ['org-2'] }),
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
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgs: { 'org-1': 'editor', 'org-2': 'editor' } },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-2', name: 'Org Two', active: true, role: 'editor' },
        { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
      ])
      expect(store.orgId).toBeNull()
      expect(store.needsOrgSelection).toBe(true)
      expect(store.requiresOrgSelection).toBe(true)
      // Union has length 2, so refreshOrgClaim never runs — the only call is
      // the top unforced read.
      expect(getIdTokenResult).toHaveBeenCalledTimes(1)
      expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, false)
    })
  })

  // Phase 104 (R311/R312) — per-org role threaded onto each memberships
  // entry from the `orgs` custom claim, so the sidebar church switcher's
  // role badge has data to render. Covers: an explicit editor-claim org, a
  // viewer-claim org, and an org present in orgIds but absent from the claim
  // entirely (claim not yet caught up) — the last case must still yield an
  // entry (role 'viewer'), never crash or drop it.
  describe('memberships[].role (Phase 104, R311)', () => {
    it('resolves role editor for an org the claim marks editor, and viewer for one it marks viewer', async () => {
      mockMultiOrg()
      // Multi-org with no remembered/single-org active choice never reaches
      // the FORCED refreshOrgClaim call (activeId stays null) — only the one
      // unforced claim read at the top of loadOrgContext fires, so
      // mockResolvedValueOnce is sufficient and avoids leaking this
      // implementation into later tests (clearAllMocks in beforeEach does
      // not reset a non-Once mockResolvedValue).
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgs: { 'org-1': 'editor', 'org-2': 'viewer' } },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
        { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
      ])
    })

    it('defaults role to viewer for an org present in orgIds but absent from the claim (claim not yet caught up)', async () => {
      mockMultiOrg()
      // Claim only knows about org-1 — org-2 is a just-joined membership the
      // claim hasn't caught up to yet. Must still yield a viewer entry for
      // org-2, not crash or drop it from the list. mockResolvedValueOnce for
      // the same reason as the test above.
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { orgs: { 'org-1': 'editor' } },
      } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([
        { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
        { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
      ])
    })

    it('defaults role to viewer when the claim has no orgs entry at all', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.memberships).toEqual([{ id: 'org-1', name: 'Test Org', active: true, role: 'viewer' }])
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
        { id: 'org-1', name: 'org-1', active: false, role: 'viewer' },
        { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
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
      // Bug 1b (quick 260830-l9c) added a leading unforced getIdTokenResult
      // read (loadOrgContext's self-heal union) — the leading value below is
      // consumed by that read, so the superAdmin claim still lands on the
      // FORCED refreshOrgClaim call this test actually exercises.
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({
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

  describe('aiMasterEnabled (Phase 82, R242/R243)', () => {
    it('defaults to false after loadOrgContext when the org doc has no aiMasterEnabled field', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(false)
    })

    it('reflects an explicit true aiMasterEnabled field on the org doc', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: true })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(true)
    })

    it('reflects an explicit false aiMasterEnabled field on the org doc', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: false })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(false)
    })

    it('resets to false on logout (no stale leak across org switches)', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: true })
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(true)

      await store.logout()
      expect(store.aiMasterEnabled).toBe(false)
    })

    it('resets to false when the user belongs to no organization', async () => {
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
      expect(store.aiMasterEnabled).toBe(false)
    })
  })

  // WR-02 (82-REVIEW): the single shared two-gate AI-affordance computed
  // that every UI site (SongSlotPicker, ScriptureInput, CongregationalEditor,
  // ServiceEditorView's action bar) must read instead of the bare
  // settings.aiEnabled -- mirrors src/utils/claudeApi.ts's isAiEnabled().
  describe('isAiEnabled (Phase 82 WR-02, R242/R243)', () => {
    it('is false when aiMasterEnabled is true but settings.aiEnabled is false', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: true, settings: { aiEnabled: false } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(true)
      expect(store.settings.aiEnabled).toBe(false)
      expect(store.isAiEnabled).toBe(false)
    })

    it('is false when aiMasterEnabled is false even though settings.aiEnabled is true', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: false, settings: { aiEnabled: true } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(false)
      expect(store.settings.aiEnabled).toBe(true)
      expect(store.isAiEnabled).toBe(false)
    })

    it('is true only when BOTH aiMasterEnabled and settings.aiEnabled are true', async () => {
      mockOrgDocPath({ name: 'Test Org', aiMasterEnabled: true, settings: { aiEnabled: true } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.aiMasterEnabled).toBe(true)
      expect(store.settings.aiEnabled).toBe(true)
      expect(store.isAiEnabled).toBe(true)
    })
  })

  describe('bibleApiEnabled / isBibleApiEnabled (Phase 101, R295)', () => {
    it('defaults to false after loadOrgContext when the org doc has no bibleApiEnabled field', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.bibleApiEnabled).toBe(false)
      expect(store.isBibleApiEnabled).toBe(false)
    })

    it('reflects an explicit true bibleApiEnabled field on the org doc', async () => {
      mockOrgDocPath({ name: 'Test Org', bibleApiEnabled: true })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.bibleApiEnabled).toBe(true)
      expect(store.isBibleApiEnabled).toBe(true)
    })

    it('reflects an explicit false bibleApiEnabled field on the org doc', async () => {
      mockOrgDocPath({ name: 'Test Org', bibleApiEnabled: false })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.bibleApiEnabled).toBe(false)
      expect(store.isBibleApiEnabled).toBe(false)
    })

    it('resets to false on logout (no stale leak across org switches)', async () => {
      mockOrgDocPath({ name: 'Test Org', bibleApiEnabled: true })
      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.bibleApiEnabled).toBe(true)

      await store.logout()
      expect(store.bibleApiEnabled).toBe(false)
    })

    it('resets to false when the user belongs to no organization', async () => {
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
      expect(store.bibleApiEnabled).toBe(false)
    })

    it('isBibleApiEnabled is single-leg: tracks bibleApiEnabled alone, independent of settings', async () => {
      mockOrgDocPath({ name: 'Test Org', bibleApiEnabled: true, settings: { aiEnabled: false } })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(store.bibleApiEnabled).toBe(true)
      expect(store.isBibleApiEnabled).toBe(true)
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
      // 1 unforced (loadOrgContext's top self-heal claim read) + 1 forced
      // (refreshOrgClaim) — Bug 1b (quick 260830-l9c) adds the leading read.
      expect(getIdTokenResult).toHaveBeenCalledTimes(2)
      expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, true)
      expect(store.orgId).toBe('org-1')
    })

    it('performs no FORCED refresh when the user belongs to no organization', async () => {
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
      // The top unforced self-heal read still runs even for empty orgIds —
      // only the FORCED refresh (activeId known) is skipped.
      expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, false)
      expect(getIdTokenResult).not.toHaveBeenCalledWith(mockUser, true)
      expect(store.orgId).toBeNull()
    })

    it('just-joined, claim present on the first refresh: exactly one refresh, no delay', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: { orgId: 'org-1' } } as never)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(getIdTokenResult).toHaveBeenCalledTimes(2)
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
    })

    it('just-joined, claim absent then present on the third attempt: three refreshes, two delays, then stops', async () => {
      mockOrgDocPathWithInvite({ name: 'Test Org' })
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({ claims: { orgId: 'org-1' } } as never)
      const { useAuthStore, CLAIM_REFRESH_DELAY_MS } = await import('../auth')
      const store = useAuthStore()

      const authChangePromise = triggerAuthStateChange(mockUser)
      await vi.advanceTimersByTimeAsync(CLAIM_REFRESH_DELAY_MS * 2)
      await authChangePromise

      expect(getIdTokenResult).toHaveBeenCalledTimes(4)
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

      expect(getIdTokenResult).toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS + 1)
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

      expect(getIdTokenResult).toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS + 1)
      expect(store.orgId).toBe('org-1')
    })

    it('a throwing refresh is logged and swallowed: org context is still fully populated', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(getIdTokenResult).mockRejectedValueOnce(new Error('token refresh boom'))
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[auth] loadOrgContext claim read:',
        expect.any(Error),
      )
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
      // Bug 1b (quick 260830-l9c) added a leading unforced getIdTokenResult
      // read; the leading value is consumed by that read so the superAdmin
      // claim lands on the FORCED refreshOrgClaim call this test exercises.
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({
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
      // Bug 1b (quick 260830-l9c) — leading value consumed by the top
      // unforced self-heal read; the real value lands on the forced call.
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({
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
      // Bug 1b (quick 260830-l9c) — leading value consumed by the top
      // unforced self-heal read; the real value lands on the forced call.
      vi.mocked(getIdTokenResult)
        .mockResolvedValueOnce({ claims: {} } as never)
        .mockResolvedValueOnce({
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

  // ── ARCH-001 (Phase 111, T-111-01/T-111-02) ─────────────────────────────
  // Store-layer epoch guard around loadOrgContext's shared memberUnsub
  // onSnapshot assignment. Drives two OVERLAPPING loadOrgContext calls
  // through the store's real onAuthStateChanged callback (never exports
  // loadOrgContext) by re-firing triggerAuthStateChange without awaiting the
  // first — the exact "re-fired onAuthStateChanged callback" shape
  // 111-01-PLAN.md calls out, and a faithful stand-in for exitSuperAdminView
  // being invoked twice in quick succession with no UI guard.
  describe('loadOrgContext memberUnsub epoch guard (ARCH-001, Phase 111)', () => {
    it('an interleaved second loadOrgContext call leaves exactly one live members listener — no orphan', async () => {
      mockOrgDocPath({ name: 'Test Org' })
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()

      // Fire two overlapping auth-state-change events WITHOUT awaiting the
      // first — both race through ensureUserDocument + loadOrgContext
      // concurrently, exactly like a superseded loadOrgContext call would in
      // production (e.g. two rapid exitSuperAdminView invocations before
      // Task 2's UI guard existed).
      const first = triggerAuthStateChange(mockUser)
      const second = triggerAuthStateChange(mockUser)
      await Promise.all([first, second])
      await flushPromises()

      // The superseded call must never reach the onSnapshot() call at all
      // (the epoch check returns before it) — so exactly ONE members
      // listener was created for this pair of overlapping loads, not two.
      // (Pre-fix behavior: onSnapshot would be called twice, and whichever
      // call's assignment ran LAST would win regardless of which was
      // actually the newer/intended call.)
      expect(onSnapshot).toHaveBeenCalledTimes(1)

      // And that one listener is still live — nothing tore it down, so no
      // orphan and no accidental self-unsubscribe either.
      expect(mockOnSnapshotUnsubs).toHaveLength(1)
      expect(mockOnSnapshotUnsubs[0]).not.toHaveBeenCalled()

      // Sanity: normal org-context state still resolved correctly despite
      // the race (userRole set from the one surviving listener's callback
      // requires the onSnapshot callback to actually fire, which this mock
      // doesn't invoke — orgId/orgName are enough to prove the call
      // completed normally).
      expect(store.orgId).toBe('org-1')
      expect(store.orgName).toBe('Test Org')
    })

    it('a normal, non-overlapping church switch still opens a fresh members listener (re-subscribe path unregressed)', async () => {
      // quick 260901-lua's church-switch re-subscribe path: two FULLY
      // AWAITED, non-overlapping selectOrg calls (no race) must keep
      // unsubscribing the prior listener and opening a fresh one every
      // time — the epoch guard must never block a legitimate re-subscribe.
      mockMultiOrg()
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()
      await triggerAuthStateChange(mockUser)
      // Multi-org with no remembered/single-org choice yet resolves
      // activeId===null (needs selection) — resetOrgContext() returns
      // before ever reaching the onSnapshot assignment.
      expect(onSnapshot).not.toHaveBeenCalled()

      await store.selectOrg('org-1')
      expect(onSnapshot).toHaveBeenCalledTimes(1)
      expect(store.orgId).toBe('org-1')

      await store.selectOrg('org-2')
      expect(onSnapshot).toHaveBeenCalledTimes(2)
      expect(mockOnSnapshotUnsubs).toHaveLength(2)
      // The FIRST (org-1) listener was torn down by the second call's
      // `memberUnsub?.()` before it assigned its own.
      expect(mockOnSnapshotUnsubs[0]).toHaveBeenCalled()
      // The second (org-2) listener is the live one.
      expect(mockOnSnapshotUnsubs[1]).not.toHaveBeenCalled()
      expect(store.orgId).toBe('org-2')
    })

    // 111-REVIEW.md CR-01 — the two tests above both resolve concurrent
    // calls to the SAME org, so neither ever reaches loadOrgContext's
    // resetOrgContext()/deactivation branches under a race. This test
    // drives two OVERLAPPING calls to DIFFERENT orgs, with the OLDER call
    // (org-A) deliberately made to resolve its org-doc read LAST — after
    // the NEWER call (org-B) has already fully completed and attached its
    // live listener — and made to hit the denied-read/deactivation branch
    // on resume. Pre-fix, that branch's resetOrgContext() ran
    // unconditionally and would tear down org-B's live memberUnsub and
    // flash a stale deactivation message over a perfectly healthy org-B
    // session; post-fix, the branch's isStale() check catches it first.
    it('a superseded call resolving to a DIFFERENT (denied/deactivated) org never clobbers a newer call\'s live org context (CR-01 fix)', async () => {
      // Deferred control for call A's SECOND getDoc('organizations/org-A')
      // (the activeId org-doc read, not the membership-list-building read)
      // so we can force it to reject only once call B has fully finished.
      let rejectOrgARead!: (err: unknown) => void
      const orgAActiveReadPromise = new Promise<never>((_resolve, reject) => {
        rejectOrgARead = reject
      })

      let userDocCallCount = 0
      let orgACallCount = 0
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          userDocCallCount++
          const orgIds = userDocCallCount === 1 ? ['org-A'] : ['org-B']
          return Promise.resolve({ exists: () => true, data: () => ({ orgIds }) }) as never
        }
        if (path === 'organizations/org-A') {
          orgACallCount++
          // 1st call: the membership-list builder's read (resolves normally
          // so call A's `memberships.value` assignment isn't itself stuck).
          if (orgACallCount === 1) {
            return Promise.resolve({
              exists: () => true,
              data: () => ({ name: 'Org A', active: true }),
            }) as never
          }
          // 2nd call: the activeId org-doc read — deferred until triggered.
          return orgAActiveReadPromise as never
        }
        if (path === 'organizations/org-B') {
          return Promise.resolve({ exists: () => true, data: () => ({ name: 'Org B' }) }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })

      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()

      // Fire call A (older, resolves to org-A) WITHOUT awaiting — it runs
      // through memberships/orgId for org-A and then suspends on the
      // deferred activeId read for organizations/org-A.
      const callA = triggerAuthStateChange(mockUser)
      await flushPromises()
      expect(store.orgId).toBe('org-A')

      // Fire call B (newer, resolves to org-B) and let it run to FULL
      // completion before call A resumes — the exact "older call resolves
      // last" ordering CR-01 left unguarded.
      await triggerAuthStateChange(mockUser)
      expect(store.orgId).toBe('org-B')
      expect(store.orgName).toBe('Org B')
      expect(onSnapshot).toHaveBeenCalledTimes(1)
      expect(mockOnSnapshotUnsubs).toHaveLength(1)

      // Now let call A's stalled activeId read reject — pre-fix, its catch
      // branch would unconditionally call resetOrgContext() (wiping org-B's
      // orgId/orgName and tearing down org-B's live memberUnsub) and set
      // deactivatedOrgMessage.
      rejectOrgARead(new Error('permission-denied'))
      await callA

      // Post-fix: call A's epoch is stale by the time its catch block runs,
      // so isStale() returns true and it bails before touching anything.
      expect(store.orgId).toBe('org-B')
      expect(store.orgName).toBe('Org B')
      expect(store.deactivatedOrgMessage).toBeNull()
      // Org-B's live listener was never torn down by call A's stale
      // resetOrgContext().
      expect(mockOnSnapshotUnsubs[0]).not.toHaveBeenCalled()
      expect(onSnapshot).toHaveBeenCalledTimes(1)
    })

    // WR-01 (111-REVIEW.md) — logout() (and onAuthStateChanged's sign-out
    // branch) must invalidate any loadOrgContext call still in flight, so a
    // slow call cannot attach a fresh members listener for an
    // already-signed-out session. Drives a loadOrgContext call that
    // suspends on its very FIRST await (the users/{uid} read), runs
    // logout() to completion while it's still suspended, then lets the
    // stale call resume and asserts it never reaches onSnapshot.
    it('a loadOrgContext call still in flight when logout() runs attaches no listener afterward (WR-01 fix)', async () => {
      let resolveUserDoc!: (value: unknown) => void
      const userDocPromise = new Promise((resolve) => {
        resolveUserDoc = resolve
      })
      vi.mocked(doc).mockImplementation(
        (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }) as never,
      )
      vi.mocked(getDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path
        if (path === 'users/test-uid') {
          return userDocPromise as never
        }
        if (path === 'organizations/org-1') {
          return Promise.resolve({ exists: () => true, data: () => ({ name: 'Org One' }) }) as never
        }
        return Promise.resolve({ exists: () => false, data: () => null }) as never
      })

      vi.mocked(signOut).mockResolvedValueOnce(undefined)
      const { useAuthStore } = await import('../auth')
      const store = useAuthStore()

      // Fire the sign-in (and its loadOrgContext) WITHOUT awaiting — it
      // suspends on the deferred users/test-uid read.
      const signInCall = triggerAuthStateChange(mockUser)
      await flushPromises()

      // logout() runs to completion while the sign-in's loadOrgContext call
      // is still suspended on its first await.
      await store.logout()
      expect(store.orgId).toBeNull()

      // Now let the stale sign-in's userDoc read resolve, well after logout.
      resolveUserDoc({ exists: () => true, data: () => ({ orgIds: ['org-1'] }) })
      await signInCall
      await flushPromises()

      // Pre-fix: nothing had incremented loadOrgContextEpoch on logout, so
      // the stale call's checkpoints would all still pass and it would
      // attach a fresh members listener for an already-signed-out session.
      // Post-fix: logout() bumped the epoch, so the very first isStale()
      // checkpoint (right after the read that just resolved) returns true.
      expect(onSnapshot).not.toHaveBeenCalled()
      expect(store.orgId).toBeNull()
    })
  })
})
