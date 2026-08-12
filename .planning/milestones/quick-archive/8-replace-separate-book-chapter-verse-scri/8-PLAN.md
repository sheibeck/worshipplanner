---
phase: quick
plan: 8
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/scripture.ts
  - src/utils/__tests__/scripture.test.ts
  - src/components/ScriptureInput.vue
  - src/components/__tests__/ScriptureInput.test.ts
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "User can type 'Isaiah 53:1-6' and the slot saves with book=Isaiah, chapter=53, verseStart=1, verseEnd=6"
    - "User can type 'Psalm 23' and the slot saves with book=Psalms, chapter=23, verseStart undefined"
    - "User can type 'Romans 8:28' and slot saves with book=Romans, chapter=8, verseStart=28, verseEnd undefined"
    - "User can type 'John 1:1-10,15-20' and the outer range is captured: verseStart=1, verseEnd=20"
    - "Invalid/incomplete text (e.g. 'Joh') emits null and shows a parse error hint"
    - "AI-selected passages still populate the input field as a formatted string"
    - "ESV link and passage preview still work when input parses successfully"
  artifacts:
    - path: "src/utils/scripture.ts"
      provides: "parseScriptureInput(text) function"
      exports: ["parseScriptureInput"]
    - path: "src/components/ScriptureInput.vue"
      provides: "Single freeform text input replacing 4 separate fields"
  key_links:
    - from: "src/components/ScriptureInput.vue"
      to: "src/utils/scripture.ts"
      via: "parseScriptureInput called on input event"
      pattern: "parseScriptureInput"
    - from: "src/components/ScriptureInput.vue"
      to: "update:modelValue emit"
      via: "parsed ScriptureRef or null"
      pattern: "emit.*update:modelValue"
---

<objective>
Replace the four-field scripture reference UI (Book dropdown + Chapter + Verse Start + Verse End) with a single freeform text input. Users type references like "Isaiah 53:1-6", "Psalm 23", "Romans 8:28", or "John 1:1-10,15-20". The component parses the text into the existing ScriptureRef structure and emits it unchanged.

Purpose: Faster, more natural scripture entry — typing "John 3:16-17" is much quicker than selecting from a dropdown and filling three number fields.
Output: Updated ScriptureInput.vue with freeform text input; parseScriptureInput utility in scripture.ts.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@src/utils/scripture.ts
@src/types/service.ts
@src/components/ScriptureInput.vue
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add parseScriptureInput to scripture.ts</name>
  <files>src/utils/scripture.ts, src/utils/__tests__/scripture.test.ts</files>
  <behavior>
    - parseScriptureInput('Isaiah 53:1-6') → { book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 }
    - parseScriptureInput('Psalm 23') → { book: 'Psalms', chapter: 23 }  (no verseStart/verseEnd)
    - parseScriptureInput('Romans 8:28') → { book: 'Romans', chapter: 8, verseStart: 28 }  (no verseEnd)
    - parseScriptureInput('John 1:1-10,15-20') → { book: 'John', chapter: 1, verseStart: 1, verseEnd: 20 }  (outer range)
    - parseScriptureInput('1 Corinthians 13:4-7') → { book: '1 Corinthians', chapter: 13, verseStart: 4, verseEnd: 7 }
    - parseScriptureInput('Song of Solomon 2:1') → { book: 'Song of Solomon', chapter: 2, verseStart: 1 }
    - parseScriptureInput('joh 3:16') → null  (partial/unrecognized book name)
    - parseScriptureInput('') → null
    - parseScriptureInput('John') → null  (no chapter)
    - Book matching: case-insensitive prefix match against BIBLE_BOOKS. 'psalms' matches 'Psalms'. Exact match preferred; if >1 prefix match, return null (ambiguous). 'John' matches 'John' but not '1 John'/'2 John'/'3 John' because exact match wins. '1 john' matches '1 John' exactly. 'song' is ambiguous (Song of Solomon) — accept if only one match.
  </behavior>
  <action>
    Add `parseScriptureInput(text: string): ScriptureRef | null` to src/utils/scripture.ts.

    Algorithm:
    1. Trim input. Return null if empty.
    2. Split into book token and reference token by finding where the numeric part starts.
       Pattern: match /^(.+?)\s+(\d+)(?::(.+))?$/ against the trimmed text.
       Group 1 = book text, Group 2 = chapter, Group 3 = verse expression (optional).
    3. Resolve book: compare Group 1 (case-insensitive) against BIBLE_BOOKS.
       - Exact match (case-insensitive) wins immediately.
       - If no exact match, collect all books where the canonical name starts with the input token (case-insensitive). If exactly one, use it. Otherwise return null.
    4. Chapter = parseInt(Group 2). Return null if NaN or <= 0.
    5. Verse expression (Group 3), if present:
       - Strip trailing whitespace.
       - Multi-range like "1-10,15-20": split on commas, collect all numbers, verseStart = min, verseEnd = max.
       - Single range "1-6": verseStart=1, verseEnd=6.
       - Single verse "28": verseStart=28 only (no verseEnd).
       - Any parse failure → return null.
    6. Return ScriptureRef with book (canonical casing from BIBLE_BOOKS), chapter, and optional verseStart/verseEnd.

    Export the function. Write failing tests first in scripture.test.ts covering the behavior cases above, then implement.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/scripture.test.ts</automated>
  </verify>
  <done>All parseScriptureInput tests pass. Existing BIBLE_BOOKS / esvLink / scripturesOverlap tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Replace 4-field UI with freeform input in ScriptureInput.vue; update component tests</name>
  <files>src/components/ScriptureInput.vue, src/components/__tests__/ScriptureInput.test.ts</files>
  <action>
    Replace the "4 fields in a row" block (lines 117-157 in current file — the select + three number inputs) with a single text input:

    ```html
    <input
      v-model="localText"
      type="text"
      :placeholder="label === 'Sermon Passage' ? 'e.g. Romans 8:28' : 'e.g. Isaiah 53:1-6'"
      class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      :class="parseError ? 'border-red-700 focus:ring-red-500' : ''"
      @input="onTextInput"
    />
    <p v-if="parseError" class="text-xs text-red-400 mt-1">{{ parseError }}</p>
    ```

    Script changes:
    1. Import parseScriptureInput from @/utils/scripture.
    2. Replace the four local refs (localBook, localChapter, localVerseStart, localVerseEnd) with:
       - `localText = ref<string>('')` — initialized from formatRef(props.modelValue)
       - `parseError = ref<string>('')`
    3. Add helper `formatRef(ref: ScriptureRef | null): string`:
       - null → ''
       - book + chapter only (no verseStart) → 'Book Chapter'
       - book + chapter + verseStart, no verseEnd → 'Book Chapter:verseStart'
       - all four → 'Book Chapter:verseStart-verseEnd'
    4. Update the watch on props.modelValue to set `localText.value = formatRef(val)` (only if the current text doesn't already parse to the same ref — avoids clobbering in-progress typing, but DO update if the new modelValue came from AI selection or external change).
       Simple rule: always update localText from external modelValue changes (the watcher fires when parent sets value, not from typing).
    5. `onTextInput()`:
       - const parsed = parseScriptureInput(localText.value)
       - If localText is empty: parseError = '', emit null
       - If parsed: parseError = '', emit parsed
       - If not parsed and localText is non-empty: parseError = 'Unrecognized reference — try "Book Chapter:Verse-Verse"', emit null
    6. Replace all references to localBook/localChapter/localVerseStart/localVerseEnd in computed properties with reads from `parseScriptureInput(localText.value)`:
       - `canPreview`: parsed != null (has book + chapter)
       - `esvUrl`: use parsed.book + parsed.chapter
       - `currentRef`: return parsed directly (or null)
       - `passageQuery`: build from parsed fields
       - `isComplete`: parsed != null && parsed.verseStart != null && parsed.verseEnd != null
    7. `onSelectAiScripture(result)`: set `localText.value = formatRef({book: result.book, chapter: result.chapter, verseStart: result.verseStart, verseEnd: result.verseEnd})` then call onTextInput().
    8. Remove `onFieldChange` — replace with `onTextInput`.
    9. The `void isComplete` suppression line can be removed if isComplete is now used in template (or keep if still unused).

    Update ScriptureInput.test.ts:
    - Remove the "Book dropdown" describe block (tests for the select element — it no longer exists).
    - Update "update:modelValue emits null when only book+chapter filled" test — this no longer applies as-is; replace with a test that types 'John 3' (no verse) and verifies null is emitted (parseScriptureInput returns no verseStart so component should emit the partial ref — actually emit the partial ref since canPreview is true even without verses).

    IMPORTANT: The existing emit behavior: `currentRef` is emitted (which can be book+chapter without verses). So typing 'John 3' emits `{book:'John', chapter:3}` not null. Update the test accordingly.

    - Add test: typing 'Isaiah 53:1-6' emits `{book:'Isaiah', chapter:53, verseStart:1, verseEnd:6}`.
    - Add test: typing 'Romans 8:28' emits `{book:'Romans', chapter:8, verseStart:28}`.
    - Add test: typing 'junk text' emits null and shows parse error text.
    - Keep ESV link tests but adapt: pass modelValue as before; the component formats it into the text input on mount.
    - Keep overlap warning tests unchanged (they pass modelValue directly).
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/ScriptureInput.test.ts</automated>
  </verify>
  <done>
    Component tests pass. The four separate input fields are gone. A single text input renders. Typing "Isaiah 53:1-6" emits the correct ScriptureRef. Typing an invalid string shows a parse error and emits null. AI suggestion selection populates the text input. ESV link and passage preview still work.
  </done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions:

```bash
npx vitest run
```

All tests should pass, including ServiceEditorView tests (which use ScriptureInput via mount or mock).
</verification>

<success_criteria>
- parseScriptureInput exported from scripture.ts, all behavior cases tested
- ScriptureInput.vue shows single text input instead of 4 fields
- Typing any valid reference format emits a ScriptureRef
- Typing an invalid/incomplete reference emits null with an inline parse error
- AI suggestion selection still works (populates formatted text)
- ESV link and passage preview still work
- npx vitest run passes with no failures
</success_criteria>

<output>
After completion, create `.planning/quick/8-replace-separate-book-chapter-verse-scri/8-SUMMARY.md`
</output>
