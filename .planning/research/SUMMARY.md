# Project Research Summary

**Project:** WorshipPlanner — Church Worship Service Planning Web App
**Domain:** Collaborative worship service planning (Vue 3 + Firebase SPA)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

WorshipPlanner is a purpose-built, single-organization web app for planning Sunday worship services around the Vertical Worship 1-2-3 methodology. Research confirms this is a well-understood SPA problem domain (auth + CRUD + algorithm) with a mature, low-risk stack (Vue 3 + Firestore + Firebase Auth), but with one genuine differentiator: no existing competitor — Planning Center, WorshipTools, WorshipPlanning.com, or Worship Planner — implements smart song suggestions that combine category type, rotation recency, and team configuration in a single recommendation. That gap is the reason to build this app at all, and it must ship in v1.

The recommended approach is a Vue 3 Composition API SPA with Firestore as the backend, structured around org-scoped collections, embedded service slot data (not normalized joins), and a composable-based suggestion algorithm. The architecture is intentionally lean for a 2-3 planner team: one Pinia store per domain, Firestore `onSnapshot` listeners managed through stores (not VueFire composables in stores), and PapaParse for the Planning Center CSV import that bootstraps the song library. Firebase Hosting deploys the Vite build with zero infrastructure overhead.

The primary risks are all preventable if addressed in Phase 1: the Firebase Auth race condition that causes redirect loops on page refresh, Firestore security rules shipped open during development, over-normalized data that produces N+1 reads for service plans, and CSV import that silently corrupts song records from real Planning Center exports. Addressing these in the foundation phase prevents high-recovery-cost rewrites later. The secondary risk — the suggestion algorithm degenerating to a fixed 20-song playlist — must be built correctly the first time by including staleness-boosting in the algorithm, not added as a patch after users complain.

---

## Key Findings

### Recommended Stack

The stack is well-defined and mostly non-negotiable: Vue 3 (team constraint) + Firebase (team constraint) + Vite 7 (official Vue build tool). The key decisions on top of those constraints are PrimeVue 4 for UI components (90+ components, avoids weeks of UI work, superior to Vuetify for a non-Material design), Tailwind CSS 4 for layout/spacing, and VueFire 3 for component-level Firestore bindings — with the important caveat that VueFire composables should not be used inside Pinia stores due to known reactivity context issues; use raw `onSnapshot` in stores instead.

Supporting libraries are well-chosen for specific needs: PapaParse for CSV (the only serious JS CSV parser, handles all Planning Center export edge cases), VeeValidate + Zod for form validation (Vue-native composables + TypeScript inference), date-fns for recency calculations in the suggestion engine, and `pinia-plugin-persistedstate` for preserving filter state and auth across page refreshes. The PWA (`vite-plugin-pwa`) is deferred to v2+ per feature research, though the architecture supports it.

**Core technologies:**
- Vue 3 (^3.5.x) + Vite 7: Frontend framework + build tool — team constraint, current standard
- Firebase JS SDK (^12.x) + Firebase Auth: Backend + auth — team constraint, modular API tree-shakes well
- VueFire (^3.2.2): Reactive Firestore bindings for components — use in views/components, NOT in Pinia stores
- Pinia (^3.0.4): State management — one store per domain (songs, services, tasks, auth)
- PrimeVue (^4.4.x): UI components — DataTable, Dropdown, Calendar, Dialog eliminate weeks of work
- Tailwind CSS (^4.x): Layout and utility styling — complements PrimeVue in unstyled mode
- PapaParse (^5.5.3): CSV parsing — handles Planning Center exports with embedded commas, BOM, CRLF
- VeeValidate + Zod: Form validation — Vue-native composables with TypeScript schema inference
- date-fns (^4.x): Date calculations — recency scoring in suggestion algorithm

**What to avoid:** Vuex (maintenance mode), Vue CLI/webpack (maintenance mode), moment.js (deprecated by authors), PDF generation libraries for print (CSS `@media print` is superior), VueFire 2.x (incompatible with Firebase SDK v9+), `signInWithRedirect` without custom auth domain (broken in Chrome M115+, Firefox 109+, Safari 16.1+).

### Expected Features

No competitor encodes a worship methodology into the planning flow. The Vertical Worship 1-2-3 type system is the foundational differentiator that makes every other feature coherent — it must be implemented before service order builder, suggestion algorithm, or seasonal overview, because all three reference it.

**Must have (table stakes — v1):**
- CSV import from Planning Center export — without this, onboarding requires manual entry of 100+ songs; no team will do it
- Song library management (add/edit/search/filter) — with Vertical Worship category (1/2/3) and arrangement support
- Service order builder with fixed Vertical Worship slot structure (1-2-2-3 or 1-2-3-3 progression)
- Smart song suggestions (category + rotation recency + team configuration) — the core differentiator
- Song usage history tracking — feeds the suggestion engine; recorded when songs are placed in plans
- Team configuration per service (choir/orchestra present) — constrains available song pool
- Print formatted order of service — teams print for Wednesday rehearsal and Sunday
- Google OAuth authentication — team preference; email/password as fallback
- Shareable read-only plan link — team pulls up plans on phones during rehearsal

**Should have (competitive — v1.x after validation):**
- Collaborator invites (2-3 planners)
- Seasonal/quarterly overview (visualize rotation patterns across weeks)
- Recurring task checklist with pre-categorized worship team categories
- Scripture selection guidance and pastor's passage tracking
- Export for Planning Center manual entry

**Defer (v2+):**
- Progressive Web App offline support
- Musician/team read-only view
- Historical analytics
- Multiple service types

**Anti-features — do not build:**
- Planning Center API sync (OAuth app registration + rate limits + schema fragility)
- Real-time collaborative editing (CRDT complexity, 2-3 planners take turns in practice)
- ProPresenter integration (requires native OS access; impossible from web)
- CCLI automatic reporting (requires CCLI licensing agreement)
- Musician scheduling (Planning Center solves this; duplicating it adds cost without displacing PC)

### Architecture Approach

The architecture is a layered Vue 3 SPA: Pages/Views compose Feature Components which read from Pinia Stores, which in turn manage Firestore subscriptions and writes. Business logic (suggestion algorithm, CSV parsing, print formatting) lives in composables — not stores — keeping stores thin and logic unit-testable without Firebase mocking. The feature-based folder structure (`src/features/songs/`, `src/features/services/`) groups all files for a domain together.

The Firestore schema is org-scoped (`/organizations/{orgId}/songs`, `/organizations/{orgId}/services`) and intentionally denormalized: service slots embed song snapshots (title, key, BPM, category) to avoid join reads at print/display time. Service slots are embedded arrays in the service document (not a subcollection), eliminating N+1 reads. Usage history is a separate lightweight subcollection queried independently by the suggestion engine.

**Major components:**
1. `authStore` + `LoginView` + router `beforeEach` guard — Firebase Auth with `authReady` promise to prevent race condition
2. `songsStore` + `SongsView` + `CsvImportWizard` — Song stable with Firestore `onSnapshot`, PapaParse import, category management
3. `servicesStore` + `ServiceEditor` + `SuggestionPanel` — Core planning workspace; embeds slot data; calls suggestion composable
4. `useSongSuggestions` composable — Filters by category → team config → scores by recency + staleness; returns ranked top 10
5. `useCsvImport` composable — PapaParse in worker mode → row validation → preview UI before Firestore batch write
6. `ServicePrint` view + `usePrint` composable — CSS `@media print` layout; no PDF library

**Key patterns to follow:**
- Thin stores (CRUD + reactive state), fat composables (business logic)
- `onSnapshot` in Pinia stores with explicit `unsubscribe` cleanup, not VueFire `useCollection` in stores
- Org-scoped Firestore paths with membership-checked security rules from day one
- Denormalize `songTitle` into service slots; avoid joins at read time
- `authReady` Promise in auth store; router guard `await authStore.authReady` before checking user

### Critical Pitfalls

1. **Firebase Auth race condition with Vue Router** — Implement an `authReady` Promise that resolves after `onAuthStateChanged` fires once; `await` it in `router.beforeEach`. Without this, page refresh bounces authenticated users to login. Address in Phase 1.

2. **Firestore over-normalization (SQL mental model)** — Embed service slots and arrangement data in parent documents; denormalize `songTitle` into slots. A join-based schema causes N+1 reads and cost explosions. Design the data model in Phase 1 before building any feature — migration is expensive.

3. **Open Firestore security rules in production** — Write minimum viable rules in Phase 1 (default deny, require auth, scope writes to org members). Firebase projects with `allow read, write: if true` are actively exploited. Rules must ship with v1, not as a follow-up.

4. **Runaway Firestore listeners causing memory leaks** — Always capture the `unsubscribe` function from `onSnapshot` and call it in `onUnmounted` or store cleanup. Establish this composable pattern in Phase 1 before building any features that use listeners.

5. **CSV import silently corrupting song data** — Use PapaParse (not a hand-rolled parser) for all Planning Center CSV parsing. Always validate each row and show a validation summary before committing to Firestore. Real PC exports contain embedded commas, BOM markers, CRLF, and smart quotes. Address in Phase 1 when CSV import is built.

6. **Song suggestion algorithm degenerating to fixed playlist** — Sort eligible songs by `daysSinceLastUsed` descending (longest gap first). Add staleness boost (+score) for songs unused 8+ weeks. Track `lastSuggestedDate` separately from `lastUsedDate`. Build this correctly in Phase 2; retrofitting after user complaints requires backfilling Firestore data.

---

## Implications for Roadmap

Based on research, the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md strongly suggest a 5-phase structure. The Vertical Worship category system and Firestore data model are the foundational decisions that everything else depends on — they must be resolved before any feature is built.

### Phase 1: Foundation — Auth, Data Model, Firebase Integration

**Rationale:** All 6 critical pitfalls listed above must be addressed before building features, because fixing them after the fact is expensive (data migration for schema, Firestore cost explosion for N+1 reads, security exposure for open rules). The `authReady` pattern, org-scoped security rules, and listener cleanup composable pattern must be established here and reused consistently.

**Delivers:** Working auth flow (Google OAuth + email/password), protected routes, Firebase initialization singleton, org-scoped Firestore schema with TypeScript interfaces, security rules with member-check, Firebase Emulator integration for local dev/test.

**Addresses:** Auth, team membership model, TypeScript types for Song/ServicePlan/Task/User

**Avoids:** Auth race condition, open security rules, over-normalized schema, monolithic Pinia store, listener memory leaks

**Research flag:** Standard patterns — well-documented Vue Router + Firebase Auth integration. No additional research needed.

---

### Phase 2: Song Library + CSV Import

**Rationale:** The song stable is the prerequisite for every other feature. Smart suggestions, service planning, usage tracking, and team configuration all require songs to exist. CSV import must ship with the song library — not as a follow-up — because manual entry of 100+ songs is the onboarding blocker. The import validation UI (row-level error reporting, preview before commit) must ship with the feature to prevent silent data corruption.

**Delivers:** Song library view with search/filter, add/edit/delete, Vertical Worship category (1/2/3) classification, arrangement management, Planning Center CSV import with validation preview and PapaParse worker mode.

**Uses:** PapaParse in `worker: true` mode, VeeValidate + Zod for song edit form, PrimeVue DataTable for song list

**Implements:** `songsStore` with `onSnapshot` + `startListening`/`stopListening`, `useCsvImport` composable, `CsvImportWizard` multi-step UI

**Avoids:** CSV silent corruption pitfall, lazy per-slot song loading anti-pattern (load stable once), performance trap of `reactive({})` for arrays

**Research flag:** Standard patterns for PapaParse + Vue 3. No additional research needed.

---

### Phase 3: Service Planning + Core Suggestion Engine

**Rationale:** Service planning is the core workflow; it depends on Phase 2 songs being loaded. The smart suggestion algorithm — the product's primary differentiator — ships here, built correctly with staleness scoring from the start. Team configuration per service also ships here because it's a prerequisite input to the suggestion filter. Usage history writes begin here (recorded when songs are placed), enabling the rotation awareness that makes suggestions meaningful.

**Delivers:** Week-by-week services calendar, service editor with Vertical Worship slot structure (1-2-2-3 / 1-2-3-3 progression), suggestion panel with ranked top-10 songs (filtered by category + team config, scored by recency + staleness), per-service team configuration (choir/orchestra), automatic usage history recording.

**Uses:** `useSongSuggestions` composable (category filter → team filter → recency/staleness scoring), `useServiceOrder` composable (slot management), `servicesStore`, PrimeVue Dropdown/Dialog

**Implements:** Core planning workspace (`ServiceEditor`), `SuggestionPanel`, `usageHistory` subcollection writes

**Avoids:** Suggestion degeneration pitfall (staleness boost built in from start), subcollection anti-pattern for slots (embedded array)

**Research flag:** Suggestion algorithm scoring weights (recency vs. staleness vs. category balance) may benefit from a short design spike to validate the scoring formula before implementation. The algorithm logic itself is clear from research; the tuning is domain-specific.

---

### Phase 4: Output — Print, Share, Export

**Rationale:** Print and share are table stakes that every competitor offers, but they depend on the service plan existing (Phase 3). CSS `@media print` with a dedicated `ServicePrint` view is the correct approach — PDF generation libraries produce inconsistent output for text-heavy layouts. The read-only shareable link enables rehearsal use on phones and replaces the current email-the-spreadsheet workflow. Export for Planning Center manual entry is low complexity and high value once the plan data is structured.

**Delivers:** Formatted printable order of service (`ServicePrint` view with `@media print` stylesheet), shareable read-only plan link, structured export for Planning Center manual entry.

**Uses:** CSS `@media print` + `window.print()`, `usePrint` and `useShareLink` composables

**Avoids:** Print layout pitfall (flexbox/grid with poor print page-break support), PDF library pitfall (`html2pdf.js`/`jsPDF`), mobile view untested pitfall (read-only share view tested on physical device)

**Research flag:** Standard patterns. CSS print media queries are well-documented. No additional research needed.

---

### Phase 5: Collaboration + v1.x Features

**Rationale:** Collaborator invites require auth and membership infrastructure (Phase 1) but no new architecture. The seasonal/quarterly overview requires multiple weeks of service data (Phase 3). Recurring tasks are a secondary workflow that becomes valuable once the core planning loop is validated. These features add depth without changing the core data model.

**Delivers:** Collaborator invites with expiring tokens, role-based UI guards (admin vs. planner vs. viewer), seasonal/quarterly multi-week overview for spotting rotation patterns, recurring task checklist with pre-categorized worship team categories, scripture selection guidance with pastor's passage tracking.

**Uses:** `members` subcollection CRUD, invite token storage with `expiresAt` in Firestore, `tasksStore`

**Implements:** `InviteAccept` flow, role-based conditional rendering, `TasksView`, quarterly overview calendar

**Avoids:** Invite without expiry security pitfall, invite link exposing full song stable (read-only share uses separate rendering path)

**Research flag:** Invite token pattern (store in Firestore with expiry, validate on claim) is a well-known Firebase pattern. No additional research needed. Role-based security rules (admin vs. planner) may need a brief rules design spike to get right.

---

### Phase Ordering Rationale

- **Foundation before features:** All 6 critical pitfalls map to Phase 1 decisions. Deferring the data model, security rules, or auth pattern means expensive migration or security exposure.
- **Songs before services:** The dependency graph is explicit — suggestions, service planning, and usage tracking all require a populated song stable. CSV import ships with songs, not after.
- **Suggestions in Phase 3 (not later):** The suggestion algorithm is the primary differentiator. If it ships in a later phase, the app is not meaningfully better than a spreadsheet until that phase is complete.
- **Output in Phase 4:** Print/share are needed before the app can replace the existing workflow, but they depend on the service plan structure being stable.
- **Collaboration last:** The app is usable by a single planner before invites are built. Starting with one user simplifies testing and validation.

### Research Flags

Phases likely needing deeper design work during planning:
- **Phase 3:** Suggestion algorithm scoring weights (recency decay curve, staleness threshold at 8 weeks, tie-breaking) are domain-specific and need a brief design spike. The algorithm structure is clear; the tuning is not independently verifiable from research.
- **Phase 5 (security rules):** Admin vs. planner vs. viewer rule differentiation should be sketched before implementation to avoid rule rewrites.

Phases with standard, well-documented patterns (no additional research needed):
- **Phase 1:** Firebase Auth + Vue Router race condition fix is well-documented with code examples
- **Phase 2:** PapaParse + Vue 3 CSV import is a standard pattern
- **Phase 4:** CSS `@media print` service order is straightforward
- **Phase 5:** Invite token pattern with Firestore expiry is a standard Firebase pattern

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack (Vue 3, Vite 7, Firebase 12, VueFire 3.2.2, Pinia 3, Vue Router 5) verified via official docs and npm. PrimeVue 4.4.1 released Feb 2026. Supporting libraries verified. |
| Features | MEDIUM | Competitor features verified via official sources (MEDIUM-HIGH). Smart suggestion gap confirmed by absence across all reviewed tools (MEDIUM). Vertical Worship 1/2/3 methodology from project context only — no independent source (LOW for external validation). |
| Architecture | MEDIUM-HIGH | Core Vue 3 + Firestore patterns (Pinia, onSnapshot, security rules, data structure) from official Firebase docs (HIGH). Feature-based folder structure from community consensus (MEDIUM). VueFire/Pinia context issue from GitHub discussions (MEDIUM — single source but widely reproduced). |
| Pitfalls | MEDIUM-HIGH | Auth race condition, open security rules, listener cleanup from official Firebase docs (HIGH). CSV corruption, suggestion degeneration, performance traps from multiple community sources (MEDIUM). Domain-specific UX pitfalls from single sources (LOW — but low risk to address). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Vertical Worship methodology specifics:** The 1/2/3 category system and its constraints (which slot types require which category, when 1-2-2-3 vs. 1-2-3-3 is chosen) are defined by the project context (`PROJECT.md`) but not independently sourced. Before Phase 3, confirm with the team the exact rules for slot type enforcement and progression selection — these determine how the suggestion algorithm's category filter operates.

- **Suggestion algorithm scoring weights:** Research identifies the correct shape of the algorithm (category filter → team filter → recency/staleness scoring), but the specific weight values (-80 for last 2 weeks, -20 for weeks 3-8, +10 for never used, +staleness boost at 8 weeks) are reasoned from first principles. Validate these weights against the team's actual song library before treating them as final.

- **Planning Center CSV export column schema:** The CSV import feature depends on Planning Center's specific export format (column headers, arrangement column naming convention, multi-arrangement layout). Research identifies that PC exports use per-arrangement columns and may have trailing spaces in headers, but the exact column schema should be validated against a real export file before finalizing `useCsvImport` column mapping.

- **`signInWithRedirect` vs. `signInWithPopup`:** Pitfalls research flags `signInWithRedirect` as broken in Chrome M115+, Firefox 109+, and Safari 16.1+ without a custom auth domain. Stack research recommends `signInWithPopup` as default. Confirm Firebase Hosting custom domain configuration in Phase 1 if redirect-based login is preferred for mobile.

---

## Sources

### Primary (HIGH confidence)

- [VueFire Official Docs](https://vuefire.vuejs.org/guide/getting-started.html) — VueFire 3.2.2 installation, peer dependencies, Pinia caveats
- [Firebase Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices) — document size limits, write limits, subcollection vs. embed tradeoffs
- [Firebase Firestore — Secure data access for users and groups](https://firebase.google.com/docs/firestore/solutions/role-based-access) — RBAC pattern with membership subcollection
- [Firebase Fix Insecure Rules](https://firebase.google.com/docs/firestore/security/insecure-rules) — open rules exploitation
- [Firebase Auth Redirect Best Practices](https://firebase.google.com/docs/auth/web/redirect-best-practices) — Chrome M115+ breaking change
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims) — server-side claim assignment
- [Pinia Introduction](https://pinia.vuejs.org/introduction.html) — one store per domain, replaces Vuex
- [Vue Router Migration v4-to-v5](https://router.vuejs.org/guide/migration/v4-to-v5) — no breaking changes confirmed
- [Vite 7.0 Announcement](https://vite.dev/blog/announcing-vite7) — current stable
- [PapaParse npm](https://www.npmjs.com/package/papaparse) — v5.5.3, no dependencies

### Secondary (MEDIUM confidence)

- [WorshipTools Songs in Planning documentation](https://www.worshiptools.com/en-us/docs/83-pl-songs) — confirms sort-by-last-used, no smart suggestions
- [Planning Center Services features](https://www.planningcenter.com/services) — competitor feature baseline
- [ChurchSuite filters announcement, August 2025](https://churchsuite.com/blog/2025-08-13-new-filters-to-help-you-find-what-matters-most/) — industry trend toward recency filtering
- [The Church Collective: Worship Planning Song Types](https://thechurchcollective.com/worship-planning/worship-planning-song-types/) — three-category song typology as established framework
- [VueFire + Pinia known issues](https://github.com/vuejs/vuefire/discussions/1453) — why to use onSnapshot directly in stores
- [Vue 3 feature-based folder structure — Vue School](https://vueschool.io/articles/vuejs-tutorials/how-to-structure-a-large-scale-vue-js-application/) — feature module organization

### Tertiary (LOW confidence — needs validation)

- [Worship Planner features](https://worshipplanner.com/features) — page returned JS bundle; description from search snippet only
- Project context `PROJECT.md` — Vertical Worship 1/2/3 methodology definition (HIGH for project requirements, but unverified externally)
- [Common Worship Service Planning Mistakes — Ministry Brands](https://www.ministrybrands.com/blog/common-worship-service-planning-mistakes-and-how-to-avoid-them) — domain context only

---

*Research completed: 2026-03-03*
*Ready for roadmap: yes*
