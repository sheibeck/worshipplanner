# Phase 6: AI Assisted Service Suggesting and Scripture Searching - Research

**Researched:** 2026-03-04
**Domain:** Anthropic Claude API + Vue 3 component integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sermon context & AI input:**
- Add an optional free-text "Sermon Topic/Theme" field to the service editor (e.g., "Grace and forgiveness", "The prodigal son")
- AI uses both the sermon topic field and the sermon passage (already exists) as context — either alone is sufficient to trigger suggestions
- AI considers previously selected songs/scriptures in the service when suggesting for the next slot — builds a cohesive service flow
- AI runs on-demand via an explicit button press — not automatic. Planner controls when AI runs and API costs

**Song suggestion enhancement:**
- AI suggestions shown as a separate "AI Picks" section above the existing "By Rotation" section in the SongSlotPicker dropdown
- Two modes: per-slot AI picks in the picker dropdown, plus a top-level "Suggest All Songs" button for a complete 4-song set
- Top 3 AI picks per slot
- When no sermon context exists, the AI section shows a placeholder prompt: "Add a sermon topic or passage for AI suggestions"
- When AI is unavailable or errors, the current rotation-based suggestions continue working — AI is an enhancement, not a dependency

**Scripture discovery:**
- Two entry points for AI scripture: natural language search field above the structured picker + "Suggest Scripture" button per scripture slot
- Natural language search accepts queries like "passages about forgiveness" or "comfort in suffering"
- Auto-suggest provides 3-5 passages based on sermon context
- AI suggests full references with specific verse ranges (e.g., "Psalm 23:1-6", not just "Psalm 23")
- Results show reference + AI's brief reason for suggesting it — no passage text preview in results. Planner uses existing ESV preview button to read text
- Overlap with sermon passage: AI shows all suggestions but marks overlapping ones with a warning — planner decides if overlap is intentional

**Rotation & overuse prevention:**
- Song rotation: AI respects the existing 2-week deprioritization window from `rankSongsForSlot()` — recently used songs are ranked lower but not excluded
- Scripture rotation: AI notes if a passage was used recently (e.g., "Used 3 weeks ago") but still suggests it if thematically strong — planner decides
- AI must receive recent service history (songs and scriptures used in past weeks) as context

**AI response presentation:**
- Each AI suggestion includes a short 5-10 word reason
- "Suggest All Songs" fills empty song slots directly inline in the service editor — each slot shows the AI pick with accept/reject actions
- Graceful error handling: AI section shows "Suggestions unavailable" with a retry link on failure. Service editor always works without AI

### Claude's Discretion
- What song metadata to send to the AI (balance of data richness vs. API payload size)
- Loading state design while AI is processing (shimmer, spinner, or other pattern fitting the dark-mode UI)
- AI API architecture (client-side calls vs. backend proxy)
- Caching strategy for AI responses within a session
- Exact placement and styling of the "Suggest All Songs" button in the service editor header
- How accept/reject actions look on AI-filled slots

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 6 integrates Anthropic's Claude API into the existing Vue 3 worship planner to power two features: AI song suggestions and AI scripture discovery. The VITE_CLAUDE_API_KEY is already in `.env.local.example`, confirming Claude was anticipated as the AI provider from the start.

The architecture decision left to discretion is whether to call the Claude API client-side (with `dangerouslyAllowBrowser: true`) or through a backend proxy. For this single-org internal tool used by trusted planners, client-side calls are the correct pragmatic choice — no Firebase Function infrastructure required, no cold-start latency, and the API key is already in env. The key is never compiled into the build (Vite's `import.meta.env` is injected at dev-time from `.env.local`), but it is visible in browser network traffic. Given this is a single-org tool for trusted users, that risk is acceptable.

The Claude API returns structured JSON through either the new `output_format` structured-outputs beta (November 2025) or through well-crafted system prompts instructing JSON-only output. The structured-outputs beta is the cleaner approach for guaranteed parseable responses, but requires the beta header. The simpler JSON-in-system-prompt approach works on all models without beta headers and is well-tested in production. Use the simpler approach first.

**Primary recommendation:** Call the Anthropic API directly from the browser using `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. Use `claude-haiku-3-5` ($0.80/MTok input, $4/MTok output) for cost efficiency — song/scripture suggestions are not complex reasoning tasks. Wrap all AI calls in a single `utils/claudeApi.ts` utility that catches errors and returns `null` on failure, never throwing into UI code.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | latest | Anthropic TypeScript SDK, handles CORS + retries | Official SDK with typed request/response, auto-retry on 429/5xx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `fetch` (no SDK) | built-in | Raw API calls without SDK dependency | Alternative if SDK adds too much bundle weight |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/sdk` | Raw `fetch` to `https://api.anthropic.com/v1/messages` | SDK adds ~50KB bundle weight but provides typed responses, auto-retry, and error subclasses — worth it |
| `claude-haiku-3-5` | `claude-haiku-4-5` | Haiku 4.5 costs $1/MTok vs $0.80/MTok for Haiku 3.5; minimal quality difference for suggestion tasks |
| Client-side API | Firebase Cloud Function proxy | Proxy adds infrastructure complexity, cold-start latency, cost; unnecessary for internal single-org tool |
| System prompt JSON | `output_format` structured-outputs beta | Beta header required; system-prompt-only JSON works on all models without beta header |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── utils/
│   ├── claudeApi.ts          # NEW: Anthropic client, song & scripture prompt functions
│   └── __tests__/
│       └── claudeApi.test.ts # NEW: unit tests with mocked fetch
├── components/
│   ├── SongSlotPicker.vue    # MODIFY: add "AI Picks" section above rotation
│   └── ScriptureInput.vue    # MODIFY: add natural language search field + suggest button
└── views/
    └── ServiceEditorView.vue # MODIFY: add sermon topic field, "Suggest All Songs" button
```

### Pattern 1: Client-Side Claude API Utility

**What:** A thin `utils/claudeApi.ts` module that encapsulates all Anthropic SDK calls. All AI features import from this single module. Never instantiate Anthropic client in components.

**When to use:** Every AI call in the app.

**Example:**
```typescript
// src/utils/claudeApi.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Song } from '@/types/song'
import type { ScriptureRef } from '@/types/service'

// Lazy singleton — only created when first AI call is made
let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
    if (!apiKey) throw new Error('VITE_CLAUDE_API_KEY not set')
    _client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  }
  return _client
}

export interface AiSongSuggestion {
  songId: string
  reason: string   // 5-10 words
  isRecent: boolean
  weeksAgo: number | null
}

export interface AiScriptureSuggestion {
  reference: string   // e.g. "Psalm 23:1-6"
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  reason: string      // 5-10 words
  recentlyUsed: boolean
  weeksAgoUsed: number | null
}

/**
 * Returns null on any error — callers never throw, just show fallback UI.
 */
export async function getSongSuggestions(params: {
  sermonTopic: string
  sermonPassage: ScriptureRef | null
  slotVwType: 1 | 2 | 3
  alreadySelectedSongs: { title: string; vwType: number | null }[]
  songs: Pick<Song, 'id' | 'title' | 'vwType' | 'themes' | 'lastUsedAt'>[]
  recentServiceSongIds: string[]
}): Promise<AiSongSuggestion[] | null> {
  try {
    const client = getClient()
    const msg = await client.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 512,
      system: SONG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildSongPrompt(params) }],
    })
    const text = (msg.content[0] as { type: 'text'; text: string }).text
    return JSON.parse(text) as AiSongSuggestion[]
  } catch {
    return null
  }
}

export async function getScriptureSuggestions(params: {
  sermonTopic: string
  sermonPassage: ScriptureRef | null
  naturalLanguageQuery: string
  recentScriptures: ScriptureRef[]
}): Promise<AiScriptureSuggestion[] | null> {
  try {
    const client = getClient()
    const msg = await client.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 512,
      system: SCRIPTURE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildScripturePrompt(params) }],
    })
    const text = (msg.content[0] as { type: 'text'; text: string }).text
    return JSON.parse(text) as AiScriptureSuggestion[]
  } catch {
    return null
  }
}
```

### Pattern 2: System Prompt JSON Enforcement

**What:** Instruct Claude via system prompt to respond ONLY with a JSON array. No markdown fences, no prose. This is simpler than the `output_format` beta and works on all models.

**When to use:** All AI suggestion calls in this phase.

**Example:**
```typescript
const SONG_SYSTEM_PROMPT = `You are a worship planning assistant for a church that follows the Vertical Worship methodology.
Song types: Type 1 = Call to Worship (opening, energetic), Type 2 = Intimate (slower, devotional), Type 3 = Ascription (closing, celebratory).

Respond ONLY with a valid JSON array. No markdown, no prose, no code fences.
Return exactly 3 items matching this schema:
[{"songId":"<id>","reason":"<5-10 word reason>"}]

Rules:
- Prefer songs whose themes match the sermon topic/passage
- Songs used in the last 2 weeks should only be picked if thematically exceptional
- Build a cohesive flow — consider songs already selected in the service
- songId must be from the provided song list exactly as given`
```

### Pattern 3: Loading States in Dark-Mode UI

**What:** Use a shimmer placeholder that matches gray-900/gray-800 palette while AI is loading. Apply existing spinner pattern from `ScriptureInput.vue` for button-triggered requests.

**When to use:** Any async AI call in progress.

**Example:**
```html
<!-- Shimmer for AI Picks section while loading -->
<div v-if="aiLoading" class="space-y-1 px-3 py-2">
  <div class="h-3 bg-gray-700/60 rounded animate-pulse w-3/4"></div>
  <div class="h-3 bg-gray-700/60 rounded animate-pulse w-1/2"></div>
  <div class="h-3 bg-gray-700/60 rounded animate-pulse w-2/3"></div>
</div>

<!-- Error state -->
<div v-else-if="aiError" class="px-3 py-2">
  <p class="text-xs text-gray-500">
    Suggestions unavailable.
    <button @click="retryAI" class="text-indigo-400 hover:text-indigo-300">Retry</button>
  </p>
</div>
```

### Pattern 4: Session-Level AI Response Cache

**What:** A `Map<string, AiResult>` keyed by a hash of the AI prompt inputs (sermonTopic + sermonPassage + slotVwType). Stored in component-level `ref` on the service editor, not Pinia (AI suggestions are ephemeral UI state, not persisted data).

**When to use:** Cache results within the same service editing session. Invalidate when sermon topic/passage changes.

**Example:**
```typescript
// In ServiceEditorView.vue script setup
const aiSongCache = ref(new Map<string, AiSongSuggestion[]>())

function aiCacheKey(slotIndex: number): string {
  return JSON.stringify({
    topic: localService.value?.sermonTopic,
    passage: localService.value?.sermonPassage,
    slotIndex,
  })
}

// Clear cache when sermon context changes
watch(
  () => [localService.value?.sermonTopic, localService.value?.sermonPassage],
  () => { aiSongCache.value.clear() },
)
```

### Pattern 5: "Suggest All Songs" Inline Accept/Reject

**What:** When the planner clicks "Suggest All Songs", all empty SONG slots show an AI-proposed song with Accept (checkmark) and Reject (X) buttons. Accepted slots write the song to `localService.slots` (not saved to Firestore until the planner saves manually). Rejected slots clear the AI prop and show the normal picker.

**When to use:** Only for the bulk "Suggest All Songs" flow.

**Example:**
```typescript
// Per-slot AI draft state — transient, not persisted
const aiDraftSongs = ref<Map<number, { song: AiSongSuggestion; pending: boolean }>>(new Map())

function acceptAiSong(slotIndex: number) {
  const draft = aiDraftSongs.value.get(slotIndex)
  if (!draft) return
  onSelectSong(slotIndex, { id: draft.song.songId, title: draft.song.songTitle, key: '' })
  aiDraftSongs.value.delete(slotIndex)
}

function rejectAiSong(slotIndex: number) {
  aiDraftSongs.value.delete(slotIndex)
}
```

### Anti-Patterns to Avoid
- **Instantiating `Anthropic` in components:** Always use the `getClient()` lazy singleton from `utils/claudeApi.ts` — avoids re-creating the client on each component mount.
- **Awaiting AI in computed properties:** AI is async; only call from methods/watchers triggered by user action, never in computed.
- **Storing AI state in Pinia:** AI suggestions are ephemeral UI state — keep in component refs, not the store. Persisting to Firestore would be wasteful and wrong.
- **Showing AI errors as blocking states:** AI errors must never break the existing picker flow. Always render the rotation-based suggestions even when AI fails.
- **Sending full song library:** For "Suggest All Songs", send only the fields Claude needs (id, title, vwType, themes) — not arrangements, BPM, chordChartUrl. This reduces payload by ~80%.
- **Sending all 52+ weeks of history:** Send only the last 8 weeks of service history for recency context. More history is noise.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key exposure | Custom proxy server | `dangerouslyAllowBrowser: true` on trusted internal tool | Firebase Function adds cold start, cost, infrastructure; unnecessary here |
| Retry on 429/500 | Manual sleep + retry loop | `@anthropic-ai/sdk` built-in auto-retry | SDK retries 2x with exponential backoff by default |
| Response streaming | SSE parser | SDK's `client.messages.stream()` | SDK handles SSE correctly; streaming is optional for this feature (responses are small) |
| Structured response parsing | Regex extraction | JSON.parse on Claude's JSON-only response | System prompt enforcement + try/catch is simpler and reliable |
| Scripture reference parsing | Custom regex | Pass structured output schema — have Claude return parsed fields | Claude returns `{book, chapter, verseStart, verseEnd}` directly |

**Key insight:** The API surface for AI suggestions is narrow — input a prompt, parse a small JSON array. Don't over-engineer. The entire AI integration is ~150 lines in one utility file.

---

## Common Pitfalls

### Pitfall 1: Claude Returns Non-JSON Despite System Prompt
**What goes wrong:** Occasionally Claude prepends "Here are the suggestions:" or wraps in markdown fences.
**Why it happens:** Claude's RLHF training makes it want to be conversational; system prompt alone doesn't guarantee pure JSON.
**How to avoid:** Wrap `JSON.parse()` in try/catch. If parse fails, attempt to extract JSON with a regex: `/\[[\s\S]*\]/`. Return null if extraction fails.
**Warning signs:** Parse errors in console during testing.

```typescript
function safeParseJsonArray(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    // Try to extract JSON array from prose
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}
```

### Pitfall 2: Song ID Hallucination
**What goes wrong:** Claude returns a `songId` that doesn't exist in the song library.
**Why it happens:** Claude is a language model — it may invent IDs rather than use provided ones.
**How to avoid:** After parsing the AI response, filter suggestions to only those whose `songId` exists in `songStore.songs`. A hallucinated ID produces no match; silently discard it.
**Warning signs:** Zero AI picks displayed even when AI returns successfully.

```typescript
function validateSongSuggestions(
  aiResult: AiSongSuggestion[],
  songs: Song[],
): AiSongSuggestion[] {
  const songMap = new Map(songs.map(s => [s.id, s]))
  return aiResult.filter(s => songMap.has(s.songId))
}
```

### Pitfall 3: Scripture Reference Out of Range
**What goes wrong:** Claude suggests "Psalm 151:1-5" (Psalm 151 is in the Septuagint, not Protestant canon) or verse ranges that exceed the chapter length.
**Why it happens:** Claude doesn't validate against actual Bible verse counts.
**How to avoid:** Validate that the returned `book` is in the project's `BIBLE_BOOKS` constant. For verse range validation, accept whatever Claude returns — the planner uses the ESV preview button to verify before accepting. If `book` is not in `BIBLE_BOOKS`, discard the suggestion.

### Pitfall 4: API Key Not Set in .env.local
**What goes wrong:** `VITE_CLAUDE_API_KEY` is undefined at runtime; first AI click fails silently.
**Why it happens:** `.env.local` is gitignored; new dev checkouts don't have it.
**How to avoid:** In `getClient()`, check `if (!apiKey)` and throw a descriptive error. Catch it in the calling function and return null. In development, log a clear console warning: "VITE_CLAUDE_API_KEY not set — AI suggestions disabled."

### Pitfall 5: Sermon Topic Field Not in Service Type
**What goes wrong:** `Service` type in `types/service.ts` doesn't have `sermonTopic` field; TypeScript errors everywhere.
**Why it happens:** `Service` type currently has no `sermonTopic` field.
**How to avoid:** Add `sermonTopic?: string` to the `Service` interface in `types/service.ts` AND add it to `ServiceInput`. Also add it to the Firestore create document in `services.ts` (default `''`). This is a Wave 0 type system task.

### Pitfall 6: SongSlotPicker Receives No AI Context
**What goes wrong:** `SongSlotPicker.vue` currently takes only `requiredVwType`, `serviceTeams`, `currentSongId`, and `songs`. It has no access to sermon topic/passage for AI.
**Why it happens:** Props were designed for the algorithmic suggestion flow.
**How to avoid:** Add new optional props to `SongSlotPicker`: `sermonTopic?: string`, `sermonPassage?: ScriptureRef | null`, `alreadySelectedSongs?: {...}[]`. Parent (`ServiceEditorView`) passes these down. Keep them optional so SongSlotPicker degrades gracefully when undefined.

### Pitfall 7: "Suggest All Songs" Button Visible When No Context
**What goes wrong:** Planner clicks "Suggest All Songs" with no sermon topic/passage; Claude returns generic or irrelevant songs.
**Why it happens:** No guard on the button.
**How to avoid:** Disable the "Suggest All Songs" button (or show tooltip) when neither `sermonTopic` nor `sermonPassage` is set. The button is only useful with context.

---

## Code Examples

Verified patterns from official sources:

### Anthropic SDK Browser Initialization
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true,  // Required for browser environments
})
```

### Basic Message with JSON System Prompt
```typescript
// Source: https://platform.claude.com/docs/en/api/messages
const msg = await client.messages.create({
  model: 'claude-haiku-3-5-20241022',
  max_tokens: 512,
  system: 'Respond ONLY with a valid JSON array. No prose, no markdown fences.',
  messages: [{ role: 'user', content: userPrompt }],
})
const text = (msg.content[0] as Anthropic.TextBlock).text
```

### Error Handling (SDK error types)
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript
import Anthropic from '@anthropic-ai/sdk'

try {
  const msg = await client.messages.create({ ... })
  return JSON.parse((msg.content[0] as Anthropic.TextBlock).text)
} catch (err) {
  if (err instanceof Anthropic.APIError) {
    // err.status: 401 | 429 | 500, etc.
    console.warn('Claude API error:', err.status, err.message)
  }
  return null  // Always return null on failure, never throw
}
```

### Song Suggestion Prompt Structure
```typescript
function buildSongPrompt(params: {
  sermonTopic: string
  sermonPassage: ScriptureRef | null
  slotVwType: 1 | 2 | 3
  alreadySelectedSongs: { title: string }[]
  songs: { id: string; title: string; vwType: number | null; themes: string[]; lastUsedAt: string | null }[]
}): string {
  const passageStr = params.sermonPassage
    ? `${params.sermonPassage.book} ${params.sermonPassage.chapter}:${params.sermonPassage.verseStart ?? ''}${params.sermonPassage.verseEnd ? `-${params.sermonPassage.verseEnd}` : ''}`
    : 'none'

  return `Sermon topic: "${params.sermonTopic}"
Sermon passage: ${passageStr}
This slot requires a Type ${params.slotVwType} song.
Already selected in this service: ${params.alreadySelectedSongs.map(s => s.title).join(', ') || 'none'}

Song library (id, title, type, themes, weeksAgoLastUsed):
${params.songs.map(s => `${s.id}|${s.title}|T${s.vwType ?? '?'}|${s.themes.join(',')}|${s.lastUsedAt ?? 'never'}`).join('\n')}

Return JSON array of exactly 3 suggestions:
[{"songId":"<exact id from list>","reason":"<5-10 words>"}]`
}
```

### Scripture Suggestion Prompt Structure
```typescript
function buildScripturePrompt(params: {
  sermonTopic: string
  sermonPassage: ScriptureRef | null
  naturalLanguageQuery: string
  recentScriptures: { book: string; chapter: number; verseStart?: number; verseEnd?: number; weeksAgo: number }[]
}): string {
  const recentStr = params.recentScriptures.map(s =>
    `${s.book} ${s.chapter}:${s.verseStart ?? '1'}-${s.verseEnd ?? '?'} (${s.weeksAgo}w ago)`
  ).join(', ')

  return `Search: "${params.naturalLanguageQuery}"
Sermon topic: "${params.sermonTopic}"
Sermon passage: ${params.sermonPassage ? `${params.sermonPassage.book} ${params.sermonPassage.chapter}` : 'none'}
Recently used passages: ${recentStr || 'none'}

Return 3-5 scripture suggestions as JSON array:
[{"book":"<book name>","chapter":<number>,"verseStart":<number>,"verseEnd":<number>,"reason":"<5-10 words>","recentlyUsed":<boolean>,"weeksAgoUsed":<number|null>}]

Book names must exactly match standard Protestant canon (Genesis through Revelation).`
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Backend proxy required for CORS | Direct browser calls with `dangerouslyAllowBrowser: true` | August 2024 | Client-side AI apps no longer require server infrastructure |
| Prompt engineering for JSON only | `output_format` structured outputs beta | November 2025 | Guaranteed schema compliance, but still beta |
| All models the same | Haiku (cheap/fast) vs Sonnet (quality) vs Opus (complex) | Ongoing | Choose Haiku for high-frequency suggestion tasks; save Sonnet/Opus for complex reasoning |

**Recommended model:** `claude-haiku-3-5-20241022` — at $0.80/MTok input + $4/MTok output, a typical song suggestion call (600 input tokens, 100 output tokens) costs ~$0.0009. A hundred planning sessions = ~$0.09. Cost is not a concern at this scale.

**Deprecated/outdated:**
- `claude-instant-*` models: Deprecated; replaced by Haiku tier
- `claude-2.*` models: Legacy; do not use

---

## Data Shape Decisions (Claude's Discretion — Researched)

### What song metadata to send

The song library could have 50-200 songs. Each full Song object includes id, title, ccliNumber, author, themes[], notes, vwType, teamTags[], arrangements[], lastUsedAt, createdAt, updatedAt. Sending all this would be 15,000-40,000 tokens for a full library — potentially hitting cost and context limits for Haiku.

**Recommendation:** Send a minimal projection per song:
- `id` — required for ID validation
- `title` — primary matching signal
- `vwType` — slot constraint matching
- `themes[]` — thematic relevance (most valuable for AI matching)
- `lastUsedAt` — recency (as "X weeks ago" string, not Timestamp)

Omit: `ccliNumber`, `author`, `notes`, `teamTags`, `arrangements`, `createdAt`, `updatedAt`.

Estimated token cost with 150 songs: ~600 input tokens for the library section. Well within budget.

### Caching strategy

**Recommendation:** Simple `Map<string, T>` in component `ref`. Cache key = JSON.stringify of (sermonTopic + sermonPassage + slotVwType). Clear on sermon context change. No localStorage persistence — AI suggestions are session-specific and stale quickly.

### Loading state design

**Recommendation:** Use the existing spinner SVG pattern from ScriptureInput.vue for button-triggered single-slot requests. Use 3-line shimmer placeholder (gray-700/60 animate-pulse) for the "AI Picks" section in the SongSlotPicker dropdown while loading. This matches the dark-mode palette (gray-950 body, gray-900 cards, gray-800 inputs).

### Accept/reject actions for "Suggest All Songs"

**Recommendation:** Inline micro-interaction. The AI-drafted slot shows the song title in a slightly muted style (text-gray-300 vs normal text-gray-100), with a green checkmark button ("Accept") and gray X button ("Reject"). Accepting writes to `localService.slots` (doesn't auto-save). Rejecting reverts to the normal empty slot state. This makes the "draft" metaphor clear without a modal or side panel.

---

## Integration Point: Service Type Must Gain `sermonTopic`

The `Service` type in `types/service.ts` and `ServiceInput` type must gain `sermonTopic?: string`. This is a prerequisite for all other AI integration.

Also: `ServiceEditorView.vue` currently has the "Sermon Passage" row at line 157-170 (gray-900 rounded-lg card). The new "Sermon Topic" text input sits in the same card as the sermon passage — they are related context. Place them in a single "Sermon Context" card rather than two separate cards.

---

## Open Questions

1. **`sermonTopic` field placement in Firestore**
   - What we know: `Service` Firestore document currently has `sermonPassage: ScriptureRef | null` as a nullable field
   - What's unclear: Should `sermonTopic` default to `''` or `null` in Firestore? Empty string is simpler to check with `if (sermonTopic)`.
   - Recommendation: Default `''` (empty string). The `createService()` function in `services.ts` should include `sermonTopic: ''` in the initial document. The AI trigger condition is `sermonTopic.trim().length > 0 || sermonPassage !== null`.

2. **"Suggest Scripture" button — per-slot or shared?**
   - What we know: ScriptureInput.vue is used for both the sermon passage and scripture reading slots. It accepts `showOverlapWarning` prop to differentiate.
   - What's unclear: Should the "Suggest Scripture" button appear on the sermon passage slot too?
   - Recommendation: Add a `showAiSuggest?: boolean` prop to ScriptureInput. Pass `showAiSuggest={true}` only for scripture reading slots (where `showOverlapWarning={true}`). Sermon passage slot does not get AI suggestions — that's the pastor's choice.

3. **Scripture slot identifier for "recently used" detection**
   - What we know: Scripture slots are `ScriptureSlot` with book/chapter/verseStart/verseEnd. The services store has all past services.
   - What's unclear: What's the lookback window for "used recently" in scripture context?
   - Recommendation: Use 8 weeks (matching the existing rotation table window). Extract all ScriptureRef objects from the past 8 weeks of services to pass as context to Claude.

---

## Validation Architecture

The config shows `nyquist_validation` key is absent from `.planning/config.json`. Per research instructions, absent key = treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (already installed) |
| Config file | `vite.config.ts` (test section, environment: jsdom) |
| Quick run command | `npx vitest run src/utils/__tests__/claudeApi.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `getSongSuggestions` returns null on API error | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 |
| `getSongSuggestions` filters out hallucinated song IDs | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 |
| `getScriptureSuggestions` returns null on API error | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 |
| `getScriptureSuggestions` filters invalid book names | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 |
| `safeParseJsonArray` handles prose-wrapped JSON | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 |
| Service type + ServiceInput include sermonTopic | type-check | `npm run type-check` | ❌ Wave 0 |
| `rankSongsForSlot` still works after SongSlotPicker changes | unit (existing) | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/__tests__/claudeApi.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/claudeApi.test.ts` — covers all `claudeApi.ts` utility functions with mocked SDK
- [ ] `src/utils/claudeApi.ts` — the new utility file itself (not a test, but a Wave 0 creation)
- [ ] Framework install: none needed — Vitest already in devDependencies

---

## Sources

### Primary (HIGH confidence)
- [platform.claude.com/docs/en/api/sdks/typescript](https://platform.claude.com/docs/en/api/sdks/typescript) — SDK installation, `dangerouslyAllowBrowser`, request/response types
- [platform.claude.com/docs/en/api/messages](https://platform.claude.com/docs/en/api/messages) — Messages API parameters, model list, response structure
- [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Current model pricing (verified March 2026)
- Codebase read — `src/utils/suggestions.ts`, `src/utils/esvApi.ts`, `src/utils/scripture.ts`, `src/components/SongSlotPicker.vue`, `src/components/ScriptureInput.vue`, `src/views/ServiceEditorView.vue`, `src/types/service.ts`, `src/types/song.ts`, `src/stores/services.ts`, `package.json`

### Secondary (MEDIUM confidence)
- [simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) — CORS browser support history and security context
- [platform.claude.com/docs/en/build-with-claude/structured-outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — Structured outputs beta (November 2025)

### Tertiary (LOW confidence — not used for primary recommendations)
- WebSearch results on BYOK patterns — confirmed client-side key pattern is established practice for single-org internal tools

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Official SDK docs verified, model names and pricing from official pricing page
- Architecture: HIGH — Based on deep codebase read; integration points are verified from actual source files
- Pitfalls: HIGH — Song ID hallucination and JSON parsing issues are well-documented Claude API challenges
- Pricing: HIGH — Read directly from official pricing page on 2026-03-04

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (90 days; model pricing and SDK APIs change rarely at this level)
