---
quick: 260903-dismissible-monitor-warnings
date: 2026-09-03
commit: 97a5289f
status: complete
files:
  - src/components/run/RunDisplaysPanel.vue
  - src/views/RunControlView.vue
  - src/views/__tests__/RunControlView.output.test.ts
---

# Quick Task: Dismissible monitor warnings + relocate fallback help into the Displays panel

**Owner report:** The "Finish setting up your displays" message can get stuck on the Run/services
screen (when you run a service without monitors set up) with no way to dismiss it. All warnings like
this should be dismissible, and monitor messages should not sit in the top band — they belong in the
**Displays panel**, dismissible there.

## What was found

Three amber warning banners lived in a top band on `RunControlView.vue`, none dismissible:

- **fallback** (`run-fallback-banner`) — "Finish setting up your displays" (the reported stuck message).
  Fires when `outputStatus === 'fallback'` — windows opened un-positioned, so `finishOpen` sets
  `live = true` → **State B**, where `RunDisplaysPanel` IS rendered.
- **blocked** (`run-blocked-banner`) and **partial** (`run-partial-banner`) — pop-up-blocker recovery
  prompts with a "Go live" retry. These fire on the early-return path in `finishOpen` (audience window
  refused) where `live` stays **false** → **State A** (preflight), where `RunDisplaysPanel` is NOT
  rendered.

Precedent: the "monitor setup changed" reassign message was already migrated off the top band onto the
app-wide dismissible notification store (`useToasts`, key `monitor-reassign`) in Phase 104 (R310).

## What was done (scope confirmed with owner: relocate + dismiss all three)

- **`RunDisplaysPanel.vue`** — new `fallback: boolean` prop drives a dismissible in-panel notice
  (`run-fallback-banner`, keeping the testid + the `/monitor-setup` link) with a dismiss X
  (`run-fallback-dismiss`). A local `setupHelpDismissed` ref hides it; a `watch` on the `fallback` prop
  resets the dismissal when leaving fallback so it returns if outputs open un-positioned again.
- **`RunControlView.vue`** — removed the top-band fallback banner; wired `:fallback="outputStatus === 'fallback'"`
  into `RunDisplaysPanel`. `blocked`/`partial` stay in State A (no Displays panel there) but gain a
  dismiss X (`run-blocked-dismiss` / `run-partial-dismiss`) gated by a new `dismissedStatus` ref that
  resets on any `outputStatus` change (a fresh occurrence always reappears; retry via the preflight
  Go-live button is unaffected).
- **Tests** (`RunControlView.output.test.ts`, +4) — fallback renders **inside** the Displays panel +
  dismissible while staying live; blocked dismissible; partial dismissible.

## Why blocked/partial were not moved into the Displays panel

They fire in State A (`live === false`), where `RunDisplaysPanel` is not mounted, so there is no panel
to move them into. They are dismissible in place and already auto-clear on a successful retry. (Owner
chose "relocate + dismiss all 3"; the relocation applies to the fallback help, which is the message that
actually gets stuck.)

## Verification

- `npx vitest run src/views/__tests__/RunControlView.output.test.ts src/views/__tests__/RunControlView.test.ts src/views/__tests__/RunControlView.loop.test.ts` — **81/81 pass** (46 output, incl. the 4 new).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run` (full) — documented baseline: 4750 passed, 27 skipped, sole failing file
  `src/storage.rules.test.ts` (Storage-emulator limitation).

Client-only (Vue + the existing run-flow state machine) — no Firestore/Storage rules or Cloud Functions
touched. **UNDEPLOYED** — ships with the next `firebase deploy --only hosting` (e.g. the v2.9 milestone deploy).
