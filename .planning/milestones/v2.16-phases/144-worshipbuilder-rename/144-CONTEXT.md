# Phase 144: WorshipBuilder Rename - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner instruction 2026-10-27 "take all your recommendations": every
grey-area answer below is the recommended option, auto-accepted.

<domain>
## Phase Boundary

Every user-facing occurrence of the app name — on screen and in every outbound email — reads
**WorshipBuilder**. Internal identifiers (Firebase project id, `wp`-prefixed storage keys, code symbols,
package/repo names) are untouched, so sign-ins and saved per-browser settings keep working. Copy-only: no
layout change. Requirements R446–R447. The domain move is Phase 145.

</domain>

<decisions>
## Implementation Decisions

### Brand form
- The brand is **"WorshipBuilder"** — one word, capital W and B — in every surface: `index.html` `<title>`,
  app shell/sidebar header (`App.vue`, `AppSidebar.vue`, `AppShell.vue`), `LoginView`, `SelectChurchView`,
  the volunteer pages (`VolunteerSignInView`, `VolunteerRequestView`, `VolunteerLinkCompleteView`), and the
  footers ("Shared from WorshipBuilder" on `ShareView` ×2 + `QuarterShareView`; "Generated from
  WorshipBuilder" on `ServicePrintLayout` + `RosterPrintLayout`).
- Email copy: every subject and body that names the app says WorshipBuilder — `functions/src/adminEmail.ts`,
  `functions/src/inviteOnboarding.ts`, `functions/src/volunteerLink.ts` (and their tests:
  `functions/src/adminEmail.test.ts`, `functions/src/index.test.ts`).

### What is NOT renamed
- `src/utils/claudeApi.ts` "The worship planner applies the 1-2-3 paradigm…" — "worship planner" names the
  person planning, not the app. Leave it.
- Code comments and symbols mentioning WorshipPlanner (`pcSongImport.ts`, `roster.ts`,
  `ServiceEditorView.vue` comment) — internal; leave them (R446).
- Email **From** display name — already the org's own name (`fromDisplayName`); unchanged.
- Favicon/logo — no app-name text in assets; no PWA manifest exists; nothing to change.
- Firebase project id, `wp`-prefixed localStorage keys, package.json name, repo name — unchanged.

### Shipping
- No deploy in this phase. The rename ships in the milestone-end coordinated deploy together with the
  Phase 145 cutover (functions for email copy — rebuild `functions/lib` first and keep every function
  re-exported from `functions/src/index.ts` — plus hosting), with per-deploy owner confirmation.
- Console-side names (Firebase project public-facing name, Google OAuth consent screen app name) are
  listed as optional owner steps in the Phase 145 cutover runbook, not done here.

### Claude's Discretion
- Whether to centralize the brand string in a small constant (e.g. `src/utils/appName.ts` /
  `functions/src/appName.ts`) or edit each literal — prefer a shared constant only if it does not add
  churn to the 14 single-literal UI files; tests must assert the rendered text either way.
- Add a regression guard (a test or lint-style grep test) that fails if "Worship Planner" /
  "WorshipPlanner" reappears in user-facing source.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/params.ts` `fromDisplayName` — From header display name (org name), unchanged.
- Each email module builds subject/body strings in one function (`adminEmail.ts` ~L33-84,
  `inviteOnboarding.ts` ~L58-168, `volunteerLink.ts` ~L35-77).

### Established Patterns
- Email modules are tested through `functions/src/*.test.ts` with assertions on subject/body text — update
  those assertions to WorshipBuilder.
- Functions deploy requires re-export from `functions/src/index.ts` and a fresh `functions/lib` build
  (no predeploy build hook) — not exercised here (no new function), but the email change ships via a
  functions deploy later.
- Comment convention: short comments; rationale in ADRs.

### Integration Points
- UI literals: `index.html:7`, `src/App.vue:8`, `src/components/AppSidebar.vue:10`,
  `src/components/AppShell.vue:30`, `src/views/LoginView.vue:6`, `src/views/SelectChurchView.vue:6`,
  `src/views/VolunteerSignInView.vue:5`, `src/views/VolunteerRequestView.vue:5`,
  `src/views/VolunteerLinkCompleteView.vue:5`, `src/views/ShareView.vue:30,149`,
  `src/views/QuarterShareView.vue:122`, `src/components/ServicePrintLayout.vue:112`,
  `src/components/RosterPrintLayout.vue:34`.
- Existing view tests that assert the old name must be updated (grep `Worship Planner` in `src/**/__tests__`).

</code_context>

<specifics>
## Specific Ideas

The name "Worship Planner" is taken; the owner locked "WorshipBuilder" (backlog 999.2, 2026-08-30).

</specifics>

<deferred>
## Deferred Ideas

- Switching the Auth `authDomain` so Google's account chooser names the new domain — v2 requirement
  (backlog 999.14).

</deferred>
