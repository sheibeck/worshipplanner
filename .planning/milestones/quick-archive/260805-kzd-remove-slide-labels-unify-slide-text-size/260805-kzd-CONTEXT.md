# Quick Task 260805-kzd: Remove slide labels, unify slide text size - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Task Boundary

Projected slides must carry **no label/header text**, and all slide text must be
one consistent size — the Song-lyrics treatment.

Owner verbatim: *"Slides don't actually need labels. They are never used. We want
slide text to be consistent in size. Make slide text size the same size as we have
for Song lyrics; scripture is really small right now. If you look at the Message and
the Prayer items in the slide show, you'll see they both show a blue Message and
Prayer respectively, then the white text. We just want the white text. No
label/header text in these items."*

This task is **presentation rendering only** — `src/components/PresentationViewer.vue`.
The congregational-split feature the owner asked for in the same breath ("individual
slides for each section … modify them after we split them up, or delete them
entirely") is deliberately NOT here; it is a data-model change and gets its own
planned phase.
</domain>

<decisions>
## Implementation Decisions

### D1 — Scripture reference becomes body content, always (owner-selected)

**The blank-slide hazard is real, verified 2026-08-05:** `slideshowAssembler.ts:152`
and `:409` both construct scripture slides with `text: ''`. A scripture slide is
reference-only until someone fetches the passage, so the reference element is
frequently the *entire* visible content. Deleting it outright would project a
blank slide.

Resolution: the reference is **slide content, not a label**, and always renders.
- Drop the `data-testid="presentation-label"` identity and the `text-2xl
  font-semibold` label sizing from the scripture reference.
- Render it in the body treatment: `text-gray-100 text-5xl font-normal
  leading-[1.4]`.
- When passage `text` is non-empty, the reference sits above it; both are body-sized.
  There is no longer a size/weight hierarchy step between them — that was the
  "hierarchy signal" rationale in the old code comment and it is now superseded.

This also resolves "scripture is really small right now": the small thing the owner
saw was the `text-2xl` reference being the whole slide.

### D2 — TextSlide title label is deleted outright

The blue uppercase "Message" / "Prayer" heading is exactly what the owner pointed
at. Remove the element entirely — no replacement, no restyle. A text slide renders
its `body` and nothing else. The `title` field stays on the `TextSlide` type and
keeps serving the slide grid; it simply is not projected.

This **supersedes** the deliberate-divergence code comment left by quick task
260805-bvo, which recorded that the scripture and text-slide labels were knowingly
styled differently. Delete that comment along with the element — do not leave it
asserting a rule the code no longer follows.

After this change **no `presentation-label` element exists anywhere** in
`PresentationViewer.vue`. Any test asserting its presence must be updated, not
worked around.

### D3 — Congregational speaker tags are restyled now (owner-selected)

The per-section `presentation-speaker-*` tags ("LEADER:" / "CONGREGATION:") are
brought into the same treatment in THIS task rather than deferred:
- Drop `uppercase`, `tracking-wider`, and the `text-indigo-300` / `text-amber-300`
  accent colours.
- Match the body: `text-gray-100`, `text-5xl`, `leading-[1.4]`.
- **Keep the words themselves.** "Leader:" / "Congregation:" is the speaker
  indication the owner explicitly wants on each split slide — it is content, not a
  label. Do not remove it.
- Keep the elements and their `data-testid` values so the follow-up
  congregational-split phase has stable anchors.

The existing LEADER-vs-CONGREGATION differentiation via `font-semibold` /
`font-normal pl-8` on the section text is Claude's discretion — retaining it is
fine, since it is weight/indent rather than the accent-colour label treatment the
owner objected to.

### Claude's Discretion

- Whether the copyright branch's `text-6xl` title / `text-2xl` author lines change.
  The owner did not report copyright slides and they are a genuinely different
  layout (a credits card, not projected reading text). **Default: leave them
  alone**, and say so in the summary rather than silently widening scope.
- The exact markup shape after the label elements come out (e.g. whether the
  scripture reference and passage become two `<p>`s or one). Prefer the smallest
  diff that satisfies D1.
</decisions>

<specifics>
## Specific Ideas

The canonical body treatment to converge on — it is the lyric branch's existing
class list:

```
text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]
```

Live-source anchors, verified 2026-08-05 (re-verify line numbers before editing,
they drift):

| What | Where |
|---|---|
| Lyric body (the reference treatment) | `src/components/PresentationViewer.vue:74-79` |
| Scripture `presentation-label` + its stale comment | `:105-121` |
| Congregational speaker tags | `:129-135` |
| Congregational section text | `:136-141` |
| Scripture non-congregational body | `:144-150` |
| TextSlide title `presentation-label` | `:155-161` |
| TextSlide body | `:162-167` |
| `isCongregational` helper | `~:495` |
| Scripture slides built with `text: ''` | `src/utils/slideshowAssembler.ts:152`, `:409` |

## Scope fence — do NOT touch

- `src/utils/slideshowAssembler.ts`
- `src/utils/scriptureSplitter.ts`
- The `ScriptureSlide` / `TextSlide` data model in `src/types/slide.ts`
- `SlideCard.vue`'s kind eyebrow (the slide-grid badge, not a projected slide)
- The 3-dot menu / `slideDisplay.ts`

All of the above belong to the congregational-split phase.
</specifics>

<canonical_refs>
## Canonical References

- Quick task `260805-bvo` — recoloured the scripture reference to `text-gray-100`
  but kept it label-sized and kept the TextSlide title blue. This task supersedes
  both halves of that outcome.
- `33-UI-SPEC.md` — if it specifies projected-slide label treatment, record the
  supersession where it is cited rather than leaving the citation stale.

## Gates (owner-mandated, per CLAUDE.md)

- `npm run type-check` — must be `vue-tsc --build`. The `-p tsconfig.app.json`
  form silently skips test files and is NOT sufficient evidence.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — the only correct
  app-suite invocation.
- Known-failing baseline, NOT regressions: `src/storage.rules.test.ts` (needs the
  Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion).
  Any other failure is a real regression and must be fixed, not excused.
- Never record a deferred check as passed.
</canonical_refs>
