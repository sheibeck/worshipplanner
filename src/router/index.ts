import { createRouter, createWebHistory } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase'

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
      meta: { requiresAuth: true },
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
  if (to.name === 'login') {
    const user = await getCurrentUser()
    if (user) {
      return { name: 'dashboard' }
    }
  }
})

export default router
