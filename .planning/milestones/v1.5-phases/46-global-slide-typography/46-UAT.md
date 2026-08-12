---
status: complete
status_source: owner-attributed 2026-08-10 (v1.5 milestone close — code deployed to production & in real-world use; owner explicitly accepted these deferred phases as verified)
phase: 46-global-slide-typography
source: [46-VERIFICATION.md]
started: 2026-08-08T20:05:00Z
updated: 2026-08-08T20:05:00Z
---

## Current Test

number: 1
name: No fallback-font flash mid-service (R094)
expected: |
  On a real projector, present a service with a non-default chosen family and watch the
  first slide transition into view. The chosen font is resident on the first slide — no
  visible swap from a fallback face.
awaiting: user response

## Tests

### 1. No fallback-font flash mid-service (R094)
expected: On a real projector, presenting a service shows the chosen font resident on the first slide — no visible swap from a fallback face. (Gate logic proven by 8 automated tests — resolve, timeout, and both rejection paths; only the real-font-swap absence is the human judgment.)
result: accepted — owner-attributed at v1.5 milestone close (production-validated, not individually re-run; see PENDING-VERIFICATION.md banner)
### 2. Projection legibility of each curated family/weight/size (R093)
expected: Each of the five curated families (Inter, Open Sans, Poppins, Lora, Source Serif 4), at each weight and size a church might pick, is readable at typical projection distance.
result: accepted — owner-attributed at v1.5 milestone close (production-validated, not individually re-run; see PENDING-VERIFICATION.md banner)
### 3. Long-line overflow at Large (1.25) scale (R093, UI-SPEC unresolved item #2)
expected: On a real projector at Large scale, an already-long lyric/scripture line overflows acceptably. No auto-fit/shrink-to-fit is in scope this phase (out of scope per REQUIREMENTS.md) — if it bites in practice, revisit auto-fit in a later phase.
result: accepted — owner-attributed at v1.5 milestone close (production-validated, not individually re-run; see PENDING-VERIFICATION.md banner)