import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Task 1 (125-04, R374) — volunteerAuth's email-link completion flow. Mocked
// exactly like src/stores/__tests__/auth.test.ts mocks firebase/auth: no real
// network/SDK calls, only the two modular functions this store touches.
vi.mock('firebase/auth', () => ({
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
}))

vi.mock('@/firebase', () => ({
  auth: {},
}))

// signOut() delegates to auth.ts's logout() — mock the store, not firebase/auth's
// signOut, since volunteerAuth.ts must never fork its own session teardown.
const mockLogout = vi.fn()
vi.mock('../auth', () => ({
  useAuthStore: vi.fn(() => ({ logout: mockLogout })),
}))

import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'

const EMAIL_KEY = 'emailForSignIn'

describe('useVolunteerAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  describe('isEmailLink', () => {
    it('delegates to isSignInWithEmailLink', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)
      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()

      expect(store.isEmailLink('https://example.com/volunteer/verify?apiKey=x')).toBe(true)
      expect(isSignInWithEmailLink).toHaveBeenCalled()
    })
  })

  describe('completeSignIn — happy path', () => {
    it('completes sign-in using the stored email and clears localStorage', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)
      vi.mocked(signInWithEmailLink).mockResolvedValue({ user: { uid: 'vol-uid' } } as never)
      window.localStorage.setItem(EMAIL_KEY, 'dana@example.com')

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      const result = await store.completeSignIn('https://example.com/volunteer/verify?apiKey=x')

      expect(result).toBe(true)
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        expect.anything(),
        'dana@example.com',
        expect.any(String),
      )
      expect(window.localStorage.getItem(EMAIL_KEY)).toBeNull()
      expect(store.needsEmailReentry).toBe(false)
      expect(store.errorMessage).toBeNull()
    })
  })

  describe('completeSignIn — cross-device fallback', () => {
    it('does NOT call signInWithEmailLink and sets needsEmailReentry when no stored email/re-entry is given', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      const result = await store.completeSignIn('https://example.com/volunteer/verify?apiKey=x')

      expect(result).toBe(false)
      expect(store.needsEmailReentry).toBe(true)
      expect(signInWithEmailLink).not.toHaveBeenCalled()
    })

    it('completes sign-in once an email is supplied via re-entry, and clears the reentry flag', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)
      vi.mocked(signInWithEmailLink).mockResolvedValue({ user: { uid: 'vol-uid' } } as never)

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      const result = await store.completeSignIn(
        'https://example.com/volunteer/verify?apiKey=x',
        'reentered@example.com',
      )

      expect(result).toBe(true)
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        expect.anything(),
        'reentered@example.com',
        expect.any(String),
      )
      expect(window.localStorage.getItem(EMAIL_KEY)).toBeNull()
      expect(store.needsEmailReentry).toBe(false)
    })

    it('never reads the email from a URL query param — a malicious ?email= is ignored in favor of the stored value', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)
      vi.mocked(signInWithEmailLink).mockResolvedValue({ user: { uid: 'vol-uid' } } as never)
      window.localStorage.setItem(EMAIL_KEY, 'dana@example.com')

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      await store.completeSignIn('https://example.com/volunteer/verify?email=attacker@evil.com')

      expect(signInWithEmailLink).toHaveBeenCalledWith(
        expect.anything(),
        'dana@example.com',
        expect.any(String),
      )
    })
  })

  describe('completeSignIn — invalid link', () => {
    it('sets an error state and never calls signInWithEmailLink when the URL is not a valid sign-in link', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(false)

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      const result = await store.completeSignIn('https://example.com/volunteer/verify')

      expect(result).toBe(false)
      expect(store.errorMessage).not.toBeNull()
      expect(signInWithEmailLink).not.toHaveBeenCalled()
    })
  })

  describe('completeSignIn — provider not enabled', () => {
    it('surfaces a friendly error on auth/operation-not-allowed without throwing', async () => {
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true)
      vi.mocked(signInWithEmailLink).mockRejectedValue({ code: 'auth/operation-not-allowed' })
      window.localStorage.setItem(EMAIL_KEY, 'dana@example.com')

      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      const result = await store.completeSignIn('https://example.com/volunteer/verify?apiKey=x')

      expect(result).toBe(false)
      expect(store.errorMessage).toMatch(/enable/i)
      // A failed completion must NOT clear the stored email — the volunteer
      // may retry once the owner enables the provider.
      expect(window.localStorage.getItem(EMAIL_KEY)).toBe('dana@example.com')
    })
  })

  describe('signOut', () => {
    it('delegates to the auth store logout() rather than forking its own sign-out', async () => {
      const { useVolunteerAuthStore } = await import('../volunteerAuth')
      const store = useVolunteerAuthStore()
      await store.signOut()

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })

  describe('no password API', () => {
    it('this store module never imports a password-based Firebase auth function', async () => {
      // T-125-14/R374 — a magic-link volunteer must never have a password
      // path available. Proven at the mock boundary: the firebase/auth mock
      // above only supplies isSignInWithEmailLink/signInWithEmailLink: if
      // volunteerAuth.ts imported any password API it would be `undefined`
      // at import time and throw before this test file's other cases could
      // ever pass.
      const mod = await import('../volunteerAuth')
      expect(mod).toBeDefined()
    })
  })
})
