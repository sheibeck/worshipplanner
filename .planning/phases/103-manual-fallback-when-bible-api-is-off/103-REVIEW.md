---
phase: 103-manual-fallback-when-bible-api-is-off
reviewed: 2026-08-31T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/utils/scripture.ts
  - src/utils/__tests__/scripture.test.ts
  - src/views/SettingsView.vue
  - src/views/__tests__/SettingsView.test.ts
  - src/components/ScriptureInput.vue
  - src/components/__tests__/ScriptureInput.test.ts
  - src/components/CongregationalEditor.vue
  - src/components/__tests__/CongregationalEditor.test.ts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
fixed_at: 2026-08-31T21:00:00Z
fix_report: 103-REVIEW-FIX.md
findings_resolved:
  - CR-01
  - CR-02
  - WR-01
  - WR-02
  - IN-01
findings_skipped:
  - WR-03
post_fix_status: partial
---

# Phase 103: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the diff `449a1ae2~1..3329699d` (four commits implementing R298/R299/R300). The things the
task explicitly worried about are all correct: `bibleGatewayLink` encodes both reference and version
before interpolation (no injection path), the "Split with AI" button in `CongregationalEditor.vue`
stays gated ONLY on `authStore.isAiEnabled` with no coupling to the Bible gate (verified by reading the
gate condition and by the shipped independence tests), the Settings "Bible Translation" card gate
mirrors the AI Features card exactly and leaves `bibleVersion`'s save path untouched, pasted text is
bound via `v-model`/`:value`+`@input` (never `v-html`), and `npm run type-check` plus the full targeted
test run (194 tests, 4 files) are green.

However, two reproducible **data-loss bugs** were found in the parts of the plan Claude's Discretion
covered loosely ("whether the paste box auto-applies on blur vs an explicit action"): in both editors,
the pasted content is wired into shared state in a way that a subsequent, entirely ordinary interaction
silently destroys it. Both were confirmed by writing and running throwaway repro tests against the
actual components (not mocks of the bug) before being reverted — this is not a theoretical concern.

## Critical Issues

### CR-01: ScriptureInput.vue — pasted fallback text is silently erased by routine follow-up actions

**File:** `src/components/ScriptureInput.vue:436-463` (`fetchPreview`), `:467-494` (`onTextInput`),
`:402` (`showPreviewButton`), `:152-180` (fallback block using `previewText` as its paste target)

**Issue:** The fallback textarea (`v-model="previewText"`) intentionally reuses the same `previewText`
ref the fetched-preview panel uses (per R299's "same downstream path" requirement) — but nothing else in
the component was updated to know that, when the Bible API is off, `previewText` is now user-authored
content rather than a fetch cache. Two ordinary interactions destroy it:

1. `showPreviewButton` (line 402: `canPreview.value && passageQuery.value !== previewRef.value`) is not
   gated on `authStore.isBibleApiEnabled`, so the "Preview passage" button still renders and is
   clickable when the API is off. `fetchPreview()` unconditionally clears `previewText.value = ''` at
   its top (line 441) before calling the dispatcher, which returns `{status:'disabled'}` as a silent
   no-op (per Phase 102) — so clicking this now-pointless button wipes whatever the user just pasted,
   with a brief "Loading..." flash and no recovery.
2. `onTextInput()` (fires on every keystroke in the reference field) clears `previewText` whenever
   `passageQuery.value !== previewRef.value` (lines 489-493). `previewRef` is only ever set inside the
   `status === 'ok'` branch of `fetchPreview`, which never runs when the API is off — so `previewRef`
   stays `''` forever, meaning `passageQuery !== previewRef` is true on essentially every keystroke in
   the reference input. Fixing a typo in the already-entered reference after pasting text wipes the
   paste immediately.

Reproduced directly against the real component (temporary test, reverted after confirming — not
included in the diff):
```
AFTER REF EDIT, text contains paste?      false   (expect fails: pasted text is gone)
AFTER PREVIEW CLICK, text contains paste? false
```

This directly undermines R299 for the one component where paste is the *only* way to get content when
the API is off — a user who pastes, then corrects a typo in the reference or clicks the still-visible
"Preview passage" button, loses their work with no warning, no error, and no obvious cause.

**Fix:** Stop treating `previewText` as fetch-only state once the API is off. Gate the button and the
clearing logic on `authStore.isBibleApiEnabled`:
```ts
const showPreviewButton = computed(
  () => authStore.isBibleApiEnabled && canPreview.value && passageQuery.value !== previewRef.value,
)
```
```ts
function onTextInput() {
  ...
  // Only the enabled (fetch-backed) path treats a reference change as
  // invalidating previewText — in the disabled/paste path, previewText is
  // user-authored content that a reference edit must not silently destroy.
  if (authStore.isBibleApiEnabled && passageQuery.value !== previewRef.value) {
    previewText.value = ''
    previewRef.value = ''
    previewError.value = ''
  }
}
```
Apply the same guard to the `watch(effectiveVersion, ...)` clearing block (lines 408-412).

---

### CR-02: CongregationalEditor.vue — the paste textarea unconditionally re-seeds the main reading textarea on every keystroke, destroying AI-split output or manual edits

**File:** `src/components/CongregationalEditor.vue:279-285` (`onPasteInput`)

**Issue:** `onPasteInput` runs on every `@input` event of the (permanently visible, never-disappears)
paste textarea, and each time unconditionally overwrites `text.value` — the main `---`-delimited
reading textarea — with a freshly re-seeded `Leader\n<stripped paste>`:
```ts
function onPasteInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value
  pastedText.value = value
  const stripped = stripVerseMarkers(value)
  rawPassage.value = stripped
  text.value = `Leader\n${stripped}`   // <-- always wins, unconditionally
}
```
The plan's stated intent was to mirror `autoFetch`'s one-shot seed (`onMounted` calls it exactly once).
This implementation instead re-runs the seed on every keystroke for the component's entire lifetime.
Since the paste textarea is not hidden or disabled after first use, a completely ordinary flow breaks
it: paste text → click "Split with AI" → get a nicely split `Leader`/`Congregation` reading in the main
textarea → notice a typo in the original paste and go fix it in the paste box → the very next keystroke
there reverts the main textarea back to the raw, unsplit `Leader\n<full text>` seed, discarding the split
(and discarding any manual sectioning the user had also done by hand in the main textarea).

Reproduced directly against the real component (temporary test, reverted after confirming):
```
AFTER SPLIT:             "Leader\nGive thanks to the Lord.\n---\nCongregation\nFor his love endures."
AFTER SECOND PASTE EDIT: "Leader\nGive thanks to the Lord. For his love endures forever."
```
The AI split result is gone after one more paste-box keystroke, with no warning.

**Fix:** Only apply the seed when the main textarea still holds what was last seeded from paste (i.e.
the user hasn't since diverged from it via manual edit or AI split) — mirroring "seed, don't clobber":
```ts
const lastPasteSeed = ref('')

function onPasteInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value
  pastedText.value = value
  const stripped = stripVerseMarkers(value)
  rawPassage.value = stripped
  const seeded = `Leader\n${stripped}`
  if (text.value === lastPasteSeed.value) {
    text.value = seeded
  }
  lastPasteSeed.value = seeded
}
```

## Warnings

### WR-01: ScriptureInput.vue renders two overlapping "open the reference elsewhere" links when the Bible API is off

**File:** `src/components/ScriptureInput.vue:136-147` (pre-existing reader link), `:156-167` (new
fallback link)

**Issue:** The pre-existing "View on ESV.org" / "View on BibleGateway" reader link (`v-if="canPreview"`)
is not gated on `authStore.isBibleApiEnabled`, so when the API is off, it renders simultaneously with
the new "Open in BibleGateway" fallback link — two visually similar indigo text links with an identical
external-link icon, both opening effectively the same BibleGateway/ESV.org destination for the same
reference. The 103-UI-SPEC describes exactly one deep-link affordance in the fallback block; nothing in
the plan called for retiring or reconciling the old reader link, so this redundancy was not caught.

**Fix:** Either gate the old reader link on `authStore.isBibleApiEnabled` (hide it when the fallback's
own link is already shown), or explicitly note in a comment why both are intentional. Given the fallback
block already covers "open the passage externally," the simplest fix is:
```html
<a v-if="canPreview && authStore.isBibleApiEnabled" :href="readerUrl" ...>
```

### WR-02: CongregationalEditor.vue stamps pasted "any version" text with the org's configured Bible version, mislabeling provenance

**File:** `src/components/CongregationalEditor.vue:379-384` (`onAiSplit` stamp), `:393-395` (`onSave`
stamp)

**Issue:** R299 is explicit that the paste path "works with ANY version — the app does not
parse/validate the version; the user pastes whatever they copied." But both `onAiSplit`'s
`stampVersion` and `onSave`'s `version` fall back to `authStore.settings.bibleVersion` (the org's
stored ESV/NLT setting) whenever `capturedVersion` is unset — which it always is on the paste path,
since `capturedVersion` is only set inside `autoFetch`'s `ok` branch, which never runs while the API is
off. So a congregational reading built entirely from pasted NIV (or any non-ESV/NLT) text gets persisted
with `translationSource: 'ESV'` (or whatever the org's stale setting is), a factually wrong provenance
tag. This is currently low-impact because Phase 55 stopped rendering the attribution on the projected
slide, but the field is still persisted and could resurface in an export or a future feature that reads
it. This is pre-existing fallback logic (not new to Phase 103), but Phase 103 is what makes the paste
path — and therefore this mismatch — a first-class, everyday flow for a disabled org rather than a rare
manual-entry edge case.

**Fix:** When the Bible API is off, omit `translationSource` entirely rather than defaulting to a
setting that has no relationship to the pasted text's actual translation:
```ts
const stampVersion = capturedVersion.value ?? (authStore.isBibleApiEnabled ? authStore.settings.bibleVersion : null)
```
(apply the same guard in `onSave`).

### WR-03: Fallback UI block duplicated near-verbatim across both editors

**File:** `src/components/ScriptureInput.vue:152-180`, `src/components/CongregationalEditor.vue:20-55`

**Issue:** The intro paragraph, the "Open in BibleGateway" anchor (including the inline SVG icon
markup), and the paste-textarea-with-empty-state block are duplicated almost verbatim between the two
components, differing only in which local state the textarea binds to. Any future copy/style change
(e.g. the exact wording, the icon, the empty-state text) now has two places to update in lockstep, which
is exactly the failure mode CLAUDE.md's "single source of truth" pattern (used elsewhere in this file,
e.g. `formatScriptureReference`) exists to prevent.

**Fix:** Extract a small `BibleApiOffFallback.vue` (or a composable returning the computed link + copy)
taking `reference`/`version` as props and emitting the pasted text, used by both editors.

## Info

### IN-01: New paste textareas lack `for`/`id` association with their labels

**File:** `src/components/ScriptureInput.vue:169-175`, `src/components/CongregationalEditor.vue:41-50`

**Issue:** The `<label>Paste the passage text</label>` elements aren't associated with their `<textarea>`
via `for`/`id`, so a screen reader won't announce the label when the textarea receives focus. This
matches the pre-existing convention elsewhere in these files (none of the other inputs use `for`/`id`
either), so it's not a regression, just an opportunity while the block is new.

**Fix:** Add matching `id`/`for` pairs, e.g. `id="scripture-paste-textarea"` / `for="scripture-paste-textarea"`.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
