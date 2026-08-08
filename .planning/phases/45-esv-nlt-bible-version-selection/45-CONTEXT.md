# Phase 45: ESV/NLT Bible Version Selection - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in batch, owner accepted with one override (default = NLT)

<domain>
## Phase Boundary

A church chooses its scripture source — ESV or NLT — in Settings, with correct attribution everywhere
scripture appears, and changing the setting never retroactively alters scripture already on a slide.

In scope: the `OrgSettings.bibleVersion` field + its default, the Settings control, a shared
attribution helper used by both the scripture-slide path and the congregational-reading path, a
per-slide `translationSource` field stamped at creation, and the new NLT proxy (Cloud Function branch +
`nltApi.ts` client) built/tested **undeployed**. Out of scope: bulk re-fetching existing slides,
translations other than ESV/NLT.
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Settings choice & storage
- **Settings UI:** a new "Scripture" / "Bible Version" section in `SettingsView.vue` with an ESV/NLT
  choice control (segmented control or radio), gated to org editors like every sibling Settings control.
- **Storage:** ONE new field `bibleVersion: 'ESV' | 'NLT'` on `OrgSettings` (`src/types/organization.ts`)
  + ONE entry in `DEFAULT_ORG_SETTINGS`, merged through the SINGLE existing `auth.ts::loadOrgContext`
  merge point. No second defaults-merge point (same contract Phases 39/44 follow).
- **⚠ OVERRIDE (owner, 2026-08-07) — default = `'NLT'`, NOT `'ESV'`.** The recommended default was ESV
  (preserve current behavior); the owner chose **NLT** as the house default. A church that never opens
  the setting fetches NEW scripture from NLT.
  - **⚠ DEPLOY-COUPLING IMPLICATION (must honor in plan + PENDING-VERIFICATION):** the NLT proxy ships
    **undeployed**. A default of NLT therefore means **new scripture fetching does not work until the
    owner deploys the NLT Cloud Function**. The frontend (defaulting to NLT) and the `functions` NLT
    branch MUST be deployed **together** — if the frontend ships with an NLT default but the function is
    not yet deployed, every new scripture fetch fails. This must be stated in the handoff to the owner
    and recorded in PENDING-VERIFICATION.md § Phase 45. (Existing slides are unaffected — see Area 3.)

### Area 2 — Attribution (R091)
- **Format:** initials only — `(ESV)` / `(NLT)`. Per the requirement, non-saleable media (projected
  slides, bulletins) need only the initials, not a full copyright notice.
- **Build once, shared:** a single pure helper (e.g. `scriptureAttribution(version)`) used by BOTH the
  existing scripture-slide path and the new congregational-reading path — one implementation, not two.
- **Placement:** appended to the displayed/projected scripture text.

### Area 3 — Per-slide translation source (R092)
- **Field:** a per-slide `translationSource: 'ESV' | 'NLT'`, stamped **at slide creation** from the
  church's current `bibleVersion` setting.
- **Existing field-less slides → `'ESV'` at read time.** Slides created before this phase have no
  `translationSource` field; they resolve to `'ESV'` (ESV was the only source before this phase). This
  stability IS the R092 "never retroactively alter" guarantee — changing the church's setting later
  never rewrites an existing slide's translation or attribution.
  - Note the interaction with the Area-1 NLT default: the NLT default governs only NEW slides going
    forward; every pre-existing slide stays ESV via this field-less fallback. The two are not in
    conflict.
- **Which slides carry it:** scripture slides AND congregational-reading slides.

### Area 4 — NLT proxy (LOCKED by R090)
- Auth via a `key` **query parameter** (not a header — the ESV branch's header injection cannot be
  reused verbatim).
- New branch in `functions/src/index.ts` + a new `src/utils/nltApi.ts` client with a **native
  DOMParser** HTML-stripping step (NLT returns HTML, not JSON; no new dependency).
- **Tested against a real sample** fetched with the owner's `NLT_API_KEY` (present in `.env.local`,
  confirmed 2026-08-07) — the response shape is LOW-MEDIUM confidence and must be verified against a
  real fetch, not assumed.
- Ships **built, tested, and UNDEPLOYED**, with the exact `firebase deploy --only functions` command
  handed to the owner (per the standing v1.5 autonomy grant — NO DEPLOYS).

### Claude's Discretion
- Exact Settings control widget (segmented vs radio), the attribution helper's file placement, the
  `translationSource` field's exact TS location on the slide types, and the `nltApi.ts` internal parse
  structure — all at the planner/executor's discretion within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/esvApi.ts` — the existing ESV client; the structural sibling the new `nltApi.ts` mirrors
  (but NLT differs: query-param auth, HTML response).
- `functions/src/index.ts` — the existing scripture proxy Cloud Function (ESV branch); add an NLT branch
  here. Has `functions/src/index.test.ts` for coverage.
- `src/utils/scripture.ts`, `src/utils/scriptureBoundaries.ts` — scripture text handling; likely home
  for the shared attribution helper.
- `src/types/organization.ts` — `OrgSettings` (+ one field + one default), single merge in `auth.ts`.
- `src/views/SettingsView.vue` — add the Bible Version section.
- Scripture-slide + congregational-reading slide types in `src/types/service.ts` — add `translationSource`.

### Established Patterns
- Nested `OrgSettings` with a single `loadOrgContext` merge; consumers read `authStore.settings.<field>`.
- `stripUndefined` for Firestore writes; dot-path `updateDoc` for settings saves.
- Cloud Function proxy pattern already exists (ESV) — the NLT branch extends it, not a new function.

### Integration Points
- `OrgSettings`/`DEFAULT_ORG_SETTINGS`/`loadOrgContext` (setting + default).
- `functions/src/index.ts` (NLT proxy branch) + `src/utils/nltApi.ts` (client).
- Scripture fetch call sites (route ESV vs NLT by the church setting).
- Scripture-slide + congregational-reading render paths (attribution + per-slide translationSource).
</code_context>

<specifics>
## Specific Ideas

- The NLT-default override (Area 1) and its deploy-coupling implication are the single most important
  things planning and the owner handoff must carry.
- R090's response-shape confidence is LOW-MEDIUM — the plan must have the executor fetch and inspect a
  REAL NLT sample (owner's key is present) before finalizing the DOMParser HTML-stripping, not assume.
</specifics>

<deferred>
## Deferred Ideas

- Bulk re-fetch / re-translate of existing slides — explicitly out of scope (would violate R092).
- Additional translations beyond ESV/NLT — not this phase.
</deferred>
