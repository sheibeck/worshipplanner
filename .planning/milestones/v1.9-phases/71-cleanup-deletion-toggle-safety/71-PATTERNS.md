# Phase 71: Cleanup Deletion-Toggle Safety - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/src/index.ts` (4 handlers: `cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`) | service (Cloud Function handler) | batch/CRUD (scan+delete) | the handlers themselves (self-modification, one-line signature+dryRun-line change each) | exact |
| `functions/src/index.ts` — NEW `previewCleanupDryRun` onCall | controller (callable dispatcher) | request-response | `functions/src/superAdminClaims.ts::setSuperAdminClaimHandler` | exact (auth re-check) / role-match (dispatch-over-handlers is novel but composed from proven pieces) |
| `functions/src/index.test.ts` — new `previewCleanupDryRun` describe block | test | request-response | existing `cleanupOrphanBackgroundsHandler` describe block (`index.test.ts:1315+`) + existing onCall auth-rejection tests for `setSuperAdminClaimHandler` | exact |
| `src/components/admin/CleanupEnableConfirmDialog.vue` | component (modal) | request-response (props in, emit out) | `src/components/NewServiceDialog.vue` | exact (structural) |
| `src/components/admin/CleanupConfigCard.vue` | component (form/card) | CRUD (read config, write flag via callable+store) | itself (Phase 70 version) + `src/views/OwnerConsoleView.vue`'s `callSetSuperAdminClaim`/`friendlyCallableError` httpsCallable pattern | exact |
| `src/components/admin/__tests__/CleanupConfigCard.test.ts` (+ new `CleanupEnableConfirmDialog.test.ts`) | test | request-response | Phase 70 `CleanupConfigCard.test.ts` (existing) + component test conventions in `src/components/admin/__tests__/` | exact |

## Pattern Assignments

### `functions/src/index.ts` — the four cleanup handlers (MODIFY, one line each)

**Analog:** the handlers' own current code (this is a self-consistent one-line-per-handler edit, not a foreign pattern import).

**Current dry-run line, per handler** (`functions/src/index.ts`):
```typescript
// cleanupExpiredMediaHandler — line 1059
const dryRun = !config.cleanup.mediaEnabled;

// cleanupOrphanRendersHandler — line 1224
const dryRun = !config.cleanup.pptxRenderEnabled;

// cleanupOrphanBackgroundsHandler — line 1467 (feeds effectiveDryRun at 1531)
const dryRun = !config.cleanup.backgroundEnabled;
// ...
const effectiveDryRun = dryRun || !referencesComplete;   // line 1531 — UNCHANGED

// cleanupPptxSourcesHandler — line 1696
const dryRun = !config.cleanup.pptxSourceEnabled;
```

**The exact minimal change (apply identically to all four, add optional param + OR the forceDryRun in FIRST):**
```typescript
export async function cleanupExpiredMediaHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<CleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.mediaEnabled;
  // ...rest of function UNCHANGED
}
```
For `cleanupOrphanBackgroundsHandler`, only the `const dryRun = ...` line (1467) changes to the ternary form; `effectiveDryRun` (1531), `referencesComplete` computation (1470-1528), and the floor-guard block are BYTE-IDENTICAL to before. This is R190's hard constraint — verify with a diff review, not a re-read of the whole function.

**Per-type response-field mapping (critical — do not read `deletedObjectCount` uniformly):**

| Type | Handler | `wouldDeleteCount` source | `wouldDeleteBytes` source | `referencesComplete` source |
|---|---|---|---|---|
| `media` | `cleanupExpiredMediaHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |
| `orphanRenders` | `cleanupOrphanRendersHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |
| `backgrounds` | `cleanupOrphanBackgroundsHandler` | **`summary.orphanCount`** (NOT `deletedObjectCount` — that field only increments on the live-delete branch, always 0 in forced-dry-run) | `summary.deletedBytes` | `summary.referencesComplete` |
| `pptxSources` | `cleanupPptxSourcesHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |

Reasoning: `cleanupOrphanBackgroundsHandler` increments `orphanCount` unconditionally per candidate BEFORE the dry-run check (`index.ts:1556`), then only in the dry-run branch accumulates `deletedBytes` (1559-1565) — it never touches `deletedObjectCount` in that branch. The other three handlers increment `deletedObjectCount` directly inside their `if (dryRun)` branch, so it genuinely is their would-delete count.

---

### `functions/src/index.ts` — NEW `previewCleanupDryRun` onCall

**Analog:** `functions/src/superAdminClaims.ts::setSuperAdminClaimHandler` (lines 106-128) for the auth re-check.

**Auth re-check pattern to copy verbatim (two independent server-side checks, never trust client claim):**
```typescript
// Source: functions/src/superAdminClaims.ts:106-128 (this repo)
export async function setSuperAdminClaimHandler(
  request: CallableRequest<SetSuperAdminClaimRequest>,
): Promise<SetSuperAdminClaimResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  // Re-check #1: the caller's own ID-token claim.
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  // Re-check #2: an independent Firestore re-read of the source-of-truth document.
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  // ...
}
```

**Full recommended shape for `previewCleanupDryRun`** (composes the above + a type-dispatch over the four modified handlers):
```typescript
export type CleanupPreviewType = "media" | "orphanRenders" | "backgrounds" | "pptxSources";

export interface PreviewCleanupDryRunRequest { type: CleanupPreviewType; }
export interface PreviewCleanupDryRunResponse {
  wouldDeleteCount: number;
  wouldDeleteBytes: number;
  referencesComplete?: boolean; // present only for type === "backgrounds"
}

export async function previewCleanupDryRunHandler(
  request: CallableRequest<PreviewCleanupDryRunRequest>,
): Promise<PreviewCleanupDryRunResponse> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError("permission-denied", "You must be a super-admin.");

  const { type } = request.data ?? ({} as PreviewCleanupDryRunRequest);
  const VALID_TYPES: CleanupPreviewType[] = ["media", "orphanRenders", "backgrounds", "pptxSources"];
  if (typeof type !== "string" || !VALID_TYPES.includes(type as CleanupPreviewType)) {
    throw new HttpsError("invalid-argument", "type must be one of: " + VALID_TYPES.join(", "));
  }

  switch (type) {
    case "media": {
      const s = await cleanupExpiredMediaHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "orphanRenders": {
      const s = await cleanupOrphanRendersHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "backgrounds": {
      const s = await cleanupOrphanBackgroundsHandler({ forceDryRun: true });
      return {
        wouldDeleteCount: s.orphanCount,           // NOT deletedObjectCount
        wouldDeleteBytes: s.deletedBytes,
        referencesComplete: s.referencesComplete,
      };
    }
    case "pptxSources": {
      const s = await cleanupPptxSourcesHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
  }
}

export const previewCleanupDryRun = onCall(previewCleanupDryRunHandler);
```

Optional defense-in-depth (recommended by RESEARCH, one line): after invoking the handler, assert `s.dryRun` (or the backgrounds `dryRun: effectiveDryRun`) is `true` before returning — structurally guaranteed by the ternary in Pattern 1, but cheap and self-documenting.

---

### `functions/src/index.test.ts` — new `previewCleanupDryRun` describe block

**Analog:** existing `setSuperAdminClaimHandler` auth-rejection tests (mirror the 3-case shape: no auth / wrong claim / missing doc) + existing `cleanupOrphanBackgroundsHandler` describe block (`index.test.ts:1315+`) for the mock helpers (`mockBucket`, `fakeFile`, `mockBackgroundDb`, `fakeBackgroundFile`) to reuse directly, and for the requirement that this describe block itself needs ZERO edits (R190 gate).

**Test cases to add (per RESEARCH's Wave-0 gap list):**
- 3 auth-rejection cases (no `request.auth`; `token.superAdmin !== true`; `superAdmins/{uid}` doc missing) → each `permission-denied`/`unauthenticated`
- invalid `type` → `invalid-argument`
- 4 per-type dispatch/field-mapping correctness cases, one per type, asserting the exact mapped field (especially `backgrounds` → `orphanCount`, not `deletedObjectCount`)
- "never deletes even when live-enabled" case: mock `getAppConfig` to return `cleanup.mediaEnabled: true` (etc.) and assert `file.delete()`/equivalent is never called when going through `previewCleanupDryRunHandler`
- backgrounds `referencesComplete: false` pass-through case, reusing `mockBackgroundDb({ slideGroupsThrows: true })` from the existing describe block

**Hard constraint:** do not touch the existing `cleanupOrphanBackgroundsHandler` describe block (~line 1315+) — those tests must pass unmodified after the handler's signature gains `opts`.

---

### `src/components/admin/CleanupEnableConfirmDialog.vue` (NEW)

**Analog:** `src/components/NewServiceDialog.vue`

**Teleport/backdrop/panel structure to copy verbatim** (`src/components/NewServiceDialog.vue:1-48`):
```html
<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/60" @click="onCancel"></div>
    </Transition>

    <!-- Dialog -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="onCancel">
        <div class="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 class="text-base font-semibold text-gray-100">New Service</h2>
            <button type="button" class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" @click="onCancel" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Body -->
          <div class="px-6 py-5 space-y-5"> ... </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

**Deltas required by 71-UI-SPEC.md (not present in the analog — build new, don't search for a precedent):**
- Props: `open`, `typeLabel`, `wouldDeleteCount`, `wouldDeleteBytes`, `referencesComplete?`, `confirming`, `confirmError`; emits `confirm`/`cancel`.
- Title/body use `Enable {typeLabel}?` / echoed-count copy per UI-SPEC's Copywriting Contract table — NOT `NewServiceDialog.vue`'s form fields (this dialog has no form, just title+body+warning+Cancel/Confirm).
- Byte formatting: `(wouldDeleteBytes / 1024 / 1024).toFixed(1) + ' MB'` (matches `src/utils/pptxUpload.ts`'s existing `fileMb` shape — read that file if exact reuse of a helper is desired, otherwise inline the one-liner).
- Focus trap (NEW to this codebase, no existing analog): on `open` → true, focus Cancel (never Confirm); `keydown` listener traps Tab/Shift+Tab between Cancel and Confirm (or Cancel-only when Confirm is hard-blocked); `Escape` triggers `cancel` emit, same as the backdrop's `@click.self="onCancel"` convention above.
- `role="dialog" aria-modal="true" aria-labelledby aria-describedby` — new to this component, follow UI-SPEC's Accessibility section literally.
- Confirm button color: red (`bg-red-600 hover:bg-red-500 text-white`) when `wouldDeleteCount > 0`, indigo (`bg-indigo-600 hover:bg-indigo-500`) when `=== 0`; disabled (`opacity-60 cursor-not-allowed`, no click handler) when `referencesComplete === false`.
- Amber warning block only for `referencesComplete === false`: `text-yellow-500` text, `bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3` container (reused token from `OwnerConsoleView.vue`'s Resend-domain warning — same visual language, not a new class set).

---

### `src/components/admin/CleanupConfigCard.vue` (MODIFY — Phase 70 file)

**Analog for the httpsCallable + friendly-error pattern:** `src/views/OwnerConsoleView.vue:144,225-249` (`callSetSuperAdminClaim` + `friendlyCallableError`).

```typescript
// Source: src/views/OwnerConsoleView.vue:144, 231-249 (this repo)
import { httpsCallable } from 'firebase/functions'
// ...
function callSetSuperAdminClaim(targetEmail: string, grant: boolean) {
  const setSuperAdminClaim = httpsCallable<SetSuperAdminClaimRequest, SetSuperAdminClaimResponse>(
    functions,
    'setSuperAdminClaim',
  )
  return setSuperAdminClaim({ targetEmail, grant })
}

function friendlyCallableError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) {
    return 'You do not have permission to perform this action.'
  }
  if (code.includes('not-found')) {
    return 'No user was found with that email address.'
  }
  const message = (err as { message?: string })?.message
  return message || 'Something went wrong. Please try again.'
}
```

**Adapt directly for `previewCleanupDryRun` (RESEARCH's recommended shape, matches the analog's structure):**
```typescript
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

interface PreviewResult {
  wouldDeleteCount: number
  wouldDeleteBytes: number
  referencesComplete?: boolean
}

async function onEnableClick(type: 'media' | 'orphanRenders' | 'backgrounds' | 'pptxSources'): Promise<void> {
  const state = stateFor(type)
  state.status = 'previewing'
  state.previewError = null
  try {
    const preview = httpsCallable<{ type: string }, PreviewResult>(functions, 'previewCleanupDryRun')
    const result = await preview({ type })
    activeDialog.value = { type, ...result.data }
    state.status = 'idle' // dialog owns the interaction from here
  } catch (err) {
    console.error(`[CleanupConfigCard] preview ${type} error:`, err)
    state.previewError = "Couldn't check what would be deleted. Please try again."
    state.status = 'idle'
  }
}

async function onDialogConfirm(): Promise<void> {
  if (!activeDialog.value) return
  const { type } = activeDialog.value
  confirming.value = true
  confirmError.value = null
  try {
    await store.saveField(`cleanup.${configFieldFor(type)}`, true)
    activeDialog.value = null
    // ...2s "Enabled!" flash per UI-SPEC
  } catch (err) {
    confirmError.value = 'Failed to enable. Please try again.'
  } finally {
    confirming.value = false
  }
}
```

**Disable path** — direct `saveField('cleanup.{x}Enabled', false)`, no preview call, no dialog — mirrors the existing Phase 70 field-write pattern already in this file (read the current `CleanupConfigCard.vue` for the exact `store.saveField` call shape/`fieldStates` map convention before writing, since this phase's per-row status-line states must match its existing style, e.g. `Saved!`/`text-green-400 text-xs mt-1`).

**Row markup contract** (exact classes/structure, per `71-UI-SPEC.md` lines 86-120) — checkbox stays `disabled`, no `@change` handler; Enable/Disable are separate `<button>` elements that are the only write triggers.

---

### `src/components/admin/__tests__/CleanupConfigCard.test.ts` (MODIFY/extend) + new `CleanupEnableConfirmDialog.test.ts`

**Analog:** the existing Phase 70 `CleanupConfigCard.test.ts` (read it directly before writing — for the exact Vue Test Utils mount/mock shape already used for `store.saveField` and `httpsCallable`, if any is already mocked there for other admin cards) and `functions/src/superAdminClaims.ts`'s auth-rejection test list style for the callable-mock pattern.

**Coverage required (from RESEARCH's Test Map):**
- Enable → preview → dialog-shows-echoed-count → confirm → `saveField('cleanup.{x}Enabled', true)`; Cancel writes nothing
- Disable → immediate `saveField(..., false)`, no preview call
- Zero-count preview still opens dialog, allows confirm, indigo (not red) Confirm button
- Background hard-block: `referencesComplete: false` → Confirm button disabled, no click handler fires (dialog-level test, in `CleanupEnableConfirmDialog.test.ts`)
- Focus-on-open lands on Cancel; Escape triggers cancel emit

## Shared Patterns

### Super-admin two-check re-verification
**Source:** `functions/src/superAdminClaims.ts:106-128` (`setSuperAdminClaimHandler`)
**Apply to:** `previewCleanupDryRun` — copy the exact 3-guard block (auth presence, token claim, Firestore doc re-read) verbatim, adjusted only for the request type.

### `forceDryRun`-first ternary (never derive dryRun from live config in the preview)
**Source:** the four handlers themselves (this phase's own edit)
**Apply to:** all four modified handlers — the ternary MUST check `opts.forceDryRun === true` FIRST (`opts.forceDryRun === true ? true : !config.cleanup.xxxEnabled`), never an `||` form where a falsy config read could slip through before the force is evaluated. This is the single most load-bearing safety property in the phase.

### httpsCallable + friendly error mapping
**Source:** `src/views/OwnerConsoleView.vue:144, 225-249`
**Apply to:** `CleanupConfigCard.vue`'s `onEnableClick`/error-state handling.

### Teleport/backdrop/Transition modal shell
**Source:** `src/components/NewServiceDialog.vue:1-48`
**Apply to:** `CleanupEnableConfirmDialog.vue` (first reuse of this heavier structural pattern for a confirm dialog rather than the lighter inline-row-confirm used elsewhere, per 71-UI-SPEC.md Resolved Design Decision 1).

### Byte formatting
**Source:** `src/utils/pptxUpload.ts`'s `fileMb` shape (verify exact helper name/signature by reading the file before use)
**Apply to:** `CleanupEnableConfirmDialog.vue`'s body copy — `(wouldDeleteBytes / 1024 / 1024).toFixed(1) + ' MB'`.

## No Analog Found

None — every file in this phase has a direct or close in-repo precedent (see table above). The only genuinely new code, per RESEARCH, is: the `forceDryRun` param itself, the `previewCleanupDryRun` dispatch/field-mapping switch, the confirm dialog's hand-rolled focus-trap keydown handler (first in this codebase), and the Enable/Disable per-row state machine.

## Metadata

**Analog search scope:** `functions/src/index.ts`, `functions/src/index.test.ts`, `functions/src/superAdminClaims.ts`, `src/components/NewServiceDialog.vue`, `src/views/OwnerConsoleView.vue`, `src/components/admin/CleanupConfigCard.vue` (Phase 70), `src/components/admin/__tests__/`
**Files scanned:** 7 read/grepped directly, plus CONTEXT.md/RESEARCH.md/UI-SPEC.md
**Pattern extraction date:** 2026-08-20
