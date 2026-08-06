import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  type User,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  writeBatch,
  collection,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { OrgSettings } from '@/types/organization'
import { DEFAULT_ORG_SETTINGS } from '@/types/organization'

let memberUnsub: Unsubscribe | null = null

// R075 / P-01 (Phase 40 Plan 03) — bounds on the just-joined-membership claim
// retry in refreshOrgClaim below. Four attempts spaced 1.5s apart gives a
// worst case of roughly 4.5s, comfortably inside the few-hundred-ms-to-a-few-
// seconds band Cloud Functions triggers typically land in, and it is paid
// only once: on the org-context load immediately following a membership
// document being created (invite acceptance or auto-create-new-org).
// Exported (module-scope, not store-scope) so tests can drive timing without
// magic numbers.
export const CLAIM_REFRESH_MAX_ATTEMPTS = 4
export const CLAIM_REFRESH_DELAY_MS = 1500

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isReady = ref(false)

  const orgId = ref<string | null>(null)
  const orgName = ref<string | null>(null)
  // Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.
  const orgSlug = ref<string | null>(null)
  const userRole = ref<'editor' | 'viewer' | null>(null)

  // Planning Center credential state
  const pcAppId = ref<string | null>(null)
  const pcSecret = ref<string | null>(null)

  // Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON —
  // missing field on legacy org docs means VW mode is enabled. Single source of
  // truth every VW surface gates on (D-16). Mirror-written from Settings; NOT
  // live-synced via onSnapshot (Pitfall 2).
  const vwModeEnabled = ref(true)

  // The one typed org-settings object every consumer reads (R073). Merged with
  // DEFAULT_ORG_SETTINGS at a single point (loadOrgContext) so no consumer ever
  // writes its own `?? default` fallback. Mirror-written from Settings, exactly
  // like vwModeEnabled above — NOT live-synced via onSnapshot. Initialized to a
  // fresh spread copy, never the shared DEFAULT_ORG_SETTINGS constant itself, so
  // nothing can mutate the default object.
  const settings = ref<OrgSettings>({ ...DEFAULT_ORG_SETTINGS })

  const isAuthenticated = computed(() => user.value !== null)
  const isEditor = computed(() => userRole.value === 'editor')

  const hasPcCredentials = computed(
    () =>
      pcAppId.value !== null &&
      pcSecret.value !== null &&
      pcAppId.value !== '' &&
      pcSecret.value !== '',
  )

  const pcCredentials = computed(() => {
    if (!hasPcCredentials.value) return null
    return {
      appId: pcAppId.value!,
      secret: pcSecret.value!,
    }
  })

  function waitForRole(): Promise<void> {
    return new Promise((resolve) => {
      if (userRole.value !== null || !isAuthenticated.value) {
        resolve()
        return
      }
      const unwatch = watch(userRole, (val) => {
        if (val !== null) {
          unwatch()
          resolve()
        }
      })
    })
  }

  // R075 (D-06/D-07) / P-01 — force the custom `orgId`/`role` claim (set by
  // functions/src/orgMembershipClaims.ts's syncOrgMembershipClaim trigger)
  // onto the active session's ID token so a member does not wait out a full
  // 1-hour token lifetime for it to propagate. `getIdTokenResult` is used
  // (rather than `getIdToken`) because it returns the decoded `claims`
  // object, which is what lets the retry below know when to stop.
  //
  // `awaitClaim` scopes the retry (P-01) to the just-created-membership
  // window only: false loops at most once with no delay (the ordinary,
  // already-a-member path — latency must stay unchanged), true loops up to
  // CLAIM_REFRESH_MAX_ATTEMPTS times spaced CLAIM_REFRESH_DELAY_MS apart,
  // stopping the instant `claims.orgId` strictly equals `targetOrgId` (a
  // claim naming a different org, e.g. a stale claim from a previous org,
  // never satisfies the wait).
  //
  // Known limitation (D-01/D-04, documented not accidental): the claim only
  // ever carries the user's PRIMARY org (orgIds[0]). For a multi-org user,
  // a non-primary org load passes a targetOrgId the claim will never carry —
  // that load is, and stays, served by the Firestore-membership arm of the
  // dual-read alone. That is expected, not a bug in this retry.
  //
  // Never throws: a failed or exhausted refresh is not a failed sign-in —
  // storage.rules' Firestore-membership arm still grants access while the
  // claim is missing, so loadOrgContext must still resolve either way.
  async function refreshOrgClaim(targetOrgId: string, awaitClaim: boolean): Promise<void> {
    const currentUser = user.value
    if (!currentUser) return

    const maxAttempts = awaitClaim ? CLAIM_REFRESH_MAX_ATTEMPTS : 1
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await getIdTokenResult(currentUser, true)
        if (result.claims.orgId === targetOrgId) {
          return
        }
        if (attempt < maxAttempts) {
          await new Promise<void>((resolve) => setTimeout(resolve, CLAIM_REFRESH_DELAY_MS))
        }
      }
    } catch (err) {
      console.error('[auth] refreshOrgClaim:', err)
    }
  }

  async function loadOrgContext(uid: string, membershipJustCreated = false): Promise<void> {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : null
    const ids: string[] = userData?.orgIds ?? []

    if (ids.length === 0) {
      orgId.value = null
      orgName.value = null
      orgSlug.value = null
      userRole.value = null
      pcAppId.value = null
      pcSecret.value = null
      vwModeEnabled.value = true
      settings.value = { ...DEFAULT_ORG_SETTINGS }
      return
    }

    orgId.value = ids[0]!

    // R075/P-01 — force the claim onto the token now that we know which org
    // this session belongs to. Scoped retry only when membershipJustCreated
    // is true (see refreshOrgClaim above and the onAuthStateChanged call
    // site for why).
    await refreshOrgClaim(ids[0]!, membershipJustCreated)

    const orgRef = doc(db, 'organizations', ids[0]!)
    const orgSnap = await getDoc(orgRef)
    if (orgSnap.exists()) {
      const orgData = orgSnap.data()
      orgName.value = (orgData.name as string) ?? null
      orgSlug.value = (orgData.slug as string) ?? null
      pcAppId.value = (orgData.pcAppId as string) ?? null
      pcSecret.value = (orgData.pcSecret as string) ?? null

      // R073 — the ONE defaults-merge point for the whole application. A
      // pre-v1.5 org document has no `settings` key at all; the optional
      // chain below is mandatory because noUncheckedIndexedAccess is on.
      const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}

      // Dual-read migration (R073): nested settings value first, then the
      // legacy flat field, then the hardcoded default. This is live
      // production data — do NOT collapse this to `orgSettings.vwModeEnabled
      // ?? true`, which would silently turn Vertical Worship back ON for a
      // church that deliberately turned it off via the flat field. No
      // read-triggered backfill is performed here; the backfill is
      // write-triggered, delivered by the Settings toggle's save handler
      // switching its write target to the `settings.vwModeEnabled` dot-path.
      // Computed once and applied to BOTH `settings.value.vwModeEnabled` and
      // the standalone `vwModeEnabled` ref so they can never disagree.
      const resolvedVwModeEnabled =
        orgSettings.vwModeEnabled ?? (orgData.vwModeEnabled as boolean | undefined) ?? true

      settings.value = {
        ...DEFAULT_ORG_SETTINGS,
        ...orgSettings,
        vwModeEnabled: resolvedVwModeEnabled
      }
      vwModeEnabled.value = resolvedVwModeEnabled
    }

    // Unsubscribe from previous listener if any
    memberUnsub?.()
    memberUnsub = onSnapshot(
      doc(db, 'organizations', ids[0]!, 'members', uid),
      async (snap) => {
        if (!snap.exists()) {
          userRole.value = null
          return
        }
        const data = snap.data()
        const role = data.role as string

        // One-time migration: admin → editor + backfill missing fields
        const patch: Record<string, unknown> = {}
        if (role === 'admin') patch.role = 'editor'
        if (!data.email && user.value?.email) {
          patch.email = user.value!.email ?? ''
          patch.displayName = user.value!.displayName ?? ''
        }
        if (Object.keys(patch).length > 0) {
          await updateDoc(snap.ref, patch)
          if (role === 'admin') return // next snapshot sets userRole
        }

        userRole.value = (role === 'admin' ? 'editor' : role) as 'editor' | 'viewer'
      },
    )
  }

  // Listen for auth state changes
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser
    if (firebaseUser) {
      // T-40-07 / P-01 — this is the invite-acceptance race window: the
      // batch commit inside ensureUserDocument returns before the async
      // syncOrgMembershipClaim Cloud Functions trigger has necessarily
      // finished setting the claim, so a forced refresh fired on the very
      // next line can complete before the claim exists. membershipCreated
      // tells loadOrgContext to retry (bounded) instead of firing one
      // refresh and giving up.
      const { membershipCreated } = await ensureUserDocument(firebaseUser)
      await loadOrgContext(firebaseUser.uid, membershipCreated)
    } else {
      orgId.value = null
      orgName.value = null
      orgSlug.value = null
      userRole.value = null
      vwModeEnabled.value = true
      settings.value = { ...DEFAULT_ORG_SETTINGS }
      memberUnsub?.()
      memberUnsub = null
    }
    isReady.value = true
  })

  async function ensureUserDocument(firebaseUser: User): Promise<{ membershipCreated: boolean }> {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    // Update/create the user profile document
    await setDoc(
      userRef,
      {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    // Always check for pending invite (even if user already has an org)
    const userData = userSnap.exists() ? userSnap.data() : null
    const hasOrg = userData?.orgIds && userData.orgIds.length > 0
    const email = firebaseUser.email?.toLowerCase()

    if (email) {
      const lookupRef = doc(db, 'inviteLookup', email)
      const lookupSnap = await getDoc(lookupRef)

      if (lookupSnap.exists()) {
        const inviteData = lookupSnap.data()
        const inviteOrgId = inviteData.orgId as string
        const role = inviteData.role as 'editor' | 'viewer'

        const batch = writeBatch(db)

        // Delete inviteLookup entry
        batch.delete(lookupRef)

        // Delete the invite doc in the org's invites subcollection
        const inviteRef = doc(db, 'organizations', inviteOrgId, 'invites', email)
        batch.delete(inviteRef)

        // Add user as member with invited role
        const memberRef = doc(db, 'organizations', inviteOrgId, 'members', firebaseUser.uid)
        batch.set(memberRef, {
          role,
          joinedAt: serverTimestamp(),
          displayName: firebaseUser.displayName ?? '',
          email: firebaseUser.email ?? '',
        })

        // Switch user to the invited org
        batch.update(userRef, { orgIds: [inviteOrgId] })

        await batch.commit()
        return { membershipCreated: true }
      }
    }

    if (!hasOrg) {
      // No invite found and no org — auto-create new org for this user
      const batch = writeBatch(db)

      const orgRef = doc(collection(db, 'organizations'))
      const newOrgId = orgRef.id

      batch.set(orgRef, {
        name: `${firebaseUser.displayName || 'My'}'s Church`,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.uid,
      })

      const memberRef = doc(db, 'organizations', newOrgId, 'members', firebaseUser.uid)
      batch.set(memberRef, {
        role: 'editor',
        joinedAt: serverTimestamp(),
        displayName: firebaseUser.displayName ?? '',
        email: firebaseUser.email ?? '',
      })

      batch.update(userRef, {
        orgIds: [newOrgId],
      })

      await batch.commit()
      return { membershipCreated: true }
    }

    return { membershipCreated: false }
  }

  async function loginWithGoogle(): Promise<User | null> {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await ensureUserDocument(result.user)
      return result.user
    } catch (error: unknown) {
      const firebaseError = error as { code?: string }
      if (firebaseError?.code === 'auth/popup-closed-by-user') {
        return null
      }
      throw error
    }
  }

  async function loginWithEmail(email: string, password: string): Promise<User | null> {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      await ensureUserDocument(result.user)
      return result.user
    } catch (error: unknown) {
      const firebaseError = error as { code?: string }
      if (
        firebaseError?.code === 'auth/user-not-found' ||
        firebaseError?.code === 'auth/invalid-credential'
      ) {
        // Auto-create account on first sign-in
        const result = await createUserWithEmailAndPassword(auth, email, password)
        await ensureUserDocument(result.user)
        return result.user
      }
      throw error
    }
  }

  async function registerWithEmail(email: string, password: string): Promise<User | null> {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await ensureUserDocument(result.user)
    return result.user
  }

  async function resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email)
  }

  async function logout(): Promise<void> {
    orgId.value = null
    orgName.value = null
    orgSlug.value = null
    userRole.value = null
    pcAppId.value = null
    pcSecret.value = null
    vwModeEnabled.value = true
    settings.value = { ...DEFAULT_ORG_SETTINGS }
    memberUnsub?.()
    memberUnsub = null
    await signOut(auth)
  }

  function setPcCredentials(
    appId: string | null,
    secret: string | null,
  ) {
    pcAppId.value = appId
    pcSecret.value = secret
  }

  return {
    user,
    isReady,
    isAuthenticated,
    orgId,
    orgName,
    orgSlug,
    userRole,
    isEditor,
    waitForRole,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    ensureUserDocument,
    pcAppId,
    pcSecret,
    hasPcCredentials,
    pcCredentials,
    setPcCredentials,
    vwModeEnabled,
    settings,
  }
})
