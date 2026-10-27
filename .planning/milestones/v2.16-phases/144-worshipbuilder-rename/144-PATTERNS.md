# Phase 144: WorshipBuilder Rename - Pattern Map

**Mapped:** 2026-10-27
**Files analyzed:** 4 new/test-pattern groups (plus in-place literal edits U1-U14, E1-E12 per UI-SPEC)
**Analogs found:** 4 / 4

Copy-only rename: source edits need no analog (edit the token inside each literal per UI-SPEC). Patterns below cover tests only.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/brandName.test.ts` (new) | test (static source scan) | file-I/O | `src/__tests__/firebaseHostingHeaders.test.ts` | role-match |
| `src/views/__tests__/*.test.ts`, `src/components/__tests__/*.test.ts` (add one `it` each) | test (mounted text) | request-response | `src/views/__tests__/LoginView.test.ts` | exact |
| `functions/src/adminEmail.test.ts` (edit L78, L97) | test | request-response | itself | exact |
| `functions/src/inviteOnboarding.test.ts`, `functions/src/volunteerLink.test.ts` (add assertions) | test | request-response | `adminEmail.test.ts` L59-80 | exact |

## Pattern Assignments

### `src/brandName.test.ts` (test, file-I/O)

**Analog:** `src/__tests__/firebaseHostingHeaders.test.ts`

**Imports / file read** (lines 1-3, 16-20):
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const configPath = resolve(process.cwd(), 'firebase.json')   // cwd = repo root under root runner
const raw = readFileSync(configPath, 'utf-8')
```
Add `readdirSync` and `join` for the walk. Assertion style with messages (line 65): `expect(cc, \`expected ... ${shellPath}\`).toBeDefined()`; use `expect(offenders).toEqual([])` for the negative scan.

**Core skeleton:** use RESEARCH.md "Guard skeleton" (comment-strip regexes, `readdirSync(..., { recursive: true, encoding: 'utf8' })`, exclude `*.test.ts` and `__tests__`, plus `index.html` and the three `functions/src` email modules). Add `/Worship[ -]Builder/` zero-match check and a positive `[file, literal]` table for U1-U14 and E1-E12 using `toContain`.

Note: the analog file contains NUL bytes (likely UTF-16), so do not copy it byte-wise. Write the new file as plain UTF-8. Do not run with `--dir src`.

---

### Mounted view/component tests (add one `it` each)

**Analog:** `src/views/__tests__/LoginView.test.ts`

**Harness** (lines 9-33): `mount` + `enableAutoUnmount(afterEach)`, with `vue-router` and `@/stores/auth` mocked via `vi.mock`:
```typescript
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
enableAutoUnmount(afterEach)
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mockPush }) }))
```
**Assertion pattern** (line 44, 63):
```typescript
const wrapper = mount(LoginView)
expect(wrapper.text()).toContain('WorshipBuilder')
```
Reuse each target file's existing mount helper and mocks (AppSidebar, AppShell, ServicePrintLayout, SelectChurchView, VolunteerRequestView, VolunteerLinkCompleteView, ShareView, QuarterShareView). Footers: `toContain('Shared from WorshipBuilder')` / `'Generated from WorshipBuilder'`. No tests exist for App.vue, VolunteerSignInView, RosterPrintLayout, index.html, so the guard's positive table covers them.

---

### `functions/src/adminEmail.test.ts` (edits)

**Existing assertions** (lines 59-64, 77-80, 97):
```typescript
const arg = mockSend.mock.calls[0]![0] as { from: string; to: string; subject: string; text: string };
expect(arg.subject).toBe("You've been added as an admin to Grace Church");
expect(arg.text).toContain("added as an admin to Grace Church");
...
expect(arg.subject).toBe("You've been invited to Grace Church on Worship Planner");   // L78 -> "...on WorshipBuilder"
...
expect(arg.text).toContain("Sign in to Worship Planner");                               // L97 -> "Sign in to WorshipBuilder"
```
Subject is an exact `toBe`, so it must match E4 verbatim.

### `functions/src/inviteOnboarding.test.ts` (add)

**Analog excerpt** (lines 270-283, google-notify test): the cast currently omits `subject`:
```typescript
const arg = mockSend.mock.calls[0]![0] as { to: string; text: string };
expect(arg.to).toBe("bob@gmail.com");
expect(arg.text.toLowerCase()).toContain("google");
```
Extend the cast to `{ to: string; subject: string; text: string }` and add `expect(arg.subject).toBe("You've been invited to <seedOrg name> on WorshipBuilder")` plus `expect(arg.text).toContain("on WorshipBuilder")`. Read the `seedOrg` fixture for the org name. Do the same in the set-password test (~L334).

### `functions/src/volunteerLink.test.ts` (add)

**Analog excerpt** (lines 95-99):
```typescript
const sendArgs = mockSend.mock.calls[0][0];
expect(sendArgs.to).toBe("vol@example.com");
expect(sendArgs.subject).not.toMatch(/invited/i);
```
Add `expect(sendArgs.text).toContain("on WorshipBuilder")` (E12). Leave the subject assertions unchanged.

### `functions/src/index.test.ts` (L5751, 5757, 5767)

Change only the display-name token: `"WorshipBuilder <noreply@worshipplanner.app>"` and `not.toContain("<WorshipBuilder")`. Keep the address domain. The expected `from` stays byte-identical.

## Shared Patterns

- **Verification runs:** `npx vitest run src/brandName.test.ts`, then `cd functions && npx vitest run src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts`, then `npm run type-check`.
- **No edits** to `functions/lib/*`, `package.json`, `claudeApi.ts` prose, code comments, or storage keys.

## No Analog Found

None. `readdirSync` recursion has no in-repo precedent; the RESEARCH.md skeleton applies (assumption A1: Node 22).

## Metadata

**Analog search scope:** `src/__tests__`, `src/views/__tests__`, `functions/src/*.test.ts`
**Pattern extraction date:** 2026-10-27
