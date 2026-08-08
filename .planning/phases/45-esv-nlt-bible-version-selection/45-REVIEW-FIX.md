---
phase: 45-esv-nlt-bible-version-selection
fixed_at: 2026-08-08T06:03:44Z
review_path: .planning/phases/45-esv-nlt-bible-version-selection/45-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 1
status: all_fixed
---

# Phase 45: Code Review Fix Report

**Fixed at:** 2026-08-08T06:03:44Z
**Source review:** .planning/phases/45-esv-nlt-bible-version-selection/45-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (2 Warnings + 2 Info; IN-03 explicitly excluded per task instructions)
- Fixed: 4
- Skipped: 1 (IN-03, out of scope by instruction — pre-existing gap, not phase-introduced)

## Fixed Issues

### WR-01: The empty-body guard only checks the raw HTML, not the post-strip result

**Files modified:** `src/utils/nltApi.ts`, `src/utils/__tests__/nltApi.test.ts`
**Commit:** `0ce1fac`
**Applied fix:** After `stripNltHtml(html)` runs, `fetchNltPassageText` now checks
`!stripped.trim()` and throws the same `Error('Failed to fetch passage')` used by
the raw-body guard, so a `#bibletext` root with zero `verse_export` children (or
any other post-strip collapse to empty) is treated as a fetch failure instead of
silently resolving to `''`. Added a fixture test with `#bibletext` present but no
`verse_export` children, asserting the throw.

### WR-02: The secret-bearing outbound URL has no redaction boundary before it reaches fetch()/error logging

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `e85acbd`
**Applied fix:** Added an exported `redactUrl(url)` helper that masks the `key`
query-param value to `REDACTED` (failing closed to `[unparseable URL]` on a
malformed input). The `api` handler's proxy-error catch block now logs
`{ service, url: redactUrl(upstreamUrl), message }` instead of the raw `err`
object, so the live `NLT_API_KEY` can never reach Cloud Logging via this path.
Added 3 tests: masks the key while leaving other params untouched, leaves a
key-less URL byte-unchanged, and fails closed on an unparseable URL.

### IN-01: stripNltHtml's "no #bibletext root" error breaks the file's own documented failure-contract parity

**Files modified:** `src/utils/nltApi.ts`, `src/utils/__tests__/nltApi.test.ts`
**Commit:** `dd0f1fb`
**Applied fix:** Wrapped the `stripNltHtml(html)` call in `fetchNltPassageText` in
a try/catch that rewraps any thrown error (including `stripNltHtml`'s own
`Error('Unexpected NLT response shape')`) into the uniform
`Error('Failed to fetch passage')` contract the file's header doc comment
promises. `stripNltHtml`'s own direct-call test (asserting the original message)
is untouched — only the wrapping call site in `fetchNltPassageText` changed.
Added a test asserting `fetchNltPassageText` throws the uniform message on a
malformed (`no #bibletext`) response.

### IN-02: NLT_API_KEY.value() is read unconditionally for every proxied request

**Files modified:** `functions/src/index.ts`
**Commit:** `e414f36`
**Applied fix:** Changed the `buildUpstreamUrl` call site to pass
`service === "nlt" ? NLT_API_KEY.value() : ""`, so the NLT secret is only read on
the `nlt` branch instead of on every `anthropic`/`esv`/`planningcenter` request
too. No behavior change (the value was already ignored for other services); pure
clarity fix per the review's own "not required, but for clarity" framing.

## Skipped Issues

### IN-03: No end-to-end test of the api handler's NLT auth-gate + key-overwrite integration

**File:** `functions/src/index.test.ts:959-1011`
**Reason:** Explicitly excluded from scope by the fixer task instructions
("SKIP IN-03 (pre-existing, not phase-introduced)"). The review itself labels
this Info rather than Warning because it is a pre-existing gap shared with the
`esv`/`anthropic` branches (which never had `onRequest` handler-level test
coverage either), not something newly introduced by this phase. Recommended as a
follow-up ticket to add a lightweight `onRequest` test harness (e.g. via
`supertest`) covering the 401 gate + secret-injection integration for all three
`SECRET_INJECTED` services at once.

## Verification

- `npm run type-check` (`vue-tsc --build`, includes test files): clean, 0 errors.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` (full app suite): 90
  passed / 2 failed test files, 2864 tests passed / 1 failed — matches the
  documented pre-existing 2-file baseline exactly
  (`src/storage.rules.test.ts` — no Storage emulator running;
  `src/views/__tests__/RosterView.test.ts` — stale assertion). No new failing
  file was introduced.
- `cd functions && npm test`: 5 files / 115 tests, all passed.

---

_Fixed: 2026-08-08T06:03:44Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
