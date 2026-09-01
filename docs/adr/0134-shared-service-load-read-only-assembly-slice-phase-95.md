# 0134. Shared service-load + read-only assembly slice (Phase 95

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/composables/useServiceAssembly.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Shared service-load + read-only assembly slice (Phase 95, R262/R263/R264 foundation — "reuse, don't fork").

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/composables/useServiceAssembly.ts:2-25`:**

```
 * Shared service-load + read-only assembly slice (Phase 95, R262/R263/R264
 * foundation — "reuse, don't fork").
 *
 * This composable owns ONLY the small load core the standalone output windows
 * and the in-app Run/control screen must resolve IDENTICALLY: the
 * `?org=`/`:serviceId` scoping, the `localService` initial-load watch, the
 * read-only `useSlideshowAssembly` (canWrite omitted), and the WR-02
 * org-mismatch subscribe gate (registered in its OWN `onMounted`).
 *
 * It deliberately holds NONE of the output-only lifecycle — no run channel, no
 * wake lock, no font gate, no cursor/fullscreen machinery — and, crucially, it
 * registers NO `onUnmounted` and NEVER calls `serviceStore.unsubscribeAll()`.
 * It is consumed by BOTH useOutputWindow (the standalone output windows, which
 * keep their own `unsubscribeAll()` teardown) AND RunControlView (a normal
 * in-app SPA route that shares the store with peers and must NOT tear the
 * subscription down on its unmount). Placing a store teardown here would kill
 * those peers' subscriptions.
 *
 * It MUST be called from inside a component `setup()` — it registers one
 * `onMounted` (the WR-02 subscribe gate) on the calling instance. Call it
 * FIRST in the consumer's setup so its `onMounted` runs before any later
 * `onMounted` (e.g. useOutputWindow opening its channel) — subscribe-before-
 * channel ordering is preserved by call order.
 */
```

**`src/composables/useServiceAssembly.ts:62-63`:**

```

  // ── Lifecycle: WR-02 subscribe gate ONLY (no unsubscribeAll) ────────────────
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useServiceAssembly.ts:2-25`
- `src/composables/useServiceAssembly.ts:62-63`
