# Phase 16: Quarterly Schedule Share Link — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 16-quarterly-schedule-share-link
**Areas discussed:** Pairing fix semantics (R-12), Editing from Roster screen (R-04/05/07), Schedule-page redesign (R-09/10), Share page matrix + filter UX (R-01/03)

---

## Pairing fix semantics (R-12)

### Q1 — Pairing guarantee for Nolan(1/mo) / Tim(2/mo)
| Option | Description | Selected |
|--------|-------------|----------|
| Containment (asymmetric) | Every lower-cadence partner date must also be an anchor date; higher-cadence person may serve extra alone | ✓ |
| Always-together (symmetric) | Both always serve identical dates (would clamp Tim to 1/mo) | |

### Q2 — Distribute the lower-cadence partner's occurrences
| Option | Description | Selected |
|--------|-------------|----------|
| Even spread (deficit-aligned) | Distribute across the quarter reusing (dateIndex+1)/n - served; snap to anchor dates | ✓ |
| Earliest-fit | Pull onto the anchor's earliest dates until target met | |

### Q3 — Surface a cadence-driven skip?
| Option | Description | Selected |
|--------|-------------|----------|
| Silent (normal outcome) | Don't add to pairingConflicts; reserve it for genuine problems | ✓ |
| Soft-report it | Add an informational "partner at cadence" note | |

**User's choice:** Containment / even-spread / silent.
**Notes:** Fix reads the quarter-scoped per-role frequency (per Area 2), not standing. Existing hard constraints (blackout, group-compatibility) stay intact.

---

## Editing from Roster screen (R-04/05/07)

### Q1 — Which quarter does the Volunteer screen edit? (asked)
| Option | Description | Selected |
|--------|-------------|----------|
| Quarter selector, shared active | Add selector to Volunteer screen, shared active quarter in store | |
| Auto-target current quarter | No selector; target the current/latest quarter | |
| Standing-only on Roster | Roster edits standing data only (conflicts with R-07) | (superseded) |

**User's response (free-text, reframed the question):** "The frequency exists on both the roster and the quarter — consolidate to just one frequency, tracked per quarter. New quarter defaults each volunteer to the frequency they had the previous quarter; no prior data → once/month. It's too confusing to have frequency on both."

Follow-up (free-text): "Volunteer edit screen will only allow editing ROLES. When we Schedule a user it shows a Per-Role Frequency for the Quarter. Greenfield — don't carry old standing frequency forward, don't care about losing it. Default once/month if no previous quarter for that person+role, else use the previous quarter's value." Plus: "Allow editing a user's ROLES from the Schedule edit screen too, so we don't flip back and forth." Plus: "Seed the previous-quarter serve-with (pairing) data too."

### Q2 — Editor component reuse (asked)
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse AvailabilityDrawer | Mount same drawer on both screens | |
| Unified single panel | One combined per-person editor | ✓ (superseded by clean split) |

### Q3 — Confirm the simplified editing split
| Option | Description | Selected |
|--------|-------------|----------|
| Confirm the clean split | Volunteer = roles only; frequency+blackout+pairing on Schedule; standing frequency removed; seed from previous quarter else monthly; no cross-screen duplication | ✓ |
| Keep blackout cross-screen too | Also keep blackout editable on Volunteer screen (R-07 as specced) | |

**User's choice:** Clean split — and explicitly "make sure to seed the previous-quarter serve-with data if it exists, too." Plus roles editable from the Schedule screen.
**Notes:** This descopes the "edit from both screens" parts of R-04 (pairing), R-05 (frequency), R-07 (blackout). Only roles are cross-screen. Frequency relocated from standing (`Person`) to quarter-scoped (`PersonQuarterData`).

---

## Schedule-page redesign (R-09/10)

### Q1 — Layout direction to steer the research note
| Option | Description | Selected |
|--------|-------------|----------|
| Evolve the card stack | Cleaner, collapsible sections | |
| Calendar/matrix-centric | Grid as focal point | |
| Fully open — let research decide | No steer; research recommends | ✓ |

### Q2 — Editing grid mirror the share matrix?
| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the share matrix | Roles×dates editing grid | |
| Keep date-grouped editing | Current QuarterGrid shape | |
| You decide / defer to research | Research weighs it | ✓ |

### Q3 — Add-quarter vs select-quarter separation (R-10)
| Option | Description | Selected |
|--------|-------------|----------|
| Switcher + distinct Add action | Quarter switcher + distinct "Add quarter" button/modal | ✓ |
| Separate 'Manage quarters' area | Creation in its own section | |
| You decide / defer to research | Research resolves | |

**User's choice:** Layout & grid-format fully open (research-driven); add-quarter is switcher + distinct Add action.

---

## Share page matrix + filter UX (R-01/03)

### Q1 — Matrix behavior on narrow/phone screens
| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll, sticky dates | True matrix on phones, pinned date column | |
| Auto-fall back to list | Phones default to list view | ✓ |
| You decide | Implementation picks | |

### Q2 — Name filter control
| Option | Description | Selected |
|--------|-------------|----------|
| Searchable dropdown of names | Typeahead of snapshot names; exact name in URL | ✓ |
| Free-text substring match | Plain text, substring match | |
| You decide | Implementation picks | |

### Q3 — Persist view mode in URL?
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, persist view in URL | View + filter both in URL | ✓ |
| No, filter only | Only filter persists | |

**User's choice:** Auto-fall-back-to-list on phones; searchable name dropdown; persist both view and filter in URL.

---

## Claude's Discretion
- Exact quarter-scoped per-role frequency storage shape (merge with `roleTiers` vs new structure).
- Precise `propagatePairing` reconciliation mechanism (remaining-cadence predicate vs post-pass).
- Editing-grid format vs share matrix (deferred to R-09 research).
- Schedule-page layout direction (deferred to R-09 research).
- QuarterGrid slide-out mobile presentation; matrix multi-person cell rendering; exact "previous quarter" selection for seeding.

## Deferred Ideas
- Cross-screen editing of frequency/blackout/pairing (descoped; only roles are cross-screen).
- Horizontal-scroll matrix on mobile with sticky date column (not chosen; auto-fall-back-to-list instead).
- Reviewed-but-not-folded todo: `per-role-frequency-and-vocal-instrument-pairing.md` (already shipped in Phase 15; R-12 leftover already in the SPEC).
