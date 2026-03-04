import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'

// We'll mock getCurrentUser at the module level
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, callback) => {
    // We won't auto-trigger in router tests — getCurrentUser controls it
    return () => {}
  }),
}))

// Mock the router module so we can control getCurrentUser
const mockGetCurrentUser = vi.fn()

vi.mock('../index', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../index')>()
  return {
    ...mod,
    getCurrentUser: mockGetCurrentUser,
  }
})

const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
}

// Create a test router with the same structure as the real one but using mocked getCurrentUser
function createTestRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/login',
        name: 'login',
        component: { template: '<div>Login</div>' },
      },
      {
        path: '/',
        name: 'dashboard',
        component: { template: '<div>Dashboard</div>' },
        meta: { requiresAuth: true },
      },
      {
        path: '/public',
        name: 'public',
        component: { template: '<div>Public</div>' },
      },
      {
        path: '/share/:token',
        name: 'share',
        component: { template: '<div>Share</div>' },
        // No meta.requiresAuth — matches production router
      },
    ],
  })

  router.beforeEach(async (to) => {
    if (to.meta.requiresAuth) {
      const user = await mockGetCurrentUser()
      if (!user) {
        return { name: 'login' }
      }
    }
    if (to.name === 'login') {
      const user = await mockGetCurrentUser()
      if (user) {
        return { name: 'dashboard' }
      }
    }
  })

  return router
}

describe('Router guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('protected routes (requiresAuth: true)', () => {
    it('redirects unauthenticated users to /login', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/')
      expect(router.currentRoute.value.name).toBe('login')
    })

    it('allows authenticated users through to protected routes', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/')
      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })

  describe('/login route', () => {
    it('redirects authenticated users away from /login to /', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('allows unauthenticated users to access /login', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  describe('public routes (no meta.requiresAuth)', () => {
    it('allows navigation to public routes regardless of auth state', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/public')
      expect(router.currentRoute.value.name).toBe('public')
    })

    it('allows authenticated users to access public routes too', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/public')
      expect(router.currentRoute.value.name).toBe('public')
    })
  })

  describe('share route', () => {
    it('allows unauthenticated users to access /share/:token without redirect', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/share/abc123')
      expect(router.currentRoute.value.name).toBe('share')
      expect(router.currentRoute.value.params.token).toBe('abc123')
    })
  })
})
