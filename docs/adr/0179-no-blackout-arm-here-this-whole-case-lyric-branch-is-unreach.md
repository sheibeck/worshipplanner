# 0179. No blackout arm here — this whole case 'lyric': branch is unreachable

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/slideshowAssembler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01 (105 code review): no blackout arm here — this whole `case 'lyric':` branch is unreachable via `assembleSlideshow` (every `'lyric'`-kind entry is fully handled and `continue`s in the entry loop before this function...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/utils/slideshowAssembler.ts:184-190`:**

```
      // WR-01 (105 code review): no blackout arm here — this whole `case
      // 'lyric':` branch is unreachable via `assembleSlideshow` (every
      // `'lyric'`-kind entry is fully handled and `continue`s in the entry
      // loop before this function is ever called for it; see the R117
      // comment at this file's `assembleSlideshow` entry loop). Blackout
      // resolution lives in the loop itself, not here — adding a blackout
      // arm to this dead branch would just be more dead code.
```

**`src/utils/slideshowAssembler.ts:314-324`:**

```

/**
 * WR-01 behavioral decision (confirm at human-verify): a `video`-kind entry
 * NEVER resolves the group's bed audio, even when it has no `entry.audioUrl`
 * of its own and the group DOES have a `bedAudioUrl`. This extends D-04's
 * "slide beats group" precedence to video — a dropped video slide carries its
 * own soundtrack inside `videoSrc` (rendered by `PresentationViewer`'s own
 * `VideoPlayer`, unmuted by default), so layering the group's `AudioPlayer`
 * underneath it would play two unrelated audio sources at once with no
 * on-screen indication. The bed is not paused/stopped globally — it simply
 * resolves normally on whatever slide follows, since this function runs
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideshowAssembler.ts:184-190`
- `src/utils/slideshowAssembler.ts:314-324`
