# 260811-vsr — Service Order redesign: visual contract

**Source:** Claude Design project "Worship Planner Slideshow Design" (`e8e6c287-…`), file
`Slides Tab.dc.html`, Turn 4a (desktop "one column, three rails") + Turn 4b (mobile 390px stack).
Imported + read 2026-08-11. This spec distills that mockup into the app's real theme.

**Golden rule:** the mockup is a *dark-indigo* canvas; the app is ALREADY dark with an **indigo**
accent (`bg-indigo-600`, `text-indigo-400`, `focus:ring-indigo-500`). Do NOT introduce the mockup's
raw hex palette — map to the app's existing Tailwind gray/indigo tokens. This is a structural
refinement of the existing Service Order tab, not a re-skin. **Change layout/markup only — no
functional/data-flow changes** beyond the notes-canonical consolidation and the control relocation
below.

---

## Row model — the "three rails" (replaces the current `.slot-item` inner layout)

Current row (`ServiceEditorView.vue` ~:880–1218):
`[drag handle] · [.flex-1 content: per-kind chain + sm:w-64 side-by-side notes] · [section <select>] · [✕ remove]`

Target row — **four horizontal zones, top-aligned (`items-start`):**

1. **Drag handle** — unchanged (`.drag-handle`, editor-only, `canEditService`). Far left.
2. **Badge rail** — fixed width (`w-32`/~128px, `flex-none`). Holds ONE colored per-kind pill
   (uppercase, `text-[10px] tracking-wider`, rounded, subtle bg+border). Replaces the current
   inline `slotLabel` `<p>` headings inside each kind block. Position-derived labels
   (`slotLabel(slot, index)` → "Song", "Verse 1", etc.) still supply the text.
3. **Field column** — `flex-1 min-w-0`, vertical stack (`flex flex-col gap-2`):
   - the kind's **selector/content** (song picker/display, scripture search+ref, hymn fields,
     imported, OR — for plain kinds — the single text field), then
   - the **notes field** (see consolidation rules). **Stacked, full-width. Walk back Phase 54's
     `sm:flex-row` side-by-side notes** (`:903` wrapper and `:1173` `sm:w-64` column).
4. **Action rail** — fixed width (`~w-24`/`flex-none`), right-aligned (`justify-end`), top-aligned:
   - optional slide-count text (`text-[11px] text-gray-500`) IF a per-slot count is cheaply
     derivable the way section headers already compute `sectionSlideCount`; otherwise omit (decorative).
   - a **⋯ menu** button (see "Controls relocation"). **No inline ✕ on the row anymore.**

The whole item list column is capped to a **readable width** (`max-w-[1060px]`, mockup's cap) so
fields don't stretch edge-to-edge on wide screens. Apply on the list container, not each row.

---

## Per-kind badge colors (Tailwind, dark)

Map the mockup's per-kind tints to Tailwind so kinds are visually distinct but on-theme:

| Kind | Pill classes |
|---|---|
| SONG | `bg-indigo-950 border border-indigo-800 text-indigo-300` |
| SCRIPTURE | `bg-cyan-950 border border-cyan-800 text-cyan-300` |
| ANNOUNCEMENTS / MESSAGE (Sermon) | `bg-rose-950 border border-rose-900 text-rose-300` |
| PRAYER / MISC | `bg-gray-800 border border-gray-600 text-gray-300` |
| HYMN | `bg-amber-950 border border-amber-900 text-amber-300` |
| IMPORTED | `bg-gray-800 border border-gray-700 text-gray-400` |

(Exact shades at executor discretion; keep them muted/dark and legible. A small central
`kindBadgeClass(kind)` helper keeps the template clean.)

---

## Field consolidation (the notes-canonical decision, reaffirmed)

**Plain kinds — Prayer, Misc, Announcements, Message(Sermon): ONE input each.** Owner confirmed the
mockup's two-box (content + "Notes for the team") is wrong for these — **one field only.** That single
field is the **notes-canonical** field:
- Remove the plain-kind `<textarea>` bound to `body` (`:1106`) AND Prayer's `linkLabel`/`linkUrl`
  inputs (`:1056–1084`). Keep `body`/`linkUrl`/`linkLabel` on the types + in Firestore (untouched
  data) — UI removal only, exactly as Message's link fields were removed in Phase 43.
- The single field **reads `notes ?? body`** (legacy fallback) and **writes `notes`**. Per-kind
  placeholder ("Church-wide announcements", "Who is praying?", the MISC template default, etc.).
- **Migrate the read-side consumers to `notes ?? body`** (non-destructive, no data migration):
  `ServicePrintLayout.vue:64–81`, Planning Center export's `otherSlots` bucket for
  PRAYER/MESSAGE/ANNOUNCEMENTS/MISC (quick task `260809-vvq`), and any slide use in
  `slideGroupMaterializer.ts` that reads `body`. The template editor's Misc default (Phase 52 R116)
  writes `notes`.

**Selector kinds — Song, Scripture, Hymn, Imported: selector + ONE notes field** (notes keeps its
Phase-54 "who leads / who sings what" meaning), stacked in the same field column.

Plain text only (no rich text): `:value` binding + `{{ }}` interpolation (auto-escape), never
`v-html`. On empty write `= value || undefined` so `stripUndefined` drops it (existing T-54-01 rule).

---

## Controls relocation → per-row ⋯ menu (owner decision)

The action rail's **⋯ menu** replaces BOTH the inline section `<select>` (`:1194`) and the inline ✕
remove button (`:1207`). Owner: *"Move it into the 3 dot menu, and put the delete in there, too so
we don't have the x."* Menu contents (editor-only, `canEditService`):
- **Move to section →** — the section choices (`SERVICE_SECTIONS` + "No section"), calling the
  existing `onSectionChange(index, value)`. This is the reliable non-drag way to change section
  (drag-between-bands remains, but is not the only path — matters because v1.6 drag fixes 51–55 are
  not owner-verified). **Functionality preserved.**
- **Delete** — calls the existing `removeSlot(index)`. (Keep the existing delete confirm/flow.)
- (Any other per-row action that exists today stays available here.)

Menu is a lightweight popover/dropdown (mirror the existing `openSectionAddKey` section "Add item"
popover pattern already in this file — a sibling toggled element, NOT a portal, so it stays outside
any Sortable instance). Close on outside-click/select. Give it a `data-testid` for tests.

---

## Section bands + the "No Section" band

Section bands already exist (`:808` header, `:813` count, `:817` add-item). Keep them; align spacing
to the new rhythm. The **ungrouped/legacy bucket currently gets NO header** (`:845`). Add a band
header for it, styled **muted / dashed** to read "not placed yet" and clearly distinct from the last
real section (Post-Service). Label e.g. **"No Section"**. Render only when the bucket is non-empty.

---

## Mobile (≤ sm) — three rails collapse to one stack (Turn 4b)

Below `sm`, each item card is a single vertical stack:
- **Top line:** drag handle · colored badge · (spacer) · slide-count · ⋯ menu — all on one row.
- Then the selector/content field (full width).
- Then the notes field (full width), for kinds that have one.
Reuse the QuarterView responsive recipe. No horizontal scrolling; tap targets ≥ ~34px.
Header actions (Print/Share/Export/Save/Mark-planned) may fold behind a ⋯ on mobile per the mockup —
OPTIONAL polish; only if cheap, else leave the existing header responsive behavior.

---

## Must-preserve (this is layout + consolidation, not a behavior change)

- All `v-if="canEditService"` gating and every viewer/locked read-only branch (CLASS A/B lock
  semantics). Viewers still see read-only content + notes; no editor-only control leaks to viewers.
- `slotLabel(slot, index)` position-derived naming; `groupBySection` ordering; drag/Sortable wiring
  and its `group.key` bump logic (`:796`); the add-to-service palette (`:1229`) and section add-item
  menus (`:833`).
- Data model untouched: `body`/`linkUrl`/`linkLabel` remain on the types and in Firestore.
- Existing `data-testid`s used by tests stay (or tests updated in lockstep). Add new ones for the
  ⋯ menu, the No-Section band, and the consolidated field.

## Gates
- `npm run type-check` (vue-tsc --build) clean.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` green at the 2-file known baseline
  (`storage.rules.test.ts`, `RosterView.test.ts`). Update ServiceEditorView / PC-export /
  ServicePrintLayout tests to match the new markup + `notes ?? body`.
