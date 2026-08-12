---
phase: quick-260805-bvo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/PresentationViewer.vue
  - src/components/__tests__/PresentationViewer.test.ts
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/slideDisplay.ts
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/slides/__tests__/SlideGrid.test.ts
  - src/components/slides/__tests__/slideDisplay.test.ts
  - src/components/slides/__tests__/SlideActionMenu.test.ts
autonomous: true
requirements:
  - QUICK-260805-bvo

must_haves:
  truths:
    - "On the Present screen a scripture slide's reference reads as white slide content in the same treatment the other kinds use — not as an accented, uppercased, letter-spaced label (D1)"
    - "The scripture reference keeps a size/weight hierarchy against the verse body below it, so a slide carrying BOTH a reference and verse text still reads as two levels (D1)"
    - "The reference fix applies to BOTH scripture sub-branches — the normal single-body slide and the congregational Leader/Congregation slide — because one element renders above both"
    - "A non-song slide's 3-dot menu offers exactly one edit affordance, 'Edit details', plus Duplicate and Delete when the user may mutate (D2)"
    - "Opening 'Edit details' on a Prayer/Message/hand-authored text slide lets the user edit BOTH the slide label AND the slide text in the same drawer body, with no second mode to switch to (D2)"
    - "A HYMN group's auto-derived pristine text slide gets the SAME editable body and the SAME menu as a hand-added one — the Hymn carve-out is gone (D2, a deliberate reversal of 33-UI-SPEC §3 row 3a)"
    - "A song group's lyric and copyright slides remain read-only: no editable body, no duplicate, no delete, regardless of who is looking (R054/P-03 — NOT dropped)"
    - "A scripture slide's menu is unchanged: Edit details plus 'Edit scripture text', which still opens the congregational-reading editor (D3)"
    - "A viewer, or an editor on a locked service, still sees a read-only text block rather than an editable field — canMutate gating is unchanged"
    - "No surface in the app offers a separate lyrics-mode drawer body any more: the drawer has one body, and its header always reads 'Edit Slide Details'"
  artifacts:
    - path: "src/components/PresentationViewer.vue"
      provides: "Scripture reference rendered as white slide content with its hierarchy sizing retained"
      contains: "text-2xl font-semibold leading-[1.3] text-gray-100 mb-8"
    - path: "src/components/slides/slideDisplay.ts"
      provides: "Per-kind menu contract with a single edit affordance for text entries and no lyrics key in the union or the label map"
      contains: "case 'text':"
    - path: "src/components/slides/EditSlideDrawer.vue"
      provides: "A single-body drawer whose hand-authored text branch renders the editable textarea for anyone who may mutate, with no mode prop"
      contains: "drawer-slide-text-editable"
    - path: "src/components/slides/SlidesTab.vue"
      provides: "Menu dispatcher with one edit-drawer branch and no drawer-mode state"
      contains: "case 'edit-details':"
    - path: "src/components/__tests__/PresentationViewer.test.ts"
      provides: "Regression test pinning the scripture reference's class list, for both the normal and congregational fixtures"
      contains: "presentation-label"
    - path: "src/components/slides/__tests__/slideDisplay.test.ts"
      provides: "Exact-list menu assertions that pin the D2 contract and cannot silently regain a lyrics key"
      contains: "toEqual(['edit-details', 'duplicate', 'delete'])"
  key_links:
    - from: "3-dot menu key 'edit-details' emitted by SlideGrid"
      to: "the drawer opening with both the label input and the editable text field visible"
      via: "SlidesTab.onMenuAction sets drawerOpen only — there is no longer a mode to set"
      pattern: "drawerOpen.value = true"
    - from: "localBody v-model on the textarea"
      to: "the debounced Firestore write"
      via: "the pre-existing watch(localBody) -> scheduleWrite('body', ...) path, which was NEVER mode-gated and needs no change"
      pattern: "scheduleWrite\\('body'"
    - from: "canMutate (isEditor && !serviceLocked && !isSongGroup)"
      to: "editable textarea vs read-only paragraph in the text branch"
      via: "the v-if/v-else pair inside the sourceKind === 'text' branch, unchanged in gating, only un-nested from the mode wrapper"
      pattern: "v-if=\"canMutate\""
---

<objective>
Fix two unrelated defects the owner reported together from the running app.

1. **D1 — the blue scripture reference.** `PresentationViewer.vue`'s scripture branch renders the passage reference in an accented uppercase letter-spaced treatment, so it reads as a LABEL rather than as slide content. Under R047 a scripture slide defaults to reference-only, which means this label is frequently the ENTIRE visible content of the projected slide. Make it white slide content.

2. **D2 — two edit affordances on a non-song slide.** The 3-dot menu on a Prayer item offers both "Edit details" and "Edit lyrics". Collapse to one: "Edit details", whose drawer edits BOTH the slide label and the slide text.

Purpose: Owner feedback on the running app. Verbatim: *"Scripture slides are showing the Scripture passage as formatted like a label: it's blue text instead of the white text we see on other slides. Also, we have Edit Details and Edit Lyrics on the Prayer item. I think for non-song items, our three dot menu just needs Edit details. And that should allow us to edit the label, and the text instead of having the text editing be it's own 'edit lyrics' button."*

Output: One class-attribute change plus a regression test for D1; a single-body drawer, a one-key menu contract, the removal of the now-dead lyrics key/label/dispatch/discriminator, and flipped pinning tests for D2.

**D2 is a deliberate, owner-authorised REVERSAL of a documented rule.** `slideDisplay.ts` currently withholds the lyrics affordance from a HYMN group's auto-derived pristine text slide on anti-shadow-copy grounds (33-UI-SPEC §3 row 3a). The owner has overridden that: *"This only non-editable thing should be Song. Everything else can be editable. Hymns are a special thing for now only. In the future we'll get rid of that item and just make them regular songs again, but not yet."* Do not preserve the Hymn carve-out, do not invent a safer middle path, and do not leave the existing code comments asserting a rule the code no longer follows — rewrite them to record the reversal.

Explicitly NOT in scope:
- `lyric` and `copyright` entries stay read-only (R054/P-03, always inside a SONG group). Only the `text` branch loses its second affordance.
- Scripture's menu is untouched (D3): it keeps "Edit details" plus "Edit scripture text", which opens the purpose-built congregational-reading modal, not the drawer.
- `PresentationViewer.vue` line 146 — the SECOND `presentation-label`, carrying a TextSlide's title. The owner reported scripture only. After D1 these two will diverge (scripture white, text-slide title still accented). That inconsistency is knowingly left in place, and Task 3 SURFACES it rather than silently widening it.
- No `.env.local` change, no `firebase deploy`, no project-wide `lint --fix`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260805-bvo-scripture-slide-text-renders-as-blue-lab/260805-bvo-CONTEXT.md

@src/components/PresentationViewer.vue
@src/components/slides/slideDisplay.ts
@src/components/slides/EditSlideDrawer.vue
@src/components/slides/SlidesTab.vue
</context>

<interface_context>

All line numbers below were re-verified against live source on 2026-08-05. They drift — re-read each region before editing rather than trusting the number.

**D1 — the target element.** `src/components/PresentationViewer.vue` lines 105-110: a `<p data-testid="presentation-label">` inside the `slideKind === 'scripture'` branch, carrying `(currentSlide.slide as ScriptureSlide).reference`. Its class attribute is `text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8`.

It sits ABOVE the `isCongregational` fork (lines 111-139), so ONE edit covers both scripture sub-branches: the congregational Leader/Congregation blocks and the normal `presentation-body` paragraph. The speaker tags at line 118-124 carry their own accent classes under a DIFFERENT testid (`presentation-speaker-{idx}`) and are not the reported defect — leave them alone. The verse body at line 133-139 is already `text-gray-100` and is not the defect either.

The precedent D1 mirrors is the copyright branch at lines 84-92: a `text-6xl text-gray-100` primary line above a `text-2xl ... text-gray-300` secondary line — hierarchy by size and weight, not by accent colour.

**Existing PresentationViewer tests.** `src/components/__tests__/PresentationViewer.test.ts` asserts `presentation-label` TEXT in five places (lines 481-497, 521-529, 574-588) but asserts its CLASSES nowhere — grep confirms no `indigo-400` assertion exists in that file. So no existing test flips for D1; a new one is required. Fixtures already present in the file: `longScriptureSlide(id)` (used at line 522, reference `'John 3:16'`) and `congregationalScriptureSlide(id, sections)` (used at line 536). The neighbouring congregational test at 531-544 already asserts classes via `.classes()`, so the assertion style is established.

**D2 — the menu contract.** `src/components/slides/slideDisplay.ts`:
- Lines 16-23: the `MenuItemKey` union, six members.
- Lines 231-243: `MENU_ITEM_LABELS`, a `Record<MenuItemKey, string>` — removing a union member REQUIRES removing its row here or the record stops typechecking. That is a useful forcing function; let it fire.
- Lines 258-302: the long doc comment over `slideActionMenuItems`. Its `★ The Hymn discriminator (§3 row 3a)` paragraph (274-286) is the anti-shadow-copy rule D2 reverses.
- Lines 303-342: `slideActionMenuItems(entry, planItemKind, canMutate)`. The `text` branch at 321-328 computes `hasBody` from `entry.sourceRef.body !== undefined` and `offersEditLyrics` from `hasBody || planItemKind === 'PRAYER' || planItemKind === 'MESSAGE'`.

**`planItemKind` becomes unconsulted.** No other branch of the switch reads it. Verified constraints for keeping it: the root `tsconfig.app.json`/`tsconfig.node.json` do NOT set `noUnusedParameters` (only `functions/tsconfig.json` and `render-service/tsconfig.json` set `noUnusedLocals`, and neither compiles `src/`), and the file's own header comment records that this repo's ESLint runs the default `args: 'after-used'`, under which an unused parameter FOLLOWED by a used one (`canMutate`) is not reported. Keeping the parameter is therefore safe and avoids churning eight call sites for no behavioural gain.

**D2 — the drawer.** `src/components/slides/EditSlideDrawer.vue`:
- Line 27: `<h2 ... data-testid="edit-slide-drawer-title">{{ drawerTitle }}</h2>`.
- Lines 108-120: the Slide Label block, `v-if="canMutate && mode === 'details'"`, `v-model="localLabel"`.
- Lines 122-134: the Slide Text section header comment plus `<div v-if="sourceKind && sourceKind !== 'video'" data-testid="drawer-slide-text-section">`. NOT mode-gated.
- Lines 137-187: the `lyric`, `copyright`, `scripture` and `imported` sub-branches. **All four are out of scope and must be byte-identical afterward.**
- Lines 189-219: the `sourceKind === 'text'` sub-branch — the only one in scope. It forks on `mode`: `lyrics` renders the `drawer-slide-text-editable` textarea (or a read-only paragraph for a non-mutator), `else` renders a read-only paragraph plus a `drawer-slide-text-caption` reading "Edit this slide's text via Edit lyrics".
- Line 228 (`drawer-audio-section`), line 315 (`drawer-background-section`), line 374 (Notes), line 389 (`drawer-footer-actions`): four more `mode === 'details'` conjuncts.
- Lines 490-498 and 521: the `mode?: 'details' | 'lyrics'` prop, its doc block, and its `withDefaults` entry.
- Lines 612-621: the `drawerTitle` computed and its doc block.

**The save path needs no change.** `localBody` is written through `watch(localBody, ...)` at lines 1189-1192, which calls `scheduleWrite('body', ...)`; `flushAll` at 1100-1112 already flushes `label`, `notes` and `body` in sequence, and `resetLocalFields` at 1114-1123 already seeds `localBody` from `entry.sourceRef.body`. **None of it was ever mode-gated.** Making the textarea visible in the single body is therefore purely a rendering change.

**The label half already works — verified, change nothing about its behaviour.** Line 111's gate is `canMutate && mode === 'details'`; `edit-details` already dispatches with `mode: 'details'`; `canMutate` is `isEditor && !serviceLocked && !isSongGroup`, which is true for an editor on an unlocked Prayer item. So "Edit details" already edits the label today. The only edit this plan makes there is dropping the now-constant `mode === 'details'` conjunct — a no-op for behaviour.

**D2 — the dispatcher.** `src/components/slides/SlidesTab.vue`: line 42 binds `:mode="drawerMode"`; line 273 declares `const drawerMode = ref<'details' | 'lyrics'>('details')`; `onMenuAction` at 463-507 sets it at lines 468, 472, 497 and 502; the doc comment at ~440-456 describes the two-edit-key/mode model.

**Tests that pin the OLD behaviour and must FLIP, enumerated.** These are pins, not scaffolding — each must end up asserting the inverse so the old behaviour cannot silently return:

| File | Lines | Currently pins | Handled in |
|---|---|---|---|
| `slideDisplay.test.ts` | 446-449 | authored text entry with a body offers the lyrics key | Task 3 |
| `slideDisplay.test.ts` | 451-454 | undefined body + PRAYER offers it | Task 3 |
| `slideDisplay.test.ts` | 456-459 | undefined body + MESSAGE offers it | Task 3 |
| `slideDisplay.test.ts` | 461-468 | the Hymn carve-out, both halves | Task 3 |
| `slideDisplay.test.ts` | 494-497 | undefined planItemKind withholds it | Task 3 |
| `SlideGrid.test.ts` | 1215-1216 | a text card's keys include it, a scripture card's do not | Task 3 |
| `SlideGrid.test.ts` | 1307-1316 | a SONG group's card excludes it | Task 3 |
| `SlideGrid.test.ts` | 1318-1328 | the Hymn carve-out, at the grid level | Task 3 |
| `SlidesTab.test.ts` | 740-750, 752-768 | the lyrics key dispatches mode 'lyrics' | Tasks 2 then 3 |
| `SlidesTab.test.ts` | 728-738, 770-781, 911 | mode 'details' on the other dispatch paths; the stub prop list | Task 2 |
| `EditSlideDrawer.test.ts` | 1652-1737 | the whole per-mode gating block, 8 tests | Task 2 |
| `EditSlideDrawer.test.ts` | 709-714, 743-845, 1405-1413 | ~11 fixtures passing `mode: 'lyrics'` | Task 2 |
| `SlideActionMenu.test.ts` | 6-9, 152-158 | a six-label vocabulary in the overflow backstop | Task 3 |

**Tests that must NOT change, and must stay green — they are the carve-outs D2 does not touch:**
- `EditSlideDrawer.test.ts` 614-624, 716-722, 886-892: parameterised caption/read-only matrices. Every one iterates `lyric`/`copyright`/`scripture`/`imported (text)` fixtures ONLY — none includes an authored-text fixture, so deleting the text branch's caption breaks none of them. Verified by reading each.
- `EditSlideDrawer.test.ts` 1405-1413: no editable textarea for a song group even for a text-kind entry. After this change the textarea renders in the drawer's ONLY body, which makes this the single most important R054 guard in the file. It must keep passing on `canMutate` alone.
- `EditSlideDrawer.test.ts` 842-844: a viewer gets the read-only paragraph, not the textarea.
- `slideDisplay.test.ts` 423-444: the 34-07 scripture-route assertions (label, tone, key order, and "no scripture item mentions lyrics").

**The `mountDrawer` helper is typed** — `EditSlideDrawer.test.ts` line 233, `props: Partial<InstanceType<typeof EditSlideDrawer>['$props']>`. Once the `mode` prop is deleted from the component, every leftover `mode: 'lyrics'` in that file becomes a TypeScript excess-property error. **`npm run type-check` is therefore an exhaustive finder for missed call sites in that file** — lean on it instead of trusting a hand-count. `SlidesTab.test.ts`'s stub at line 908-914 declares props as a plain string array and will NOT error; clean that one by hand.

**Verification commands.** Per `CLAUDE.md` these exact forms are the only correct ones for this repo:
- `npm run type-check` runs `vue-tsc --build`, which typechecks TEST files. `vue-tsc --noEmit -p tsconfig.app.json` silently skips them and is NOT acceptable evidence — five `TS2339` errors once survived two full phases behind that narrower form.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` is the app suite. `npx vitest run src/` pulls in `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch. Bare `npx vitest run` applies a different exclude set. Neither is acceptable here.
- Known-failing BASELINE, not regressions: `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion). Exactly those two failing is a CLEAN run. A third failing file is a real regression.
</interface_context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Render the scripture reference as white slide content (D1)</name>
  <files>src/components/__tests__/PresentationViewer.test.ts, src/components/PresentationViewer.vue</files>

  <behavior>
    Write the test FIRST, watch it fail against the current accent treatment, then make it pass.

    New test added to `src/components/__tests__/PresentationViewer.test.ts`, placed directly after the existing "a normal-mode ScriptureSlide renders reference in presentation-label and the FULL text in presentation-body" test (~line 529). Follow that test's mount style exactly: `mount(PresentationViewer, { props: { slides: [longScriptureSlide('a')] } })` then `await Promise.resolve()`.

    - Test 1 (normal-mode reference): read `body().find('[data-testid="presentation-label"]').classes()` and assert it CONTAINS `text-gray-100`; assert it does NOT contain the accent colour utility, the uppercase utility, or the letter-spacing utility that the element carries today; assert it STILL contains `text-2xl`, `font-semibold` and `mb-8`. The retained trio is the point — a slide carrying both a reference and verse text must keep two readable levels, exactly as the copyright branch does with its `text-6xl` title over its `text-2xl` author line.
    - Test 2 (congregational reference): mount `congregationalScriptureSlide('a', sections)` with the same two-section fixture the neighbouring test at ~531 builds, and assert the SAME class expectations on `presentation-label`. This proves the one edit covers both sub-branches. In the same test, assert that `[data-testid="presentation-speaker-0"]`'s classes are UNCHANGED — it still carries its own accent colour — so a future edit cannot quietly wash out the Leader/Congregation tags on the strength of this fix.

    Assert through the `.classes()` array only, matching the style at line 542-544. Do not assert on raw HTML strings and do not use CSS attribute selectors for the utility names.

    Expected RED before the source edit: `text-gray-100` absent, and the three label utilities present.
  </behavior>

  <action>
    After the test is failing, make ONE class-attribute edit in `src/components/PresentationViewer.vue`.

    Re-read the scripture branch (currently lines 103-140) before editing. On the `<p data-testid="presentation-label">` element that renders `(currentSlide.slide as ScriptureSlide).reference` — currently line 105-110 — replace the class attribute so it reads exactly `class="text-2xl font-semibold leading-[1.3] text-gray-100 mb-8"`. That is: drop the accent text colour, the uppercase utility and the tracking utility per D1; adopt the same neutral content colour every other slide kind uses; carry `text-2xl font-semibold leading-[1.3] mb-8` over verbatim.

    Change NOTHING else in the file. Specifically: do not touch the `presentation-speaker-{idx}` tags at 118-124 (they are speaker labels and are correctly styled as labels), do not touch the verse body at 133-139 (already neutral), do not touch the copyright branch, and do not touch the TextSlide title label in the `slideKind === 'text'` branch at 143-150.

    Add a short comment immediately above the edited `<p>`, inside the scripture branch, recording three things: (a) why the reference is content and not a label — under R047 a scripture slide defaults to reference-only, so this element is frequently the entire visible content of the projected slide; (b) that the size/weight difference against the `text-5xl` body below is deliberately the ONLY hierarchy signal, mirroring the copyright branch's title-over-authors treatment; (c) that the TextSlide title label further down this same file deliberately still carries the label treatment, that the divergence is known and was scoped out of this task by the owner, and that it must not be "fixed" as drive-by cleanup. Keep it to a few lines — do not restate the whole per-kind rendering contract.
  </action>

  <verify>
    <automated>npx vitest run src/components/__tests__/PresentationViewer.test.ts</automated>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts'</automated>
    <human-check>On the Present screen, open a service containing a scripture slide (both a reference-only one and one with verse text if available) and confirm the reference now reads as white slide content in the same treatment as the other kinds, and that a reference-plus-text slide still shows two clear levels rather than one flat block.</human-check>
  </verify>

  <done>
    - The new tests fail before the `PresentationViewer.vue` edit and pass after it (RED observed, then GREEN).
    - `npx vitest run src/components/__tests__/PresentationViewer.test.ts` is fully green, including the pre-existing `presentation-label` TEXT assertions at ~481-497, ~521-529 and ~574-588, and the congregational speaker-class assertions at ~531-544.
    - The congregational assertion proves both scripture sub-branches are covered by the single edit.
    - `npm run type-check` passes. Use this exact command — it runs `vue-tsc --build` and typechecks test files; `vue-tsc --noEmit -p tsconfig.app.json` skips them and is NOT acceptable evidence.
    - `npx vitest run --dir src --exclude '**/rules.test.ts'` shows EXACTLY the two known-baseline files failing (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) and nothing else. A third failing file is a regression from this change.
    - `git status --short` shows only `src/components/PresentationViewer.vue` and `src/components/__tests__/PresentationViewer.test.ts` modified.
    - The TextSlide title label in the `slideKind === 'text'` branch is untouched, and the new comment records that this is deliberate.
    - Committed atomically — this defect is unrelated to D2 and must not share a commit with it.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Give the drawer one body that edits label AND text, and delete the mode prop (D2, part 1 of 2)</name>
  <files>src/components/slides/EditSlideDrawer.vue, src/components/slides/SlidesTab.vue, src/components/slides/__tests__/EditSlideDrawer.test.ts, src/components/slides/__tests__/SlidesTab.test.ts</files>

  <behavior>
    Do the drawer BEFORE the menu cleanup. Ordering matters: this way every intermediate commit is both type-clean and functionally sane. After this task the drawer edits label and text together and the owner's actual ask is satisfied; the second menu key still exists but now opens the identical drawer, which is harmless. Doing it the other way round would leave one commit in which the text is not editable anywhere — a real, if brief, regression.

    Discretion resolved (CONTEXT.md grants the choice and asks that it be stated): **remove the `mode` prop outright.** Keeping it would leave an entire unreachable `lyrics` path — the alternate header title, the `mode === 'lyrics'` template fork, and five permanently-true `mode === 'details'` guards. Removal leaves zero dead branches, which is the stated tie-breaker. It costs more test churn, and `npm run type-check` finds that churn exhaustively (see below), so the cost is bounded and mechanical.

    Second discretion resolved: **delete the text branch's caption entirely** rather than rewording it. Once the field is editable in place there is nothing left for a caption to point at, and CONTEXT.md explicitly allows deletion. The `drawer-slide-text-caption` testid survives on the `lyric`, `copyright`, `scripture` and `imported` branches, which are untouched.

    Behaviour this task must produce, expressed as tests:
    - Test A: for a hand-authored text entry, a drawer mounted with NO extra props renders the `drawer-slide-text-editable` textarea, seeded with the entry's body, alongside `drawer-label-input`, `drawer-audio-section`, `drawer-notes-input` and `drawer-footer-actions` — all five present in ONE body. This is the owner's ask, stated as a single assertion set.
    - Test B: that same drawer renders NO `drawer-slide-text-readonly` and NO `drawer-slide-text-caption` inside the text branch.
    - Test C: the header always reads `Edit Slide Details`, and never the lyrics wording — assert both the positive equality and a negative `not.toContain('Lyrics')`, so the removed title cannot creep back.
    - Test D (viewer): with `isEditor: false`, the same fixture renders the read-only paragraph and no textarea. The gate is `canMutate` and nothing else.
    - Test E (song group): the R054 guard at ~1405 keeps passing with its `mode` argument removed — a text-kind entry inside a SONG group still renders no textarea.
    - Test F: a prop change that is NOT an entry change does not trigger the entry-change flush. The existing test at ~1720 proved this by flipping `mode`; preserve the guard by flipping a different non-entry prop (`position`) instead, keeping its fake-timer/debounce assertions exactly as they are.
  </behavior>

  <action>
    **Step 1 — `src/components/slides/EditSlideDrawer.vue`.** Re-read each region before editing; ten edit sites, all in the same file.

    1. Line 27: replace the interpolated header title with the literal text `Edit Slide Details`. Keep the `<h2>` element, its classes and its `edit-slide-drawer-title` testid unchanged.
    2. Lines 108-111 (Slide Label): change the gate to `canMutate` alone. Update the comment above it — drop the sentence claiming the block is also gated on being in details mode, since there is no longer more than one mode.
    3. Lines 189-219 (the `sourceKind === 'text'` sub-branch): collapse the two-mode fork into a single `canMutate` fork. Keep the textarea exactly as it is today — same `v-model="localBody"`, same `rows`, same class string, same `drawer-slide-text-editable` testid — but hang it off `v-if="canMutate"` directly. Keep the read-only paragraph as its `v-else`, with its existing classes and `drawer-slide-text-readonly` testid. Delete the caption paragraph that currently sits in the details fork. Do not introduce any new element, testid or wrapper. Rewrite the comment above the branch: record that D-13's "the drawer IS its home" exception now applies in the drawer's ONE body; record that 33-UI-SPEC §4's details-vs-lyrics split is superseded by this quick task's D2; and record that this branch is still the only editable one, with `lyric`/`copyright`/`scripture`/`imported` unchanged.
    4. Line 228 (`drawer-audio-section`): reduce the gate to `!isVideo`.
    5. Lines 308-315 (`drawer-background-section`): remove the `v-if` attribute entirely, leaving the div with just its testid. In the comment above, delete the "details mode only" clause but KEEP the whole `★ deliberately NOT wrapped in !isVideo` paragraph verbatim — that rationale is unrelated to modes and is still live.
    6. Line 374 (Notes) and line 389 (`drawer-footer-actions`): reduce both gates to `canMutate`.
    7. Lines 490-498: delete the `mode` prop declaration and its entire doc block.
    8. Line 521: remove `mode: 'details'` from the `withDefaults` object, leaving the other three defaults intact.
    9. Lines 612-621: delete the `drawerTitle` computed and its doc block, plus the section header comment that introduces the mode prop. The doc block currently warns "Do not relabel" about the two fixed names — that warning still applies to the surviving name, so carry a one-line version of it onto the literal in the template rather than losing it entirely.

    Do not touch: the `lyric`, `copyright`, `scripture` or `imported` sub-branches (lines 137-187); the `drawer-edit-scripture-text-btn` control and its emit; `canMutate`/`isSongGroup`; anything in the write path (`scheduleWrite`, `flushField`, `flushAll`, `resetLocalFields`, the three field watchers, `useUnsavedGuard`). The write path was never mode-gated and needs no change — confirm this by reading it, do not modify it.

    **Step 2 — `src/components/slides/SlidesTab.vue`.**

    - Delete the `:mode="drawerMode"` binding at line 42; leave every other binding on the component in place and in order.
    - Delete the `drawerMode` ref at line 273.
    - In `onMenuAction`, make the two edit cases share one body: the existing `edit-details` case label and the second edit case label both fall through to `drawerOpen.value = true` followed by `break`. (The second label is removed entirely in Task 3; leaving it as a fall-through here is what keeps this commit compiling and behaving sanely.)
    - Delete the two `drawerMode.value = 'details'` assignments in the duplicate and delete cases; those cases otherwise keep their pending-action logic exactly as it is.
    - Update the dispatcher doc comment at ~440-456: it currently explains that duplicate and delete open the drawer in details mode because that is where their write paths live. Restate that without the mode concept — the drawer has one body and that is where those paths live. Leave the WR-04 paragraph about `confirmLeavingOpenDrawer` untouched.

    **Step 3 — `src/components/slides/__tests__/EditSlideDrawer.test.ts`.**

    Run `npm run type-check` FIRST, immediately after Steps 1-2. Because `mountDrawer` is typed as `Partial<InstanceType<typeof EditSlideDrawer>['$props']>`, every surviving `mode:` in this file is now a TypeScript excess-property error. Use that error list as the authoritative worklist rather than a hand-count; at planning time it was ~11 `mountDrawer` sites (around lines 711, 756, 764, 782, 796, 811, 829, 842, 1411, 1708) plus one `wrapper.setProps` at ~1727.

    - For every flagged `mountDrawer` call: delete the `mode: 'lyrics'` property and leave every other argument alone. Each of those tests asserts textarea behaviour that now holds in the drawer's only body, so they should go green unchanged.
    - Retitle the two describe/test names that state the control lives in lyrics mode (~709 and ~743) and the explanatory comment at ~270-272 that calls the title mode-bound. Say instead that the drawer has one body.
    - The R054 test at ~1405-1413: drop the `mode` argument and rewrite its comment. It no longer needs to force the one mode that would otherwise show the field; it is now the plain statement that a song group never gets an editable body. Flag in the comment that this test became MORE load-bearing under D2, since the field is no longer hidden behind a mode nobody reaches.
    - Rework the `mode` describe block at 1652-1737 into a "one drawer body" block. Do not delete it wholesale — flip each test:
      - ~1659 (title in details mode): keep, retitle, and add the negative `not.toContain('Lyrics')` assertion from Test C.
      - ~1664 (the lyrics title): flip to its inverse — mount the drawer and assert the header equals `Edit Slide Details` and cannot be made to read anything else. This is the pin that stops the second title returning.
      - ~1669 (context line and preview in both modes): collapse to a single mount, keeping both existence assertions.
      - ~1680 (four sections ABSENT in lyrics mode): flip to Test A — mount an authored-text entry and assert all four sections AND the editable textarea are present together in one body. This is the assertion that directly encodes the owner's ask; make its title say so.
      - ~1688 (four sections present in details mode): keep as-is, retitled.
      - ~1696 (no textarea in details mode, caption instead): flip to Tests A/B — the textarea IS present with the entry's body as its value, and no read-only block and no caption render in the text branch.
      - ~1706 (textarea in lyrics mode): once its `mode` argument is gone this is an exact duplicate of the flipped ~1696. Fold its value assertion into ~1696 and delete it. This is the one deletion in this file, and it is a genuine duplicate rather than an un-pinned behaviour.
      - ~1714 (defaults to details when the prop is omitted): retitle to pin the single-body shape and keep both assertions.
      - ~1720 (mode change without an entry-change flush): apply Test F — keep the fake timers, the label `setValue`, the `not.toHaveBeenCalled()` and the `advanceTimersByTimeAsync(800)` assertions verbatim, and swap the `setProps({ mode: 'lyrics' })` for a `setProps({ position: 4 })`. Replace the title's "mode change" wording with "a non-entry prop change". Keep the header assertion in the middle of the test only if it still makes sense; if not, drop that ONE line and leave the flush assertions, which are the actual guard.
    - Add Test D explicitly if no surviving test covers a viewer against an authored-text fixture; the test at ~842-844 already does, so verify it and add nothing if so.

    **Step 4 — `src/components/slides/__tests__/SlidesTab.test.ts`.**

    - Delete every `expect(drawer.props('mode')).toBe(...)` assertion — five at planning time, around lines 737, 749, 761, 767 and 780. Grep the file to enumerate them rather than trusting those numbers. The surrounding assertions about `open` and `pendingAction` all stay.
    - Remove `'mode'` from the stub component's props array at ~911. That stub declares props as a plain string array, so TypeScript will NOT flag it — this one is by hand.
    - Leave the two tests at ~740 and ~752 in place for now, minus their mode assertions. Task 3 resolves them once the key they dispatch no longer exists.

    Do not remove anything from `slideDisplay.ts` in this task — the menu contract is Task 3's commit.
  </action>

  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/SlidesTab.test.ts</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts'</automated>
  </verify>

  <done>
    - `npm run type-check` passes and reports zero excess-property errors, proving no `mode` argument survives anywhere in the typed test surface. Use this exact command; the `-p tsconfig.app.json` form skips test files and would report clean with leftovers still present.
    - `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/SlidesTab.test.ts` is fully green.
    - The flipped tests assert the INVERSE of what they used to: one drawer body containing label, text, audio, notes and footer actions together; one header title with a negative assertion against the removed one; no caption and no read-only block in the text branch for a mutator.
    - The four carve-out test groups still pass UNCHANGED: the parameterised caption/read-only matrices at ~614-624, ~716-722 and ~886-892 (none of which includes an authored-text fixture); the song-group no-textarea guard at ~1405; the viewer read-only assertion at ~842; and every `scripture` sub-branch assertion including `drawer-edit-scripture-text-btn`.
    - Manual read-back confirms the drawer's `lyric`, `copyright`, `scripture` and `imported` sub-branches are byte-identical to before, and that no line in the write path (`scheduleWrite` / `flushField` / `flushAll` / `resetLocalFields` / the three field watchers) was modified.
    - `npx vitest run --dir src --exclude '**/rules.test.ts'` shows EXACTLY the two known-baseline failures and nothing else.
    - `git status --short` shows only the four files this task names.
    - Committed atomically, separately from Task 1 and Task 3.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Collapse the menu to one edit affordance and remove the dead key (D2, part 2 of 2)</name>
  <files>src/components/slides/slideDisplay.ts, src/components/slides/SlidesTab.vue, src/components/slides/__tests__/slideDisplay.test.ts, src/components/slides/__tests__/SlideGrid.test.ts, src/components/slides/__tests__/SlidesTab.test.ts, src/components/slides/__tests__/SlideActionMenu.test.ts</files>

  <behavior>
    Flip the pinning tests FIRST and watch them fail, then remove the source. Every flipped assertion below moves to an EXACT-list `toEqual`, not a `not.toContain`. A negative containment assertion goes vacuously true the moment the key stops existing and stops guarding anything; an exact list keeps guarding forever.

    - Test A: a hand-authored text entry with a defined body returns exactly `['edit-details', 'duplicate', 'delete']` for a mutator.
    - Test B: a text entry with an undefined body returns that SAME exact list for `PRAYER`, for `MESSAGE`, and for an undefined plan item kind. The three cases that used to diverge now converge — that convergence IS the D2 reversal.
    - Test C (the headline D2 test): a HYMN group's pristine text entry (no `body` key at all) and a hand-added blank one (`body: ''`) return IDENTICAL lists. Title it so a reader knows the Hymn carve-out was removed deliberately and by whose authority.
    - Test D: for a text entry, no returned item's label matches `/lyric/i`, for both `canMutate` values — mirroring the existing scripture guard at ~436-444.
    - Test E: the scripture list is unchanged — `['edit-details', 'edit-in-scripture', 'duplicate', 'delete']` for a mutator (D3, must not move).
    - Test F: the SONG-group list is unchanged — exactly `['edit-details', 'edit-in-song']` (R054/P-03, must not move).

    Verify each dead item is genuinely unreferenced before deleting it. Do not delete on assumption: search the whole `src/` tree for each of the union member, the label string, the dispatch case and the discriminator, confirm the only remaining references are the ones this task is removing, and only then remove them.
  </behavior>

  <action>
    **Step 1 — flip the tests, and watch them fail.**

    `src/components/slides/__tests__/slideDisplay.test.ts` (the `slideActionMenuItems` describe block):
    - ~446-449: change to Test A's exact list.
    - ~451-454 and ~456-459: change both to Test B's exact list, and note in one of the titles that the plan-item-kind branch of the old discriminator is gone.
    - ~461-468: rewrite as Test C. Both fixtures stay (`makeMenuEntry({ kind: 'text' })` and `makeMenuEntry({ kind: 'text', body: '' })`) — assert both lists equal the same exact array, and assert they equal each other. Retitle to name the D2 reversal.
    - ~494-497: rewrite as Test B's undefined-plan-item-kind case, retitled to say the parameter is no longer consulted by this branch.
    - Add Test D as a new test next to the existing scripture equivalent at ~436-444.
    - Leave ~423-444, ~470-478, ~480-492, ~499-502 and ~504-537 alone; they cover scripture, imported, video, the unknown-kind backstop, non-emptiness and tones, and none of them changes.

    `src/components/slides/__tests__/SlideGrid.test.ts`:
    - ~1215-1216: change the text card's assertion to Test A's exact list via `toEqual`. Delete the immediately following scripture negative assertion — it becomes vacuous once the key does not exist, and the very next line already asserts the scripture card positively contains its own route key. Note the deletion reason in the test body or its title so it does not look like a dropped guard.
    - ~1307-1316: change to Test F — assert the SONG-group card's keys equal exactly `['edit-details', 'edit-in-song']`. That single exact list subsumes all three of the current negative assertions and cannot go vacuous.
    - ~1318-1328: rewrite as Test C at the grid level — both HYMN cards' key lists are identical and equal the exact three-item list. Retitle to name the reversal.

    `src/components/slides/__tests__/SlidesTab.test.ts`:
    - The test at ~740 dispatches the removed key from the grid. Delete it: the key no longer exists in `MenuItemKey`, and its inverse is pinned much more strongly at the source by the exact-list assertions above. State that reasoning in a short comment where it sat, so a later reader does not think a guard was silently dropped.
    - The test at ~752 exists to prove the drawer stays OPEN across two consecutive menu dispatches on the SAME entry — a guard that has nothing to do with which keys those were. Keep it: change both dispatches to `edit-details` and retitle it accordingly. Do not delete it.
    - Leave the `edit-details`, duplicate, delete, `edit-in-song` and `edit-in-scripture` dispatch tests alone.

    `src/components/slides/__tests__/SlideActionMenu.test.ts`:
    - Remove the lyrics label from the `ALL_LABELS` array at ~9 and update the comment above it. Update the backstop test's comment at ~154-156, which says "all six fixed labels" — it is five now. The numeric assertion at ~157 is unaffected; the longest word is unchanged.

    Run the three affected suites and CONFIRM RED before touching source.

    **Step 2 — remove the source, after verifying each item is unreferenced.**

    `src/components/slides/slideDisplay.ts`:
    - Remove the lyrics member from the `MenuItemKey` union at 16-23.
    - Remove its row from `MENU_ITEM_LABELS` at 231-243. `MENU_ITEM_LABELS` is typed `Record<MenuItemKey, string>`, so leaving the row would fail typechecking — a useful forcing function; let it fire rather than pre-empting it.
    - In the `text` branch at 321-328, delete both the `hasBody` local and the `offersEditLyrics` local along with the push they guarded. The branch keeps its `edit-details` item and its `canMutate`-gated duplicate/delete pair.
    - KEEP `case 'text'` as its own branch even though it now returns the same list as the imported/video branch. Add a one-line comment saying it is kept separate deliberately, because `text` is the one kind whose body the drawer edits and whose contract is the likeliest to diverge again. Do not merge the cases.
    - KEEP the `planItemKind` parameter. It is now unconsulted, but removing it would churn eight call sites for no behavioural gain, the root tsconfigs do not set `noUnusedParameters`, and this repo's ESLint runs the default `args: 'after-used'`, under which an unused parameter followed by a used one is not reported. Add a comment recording that it is retained deliberately as part of R063's signature and is currently unconsulted. If `npm run type-check` or the linter DOES flag it, prefix the parameter name with an underscore rather than changing the signature's arity.
    - Rewrite the doc comment at 258-302. Delete the `★ The Hymn discriminator (§3 row 3a)` paragraph at 274-286 outright — it asserts a rule the code will no longer follow, and leaving it is worse than leaving nothing. In its place record: that this quick task's D2 reverses it on the owner's explicit authority; the owner's verbatim reasoning that only Song should be non-editable and that Hymn is a temporary item type; that every `text` entry now gets an editable body including a HYMN group's auto-derived pristine slide; that such a slide can therefore diverge from its Service Order Hymn fields and the owner accepts that as temporary; and that 33-UI-SPEC §3 row 3a and §4 are superseded to that extent. Also fix the item-order sentence at ~264 and the `★ Backstops` paragraph at 287-295, both of which name the removed key. In the P-03 paragraph at 296-302, keep the prohibition intact but restate it in terms of what those two branches DO return, since the removed key can no longer be named as something withheld — and state that R054/P-03 is explicitly NOT dropped by D2.

    `src/components/slides/SlidesTab.vue`:
    - Delete the now-unreferenced second case label from `onMenuAction`'s switch, leaving `edit-details` as the sole edit-drawer branch.
    - Update the dispatcher doc comment at ~440-456 where it says two edit keys touch `drawerOpen` — it is one now.
    - Confirm the `MenuItemKey` type import at ~126 is still needed (it is; `onMenuAction`'s parameter is typed with it) and leave it.

    **Step 3 — surface the known inconsistency to the owner.** In the SUMMARY, and again in the final message to the owner, raise this explicitly as an open item rather than burying it: `PresentationViewer.vue` line 146 is a SECOND `presentation-label`, carrying a TextSlide's title. After Task 1 the two labels diverge — a scripture reference now renders as white slide content while a text slide's title still renders in the accented uppercase label treatment. CONTEXT.md scoped this out because the owner reported scripture only, so it was deliberately NOT changed. Ask directly whether the text-slide title should follow, and note that Task 1 left a code comment at the scripture branch recording the divergence so it is not "fixed" by accident later. Do not change line 146 in this task.
  </action>

  <verify>
    <automated>npx vitest run src/components/slides/__tests__/slideDisplay.test.ts src/components/slides/__tests__/SlideGrid.test.ts src/components/slides/__tests__/SlideActionMenu.test.ts src/components/slides/__tests__/SlidesTab.test.ts</automated>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts'</automated>
    <human-check>In the running app, open a service in the editor and go to the Slides tab. On a Prayer item's slide, confirm the 3-dot menu now offers only Edit details (plus Duplicate and Delete), that Edit details opens a drawer where BOTH the Slide Label and the Slide Text are editable and both persist, and that a scripture slide's menu is unchanged. On a Song group's slide, confirm the menu still offers only Edit details and Edit in song, with no editable text.</human-check>
  </verify>

  <done>
    - The flipped tests were RED before the source removal and are GREEN after it.
    - Every flipped menu assertion uses an exact-list `toEqual` rather than a negative containment check, so it keeps guarding after the key ceases to exist.
    - Each removed item was confirmed unreferenced across `src/` BEFORE deletion — the union member, its label row, the dispatch case and the discriminator locals — not deleted on assumption.
    - `npm run type-check` passes with the exact command (`vue-tsc --build`). In particular `MENU_ITEM_LABELS` still satisfies `Record<MenuItemKey, string>`, and the `planItemKind` parameter does not produce an error; if it did, it was underscore-prefixed rather than removed.
    - The D3 carve-out holds: a scripture entry still returns `['edit-details', 'edit-in-scripture', 'duplicate', 'delete']` for a mutator, with `edit-in-scripture` labelled "Edit scripture text" at the default tone.
    - The R054/P-03 carve-out holds: a SONG group's lyric/copyright entry returns exactly `['edit-details', 'edit-in-song']`, and the doc comment says in so many words that D2 does not drop this.
    - No comment anywhere in `slideDisplay.ts` still asserts the Hymn carve-out; the reversal, its authority and its accepted consequence are recorded where that paragraph used to be.
    - `npx vitest run --dir src --exclude '**/rules.test.ts'` shows EXACTLY `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` failing and nothing else. Any third failing file is a regression from this change.
    - `git status --short` shows only the six files this task names.
    - The `PresentationViewer.vue` line 146 inconsistency is written into the SUMMARY as an open question AND raised in the final message to the owner. Line 146 itself is unmodified.
    - Committed atomically, separately from Tasks 1 and 2.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor → Firestore slide-entry write | The drawer's `body` field now reaches a mutation surface for a class of entries (HYMN-group auto-derived text slides) that previously could not be edited from here. The write path itself is unchanged; only the set of entries whose textarea renders widens. |
| viewer / locked-service editor → drawer | The read-only vs editable decision for slide text now rests on `canMutate` ALONE, where it previously required both `canMutate` and a mode the menu had to grant. One condition removed from a gate is the risk shape of this change. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bvo-01 | Elevation of Privilege | `EditSlideDrawer.vue` text branch — the textarea's render gate | high | mitigate | The textarea moves from `mode === 'lyrics' && canMutate` to `canMutate` alone. If `canMutate` were also loosened or the `v-else` read-only paragraph dropped, a viewer or a locked-service editor would gain an editable field. The plan forbids touching `canMutate`, `isSongGroup`, `isEditor` or `serviceLocked`, keeps the `v-else` paragraph, and re-runs the viewer guard at `EditSlideDrawer.test.ts` ~842 and the locked-service assertions as part of Task 2's gate. Task 2's Test D pins the viewer case explicitly. |
| T-bvo-02 | Elevation of Privilege | `slideDisplay.ts` `slideActionMenuItems` — the SONG carve-out | high | mitigate | R054/P-03 keeps `lyric` and `copyright` entries read-only, and D2 explicitly does NOT drop it. Both branches return before `canMutate` is ever consulted. Task 3 converts the SONG-group grid test from three negative containment checks to one exact-list `toEqual(['edit-details', 'edit-in-song'])`, which cannot go vacuous when a key is removed — strictly stronger than what it replaces. `EditSlideDrawer.test.ts` ~1405 independently guards the drawer side. |
| T-bvo-03 | Tampering | HYMN-group auto-derived text slides | medium | accept | D2 knowingly enables an editable shadow copy: a hymn slide edited in the drawer can diverge from its Service Order Hymn fields. This is the owner's explicit, recorded decision — *"Hymns are a special thing for now only"* — accepted as temporary until HYMN stops being a distinct item type. Mitigation is documentary, not technical: Task 3 replaces the stale anti-shadow-copy comment with the reversal, its authority and its accepted consequence, so the next reader is not misled into "restoring" the old rule. |
| T-bvo-04 | Tampering | Test suite integrity across all six touched test files | medium | mitigate | The largest realistic failure mode is quietly weakening the suite — deleting a pin instead of flipping it, or flipping it to an assertion that goes vacuous once the key is gone. The plan enumerates every affected assertion by file and line, mandates exact-list `toEqual` over negative containment, justifies each of the two deletions individually (one exact duplicate, one vacuous check whose neighbour already asserts the positive), and requires RED-before-GREEN on every flip. |
| T-bvo-05 | Information Disclosure | `PresentationViewer.vue` scripture branch | low | accept | A projector-facing colour/typography change. No new value is rendered, no branch is added or removed, and the `v-if`/`v-else` structure around `isCongregational` is untouched. Task 1's congregational test asserts the Leader/Congregation speaker tags keep their own distinct treatment, so the fix cannot wash out the speaker distinction as a side effect. |
| T-bvo-SC | Tampering | npm/pip/cargo installs | low | accept | This plan performs no package-manager installs and modifies no `package.json` or lockfile. No Package Legitimacy Audit is required and no install checkpoint is warranted. |
</threat_model>

<verification>
Run these EXACT commands — per `CLAUDE.md` these are the only correct forms for this repo:

1. `npm run type-check` — runs `vue-tsc --build`, which typechecks TEST files as well as `src/`. Never substitute `vue-tsc --noEmit -p tsconfig.app.json`; it silently skips test files and has previously reported clean while five `TS2339` errors survived two full phases. In Task 2 this command doubles as the exhaustive finder for leftover `mode` arguments in the typed `EditSlideDrawer` test surface.
2. `npx vitest run --dir src --exclude '**/rules.test.ts'` — the app suite. A run showing EXACTLY `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion) failing is CLEAN — those are the known baseline, not regressions. A third failing file is a real regression from this work. Do NOT use `npx vitest run src/` (it pulls in `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch) and do NOT use bare `npx vitest run`.
3. Per-task targeted runs as listed in each task's `<verify>` block, for a fast inner loop before the full suite.
4. `git status --short` after each task — the touched files must match exactly the `<files>` list for that task and nothing else.
5. Owner confirmation of both defects in the running app (the `<human-check>` items in Tasks 1 and 3), plus an answer on the `PresentationViewer.vue` line 146 open question surfaced by Task 3.

Rules tests (`npm run test:rules`) are NOT required: this work touches no Firestore rule, changes no document shape, and adds no new write path — the `body` field was already written through the identical debounced path.
</verification>

<success_criteria>
- A scripture slide's reference on the Present screen renders `text-2xl font-semibold leading-[1.3] text-gray-100 mb-8` — white slide content with its size/weight hierarchy retained — in both the normal and congregational sub-branches.
- The Leader/Congregation speaker tags, the verse body, the copyright branch and the TextSlide title label are all unchanged.
- A regression test pins the scripture reference's class list and failed before the source edit.
- A non-song slide's 3-dot menu offers exactly `edit-details` plus, for a mutator, `duplicate` and `delete` — pinned by exact-list assertions in both `slideDisplay.test.ts` and `SlideGrid.test.ts`.
- "Edit details" opens a drawer whose single body edits BOTH the slide label and the slide text, and both persist through the pre-existing debounced write path.
- A HYMN group's auto-derived pristine text slide gets the same menu and the same editable body as a hand-added one; no comment in the codebase still asserts the removed Hymn carve-out, and the reversal is recorded with its authority and its accepted consequence where that comment used to be.
- R054/P-03 holds: a SONG group's lyric/copyright entries return exactly `['edit-details', 'edit-in-song']` and get no editable body.
- D3 holds: a scripture entry's menu is byte-identical to before, and `drawer-edit-scripture-text-btn` still emits.
- A viewer, and an editor on a locked service, still get a read-only text block — `canMutate` is the only gate and was not loosened.
- The drawer has one body and no `mode` prop; `SlidesTab` has no `drawerMode` state; the removed menu key, its label row, its dispatch case and its discriminator are all gone, each verified unreferenced before removal.
- `npm run type-check` clean; app suite at the known 2-file baseline; three atomic commits, one per task.
- The `PresentationViewer.vue` line 146 divergence is surfaced to the owner as an open question, with line 146 itself unmodified.
</success_criteria>

<output>
Create `.planning/quick/260805-bvo-scripture-slide-text-renders-as-blue-lab/260805-bvo-SUMMARY.md` when done.
</output>
</content>
</invoke>
