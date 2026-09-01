# 0113. Monotonic Go-live token + unmount flag guarding a LATE

## Status

Accepted

## Context

This rationale is applied at 9 call site(s) within `src/composables/useRunControl.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: monotonic Go-live token + unmount flag guarding a LATE getScreenDetails() resolution from re-opening orphaned output windows after the operator has moved on (a fresh Go-live click, a confirmed exit, or an unmount)...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/composables/useRunControl.ts:5-19`:**

```
 * entire Phase 92-96 control machinery lives in one seam — mirroring how
 * useOutputWindow.ts owns the output-window lifecycle. This composable owns: the
 * single-writer wp-run-{serviceId} channel (index/seq/handle + postIndex +
 * resendCurrent + the onHello resend + the on-mount slide-0 post + the
 * late-arriving-assembly post), the navigation model, the rail derivations, the
 * honest open state machine (OutputStatus + openOutputs/openPlaced/openUnplaced +
 * bothOpened), the WR-01 stale guard (goLiveRequestId/isUnmounted), the Phase
 * 96-01 live-ops recovery (closed-poll + screenschange reassign + per-role
 * reopen), the exit/teardown ordering (stopRecoveryWatchers before closeOutputs),
 * and the document keyboard handler.
 *
 * It MUST be called from inside a component setup() — it registers
 * onMounted/onUnmounted on the calling instance so the channel open + keyboard
 * listener and their teardown run on that view's lifecycle exactly as the
 * un-extracted view did. useServiceAssembly() is called FIRST so its onMounted
```

**`src/composables/useRunControl.ts:419-432`:**

```

  /**
   * PER-ROLE REOPEN (R274) — re-runs the open+place for THAT role ONLY. It is
   * SYNCHRONOUS: it resolves the role's screen from the already-HELD
   * liveScreenDetails.screens via the existing resolveScreen (NO fresh
   * getScreenDetails), so it opens no stale-resolution window and needs no new
   * token — the original openOutputs().then WR-01 guard stays intact.
   * openWindow re-stores outputWindows[name] and best-effort moveTo +
   * requestFullscreen({ screen }). The closed ref is cleared ONLY on a non-null
   * handle: a pop-up-blocker-refused reopen keeps the amber row and never flips the
   * line back to green (honesty rule). Position is NOT persisted — the reopened
   * output's hello → onHello(resendCurrent) resends the CURRENT index, so it
   * returns to the exact current slide; index.value is never touched here.
   */
```

**`src/composables/useRunControl.ts:439-446`:**

```
    // WR-01 (defense-in-depth): NEVER open an output window outside a real live
    // session that has already gone live. A reopen is only ever legitimate as a
    // recovery of a genuinely-closed output — which requires (a) live===true and
    // (b) a HELD go-live ScreenDetails (liveScreenDetails). Pre-flight (live=false)
    // and Rehearse (live=true but no getScreenDetails was ever resolved, so
    // liveScreenDetails===null) both NO-OP here, so a stray dot/panel emit can
    // never open an un-positioned window that bypasses the honest open state
    // machine (outputStatus would still read idle while a real window was live).
```

**`src/composables/useRunControl.ts:457-467`:**

```

  /**
   * IN-PLACE reassign recovery (R274 / WR-01) — the reassign banner's PRIMARY
   * action. Reopens the affected output role(s) against the CURRENT (post-change)
   * live screens WITHOUT unmounting the control, reusing the reopenOutput →
   * resolveScreen → openWindow path. Position is NOT persisted here: each reopened
   * output announces itself with a hello → onHello(resendCurrent) resends the
   * CURRENT index, so it returns to the exact live slide. If a monitor is truly
   * gone resolveScreen yields null and the output opens un-positioned (honest
   * fallback) — either way the running session (index/seq/channel + the other open
   * output) survives, unlike the old same-tab /monitor-setup navigation that tore
```

**`src/composables/useRunControl.ts:554-560`:**

```

  // WR-01: monotonic Go-live token + unmount flag guarding a LATE
  // getScreenDetails() resolution from re-opening orphaned output windows after
  // the operator has moved on (a fresh Go-live click, a confirmed exit, or an
  // unmount). Mirrors MonitorSetupView's detectRequestId precedent: every new
  // attempt bumps the token, and confirmExit/onUnmounted invalidate any in-flight
  // resolve so its .then/.catch is a no-op — no window is ever opened after exit.
```

**`src/composables/useRunControl.ts:783-785`:**

```
    // WR-01: claim a fresh token for THIS gesture. A second Go-live click, a
    // confirmed exit, or an unmount bumps goLiveRequestId, so an earlier in-flight
    // getScreenDetails() resolve becomes stale and is dropped below.
```

**`src/composables/useRunControl.ts:812-817`:**

```
        // MONITOR-UNPLUG (R274): HOLD this Go-live ScreenDetails and attach the
        // screenschange listener — AFTER the WR-01 stale guard so a late resolve
        // after exit attaches nothing. Swap off any prior handle first (mirrors
        // MonitorSetupView). The typeof guard is load-bearing: a ScreenDetails
        // without listener support (older engines / a partial test fake) is
        // skipped rather than throwing into the .catch.
```

**`src/composables/useRunControl.ts:908-909`:**

```
    // WR-01: invalidate any in-flight Go-live resolve so a late getScreenDetails()
    // cannot re-open orphaned output windows after the operator has exited.
```

**`src/composables/useRunControl.ts:1278-1279`:**

```
    // WR-01: mark torn down so a late getScreenDetails() resolve short-circuits
    // instead of opening windows into a dead component.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:5-19`
- `src/composables/useRunControl.ts:419-432`
- `src/composables/useRunControl.ts:439-446`
- `src/composables/useRunControl.ts:457-467`
- `src/composables/useRunControl.ts:554-560`
- `src/composables/useRunControl.ts:783-785`
- `src/composables/useRunControl.ts:812-817`
- `src/composables/useRunControl.ts:908-909`
- `src/composables/useRunControl.ts:1278-1279`
