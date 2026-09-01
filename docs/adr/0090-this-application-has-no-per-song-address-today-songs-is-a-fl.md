# 0090. This application has no per-song address today — /songs is a flat

## Status

Accepted

## Context

This rationale is applied consistently at 6 call site(s) across 4 files: `src/components/settings/ServiceTemplateEditor.vue`, `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/SlidesTab.vue`, `src/utils/songEditLink.ts`. Documented at the time in `26-RESEARCH.md`.

This application has no per-song address today — `/songs` is a flat list route with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely from local click state inside `SongsView.vue`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/settings/ServiceTemplateEditor.vue:3-4`:**

```
    <!-- Deliberately NO scrim, structurally ported from EditSlideDrawer.vue
         (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page
```

**`src/components/slides/EditSlideDrawer.vue:309-310`:**

```
              <!-- This drawer's OWN failure ref/handler (26-RESEARCH.md
                   Pitfall 6) — AudioPlayer itself renders no degraded-state
```

**`src/components/slides/EditSlideDrawer.vue:503-512`:**

```
 * open. It follows the selection — it never closes itself on a selection
 * change, only on its own close control or Escape.
 *
 * Renders nothing when closed, and nothing when `entry` is null — the latter
 * covers both "nothing selected" and the pre-materialization window where a
 * selected slide's synthetic fallback id has no stored entry behind it yet
 * (26-RESEARCH.md Pitfall 1). This is a plain `v-if` guard, not a loading
 * state — the window is sub-second in practice and the caller (`SlidesTab.vue`)
 * already handles clearing a dangling selection.
 */
```

**`src/components/slides/EditSlideDrawer.vue:928-929`:**

```

/** This drawer's OWN failure state (26-RESEARCH.md Pitfall 6) — `AudioPlayer` is a deliberately dumb primitive that only emits `error`, it renders no degraded-state text of its own. Reset whenever the attached file or the edited slide changes, so a stale failure never sticks to a different file (see the two watchers below). */
```

**`src/components/slides/SlidesTab.vue:351-359`:**

```
 * DIRECT id lookup against `selectedGroup.slides`, with no mapping step. For
 * a materialized group `AssembledSlide.slide.id` equals `GroupSlideEntry.id`
 * verbatim (26-RESEARCH.md Pattern 1, verified against
 * `slideshowAssembler.ts`'s `emitFromGroup`). Resolves to `null` — treated by
 * the drawer as "nothing selected," never a loading state — for the
 * pre-materialization fallback-id window where a selected slide's synthetic
 * id has no `GroupSlideEntry` counterpart yet (Pitfall 1); do not "fix" that
 * window with a spinner.
 */
```

**`src/utils/songEditLink.ts:5-18`:**

```
 * This application has no per-song address today — `/songs` is a flat list route
 * with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely
 * from local click state inside `SongsView.vue`. Adding a real per-song route
 * would be a larger change than this phase's scope allows. This module instead
 * extends the query-param convention `SongsView.vue` already uses for its
 * existing `?import=true` auto-open-import parameter (read on mount, act, then
 * clear via a non-navigating `router.replace`) — see 26-RESEARCH.md Pitfall 4.
 *
 * This module is pure: it imports nothing from Vue, the router, or any store, so
 * the sender (a future drawer) and the receiver (`SongsView.vue`) can never drift
 * apart on the shape of the link they share.
 */

/** The only tabs `SongSlideOver.vue` actually has. */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/settings/ServiceTemplateEditor.vue:3-4`
- `src/components/slides/EditSlideDrawer.vue:309-310`
- `src/components/slides/EditSlideDrawer.vue:503-512`
- `src/components/slides/EditSlideDrawer.vue:928-929`
- `src/components/slides/SlidesTab.vue:351-359`
- `src/utils/songEditLink.ts:5-18`
