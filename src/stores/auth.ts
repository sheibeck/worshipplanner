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

// Per-session memory of which church a multi-org user chose to enter. Kept in
// sessionStorage (NOT localStorage) so it survives a page refresh but a full
// logout clears it — matching "log out and back in to switch churches". Keyed
// by uid so one browser session can't leak a choice across accounts. Every
// access is guarded: sessionStorage throws in some privacy modes.
const SELECTED_ORG_STORAGE_KEY = 'wp.selectedOrg'

function readRememberedOrg(uid: string): string | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_ORG_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
    return parsed.uid === uid && typeof parsed.orgId === 'string' ? parsed.orgId : null
  } catch {
    return null
  }
}

function rememberOrg(uid: string, orgId: string): void {
  try {
    sessionStorage.setItem(SELECTED_ORG_STORAGE_KEY, JSON.stringify({ uid, orgId }))
  } catch {
    // sessionStorage unavailable (private mode / disabled) — the choice simply
    // won't persist across a refresh; not fatal.
  }
}

function clearRememberedOrg(): void {
  try {
    sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY)
  } catch {
    // ignore — see rememberOrg
  }
}

// R213 (Phase 76) — the client login-block copy shown when a member's
// active/selected org has been deactivated. Generic by design (T-76-08): the
// same copy covers a genuine deactivation, an orphaned membership, or any
// other denied/failed org-doc read — never leaking a raw Firebase error code
// or message to the end user.
const DEACTIVATED_ORG_MESSAGE = 'This church is deactivated — contact your administrator.'

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

  // The organizations the signed-in user belongs to ({id, name, active}) — the
  // source the login church-picker renders when a user belongs to more than
  // one. Populated by loadOrgContext. `active` defaults to `true` for a
  // readable org doc with no `active` field (legacy orgs); a caught read
  // failure (deactivation OR a stale/orphaned membership) conservatively
  // defaults to `false` (R213/T-76-08).
  const memberships = ref<{ id: string; name: string; active: boolean }[]>([])

  // R213 (Phase 76) — set by loadOrgContext when the active/selected org's
  // doc read is denied (post-76-01 rules shape) or explicitly `active:
  // false`. Null means no deactivation is in effect. Never treat this as the
  // security boundary — see auth.ts's header comment / 76-02-PLAN.md.
  const deactivatedOrgMessage = ref<string | null>(null)
  const hasDeactivatedOrg = computed(() => deactivatedOrgMessage.value !== null)

  // R224/R226 (Phase 78) — the org id a super-admin is temporarily VIEWING
  // via enterOrgAsSuperAdmin, with NO membership document of their own.
  // Null means no such visit is in effect. Purely client/UI-gating state —
  // never the security boundary; every Firestore/Storage op made while set
  // is independently re-checked by firestore.rules/storage.rules' own
  // super-admin arm (78-01-PLAN.md). Must be cleared alongside orgId/etc. in
  // ALL THREE places that reset org context inline: resetOrgContext, logout,
  // and the onAuthStateChanged null-user branch (Pitfall 4).
  const viewingAsSuperAdmin = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const isEditor = computed(() => userRole.value === 'editor')

  // Org-selection gates consumed by the router. A signed-in user with more than
  // one church and no active choice must pick one; a signed-in user with zero
  // churches has nothing to enter. Both cases route to /select-church. Guarded
  // on isReady so a mid-load transient state never triggers a spurious redirect.
  const needsOrgSelection = computed(
    () =>
      isReady.value &&
      isAuthenticated.value &&
      memberships.value.length > 1 &&
      orgId.value === null,
  )
  // R226/T-78-05 (Phase 78) — `&& viewingAsSuperAdmin.value === null` keeps a
  // super-admin who just entered a church (zero real memberships, the
  // expected account shape) from bouncing straight back to /select-church on
  // the very next navigation. Do NOT "fix" this by pushing the viewed org
  // into `memberships` instead — that array is what the church-picker
  // renders, and R226 requires the super-admin's own picker to stay empty.
  const hasNoOrg = computed(
    () =>
      isReady.value &&
      isAuthenticated.value &&
      memberships.value.length === 0 &&
      viewingAsSuperAdmin.value === null,
  )
  // R213 (Phase 76) — a lone deactivated org fits neither needsOrgSelection
  // (>1) nor hasNoOrg (===0): hasDeactivatedOrg widens the gate to also
  // redirect that single-org-deactivated case to /select-church.
  const requiresOrgSelection = computed(
    () => needsOrgSelection.value || hasNoOrg.value || hasDeactivatedOrg.value,
  )

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

  // WR-03 (68-REVIEW.md) — the requiresSuperAdmin router guard read
  // authStore.user without waiting for the store's own onAuthStateChanged
  // listener to have populated it, unlike requiresEditor's waitForRole()
  // above. That listener is only registered on the FIRST useAuthStore() call
  // anywhere in the app (Pinia stores are lazy), so a fresh page-load/reload
  // directly on a super-admin-only route had an implicit, untested ordering
  // dependency on when that first call happened to occur. waitForReady()
  // gives requiresSuperAdmin the same explicit wait shape as waitForRole():
  // it resolves immediately once isReady is already true, otherwise it waits
  // for the onAuthStateChanged listener below to flip isReady true (whether
  // the resolved user is present or null) before the guard proceeds to call
  // refreshSuperAdminClaim().
  function waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (isReady.value) {
        resolve()
        return
      }
      const unwatch = watch(isReady, (val) => {
        if (val) {
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

  // R213 (Phase 76) — the SAME full org-context reset the pre-existing
  // `activeId === null` branch performs, factored out so the two new
  // deactivation-detection branches below share it exactly rather than
  // drifting from that branch's field list over time.
  //
  // WR-01 (78-REVIEW.md): `deactivatedOrgMessage` is cleared HERE, not just
  // by loadOrgContext's own unconditional clear at its top. Before this,
  // `enterOrgAsSuperAdmin`/`exitSuperAdminView` were the first callers of
  // resetOrgContext() that bypass loadOrgContext entirely, so a stale
  // non-null deactivatedOrgMessage from an earlier deactivated-org bounce
  // survived a super-admin's enter/exit and kept `hasDeactivatedOrg` (and
  // therefore `requiresOrgSelection`) true — stranding them at
  // /select-church on the very next navigation, the same router-strand
  // class `hasNoOrg`'s viewingAsSuperAdmin guard was written to close.
  // Clearing it in this single shared reset point means every caller
  // (loadOrgContext's own branches included) stays in sync automatically;
  // loadOrgContext's genuine-deactivation branches set it back to non-null
  // on the line immediately AFTER their resetOrgContext() call, so this
  // does not mask a real deactivation.
  function resetOrgContext(): void {
    memberUnsub?.()
    memberUnsub = null
    orgId.value = null
    orgName.value = null
    orgSlug.value = null
    userRole.value = null
    pcAppId.value = null
    pcSecret.value = null
    vwModeEnabled.value = true
    settings.value = { ...DEFAULT_ORG_SETTINGS }
    viewingAsSuperAdmin.value = null
    deactivatedOrgMessage.value = null
  }

  // Extracted from loadOrgContext (78-02, R224) so enterOrgAsSuperAdmin below
  // can reuse the SAME org-snapshot -> store-state hydration without
  // duplicating the settings-merge logic — a future settings-shape change
  // would otherwise only land in one of the two call sites. Pure extraction,
  // no behavior change: `orgData` is typed as `Record<string, unknown>` to
  // match this block's existing `as` casts.
  function applyOrgSnapshot(orgData: Record<string, unknown>): void {
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

  async function loadOrgContext(uid: string, membershipJustCreated = false): Promise<void> {
    // R213 — clear any stale deactivation message from a prior org-context
    // load BEFORE any branch below, so it never lingers across an org switch.
    deactivatedOrgMessage.value = null

    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : null
    const ids: string[] = userData?.orgIds ?? []

    // Build the membership list ({id, name, active}) the church picker
    // renders. Each org doc is read individually and guarded: an org the user
    // has an orgIds entry for but can't cleanly read (e.g. a stale/orphaned id
    // with no member doc, or — post-76-01 — a deactivated org's own member
    // being denied) falls back to its id and `active: false` instead of
    // rejecting the whole list, so one bad membership never blanks or breaks
    // the picker (R213/T-76-08).
    memberships.value = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'organizations', id))
          if (!snap.exists()) return { id, name: id, active: true }
          const data = snap.data()
          const name = (data.name as string) || id
          const active = (data.active as boolean | undefined) ?? true
          return { id, name, active }
        } catch {
          return { id, name: id, active: false }
        }
      }),
    )

    // Resolve the active org for this session:
    //  - a remembered choice for THIS user (survives refresh, cleared on logout),
    //  - else the sole org when there is exactly one,
    //  - else null: 0 orgs (no church) or >1 orgs with no choice yet (must pick).
    // A null result leaves org context empty; the router's org-selection gate
    // routes such a session to /select-church.
    const remembered = readRememberedOrg(uid)
    const activeId =
      remembered && ids.includes(remembered) ? remembered : ids.length === 1 ? ids[0]! : null

    if (activeId === null) {
      resetOrgContext()
      return
    }

    orgId.value = activeId

    // R075/P-01 — force the claim onto the token now that we know which org
    // this session belongs to. Scoped retry only when membershipJustCreated
    // is true (see refreshOrgClaim above and the onAuthStateChanged call
    // site for why). Also the source of isSuperAdmin.value used by the
    // deactivation exemption check just below.
    await refreshOrgClaim(activeId, membershipJustCreated)

    // R213 (Phase 76) — once 76-01-PLAN.md's firestore.rules ship, this read
    // is DENIED (rejects) for a deactivated org's ordinary (non-super-admin)
    // member. An uncaught rejection here would propagate out of the
    // onAuthStateChanged handler and leave isReady never set to true —
    // exactly the "blank app" R213 forbids (T-76-09). Treat the denial
    // itself as the deactivation signal.
    const orgRef = doc(db, 'organizations', activeId)
    let orgSnap
    try {
      orgSnap = await getDoc(orgRef)
    } catch {
      resetOrgContext()
      deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
      return
    }
    if (orgSnap.exists()) {
      const orgData = orgSnap.data()

      // Defensive second layer (structurally unreachable for a genuine
      // non-super-admin today, since the rules deny the read outright): a
      // successful read carrying `active: false` is still treated as
      // deactivated unless the caller is a super-admin (the rules' narrow
      // exemption for a super-admin with a genuine membership doc).
      const isActive = (orgData.active as boolean | undefined) ?? true
      if (isActive === false && !isSuperAdmin.value) {
        resetOrgContext()
        deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
        return
      }

      applyOrgSnapshot(orgData)
    }

    // Unsubscribe from previous listener if any
    memberUnsub?.()
    memberUnsub = onSnapshot(
      doc(db, 'organizations', activeId, 'members', uid),
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
      memberships.value = []
      deactivatedOrgMessage.value = null
      viewingAsSuperAdmin.value = null
      memberUnsub?.()
      memberUnsub = null
    }
    isReady.value = true
  })

  // Switches the active org for a multi-church user to `targetOrgId` (which must
  // be one they belong to), remembers the choice for the session, and reloads
  // org context. Consumed by SelectChurchView.
  async function selectOrg(targetOrgId: string): Promise<void> {
    const currentUser = user.value
    if (!currentUser) return
    if (!memberships.value.some((m) => m.id === targetOrgId)) return
    rememberOrg(currentUser.uid, targetOrgId)
    await loadOrgContext(currentUser.uid, false)
  }

  // R224/R226/R227 (Phase 78, 78-RESEARCH.md Pattern 4) — switches active org
  // context to `targetOrgId` for a super-admin who does NOT belong to it,
  // WITHOUT creating a membership document. `isSuperAdmin`/`user.value` are
  // guarded here only as a LOCAL convenience (mirrors isSuperAdmin's own
  // documented "must never be treated as access control on its own" posture)
  // — the real boundary is firestore.rules'/storage.rules' super-admin arm
  // (78-01-PLAN.md). Writes NOTHING to Firestore (R226): no setDoc/writeBatch,
  // no members/{uid} onSnapshot subscription (there is no member doc for it
  // to find — if started, its first callback would immediately null userRole
  // back out). Deliberately performs NO isOrgActive/deactivation check,
  // unlike loadOrgContext — the rules layer already grants a super-admin
  // unconditional access to a deactivated org's doc, and entering one for
  // support is intended, not a bug to guard against.
  async function enterOrgAsSuperAdmin(targetOrgId: string): Promise<void> {
    if (!user.value || !isSuperAdmin.value) return
    resetOrgContext()
    let orgSnap
    try {
      orgSnap = await getDoc(doc(db, 'organizations', targetOrgId))
    } catch (err) {
      console.error('[auth] enterOrgAsSuperAdmin:', err)
      return
    }
    if (!orgSnap.exists()) return
    orgId.value = targetOrgId
    viewingAsSuperAdmin.value = targetOrgId
    applyOrgSnapshot(orgSnap.data())
    userRole.value = 'editor'
  }

  // R227 — ends a super-admin's cross-tenant visit, restoring the store to
  // its pre-visit (no-org) state.
  function exitSuperAdminView(): void {
    if (viewingAsSuperAdmin.value === null) return
    resetOrgContext()
    viewingAsSuperAdmin.value = null
  }

  async function ensureUserDocument(firebaseUser: User): Promise<{ membershipCreated: boolean }> {
    const userRef = doc(db, 'users', firebaseUser.uid)

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

    // Always check for a pending invite (keyed by email) — an invite is now the
    // ONLY way a signed-in user acquires org membership on login.
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

    // No pending invite: a signed-in user is NEVER auto-provisioned an
    // organization. Organizations are created only by a super-admin via the
    // onboardOrganization callable; an un-invited, org-less user is routed to
    // the church picker's empty state by the router's org-selection gate.
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
    clearRememberedOrg()
    memberships.value = []
    orgId.value = null
    orgName.value = null
    orgSlug.value = null
    userRole.value = null
    isSuperAdmin.value = false
    pcAppId.value = null
    pcSecret.value = null
    vwModeEnabled.value = true
    settings.value = { ...DEFAULT_ORG_SETTINGS }
    deactivatedOrgMessage.value = null
    viewingAsSuperAdmin.value = null
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
    memberships,
    needsOrgSelection,
    hasNoOrg,
    deactivatedOrgMessage,
    hasDeactivatedOrg,
    requiresOrgSelection,
    selectOrg,
    viewingAsSuperAdmin,
    enterOrgAsSuperAdmin,
    exitSuperAdminView,
    isEditor,
    isSuperAdmin,
    refreshSuperAdminClaim,
    waitForRole,
    waitForReady,
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
