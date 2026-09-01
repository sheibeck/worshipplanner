# Deferred Items — Phase 104

## src/stores/appConfig.test.ts is a stale duplicate, failing independently of this phase

Discovered during Task 3's full-suite verification run (`npx vitest run`) for plan 104-01.

`src/stores/appConfig.test.ts` fails one assertion (`saveField` should call `setDoc` with a
dot-path payload like `{ 'retention.mediaDays': 45 }`; it receives a nested object instead). This
file is a **stale duplicate** of `src/stores/__tests__/appConfig.test.ts` (the canonical,
currently-passing suite, which already covers this exact bug fix per commit `b365a1b9`). The stale
file was last touched in `f44c8b3f` (Phase 70) and is untouched by Phase 104 — confirmed via
`git diff HEAD~3 -- src/stores/appConfig.test.ts` returning no diff across every Phase 104
commit.

This means CLAUDE.md's documented baseline ("a bare `npx vitest run` should show exactly one
failing file", `src/storage.rules.test.ts`) is currently stale — the real baseline as of
2026-09-01 is **two** failing files. Both failures are pre-existing and out of scope for this
phase's notification-system work (SCOPE BOUNDARY — only fix issues directly caused by the
current task's changes).

**Suggested follow-up (not fixed here):** delete `src/stores/appConfig.test.ts` (the stale
duplicate) and update CLAUDE.md's baseline note once confirmed the canonical
`src/stores/__tests__/appConfig.test.ts` covers everything it did.
