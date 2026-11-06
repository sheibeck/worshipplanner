# Spec: <Feature name>

**Code:** XXX
**Status:** Draft | Active
**Last changed:** YYYY-MM-DD

> Copy this file to `docs/specs/<feature-slug>.md`. Replace `XXX`, here and in every ID, with a short code of 2 to 6
> uppercase letters that no other spec uses. The IDs below are samples. The check ignores this file.

## Purpose

What this feature is for and who it serves, in a few sentences.

## Behavior

What the feature does, from the user's side. Say what must be true, not how the code does it. How the code works belongs
in the `.planning/codebase/` map docs, and why it was built this way belongs in an ADR.

## Acceptance criteria

<!-- An ID is literal text, so adding, removing or reordering criteria never changes another ID. Gaps are fine. -->

- **AC-XXX-01** - One testable statement. (R000)
- **AC-XXX-02** - Another testable statement. (R000)

## Edge cases

Each edge case this feature must handle, and the criterion that covers it.

## Out of scope

What this feature deliberately does not do.

## Retired criteria

<!-- A removed criterion moves here and its number is never reused. Tests must stop citing it. -->

- **AC-XXX-00** - A criterion that no longer applies.

## Tests

Cite a criterion by putting its ID in a test title. A comment does not count:

    it('does the thing (AC-XXX-01)', () => { ... })

A test that is skipped, `todo`, `fails`, conditional (`skipIf`, `runIf`), switched off by an options object, missing its
function or empty (only `;`, a bare `return` or `undefined`) does not count either, nor does any test in a file with
`.only`, nor a `describe` title with no counted test under it.

`src/__tests__/specCoverage.test.ts` fails if a criterion has no citing test, or if a line under Acceptance criteria is
not a criterion. That proves a test title cites the criterion, not that the test ran or asserts anything, and it cannot
see a test inside `if (false)` or a function nobody calls. Criteria for security rules are cited from `src/rules.test.ts`
or `src/storage.rules.test.ts`, which a bare `npx vitest run` does not prove, so those also need `npm run test:rules`.
Criteria cited from `render-service/src` need `cd render-service && npm test`, which a bare run does not run either.

## ADRs

- ADR-NNNN (docs/adr/NNNN-title.md)
