import { createRouter, createWebHistory } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresEditor?: boolean
    requiresSuperAdmin?: boolean
  }
}

export function getCurrentUser() {
  return new Promise<import('firebase/auth').User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/songs',
      name: 'songs',
      component: () => import('../views/SongsView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/volunteers',
      name: 'volunteers',
      component: () => import('../views/RosterView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: () => import('../views/QuarterView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/services',
      name: 'services',
      component: () => import('../views/ServicesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/services/:id',
      name: 'service-editor',
      component: () => import('../views/ServiceEditorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admins',
      name: 'admins',
      component: () => import('../views/TeamView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      // R177 — deliberately NOT /admins (owned by TeamView.vue, per-org roles).
      // This is the platform-level, super-admin-only console.
      path: '/owner-console',
      name: 'owner-console',
      component: () => import('../views/OwnerConsoleView.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/share/:token',
      name: 'share',
      component: () => import('../views/ShareView.vue'),
      // Intentionally no meta.requiresAuth — public route for unauthenticated viewers
    },
    {
      path: '/quarter-share/:token',
      name: 'quarter-share',
      component: () => import('../views/QuarterShareView.vue'),
      // Intentionally no meta.requiresAuth — public route for unauthenticated viewers (D-24)
    },
    {
      path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
      name: 'quarter-memorable-share',
      component: () => import('../views/QuarterShareView.vue'),
      // Intentionally no meta.requiresAuth — public route for unauthenticated viewers (D-24).
      // Appended after all static routes: Vue Router ranks static segments above dynamic
      // ones, so this can never shadow /songs, /volunteers, /schedule, etc. (D-19).
    },
    {
      path: '/:slug/service-:date(\\d{4}-\\d{2}-\\d{2})',
      name: 'service-memorable-share',
      component: () => import('../views/ShareView.vue'),
      // Intentionally no meta.requiresAuth — public route for unauthenticated viewers,
      // mirrors quarter-memorable-share. Appended after all static routes: Vue Router
      // ranks static segments above dynamic ones, so this can never shadow /songs,
      // /volunteers, /schedule, etc. (D-19).
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const user = await getCurrentUser()
    if (!user) {
      return { name: 'login' }
    }
  }

  if (to.meta.requiresEditor) {
    const { useAuthStore } = await import('../stores/auth')
    const authStore = useAuthStore()
    await authStore.waitForRole()
    if (!authStore.isEditor) {
      return { name: 'services' }
    }
  }

  if (to.meta.requiresSuperAdmin) {
    // R177 (Pitfall 4) — force a fresh claim read BEFORE deciding to redirect,
    // so a just-granted super-admin's very next navigation sees it rather than
    // waiting out the token's normal refresh cadence. Convenience gate only —
    // the real enforcement is firestore.rules' isSuperAdmin() + the
    // setSuperAdminClaim onCall's server-side caller re-check.
    const { useAuthStore } = await import('../stores/auth')
    const authStore = useAuthStore()
    await authStore.refreshSuperAdminClaim()
    if (!authStore.isSuperAdmin) {
      return { name: 'services' }
    }
  }

  if (to.name === 'login') {
    const user = await getCurrentUser()
    if (user) {
      const { useAuthStore } = await import('../stores/auth')
      const authStore = useAuthStore()
      await authStore.waitForRole()
      return { name: authStore.isEditor ? 'dashboard' : 'services' }
    }
  }
})

export default router
