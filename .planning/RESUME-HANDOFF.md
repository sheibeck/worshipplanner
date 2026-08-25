# Resume handoff — written 2026-08-25 (pre-/compact)

Quick-orient note for continuing after a context compaction. Delete when no longer needed.

## Milestone v2.2 — code-complete, HELD OPEN (not archived)
- All 5 phases (79–83) + the `260824-org-config-slideout` quick task are code-complete, auto-verified,
  committed to `master`. Audit PASSED (`.planning/v2.2-MILESTONE-AUDIT.md`).
- Owner chose **"keep open"** — do NOT run `/gsd-complete-milestone` / cleanup until they say so.
- **Owner deploy hand-overs (still pending unless owner reports done):**
  1. `firebase deploy --only firestore:rules` (Phase 80 rules)
  2. `firebase deploy --only firestore:rules,functions:setOrgAiEnabled,functions:api` (Phase 82) — **owner already ran this once; it failed** ("No function matches the filter") → fixed by commit `640bf5df` (re-export setOrgAiEnabled from functions/src/index.ts). Owner needs to RE-RUN it. Then **re-enable AI for Berean** (defaults OFF).
  3. `functions/DEPLOY-EMAIL-DOMAIN.md` — Resend verified-domain runbook (R238). Owner DEFERRED it (wants one app-level worshipplanner domain, not per-church; not doing it yet).
- **Hosting NOT yet redeployed with the latest client.** Owner was missing v2.2 UI in prod because only functions/rules were deployed. Fix: `npm run build` then `firebase deploy --only hosting`. (dist/ was rebuilt fresh once already; any further client changes need another build+hosting deploy.)
- Deferred human UAT for every phase + the slideout is itemized in `PENDING-VERIFICATION.md` (`/gsd-verify-work 79..83`).

## IN-FLIGHT background agents (were running at compaction — handle their completion notifications)
1. **Org-slideout FULL restructure (gsd-executor, source-committing).** Reworking `OrganizationsTab.vue` +
   `OrgConfigDrawer.vue`: rows become DATA-ONLY (Church · Org ID · Created · Members · trailing `>`),
   whole row clickable to open the slideout, and ALL actions (Assign admin, Enter church, AI checkbox,
   Deactivate/Reactivate, Delete deactivated-only) live INSIDE the drawer — mirroring `SongTable.vue`.
   Reuses existing callables; client-only. On completion: confirm gates (OrganizationsTab/OrgConfigDrawer/
   Deactivate/Delete dialog tests + type-check + app 2-file baseline); tell owner to rebuild+`firebase deploy
   --only hosting` to see it. This is a follow-up to quick task 260824 (owner testing feedback).
2. **Emulator sample-data seed — DONE (authored, NOT yet committed).** Files on disk, uncommitted:
   `functions/seed-emulator-data.mjs` (new) + `package.json` (added `"seed:emulator": "node functions/seed-emulator.mjs && node functions/seed-emulator-data.mjs"`).
   Seeds 2 churches (emu-berean AI-on, emu-grace) + owner membership + merge-preserving claim (superAdmin +
   orgs map) + 4 teams / 8 roles / 8 people / 10 songs / 1 service / 1 quarter. Idempotent, self-contained,
   `node --check` clean. Minimal bits: service is a 6-slot subset, quarter.calendar empty (owner clicks
   Generate). **TODO: commit these (with RESUME-HANDOFF.md) AFTER agent #1's executor commits its own
   OrganizationsTab/OrgConfigDrawer changes** — do not sweep the executor's in-progress edits into this commit.
   Owner run command: emulators up → `npm run seed:emulator` (or `node functions/seed-emulator-data.mjs`).

## Serialization rule I've been holding
Only ONE source-committing executor at a time (git-index race avoidance). Agent #2 does not commit; I commit
its output myself AFTER agent #1 lands.

## Local emulator super-admin setup (owner asked; existing tooling)
- Existing script: `functions/seed-emulator.mjs` → makes `sheibeck@gmail.com` super-admin in the emulators
  (creates auth user + `superAdmins/{uid}` + `{superAdmin:true}` claim). Run with emulators up: `node functions/seed-emulator.mjs`.
- App connects to emulators only when `import.meta.env.DEV` AND `.env.local` has `VITE_USE_EMULATORS=true`
  (`src/firebase/index.ts:42`). Do NOT read/edit `.env.local` — owner owns it.
- Emulators (firebase.json): auth 9099, firestore 8080, functions 5001, storage 9199, UI 4000. `functions/lib` is built.
- Run sequence: `firebase emulators:start` → `node functions/seed-emulator.mjs` (+ the new data seed once it's committed) → `npm run dev` → sign in as sheibeck@gmail.com → sign out/in to load the claim.

## Standing prefs / gotchas (also in ~/.claude memory)
- If a sonnet subagent times out → re-spawn on `claude-opus-4-8` (owner instruction 2026-08-24).
- A new Cloud Function MUST be re-exported from `functions/src/index.ts` or `firebase deploy` can't find it;
  handler-direct tests miss it; no predeploy build hook → rebuild functions before deploying.
- STATE.md is heavily customized: `gsd-tools query state.advance-plan`/`update-progress` error on it (non-fatal);
  other state verbs work.
- Phase-verify pattern this milestone: verifier returns human_needed with all must-haves verified → set
  VERIFICATION status:passed + human_uat_deferred:true, record deferred items in PENDING-VERIFICATION, then
  `query phase.complete N`. (v1.6–v2.1 "auto-verified, human UAT deferred" pattern.)
</content>
