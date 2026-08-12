# Phase 56: Service-Item Overrides - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning
**Mode:** Autonomous (owner scope addition; standing v1.6 grant — auto-decide grey areas, defer human
verification, STOP before milestone lifecycle, no deploys)

<domain>
## Phase Boundary

Two independent per-item override features in the service editor (R127, R128):

1. **Editable Miscellaneous label (R127)** — a MISC item can be given a custom label (default
   "Miscellaneous", editable to anything). The label is the item's displayed name in both the live
   service editor (`ServiceEditorView.vue`) and the Edit Default Template editor
   (`ServiceTemplateEditor.vue`), and is sent as the **Planning Center item title** instead of the
   hard-coded "Miscellaneous". Non-destructive optional field; empty ⇒ "Miscellaneous" (today's
   behavior).

2. **Per-item Scripture Bible-version override (R128)** — a Scripture item can choose ESV or NLT for
   just that item, overriding the org-wide default `bibleVersion`. The override is honored wherever
   that item's scripture text is produced (slide materialization, preview, print, and the Planning
   Center export routing). Items with no override keep using the org default. Non-destructive optional
   per-slot field; absent ⇒ org default (today's behavior).

Scope: the service editor + template editor + the downstream scripture/PC-export/print consumers. No
data migration; both new fields are optional.

</domain>

<decisions>
## Implementation Decisions

### R127 — Miscellaneous label model
- Add optional **`label?: string`** to `NonAssignableSlot` (`src/types/service.ts:86`). Only MISC uses
  it; leaving it on the shared interface is harmless and avoids a new type.
- **MISC keeps its consolidated free-text field** (the notes-canonical field from quick task
  260811-vsr — details/description). The **label is a distinct, compact "name/title" input**, NOT a
  second notes box. So a MISC row shows: the type badge, a small editable **label** input (its name),
  and the existing notes/details field. This is the one auto-decision worth the owner's eventual eye:
  the alternative (make the single consolidated field double as the label) would drop MISC's PC-export
  *description* and force existing MISC `body` text to become a title — rejected as lossy. Keeping
  label + notes is backward-compatible and matches the owner's words ("set the label… export this
  label") without removing anything.
- **Where the label surfaces:** the item's displayed name/badge shows `label` when set, else
  "Miscellaneous". Introduce a small helper (e.g. `miscLabel(slot) = slot.label?.trim() || 'Miscellaneous'`)
  and use it for the badge/title AND the PC export title (`planningCenterApi.ts:1026`,
  `title: 'Miscellaneous'` → `title: miscLabel(slot)`). Default placeholder in the input:
  "Miscellaneous".
- **Both editors:** the same label input + `miscLabel` display in `ServiceEditorView.vue` and
  `ServiceTemplateEditor.vue`. The template entry shape (whatever `ServiceTemplateEntry`/the template
  store uses for a MISC entry) gains a matching optional `label`, threaded through
  `buildSlotsFromTemplate`/`createSlot` so a template's MISC label flows into a created slot's `label`.
  Planner: confirm the exact template-entry seam and whether `createSlot` needs the field.

### R128 — Scripture Bible-version override
- Add optional **`bibleVersion?: 'ESV' | 'NLT'`** to `ScriptureSlot` (`src/types/service.ts:73`).
  Absent ⇒ use the org default `authStore.settings.bibleVersion`. Available versions are exactly ESV
  and NLT (`bibleVersion: 'ESV' | 'NLT'` — the app supports no others).
- **UI:** a small per-item version selector in the Scripture row (editor only, `canEditService`) with
  three states: **"Default (ESV/NLT)"** (unset — shows which org default is in effect), **ESV**, **NLT**.
  Writing a value that equals the org default may still be stored as an explicit override or coerced to
  "default" — planner's discretion; simplest is to store exactly what's chosen and treat unset as default.
- **Effective-version resolution:** everywhere scripture text/version is produced, use
  `slot.bibleVersion ?? orgDefault`:
  - **PC export** — `addSlotAsItem`'s SCRIPTURE branch (`planningCenterApi.ts:970`) currently uses the
    `bibleVersion` param (org default, threaded per quick task 260809-vvq). Change to
    `(slot as ScriptureSlot).bibleVersion ?? bibleVersion` for BOTH the fetch routing
    (`fetchNltPassageText` vs `fetchPassageText`) — the title is version-agnostic.
  - **Slide materialization / preview / print** — the planner must trace whether scripture *slide*
    text is fetched passage text (version-dependent) or just the typed reference (version-independent).
    `slideGroupMaterializer.ts` (SCRIPTURE branch `:82`, and the `:117` note "never recomputed from the
    org's current bibleVersion setting") suggests scripture slides may store text at fetch time; and
    R124 (Phase 55) removed the auto-appended "(ESV)/(NLT)" suffix from preview. Wherever a passage
    fetch or a version-dependent render exists for a scripture item, route it through the effective
    version. Where scripture rendering is purely the typed reference, the override has no effect there
    and that's fine — document it rather than inventing a surface.
- Do NOT change the org-wide default or the Settings UI — this is a per-item override only.

### Claude's Discretion
- Exact input styling/placement within the three-rail row (keep consistent with 260811-vsr), the
  precise "Default (…)" label wording, whether an override equal to the default is stored or coerced,
  and the exact template-entry seam for the MISC label — all at the planner/executor's discretion,
  subject to the locked decisions above (both fields optional + non-destructive; label = distinct name
  input; effective version = `slot.bibleVersion ?? orgDefault`).

</decisions>

<code_context>
## Existing Code Insights (verified 2026-08-12)

- Types: `ScriptureSlot` (`src/types/service.ts:73`), `NonAssignableSlot` (`:86`, has `body?`/`linkUrl?`/
  `linkLabel?`), base `MediaAttachableSlot` (`:39`, carries `notes?`).
- PC export `addSlotAsItem` (`src/utils/planningCenterApi.ts:895`): SCRIPTURE branch `:958–1004`
  (version routing `:970`, `bibleVersion` param `:903`), MISC branch `:1025` (`title: 'Miscellaneous'`,
  `description: bodyDescription(slot.notes ?? slot.body)`). Org default already threaded from
  `ServiceEditorView` (quick task 260809-vvq).
- Scripture slide derivation: `src/utils/slideGroupMaterializer.ts` SCRIPTURE branches (`:82`, `:198`,
  `:304`, `:940`); the `:117` comment documents that scripture slide text is not recomputed from the
  org bibleVersion — trace this to decide R128's slide-side behavior.
- Editors: `src/views/ServiceEditorView.vue` (SCRIPTURE + MISC rows, post-260811-vsr three-rail layout;
  the consolidated field + `kindBadgeClass` + per-row ⋯ menu are the current structure to fit into) and
  `src/components/settings/ServiceTemplateEditor.vue` (the template editor; ports ServiceEditorView's
  per-section row rendering). Print: `src/components/ServicePrintLayout.vue`.
- Org default version: `authStore.settings.bibleVersion` (`'ESV' | 'NLT'`), set in Settings (Phase 45).

</code_context>

<specifics>
## Specific Ideas / Owner Words

- R127: "For Miscellaneous items let the user set the label to whatever they want instead of
  miscellaneous. So, miscellaneous by default, but can be edited. When exporting to planning center, we
  want to export the this label instead of Miscellaneous." Applies to the template editor too: "the
  changes for Miscellaneous label should also apply to that."
- R128: "When I'm editing a service plan and I have a Scripture item, let me choose any available bible
  version for just that item that would allow me to override the default scripture setting." ("Any
  available" = ESV or NLT — the only supported versions.)

</specifics>

<deferred>
## Deferred / Out of Scope
- Template-editor UX redesign is **Phase 57** (R129), not here. This phase only adds the MISC **label**
  to the template editor (functional), not the visual redesign.
- No new Bible translations beyond ESV/NLT; no change to the org-wide default or Settings UI.
- Owner visual verification is DEFERRED per the standing grant (record in PENDING-VERIFICATION.md).
</deferred>
