---
phase: quick-260805-kzd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/__tests__/PresentationViewer.test.ts
  - src/components/PresentationViewer.vue
  - .planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md
autonomous: true
requirements:
  - QUICK-260805-kzd

must_haves:
  truths:
    - "A projected scripture slide shows its reference as ordinary white slide content at the same size as song lyrics — no label sizing, no label identity (D1)"
    - "A scripture slide whose passage text has not been fetched yet (text: '') still projects its reference visibly — the slide is never blank (D1, the hazard this decision exists to prevent)"
    - "A projected Message/Prayer slide shows its body text and nothing else — the blue uppercase title heading is gone from the projection (D2)"
    - "A TextSlide still keeps its title field for the slide grid; only the projection stops rendering it (D2)"
    - "Congregational speaker tags still read 'Leader:' / 'Congregation:' as slide content, but in the same white text-5xl treatment as everything else — no accent colour, no uppercase, no letter-spacing (D3)"
    - "The presentation-speaker-{idx} testids survive so the follow-up congregational-split phase has stable anchors (D3)"
    - "Every projected text element across lyric, scripture (reference AND passage), congregational speaker tags, and text slides renders at text-5xl — one size, proven per kind by assertion rather than by eye"
    - "No code comment in PresentationViewer.vue still asserts the size/weight hierarchy rule that D1 supersedes"
    - "No test in the suite went vacuously true: every replaced assertion is a positive claim about what SHOULD render, or a negative paired with the positive it guards"
  artifacts:
    - path: "src/components/PresentationViewer.vue"
      provides: "Scripture reference rendered as body-treatment slide content under its own testid; TextSlide title projection deleted; speaker tags unified to the body treatment"
      contains: "presentation-scripture-reference"
    - path: "src/components/__tests__/PresentationViewer.test.ts"
      provides: "Flipped pins for every removed behaviour, plus the empty-text scripture regression test and the per-kind unified-size assertions"
      contains: "presentation-scripture-reference"
  key_links:
    - from: "ScriptureSlide.reference"
      to: "a visible projected element even when ScriptureSlide.text is the empty string"
      via: "an unconditional <p> in the scripture branch above the isCongregational fork, carrying the body class list"
      pattern: "presentation-scripture-reference"
    - from: "CongregationalSection.speaker"
      to: "the words 'Leader:' / 'Congregation:' still rendered per section"
      via: "the surviving presentation-speaker-{idx} span, with its :class accent binding removed but its text expression intact"
      pattern: "presentation-speaker-"
---

<objective>
Remove all label/header text from projected slides and unify every projected text element to one size — the Song-lyrics treatment.

Owner verbatim: *"Slides don't actually need labels. They are never used. We want slide text to be consistent in size. Make slide text size the same size as we have for Song lyrics; scripture is really small right now. If you look at the Message and the Prayer items in the slide show, you'll see they both show a blue Message and Prayer respectively, then the white text. We just want the white text. No label/header text in these items."*

Three decisions, all owner-locked in CONTEXT.md:

1. **D1 — the scripture reference becomes body content, always.** Not deleted: `slideshowAssembler.ts:152` and `:409` both build scripture slides with `text: ''`, so the reference is frequently the *entire* visible content of the slide. Deleting it would project a blank slide. It loses the label identity and label sizing and gains the body treatment.
2. **D2 — the TextSlide title heading is deleted outright.** The blue uppercase "Message" / "Prayer" is exactly what the owner pointed at. No replacement, no restyle. The `title` field stays on the type and keeps serving the slide grid.
3. **D3 — the congregational speaker tags are restyled now, not deferred.** They lose the accent colours, `uppercase` and `tracking-wider`, and match the body. **The words stay** — "Leader:" / "Congregation:" is content the owner wants, and the elements keep their testids so the follow-up congregational-split phase has stable anchors.

Purpose: the projected screen is the product here. Mixed sizes and coloured headings read as chrome on a projector, and the owner reports never using them.

Output: one component file changed, its test file flipped and extended, and one stale planning citation marked superseded.

**Explicitly NOT in scope — do not widen:**
- `src/utils/slideshowAssembler.ts`, `src/utils/scriptureSplitter.ts`, the `ScriptureSlide`/`TextSlide` model in `src/types/slide.ts`, `SlideCard.vue`'s kind eyebrow, and the 3-dot menu / `slideDisplay.ts`. All belong to the congregational-split phase.
- The congregational-split feature itself (per-section slides, editable/deletable after splitting). It is a data-model change with its own phase.
- The copyright branch's `text-6xl` title / `text-2xl` author lines. CONTEXT.md's discretion default is **leave them alone** — a credits card is a different layout from projected reading text, and the owner reported no problem with it. Say so in the SUMMARY rather than silently widening scope.
- The congregational section-text span's LEADER/CONGREGATION differentiation (`font-semibold` vs `font-normal pl-8`, `text-gray-100` vs `text-gray-300`). D3 grants discretion and calls retention fine; it is already `text-5xl`, so the size is already unified. Leave it byte-unchanged and state that in the SUMMARY.
- No `.env.local` change, no `firebase deploy`, no project-wide `lint --fix`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260805-kzd-remove-slide-labels-unify-slide-text-size/260805-kzd-CONTEXT.md

@src/components/PresentationViewer.vue
@src/components/__tests__/PresentationViewer.test.ts
</context>

<interface_context>

All line numbers below were re-verified against live source on 2026-08-05, by reading the regions rather than trusting CONTEXT.md's table. They still drift — re-read each region before editing it.

## The four edit sites in `src/components/PresentationViewer.vue`

| Lines | What | Disposition |
|---|---|---|
| 74-79 | Lyric body `<p data-testid="presentation-body">`, class `text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]` | **The reference treatment.** Unchanged — everything else converges on it. |
| 105-115 | The stale comment left by quick task `260805-bvo`, inside the scripture branch. Its middle sentence claims the size/weight step against the body is the ONLY intended hierarchy signal; its last sentence records that the TextSlide title's divergent label treatment was scoped out and "must not be fixed as drive-by cleanup". | **Delete.** D1 supersedes the first claim; D2 removes the element the second refers to. Leaving it would have the file assert a rule the code no longer follows. Deleting it is part of the work, not optional cleanup. |
| 116-121 | Scripture reference `<p>`, currently `data-testid="presentation-label"`, class `text-2xl font-semibold leading-[1.3] text-gray-100 mb-8`. **No `v-if`** — it already always renders, which is what makes the empty-text case survivable. It sits ABOVE the `isCongregational` fork, so one edit covers both scripture sub-branches. | **Retestid + restyle (D1).** |
| 129-135 | Congregational speaker `<span :data-testid="\`presentation-speaker-${idx}\`">`, class `text-2xl font-semibold leading-[1.3] uppercase tracking-wider mr-4`, plus a `:class` binding selecting `text-indigo-300` (LEADER) or `text-amber-300` (CONGREGATION). Text expression renders `Leader:` / `Congregation:`. | **Restyle (D3):** drop the `:class` binding entirely, unify the static class. Keep the element, the testid and the words. |
| 136-141 | Congregational section text `<span>`, `text-5xl leading-[1.4]` + the gray-100/semibold vs gray-300/normal/pl-8 binding | **Unchanged** (discretion, already text-5xl). |
| 144-150 | Scripture non-congregational body `<p data-testid="presentation-body">` — already the exact body class list | **Unchanged.** |
| 155-161 | TextSlide title `<p v-if="(currentSlide.slide as TextSlide).title" data-testid="presentation-label" class="text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8">` | **Delete the whole element (D2).** |
| 162-167 | TextSlide body `<p data-testid="presentation-body">` — already the exact body class list | **Unchanged.** |

`presentation-label` appears exactly twice in the component (116-121 and 155-161) and nowhere in its `<script>` block — no computed, no aria reference, nothing else to unwind. `TextSlide` and `ScriptureSlide` type imports both stay in use after the deletion (lines 149 and 166 keep them).

**The only other `<p>` inside `[data-testid="presentation-slide"]`** is the media-unavailable notice at 222-228, gated `v-if="mediaFailed"`. For any fixture without media it does not render — which is what makes the paragraph-count assertions in Task 1 safe and stable.

## Why the reference gets a NEW testid rather than `presentation-body`

D1 says the reference is body content, but it must NOT reuse `data-testid="presentation-body"`: a normal-mode scripture slide would then have TWO elements with that testid, and `wrapper.find()` returns the FIRST match. Every existing assertion reading `[data-testid="presentation-body"]` on a scripture slide — including the exact-equality full-text assertion at test line 528 — would silently start reading the reference instead of the passage. That is a test-integrity failure disguised as a passing suite.

Use **`data-testid="presentation-scripture-reference"`**. It satisfies "no `presentation-label` element exists anywhere", keeps the passage assertions honest, and gives the new regression tests a positive anchor.

## Every existing test that pins the behaviour being removed — enumerated

`src/components/__tests__/PresentationViewer.test.ts` is the ONLY test file that asserts on any of this. Verified: `presentation-label` / `presentation-speaker` / `presentation-body` appear in exactly two files across `src/` — the component and this test file. `src/views/__tests__/ServiceEditorView.test.ts` stubs `PresentationViewer` at every mount site (a template stub or `true`) and asserts only props and mount/unmount, so it is unaffected. `src/utils/__tests__/congregationalReadingPipeline.test.ts` deliberately *restates* the `isCongregational` predicate instead of mounting the component, and `isCongregational` is not being changed, so it is unaffected too.

| # | Lines | Test | Currently pins | Why it must change |
|---|---|---|---|---|
| T-a | 481-489 | R059: LyricSlide renders no sectionLabel in presentation-label | `presentation-label` does not exist | Goes vacuously true once no such testid exists anywhere. R059's real claim — the section label is not projected — must be re-expressed positively. |
| T-b | 491-501 | R059: empty-string sectionLabel still renders no label element | same | same |
| T-c | 521-529 | normal-mode ScriptureSlide renders reference in presentation-label + FULL text in body | reference text via `presentation-label`; passage via `presentation-body` with an exact `toBe` on 400+ chars | Testid changes. The passage half is load-bearing and must survive byte-for-byte in meaning. |
| T-d | 531-543 | D1: reference as white slide content, not an accented label | `.classes()` contains `text-2xl`, `font-semibold`, `mb-8` | `text-2xl` and `font-semibold` are exactly the label sizing D1 removes. |
| T-e | 545-566 | D1: congregational reference + speaker tags keep their accents | reference classes as above, AND `presentation-speaker-0` contains `text-indigo-300`, `uppercase`, `tracking-wider` | The speaker half pins precisely what D3 deletes. |
| T-f | 568-589 | congregational two-section blocks render with the correct classes | `presentation-speaker-0` contains `text-indigo-300`; `presentation-speaker-1` contains `text-amber-300` | Same — D3 deletes both accents. The `'Leader:'` / `'Congregation:'` text assertions and the `pl-8` assertion must be KEPT. |
| T-g | 611-619 | TextSlide with a title renders it in presentation-label | the title IS projected | D2 makes this false by design. |
| T-h | 621-629 | TextSlide without a title renders only the body | `presentation-label` does not exist | Vacuous after D2 — it would pass for a titled slide too. |
| T-i | 642-652 | angle-bracket markup renders literally, not as child elements | `slideContainer.text()` contains `<script>alert(1)</script>` — which reaches the DOM **through the TextSlide title** (`markupSlide` at 179-193 puts the script payload in `title`, the bold/italic payload in `body`) | **This is the sharp edge.** Once D2 stops projecting the title, line 650 fails and the escaping proof for that payload evaporates. The XSS-escaping guarantee must be preserved, not dropped. |

Tests 1356-1364 (congregational sections render over a background) assert only section existence — unaffected. `slideText()` assertions at 265 and 1051 read text that still renders after the change (`'Romans 8:28-30'` moves from the label element to the reference element; the text-slide body is untouched).

## Fixtures already in the file — reuse, do not write new ones

`lyricSlide(id)` (sectionLabel `'Verse 1'`), `scriptureSlide(id)` (reference `'Romans 8:28-30'`, non-empty text, readingMode `'normal'`), `longScriptureSlide(id)` (reference `'John 3:16'`, 400+ char text), `congregationalScriptureSlide(id, sections)` (reference `'Psalm 136:1-4'`), `textSlide(id, title?)` (body `'Please stand for the reading of the Word.'`), `markupSlide(id)`, `copyrightSlide(id)`, `imageSlide(id)`, `withBackground(...)`.

Two mechanics of this suite that the new tests must respect:
- The component renders through `<Teleport to="body">`, so every assertion goes through the `body()` `DOMWrapper` helper, never through the mount wrapper's own tree.
- `enableAutoUnmount(afterEach)` cleans up between tests but NOT within one. **One mount per `it`.** Two mounts in a single test put two viewers in `document.body` and `find()` silently returns the first — so comparisons like "titled and untitled render the same" must be expressed as structural assertions inside separate tests, not as two mounts in one.

## The stale planning citation

`.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md:263-265` states that the scripture branch's `presentation-label` and the text branch's `presentation-label` "are NOT organizational labels — they are the slide's actual content — and are out of scope for R059. Do not remove them". Half of that survives (the scripture reference IS content and is kept, restyled); half is reversed by D2. CONTEXT.md asks that the supersession be recorded where the citation lives rather than left stale. Grep confirms `35-UI-SPEC.md` is the ONLY UI-SPEC across all phases that mentions these testids — `33-UI-SPEC.md` does not.

## Verification commands — use these exact forms

- `npm run type-check` runs `vue-tsc --build`, which typechecks TEST files as well as `src/`. `vue-tsc --noEmit -p tsconfig.app.json` silently skips them and is NOT acceptable evidence — five `TS2339` errors once survived two full phases behind that narrower form.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` is the app suite. Do NOT use `npx vitest run src/` (substring-matches `render-service/src/render.test.ts` and dies on a Vitest version mismatch) and do NOT use bare `npx vitest run` (different exclude set).
- Known-failing BASELINE, not regressions: `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion). **Exactly those two failing is a clean run. A third failing file is a real regression and must be fixed, not excused.**
- Fast inner loop: `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — a full path matches only that file and is safe from the substring problem.
- `npm run test:rules` is NOT required: no Firestore rule, document shape or write path is touched.
</interface_context>

<tasks>

<!-- planner-discipline-allow: presentation-label -->
<!-- planner-discipline-allow: hierarchy signal -->

<task type="auto" tdd="true">
  <name>Task 1: Flip every pinning test to the new contract and add the empty-scripture + unified-size regressions (RED)</name>
  <files>src/components/__tests__/PresentationViewer.test.ts</files>

  <behavior>
    Write the tests FIRST and confirm they are RED before any component edit. Every rewrite below states a POSITIVE claim about what should render. Where a negative is used it is paired with the positive it guards, and it is a negative about *rendered content* (e.g. the word "Message" is not on the projected slide), never about a testid's absence — a testid-absence check goes vacuously true the moment the testid stops existing anywhere and stops guarding anything.

    **Rewrites of existing tests (T-a … T-i in the interface context, all line numbers to be re-verified by reading):**

    - **T-a (481-489)** — retitle to say the section label is not projected. Replace the testid-absence check with two assertions: `expect(slideText()).not.toContain('Verse 1')` (the fixture's `sectionLabel`, so this is a real claim about R059), and `expect(body().find('[data-testid="presentation-slide"]').findAll('p')).toHaveLength(1)` — a lyric slide projects exactly one paragraph. Keep both existing body-text `toContain` assertions.
    - **T-b (491-501)** — the empty-string variant. `''` cannot be searched for, so the guard here is structural: keep the one-paragraph assertion and both body-text assertions, and retitle to say an empty section label adds no element.
    - **T-c (521-529)** — retitle away from the label wording. Read the reference from `[data-testid="presentation-scripture-reference"]` and keep `toBe('John 3:16')`. **Keep the passage half exactly as it is**, including `text.length > 400` and the exact `toBe` on the repeated string — that assertion is the proof the new testid did not shadow the body element.
    - **T-d (531-543)** — retarget to `presentation-scripture-reference` and invert the sizing expectations: `.classes()` CONTAINS `text-gray-100`, `text-5xl`, `font-normal`, `leading-[1.4]`, `whitespace-pre-line`, `mb-8`; and does NOT contain `text-2xl`, `font-semibold`, `text-indigo-400`, `uppercase`, `tracking-wider`. Retitle to state the reference now renders in the same treatment as song lyrics.
    - **T-e (545-566)** — keep the two-section fixture. Assert the same reference class expectations as T-d. Then invert the speaker half: `presentation-speaker-0`'s `.classes()` CONTAINS `text-gray-100`, `text-5xl`, `font-normal`, `leading-[1.4]` and does NOT contain `text-indigo-300`, `uppercase` or `tracking-wider`; and `expect(leaderTag.text()).toBe('Leader:')` — the words survive the restyle, which is the D3 claim most at risk of being over-applied into a deletion. Retitle accordingly.
    - **T-f (568-589)** — KEEP the two section-existence assertions, both `.text()` assertions (`'Leader:'`, `'Congregation:'`) and the `pl-8` assertion on section 1 verbatim. Replace the two accent-colour `toContain` checks with one stronger positive: `expect(leaderTag.classes().slice().sort()).toEqual(congregationTag.classes().slice().sort())` — the two tags now carry an identical class list, which is precisely "the accent differentiation is gone" stated as an equality rather than as two absences. Add `expect(leaderTag.classes()).toContain('text-5xl')` so the shared list is pinned to the right treatment and not merely to sameness.
    - **T-g (611-619)** — rewrite as the D2 test. Mount `textSlide('a', 'Message')`. Assert the body text still renders via `presentation-body`; assert `expect(slideText()).not.toContain('Message')` (a real claim: that word is the fixture's title and must not reach the projector); and assert exactly one `<p>` inside `presentation-slide`. Retitle to say a text slide projects its body and never its title.
    - **T-h (621-629)** — rewrite as the untitled counterpart: same one-paragraph structural assertion and the same body-text assertion, retitled to say a titled and an untitled text slide now project identically. Do not attempt to mount both in one test (see the one-mount-per-`it` rule above); the identical structural assertions across the two tests are the comparison.
    - **T-i (642-652)** — the XSS-escaping proof must be PRESERVED, not dropped. Move the script payload into the projected field: change `markupSlide`'s `body` (fixture at 179-193) to carry both payloads, e.g. `'<script>alert(1)</script> <b>bold</b> & <i>italic</i>'`, leaving its `title` in place so the fixture also exercises a title that is not projected. Keep all five existing assertions unchanged — they now prove escaping through the body element. Add one line asserting the title payload is still absent from the rendered slide only if the title string differs from the body string; with the fixture above the `<script>` literal appears in both, so do NOT add a contradictory assertion.

    **New tests to add:**

    - **N-1 — the D1 blank-slide regression (the hazard nothing currently guards).** Build a scripture fixture with an EMPTY passage: take `scriptureSlide('a')` and set `(slide.slide as import('@/types/slide').ScriptureSlide).text = ''`, matching the in-file cast style used at line 493. Assert: `body().find('[data-testid="presentation-scripture-reference"]').text()` is `'Romans 8:28-30'`; the reference element's classes contain `text-gray-100` and `text-5xl`; and `expect(slideText().replace(/\s+/g, ' ').trim()).toBe('Romans 8:28-30')` — the reference is the slide's ENTIRE visible content and the slide is not blank. Title it so the next reader knows why it exists: the assembler builds scripture slides with `text: ''` and a reference-only slide must still project something.
    - **N-2 — unified size, asserted per kind.** One `it` per kind (one mount each, per the teleport rule), each asserting `.classes()` contains `text-5xl`: lyric `presentation-body`; normal-mode scripture `presentation-scripture-reference` AND `presentation-body`; congregational scripture `presentation-scripture-reference` AND `presentation-speaker-0`; text-slide `presentation-body`. Group them in a `describe` block naming the decision. **Do not include the copyright branch** — it is deliberately out of scope, and a comment on the describe block must say so, or a later reader will read its omission as an oversight.

    Expected RED before the component edit, and worth checking that each failure is the EXPECTED one rather than a typo: the `presentation-scripture-reference` finds return empty wrappers; the class expectations still see `text-2xl`/`font-semibold`/`text-indigo-300`; the text-slide tests see `'Message'` in the slide text and two paragraphs; the lyric one-paragraph counts already pass (R059 removed that label in Phase 35) and that is fine — they are being made non-vacuous, not newly satisfied.
  </behavior>

  <action>
    Edit `src/components/__tests__/PresentationViewer.test.ts` only. Re-read each region named above before changing it; the line numbers drift.

    Assert through `.classes()` arrays and `.text()`, matching the file's established style — no raw-HTML string matching and no CSS attribute selectors for utility class names. Reuse the existing fixtures; the only fixture edit permitted is `markupSlide`'s `body` string, per T-i.

    Do NOT touch `src/components/PresentationViewer.vue` in this task. Do NOT edit any other test file — `ServiceEditorView.test.ts` stubs the viewer and `congregationalReadingPipeline.test.ts` restates the predicate without mounting; both were verified unaffected.

    Run the suite and record which tests are RED and why, in the commit body. Commit the failing tests as `test(kzd): pin the label-free unified-size slide contract`.
  </action>

  <verify>
    <automated>npx vitest run src/components/__tests__/PresentationViewer.test.ts</automated>
    <automated>npm run type-check</automated>
  </verify>

  <done>
    - The scoped run is RED, and each failure matches an expected failure listed above — no unexplained failure, no failure caused by a typo in a selector.
    - All nine enumerated existing tests (T-a … T-i) have been rewritten; none was left asserting a testid's absence as its only guard.
    - N-1 (empty passage text) and the N-2 per-kind size assertions exist.
    - `npm run type-check` passes — the test file typechecks even while its assertions fail. Use this exact command (`vue-tsc --build`); the `-p tsconfig.app.json` form skips test files entirely and would prove nothing here.
    - `git status --short` shows only `src/components/__tests__/PresentationViewer.test.ts` modified.
    - Committed as its own commit, with the RED state recorded in the message.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Remove the label elements and unify the slide text treatment (GREEN)</name>
  <files>src/components/PresentationViewer.vue</files>

  <behavior>
    Four edits in one file, all inside the slide-canvas template. After this task the tests from Task 1 go green with no further test edits — if any test needs adjusting to pass, stop and re-check the component against the decision rather than relaxing the test.
  </behavior>

  <action>
    Re-read the scripture branch (currently 103-151) and the text branch (currently 153-168) before editing.

    **Edit 1 — delete the stale comment (currently 105-115).** Remove the whole HTML comment block that opens the scripture branch. Its claim that the size/weight step against the body is the only intended hierarchy signal is superseded by D1, and its closing sentence points at an element Edit 3 deletes. Do not rewrite it in place.

    Replace it with a SHORT comment (two or three lines) recording only what a future reader needs: that the reference always renders because the assembler builds scripture slides with an empty passage string, so a reference-only slide would otherwise project blank; and that it deliberately carries the same body treatment as every other kind, with no size step against the passage. **Do not use the words `presentation-label` or `hierarchy signal` anywhere in the new comment** — both are grep-gated to zero in this file by Task 3, and a comment mentioning them would fail that gate and, worse, leave the file naming a concept it no longer has.

    **Edit 2 — the scripture reference (currently 116-121), per D1.** On the `<p>` rendering `(currentSlide.slide as ScriptureSlide).reference`:
    - change the testid to `presentation-scripture-reference`;
    - replace the class attribute so it reads exactly `class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4] mb-8"` — the lyric branch's body list verbatim, plus the existing `mb-8`, which is layout spacing between the reference and the passage rather than label treatment and is retained deliberately.
    - Leave the element unconditional. It has no `v-if` today and must not gain one — that is exactly what keeps an unfetched passage from projecting a blank slide.
    - Leave its position above the `isCongregational` fork unchanged, so one edit covers both scripture sub-branches.

    **Edit 3 — the TextSlide title (currently 155-161), per D2.** Delete the entire `<p v-if="(currentSlide.slide as TextSlide).title" ...>` element. No replacement element, no restyle, no `v-if="false"`. Leave the enclosing `<template v-else-if="slideKind === 'text'">` wrapper and the body `<p>` beneath it untouched. The `TextSlide` cast on the body line keeps the type import in use, so nothing else needs unwinding.

    **Edit 4 — the congregational speaker tag (currently 129-135), per D3.** On the `<span :data-testid="\`presentation-speaker-${idx}\`">`:
    - delete the `:class` binding line that selects between the two accent colours;
    - replace the static class so it reads exactly `class="text-gray-100 text-5xl font-normal leading-[1.4] mr-4"` — the body treatment plus the existing `mr-4` gap before the section text;
    - **keep the element, keep the dynamic testid, and keep the text expression that renders `Leader:` / `Congregation:` unchanged.** These words are content the owner explicitly wants on each split slide, and the testids are the anchors the follow-up congregational-split phase will build against.

    Change nothing else in the file. Specifically leave alone: the lyric branch (74-79), the copyright branch (83-101) including its `text-6xl`/`text-2xl` lines, the congregational section-text span (136-141) including its gray-100/semibold vs gray-300/normal/pl-8 binding, both `presentation-body` paragraphs in the scripture and text branches (144-150, 162-167), the image branch, the media/affordance/chrome markup, and the entire `<script setup>` block including `isCongregational` and `cardKind`.
  </action>

  <verify>
    <automated>npx vitest run src/components/__tests__/PresentationViewer.test.ts</automated>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts'</automated>
    <human-check>Present a service containing (a) a scripture item with no passage fetched yet, (b) a scripture item with verse text, (c) a congregational reading, and (d) a Message and a Prayer item. Confirm: the reference-only slide shows its reference and is not blank; nothing on any slide reads as a coloured or uppercase heading; Leader:/Congregation: still appear; and every slide's text reads at the same size as a song-lyric slide.</human-check>
  </verify>

  <done>
    - `npx vitest run src/components/__tests__/PresentationViewer.test.ts` is fully GREEN, with no test edited during this task.
    - `npm run type-check` passes, using that exact command.
    - `npx vitest run --dir src --exclude '**/rules.test.ts'` shows EXACTLY `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` failing and nothing else. A third failing file is a regression from this change and must be fixed here, not excused.
    - The scripture reference element is unconditional (no `v-if`), carries the body class list, and sits above the `isCongregational` fork.
    - The TextSlide title element is deleted outright; `git diff` shows no replacement element.
    - The speaker spans keep their `presentation-speaker-{idx}` testids and their Leader:/Congregation: text, and carry no accent-colour binding.
    - The copyright branch and the congregational section-text span are byte-identical in `git diff`.
    - `git status --short` shows only `src/components/PresentationViewer.vue` modified.
    - Committed atomically, separately from Task 1.
  </done>
</task>

<task type="auto">
  <name>Task 3: Close the stale citation and prove the label treatment is gone repo-wide</name>
  <files>.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md</files>

  <action>
    **Step 1 — record the supersession where the stale citation lives.** Open `.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md` and find the paragraph beginning "**Scoped to the `lyric` branch only.**" (currently ~263-265), which ends "Do not remove them; R059 targets exactly one line."

    Insert a short blockquote note IMMEDIATELY AFTER that paragraph. Do not edit, soften or delete the original text — it was true when written and the record of what R059 scoped is worth keeping intact. The note must record: that quick task `260805-kzd` (2026-08-05, owner-decided) supersedes this paragraph; that the text branch's title label was deleted outright under its D2 because the owner reported never using it; that the scripture branch's reference SURVIVES but as body-treatment content under a new testid rather than as a label, under its D1, because the assembler builds scripture slides with an empty passage string and a reference-only slide must still project something; and that the congregational speaker tags were unified in the same pass under its D3 while keeping their words and testids. Name the plan file so the reasoning is one hop away.

    Keep it to a few lines. This is a pointer, not a re-litigation.

    **Step 2 — prove the removal is complete.** Run the two grep gates in the verify block. They assert that neither the removed testid nor the superseded comment phrase survives anywhere in the component or its tests. Both are exact and both should return no matches; a match means either a stale assertion survived Task 1 or the replacement comment written in Task 2 reused a forbidden phrase.

    **Step 3 — disclose in the SUMMARY, do not bury.** The SUMMARY must state plainly: that the copyright branch's `text-6xl` title and `text-2xl` author lines were deliberately left alone per CONTEXT.md's discretion default, and why (a credits card is a different layout from projected reading text, and the owner reported no problem with it); that the congregational section-text span keeps its LEADER/CONGREGATION weight/indent/tone differentiation, which D3 explicitly permits, and that its size was already `text-5xl`; and that the congregational-split feature the owner asked for in the same breath is NOT in this task and awaits its own planned phase. Also record which human-check items remain unverified — never record a deferred check as passed.
  </action>

  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts'</automated>
    <automated>! grep -rq 'presentation-label' src/components/PresentationViewer.vue src/components/__tests__/PresentationViewer.test.ts</automated>
    <automated>! grep -rq 'hierarchy signal' src/components/PresentationViewer.vue</automated>
    <automated>grep -c 'presentation-scripture-reference' src/components/PresentationViewer.vue</automated>
  </verify>

  <done>
    - `35-UI-SPEC.md` carries an additive supersession note directly after the paragraph it corrects, and that paragraph's original text is unchanged.
    - Both negative grep gates return no matches: the removed testid appears in neither the component nor its test file, and the superseded comment phrase appears in neither.
    - The positive grep confirms the new reference testid exists in the component.
    - `npm run type-check` clean, and the app suite is at EXACTLY the two known-baseline failures.
    - The SUMMARY records all three disclosure items from Step 3 and lists every human-check as outstanding rather than passed.
    - `git status --short` shows only the UI-SPEC file modified by this task.
    - Committed as a docs commit, separately from Tasks 1 and 2.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| slide data → projected screen | The projector is a one-way, non-interactive surface in front of a congregation. The risk here is not privilege but *silence*: content that fails to render has no error state and no second chance mid-service. |
| untrusted slide text → DOM | Slide `title`/`body`/`reference`/`text` are user-entered or third-party-imported (PPTX, ESV, Planning Center) and reach the DOM through Vue interpolation. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kzd-01 | Denial of Service | `PresentationViewer.vue` scripture branch | high | mitigate | Deleting the reference outright would project a BLANK slide for every scripture item whose passage has not been fetched — `slideshowAssembler.ts:152` and `:409` both construct with `text: ''`. D1 keeps the element unconditional and Task 1's N-1 test pins that an empty-passage slide still projects its reference as the slide's entire content. The plan explicitly forbids adding a `v-if` to that element. |
| T-kzd-02 | Tampering | `src/components/__tests__/PresentationViewer.test.ts` | high | mitigate | The realistic failure here is a suite that quietly stops guarding: nine tests pin behaviour that is being removed, and the lazy fix (`expect(...exists()).toBe(false)`) passes vacuously once the testid is gone from the codebase. Task 1 enumerates all nine by line, requires a positive replacement for each, and Task 3 grep-gates the removed testid to zero occurrences in BOTH files so no stale-but-passing assertion can survive. |
| T-kzd-03 | Elevation of Privilege | XSS escaping proof for slide text | high | mitigate | The existing escaping test proves angle-bracket markup renders literally — but it routes its `<script>` payload through the TextSlide **title**, the very element D2 deletes. Left alone, that assertion would fail; "fixed" carelessly, it would be deleted and the guarantee lost. Task 1's T-i moves the payload into the projected `body` so the proof survives on a live rendering path. No `v-html` is introduced anywhere; every changed element remains a Vue text interpolation. |
| T-kzd-04 | Information Disclosure | congregational speaker tags | medium | mitigate | Over-applying "no labels" would delete the Leader:/Congregation: words, which are the *content* of a responsive reading — a congregation would lose its cue mid-service. D3 keeps the words and the testids and restyles only. Task 1's T-e/T-f pin the text with `toBe('Leader:')` / `toBe('Congregation:')` and pin the two tags to an identical class list, so neither the words nor the unification can silently regress. |
| T-kzd-05 | Repudiation | stale documentation | low | mitigate | Two documents would otherwise assert rules the code no longer follows: the in-file comment from quick task `260805-bvo`, and `35-UI-SPEC.md`'s "do not remove them". Both are addressed — the comment is deleted with a grep gate proving it, the spec gains an additive supersession note. |
| T-kzd-06 | Tampering | scope creep into the slide data model | medium | mitigate | The adjacent congregational-split request is a data-model change with its own phase. The plan fences `slideshowAssembler.ts`, `scriptureSplitter.ts`, `src/types/slide.ts`, `SlideCard.vue` and `slideDisplay.ts` out of scope, and every task's `<done>` requires `git status --short` to match its `<files>` list exactly. |
| T-kzd-SC | Tampering | npm/pip/cargo installs | low | accept | This plan performs no package-manager install and modifies no `package.json` or lockfile. No Package Legitimacy Audit is required and no install checkpoint is warranted. |
</threat_model>

<verification>
Run these EXACT commands — per `CLAUDE.md` these are the only correct forms for this repo:

1. `npm run type-check` — runs `vue-tsc --build`, which typechecks TEST files as well as `src/`. Never substitute `vue-tsc --noEmit -p tsconfig.app.json`; it silently skips test files and has previously reported clean while five `TS2339` errors survived two full phases.
2. `npx vitest run --dir src --exclude '**/rules.test.ts'` — the app suite. A run showing EXACTLY `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion) failing is CLEAN. **A third failing file is a real regression from this work and must be fixed here, not excused.** Do NOT use `npx vitest run src/` and do NOT use bare `npx vitest run`.
3. `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — fast inner loop; a full path matches only that file.
4. The two negative grep gates and one positive grep gate in Task 3, proving the removal is complete in both the component and its tests.
5. `git status --short` after each task — the touched files must match that task's `<files>` list exactly and nothing else.
6. Owner confirmation of Task 2's `<human-check>` on the running app. Record it as outstanding until the owner answers; never record a deferred check as passed.

`npm run test:rules` is NOT required: this work touches no Firestore rule, no document shape and no write path.
</verification>

<success_criteria>
- No `presentation-label` element exists anywhere in `PresentationViewer.vue`, proven by grep, and no test asserts on one.
- A scripture slide's reference renders as `text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4] mb-8` under `data-testid="presentation-scripture-reference"`, unconditionally, above the congregational fork so both sub-branches are covered.
- A scripture slide with `text: ''` still projects its reference as the slide's entire visible content — pinned by a regression test that did not exist before.
- A Message/Prayer slide projects its body and nothing else; the title element is deleted outright and the `TextSlide.title` field is untouched.
- Congregational speaker tags read `Leader:` / `Congregation:` in the body treatment, carry an identical class list to each other, and keep their `presentation-speaker-{idx}` testids.
- Every projected text element — lyric body, scripture reference, scripture passage, speaker tag, text-slide body — asserts `text-5xl`, per kind, in the test suite. The copyright branch is excluded deliberately and the exclusion is written down.
- The XSS-escaping proof survives on a live rendering path rather than being deleted along with the element it used to travel through.
- The stale in-file comment is gone (grep-proven) and `35-UI-SPEC.md` carries an additive supersession note.
- `npm run type-check` clean; app suite at exactly the two known-baseline failures; three atomic commits, one per task.
- The SUMMARY discloses the copyright branch and section-text span as deliberately untouched, and lists the human-check as outstanding rather than passed.
</success_criteria>

<output>
Create `.planning/quick/260805-kzd-remove-slide-labels-unify-slide-text-size/260805-kzd-SUMMARY.md` when done.
</output>
