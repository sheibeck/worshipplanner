---
phase: 136-video-output-fullscreen-slice
reviewed: 2026-09-07T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/components/output/FullscreenSlideOutput.vue
  - src/views/AudienceOutputView.vue
  - src/views/VideoOutputView.vue
  - src/utils/monitorConfig.ts
  - src/components/MonitorCard.vue
  - src/views/MonitorSetupView.vue
  - src/components/run/RunDisplaysPanel.vue
  - src/components/run/RunPreflightPanel.vue
  - src/router/index.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 136: Code Review Report

**Reviewed:** 2026-09-07
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 136 does exactly what its commit trail describes: (1) widens `MonitorRole` to a
strict 3-value allowlist (`audience | confidence | video`) with a validator that still
rejects anything else, propagated correctly into `MonitorCard`, `MonitorSetupView`,
`RunDisplaysPanel`, and `RunPreflightPanel`; (2) extracts `AudienceOutputView.vue`'s
fullscreen render into a new shared `FullscreenSlideOutput.vue`, parameterized by
`role`/`testid`; and (3) adds `VideoOutputView.vue` + the `/present/video/:serviceId`
route as a thin wrapper around the shared component.

Diffing the extracted component against the pre-extraction `AudienceOutputView.vue`
(`git show 1b6416f4:src/views/AudienceOutputView.vue`) confirms the render, the
`watch(index)` pause→nextTick→play sequence, the `watch(fontReady)` deferred first
play, the `onBeforeUnmount` pause, and the `setRootRefs`/`useContainScale` merge are
**line-for-line identical** to the pre-extraction logic — only the testid prefix and
the `role` forwarded into `useOutputWindow` changed. `useOutputWindow`'s
`reportFullscreenState()` and `useRunControl.ts`'s `handleOutputReady` match output
windows by **postMessage source identity**, not by a hardcoded role string, so the
existing fullscreen-delegation/reopen/status wiring already works for `role: 'video'`
without any changes to `useRunControl.ts` (confirmed by reading it — it was correctly
left untouched by this phase). The new `/present/video/:serviceId` route's
`meta: { requiresAuth: true }` is byte-identical to `/present/audience` and
`/present/confidence`. The `≥1 Audience` save gate in `MonitorSetupView.vue` is
untouched and verified by a new test that a Video-only assignment cannot save.

The issues found are narrow: one real (if low-severity) correctness bug surfaced by
widening `MonitorRole` to three values in a comparator that was only ever exercised
with two, and a couple of maintainability nits around the new value's duplication
across files. Nothing here blocks the fullscreen-only slice from shipping.

## Warnings

### WR-01: `matchedSummaryList`'s role comparator is non-transitive once a mapping has both a Confidence and a Video assignment

**File:** `src/views/MonitorSetupView.vue:242-246`
**Issue:** The "already configured" (State B2) summary list sorts assigned monitors with:
```ts
const matchedSummaryList = computed(() =>
  Object.entries(roleByFingerprint)
    .map(([fingerprint, role]) => ({ fingerprint, role }))
    .sort((a, b) => (a.role === b.role ? a.fingerprint.localeCompare(b.fingerprint) : a.role === 'audience' ? -1 : 1)),
)
```
This comparator was correct when `MonitorRole` had exactly two values: any two
differently-typed roles were guaranteed to be `'audience'` vs `'confidence'`, so exactly
one side of the ternary's `-1`/`1` ever applied. Phase 136 widens `MonitorRole` to three
values, and this line was not touched to account for the third value — it wasn't in the
diff, but became reachable with broken behavior as a direct consequence of the widening.
Now, comparing a `'confidence'` assignment against a `'video'` assignment (neither is
`'audience'`) returns `1` **regardless of argument order**:
`comparator('confidence','video') === 1` and `comparator('video','confidence') === 1`,
violating the antisymmetry a sort comparator must satisfy (`cmp(a,b) === -cmp(b,a)`).
The practical effect: once an operator has a saved mapping containing both a Confidence
and a Video monitor, the order these two rows render in on the "Your displays are set
up" summary is unspecified and can differ across browsers/engine sort implementations
(and is not proven stable by any test — no test in `MonitorSetupView.test.ts` exercises
this list with a mixed Confidence+Video mapping). No data loss, but a genuine logic bug,
not merely a style nit.
**Fix:** Use an explicit rank table instead of a role-name ternary so any role count
sorts consistently:
```ts
const ROLE_SORT_RANK: Record<MonitorRole, number> = { audience: 0, confidence: 1, video: 2 }
const matchedSummaryList = computed(() =>
  Object.entries(roleByFingerprint)
    .map(([fingerprint, role]) => ({ fingerprint, role }))
    .sort((a, b) =>
      ROLE_SORT_RANK[a.role] === ROLE_SORT_RANK[b.role]
        ? a.fingerprint.localeCompare(b.fingerprint)
        : ROLE_SORT_RANK[a.role] - ROLE_SORT_RANK[b.role],
    ),
)
```

### WR-02: `FullscreenSlideOutput`'s `testid` prop defaults to `'audience'`, silently masking a missing wire-up on a future third caller

**File:** `src/components/output/FullscreenSlideOutput.vue:105-114`
**Issue:**
```ts
const props = withDefaults(
  defineProps<{
    role: MonitorRole
    channelFactory?: BroadcastChannelFactory
    testid?: string
  }>(),
  {
    testid: 'audience',
  },
)
```
`role` is required (correctly forces every caller to state intent), but `testid` is
optional with a default of `'audience'`. Both current callers (`AudienceOutputView.vue`,
`VideoOutputView.vue`) pass `testid` explicitly, so there is no live bug today. But if a
future caller (e.g. a Phase 137 Video-banner variant, or any other output role) forwards
`role` without also remembering `testid`, the mistake fails silently: the component
renders with `audience-output`/`audience-stage`/`audience-blackout` testids attached to
a non-audience window instead of throwing a type error or an obviously-wrong id. Given
`role` and `testid` are documented (lines 99-104) as a matched pair that must be kept in
sync per output type, defaulting only one of them undermines that invariant.
**Fix:** Drop the default and make `testid` required alongside `role`, so a caller that
forgets it is a compile-time error, not a silent audience-flavored testid leak:
```ts
const props = defineProps<{
  role: MonitorRole
  channelFactory?: BroadcastChannelFactory
  testid: string
}>()
```
(Requires updating `AudienceOutputView.vue`/`VideoOutputView.vue` call sites, which
already pass it, so this is a no-op for current behavior.)

## Info

### IN-01: The `role: 'audience' | 'confidence' | 'video'` union and its `roleTitle`/`roleLabel` switch are now duplicated in four places

**File:** `src/components/run/RunDisplaysPanel.vue:11-16,47-51`, `src/components/run/RunPreflightPanel.vue:172-179,204-208`, `src/views/MonitorSetupView.vue:226-230`, `src/utils/monitorConfig.ts:20`
**Issue:** `MonitorRole` is the single source of truth in `monitorConfig.ts`, but
`RunDisplaysPanel.vue` and `RunPreflightPanel.vue` each re-declare an identical local
`DisplayItem.role: 'audience' | 'confidence' | 'video'` literal union instead of
importing `MonitorRole`, and each carries its own copy of a `roleTitle()`/`roleLabel()`
if/else chain that must be kept in sync by hand. Phase 136 updated all three copies
correctly this time, but the duplication is what made WR-01 possible (one of the four
copies — `MonitorSetupView.vue`'s `matchedSummaryList` sort — wasn't a `roleTitle`-style
function and was missed). A fourth role added later requires remembering to touch all
of these plus the sort comparator.
**Fix:** Import `MonitorRole` from `@/utils/monitorConfig` in the two panel components
instead of re-declaring the union, and consider hoisting a single
`roleTitle(role: MonitorRole): string` helper into `monitorConfig.ts` (or a small shared
util) that all four call sites import, so adding a role is a one-line change in one file.

---

_Reviewed: 2026-09-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
