# 0064. The single shared two-gate AI-affordance check -- mirrors

## Status

Accepted

## Context

This rationale is applied consistently at 4 call site(s) across 4 files: `src/components/ScriptureInput.vue`, `src/components/SongSlotPicker.vue`, `src/stores/auth.ts`, `src/views/ServiceEditorView.vue`. Documented at the time in `82-REVIEW`.

WR-02 (82-REVIEW): the single shared two-gate AI-affordance check -- mirrors src/utils/claudeApi.ts's isAiEnabled() exactly (master gate AND church setting).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/ScriptureInput.vue:3-4`:**

```
    <!-- AI Scripture Search (only for reading slots) -->
    <!-- WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare
```

**`src/components/SongSlotPicker.vue:56-58`:**

```

          <!-- AI Picks section -->
          <!-- WR-02 (82-REVIEW): gate on the two-gate authStore.isAiEnabled
```

**`src/stores/auth.ts:175-182`:**

```

  // WR-02 (82-REVIEW): the single shared two-gate AI-affordance check --
  // mirrors src/utils/claudeApi.ts's isAiEnabled() exactly (master gate AND
  // church setting). Every UI site that decides whether to SHOW an AI
  // affordance (not just claudeApi.ts's functions that actually CALL the
  // proxy) must read this computed instead of the bare `settings.aiEnabled`,
  // so a super-admin disabling AI for an org hides those affordances
  // consistently, not just the Settings card.
```

**`src/views/ServiceEditorView.vue:2729-2731`:**

```
    // WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare
    // church setting alone -- so a super-admin-disabled org hides the
    // action-bar AI item too.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/ScriptureInput.vue:3-4`
- `src/components/SongSlotPicker.vue:56-58`
- `src/stores/auth.ts:175-182`
- `src/views/ServiceEditorView.vue:2729-2731`
