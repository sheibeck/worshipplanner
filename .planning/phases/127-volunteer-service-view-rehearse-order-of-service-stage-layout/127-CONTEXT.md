# Phase 127: Volunteer Service View — Rehearse, Order of Service & Stage Layout - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; owner authorized `/gsd-autonomous`)

<domain>
## Phase Boundary

Build the **standalone, read-only volunteer service view** a volunteer reaches from a My Schedule card
(Phase 126) — **replacing the Phase 126 build-safe placeholder** at `/volunteer/service/:serviceId`. It is
NOT the planner's `ServiceEditorView`; a volunteer never sees the editing UI. It carries three tabs:
**Rehearse** (default) · **Order of Service** (read-only) · **Stage Layout** (read-only) — because tech-team
members are volunteers too and need the order + stage, not just rehearsal media. Composed from the existing
read-only renderers (ShareView snapshot + the v2.7 read-only order/stage renders) and the Phase 125
`rehearseAccess` projection (extended as needed). This is the final phase of v2.12 (R384–R393). Mobile-first.
</domain>

<decisions>
## Implementation Decisions

### Access & data source (all tabs)
- The view reads the `rehearseAccess/{serviceId}` projection via the **`get` arm** (the live
  `parentIsPlanned()` check + `email_verified` + assigned-email membership from Phase 125). A volunteer opens
  a service they're assigned to; a not-assigned/Draft/reopened service is denied at the data layer.
- **Extend `buildRehearseAccess`** (src/utils/rehearseAccess.ts) to carry what the Order of Service and Stage
  Layout tabs need, PII-safe (mirroring `buildServiceSnapshot`/ShareView's frozen projection): a read-only
  **order-of-service item list** (section/type/title/song refs — NO free-text notes/slot bodies unless
  ShareView already exposes them) and the **stageLayout** field (the v2.7 additive `Service.stageLayout`,
  which is already positional + role/person "Name - Role" data, not free-text PII). Prefer ONE projection +
  one read path over new scoped reads. Research decides whether to reuse `buildServiceSnapshot`'s projection
  logic vs extend `buildRehearseAccess`.

### Rehearse tab (R385–R390) — the owner's Rehearsal.dc.html mock
- **Song list** (left): songs in this service with key, PDF count, MP3 count, a now-playing indicator;
  select a song.
- **Song detail** (middle): **Sheet music & chords** = the song's PDF attachments, each with **Print** +
  **Download**; **Recordings** = the MP3 attachments; an optional **per-song note** (only if the projection
  carries a rehearsal note — otherwise omit). All from the v2.11 song attachments (download-token URLs) —
  nothing is uploaded here.
- **PDF reader** (right): view the selected chart, page navigation (Page X of Y, prev/next), **Print**.
  **Mobile (R391): link-first** — open/download the PDF via its download-token URL; the inline `<iframe>`
  viewer is a desktop enhancement only (do NOT assume inline PDF works on phones — v2.7 research).
- **Audio player** (bottom bar): play/pause, seekable progress, elapsed/total time; **whole-track speed**
  (1× / 0.9× / 0.75× / 1.25× via native `<audio>.playbackRate`) and a **whole-track Loop** toggle
  (`<audio>.loop`). One track plays at a time. Native `<audio>` — works on mobile.
- **External links** (YouTube / Drive / Dropbox) attached in v2.11 open in a **new tab** (no in-app embed).

### Order of Service tab (R392, read-only)
- Render the running order read-only, reusing the existing read-only order-of-service render (the
  ShareView/print path), fed from the projection. No editing.

### Stage Layout tab (R393, read-only)
- Render the v2.7 stage diagram read-only (instruments/mics + person Name-Role), reusing the existing
  read-only/print stage render (v2.7 shipped a `?view=stage` read-only + "Print for tech"). No editing.
- **WYSIWYG caution (v2.7 bug):** v2.7 fixed a Tailwind `-translate-x/y-1/2` + inline-transform stacking bug
  by using a single inline-transform centering + hard-coded room size so editing/locked/share/print render
  identically. Reuse the SAME read-only render component — do not re-derive marker positioning.

### View shell & tabs
- Standalone shell (volunteer top bar with the user chip, like the Rehearsal mock's header), tabs
  Rehearse / Order of Service / Stage Layout, Rehearse default. Reached only from My Schedule; a back path
  to My Schedule. Read-only throughout.
- Design → the owner's `Rehearsal.dc.html` mock (Nocturne → app dark gray-950), via a UI-SPEC.

### Claude's Discretion
- Component split, the projection-extension shape, exact tab/route structure, and player component are the
  planner's choice within the constraints above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 125:** `rehearseAccess` projection + `buildRehearseAccess` (extend), the `get`-arm rule, the
  v2.11 `SongAttachment.downloadUrl` bearer URLs (PDF/MP3 + external links), `volunteerAuth` store,
  the volunteer routing + `isVolunteerRoute`.
- **Phase 126:** the placeholder route/view `/volunteer/service/:serviceId`
  (`VolunteerServicePlaceholderView.vue`) THIS PHASE REPLACES; the `mySchedule` store (carries `orgId`).
- **Read-only renderers (reuse, do NOT fork the editor):** `ShareView.vue` + `buildServiceSnapshot()`
  (frozen PII-safe order-of-service render + print); the v2.7 read-only **Stage Layout** render + landscape
  "Print for tech" + `?view=stage`; the v2.11 in-app **PDF preview modal** (`SongFilePreviewModal.vue`) +
  the inline `<audio controls>` player from the Files tab (`SongFilesTab.vue`) — the Rehearse tab's
  preview/play building blocks already exist.
- **Design language:** app dark gray-950 Tailwind; v2.7 stage instrument icons.

### Established Patterns
- Read-only, snapshot/projection-fed rendering (ShareView "the link is the auth" analog, now authenticated).
- Download-token URLs as the media bearer capability (no storage.rules change).

### Integration Points
- Replace the placeholder route target with the real view; extend the projection + `buildRehearseAccess`;
  reuse ShareView/stage read-only render components; the v2.11 PDF/audio building blocks.

## ⚠ Baseline test note (CLAUDE.md)
- Type gate `npm run type-check`; app suite `npx vitest run` (baseline: only `storage.rules.test.ts` fails);
  rules suite `npm run test:rules`. If the projection gains fields, extend its unit tests + confirm the
  `get`-arm rule still passes. `.env.local` present.
</code_context>

<specifics>
## Specific Ideas
- Design reference: the owner's `Rehearsal.dc.html` (Turn 9) — the exact 3-column Rehearse layout (songs →
  detail with Print/Download → PDF reader + bottom audio player with speed + Loop), plus the caption "signing
  in is only so each person's playback position and their own downloads stay theirs" (per-person, minimal).
- Playback position persistence: keep LIGHT for v1 — localStorage per uid+track is enough (Phase 125 decision).
</specifics>

<deferred>
## Deferred Ideas
- Server-side transposition, loop-a-section, image/uploaded-video types → out of scope (milestone).
- Per-org storage quota + egress alerting → backlog (owner-deferred).
- Cross-device playback-position sync → future.
</deferred>
