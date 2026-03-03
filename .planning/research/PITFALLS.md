# Pitfalls Research

**Domain:** Church worship service planning app (Vue 3 + Firebase)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH (critical pitfalls verified from official docs and multiple community sources; some domain-specific items from single sources flagged accordingly)

---

## Critical Pitfalls

### Pitfall 1: Firebase Auth Race Condition with Vue Router Guards

**What goes wrong:**
On page refresh, `getAuth().currentUser` is `null` at the moment Vue Router's `beforeEach` guard runs — even when the user is logged in. The guard sees `null` and redirects to the login page, immediately bouncing authenticated users out of the app on every hard refresh.

**Why it happens:**
Firebase Auth initializes asynchronously. `onAuthStateChanged` hasn't fired yet when the router guard runs synchronously at startup. Developers use `getAuth().currentUser` (synchronous) instead of waiting for `onAuthStateChanged` (async event).

**How to avoid:**
Wrap `onAuthStateChanged` in a Promise that resolves once — then await it in `beforeEach`:

```javascript
// authGuard.js
let resolveAuthReady;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

onAuthStateChanged(auth, user => {
  resolveAuthReady(user);
});

// router.beforeEach
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const user = await authReady;
    if (!user) return '/login';
  }
});
```

**Warning signs:**
- Login works fine but refreshing a protected page redirects to login
- Users report "getting logged out randomly"
- Auth works in dev but breaks in production (caching differences)

**Phase to address:** Phase 1 (Authentication foundation) — must be solved before any protected routes exist.

---

### Pitfall 2: Firestore Data Model Designed Like a SQL Database

**What goes wrong:**
Developers normalize data the SQL way — songs in one collection, arrangements in another, service slots referencing song IDs — then try to "join" them at query time. Firestore has no joins. The result is either N+1 reads (fetching each song individually for a service plan), or over-engineering with Cloud Functions to simulate joins. Both cause cost explosions and slow UIs.

**Why it happens:**
SQL mental model applied to a NoSQL document store. Firestore charges per document read, not per query. Highly normalized data punishes you at read time.

**How to avoid:**
Denormalize for the primary read path. For a service plan, embed the song snapshot (title, key, BPM, category) directly in the service plan document rather than storing only a reference. Songs change rarely; plan data is read frequently. Use references only for the song's canonical record in the songs collection.

```
services/{serviceId}
  slots: [
    { songId: "...", title: "Open Up the Heavens", key: "G", bpm: 138, category: 1 },
    ...
  ]

songs/{songId}   // canonical source of truth, updated independently
```

**Warning signs:**
- Reading a service plan requires 5+ separate Firestore queries
- Song detail page triggers multiple `.get()` calls
- Firebase console shows read counts spiking on simple page loads

**Phase to address:** Phase 1 (Firestore data modeling spike) — data model decisions before any feature is built, since migrating Firestore structure is expensive.

---

### Pitfall 3: Firestore Security Rules Left Open During Development

**What goes wrong:**
Rules are set to `allow read, write: if true;` during development and deployed to production. Anyone who discovers the Firebase project ID (visible in client-side config) can read, overwrite, or delete all church data. This is not hypothetical — Firebase projects with open rules are indexed and exploited.

**Why it happens:**
Development convenience. Rules feel like a future concern. Firebase's free tier makes it easy to ship without noticing the exposure.

**How to avoid:**
Write minimum viable rules in Phase 1, alongside the data model. At minimum: require authentication for all reads/writes. Scope writes to document owners or team members. Use the Firebase Emulator Suite to test rules locally before every deploy:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // default deny
    }
    match /songs/{songId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isTeamMember();
    }
  }
}
```

**Warning signs:**
- `firestore.rules` contains `allow read, write: if true;`
- No rule tests exist (`.test.js` files for the emulator)
- Security rules haven't been updated since initial Firebase setup

**Phase to address:** Phase 1 (Authentication/data model) — rules must ship with the first deployed version, not as a follow-up hardening pass.

---

### Pitfall 4: Runaway Firestore Listeners Causing Memory Leaks and Cost Spikes

**What goes wrong:**
`onSnapshot` listeners are created in Vue components but never unsubscribed. When users navigate between pages, the component unmounts but the listener keeps running — re-subscribing on every visit. After extended use, dozens of active listeners accumulate, consuming reads and causing memory leaks. An initial load re-reads unchanged documents after any 30-minute gap (Firestore's cache expiry for listener billing).

**Why it happens:**
`onSnapshot` returns an unsubscribe function that developers forget to call. Vue's lifecycle isn't connected to Firebase cleanup automatically. Looks fine during a short dev session; only apparent after extended use.

**How to avoid:**
Always capture the unsubscribe function and call it in `onUnmounted`:

```javascript
// composables/useSongs.js
import { onSnapshot } from 'firebase/firestore';
import { onUnmounted } from 'vue';

export function useSongs() {
  let unsubscribe;

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  unsubscribe = onSnapshot(songsQuery, snapshot => {
    // handle data
  });
}
```

For static data that doesn't change (song library, past service plans), use `.get()` instead of `onSnapshot` — no listener to clean up, cheaper reads.

**Warning signs:**
- Firebase console reads count grows over time without new users
- Browser memory usage climbs during a session
- Chrome DevTools shows retained component references after navigation

**Phase to address:** Phase 1 (Firebase integration patterns) — establish the composable pattern with cleanup before building any feature that uses listeners.

---

### Pitfall 5: Song Suggestion Algorithm Degenerates Into a Fixed Playlist

**What goes wrong:**
The rotation algorithm correctly avoids songs used in the last 2 weeks but has no fairness mechanism for the full stable. Songs with fewer arrangements, lower BPM range, or narrower key compatibility keep getting filtered out. The effective pool shrinks to 15-20 "safe" songs that rotate constantly while 80% of the stable is never suggested. Worship leaders don't notice until they realize they haven't heard 40 songs in 6 months.

**Why it happens:**
The algorithm filters correctly (recent usage, team compatibility, category match) but has no affirmative mechanism to surface under-used songs. Recency avoidance alone doesn't guarantee equal rotation through the full stable.

**How to avoid:**
Sort eligible songs by days-since-last-used descending (longest gap first), not randomly. Add a "staleness" score: songs unused for 8+ weeks get boosted to the top of suggestions. Track `lastSuggestedDate` separately from `lastUsedDate` so a song that was suggested but not selected isn't penalized as if it was used.

The algorithm must track: last used date, last scheduled date, how many times used in the last 12 months, and days in stable. Songs with high `daysInStable` and low `useCount12Months` should rank highest.

**Warning signs:**
- Suggestions consistently surface the same 20-25 songs
- Users notice they "always see the same songs" in suggestions
- Song stable has 80+ songs but only 20 have been used in the last quarter

**Phase to address:** Phase 2 (Song suggestions feature) — build staleness tracking from day one, not as a refinement after users complain.

---

### Pitfall 6: CSV Import Silently Corrupts Song Data

**What goes wrong:**
Planning Center exports CSV files that contain songs with commas in titles/notes, multi-line notes fields, non-UTF-8 characters (smart quotes, em dashes from Windows/Excel), and BOM markers. A naive `split(',')` parser produces corrupted song records — wrong titles, merged fields, dropped data — with no error shown to the user. Songs import "successfully" but have garbage key, BPM, or tag data.

**Why it happens:**
Developers test with clean, simple CSV files they create manually. Real Planning Center exports are messier: quoted fields with embedded commas, UTF-8 with BOM, Windows line endings (CRLF), smart quotes (`"` / `"`), and arrangement data spread across up to 5 × 3 tag columns.

**How to avoid:**
- Use PapaParse (not a hand-rolled parser) — it handles quoted fields, CRLF, BOM, and encoding
- Detect encoding before parsing: check for BOM byte sequence `0xEF 0xBB 0xBF` and strip it
- After parsing, validate each row: required fields present, BPM is a number, key is a valid music key
- Show a validation summary UI before committing to Firestore: "47 songs found, 3 skipped (missing title), 2 warnings (BPM not a number)"
- Never silently discard rows — always report what was skipped and why

```javascript
import Papa from 'papaparse';

const result = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: h => h.trim(), // Planning Center headers may have trailing spaces
});

const validSongs = [];
const errors = [];

for (const row of result.data) {
  if (!row.Title) { errors.push({ row, reason: 'Missing title' }); continue; }
  // ... validate and transform
  validSongs.push(transformRow(row));
}

// Show preview before writing to Firestore
```

**Warning signs:**
- Song titles contain `"` characters at start/end
- BPM field shows `NaN` or a combined value like `72 beats`
- Songs with arrangement notes containing line breaks end up with split records
- Import "succeeds" but song count doesn't match Planning Center's reported count

**Phase to address:** Phase 1 (CSV import) — validation UI must ship with the import feature, not be added later after data corruption is discovered.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store everything in one Pinia store | Simple to start | Any reactive update re-renders the entire app; debugging becomes impossible | Never — use one store per domain from the start |
| Reference song by ID in service slots instead of embedding snapshot | Normalizes data cleanly | Every service view requires N+1 Firestore reads for song details | Never for WorshipPlanner — embed the snapshot |
| Skip Firestore security rules until "later" | Faster initial development | Production data exposed from first deploy | Never — rules must ship with v1 |
| Use `reactive({})` for arrays in Pinia | Feels natural | Reassigning the array (`state.songs = []`) breaks reactivity silently | Never — use `ref([])` for arrays |
| Global `onSnapshot` for all songs loaded once | Avoids repeated fetches | Any song update re-sends entire collection to every connected client | Acceptable for small stable (<200 songs) but disable when offline |
| Skip import validation UI | Faster to ship CSV import | Users corrupt their song stable silently; discovered weeks later | Never — show a preview/summary before committing |
| Use `signInWithRedirect` for Google OAuth | Mobile-preferred pattern | Broken on Chrome M115+, Firefox 109+, Safari 16.1+ without extra config | Never without configuring custom auth domain first |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Firebase Google OAuth | Using `signInWithRedirect` without configuring a custom auth domain | Use `signInWithPopup` as default, or configure Firebase Hosting custom domain to avoid third-party cookie blocking |
| Planning Center CSV export | Assuming consistent column order across exports | Always parse by column header name, never by column index; Planning Center may add/remove columns |
| Firebase custom claims for roles | Setting claims client-side via workarounds | Claims must be set server-side via Admin SDK (Cloud Functions); token refresh required after claim change — force refresh with `user.getIdToken(true)` |
| Firestore composite queries | Adding `where()` + `orderBy()` on different fields without creating the index | Firestore requires a composite index; the error only appears at runtime, not build time — test all query combinations in dev with emulator |
| Print-to-PDF service orders | Using flexbox/grid layout for the printable view | CSS print media has poor support for flex/grid page breaks; use block layout with `break-inside: avoid` for service order sections |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire song stable on every page load via `onSnapshot` | Slow initial load; high read counts | Load song stable once per session, cache in Pinia; use `.get()` not `onSnapshot` for the stable | At 200+ songs, noticeable; at 500+ songs, user-visible lag |
| Deeply reactive Pinia store with full song objects | Any field change triggers full re-render of song lists | Use `shallowRef()` for large collections; only deep-react fields that the UI binds to | At 100+ songs in the reactive store |
| No pagination on song list | Browser renders all songs at once | Virtual list (vue-virtual-scroller) or pagination for song library view | At 150+ songs, noticeable scroll jank |
| Storing full service history as an array in one Firestore document | Document hits 1MB limit; writes fail | Use subcollection `services/{id}` per week, not an array in `church/{id}` | After ~2 years of weekly plans stored in one document |
| Creating a new Firestore listener on every component mount | Read count grows with navigation frequency | Move listeners to a singleton composable or Pinia store with lazy initialization | Immediate — one round-trip per navigation |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Any authenticated user can write to any document | Malicious or mistaken team member overwrites all service plans | Firestore rules must check team membership before allowing writes; use a `members` array or subcollection on the church document |
| Invite links without expiry | Anyone who receives an old invite link can join the team | Store invite tokens in Firestore with `expiresAt` timestamp; mark used; validate on claim |
| Custom claims reflecting role (e.g., `admin: true`) without server-side validation | Client could trigger an unauthenticated Firebase Function to grant itself admin | Cloud Functions that set custom claims must verify the requestor's existing claims or use a pre-shared admin token |
| Shareable service plan link exposes all song data | Links sent to non-members expose the full song stable and team details | Shareable links should render a read-only view with only the relevant service plan; not grant Firestore access |
| Firebase config keys exposed but no App Check | Bots can use your Firebase project ID to hammer Firestore | Enable Firebase App Check (reCAPTCHA v3) to restrict SDK access to legitimate app instances |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Smart suggestions override user choices without warning | Planner selects a song, navigates away, returns to find it changed | Suggestions are read-only recommendations; user selection is always a manual confirmation; once confirmed, lock the slot |
| No "undo" for song slot changes during planning | Accidental drag-drop or key change is permanent | Implement local history per planning session (not Firestore transactions) — Ctrl+Z or an "undo last change" button |
| Print layout matches screen layout | Printable service order has nav bars, buttons, and colors that print as grey boxes | Dedicated `@media print` stylesheet; test with Chrome's print preview on every layout change |
| Song stable filter state lost on navigation | User filters songs by "Category 2 + Choir" then clicks a song, navigates back to find filters reset | Persist filter state in URL params or Pinia (not local component state) |
| Mobile view not tested during planning workflow | Wednesday rehearsal — worship leader can't pull up the plan on their phone | Design the service view (read-only on mobile) first; the planning UI can be desktop-first |
| Suggestions algorithm blocked on no results | Team compatibility filter removes all eligible songs, app shows empty list with no explanation | Always explain *why* results are empty: "No songs match Category 1 + Orchestra. 3 songs available without orchestra filter." |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **CSV Import:** Often missing encoding detection — verify with a Planning Center export that contains accented characters (song titles with Spanish characters, smart quotes in notes)
- [ ] **CSV Import:** Often missing row-level validation report — verify that importing a file with 2 bad rows shows which rows failed and why, not just "import complete"
- [ ] **Auth + Route Guard:** Often missing the race condition fix — verify by hard-refreshing a protected route while logged in
- [ ] **Song Suggestions:** Often missing staleness boost — verify that songs unused for 3+ months appear at the top of suggestions, not just "not filtered out"
- [ ] **Service Plan Print:** Often missing print stylesheet — verify by printing from Chrome and checking page breaks don't split song slots mid-item
- [ ] **Team Invite:** Often missing token expiry — verify that an invite link sent 30 days ago no longer works
- [ ] **Firestore Rules:** Often left in dev mode — verify that a request with no auth token receives a `PERMISSION_DENIED` error for every collection
- [ ] **Mobile Service View:** Often untested at rehearsal scale — verify on a real phone that the order of service is readable without pinch-zoom

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth race condition in production | LOW | Fix the `beforeEach` guard, deploy; no data migration needed |
| Firestore open rules exploited | HIGH | Immediately update rules; audit Firestore for unexpected documents; notify affected users; check Firebase Usage tab for anomalous reads/writes |
| Wrong data model (over-normalized) | HIGH | Requires Firestore migration script; run in Cloud Function with transaction batches; plan for downtime or dual-write period |
| Song stable corrupted by bad CSV import | MEDIUM | Re-import from Planning Center export; if songs were edited in-app since import, manual reconciliation needed — maintain a `importedAt` timestamp to identify original records |
| Runaway listener memory leak | LOW | Add `onUnmounted` cleanup to affected composables; deploy; no data migration |
| Suggestion algorithm bias discovered (same 20 songs) | MEDIUM | Add `lastSuggestedDate` field to all songs; backfill from usage history; deploy updated algorithm |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auth race condition with Vue Router | Phase 1: Authentication | Hard-refresh every protected route while logged in |
| Firestore over-normalization | Phase 1: Data modeling spike | Service plan page loads with 1 query, not N+1 |
| Open security rules | Phase 1: Authentication | Unauthenticated request returns `PERMISSION_DENIED` for all collections |
| Firestore listener memory leaks | Phase 1: Firebase integration patterns | Navigate to song library 10x; browser memory stays flat |
| CSV import silent data corruption | Phase 1: CSV import feature | Import Planning Center export with 100+ songs; check validation summary matches expected count |
| Song suggestion degeneration | Phase 2: Song suggestions | After 10 simulated weeks of planning, confirm songs unused for 6+ weeks rank first |
| Missing print stylesheet | Phase 3: Print/share | Print service order from Chrome; verify no layout breaks, no nav elements, proper page breaks |
| Team invite without expiry | Phase 2: Team collaboration | Generate invite link, wait (simulate expiry), verify link rejected |
| Mobile view untested | Phase 3: Service view | Test complete rehearsal workflow on physical phone |
| Pinia monolithic store | Phase 1: App architecture | One Pinia store per domain (songs, services, tasks, auth) from project initialization |

---

## Sources

- [Top 10 Firebase Mistakes in 2025 — DEV Community](https://dev.to/mridudixit15/top-10-mistakes-developers-still-make-with-firebase-in-2025-53ah) — MEDIUM confidence
- [Firebase Firestore Best Practices (official)](https://firebase.google.com/docs/firestore/best-practices) — HIGH confidence
- [Firebase Fix Insecure Rules (official)](https://firebase.google.com/docs/firestore/security/insecure-rules) — HIGH confidence
- [Firebase Auth Redirect Best Practices (official)](https://firebase.google.com/docs/auth/web/redirect-best-practices) — HIGH confidence (Chrome M115+ breaking change documented)
- [Firebase Custom Claims (official)](https://firebase.google.com/docs/auth/admin/custom-claims) — HIGH confidence
- [Firestore Pricing (official)](https://firebase.google.com/docs/firestore/pricing) — HIGH confidence
- [How to Prevent Firebase Runaway Costs — Medium](https://danielllewellyn.medium.com/how-to-prevent-firebase-runaway-costs-a8b0dac79384) — MEDIUM confidence
- [Vue Guard Routes with Firebase Auth — DEV Community](https://dev.to/gautemeekolsen/vue-guard-routes-with-firebase-authentication-f4l) — MEDIUM confidence
- [Top 5 Pinia Mistakes — Mastering Pinia](https://masteringpinia.com/blog/top-5-mistakes-to-avoid-when-using-pinia) — MEDIUM confidence
- [7 Vue 3 Performance Pitfalls — Simform Engineering](https://medium.com/simform-engineering/7-vue-3-performance-pitfalls-that-quietly-derail-your-app-33c7180d68d4) — MEDIUM confidence
- [Vue 3 Reactivity Destructuring — Mokkapps](https://mokkapps.de/vue-tips/destructure-props-in-composition-api-without-losing-reactivity) — MEDIUM confidence
- [How to Build a Team-Based User Management System with Firebase — Richard Keil](https://blog.richartkeil.com/how-to-build-a-team-based-user-management-system-in-firebase/) — MEDIUM confidence
- [PapaParse — official npm package](https://www.npmjs.com/package/papaparse) — HIGH confidence
- [Common CSV Import Errors — Dromo](https://dromo.io/blog/common-data-import-errors-and-how-to-fix-them) — MEDIUM confidence
- [Print Styles Pitfalls — Pixel Free Studio](https://blog.pixelfreestudio.com/print-styles-gone-wrong-avoiding-pitfalls-in-media-print-css/) — MEDIUM confidence
- [Common Worship Service Planning Mistakes — Ministry Brands](https://www.ministrybrands.com/blog/common-worship-service-planning-mistakes-and-how-to-avoid-them) — LOW confidence (domain context only)
- [Firestore Index Issues — Medium](https://medium.com/@mykola.patlatyi/solving-firestore-indexing-issues-for-complex-queries-9eaf85df02a5) — MEDIUM confidence

---
*Pitfalls research for: Church worship service planning app (Vue 3 + Firebase)*
*Researched: 2026-03-03*
