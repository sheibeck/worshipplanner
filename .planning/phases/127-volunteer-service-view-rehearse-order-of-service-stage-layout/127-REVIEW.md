---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
reviewed: 2026-09-06T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/utils/serviceProjection.ts
  - src/utils/rehearseAccess.ts
  - src/stores/services.ts
  - src/composables/useVolunteerServiceDoc.ts
  - src/views/VolunteerServiceView.vue
  - src/components/rehearse/RehearseAudioPlayerBar.vue
  - src/components/rehearse/RehearseFileReader.vue
  - src/router/index.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 127: Code Review Report

**Reviewed:** 2026-09-06
**Depth:** standard
**Files Reviewed:** 8 (config `files:` list; also read `RehearseSongList.vue`, `RehearseSongDetail.vue`, `VolunteerOrderOfService.vue`, `VolunteerStageLayoutTab.vue` per `<required_reading>` for cross-component context — findings from those are folded into the entries below where they touch a reviewed file's contract)
**Status:** issues_found

## Summary

The shared-allowlist refactor (`serviceProjection.ts`) is sound: `mapSlotAllowlist`/`mapStageMarkerAllowlist` produce the same field set `ShareView.vue` and `VolunteerOrderOfService.vue` actually read, free-text (`notes`/`body`/`note`) is dropped unconditionally for both consumers, and `buildServiceSnapshot`/`buildRehearseAccess` both route through the one copy — no drift found between the two call sites. `useVolunteerServiceDoc.ts` resolves `orgId` exclusively from the volunteer's own `mySchedule` store (never a route/query value) and never skips the live `getDoc` re-check, so the `parentIsPlanned()` rule remains the actual backstop, not a client-side status check — confirmed correct on direct trace-through.

Four issues are worth fixing before this ships, none of them a fresh authorization bypass: one is a reachable UX bug (a Download fallback that can navigate a volunteer off the whole app instead of downloading), one is a stale-data bug on direct navigation between two rehearse links, and two are PII-adjacent observations — one pre-existing since Phase 125/126 and resurfaced by this review's explicit PII questions, one a latent gap in the shared `roleAssignments` builder itself.

## Warnings

### WR-01: Desktop PDF-preview error fallback can navigate the volunteer off the SPA instead of downloading

**File:** `src/components/rehearse/RehearseFileReader.vue:51-61`
**Issue:** When the iframe's `@error` fires, the fallback UI renders a plain `<a :href="attachment.downloadUrl" download>`. `attachment.downloadUrl` is a cross-origin Firebase Storage URL. This project has already identified and fixed exactly this failure mode elsewhere in the *same file* (see the `downloadAttachment()` function at line 176-194, whose own comment reads: "a plain `<a download>` on a cross-origin Storage URL silently ignores the `download` attribute and navigates the whole SPA away instead of prompting Save"). The error-state anchor at line 53-60 does not use that fetch→blob→objectURL pattern, so a volunteer whose PDF preview fails to load and who clicks "Download" is at risk of being navigated away from `/volunteer/service/:id` entirely (their whole rehearse hub, including the persistent audio player) instead of getting a Save dialog. This exact anchor shape is inherited verbatim from `SongFilePreviewModal.vue`'s own (also-unfixed) error state, so it is not a new pattern, but it is now live on a read-only, no-recovery-affordance volunteer page rather than an authenticated editor's dismissible modal.
**Fix:** Replace the plain anchor with the same `downloadAttachment()` helper already defined lower in this component (or a shared version), the same way the mobile Download button already does it:
```vue
<button type="button" data-testid="rehearse-reader-error-download" @click="downloadAttachment" class="...">
  Download
</button>
```

### WR-02: `serviceId` is captured non-reactively from the route — navigating between two rehearse links reuses the component and shows stale data

**File:** `src/views/VolunteerServiceView.vue:253-254`, `src/composables/useVolunteerServiceDoc.ts:25`
**Issue:** `const serviceId = route.params.serviceId as string` is read once at `setup()` time and passed into `useVolunteerServiceDoc(serviceId)` as a plain string, not a ref/computed. Vue Router reuses the existing component instance (does not re-run `setup()`) when navigating between two routes that resolve to the same matched record with only the dynamic segment changing — which is exactly what happens navigating from `/volunteer/service/A` to `/volunteer/service/B`. In that case `serviceId` stays pinned to `A`, and the composable never reloads: the view keeps showing service A's songs/order-of-service/stage layout under whatever URL is now in the address bar. This is reachable via browser back/forward across two different rehearse links (e.g., two reminder emails for two different services opened in sequence) or any future in-app link from one service straight to another.
**Fix:** Make the composable reactive to the route param, e.g.:
```ts
const serviceId = computed(() => route.params.serviceId as string)
const { state, doc, retry } = useVolunteerServiceDoc(serviceId) // accept a Ref<string> and watch it internally
```
or add a `watch(() => route.params.serviceId, () => retry())` in the view and have `useVolunteerServiceDoc` accept the id as a getter/ref it re-reads on each `load()`.

### WR-03: `rehearseAccess/{serviceId}`'s whole-document grant exposes every assigned volunteer's raw email to every other assigned volunteer

**File:** `src/utils/rehearseAccess.ts:61-68` (fields `assignedEmailsLower`, `rolesByEmailLower`); enforced by `firestore.rules` `rehearseAccess` `get`/`list` arms (whole-document grant, no field-level restriction, per `services.ts:601-606`'s own comment)
**Issue:** `RehearseAccessDoc.assignedEmailsLower` is the full list of every volunteer assigned to the service, and `rolesByEmailLower` maps every one of those emails to their role names. Because the Firestore rule grants the *entire* document to any one assigned, `email_verified` volunteer who reads it, opening `/volunteer/service/:id` hands that volunteer the raw (lowercased) email address of every co-scheduled teammate, not just their own. This predates Phase 127 (introduced Phase 125/126 for the My Schedule query) and `126-REVIEW.md` explicitly traced and accepted the `rolesByEmailLower` PII shape at the time — so this is not a new regression — but it is directly responsive to this review's brief ("Any personal data beyond name+role in roleAssignments?") and is now reachable from a second, more heavily-used entry point (the rehearse tab, not just My Schedule's own read). Worth a second look given the broader surface area this phase gives the same doc.
**Fix:** If this is still accepted, no action needed beyond re-confirming the acceptance covers the rehearse-view read path too. If not, the durable fix (already flagged as out-of-scope for v1.5 elsewhere in this codebase for a related rule) is a per-volunteer field restriction or splitting `rolesByEmailLower`/`assignedEmailsLower` into a separate, non-`get`-able aggregation document that only a Cloud Function reads.

### WR-04: `roleAssignments.personNames` falls back to the raw internal `personId` when a scheduled person has since been deleted from the roster

**File:** `src/utils/rehearseAccess.ts:212` (`a.effectivePersonIds.map((id) => nameById.get(id) ?? id)`); mirrored at `src/stores/services.ts:159` (`buildServiceSnapshot`'s own `roleAssignments`)
**Issue:** Both the volunteer-rehearse projection and the public share-link projection resolve a scheduled person's display name via `nameById.get(id) ?? id`. If the person was later removed from the roster (but the schedule/override still references their old `personId`), the fallback silently substitutes the raw Firestore document id string in the `personNames` array — a value that renders as-is in `VolunteerOrderOfService.vue`'s "Who's Serving" panel and in `ShareView.vue`. This isn't classic PII (it's an opaque internal id, not an email/phone), but it is an internal identifier leaking to an external audience (any assigned volunteer, or anyone holding a public share link) where the intent is names-only. It is a pre-existing pattern duplicated by the new `buildRehearseAccess`, not introduced by it, but both call sites share the bug.
**Fix:** Fall back to a neutral placeholder instead of the id, e.g. `nameById.get(id) ?? '(removed)'`, in both builders (they should stay in sync given the shared-allowlist precedent this phase already establishes for slots/markers).

## Info

### IN-01: `RehearseSongDetail.vue`'s `ccliNumber` prop is dead — it can never be populated

**File:** `src/components/rehearse/RehearseSongDetail.vue:143-144`, `src/views/VolunteerServiceView.vue:168,196`
**Issue:** `RehearseSongDetail` declares an optional `ccliNumber` prop and uses it to build a `CCLI {ccli}` clause in the header meta line, but `VolunteerServiceView.vue` never passes a `ccli-number` binding when it mounts the component, and `RehearseAccessDoc`/`RehearseSong` (`src/utils/rehearseAccess.ts`) carry no CCLI field at all. The clause is therefore permanently dead code — `props.ccliNumber` is always `undefined` and `ccliClause` always evaluates to `null`.
**Fix:** Either wire a real `ccliNumber` value through the projection (`RehearseSong.ccliNumber`) and the view, or drop the prop/clause until there's a data source for it.

### IN-02: `buildServiceSnapshot`'s public payload silently grows a `bpm` field with no current renderer

**File:** `src/stores/services.ts:140-146`; consumed nowhere in `src/views/ShareView.vue` (grep confirms no `bpm` reference there)
**Issue:** The Phase 127 shared-allowlist refactor threads a `resolveBpm` callback into `mapSlotAllowlist` for both `buildServiceSnapshot` (public ShareView path) and `buildRehearseAccess` (volunteer path). For `buildRehearseAccess` this is a genuinely new, consumed field (`RehearseSong.bpm`, rendered in `RehearseSongDetail.vue`'s meta line). For `buildServiceSnapshot`, it means every public `shareTokens`/`serviceShares` write now also carries a `bpm` value per SONG slot that `ShareView.vue` never reads — a shape change to the public payload with no current consumer. Not a security or correctness problem (not sensitive data, and unread fields are inert), but worth flagging against the review brief's "stays behaviorally IDENTICAL" question: the public snapshot's *shape* did grow, even though nothing renders differently.
**Fix:** No action required unless the "identical shape" guarantee is meant literally; otherwise this is a fine, forward-compatible no-op — call it out in the phase summary rather than silently.

---

_Reviewed: 2026-09-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
