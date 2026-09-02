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
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { OrgSettings } from '@/types/organization'
import { DEFAULT_ORG_SETTINGS } from '@/types/organization'
import { SLIDE_FONTS } from '@/config/slideFonts'
import { loadFontCss, snapWeight } from '@/utils/slideTypography'

let memberUnsub: Unsubscribe | null = null

// ARCH-001 (Phase 111, T-111-01/T-111-02, D-ARCH-001; hardened post-111-REVIEW
// CR-01) — a generation/epoch token guarding EVERY shared-state mutation
// point in loadOrgContext below (not just the final memberUnsub onSnapshot
// assignment). Every loadOrgContext call captures the post-increment value
// into a local `myEpoch` at its very top, then re-checks that captured value
// against this counter (via the local `isStale()` helper) immediately after
// EVERY await and before EVERY subsequent write to a shared ref
// (memberships/orgId/settings/etc. via applyOrgSnapshot) or call to
// resetOrgContext() — including each of its three early-return branches, not
// only the tail onSnapshot assignment. A superseded/interleaved call (one
// whose awaits settle after a newer loadOrgContext call has already started)
// will always find a mismatch at its very next checkpoint and returns
// WITHOUT mutating any shared state or touching memberUnsub — so it can
// never win the race, clobber a newer call's context, or orphan/tear down a
// newer call's listener.
// Store-layer defense-in-depth: protects ALL callers (selectOrg,
// enterOrgAsSuperAdmin's sibling loadOrgContext calls via exitSuperAdminView,
// logout's re-entry, and the initial onAuthStateChanged load), not just the
// two with UI-level in-flight guards (switchingId / enteringOrgId).
let loadOrgContextEpoch = 0

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
  // See ADR-0145 (docs/adr/0145-memorable-share-url-slug-r-02-d-18-used-to-build.md)
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

  // See ADR-0146 (docs/adr/0146-church-level-vertical-worship-1-2-3-methodology-toggle-d-15.md)
  const vwModeEnabled = ref(true)

  // The one typed org-settings object every consumer reads (R073). Merged with
  // DEFAULT_ORG_SETTINGS at a single point (loadOrgContext) so no consumer ever
  // writes its own `?? default` fallback. Mirror-written from Settings, exactly
  // like vwModeEnabled above — NOT live-synced via onSnapshot. Initialized to a
  // fresh spread copy, never the shared DEFAULT_ORG_SETTINGS constant itself, so
  // nothing can mutate the default object.
  const settings = ref<OrgSettings>({ ...DEFAULT_ORG_SETTINGS })

  // See ADR-0147 (docs/adr/0147-phase-82-r242-r243-the-super-admin-master-ai-gate-read-from.md)
  const aiMasterEnabled = ref(false)

  // Phase 101 (R295) — the super-admin MASTER Bible API gate, read from the
  // org doc's top-level `bibleApiEnabled` field. Absent/false => OFF
  // (default) — every org starts OFF until a super-admin enables it via
  // setOrgBibleEnabled (Plan 01). Mirror-written from applyOrgSnapshot, NOT
  // live-synced via onSnapshot — same latency posture as aiMasterEnabled
  // above. SINGLE-LEG: unlike aiMasterEnabled, there is no church-editable
  // `settings.bibleApiEnabled` leaf this milestone (deferred) — this is the
  // ONLY gate. Consumed by Phases 102/103's scripture-fetch gate.
  const bibleApiEnabled = ref(false)

  // Login church-picker + sidebar church-switcher source.
  // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
  // src/stores/auth.ts).
  const memberships = ref<{ id: string; name: string; active: boolean; role: 'editor' | 'viewer' }[]>([])

  // R213 (Phase 76) — set by loadOrgContext when the active/selected org's
  // doc read is denied (post-76-01 rules shape) or explicitly `active:
  // false`. Null means no deactivation is in effect. Never treat this as the
  // security boundary — see auth.ts's header comment / 76-02-PLAN.md.
  const deactivatedOrgMessage = ref<string | null>(null)
  const hasDeactivatedOrg = computed(() => deactivatedOrgMessage.value !== null)

  // R224/R226 (Phase 78) — the org id a super-admin is temporarily VIEWING
  // See ADR-0148 (docs/adr/0148-via-enterorgassuperadmin-with-no-membership-document-of-thei.md)
  const viewingAsSuperAdmin = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const isEditor = computed(() => userRole.value === 'editor')

  // See ADR-0074 (docs/adr/0074-the-single-shared-two-gate-ai-affordance-check-mirrors.md)
  const isAiEnabled = computed(() => aiMasterEnabled.value && settings.value.aiEnabled)

  // Phase 101 (R295) — SINGLE-LEG gate: unlike isAiEnabled above, there is no
  // church-editable settings.bibleApiEnabled leaf this milestone, so this
  // does NOT AND against settings — it simply mirrors the master field.
  const isBibleApiEnabled = computed(() => bibleApiEnabled.value)

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

  // Quick 260823 (Phase 78 UAT follow-up) — a super-admin who belongs to NO
  // church. Such a session has no Services / own-church nav to land on, so the
  // router sends it to the Owner Console rather than the (empty) /select-church
  // picker. Distinct from `hasNoOrg`, which stays viewingAsSuperAdmin-guarded
  // for the enter-a-church flow; this one keys purely on real memberships.
  const isChurchlessSuperAdmin = computed(
    () => isSuperAdmin.value && memberships.value.length === 0,
  )
  // True whenever a super-admin is NOT currently inside their own church —
  // either viewing another church via enterOrgAsSuperAdmin, or sitting at the
  // Owner Console with no active own-church context. Drives the sidebar's
  // "not in a church" clarity indicator so the super-admin always knows where
  // they are (owner UAT ask, 2026-08-23).
  const superAdminOutsideOwnChurch = computed(
    () => isSuperAdmin.value && (viewingAsSuperAdmin.value !== null || orgId.value === null),
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

  // See ADR-0149 (docs/adr/0149-68-review-md-the-requiressuperadmin-router-guard-read.md)
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

  // R075 (D-06/D-07) / P-01 — forces the orgId/role claim onto the token; never throws.
  // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
  // src/stores/auth.ts).
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

  // See ADR-0148 (docs/adr/0148-via-enterorgassuperadmin-with-no-membership-document-of-thei.md)
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

  // See ADR-0150 (docs/adr/0150-r213-phase-76-the-same-full-org-context-reset-the-pre-existi.md)
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
    aiMasterEnabled.value = false
    bibleApiEnabled.value = false
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

    // Dual-read migration (R073) — do NOT collapse to `?? true`.
    // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
    // src/stores/auth.ts).
    const resolvedVwModeEnabled =
      orgSettings.vwModeEnabled ?? (orgData.vwModeEnabled as boolean | undefined) ?? true

    // See ADR-0151 (docs/adr/0151-slidetypography-is-deep-merged-specifically-the-plain.md)
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

    // Phase 82 (R242) — DEFAULT OFF: absent field reads as false, deliberately
    // NOT the `?? true` vwModeEnabled uses above, since AI must default off
    // for every org. No dual-read/legacy-field precedent exists for this
    // field (brand new this phase), so a plain `?? false` is sufficient.
    aiMasterEnabled.value = (orgData.aiMasterEnabled as boolean | undefined) ?? false

    // Phase 101 (R295) — DEFAULT OFF, same posture as aiMasterEnabled above.
    bibleApiEnabled.value = (orgData.bibleApiEnabled as boolean | undefined) ?? false

    // See ADR-0152 (docs/adr/0152-46-review-md-eager-load-the-org-s-actual-chosen-slide-face-h.md)
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

    // ARCH-001 — capture this call's generation. See loadOrgContextEpoch's
    // header comment (module scope, above) for the full race this guards.
    // 111-REVIEW CR-01: `isStale()` is re-checked after EVERY await below,
    // immediately before the next shared-state mutation (memberships/orgId/
    // applyOrgSnapshot's writes) or resetOrgContext() call/early-return — not
    // only once at the tail. A superseded call must bail at its very next
    // checkpoint, never reaching a later mutation via an earlier branch.
    const myEpoch = ++loadOrgContextEpoch
    const isStale = (): boolean => myEpoch !== loadOrgContextEpoch

    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    if (isStale()) return
    const userData = userSnap.exists() ? userSnap.data() : null
    const orgIds: string[] = userData?.orgIds ?? []

    // Bug 1b (quick 260830-l9c) — self-heals a clobbered orgIds array from the claim.
    // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
    // src/stores/auth.ts).
    let claimOrgs: Record<string, unknown> = {}
    const currentUser = user.value
    if (currentUser) {
      try {
        const tokenResult = await getIdTokenResult(currentUser, false)
        if (isStale()) return
        claimOrgs = (tokenResult.claims.orgs ?? {}) as Record<string, unknown>
      } catch (err) {
        console.error('[auth] loadOrgContext claim read:', err)
      }
    }
    // orgIds first — keeps the primary/index-0 org leading the picker — then
    // any claim-only orgs orgIds hasn't caught up to yet, deduped.
    const ids: string[] = [
      ...orgIds,
      ...Object.keys(claimOrgs).filter((id) => !orgIds.includes(id)),
    ]

    // Builds the church-picker membership list; one bad org read never blanks the list.
    // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
    // src/stores/auth.ts).
    // Phase 104 (R311) — per-org role, threaded from claimOrgs onto every
    // membership entry so the sidebar church switcher's role badge has data
    // to render. 'editor' only on an explicit 'editor' claim value; every
    // other case (viewer claim, no role string, or the id absent from the
    // claim entirely because it hasn't caught up yet) resolves to 'viewer' —
    // never throws, never drops the entry.
    const roleFor = (id: string): 'editor' | 'viewer' =>
      claimOrgs[id] === 'editor' ? 'editor' : 'viewer'

    const resolvedMemberships = await Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'organizations', id))
          if (!snap.exists()) return { id, name: id, active: true, role: roleFor(id) }
          const data = snap.data()
          const name = (data.name as string) || id
          const active = (data.active as boolean | undefined) ?? true
          return { id, name, active, role: roleFor(id) }
        } catch {
          return { id, name: id, active: false, role: roleFor(id) }
        }
      }),
    )
    // 111-REVIEW CR-01: check-then-assign — resolve the Promise.all into a
    // local first, THEN gate the write to the shared `memberships` ref on
    // isStale(), so a superseded call never overwrites a newer call's
    // church-picker list.
    if (isStale()) return
    memberships.value = resolvedMemberships

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
      // 111-REVIEW CR-01: no await happened since the last isStale() check
      // above, but resetOrgContext() tears down memberUnsub — re-check
      // immediately before it anyway, matching the guard-every-mutation-site
      // rule so this branch never depends on reasoning about upstream state.
      if (isStale()) return
      resetOrgContext()
      return
    }

    if (isStale()) return
    orgId.value = activeId

    // R075/P-01 — force the claim onto the token now that we know which org
    // this session belongs to. Scoped retry only when membershipJustCreated
    // is true (see refreshOrgClaim above and the onAuthStateChanged call
    // site for why). Also the source of isSuperAdmin.value used by the
    // deactivation exemption check just below.
    await refreshOrgClaim(activeId, membershipJustCreated)
    if (isStale()) return

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
      // 111-REVIEW CR-01: this resetOrgContext()/memberUnsub-teardown branch
      // was previously completely unguarded — a stale call reaching here
      // could tear down a newer call's live listener. Gate it.
      if (isStale()) return
      resetOrgContext()
      deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
      return
    }
    if (isStale()) return
    if (orgSnap.exists()) {
      const orgData = orgSnap.data()

      // Defensive second layer (structurally unreachable for a genuine
      // non-super-admin today, since the rules deny the read outright): a
      // successful read carrying `active: false` is still treated as
      // deactivated unless the caller is a super-admin (the rules' narrow
      // exemption for a super-admin with a genuine membership doc).
      const isActive = (orgData.active as boolean | undefined) ?? true
      if (isActive === false && !isSuperAdmin.value) {
        // 111-REVIEW CR-01: same reasoning as the catch block above — this
        // resetOrgContext() branch is a memberUnsub-teardown site and must
        // never run for a superseded call.
        if (isStale()) return
        resetOrgContext()
        deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
        return
      }

      applyOrgSnapshot(orgData)
    }

    // ARCH-001 — the final epoch re-check, immediately before the
    // memberUnsub onSnapshot assignment below, so check-then-assign runs
    // synchronously with no await between them (T-111-01). Kept in addition
    // to (not instead of) the isStale() checkpoints above — this is the last
    // line of defense right before the one write every earlier checkpoint
    // exists to protect.
    if (isStale()) {
      return
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
      // WR-01 (111-REVIEW.md) — invalidate any loadOrgContext call still in
      // flight (e.g. suspended in refreshOrgClaim's retry window) BEFORE
      // tearing down memberUnsub below, so that call's own isStale() check
      // (whichever checkpoint it resumes at) finds a mismatch and can never
      // attach a fresh listener for an already-signed-out session.
      loadOrgContextEpoch++
      orgId.value = null
      orgName.value = null
      orgSlug.value = null
      userRole.value = null
      isSuperAdmin.value = false
      vwModeEnabled.value = true
      settings.value = { ...DEFAULT_ORG_SETTINGS }
      aiMasterEnabled.value = false
      bibleApiEnabled.value = false
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
    // Quick 260823-switch-church-cache: clear stale org-scoped store data before
    // loading the newly-selected church so nothing from the previous church
    // flashes during the switch.
    const { resetOrgScopedStores } = await import('./orgScopedStores')
    resetOrgScopedStores()
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
  // See ADR-0098 (docs/adr/0098-enterorgassuperadmin-now-signals-success-failure-instead-of.md)
  async function enterOrgAsSuperAdmin(targetOrgId: string): Promise<boolean> {
    if (!user.value || !isSuperAdmin.value) return false
    resetOrgContext()
    // Quick 260823-switch-church-cache: clear all org-scoped store data so the
    // church being entered never briefly shows the previous church's services/
    // songs/roster while their listeners re-point.
    const { resetOrgScopedStores } = await import('./orgScopedStores')
    resetOrgScopedStores()
    let orgSnap
    try {
      orgSnap = await getDoc(doc(db, 'organizations', targetOrgId))
    } catch (err) {
      console.error('[auth] enterOrgAsSuperAdmin:', err)
      return false
    }
    if (!orgSnap.exists()) return false
    orgId.value = targetOrgId
    viewingAsSuperAdmin.value = targetOrgId
    applyOrgSnapshot(orgSnap.data())
    userRole.value = 'editor'
    return true
  }

  // R227 — ends a super-admin's cross-tenant visit, restoring the store to
  // its pre-visit (no-org) state.
  async function exitSuperAdminView(): Promise<void> {
    if (viewingAsSuperAdmin.value === null) return
    // IN-01 (78-REVIEW.md): resetOrgContext() below already sets
    // viewingAsSuperAdmin.value = null -- no separate clear needed here.
    resetOrgContext()
    // Quick 260823-switch-church-cache: clear the visited church's store data
    // before restoring the super-admin's own church so its services/songs/etc.
    // don't linger during the switch back.
    const { resetOrgScopedStores } = await import('./orgScopedStores')
    resetOrgScopedStores()
    // Quick 260823: restore the super-admin's OWN church context so exiting a
    // visited church returns them to their normal nav (own church + Owner
    // Console) instead of the partial no-org state that left only a stray
    // "Services" link. A churchless super-admin resolves to no active org
    // (loadOrgContext's activeId === null branch); the router then lands them
    // on the Owner Console via isChurchlessSuperAdmin.
    if (user.value) {
      await loadOrgContext(user.value.uid, false)
    }
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

        // Bug 1a (quick 260830-l9c) — APPEND, don't replace: a prior invite
        // acceptance may have already put a different org at orgIds[0] (the
        // primary org functions/src/orgMembershipClaims.ts's decideMembershipClaim
        // reads via orgIds[0]). arrayUnion appends to the end and never
        // reorders existing elements, so the original primary survives a
        // second church's invite instead of being clobbered down to one entry.
        batch.update(userRef, { orgIds: arrayUnion(inviteOrgId) })

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
    // WR-01 (111-REVIEW.md) — see the matching comment in onAuthStateChanged's
    // sign-out branch: invalidate any loadOrgContext call still in flight so
    // it cannot attach a fresh memberUnsub listener after this signs out.
    loadOrgContextEpoch++
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
    aiMasterEnabled.value = false
    bibleApiEnabled.value = false
    deactivatedOrgMessage.value = null
    viewingAsSuperAdmin.value = null
    memberUnsub?.()
    memberUnsub = null
    // Bug 2a (quick 260830-l9c) — tear down all org-scoped store listeners
    // BEFORE the token is revoked, so none of them fail a Firestore rule
    // mid-signOut. Same dynamic-import pattern selectOrg/enterOrgAsSuperAdmin/
    // exitSuperAdminView already use (avoids an auth<->store import cycle).
    const { resetOrgScopedStores } = await import('./orgScopedStores')
    resetOrgScopedStores()
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
    isChurchlessSuperAdmin,
    superAdminOutsideOwnChurch,
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
    aiMasterEnabled,
    isAiEnabled,
    bibleApiEnabled,
    isBibleApiEnabled,
  }
})
