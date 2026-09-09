---
phase: 132-services-page-ux-alignment-verbiage-cleanup
reviewed: 2026-09-07T15:53:45Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/views/ServicesView.vue
  - src/views/ShareView.vue
  - src/views/ServiceEditorView.vue
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 132: Code Review Report

**Reviewed:** 2026-09-07T15:53:45Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the four Phase 132 commits (`555d7a42`, `47664497`, `1a16baeb`, `444d78ce`) scoped to
R406–R409: the Services page `<h1>` header, the mobile-friendly tab strip/action-button
restructure, the ShareView zebra striping, and the single-sentence removal from
`ServiceEditorView.vue`'s lock banner.

**ServicesView.vue (R406/R407):** The new header matches the `text-xl font-semibold
text-gray-100` convention used by `RosterView`/`SongsView`/`SettingsView`/`DashboardView`, and
correctly omits its own bottom border so the tab bar's `border-b` doesn't double up — confirmed
no other `<h1>` exists in `AppShell`/`AppSidebar` for this route, so there's no duplicate
heading. The tab-strip restructure preserves every `v-if="authStore.isEditor"` guard verbatim
(cog, "New Service", both rotation tabs) — no editor-only guard was dropped. The existing
`ServicesView.test.ts` suite exercises `data-testid="open-template-editor"` and other
attribute-based selectors, none of which changed, so no test breakage is expected from the
markup reshuffle. Mobile layout (stacked tabs row + wrapped action-button row) and desktop
layout (single row, buttons pushed right via `sm:ml-auto`) both read correctly from the diff.

**ShareView.vue (R408):** The zebra stripe is exactly what the commit claims — a
`bg-gray-50` background class keyed off `index % 2 !== 0`, applied only to the
`serviceSnapshot.slots` row wrapper `<div>`. No `slot.notes`, `slot.body`, `marker.note`, or any
new text interpolation was introduced; the adjacent R346/SEC-S-04 gate comment (line 105-107) is
untouched and the render logic above/below it still renders only `songTitle`/`songKey`,
scripture reference, role names, etc. — no PII/free-text leak. The `px-2 -mx-2` addition is a
net-zero-offset trick (padding cancels the negative margin) so text alignment is unchanged while
the background bleeds to the row's full width; this is correct, not a bug.

**ServiceEditorView.vue (R409):** Confirmed only the leading sentence was removed from the
`hasPcExportEvidence` branch of `lockBannerBody` (line 2189); the `false` branch (line 2190),
`lockBannerLead` (2181-2185), and `reopenPcWarning` (2199-2202) are byte-for-byte unchanged. No
test asserts on the removed string. See the one Warning below for a leftover copy defect this
edit introduces.

## Warnings

### WR-01: Dangling "here" in lockBannerBody after sentence removal

**File:** `src/views/ServiceEditorView.vue:2187-2191`
**Issue:** The removed sentence ("Planning Center already has this plan.") was the only thing
that gave the trailing word "here" in the `hasPcExportEvidence` branch a referent — it drew a
contrast between "there" (Planning Center) and "here" (this app). With that sentence gone, the
banner now reads:

> Exported — editing is locked. **Reopen it for editing to change the order, slides or roles here.**

"here" no longer has anything to contrast against and reads as a stray word appended to the
sentence. The sibling `false`-branch copy (line 2190) — used for services with no PC export
evidence — correctly has no trailing "here": `'...to change the order, slides or roles.'`. The
`true`-branch should match that phrasing now that the contrast sentence is gone.
**Fix:**
```ts
const lockBannerBody = computed(() =>
  hasPcExportEvidence.value
    ? 'Reopen it for editing to change the order, slides or roles.'
    : 'Reopen it for editing to change the order, slides or roles.',
)
```
(At that point the two branches are identical, which raises the question of whether
`hasPcExportEvidence` still needs to gate `lockBannerBody` at all — but that's a slightly larger
change than this phase's stated scope, so the minimal fix is just dropping the stray "here".)

## Info

### IN-01: ServicesView header/tab-bar split diverges from the single-bordered-header pattern used elsewhere

**File:** `src/views/ServicesView.vue:5-8`
**Issue:** `RosterView.vue`, `SongsView.vue`, and `SettingsView.vue` all wrap the `<h1>` and the
header action-row inside one `border-b border-gray-800 pb-4 mb-6` container. `ServicesView.vue`
instead puts the `<h1>` in its own unbordered `mb-4` wrapper and relies on the *tab bar's*
`border-b` immediately below it. The visual result is very close (single divider, similar
spacing) and this was a deliberate, documented choice in the commit message to avoid a double
border, so it is not a functional defect — flagging only because a future contributor extending
this page by copy-pasting the Roster/Songs header pattern verbatim would reintroduce the double
border this phase was written to avoid.
**Fix:** Optional: add a one-line comment above the header `<div>` noting that the border is
intentionally deferred to the tab bar, so the reason doesn't have to be re-derived from git log.

---

_Reviewed: 2026-09-07T15:53:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
