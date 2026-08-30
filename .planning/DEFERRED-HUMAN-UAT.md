# v2.4 — Deferred Human-UAT Items

Per the autonomous run directive ("run autonomously and defer human verification to the end"), each
phase's verifier marks hardware/browser-permission items as `human_needed` rather than failing. They
are collected here and presented to the owner at milestone end. Everything below is a **structural
limit of unit testing** (real permission prompts, physical multi-monitor hardware, real fullscreen /
wake-lock behavior over a service length), NOT a known defect.

## ✅ Owner confirmation — 2026-08-29

The owner ran hardware UAT and **confirmed every item below as working EXCEPT the multi-monitor
auto-fullscreen item (Phase 97 #1 / R278)**. All phases 92–96 items and Phase 97 items #2–#6 are
**owner-accepted**. The one remaining open item is auto-fullscreen, tracked separately below and being
re-approached via the **Presentation API** (see `docs/run-fullscreen-setup.md` and the fullscreen
decision note). Do not re-litigate the confirmed items; the milestone stays OPEN only on the
fullscreen item.

## Phase 92 — Monitor Configuration Screen (verified 2026-08-28, pass-with-deferred-human-UAT)

1. Real Window-Management permission **grant** + multi-monitor detection on Chrome/Edge — the prompt
   appears and real monitor cards render for the connected displays.
2. Real permission **deny** / API-absent browser (Firefox/Safari) — the first-class fallback panel is
   shown (never a dead end).
3. **Drag + fullscreen** manual fallback path on real hardware actually produces fullscreen output on
   the target monitor.
4. Backstop (visual): a **3+ monitor** setup wraps the card grid at `md:grid-cols-2` without layout
   breakage. (Label truncation itself IS unit-verified via `MonitorCard.test.ts`; only the 3+ grid-wrap
   remains human.)

## Phase 93 — Audience Output Window (verified 2026-08-28, pass-with-deferred-human-UAT)

1. **Second-monitor projection** — real full-bleed, chrome-free, cursor-free audience output *with its
   background image* on a physical second display (Chrome/Edge).
2. **Wake-lock endurance** — the audience display never sleeps/dims over a realistic service length
   (60–90 min of real elapsed time).
3. **Fullscreen-loss recovery from the booth** — the single "Re-enter fullscreen" pill is findable, and
   clicking it actually re-enters fullscreen without tearing down the session or the other output.

## Phase 94 — Confidence Monitor Output Window (verified 2026-08-28, pass-with-deferred-human-UAT)

1. **Confidence monitor on a second physical screen** — current + next panes render and are clearly
   distinguished on real hardware.
2. **True black-background suppression as the band sees it** — the actual background image is never
   visible on either pane on a real display.
3. **Glanceable legibility of the ~30% next pane** from stage distance (if unreadable, tune the split
   ratio / next-pane font scale — not the current pane's dominance).

## Phase 95 — Run/Control Screen + Run Entry Point (verified 2026-08-28, pass-with-deferred-human-UAT)

1. Real **two-monitor open+place+fullscreen from one "Go live" click** on Chrome/Edge — the audience +
   confidence windows land on their assigned monitors.
2. **End-to-end keyboard driving** of a live service across both output windows (Right/Space/Left/Up/Down).
3. The **Escape-confirm feel** + real projector-blanking on confirmed exit.
4. The **pop-out fallback** drag-to-monitor + per-window fullscreen (when the mapping doesn't match).
5. The **blocked and partial popup states** on real hardware (popup-blocked / only-one-window-opened).

## Phase 96 — Live-Ops Hardening (verified 2026-08-28, pass-with-deferred-human-UAT)

1. **Closed-window one-click reopen** — actually close an output mid-service and reopen it onto the right
   physical monitor with the current slide intact.
2. **Monitor-unplug in-place reassign** — physically unplug a monitor and recover via "Reopen & replace,"
   keeping the control running and the place intact.
3. **Full realistic-length service** — no perceptible sync lag between control and outputs, and no
   teardown/resource accumulation over ~60–90 min.

## Phase 97 — Run Service Redesign (verified 2026-08-29, pass-with-deferred-human-UAT)

The owner-requested redesign (Claude Design import) + the 6 UAT fixes + blackout/timers/filmstrip/rehearse.
All R276–R284 code-verified; these need real hardware:

1. **Auto-fullscreen (R278)** — Go live → both output windows land fullscreen on their assigned monitors
   with NO manual "Re-enter fullscreen" click (the key fix; only the output-side self-fullscreen is new).
2. **Confidence left/right legibility (R279)** — current + next side-by-side readable from the stage.
3. **Blackout on the real projector (R280)** — `B` / Black / Clear actually black + restore the outputs.
4. **Timers + filmstrip end-to-end (R281/R282)** — clock/elapsed run; in-item filmstrip click-to-jump.
5. **Closed/unplug recovery on hardware** — reopen + in-place reassign keep the place (retest post-redesign).
6. **Overall run/stop feel** — pre-flight → Go live → drive → blackout → End service across a full cycle.

## Phase 98 — Fullscreen Setup Helper — ⚠ REMOVED 2026-08-30 (do NOT run these UAT items)

> The Fullscreen Setup Helper was removed 2026-08-30: hardware UAT disproved its premise (the Automatic
> Fullscreen policy does not enable no-gesture multi-monitor fullscreen on Chrome 151/Edge even when
> `chrome://policy` shows OK; the permission query false-positives). Superseded by per-display
> "Go fullscreen" buttons (gesture-delegated) on the Run control's Displays panel. The items below are
> **void** — the feature and its `.reg` files no longer exist.

### (void) original deferred items

The in-app helper that turns on the Chromium Automatic Fullscreen policy. R285–R287 code-verified (4/4
must-haves in source, gates clean, no regression). These need real hardware / real OS policy writes that
jsdom cannot simulate:

1. **Windows HKCU (no-admin) end-to-end** — double-clicking the generated per-user `.reg` on a real,
   non-domain-joined Windows PC actually registers the policy (`chrome://policy`) WITHOUT admin, and the
   readiness panel flips to "ready ✓". (This is the crux "can we avoid admin?" question — research left it
   split; only hardware settles it. Localhost proof files are in `docs/fullscreen-setup/`.)
2. **Full R278 promise on real multi-monitor hardware** — once the policy is granted, Go live puts BOTH
   output windows fullscreen on their assigned monitors with zero per-window clicks.
3. **Windows HKLM admin fallback** — when HKCU doesn't register, the "admin version" link's `.reg` works
   with one UAC approval.
4. **macOS `.mobileconfig` install** — the generated profile installs and grants the setting. NOTE: the
   code itself flags this format as RESEARCH Assumption A1 (LOW confidence, not first-party-confirmed);
   the UI copy is deliberately hedged. Verify the exact profile shape on a real Mac.
5. **Linux managed-policy JSON install** — the generated JSON at `/etc/opt/chrome/policies/managed/`
   (Chrome) grants the setting; confirm the real path for the operator's distro/Edge/Chromium.
