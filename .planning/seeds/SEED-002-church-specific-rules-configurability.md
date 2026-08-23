---
trigger_when: next milestone is scoped, or any work touches teams / service-plan setup / song filtering / Planning Center export / the VW model
planted_during: v2.1 close-out audit (gsd-next carry-forward triage)
planted_date: 2026-08-23
---
# SEED-002: Extract church-specific hard-coded rules into per-org configuration (or drop them)

## When to Surface
- The owner scopes the milestone after v2.1 and wants the app to fit churches other than Berean.
- Any work touches: the team list / team checkboxes, the new-service dialog, AI song suggestion/filtering,
  Planning Center export or import, or the Vertical Worship ("1-2-3") model.
- Any time a second real church is onboarded and something "tailored to us" gets in their way.

## The Idea (owner, 2026-08-23)
A lot of worship logic was tailored to one church (Berean) and is **hard-coded**, not per-org. Decide, per
rule, whether to (A) make it **per-org configurable**, (B) **drop the automation** and let each org do it
manually, or (C) **keep as-is** (already configurable, generic, or platform-scope). The two things the owner
named explicitly: the **team list** and the **"Orchestra checkbox → Orchestra-only songs"** filter.

## Framing: a per-org settings model ALREADY exists
`OrgSettings` already carries `defaultServiceTemplate`, `bibleVersion`, `vwModeEnabled`, `slideTypography`,
`timezone`, `messaging`; roster roles are seeded from `DEFAULT_ROLES` then editable per-org. So this is not
"build configurability from scratch" — it's "decide which hard-coded rules join that model, and which get
deleted." (See also the realized SEED-001, which became the v1.9 super-admin Owner Console — but that config
is GLOBAL ops config; church worship rules need PER-ORG config.)

## Full catalog + verdicts (swept 2026-08-23)

### A — Make per-org configurable (generic need, church-specific values)
- **A1. Team list** `['Choir','Orchestra','Communion','Special']` — `ServiceEditorView.vue:1675`, duplicated
  `NewServiceDialog.vue:145`. **Top priority.** Model exactly like `DEFAULT_ROLES` (seed defaults, edit in
  Settings). Collapse the 2 copies to one source. Fold in the `'Special' → free-text service name` rule
  (`ServiceEditorView.vue:778`, `NewServiceDialog.vue:64`, `ServiceCard.vue:87`) as a per-team "named service"
  flag, or just always allow a service name.
- **A2. Per-team song-tag filter** (generalize the Orchestra rule) — `ServiceEditorView.vue:3426`, `:3537`.
  Turn "Orchestra team → only `Orchestra`-tagged songs" into an optional per-team setting: "when this team is
  selected, limit song suggestions to tag ___." (Alternative: drop — see B.)
- **A3. Planning Center team names** `DEFAULT_PC_TEAM_NAMES` (9 literals) — `ServiceEditorView.vue:1681`,
  preselect matcher `:1700`. Don't make churches retype these — **fetch teams live from the org's connected PC
  account** and remember their pre-select choices.
- **A4. PC service/rehearsal times** (Wed 18:30–20:30, Sun 08:15–10:15, service 10:30–12:00) —
  `ServiceEditorView.vue:3962–3985`. Make them **org default times** (or per-service). Generic concept,
  church-specific clock values.

### B — Drop the automation / let orgs do it manually (too specific, low payoff)
- **B1. Ordinal-Sunday team pre-selection** (1st Sun → Orchestra+Communion, 3rd Sun → Choir) —
  `NewServiceDialog.vue:170–201` (+ `sundayOrdinal()` helper `:147`). **Clearest cut.** Encodes Berean's
  liturgical calendar; saves two clicks and means nothing to any other church. Once A1 lands, users pick teams
  manually per service.
- **B2. PC "category 1/2/3" song-import auto-mapping** — `pcSongImport.ts:35–79`. Maps Berean's PC tag names to
  VW types. If VW isn't generalized (C1), drop auto-categorization on import; or make it a per-org mapping.
- **B3. (optional) the Orchestra filter itself** — if A2 feels like over-engineering, just delete the rule; the
  song-list tag filter UI already lets users filter manually.

### C — Keep as-is (already configurable, generic, or platform-scope) — but de-dup
- **C1. Vertical Worship "1-2-3" methodology** — `song.ts` (`VWType`, `VW_TYPE_LABELS`), `slotTypes.ts`
  (progressions `1-2-2-3`/`1-2-3-3`, `PROGRESSION_SLOT_TYPES`, the fixed 9-slot `buildSlots()` default order of
  worship), `service.ts` (`Progression`). **Berean uses this**, and it's already gated by `vwModeEnabled` for
  churches that don't; the default order of worship is already overridable via `defaultServiceTemplate`. **No
  config work needed — BUT there's a real maintenance bug: `VW_TYPE_LABELS` is copy-pasted in 6+ files**
  (`ShareView`, `SongSlideOver`, `BatchQuickAssign`, `VwExplainer`, `SettingsView`, `claudeApi`). Collapse to
  the single source in `song.ts` regardless. Only make the labels themselves configurable if you want non-VW
  churches inventing their own categories.
- **C2. Bible version (`ESV|NLT`) + 66-book Protestant canon** — `service.ts:92`, `organization.ts:92`,
  `SettingsView.vue:320`, `scripture.ts` canon list. Platform scope, not church config: `bibleVersion` already
  lets orgs pick between the two supported; adding translations/deuterocanon is engineering, not a toggle.
- **C3. Generic/app-internal — keep:** Congregational Leader/Congregation/All model (`PresentationViewer.vue`,
  `CongregationalEditor.vue`); roster role-groups `band|tech|vocals|other` (`roster.ts:3`); PC title
  conventions "Worship Song -"/"Scripture -" (`planningCenterApi.ts` + the matchers at `ServiceEditorView.vue
  :3999`); `buildPlanTitle()` passage-names-the-plan.
- **C4. `ServiceSection`** (`pre-service|worship|message|sending|post-service`, `service.ts:18`) — code already
  comments "future per-church configurable." Generic enough as a default now; promote to A later if asked.

## The cross-cutting issue (prerequisite for ANY of the above)
**Duplication is the real liability.** Team list (2×), Orchestra filter (2×), ordinal rule (2×), and especially
`VW_TYPE_LABELS` (6+×) are copy-pasted literals that WILL drift. Whatever gets configured, step one is
collapsing each rule to a single source — a precondition for making it org-driven cleanly.

## Recommended first slice
One focused feature = **"Configurable Teams"**: A1 (per-org team list, like roster roles) + A2 (generalized
per-team song-tag filter) + B1 (drop the ordinal rule). Highest-value, most self-contained, and it directly
kills the two things the owner named (team list + orchestra checkbox). A3/A4 (PC teams/times) and the C1 VW
de-dup are separate, lower-urgency follow-ups.

## Related
- [[SEED-001-admin-settings-interface]] — the GLOBAL ops-config precedent (became the v1.9 Owner Console);
  this seed is its PER-ORG worship-config counterpart.
