<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Brand -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">WorshipPlanner</h1>
        <p class="text-sm text-gray-400 mt-1">Sign in to continue</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">

        <!-- Google Sign-In -->
        <div v-if="!showForgotPassword">
          <button
            @click="handleGoogleSignIn"
            :disabled="isLoading"
            class="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-100 hover:bg-gray-700 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <!-- Google G icon -->
            <svg
              v-if="!isLoading || loadingMethod !== 'google'"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              class="w-5 h-5 shrink-0"
            >
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            <svg v-else class="w-5 h-5 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>{{ loadingMethod === 'google' && isLoading ? 'Signing in...' : 'Sign in with Google' }}</span>
          </button>

          <!-- Divider -->
          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-800"></div>
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="px-2 bg-gray-900 text-gray-500">or</span>
            </div>
          </div>

          <!-- Email/Password Form -->
          <form @submit.prevent="handleEmailSignIn" class="space-y-3">
            <div>
              <label for="email" class="sr-only">Email</label>
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="Email address"
                class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Password"
                class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <!-- Error message -->
            <p v-if="errorMessage" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              {{ errorMessage }}
            </p>

            <button
              type="submit"
              :disabled="isLoading"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loadingMethod === 'email' && isLoading ? 'Signing in...' : 'Sign in' }}
            </button>

            <div class="text-center">
              <button
                type="button"
                @click="showForgotPassword = true; errorMessage = ''"
                class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>

        <!-- Forgot Password Form -->
        <div v-else>
          <div class="flex items-center gap-2 mb-4">
            <button
              @click="showForgotPassword = false; resetEmail = ''; resetMessage = ''; errorMessage = ''"
              class="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-sm font-medium text-gray-100">Reset your password</h2>
          </div>

          <p class="text-sm text-gray-400 mb-4">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form v-if="!resetMessage" @submit.prevent="handleForgotPassword" class="space-y-3">
            <input
              v-model="resetEmail"
              type="email"
              required
              placeholder="Email address"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />

            <p v-if="errorMessage" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              {{ errorMessage }}
            </p>

            <button
              type="submit"
              :disabled="isLoading"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isLoading ? 'Sending...' : 'Send reset link' }}
            </button>
          </form>

          <!-- Success state -->
          <div v-else class="text-center space-y-3">
            <div class="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p class="text-sm text-gray-300">{{ resetMessage }}</p>
            <button
              @click="showForgotPassword = false; resetEmail = ''; resetMessage = ''"
              class="text-xs text-indigo-400 hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const resetEmail = ref('')
const errorMessage = ref('')
const resetMessage = ref('')
const isLoading = ref(false)
const loadingMethod = ref<'google' | 'email' | 'reset' | null>(null)
const showForgotPassword = ref(false)

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset your password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/popup-closed-by-user':
      return ''
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    default:
      return `Sign-in failed. Please try again.`
  }
}

async function handleGoogleSignIn() {
  errorMessage.value = ''
  isLoading.value = true
  loadingMethod.value = 'google'
  try {
    const user = await authStore.loginWithGoogle()
    if (user) {
      await router.push('/')
    }
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string }
    const msg = mapFirebaseError(firebaseErr?.code ?? '')
    errorMessage.value = msg || firebaseErr?.message || 'An unexpected error occurred.'
  } finally {
    isLoading.value = false
    loadingMethod.value = null
  }
}

async function handleEmailSignIn() {
  errorMessage.value = ''
  isLoading.value = true
  loadingMethod.value = 'email'
  try {
    await authStore.loginWithEmail(email.value, password.value)
    await router.push('/')
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string }
    errorMessage.value = mapFirebaseError(firebaseErr?.code ?? '') || firebaseErr?.message || 'An unexpected error occurred.'
  } finally {
    isLoading.value = false
    loadingMethod.value = null
  }
}

async function handleForgotPassword() {
  errorMessage.value = ''
  isLoading.value = true
  loadingMethod.value = 'reset'
  try {
    await authStore.resetPassword(resetEmail.value)
    resetMessage.value = `Reset link sent to ${resetEmail.value}. Check your inbox.`
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string }
    errorMessage.value = mapFirebaseError(firebaseErr?.code ?? '') || firebaseErr?.message || 'Failed to send reset email.'
  } finally {
    isLoading.value = false
    loadingMethod.value = null
  }
}
</script>
