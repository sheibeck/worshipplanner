# 0246. App brand is WorshipBuilder; internal identifiers keep their names

## Status

Accepted

## Context

The previous app name was taken. The owner locked WorshipBuilder (backlog 999.2, 2026-08-30). v2.16 Phase 144 (R446, R447) applies it to every user-facing surface; Phase 145 handles domain and console-side names.

## Decision

- **(a) Brand form.** `WorshipBuilder`: one word, capital W and B, on every screen and in every email that names the app.
- **(b) Edit in place, no constant.** Literals are edited where they stand. `index.html` cannot consume a shared constant, and the 13 UI sites are single static text nodes, so a constant would add a binding to each file for no behavioral gain.
- **(c) Internal identifiers keep their names.** The Firebase project id, `wp`-prefixed localStorage keys, package and repo names, code symbols and comments, and the sender address domain are not renamed. Renaming them would sign users out and drop per-browser settings (saved Run monitor setup, selected church, list prefs). The address domain moves in Phase 145.
- **(d) No-app subjects stay.** Subjects that name no app stay unchanged ("You've been added as an admin to {org}" and "Your sign-in link for {org}"); their bodies carry the brand. The From display name stays the org's own name.
- **(e) Role phrase stays.** The lowercase "worship planner" in the `claudeApi.ts` prompt names the person planning, not the app.
- **(f) Guard.** `src/__tests__/brandName.test.ts` does a case-sensitive, comment-stripped scan of user-facing source for the old name and for wrong brand variants, plus a positive per-site count table (U1-U14, E1-E12).
- **(f2) Rendered-text exception.** Every component brand site (U3-U14) is asserted by a mounted rendered-text test. Two sites are covered by the guard's source assertion instead: the `index.html` title (U1) and the `App.vue` loading splash (U2). `index.html` is not a component, and mounting the App root for one string needs a heavy harness (router, auth, Firebase). Orchestrator decision of 2026-10-27, under the owner's "take all your recommendations".
- **(g) Shipping.** No deploy in Phase 144. The email copy ships with the milestone-end coordinated deploy after a fresh `cd functions && npm run build`, with every function still re-exported from `functions/src/index.ts`; `functions/lib` is generated and never hand-edited. Console-side names (Firebase public-facing name, OAuth consent-screen name) are Phase 145 runbook steps; the `authDomain` switch is backlog 999.14.

## Consequences

Reintroducing the old name in user-facing source fails the root suite. `functions/lib` holds stale compiled copy until the deploy rebuild. Internal names still read WorshipPlanner by design. A new user-facing brand site must be added to the guard's positive table or it is covered only by the negative scan.

## Source comments

- `src/__tests__/brandName.test.ts`
