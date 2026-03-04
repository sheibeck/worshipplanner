import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock firebase/auth module
vi.mock('firebase/auth', () => {
  const mockOnAuthStateChangedCallbacks: ((user: unknown) => void)[] = []

  return {
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
    signInWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signOut: vi.fn(),
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
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => new Date()),
}))

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'

const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
}

function triggerAuthStateChange(user: unknown) {
  const callbacks = (globalThis as Record<string, unknown>).__authCallbacks as
    | ((user: unknown) => void)[]
    | undefined
  if (callbacks) {
    callbacks.forEach((cb) => cb(user))
  }
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset auth callbacks
    ;(globalThis as Record<string, unknown>).__authCallbacks = []
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
  })
})
