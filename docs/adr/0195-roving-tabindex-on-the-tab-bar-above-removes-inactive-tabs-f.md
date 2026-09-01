# 0195. Roving tabindex on the tab bar (above) removes inactive tabs from the

## Status

Accepted

## Context

This rationale is applied consistently at 4 call site(s) across 2 files: `src/views/OwnerConsoleView.vue`, `src/views/ServiceEditorView.vue`. Documented at the time in `81-REVIEW`.

WR-01 (81-REVIEW): roving tabindex on the tab bar (above) removes inactive tabs from the Tab key order per the WAI-ARIA APG Tabs pattern, which requires arrow-key navigation to compensate.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/OwnerConsoleView.vue:13-13`:**

```
           below is unchanged. WR-01 (81-REVIEW): roving tabindex requires the
```

**`src/views/OwnerConsoleView.vue:113-117`:**

```

// WR-01 (81-REVIEW): roving tabindex (above) removes inactive tabs from the
// Tab key order per the WAI-ARIA APG Tabs pattern, which requires arrow-key
// navigation to compensate. ArrowLeft/ArrowRight move + activate the
// adjacent tab (wrapping); Home/End jump to the first/last tab.
```

**`src/views/ServiceEditorView.vue:719-719`:**

```
        <!-- WR-01 (81-REVIEW): roving tabindex requires the companion
```

**`src/views/ServiceEditorView.vue:1812-1821`:**

```

// WR-01 (81-REVIEW): roving tabindex on the tab bar (above) removes inactive
// tabs from the Tab key order per the WAI-ARIA APG Tabs pattern, which
// requires arrow-key navigation to compensate. Roles/Messages are
// conditionally rendered (authStore.isEditor / isMessagingEnabled()), so the
// order used for Arrow/Home/End navigation is recomputed from what is
// actually visible rather than a static list.
// Stage Layout (Phase 107, R313/R314): inserted right after Roles in both the
// rendered tab strip AND this navigation order — gated on the SAME
// `authStore.isEditor` check as Roles (tech/sound planning is an editor
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/OwnerConsoleView.vue:13-13`
- `src/views/OwnerConsoleView.vue:113-117`
- `src/views/ServiceEditorView.vue:719-719`
- `src/views/ServiceEditorView.vue:1812-1821`
