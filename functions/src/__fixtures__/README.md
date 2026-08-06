# PPTX Parser Fixtures

Fixture inputs consumed by `functions/src/pptxParser.test.ts` (21-04) — the
Cloud Function's PPTX-parsing "central risk" (per `21-RESEARCH.md` Pitfall 4)
is validated against real, diverse `.pptx` decks plus the corrupted/mis-declared
error path, never a single happy-path sample.

## Fixtures

| File | Status | Role |
|------|--------|------|
| `mixed.pptx` | Present (copied from `docs/example.pptx`, a genuine ~8.8MB PowerPoint 2007+ deck provided by the user) | Authoritative "mixed content" integration fixture — slides combining a background/logo image with overlaid text. Exercises the mixed-content mapping heuristic (21-RESEARCH.md Open Question 1 / Pitfall 4). |
| `text-only.pptx` | **Deferred** — not yet provided | A deck with bullets/headings and no images. Per this plan's `user_setup`, an authentic PowerPoint binary must be human-provided (Claude cannot fabricate a valid `.pptx`). Drop an exported `.pptx` here before running the full 21-04 parser suite. |
| `image-only.pptx` | **Deferred** — not yet provided | A deck of full-bleed image slides, no text. Same human-provided requirement as `text-only.pptx`. |
| `corrupted.pptx` | Present (executor-created) | Plain text bytes with no `PK\x03\x04` zip signature at offset 0 — drives the friendly-error / never-delete-on-failure path for a byte-corrupted upload. |
| `not-a-pptx.txt` | Present (executor-created) | A plain text file representing a mis-declared upload (wrong extension / wrong `fileType`). Drives the same friendly-error path from a different failure mode (not even zip-shaped). |

## Why `mixed.pptx` is enough to start 21-04

`docs/example.pptx` is a real, non-trivial PowerPoint file (not a synthetic
stub), so it already exercises `officeparser`'s buffer-based parsing and the
mixed-content mapping heuristic end-to-end. The dedicated `text-only.pptx` and
`image-only.pptx` decks sharpen the heuristic's edge cases (a deck that is
*entirely* one content type) but are not required to begin implementing or
smoke-testing `mapAstToSlides()` in 21-04 — they were logged as deferred
follow-up in `21-03-SUMMARY.md` rather than blocking this plan.

## Error-path fixture construction

- `corrupted.pptx` intentionally begins with the ASCII bytes `This is not a
  valid ZIP...` — not `PK\x03\x04` — so any code path that checks the zip
  magic-byte signature before invoking `officeparser` will reject it
  immediately, and any path that skips that check and hands the buffer
  straight to `officeparser` will still fail during zip decompression.
- `not-a-pptx.txt` is a plain `.txt` file, covering the "wrong extension /
  wrong declared `fileType`" mis-upload case independently of zip-signature
  validation.
