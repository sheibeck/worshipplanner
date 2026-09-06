import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuthStore } from './auth'

// R374/T-125-14 — the ONLY place a magic-link volunteer's email is trusted:
// localStorage (set when the link was requested) or an explicit re-entry
// argument (cross-device fallback). Never read from a URL query param — see
// firebase.google.com/docs/auth/web/email-link-auth and 125-RESEARCH.md
// Security Domain (session-fixation).
const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn'

function mapCompletionError(err: unknown): string {
  const code = (err as { code?: string } | undefined)?.code
  switch (code) {
    case 'auth/operation-not-allowed':
      return "Email-link sign-in isn't enabled for this app yet — ask your administrator to enable it."
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This link is invalid or has expired. Please request a new one.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}

// R374/R376 — this store owns ONLY the volunteer's email-link request/
// completion helpers plus the cross-device re-entry prompt. Session/identity
// itself (the resulting uid, memberships, isReady, logout) stays entirely in
// src/stores/auth.ts's single onAuthStateChanged listener — a completed
// sign-in here flows into that existing listener unmodified. Do NOT add a
// second onAuthStateChanged here.
export const useVolunteerAuthStore = defineStore('volunteerAuth', () => {
  // True when completeSignIn was called but no email was available (no
  // localStorage entry and no reenteredEmail argument) — the view should
  // render an email re-entry input and call completeSignIn again with it.
  const needsEmailReentry = ref(false)
  const errorMessage = ref<string | null>(null)

  function isEmailLink(url: string): boolean {
    return isSignInWithEmailLink(auth, url)
  }

  /**
   * Completes the email-link sign-in for `url`. Resolves to `true` on
   * success. On cross-device (no stored email, no `reenteredEmail`), sets
   * `needsEmailReentry` and resolves `false` WITHOUT calling Firebase — the
   * caller should re-invoke with a re-entered email once available. On an
   * invalid link or a Firebase error, sets `errorMessage` and resolves
   * `false` (never throws — callers read the store's reactive state).
   */
  async function completeSignIn(url: string, reenteredEmail?: string): Promise<boolean> {
    errorMessage.value = null

    if (!isSignInWithEmailLink(auth, url)) {
      errorMessage.value = 'This link is invalid or has expired. Please request a new one.'
      return false
    }

    const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
    const email = reenteredEmail ?? storedEmail

    if (!email) {
      // R374 cross-device fallback — the link was opened on a different
      // device/browser than the one that requested it.
      needsEmailReentry.value = true
      return false
    }

    try {
      await signInWithEmailLink(auth, email, url)
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY)
      needsEmailReentry.value = false
      return true
    } catch (err: unknown) {
      // The stored email is deliberately left in place on failure (e.g.
      // auth/operation-not-allowed while the owner enables the provider) so
      // the volunteer can retry the same link without re-entering anything.
      const code = (err as { code?: string } | undefined)?.code
      // A dead link (invalid/expired) can NEVER be fixed by re-entering the
      // email — so drop the re-entry prompt and fall through to the error
      // state, which offers "Request a new link" (R399). Without this, a
      // cross-device / re-entered-email sign-in whose link is expired re-shows
      // the re-entry FORM (whose only error slot has no recovery button),
      // stranding the volunteer. Other errors keep the re-entry affordance so
      // the same link can be retried once the underlying condition clears.
      if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
        needsEmailReentry.value = false
      }
      errorMessage.value = mapCompletionError(err)
      return false
    }
  }

  // R376 — delegates to auth.ts's logout() rather than forking a second
  // sign-out path; a magic-link volunteer's session is torn down identically
  // to an org-member's.
  async function signOut(): Promise<void> {
    const authStore = useAuthStore()
    await authStore.logout()
  }

  return {
    needsEmailReentry,
    errorMessage,
    isEmailLink,
    completeSignIn,
    signOut,
  }
})
