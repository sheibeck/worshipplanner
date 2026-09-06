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

// Pitfall 1 (125-04, R374/R376) — the org-selection gate this test file's
// createTestRouter replicates below dynamically imports '../stores/auth';
// mock it so a volunteer route exemption case can drive
// authStore.requiresOrgSelection without a real Pinia/Firestore round-trip.
const mockAuthStore = {
  waitForReady: vi.fn().mockResolvedValue(undefined),
  requiresOrgSelection: false,
  isChurchlessSuperAdmin: false,
  // WR-02 (125-REVIEW.md) — distinguishes a plain zero-membership
  // super-admin (owner-console) from a zero-membership volunteer
  // (volunteer-home) in the /login bounce-back below.
  isSuperAdmin: false,
}
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

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
      {
        path: '/schedule',
        name: 'schedule',
        component: { template: '<div>Schedule</div>' },
        meta: { requiresAuth: true },
      },
      {
        path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
        name: 'quarter-memorable-share',
        component: { template: '<div>Quarter Memorable Share</div>' },
        // No meta.requiresAuth — matches production router (D-24)
      },
      {
        // Mirrors production's /select-church — the org-selection gate below
        // needs a real destination to redirect a non-volunteer route to.
        path: '/select-church',
        name: 'select-church',
        component: { template: '<div>Select Church</div>' },
        meta: { requiresAuth: true },
      },
      {
        // Pitfall 1 (125-04) — requiresAuth + isVolunteerRoute, matching
        // production's /volunteer exactly.
        path: '/volunteer',
        name: 'volunteer-home',
        component: { template: '<div>Volunteer Home</div>' },
        meta: { requiresAuth: true, isVolunteerRoute: true },
      },
      {
        // R382 (126-03) — the build-safe Rehearse-target placeholder route,
        // matching production's /volunteer/service/:serviceId exactly.
        path: '/volunteer/service/:serviceId',
        name: 'volunteer-service',
        component: { template: '<div>Volunteer Service Placeholder</div>' },
        meta: { requiresAuth: true, isVolunteerRoute: true },
      },
      {
        // R378/R380/R383 (126-04) — the volunteer's post-sign-in landing,
        // matching production's /my-schedule exactly.
        path: '/my-schedule',
        name: 'my-schedule',
        component: { template: '<div>My Schedule</div>' },
        meta: { requiresAuth: true, isVolunteerRoute: true },
      },
      {
        // Mirrors production's /owner-console — the churchless-super-admin
        // destination the /login bounce-back below can redirect to.
        path: '/owner-console',
        name: 'owner-console',
        component: { template: '<div>Owner Console</div>' },
        meta: { requiresAuth: true, requiresSuperAdmin: true },
      },
    ],
  })

  router.beforeEach(async (to) => {
    if (to.meta.requiresAuth) {
      const user = await mockGetCurrentUser()
      if (!user) {
        return { name: 'login' }
      }

      // Mirrors production's widened org-selection gate (src/router/index.ts)
      // — !to.meta.isVolunteerRoute is the Pitfall 1 fix under test.
      if (!to.meta.requiresSuperAdmin && !to.meta.isVolunteerRoute && to.name !== 'select-church') {
        const { useAuthStore } = await import('../../stores/auth')
        const authStore = useAuthStore()
        await authStore.waitForReady()
        if (authStore.requiresOrgSelection) {
          return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
        }
      }
    }
    if (to.name === 'login') {
      const user = await mockGetCurrentUser()
      if (user) {
        // Mirrors production's widened /login bounce-back (src/router/index.ts)
        // — the isSuperAdmin branch is the WR-02 fix under test.
        const { useAuthStore } = await import('../../stores/auth')
        const authStore = useAuthStore()
        await authStore.waitForReady()
        if (authStore.requiresOrgSelection) {
          if (!authStore.isSuperAdmin) {
            return { name: 'volunteer-home' }
          }
          return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
        }
        return { name: 'dashboard' }
      }
    }
  })

  return router
}

describe('Router guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // vi.clearAllMocks() resets each vi.fn()'s call history but not plain
    // property values on the mockAuthStore object — reset those explicitly
    // so a requiresOrgSelection=true set by one test never leaks into the next.
    mockAuthStore.waitForReady.mockResolvedValue(undefined)
    mockAuthStore.requiresOrgSelection = false
    mockAuthStore.isChurchlessSuperAdmin = false
    mockAuthStore.isSuperAdmin = false
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

  describe('memorable quarter share route', () => {
    it('resolves /:slug/quarter:num-:year for a sample slug/quarter without redirect', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/gracechurch/quarter1-2026')
      expect(router.currentRoute.value.name).toBe('quarter-memorable-share')
      expect(router.currentRoute.value.params.slug).toBe('gracechurch')
      expect(router.currentRoute.value.params.num).toBe('1')
      expect(router.currentRoute.value.params.year).toBe('2026')
    })

    it('does not shadow an existing static route when the first segment is reserved', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/schedule')
      expect(router.currentRoute.value.name).toBe('schedule')
    })
  })

  describe('volunteer route exemption (Pitfall 1)', () => {
    it('a zero-membership (requiresOrgSelection) volunteer reaches /volunteer WITHOUT being redirected to /select-church', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      mockAuthStore.requiresOrgSelection = true
      const router = createTestRouter()
      await router.push('/volunteer')
      expect(router.currentRoute.value.name).toBe('volunteer-home')
    })

    it('a plain requiresAuth non-volunteer route STILL redirects a requiresOrgSelection user to /select-church', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      mockAuthStore.requiresOrgSelection = true
      const router = createTestRouter()
      await router.push('/schedule')
      expect(router.currentRoute.value.name).toBe('select-church')
    })

    it('an unauthenticated visitor to /volunteer still redirects to /login (isVolunteerRoute exempts org-selection only, not auth itself)', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const router = createTestRouter()
      await router.push('/volunteer')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  describe('/volunteer/service/:serviceId placeholder route (R382, 126-03)', () => {
    it('resolves to the volunteer-service placeholder route (no "no match")', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/volunteer/service/anything')
      expect(router.currentRoute.value.name).toBe('volunteer-service')
      expect(router.currentRoute.value.params.serviceId).toBe('anything')
    })
  })

  describe('/my-schedule route (R378/R380/R383, 126-04)', () => {
    it('resolves /my-schedule to the my-schedule route (no "no match")', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      const router = createTestRouter()
      await router.push('/my-schedule')
      expect(router.currentRoute.value.name).toBe('my-schedule')
    })
  })

  describe('/login bounce-back for a signed-in volunteer (WR-02)', () => {
    it('a signed-in, zero-membership, non-super-admin user revisiting /login lands on /volunteer, not /select-church', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      mockAuthStore.requiresOrgSelection = true
      mockAuthStore.isSuperAdmin = false
      const router = createTestRouter()
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('volunteer-home')
    })

    it('a signed-in, zero-membership SUPER-ADMIN revisiting /login still lands on /owner-console, not /volunteer', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      mockAuthStore.requiresOrgSelection = true
      mockAuthStore.isSuperAdmin = true
      mockAuthStore.isChurchlessSuperAdmin = true
      const router = createTestRouter()
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('owner-console')
    })

    it('a signed-in super-admin with a deactivated single org revisiting /login still lands on /select-church', async () => {
      mockGetCurrentUser.mockResolvedValue(mockUser)
      mockAuthStore.requiresOrgSelection = true
      mockAuthStore.isSuperAdmin = true
      mockAuthStore.isChurchlessSuperAdmin = false
      const router = createTestRouter()
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('select-church')
    })
  })
})
