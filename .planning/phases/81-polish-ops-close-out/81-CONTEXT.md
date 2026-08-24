# Phase 81: Polish & Ops Close-Out - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-accepted from the v2.2 standing grant + milestone research; no interactive Q&A per owner grant)

<domain>
## Phase Boundary

Close four independent polish/ops debts: (R237) include non-song/non-scripture service slots in ALL Planning
Center export modes; (R238) make volunteer messaging email deliverable from a Resend-verified domain, with an
owner DNS runbook; (R239) bring the Owner Console (and the matching Service Editor tab strip) to baseline
accessibility without breaking its always-mounted panels; (R240) extract one shared song-browse component
used by both the Songs page and the service-plan song picker.

No new visual DESIGN — R239 is an a11y retrofit that PRESERVES the current look, R240 is a refactor that
preserves current behavior. So no UI-SPEC is needed; plan with `--skip-ui`.
</domain>

<decisions>
## Implementation Decisions

### R237 — PC export includes non-song/non-scripture slots (client-only)
- Every service slot (prayer, offering, welcome, message/sermon, announcements, etc.) must become a Planning
  Center plan item in EVERY export mode — no slot silently dropped. Today the export special-cases only
  song + scripture item titles (`planningCenterApi.ts` "Worship Song -"/"Scripture -" conventions).
- For a non-song/non-scripture slot, create a generic PC item titled from the slot's own label/section (a
  sensible default length), across all export modes. Research must confirm what "all export modes" means in
  the current code and where items are assembled.
- Client-only; no rules/functions/deploy. (backlog 999.4)

### R238 — verified-domain email + owner runbook (owner-run ops; minimal code)
- Per the standing grant: change ONLY the sender address to the verified domain; leave `SERVICE_SHARE_BASE_URL`
  on the Firebase default (no functions redeploy for share links).
- The send path already reads the sender from Firestore-backed `appConfig.sender.fromAddress` (owner-settable
  live in the Owner Console `SenderConfigCard`). Deliverable is primarily a DOC: an owner runbook
  (`functions/DEPLOY-EMAIL-DOMAIN.md` or similar) covering Resend domain add + SPF/DKIM/DMARC DNS records +
  setting `fromAddress` to a verified sender in the Console. Confirm the send path uses the configured sender
  (not a hard-coded `onboarding@resend.dev`); if any hard-coded fallback remains on the live send path, make
  the configured value authoritative. Record the owner steps in PENDING-VERIFICATION.md.
- DNS/domain verification is OWNER-RUN and not app-verifiable — this requirement's "done" is a documented,
  correct runbook + the code wiring, NOT a guarantee mail is verified. (backlog 999.6)

### R239 — Owner Console accessibility (client-only; adds ONE dev dependency)
- Add `eslint-plugin-vuejs-accessibility@^2.6.0` (confirmed ESLint-10 compatible, flat-config export — research
  STACK.md) to `eslint.config.ts`; let it enumerate the defect surface, then fix:
  - real `<label>`/`aria-label` on the Owner Console text inputs (super-admin grant form; Organizations
    onboard + assign forms — currently placeholder-only);
  - ARIA tab semantics (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) on the
    Configuration/Organizations tab strip AND the matching `ServiceEditorView.vue` tab strip.
- CRITICAL (research PITFALLS): the Owner Console tab strip is `v-show`-always-mounted so its `onSnapshot`
  listeners stay live — do NOT convert to `v-if`/conditional render; add ARIA attributes WITHOUT changing the
  mount strategy. A generic ARIA-tabs retrofit that assumes conditional panels would regress the live listeners.
- Client-only (dev-dependency + lint config + template attributes); no runtime deploy. (backlog 999.7)

### R240 — shared song-browse component (client-only refactor)
- Extract ONE shared song-browse component (search + filters + list) used by BOTH the Songs page
  (`SongsView.vue`/`SongTable.vue`) and the service-plan song picker (in `ServiceEditorView.vue`). Preserve
  each consumer's current behavior; the goal is de-duplication, not redesign. Research must map the two current
  browse surfaces and the smallest shared component that serves both. (backlog 999.1)

### Deploy discipline
- R238 is owner-run DNS/Resend ops — not app-deployable; deliver the runbook + wiring, record owner steps.
- R237, R239, R240 are client-only (R239 adds a dev-only lint dependency — no runtime change).

### Claude's Discretion
- The exact generic PC item title/length for non-song slots (R237); the precise shared-component boundary and
  name (R240); which lint rules to enable vs. defer if the plugin flags a very large pre-existing surface
  (keep R239 scoped to the Owner Console + the two named tab strips — do NOT expand to an app-wide a11y sweep).
</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- `src/utils/planningCenterApi.ts` (item assembly, "Worship Song -"/"Scripture -" title conventions) +
  `ServiceEditorView.vue`'s export dialog/modes — R237.
- `functions` send path (`adminEmail.ts`/`params.ts`), `appConfig.sender.fromAddress`, the Owner Console
  `src/components/admin/SenderConfigCard.vue` — R238.
- `src/views/OwnerConsoleView.vue` + `src/components/admin/*` (ConfigurationTab, OrganizationsTab, grant form)
  + `ServiceEditorView.vue` tab strip; `eslint.config.ts` — R239.
- `src/views/SongsView.vue` + `src/components/SongTable.vue` + `SongFilters.vue`, and the service-plan song
  picker inside `ServiceEditorView.vue` — R240.

### Established Patterns
- Owner Console panels are `v-show`-always-mounted for live `onSnapshot` (do not break — R239).
- Runtime config is Firestore-backed `appConfig` (R238 sender already surfaces there).
</code_context>

<specifics>
## Specific Ideas
- Full milestone research: `.planning/research/STACK.md` (the eslint a11y plugin + Resend DNS steps),
  `FEATURES.md`, `PITFALLS.md` (the v-show tab-strip caveat).
- These four are backlog 999.4 / 999.6 / 999.7 / 999.1 respectively.
</specifics>

<deferred>
## Deferred Ideas
- App-wide accessibility sweep beyond the Owner Console + the two named tab strips (R239 stays scoped).
- In-app surfacing of Resend domain-verification status (webhook/API poll) — beyond the manual runbook.
- Moving `SERVICE_SHARE_BASE_URL`/share links to a custom domain (grant: leave on Firebase default).
</deferred>
