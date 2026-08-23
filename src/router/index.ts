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
      // Login church-picker: shown to a signed-in user who belongs to more than
      // one church (choose which to enter) or to none (empty state). Org-scoped
      // routes redirect here via the org-selection gate below.
      path: '/select-church',
      name: 'select-church',
      component: () => import('../views/SelectChurchView.vue'),
      meta: { requiresAuth: true },
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

    // Org-selection gate — a signed-in user with zero churches, or with more
    // than one and no active choice, must resolve which church (if any) to
    // enter before reaching an org-scoped view. The platform-level owner
    // console is org-independent, so it is exempt; the picker itself is too.
    if (!to.meta.requiresSuperAdmin && to.name !== 'select-church') {
      const { useAuthStore } = await import('../stores/auth')
      const authStore = useAuthStore()
      await authStore.waitForReady()
      if (authStore.requiresOrgSelection) {
        // Quick 260823: a churchless super-admin has no church to pick — send
        // them to the Owner Console instead of the empty /select-church picker.
        return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
      }
    }
  }

  // Never strand a user on the picker once they've resolved to an active org.
  if (to.name === 'select-church') {
    const { useAuthStore } = await import('../stores/auth')
    const authStore = useAuthStore()
    await authStore.waitForReady()
    // Quick 260823: a churchless super-admin would otherwise be stuck here
    // (requiresOrgSelection stays true with zero memberships) — route them to
    // the Owner Console, their real home.
    if (authStore.isChurchlessSuperAdmin) {
      return { name: 'owner-console' }
    }
    if (!authStore.requiresOrgSelection) {
      await authStore.waitForRole()
      return { name: authStore.isEditor ? 'dashboard' : 'services' }
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
    // WR-03 (68-REVIEW.md) — wait for the store's own onAuthStateChanged
    // listener to have populated authStore.user, mirroring requiresEditor's
    // waitForRole() wait above, BEFORE calling refreshSuperAdminClaim(). Without
    // this, a fresh page-load/reload directly on /owner-console could read
    // authStore.user before it was populated, causing refreshSuperAdminClaim to
    // bail with isSuperAdmin = false and wrongly redirect a real super-admin.
    //
    // R177 (Pitfall 4) — then force a fresh claim read BEFORE deciding to
    // redirect, so a just-granted super-admin's very next navigation sees it
    // rather than waiting out the token's normal refresh cadence. Convenience
    // gate only — the real enforcement is firestore.rules' isSuperAdmin() +
    // the setSuperAdminClaim onCall's server-side caller re-check.
    const { useAuthStore } = await import('../stores/auth')
    const authStore = useAuthStore()
    await authStore.waitForReady()
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
      await authStore.waitForReady()
      if (authStore.requiresOrgSelection) {
        // Quick 260823: churchless super-admin lands on the Owner Console.
        return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
      }
      await authStore.waitForRole()
      return { name: authStore.isEditor ? 'dashboard' : 'services' }
    }
  }
})

export default router
