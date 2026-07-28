# Phase 22: Media Attachments and Storage Lifecycle - Context

**Gathered:** 2026-07-23 (ported from gsdpi milestone M001 context; discuss-phase has not run for this phase)
**Status:** Research ported — not yet planned

> This context is a faithful port of the gsdpi work-slice **S05**. It carries the slice's goal, dependency, requirements, and error-handling strategy from the milestone-level M001 sources into planning-ready form. No `/gsd-discuss-phase` has run for Phase 22 yet — the items below are grounded in `22-RESEARCH.md` and the M001 milestone context/roadmap, not in locked owner decisions from a discussion. Run discuss-phase before planning locks scope.

<domain>
## Phase Boundary

Attach audio and video media to any slide and have it play through the service, backed by cost-managed Firebase Storage:

- **Audio attachment per slide** (MP3/audio) — auto-play on slide entry, stop at end, **no loop** (R013).
- **Video playback per slide** (MP4, WebM, MOV) — auto-play on slide entry, stop at end, **no loop** (R014).
- **Firebase Storage with 2-week retention auto-cleanup** — media files older than 14 days are automatically deleted, keeping storage cost manageable for small churches (R015).

**Acceptance (from M001 CONTEXT.md, S05 line):** *A user can attach MP3 or video to any slide. Media auto-plays on slide entry, stops at end, no loop. 2-week cleanup deletes old media files.*

**After this phase (from M001 ROADMAP.md):** Attach MP3 or video to a slide, see it auto-play in the editor preview; verify the 2-week cleanup policy works on old media.

**Not in this phase:**
- Full-screen presentation playback / advance-through-service — that is Phase 23 (Presentation Preview Mode), which *consumes* this phase's media data and playback components.
- Multi-monitor / confidence-monitor output, slide transitions, live presentation engine (future milestone, per M001 non-goals).
</domain>

<dependencies>
## Dependencies

- **Depends on Phase 18 (Song Lyric Slides and Editor / unified slide model).** Phase 22 consumes the unified slide data model and adds **media attachment fields (`audioUrl`, `videoUrl`)** to it, plus the slide editor component's attachment UI hooks. Per the M001 boundary map, S01 (Phase 18) produces "unified slide data model with media attachment fields (audioUrl, videoUrl)" and "slide editor component with attachment UI hooks" — this phase builds the media capability on top of that model.
- **Feeds Phase 23 (Presentation Preview Mode).** This phase produces media attachment data (Firebase Storage URLs) on slides and audio/video playback components with auto-play behavior, which Phase 23 consumes.
- **No blockers.** The only upstream dependency (unified slide model) is complete.
</dependencies>

<requirements>
## Requirements

> No project-wide `REQUIREMENTS.md` exists; these are carried from the M001 milestone requirement list (R013–R015). Confirm/lock during discuss-phase.

- **R013 — Audio attachment per slide.** Attach an MP3/audio file to any slide; auto-play on slide entry, stop at end, no loop.
- **R014 — Video playback per slide.** Attach MP4, WebM, or MOV video to any slide; auto-play on slide entry, stop at end, no loop. (MOV requires H.264 codec — verify Safari support.)
- **R015 — Firebase Storage 2-week retention auto-cleanup.** Media stored in Firebase Storage; media files older than 14 days are automatically deleted. Retention is a cost-control measure for small churches.

**Retention keying:** cleanup is keyed to media age (14 days), tracked via a `createdAt` timestamp in each file's Storage metadata (set at upload). Conceptually this ties media lifetime to the service date it was attached for — old services' media ages out automatically. Two implementation options exist (see `22-RESEARCH.md`): a GCS lifecycle rule (simplest, no logging) or a scheduled Cloud Function scanning `metadata.createdAt` (observable, logs deletion counts). The scheduled function is preferred for observability and org-specific control.
</requirements>

<error_handling>
## Error Handling Strategy

From the M001 milestone error-handling strategy, the parts that bind this phase:

- **Media upload failures — resume/retry on failed uploads.** A failed media upload must **not lose slide metadata**. Uploads to Storage are separate from the debounced auto-save of the slide's URL metadata (see `useAutoSave.ts`), so an upload failure leaves the slide intact and re-uploadable. Surface progress and error state from the upload composable.
- **2-week cleanup only deletes media files — never slide metadata/text.** The cleanup job removes Storage files only; it must never touch the slide document / its text content. A failed cleanup run simply retries on the next cycle (idempotent by age check).
- **Graceful playback failure (presentation mode).** If media fails to load (deleted by cleanup, network error), show the slide's text/content and **skip the media gracefully** — do not block or break the slide. This is primarily exercised in Phase 23 but the playback components built here should emit the events / error states that make graceful skipping possible (emit play/pause/ended, expose load-error).
</error_handling>

<risks>
## Risks and Unknowns

- **Browser auto-play policy (primary risk).** Modern browsers block auto-play of unmuted audio/video without a user gesture. Muted video can auto-play; unmuted audio/video cannot in a church presentation setup (no gesture). **Implication:** the HTML `autoplay` attribute will not reliably satisfy R013/R014. Recommended handling — default components to `autoplay=false`, and have the presentation layer (Phase 23) trigger play-on-entry via presentation control logic after the initial user gesture that starts the show, and/or mute video if silent auto-play is acceptable. This is called out in M001's Risks ("Browser-based media playback — audio/video auto-play behavior varies across browsers and may require user interaction to start") and is the key open design question for the auto-play requirements.
- **MOV/codec support** — MOV relies on H.264; verify Safari and cross-browser behavior.
- **Cost management** — 2-week retention exists specifically because "Firebase Storage costs must stay manageable for small churches" (M001 technical constraint). Estimated typical-church cost is ~$0.02–0.04/month storage (see `22-RESEARCH.md` cost profile).

### Open Questions (carried from research — resolve in discuss-phase)
1. Will Phase 23 implement play-on-enter logic, or are manual play buttons needed?
2. Is muted video acceptable to achieve auto-play, or must playback always be manual/unmuted?
3. Enforce per-org storage quotas beyond the 2-week retention?
4. Keep or immediately delete old media versions when a slide's attachment is replaced?
5. Lifecycle mechanism: GCS lifecycle rule vs. scheduled Cloud Function (research leans function for observability).
</risks>

<canonical_refs>
## Canonical References

**Read `22-RESEARCH.md` before planning** — it carries the full implementation landscape, file-by-file build order, Storage rules draft, cost analysis, and the two lifecycle-rule options.

### Files this phase touches (from research, "what exists today")
- `src/types/slide.ts` — extend `SlideBase`/variants with `audioUrl?`, `videoUrl?`.
- `src/firebase/index.ts` — add `export const storage = getStorage(app)` (bucket env `VITE_FIREBASE_STORAGE_BUCKET` already configured but unused).
- `src/composables/useAutoSave.ts` — reuse for media-URL metadata auto-save (separate from file upload).
- `src/composables/useMediaUpload.ts` — **new** upload composable (progress + error + Storage URL).
- `src/components/AudioPlayer.vue`, `src/components/VideoPlayer.vue` — **new** playback components.
- `storage.rules` — **new** org-scoped Storage access control (50MB write cap).
- `functions/src/index.ts` — **new** `cleanupExpiredMedia` scheduled function (or a GCS lifecycle rule alternative).
- `SongLyricEditor.vue` — editor UI pattern (header/tab/auto-save) the media-attachment UI follows.

### Prior-phase / milestone context
- `22-RESEARCH.md` (this phase) — ported S05 research.
- Phase 18 (unified slide model + slide editor) — the dependency this phase extends.
- Phase 23 (Presentation Preview Mode) — the consumer of this phase's media data and playback components.
</canonical_refs>

<environment>
## Environment Note

Emulator/tests/build require `.env.local` in the worktree (Firebase/ESV/Claude/Planning Center secrets). This is gitignored and absent from fresh worktrees — symlink or copy it from `C:\projects\worshipplanner\.env.local` before running the Firebase emulator, `npm run test:rules`, the unit suite, or a production build. See CLAUDE.md and memory `worktree-env-local.md`. This matters here because Storage rules tests and the cleanup Cloud Function both exercise the Firebase emulator.
</environment>

---

*Phase: 22-media-attachments-and-storage-lifecycle*
*Ported from gsdpi milestone M001, slice S05 (research-only; not planned or executed).*
