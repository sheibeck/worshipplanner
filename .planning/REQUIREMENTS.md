# Requirements: WorshipPlanner — Milestone v2.9

**Milestone:** v2.9 — Live Presentation Field Fixes
**Defined:** 2026-09-02
**Goal:** Fix the readability, multi-monitor, and lyric-editing rough edges surfaced by the first real
church-projector run, so a projectionist can set up and read the live output without fighting the tool.

> **Scope decisions (locked at milestone start):**
> - **All field feedback** comes from the first real church-projector run (church Mac + projector, the
>   external-link hardware). These are fixes/polish on the existing v2.4 "Run the Service" and v2.7
>   presentation + lyric-editor features — no new feature areas.
> - **Multi-monitor is a rework, not a tweak:** the v2.4 single-select Audience/Confidence model collapses
>   on a real 3-monitor setup. Role assignments must **stick**, any role must be assignable to any monitor
>   (incl. **multiple Audience** monitors), and macOS auto-placement is treated as a **bug to fix**, not a
>   limitation to route around with manual window dragging.
> - **Font sizing = auto-fit only.** Slide text auto-scales to the screen; there is no manual size control.
>   The font *family* stays configurable exactly as today (v1.5 global slide typography).
> - **Out of scope (deferred):** all audio — vamps (mp3 upload + slide assignment) and canned
>   pre/post-service music — punted to the backlog 999.13 storage cluster (SEED-003), since they open the
>   Firebase Storage + external-media cost/security surface.
> - **Dropped:** the unsupported-browser warning — Safari ran the app fine on retest, so there is nothing
>   to build.
> - **No research pass** (internal fixes to existing features).

---

## v2.9 Requirements

### Multi-Monitor Assignment (Run the Service)

- [x] **R324**: The monitor-configuration screen detects and lists **every** connected display for role
  assignment, with no cap at two monitors (verified against a real 3-monitor setup).

- [x] **R325**: A user can assign any output role (Audience / Confidence) to any detected monitor,
  including assigning **Audience to more than one monitor at the same time** — selecting a role on one
  monitor no longer clears it on another.

- [x] **R326**: Monitor role assignments **persist and stay stuck** across a 3+ monitor setup — the bug
  where roles would not hold once a third monitor was present is fixed (the single-select model that
  collapsed is replaced).

- [x] **R327**: When the operator launches the outputs, each output window opens on **its assigned
  display on macOS/Chrome**, not just on the developer's laptop — the Mac tab/window-placement failure is
  fixed rather than worked around with manual dragging.

- [x] **R328**: The monitor auto-detect no longer falsely reports "your monitors changed" when the
  physical display layout is unchanged; a saved mapping re-loads without a spurious re-configure prompt.

- [x] **R338**: A user can assign a **nickname** to each detected monitor (many report as a number or
  "Unknown" on macOS), persisted with that monitor's identity and shown on the setup + assignment UI so
  roles can be assigned to the right physical screen with confidence. *(Added 2026-09-02 during Phase 114
  discuss.)*

### Live-Output Readability & Layout

- [x] **R329**: Slide text **auto-scales to fill the output display** (Audience and Confidence) so it is
  readable at projection distance, with no manual font-size control; the slide font *family* remains
  selectable in configuration as it is today.

- [x] **R330**: On the Run/control screen the live **main-slide view is smaller** and the **preview
  thumbnails are larger**, so a thumbnail's slide content is actually legible.

- [x] **R331**: An **"end" marker** appears after the last thumbnail of the current item, so the operator
  can see that the item (e.g. a song) is ending and the next service item is coming up.

- [x] **R332**: The preview-thumbnail strip's **scroll affordance is reliably visible and usable**,
  including on macOS (investigate and fix the intermittently-missing Mac scrollbar).

### Lyric Editor & Song UX

- [x] **R333**: The read-only lyric editor's edit link reads **"Edit song lyrics for {song name}"** and
  opens that song's lyric editor in a **new browser tab**.

- [x] **R334**: The lyric editor shows a **link to the SongSelect page** next to the song name in the
  editor's title bar.

- [x] **R335**: The lyric editor's **"Cancel" button is relabeled "Close"**.

- [x] **R336**: A user can **manually edit a song's Credits / CCLI / copyright text** — add, correct, or
  remove it — independent of pasting lyrics, so stale credits left over from a wrong-then-right paste can
  be fixed.

- [x] **R337**: The lyric editor's **History tab is hidden** (deferred), removing the confusing version
  list where every saved version reads "Just now".

---

## Future Requirements (deferred)

- **Vamps** — upload a library of vamp mp3 files (single-key/chord backing tracks) and assign one to a
  non-song slide group (mutually exclusive with a regular mp3 attachment; applies to the whole group).
  Deferred to the backlog 999.13 storage cluster.

- **Canned pre/post-service music** — a copyright-safe way to play music before/after the service (local
  mp3 folder vs. external Spotify/YouTube/Amazon playlist links). Needs its own research pass. Deferred.

- **Lyric-editor version History** — a genuinely useful, correctly-timestamped version history (the
  feature hidden by R337), if it earns its place later.

## Out of Scope

- **All audio/media upload this milestone** — vamps and canned music both open the Firebase Storage +
  external-media cost/security surface (SEED-003 / backlog 999.13) and are held for their own milestone.

- **Unsupported-browser warning** — dropped; Safari ran the app correctly on retest, so there is no
  compatibility gate to build.

- **Manual per-slide font-size control** — deliberately not built; sizing is auto-fit only, by owner
  decision (manual sizing is "more fiddly than just auto scaling").

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R324 | Phase 114 | Complete |
| R325 | Phase 114 | Complete |
| R326 | Phase 114 | Complete |
| R327 | Phase 114 | Complete |
| R328 | Phase 114 | Complete |
| R338 | Phase 114 | Complete |
| R329 | Phase 115 | Complete |
| R330 | Phase 115 | Complete |
| R331 | Phase 115 | Complete |
| R332 | Phase 115 | Complete |
| R333 | Phase 116 | Complete |
| R334 | Phase 116 | Complete |
| R335 | Phase 116 | Complete |
| R336 | Phase 116 | Complete |
| R337 | Phase 116 | Complete |

*Filled by the roadmapper — each requirement maps to exactly one phase.*

**Coverage: 15/15 v2.9 requirements mapped, 100%. No orphans, no duplicates.** *(R338 added 2026-09-02
during Phase 114 discuss — monitor nicknames.)*
