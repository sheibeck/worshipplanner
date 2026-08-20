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
import { SLIDE_FONTS } from '@/config/slideFonts'
import { loadFontCss, snapWeight } from '@/utils/slideTypography'
import { normalizeOrgName, claimOrgName } from '@/utils/orgName'

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

  // R177 — platform-level super-admin flag, read from the SAME decoded
  // getIdTokenResult claims as orgId/role (no extra Firestore round-trip).
  // Convenience only: the enforced boundary is firestore.rules' isSuperAdmin()
  // (Plan 03) + the setSuperAdminClaim onCall's server-side caller re-check
  // (Plan 02) — this flag must never be treated as access control on its own.
  const isSuperAdmin = ref(false)

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
        isSuperAdmin.value = result.claims.superAdmin === true
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

  // R177 (Pitfall 4) — forces a single getIdTokenResult(user, true) read and
  // updates isSuperAdmin from it. Used by the requiresSuperAdmin route guard
  // so a just-granted super-admin's next navigation picks up the fresh claim
  // instead of relying on the token's normal hourly refresh cadence. Never
  // throws: a failed refresh just leaves isSuperAdmin at its last known
  // value, and the guard's redirect-on-false still applies safely.
  async function refreshSuperAdminClaim(): Promise<void> {
    const currentUser = user.value
    if (!currentUser) {
      isSuperAdmin.value = false
      return
    }
    try {
      const result = await getIdTokenResult(currentUser, true)
      isSuperAdmin.value = result.claims.superAdmin === true
    } catch (err) {
      console.error('[auth] refreshSuperAdminClaim:', err)
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

      // WR-01 (46-REVIEW.md): `slideTypography` is deep-merged specifically
      // — the plain `...orgSettings` spread above is shallow, so a
      // partial/legacy stored value (e.g. a hand-edited Firestore document,
      // or any future write path that persists fewer than all three leaf
      // keys) would otherwise replace the whole nested object wholesale,
      // leaving `fontWeight`/`fontScale` `undefined` rather than falling
      // back to the per-field defaults. `cssVarsFor` already tolerates this
      // at render time, but `SettingsView.vue`'s local refs are initialized
      // directly from this object with no equivalent guard.
      // messaging (R130/R132/R133, Phase 58) is deep-merged for the same
      // reason as slideTypography above: the outer `...orgSettings` spread
      // is shallow, so a partial stored `messaging` object (e.g. only
      // `{ enabled: true }`) would otherwise leave sibling leaves
      // (`reminderDaysBefore`, `lockNotifyDefault`, ...) `undefined` rather
      // than falling back to their per-field defaults. `timezone` needs no
      // equivalent deep-merge — it's a flat string already covered by the
      // outer `...orgSettings` spread, same as `bibleVersion`. Brand-new
      // fields with no legacy flat-field precedent, so no dual-read.
      settings.value = {
        ...DEFAULT_ORG_SETTINGS,
        ...orgSettings,
        vwModeEnabled: resolvedVwModeEnabled,
        slideTypography: {
          ...DEFAULT_ORG_SETTINGS.slideTypography,
          ...orgSettings.slideTypography,
        },
        messaging: {
          ...DEFAULT_ORG_SETTINGS.messaging,
          ...orgSettings.messaging,
        },
      }
      vwModeEnabled.value = resolvedVwModeEnabled

      // CR-01 (46-REVIEW.md) — eager-load the org's actual chosen slide
      // face here, the ONE point every render site's settings flow
      // through. Without this, SlideGrid.vue and EditSlideDrawer.vue (the
      // grid and the Edit Slide drawer preview — soft-gate surfaces per
      // 46-UI-SPEC.md, font-display: swap) bind `--slide-font-family` to a
      // family whose @font-face rule was never registered, so the browser
      // silently falls through to its generic fallback instead of the
      // chosen font for any org whose choice differs from main.ts's eager
      // Inter default — until something ELSE (Settings, or the Presenter)
      // happens to load it first in that session. Fire-and-forget: a
      // rejected dynamic import degrades to the CSS stack's native
      // fallback, never a user-visible error (same posture as WR-03's
      // SettingsView.vue fix).
      const resolvedTypographyFamily = SLIDE_FONTS[settings.value.slideTypography.fontFamily]
        ? settings.value.slideTypography.fontFamily
        : DEFAULT_ORG_SETTINGS.slideTypography.fontFamily
      if (resolvedTypographyFamily !== DEFAULT_ORG_SETTINGS.slideTypography.fontFamily) {
        const resolvedTypographyWeight = snapWeight(
          resolvedTypographyFamily,
          settings.value.slideTypography.fontWeight,
        )
        loadFontCss(resolvedTypographyFamily, resolvedTypographyWeight).catch(() => {
          // A failed dynamic import here must never surface as an
          // unhandled rejection — the grid/drawer's font-display: swap
          // fallback already covers this case visually.
        })
      }
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
      isSuperAdmin.value = false
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

      // Claim a unique org name now that membership exists (isOrgEditor passes).
      // Best-effort + non-blocking: never fail account creation on it. The default
      // "<name>'s Church" can collide between two same-named users, so suffix
      // (" 2", " 3", …) until a name claims, then persist that final name.
      try {
        const baseName = `${firebaseUser.displayName || 'My'}'s Church`
        for (let n = 1; n <= 50; n++) {
          const candidate = n === 1 ? baseName : `${baseName} ${n}`
          if (await claimOrgName(normalizeOrgName(candidate), newOrgId)) {
            if (candidate !== baseName) {
              await updateDoc(orgRef, { name: candidate })
            }
            break
          }
        }
      } catch (err) {
        console.error('[auth] org name uniqueness claim failed (non-blocking):', err)
      }

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
    isSuperAdmin.value = false
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
    isSuperAdmin,
    refreshSuperAdminClaim,
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
