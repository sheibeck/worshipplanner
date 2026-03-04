import { createRouter, createWebHistory } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresEditor?: boolean
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
      path: '/team',
      name: 'team',
      component: () => import('../views/TeamView.vue'),
      meta: { requiresAuth: true, requiresEditor: true },
    },
    {
      path: '/share/:token',
      name: 'share',
      component: () => import('../views/ShareView.vue'),
      // Intentionally no meta.requiresAuth — public route for unauthenticated viewers
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
