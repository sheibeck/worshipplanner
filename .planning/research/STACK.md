# Stack Research

**Domain:** Browser-based live-presentation output (transparent/chroma-key banner-video) + Firebase real-time viewer presence, added to an existing Vue 3 + Firebase (Firestore/Auth/Functions/Storage) SPA
**Researched:** 2026-09-07
**Confidence:** HIGH (architecture/platform-limits claims) / MEDIUM (presence interval convention, no single documented standard)

**Scope note:** This is an *additive* stack review for v2.14's two new-tech features only. Nothing here
replaces or reconsiders the app's existing stack (Vue 3, Pinia, Firebase, the Window Management API
multi-monitor output system from v2.4/v2.9). The headline finding for both features is **near-zero new
dependencies** — both are architecture/pattern additions on top of what's already installed.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CSS `background: transparent` / RGBA fill on the existing output-view root | n/a (platform CSS) | Best-effort alpha for the new Video output's non-banner region | Costs nothing, and is genuinely honored by embedded-renderer capture paths (OBS/vMix "Browser Source," which use an off-screen CEF surface with an alpha channel) even though it is **not** honored by real OS window/HDMI capture (see Alternatives/What-NOT below) |
| Configurable solid "key color" (HTML `<input type="color">`, no library) | n/a (platform HTML) | The actual, hardware-compatible transparency mechanism for the Video output's non-banner region, and the fallback whenever CSS alpha isn't honored | **HDMI/SDI carries no alpha channel.** The owner's Blackbird box (Monoprice Blackbird — confirmed via product research) is a pure **matrix router/distribution switcher**, not a keyer; it passes whatever RGB pixels the app renders straight through unchanged. The only way for *any* downstream hardware (Blackbird, a capture card, an ATEM-class switcher) to key out the non-banner region is classic **chroma-key**: paint it a known solid color and let the mixer's key filter cut it. This is a plain color-fill in the existing Vue output view, not a rendering feature — no shader/canvas work needed on our side. |
| Firestore `serverTimestamp()` heartbeat doc + `onSnapshot` (already in the stack — Firebase JS SDK `^12.0.0`) | 12.x (already pinned) | Real-time "who's viewing this service" presence | The app is Firestore-first already; a presence *document* (not a new database) reuses the exact primitive every other live feature in this app already uses (service docs, roster docs, `RunControlView`'s `runChannel`). Zero new product surface, zero new billing line, zero new `firestore.rules` file to reason about — one more collection under an existing rules pattern. |
| Firestore **TTL policy** (GA feature, console/`gcloud firestore fields ttls update`, not an SDK call) | n/a (server-side config) | Garbage-collect abandoned presence docs (crashed tab, closed laptop lid) | Confirmed **GA** (not preview) as of current docs. It is *not* real-time (Google documents deletion "typically within 24 hours" of the TTL field's timestamp) — treat it purely as a cost/hygiene backstop, never as the mechanism that hides a stale viewer from the UI (that's the client-side staleness check below, which is instant). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Page Visibility API (`document.visibilityState`, already used in `useOutputWindow.ts`'s `handleVisibilityChange`) | n/a (platform) | Pause/resume the presence heartbeat when a tab is backgrounded | Reuse the exact idiom already in this codebase (wake-lock re-acquire on `visibilitychange`) so a minimized/backgrounded editor tab doesn't keep writing heartbeats every 25–30s for no reason — cuts presence write volume roughly in proportion to how much time editors spend tabbed away. |
| `navigator.sendBeacon` / `visibilitychange`+`pagehide` best-effort delete | n/a (platform) | Proactively remove a presence doc on tab close/navigate-away | Not guaranteed (crash, force-quit, killed background tab on mobile all skip it) — this is optimistic-cleanup only; the heartbeat-staleness check + TTL are the actual guarantees. Do not build logic that assumes this fires. |
| None (no new npm package) for the Video output's rendering itself | — | Banner/full-screen slide layout | The existing `SlideCanvas` + `useContainScale` (1280×720 canonical stage, letterboxed) already used by `AudienceOutputView`/`ConfidenceOutputView` is reused unchanged; "Banner" is a CSS layout variant (constrain the stage to a bottom-fraction region, key-color-fill the rest) inside a new `VideoOutputView.vue` built the same way as the other two output views via `useOutputWindow({ role: 'video' })`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| None new | — | Both features are exercised with the existing Vitest + `firebase emulators:exec` (`npm run test:rules`) setup already in this repo. Presence rules (who can write/read a `presence` doc) get the same rules-test treatment as every other subcollection. |

## Installation

```bash
# No new npm packages for either feature.
# Firestore TTL policy is configured out-of-band (Console or gcloud), not code:
gcloud firestore fields ttls update expiresAt \
  --collection-group=presence \
  --enable-ttl \
  --project=worship-planner-bc515
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| CSS transparent background + solid-color chroma-key fallback for the Video output | True OS-level window transparency (per-pixel alpha compositing of the browser window itself) | **Not achievable from a stock Chrome/Edge tab or `window.open()` popup.** Real per-pixel window transparency (what Electron's `transparent: true` `BrowserWindow` or a compositor-level tool provides) requires a native/Chromium-embedding shell — out of place for this app, which deliberately ships as a plain web SPA opening plain browser windows (v2.4's own research already concluded zero-click multi-monitor "true" browser tricks don't hold up on real hardware; treat this the same way). |
| Firestore heartbeat + client-side staleness + TTL backstop | Firebase **Realtime Database** presence (`onDisconnect()`) | RTDB's `onDisconnect()` is the textbook Firebase presence pattern *if you're already on RTDB*. This app is Firestore-only. Adding RTDB solely for presence means a second database product, a second rules file/security model, and a second thing to reason about on every future feature — for one small feature. Only reconsider if a future feature needs `onDisconnect()`'s true server-side "connection dropped" signal (sub-second accuracy), which viewer-presence-on-a-planning-doc does not. |
| Firestore heartbeat + TTL | Third-party realtime-presence SaaS (Ably Presence, Pusher Presence Channels, Supabase Realtime) | Never, for this app. Introduces a new vendor, a new API key/secret, a new cost surface, and duplicates what Firestore's own `onSnapshot` already gives for free once the presence doc exists. This project is on Firebase Blaze under active cost hardening (v1.8/v1.9) — adding a billed third-party real-time service for a "dot showing who's viewing" feature is a net-new recurring cost for something Firestore already does. |
| Solid-color chroma-key fill (client renders the key color itself) | A WebGL/canvas chroma-key **decode** shader (e.g., the "production-ready green screen in the browser" technique) | That technique *removes* a chroma-key color from an incoming video feed at *display* time (a receiver-side trick). This app is the *sender* — it only has to paint a clean, solid, uncompressed key color; there is nothing to decode client-side. Pulling in a shader/canvas compositing library would be solving a problem this feature doesn't have. |
| Client-composited banner (Vue view renders the "key-color background + bottom text banner" in one output) | Professional dual-output "Fill + Key" (two synchronized outputs — one full-color "fill," one grayscale alpha "key" — feeding a Blackmagic-class keyer's two inputs) | This is the real broadcast-grade technique or paths like ProPresenter's Blackmagic Alpha-Module output; it requires a second synchronized video output and Blackmagic (or similar) capture hardware most churches don't have, and the owner's Blackbird box is confirmed to be a router, not a keyer, so there's no downstream device to feed a Key signal to today. Note this as the natural *next* step if the church ever adds a real hardware keyer/switcher — don't build for it now. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Firebase Realtime Database (added just for presence) | Second database product/security model for one small feature; this app has been deliberately Firestore-only through 13 shipped milestones | Firestore heartbeat doc + `onSnapshot`, per this research |
| Electron, Tauri, or any native/CEF shell to get "real" window transparency | Turns a web SPA into a desktop-app build/release problem (installers, auto-update, code signing) to solve a problem chroma-key already solves for free | CSS transparent background (best-effort, for the rare downstream OBS-Browser-Source path) + solid key-color fill (the actual working mechanism for HDMI-based capture) |
| Any NDI SDK / WebRTC media-server library (e.g., `grandiose`, mediasoup, an NDI bridge) | The owner's scope decision (2026-09-07) is explicit: this milestone builds the **app side only** — the Video output role, Banner/Full-screen choice, and transparent/key-color render. Physical Blackbird keying/compositing is an **external integration verified separately**, not this milestone's code. Pulling in an NDI/WebRTC dependency would be building the exact thing scoped out. | Nothing — ship the plain browser output view; treat hardware integration as a future, separately-scoped milestone if the owner's research on Blackbird's actual behavior calls for it |
| A canvas/WebGL chroma-key **removal** library (e.g., `seemly`, custom shader pipelines) | Solves the receiver-side "cut a color out of incoming video" problem; this app is the sender producing a clean key-color fill, not decoding one | Plain CSS/DOM background color |
| A presence/collaboration UI library (e.g., a full "who's editing" framework, Liveblocks, Yjs awareness) | These solve live *co-editing* (cursors, conflict-free merges) — a much bigger problem than "show an avatar/dot for who else has this service open." The requirement here is read-only awareness, not collaborative editing. | A small custom `presence` subcollection + a lightweight avatar-list component, per this research |
| Relying on Firestore TTL as the *primary* staleness signal | TTL deletion is "typically within 24 hours" — a viewer who closed their laptop 5 minutes ago would still show as "here" for up to a day if TTL were the only check | Client-side staleness check (hide any presence doc whose `lastSeen` is older than ~60s) as the real-time signal; TTL only for eventual storage cleanup |

## Stack Patterns by Variant

**If the church's downstream video path is a hardware router/switcher (Blackbird, an HDMI matrix, most capture cards) — the common case per current context:**
- Use the **solid key-color fill** as the actual transparency mechanism.
- Default the key color to a **saturated magenta (`#FF00FF`)** rather than green — sanctuary/stage environments commonly have green-heavy elements (foliage, some LED wash colors, occasionally green vestments/props) that a green key would eat into; magenta rarely occurs naturally on a stage. Make it configurable (plain `<input type="color">`, no library) since some churches' downstream keyer may already be tuned for a specific color.
- CSS `background: transparent` on the same region costs nothing to also set — it's free insurance for the rare church whose "video output" is actually consumed as an OBS/vMix Browser Source instead of a physical HDMI signal, where the alpha *will* be honored.

**If a future milestone adds a real hardware keyer/switcher (Blackmagic ATEM-class) instead of the current router:**
- Revisit "Fill + Key" dual-output as a real option — it needs a second synchronized output stream, which is a materially bigger feature (new output-window pairing, frame-sync concerns) and should be its own scoped milestone, not folded into this one.

**For presence, regardless of concurrency:**
- Heartbeat interval **~25–30s**, staleness threshold **~2× the heartbeat (~60s)** — this is the common convention seen across presence write-ups (Firestore- and Supabase-based alike); there is no single official Firebase-documented number because Firestore has no native presence feature, so treat this as a reasonable default, not a verified platform constant.
- Scope the presence subcollection per service (`services/{serviceId}/presence/{uid}`) so `firestore.rules` can reuse the existing per-service org-membership check already governing that document tree, and so cleanup/TTL scoping is trivial.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `firebase@^12.0.0` (already pinned) | Firestore TTL policies | TTL is a **server-side database configuration** (Console or `gcloud`/Admin API), not a client-SDK feature — no SDK version dependency; works with whatever Firestore database version the project already uses. |
| `firebase@^12.0.0` `onSnapshot`/`serverTimestamp()` | Presence heartbeat pattern | No new SDK surface — both are already used elsewhere in this codebase (service docs, roster docs) via the same imports. |
| Vue `^3.5.29` / Pinia `^3.0.4` (already pinned) | New `VideoOutputView.vue` + a `usePresence` composable | Both features slot into the existing composable/store conventions (`useOutputWindow`, `useServiceAssembly`-style composables; a Pinia store or composable for presence, mirroring how `runChannel` is composed today) — no version constraint beyond what's already installed. |

## Sources

- Monoprice Blackbird 4K/4K60 product pages (web search, MEDIUM confidence, vendor-documented spec sheet) — confirms the Blackbird line is a **routing/distribution matrix switcher** (inputs→outputs, IR/RS-232/web control), with no keying/compositing feature, which is why chroma-key (not transparency) is the only hardware-viable mechanism downstream of it.
- Church Production Magazine — "Video Review: Blackmagic Design ATEM Production Switcher" (web search, MEDIUM confidence) — confirms the real "Fill+Key"/Alpha-Module workflow (e.g., ProPresenter → Blackmagic UltraStudio/DeckLink w/ Alpha Module → ATEM keyer) is the professional alternative to chroma-key, and requires switcher-class hardware this church does not currently have (per the owner's Blackbird-is-a-router context, captured 2026-08-28).
- OBS Forums + "Production-ready green screen in the browser" (Jim Fisher, web search, MEDIUM confidence) — confirms (a) OBS's embedded Browser Source can honor real CSS/canvas alpha because it renders off-screen via CEF rather than capturing a composited OS window, and (b) plain OS "Window Capture" of a browser window does **not** carry alpha — establishing the transparent-CSS-vs-chroma-key split used above.
- Firebase docs — "Manage data retention with TTL policies | Firestore" (`firebase.google.com/docs/firestore/ttl`, HIGH confidence, official docs) — confirms TTL is GA, configured via `gcloud firestore fields ttls update` or the Console, and that deletion happens "typically within 24 hours" of the TTL timestamp (not real-time).
- General Firestore-presence write-ups (web search aggregate incl. `vibe-studio.ai` "Real Time Presence Indicators With Firebase Or Supabase", LOW–MEDIUM confidence, no single canonical source) — corroborates the heartbeat + client staleness + TTL-backstop pattern as the accepted community workaround for Firestore lacking RTDB's native `onDisconnect()`.
- In-repo verification (HIGH confidence, primary source): `src/composables/useOutputWindow.ts` and `src/views/AudienceOutputView.vue` read directly — confirms the existing output-window architecture (`useOutputWindow({ role })`, `SlideCanvas` + `useContainScale` 1280×720 canonical stage, `Page Visibility`-driven wake-lock re-acquire) that a new `VideoOutputView.vue` should extend, not replace; `package.json` read directly for pinned `firebase@^12.0.0`/`vue@^3.5.29`/`pinia@^3.0.4`; grep confirmed **no existing presence/heartbeat/onDisconnect code and no existing color-picker library** in `src/`, so both are genuinely new (not duplicating something already built).

---
*Stack research for: live-stream banner/full-screen video output (transparency/chroma-key) + Firebase document viewer presence*
*Researched: 2026-09-07*
