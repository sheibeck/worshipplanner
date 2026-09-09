# Stack Research

**Domain:** Subsequent-milestone feature additions to an existing Vue 3 + Firebase worship-service
planner (v2.15: Vamps live audio, rehearsal/report times, service-update email links, deep-link org fix)
**Researched:** 2026-09-09
**Confidence:** HIGH (all three questions resolve to platform-API/no-new-dependency answers, verified
against official vendor docs and the app's own existing code)

## Headline Recommendation

**Add zero new npm dependencies for v2.15.** All four target features are covered by platform Web APIs
the app already uses elsewhere (`HTMLMediaElement`, `BroadcastChannel`/`postMessage`, `localStorage`,
`Intl.DateTimeFormat`, `<input type="date"|"time">`), or by wiring an already-shipped mechanism
(`{{service_link}}` token) into one more email template. This is consistent with the project's established
pattern of preferring `Intl`/plain strings over a date library and native storage APIs over an SDK — see
`functions/src/index.ts`'s `todayInTimeZone`/`minusDays` (pure `Intl.DateTimeFormat`, no library) and
`src/components/ServiceCard.vue`'s `parsedDate` (manual `split('-')` + local `Date` constructor, no
library).

## Recommended Stack

### Core Technologies

No changes. Vue `^3.5.29`, Vite `^7.3.1`, Pinia `^3.0.4`, TypeScript `~5.9.3`, Firebase JS SDK `^12.0.0`
(client) — all fixed, all sufficient for v2.15.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | No new supporting library is justified by any of the three researched questions. |

### Development Tools

No new dev tooling. Existing `vue-tsc --build` (`npm run type-check`) and `vitest` cover the new code the
same as any other feature.

## Installation

```bash
# No installation step — every capability below uses existing dependencies
# (firebase, vue) or built-in browser/DOM APIs.
```

---

## Question 1 — Autoplay of vamp MP3 in a non-interactive output window

**Answer: no library. Pure DOM (`HTMLMediaElement.play()`), reusing the existing `AudioPlayer.vue`
component and the existing `wp-fullscreen-delegate`-style same-origin `postMessage` idiom for a new,
analogous "arm audio" control-screen affordance.**

### The mechanism that actually matters: autoplay is gated per-ORIGIN, not per-window

Chrome's (and Chromium-Edge's) documented autoplay-with-sound policy allows unattended `play()` calls with
sound when **any one** of these is true (verbatim from Chrome for Developers, HIGH confidence — official
vendor doc):

- "The user has interacted with the **domain** (click, tap, etc.)."
- On desktop, the origin's Media Engagement Index (MEI) threshold has already been crossed (prior sessions
  played media with sound).
- The site is installed as a PWA / added to the home screen.

The load-bearing word is **domain**, not *tab* or *window*. This is an origin-scoped permission, not a
per-document gesture token. Practically: as soon as the projectionist clicks **anything** on the Run
Control screen (same origin as the output windows — they're the same Vue app, different routes/windows),
Chrome records "interacted with the domain" for `worship-planner-bc515.web.app` for the whole browser
profile. Every window subsequently opened from that origin — including the output windows opened
programmatically via `window.open()` from `useOutputWindow.ts`'s callers, which never themselves receive a
click — inherits the allowance. **No cross-window signaling is required for the common case**, unlike
Fullscreen (see below) which is explicitly gesture-scoped per document and *does* need the delegation
`postMessage` the app already built.

This is corroborated by MDN's guide (HIGH confidence) restating the same "user has interacted with the
site" condition without narrowing it to a tab, and matches this app's own precedent: `AudioPlayer.vue`
already calls `el.play()` unattended today for slide-group bed audio and per-slide `audioUrl`s inside the
Run outputs (see `src/utils/slideshowAssembler.ts`'s `resolveEntryMedia`), and that has already shipped and
worked in production church use through v2.14 — i.e. this "click on the control screen unlocks the whole
origin" mechanism is not a new bet, it is the reason the existing bed-audio autoplay already works today.

### What is still a real risk, and the concrete mitigation

MEI/"interacted with the domain" is **per browser profile, first-use dependent** — a freshly provisioned
kiosk/projector Chrome profile, or a profile where the projectionist happens to open the *output* window
before ever clicking anything on the *control* window (e.g. by re-opening a previously-placed output window
after a browser restart, before touching Run Control again this session), can still land in the
"disallowed" state. `AudioPlayer.vue` already has defense-in-depth for this: it catches
`DOMException('NotAllowedError')` from `play()` and emits `autoplay-blocked`, flipping on a `showPlayAffordance`
"Play audio" button (`retryPlay`). **That fallback button is useless in a non-interactive output window** —
no one is looking at the projector to click it. Two concrete, testable additions close this gap without a
library:

1. **Pre-flight check on the Run Control screen** (the interactive surface, where a human *can* act):
   feature-detect and call `navigator.getAutoplayPolicy?.('mediaelement')` (Chromium-only; not in the
   TS lib types — cast the same way `useOutputWindow.ts` already casts `{ name: 'fullscreen',
   allowWithoutGesture: true }` to `PermissionDescriptor`). If it reports `'disallowed'`, surface an
   inline "Enable sound for this service" banner/button on Run Control itself. A click there is a real
   gesture on the domain and immediately flips the origin's allowance for every window, including
   already-open output windows (the next `play()` attempt on the *next* audio-bearing slide will succeed —
   no need to retroactively "unstick" anything already open). `navigator.getAutoplayPolicy` is
   Chromium-only (absent in Firefox/Safari), which is fine: v2.4 already scoped Run/output windows to
   Chrome/Edge only.
2. **Keep (do not remove) `AudioPlayer.vue`'s existing `autoplay-blocked` emit and `showPlayAffordance`
   button** as belt-and-suspenders — on the rare machine where the pre-flight check under-detects, the
   output window still degrades to a visible (if silent-until-clicked) button rather than throwing.

### Ruled out, and why

- **Web Audio API / `AudioContext.resume()` unlock pattern** — not applicable. This app plays vamps/beds
  through a plain `<audio>` element (`HTMLMediaElement`), not a Web Audio graph. `AudioContext.resume()`
  solves a different API's suspended-state problem; there is nothing in this codebase to resume. Do not
  introduce Web Audio just to get an "unlock" hook — `HTMLMediaElement.play()`'s own promise rejection
  already gives an equivalent, and cheaper, signal.
- **Muted-then-unmute autoplay** — Chrome's own recommended pattern for *video* content the user didn't
  explicitly request, not applicable here: a vamp is audio-only and the entire point is that it must be
  audible the instant its slide goes live: starting muted and asking someone to unmute defeats the feature
  (there is no one at the projector to unmute it).
- **`navigator.userActivation` (`isActive`/`hasBeenActive`)** — read-only introspection of the *current
  document's* transient activation. It cannot arm or transfer activation into a different window, and (per
  MDN) is not documented as an unlock mechanism at all — only `getAutoplayPolicy` and the actual `play()`
  call/catch are. Useful only as a debugging aid, not a solution.
- **Any third-party "autoplay unlock" library** (e.g. `use-sound`, `howler.js`, unlock-audio shims) — these
  all reduce to the same `play()`-in-a-gesture-handler + origin-MEI mechanics described above, dressed up
  with an API surface this app doesn't need (playlists, sprite sheets, cross-browser Web Audio
  normalization). Adding one would be strictly more surface for zero new capability.

### Confidence: HIGH
Sourced from Chrome for Developers' official autoplay policy blog post and Chromium's own design-rationale
page (both vendor-authoritative for Chrome/Edge, the app's only Run-output target), cross-checked against
MDN's autoplay guide, and against this app's own already-shipped `AudioPlayer.vue`/`useOutputWindow.ts`
behavior.

---

## Question 2 — Persisting the active org across a genuinely-new tab

**Answer: `localStorage`, same key shape as the existing `sessionStorage` entry, swapped in
`src/stores/auth.ts`. No IndexedDB, no cookie, no new dependency. Layer a deep-link-derived org as a
secondary, higher-priority signal when the route itself names an org.**

### Why `localStorage`, not IndexedDB or a cookie

- **Firebase Auth itself already solves the "does a new tab know who I am" problem this way.** The
  Firebase JS SDK's default persistence, `browserLocalPersistence`, stores the auth session in **IndexedDB**
  (with `localStorage` as its own internal fallback when IndexedDB is unavailable) — that's *why* a
  brand-new tab in this app is already signed in; the reported bug is specifically that the *org choice*
  doesn't follow the *already-persisted* session. This app does not configure Firebase Auth persistence
  explicitly (grep found no `setPersistence`/`browserSessionPersistence` call), so it is on the default —
  confirming auth survives new tabs is not the gap; org selection is.
- **`localStorage` is the standard, purpose-built API for exactly this problem**: same-origin,
  cross-tab/cross-window, survives new tabs/windows opened any way (typed URL, bookmark, right-click →
  "Open in new tab," `window.open`) because it isn't tied to a single top-level browsing-context group the
  way `sessionStorage` is. This is precisely the gap in the current code: the `SELECTED_ORG_STORAGE_KEY`
  comment in `src/stores/auth.ts` documents that `sessionStorage` was a **deliberate choice** ("survives a
  page refresh but a full logout clears it — matching 'log out and back in to switch churches'"), not an
  oversight — but a genuinely new tab does not share the *first* tab's session-storage bucket, which is the
  reported bug.
- **Do not co-opt IndexedDB.** Firebase Auth's use of IndexedDB is internal SDK plumbing (async, versioned,
  schema-owned by the SDK) — there is no supported, forward-compatible way to "co-locate" an app-owned key
  inside it, and doing so would swap a one-line synchronous `localStorage.getItem` for an async API in a
  code path (`src/router/index.ts`'s org-selection guard, `readRememberedOrg`/`rememberOrg` at
  `src/stores/auth.ts:72-98`, called synchronously at lines 525/676/893) that is currently synchronous by
  design. That would be a materially larger, riskier change for zero behavioral gain over `localStorage`.
- **Do not use a cookie.** Cookies add a network-visible attribute (sent on every request to the Firebase
  Hosting origin) for a value the client-side router already needs client-side only; they also require
  explicit `SameSite`/`Secure`/expiry decisions this app has never needed elsewhere. `localStorage` is the
  narrower, already-idiomatic tool (the app already reaches for browser Storage APIs for exactly this kind
  of "remember a client-side choice" state).

### The swap is mechanical and preserves every existing invariant

`readRememberedOrg`/`rememberOrg`/`clearRememberedOrg` (`src/stores/auth.ts:70-98`) already:
- key the value by `uid` (so one browser can't leak org choice across accounts on a shared machine) —
  unchanged, keep as-is;
- guard every access in `try/catch` (`sessionStorage`/`localStorage` both throw in some privacy
  modes/quota conditions) — unchanged, keep as-is;
- call `clearRememberedOrg()` **explicitly** on logout (`src/stores/auth.ts:893`) rather than relying on
  the storage type's own lifetime to clear it — this means the "log out and back in to switch churches"
  behavior the original comment cared about is **preserved unchanged** by an explicit code path, not by
  `sessionStorage`'s tab-scoped expiry. Swapping the two `sessionStorage.getItem/setItem/removeItem` calls
  in those three functions for `localStorage.getItem/setItem/removeItem` is the entire fix; no call-site
  changes elsewhere in the codebase are needed.

### Secondary signal worth adding: prefer the deep-link's own org when the route names one

Where a route encodes the org explicitly (e.g. a share/volunteer link keyed by org slug, or any future
`/{orgSlug}/...` path), the router guard should resolve org from **the route first**, falling back to the
`localStorage` remembered choice only when the route is ambiguous (e.g. `/dashboard` with no org in the
URL). This is not a storage-mechanism decision — it is a precedence rule in
`src/router/index.ts:270-352`'s existing guard — but it matters for the exact "open in a new tab" bug: a
right-click-opened link to a specific service/share page should land the user on *that* org even if
`localStorage` remembers a different one from other work, and it also degrades gracefully if `localStorage`
is unavailable (private browsing / cleared storage) since the deep link is self-sufficient.

### Confidence: HIGH
Firebase Auth's default persistence behavior (IndexedDB, localStorage-fallback) is documented in Firebase's
own SDK reference; `localStorage`'s cross-tab, same-origin semantics are basic, stable Web Platform
behavior unchanged in years. Verified directly against this app's own `src/stores/auth.ts` and
`src/router/index.ts`.

---

## Question 3 — Rehearsal & report time input/storage

**Answer: plain `<input type="time">` (paired with the app's existing `<input type="date">`), storing each
rehearsal/report time as a separate `HH:mm` 24-hour string alongside the existing `YYYY-MM-DD` date string.
No date/time library, no `<input type="datetime-local">`, no combined Date/Timestamp field.**

### `<input type="time">` is sufficient — and it's the format-compatible choice

- `<input type="time">`'s `.value` is already a normalized, zero-padded 24-hour `HH:mm` string
  (`"08:45"`), locale-independent regardless of how the native picker displays AM/PM to the user. That is
  exactly the shape needed to sit next to the app's existing `YYYY-MM-DD` date string as a second plain
  field — no parsing, no library, and it matches this app's established convention (seen in
  `functions/src/index.ts`'s `todayInTimeZone`/`minusDays` and `ServiceCard.vue`'s `parsedDate`) of storing
  calendar/wall-clock values as **plain strings** and only constructing a `Date` object at the point of
  *display formatting*, never as the storage representation.
- Browser support for `<input type="time">` is universal across Chrome/Edge/Firefox/Safari in 2026
  (including desktop Safari, whose historical gap closed years ago) — a non-issue for both the planner-side
  editing UI (Chrome/Edge, per the app's existing target) and the read-only display surfaces (dashboard, My
  Schedule, share views) that may be viewed on any device/browser.

### Do not use `<input type="datetime-local">` or combine into one field

- `datetime-local`'s value (`"2026-09-13T08:45"`) is **also just a naive local string with no timezone
  information** — it offers zero real advantage over the app's existing separate date+time fields, while
  introducing a *second, different* date-string shape (`T`-separated ISO-8601-like) into a codebase whose
  every other date value is the plain `YYYY-MM-DD` split-on-`-` shape. That would fork the parsing idiom
  for no benefit and risk a component reusing the wrong split logic.
- **Keep rehearsal dates and the report time as separate `date` + `time` fields**, matching the service's
  existing `date: string` field precisely, rather than merging into one combined value at all.

### The timezone pitfall to flag explicitly for phase planning

The org's IANA `timezone` field (`src/types/organization.ts`, `DEFAULT_ORG_SETTINGS`) is **already real,
load-bearing infrastructure** — `functions/src/index.ts`'s `todayInTimeZone(org.settings.timezone, now)`
uses it server-side (via plain `Intl.DateTimeFormat`, no library) to compute calendar-day boundaries for
reminder scheduling. It is **not** currently wired into any client-side `Intl.DateTimeFormat({ timeZone:
... })` call for display — every `Intl.DateTimeFormat` use found in `src/components`/`src/views` formats
in the *browser's local* zone, not the org's.

This matters for report/rehearsal times specifically because they are physical, single-location wall-clock
times ("8:45 AM at the church building"), not floating personal-calendar times. Two concrete rules to give
phase planners, both zero-library:

1. **Never construct a JS `Date`/Firestore `Timestamp` from `(date, time)` for display or storage of the
   time-of-day itself.** A `Date`/`Timestamp` is an absolute UTC instant; combining a naive local date +
   naive local time into one and rendering it with `.toLocaleTimeString()` silently reinterprets it through
   *whichever timezone the viewing browser happens to be in* — which will show the wrong clock time for any
   volunteer viewing My Schedule from outside the org's own timezone, and can drift the *date* by one day
   for evening/late-night rehearsal times near a UTC offset boundary. Keep `time` a plain `HH:mm` string,
   exactly parallel to how `date` is kept a plain `YYYY-MM-DD` string today.
2. **When displaying a time-of-day, format it as a literal wall-clock label** (e.g. `"8:45 AM"` derived
   directly from the stored `HH:mm`, with a simple 24h→12h conversion or a `Date.UTC`-pinned
   `Intl.DateTimeFormat({ timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })` call analogous to
   `formatServiceDate`'s existing UTC-pin trick) rather than re-interpreting it through the org's IANA zone
   at render time. The org `timezone` field's role for this feature is answering "is this rehearsal today,
   from the org's point of view" (mirroring `todayInTimeZone`'s existing job) — not converting the
   displayed clock time for a remote viewer. Flag to the requirements/phase-planning step as an explicit
   product decision to confirm: report/rehearsal times display as the literal time entered (assumed
   correct, since this is a single physical venue), never zone-shifted per viewer.

### Confidence: HIGH
`<input type="time">` behavior and browser support are stable, long-settled Web Platform facts; the
timezone-pitfall analysis is grounded directly in this codebase's own existing (and already-tested)
`todayInTimeZone`/`minusDays`/`parsedDate` functions, not external sources.

---

## Question 4 (context, not separately asked) — service-update email link

Not a stack question — no new dependency of any kind. `{{service_link}}` (`functions/src/messageTokens.ts`)
and `resolveServiceLink`/`ensureShareLink` already exist and are already used by at least one email flow;
v2.15's work here is wiring the same token into the order-of-service update/reminder send path and adding a
regression test that asserts the link is present, not introducing new plumbing.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Pure DOM `play()` + origin-level autoplay allowance + existing `AudioPlayer.vue` fallback | Web Audio API (`AudioContext`) | Only if the app ever needs mixing, crossfading, or precise sample-accurate scheduling of multiple simultaneous audio sources — not needed for "one vamp MP3 plays as one slide's audio." |
| `localStorage` for active-org persistence | IndexedDB (co-located with Firebase Auth) | Only if the app needed to store org selection as part of a larger structured, versioned client-side dataset — not the case for a single `{uid, orgId}` pair read synchronously in a router guard. |
| `localStorage` for active-org persistence | A signed cookie | Only if a **server-rendered** route (e.g. an SSR framework) needed the org at request time before any client JS runs — this app is a client-side SPA with no SSR, so nothing server-side ever needs to read this value. |
| Separate `<input type="date">` + `<input type="time">`, plain string storage | `<input type="datetime-local">` | Only if the app were introducing timestamp-precision scheduling (e.g. sub-day recurring cron rules) rather than a human-entered wall-clock time paired with an existing date field. |
| Separate `<input type="date">` + `<input type="time">`, plain string storage | `date-fns`/`dayjs`/`luxon` for parsing/formatting | Only if the app needed timezone-aware arithmetic across many zones, recurring-rule expansion (RRULE), or relative-time formatting — none of which v2.15 requires; the two calendar/time values here are single-venue wall-clock strings, and the codebase's own `Intl`-only precedent already covers the actual need (compare "is this date today in the org's zone"). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Any autoplay-unlock/audio-sprite library (`howler.js`, `use-sound`, etc.) | Solves a problem (cross-browser Web Audio normalization, sprite management) this app doesn't have; the actual blocker is a browser *policy*, not an API gap, and no library can bypass browser autoplay policy beyond what a real user gesture + the existing `AudioPlayer.vue` catch/retry already provide. | `HTMLMediaElement.play()` via the existing `AudioPlayer.vue`, plus a `navigator.getAutoplayPolicy` pre-flight check + "Enable sound" affordance on the interactive Run Control screen. |
| `AudioContext`/Web Audio API for vamp playback | Not what any existing per-slide audio path (`audioUrl`/`bedAudioUrl`/`AudioPlayer.vue`) uses; introducing it alongside the existing `<audio>` element approach would create two parallel audio-playback mechanisms in the same app for no functional gain. | Reuse the shipped `audioUrl`/`audioLoop`/`AudioPlayer.vue`/`resolveEntryMedia` pipeline exactly as v2.15's own milestone notes specify. |
| IndexedDB (app-owned key) for org persistence | Async API forced into a currently-synchronous router-guard code path; no supported way to safely co-locate app data inside Firebase Auth's own IndexedDB store. | `localStorage`, same key/uid-scoping shape as the existing `sessionStorage` implementation. |
| A cookie for org persistence | Adds server-visible, network-transmitted state for a value only the client-side SPA router ever reads; needs new `SameSite`/`Secure`/expiry decisions this app has never had to make. | `localStorage`. |
| `<input type="datetime-local">` or a combined `Date`/`Timestamp` field for rehearsal/report times | Forks the app's established plain-string date/time idiom into a second, incompatible shape; a combined `Date`/`Timestamp` silently binds a wall-clock time to whichever timezone later reads it, which is the exact class of bug the app's `parsedDate`/`todayInTimeZone` functions were already written to avoid for the plain `date` field. | Separate `<input type="date">` (existing) + `<input type="time">` (new), each stored as its own plain string (`YYYY-MM-DD` / `HH:mm`), formatted for display the same UTC-pinned way `formatServiceDate` already does. |
| `date-fns` / `dayjs` / `luxon` / `moment` | No genuine timezone-arithmetic, recurrence, or locale-formatting need in v2.15 that the app's existing pure-`Intl` idiom doesn't already cover; `moment` specifically is in maintenance mode and explicitly steers new adopters elsewhere. | `Intl.DateTimeFormat` / native `Date`, following `functions/src/index.ts`'s `todayInTimeZone`/`minusDays` pattern. |

## Stack Patterns by Variant

**If a future milestone adds true cross-timezone volunteer scheduling** (e.g. a remote worship pastor in a
different IANA zone needing rehearsal times converted to *their* local clock):
- Then, and only then, introduce a minimal timezone-conversion utility (still `Intl.DateTimeFormat`-based;
  a library is still unlikely to be justified for single-value zone conversion) and store rehearsal/report
  times as an explicit `{ date, time, timezone }` triple rather than assuming the org's zone for every
  reader.
- Because today's model (single physical venue, everyone in the same building/timezone) doesn't need it,
  and speculative timezone-generality has been the exact category of complexity this codebase has
  deliberately avoided elsewhere (see the `parsedDate`/`todayInTimeZone` precedents, both scoped to "one
  org, one zone").

**If Run-output autoplay proves unreliable on a specific owner's hardware during UAT** (per the milestone's
own "verify audible output under browser autoplay policy" callout):
- Then add a small, explicit "test audio" step to the monitor-setup/Run-Control flow (a short, obviously
  audible chime played via the same `AudioPlayer.vue`/`play()` path, triggered by a real click) as a
  one-time per-device confidence check, surfaced next to the existing per-display "Go fullscreen" buttons.
- Because that mirrors the app's own existing "Automatic Fullscreen" per-computer setup precedent
  (`docs/run-fullscreen-setup.md`) for a policy that is also profile/device-scoped rather than app-scoped —
  consistent UX for two conceptually similar one-time browser-permission situations.

## Version Compatibility

Not applicable — no new packages are introduced, so no new cross-package version constraints exist. The
existing `firebase@^12.0.0` / `vue@^3.5.29` / `vite@^7.3.1` / `typescript@~5.9.3` pins are unaffected by any
of the above.

## Sources

- Chrome for Developers — ["Autoplay policy in Chrome"](https://developer.chrome.com/blog/autoplay/) —
  verbatim autoplay-with-sound conditions, incl. "interacted with the domain" (per-origin, not per-tab).
  HIGH confidence (official vendor doc).
- Chromium.org — ["Autoplay"](https://www.chromium.org/audio-video/autoplay/) and ["Autoplay Policy Design
  Rationale"](https://www.chromium.org/audio-video/autoplay/autoplay-policy-design-rationale/) — confirms
  gesture-counts-across-tabs framing. HIGH confidence.
- MDN — ["Autoplay guide for media and Web Audio
  APIs"](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — cross-browser restatement of
  the interaction requirement, `navigator.getAutoplayPolicy` usage pattern. HIGH confidence.
- caniuse.com — `navigator.getAutoplayPolicy` support surface (Chromium-only). MEDIUM confidence
  (aggregator; treated as directional only, matches this app's existing Chrome/Edge-only Run-output scope).
- Firebase JS SDK docs / `firebase/firebase-js-sdk` reference (`auth.persistence.md`) — default
  `browserLocalPersistence` uses IndexedDB with localStorage fallback. HIGH confidence (official SDK docs).
- This codebase, read directly: `src/stores/auth.ts` (org-remember functions + comment explaining the
  deliberate `sessionStorage` choice), `src/components/AudioPlayer.vue` (existing autoplay-blocked
  fallback), `src/composables/useOutputWindow.ts` (existing same-origin `postMessage` gesture-delegation
  precedent for Fullscreen, `ADR-0125`), `src/utils/runChannel.ts` (existing `BroadcastChannel` control
  protocol), `src/components/ServiceCard.vue` (`parsedDate` plain-string idiom), `functions/src/index.ts`
  (`todayInTimeZone`, `minusDays`, `formatServiceDate` — org-timezone + UTC-pin idioms already in
  production), `src/types/organization.ts` (`DEFAULT_ORG_SETTINGS.timezone`). HIGH confidence (ground
  truth).

---
*Stack research for: WorshipPlanner v2.15 (Vamps live audio, rehearsal/report times, org-persistence fix,
service-update email link)*
*Researched: 2026-09-09*
