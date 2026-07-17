# External Integrations

**Analysis Date:** 2026-07-16

## APIs & External Services

**Anthropic Claude API:**
- Service: AI-powered song and scripture suggestions for worship planning
  - SDK/Client: `@anthropic-ai/sdk` (v0.78.0)
  - Model: `claude-haiku-4-5-20251001`
  - Auth: API key held in Google Secret Manager (`CLAUDE_API_KEY`)
  - Access: Browser client → `/api/anthropic` proxy (Cloud Function) → `https://api.anthropic.com`
  - Usage: `src/utils/claudeApi.ts`
    - `getSongSuggestions()`: Suggests worship songs matching sermon context
    - `getScriptureSuggestions()`: Suggests scripture passages matching sermon topic
  - Request Headers: Firebase ID token in `X-App-Auth` header for authentication gate
  - Response: JSON arrays of suggestions with validation against local libraries

**ESV (English Standard Version) Bible API:**
- Service: Fetch scripture text passages for worship service items
  - Auth: Token-based (`Authorization: Token {ESV_API_KEY}`)
  - Key Location: Google Secret Manager (`ESV_API_KEY`)
  - Access: Browser client → `/api/esv` proxy (Cloud Function) → `https://api.esv.org`
  - Usage: `src/utils/esvApi.ts`
    - `fetchPassageText()`: Retrieves formatted scripture text by passage reference
  - Endpoint: `/v3/passage/text/`
  - Query Params: `q` (passage), `include-verse-numbers=true`, `include-headings=false`, etc.
  - Response: JSON with `passages` array containing formatted scripture text

**Planning Center Online API (Services v2):**
- Service: Church service planning platform integration
  - API Endpoint: `https://api.planningcenteronline.com/services/v2`
  - Auth: Basic Auth (App ID + Secret) in Authorization header
  - Access: Browser client → `/api/planningcenter` proxy (Vite dev / Cloud Function prod) → Planning Center
  - Credentials Storage: Stored in Firestore at `organizations/{orgId}.pcAppId` and `.pcSecret` (encrypted at rest by Firestore)
  - Usage: `src/utils/planningCenterApi.ts` (26+ functions)
    - Service Types: `fetchServiceTypes()`, `fetchTemplates()`
    - Plans: `fetchPlans()`, `createPlan()`, `fetchPlanItems()`, `fetchPlanTimes()`
    - Items: `createItem()`, `updateItem()`, `deleteItem()`, `createItemNote()`
    - Songs: `searchSongByCcli()`, `fetchSongArrangements()`, `fetchLastScheduledItem()`
    - Teams: `fetchServiceTypeTeams()`, `fetchTeamPositions()`, `addNeededPosition()`
    - People: `fetchAllPeople()`, `fetchPeopleForTeamPositions()`, `fetchPersonEmails()`
  - Rate Limiting: Implements 429 (Too Many Requests) retry logic with exponential backoff
  - Pagination: Follows `links.next` for paginated responses, rewrites absolute URLs to proxy paths

## Data Storage

**Firestore (Cloud Firestore):**
- Primary database for all application data
  - Collections: `users`, `organizations`, `inviteLookup`, `shareTokens`, `orgSlugs`
  - Subcollections (per org): `members`, `invites`, `services`, `songs`, `quarters`, `teams`, `roster`, `assignments`, `arrangements`
  - Client SDK: `firebase` (v12.0.0)
  - Access: `src/firebase/index.ts` initializes `db = getFirestore(app)`
  - Emulator: Local development uses Firestore emulator at `127.0.0.1:8080` (port 8080)
  - Connection: Configured via environment variables (`VITE_FIREBASE_*`)
  - Write Strategy: Batch writes for transactional consistency (e.g., invite acceptance, org creation)
  - Real-time Listeners: `onSnapshot()` for live data sync in stores (`auth.ts`, `quarters.ts`, etc.)
  - Security: Defined in `firestore.rules` with role-based access control (editor vs. viewer)

**File Storage:**
- Not used in this codebase; local filesystem only for development

**Caching:**
- Not configured; relies on browser-side Pinia store and Firestore listeners for state management

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication (with multiple methods)

**Implementation Details:**
- Location: `src/firebase/index.ts` (initialization), `src/stores/auth.ts` (business logic)
- Methods Supported:
  - Google OAuth: `loginWithGoogle()` uses `GoogleAuthProvider` + `signInWithPopup()`
  - Email/Password: `loginWithEmail()` with auto-create on first sign-in, `registerWithEmail()`, `sendPasswordResetEmail()`
- Auth State Listener: `onAuthStateChanged()` monitors login/logout transitions
- ID Token: Firebase ID tokens issued to signed-in users, sent to Cloud Function proxy in `X-App-Auth` header for server-held secret access
- Session Management: ID tokens expire and refresh automatically via Firebase SDK
- Emulator: Local development uses Auth emulator at `127.0.0.1:9099` (port 9099)

## Monitoring & Observability

**Error Tracking:**
- Not configured; errors logged to browser console via `console.error()`

**Logs:**
- Browser console logging in utility modules (e.g., `[claudeApi]` prefix in `src/utils/claudeApi.ts`)
- Cloud Function logs available via Firebase Console / Google Cloud Logging

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting (static + Cloud Functions)
  - Public: `dist/` directory
  - Rewrites: `/api/**` routes to `api` Cloud Function
  - SPA: `/**` rewrites to `/index.html` for client-side routing

**CI Pipeline:**
- Not detected in codebase; likely configured externally (GitHub Actions, etc.)

**Deployment:**
- Functions: `npm run build && firebase deploy --only functions` (in `functions/`)
- Hosting: `firebase deploy --only hosting` (auto-deploy SPA)

## Environment Configuration

**Required Environment Variables (Client - VITE_ prefixed):**
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Firebase Analytics measurement ID (optional)
- `VITE_USE_EMULATORS`: Set to `'true'` to connect to local emulators (dev only)

**Server-Held Secrets (Google Secret Manager):**
- `CLAUDE_API_KEY`: Anthropic Claude API key (never exposed to browser)
- `ESV_API_KEY`: ESV Bible API key (never exposed to browser)
- Set via: `firebase functions:secrets:set CLAUDE_API_KEY` / `firebase functions:secrets:set ESV_API_KEY`
- Consumed by: Cloud Function proxy at `functions/src/index.ts`

**Planning Center Credentials:**
- Not environment variables; stored per-organization in Firestore
- User provides App ID + Secret through UI settings
- Credentials used for Planning Center API calls (client or proxy)

**Secrets Location:**
- Client: All VITE_ vars loaded from `.env.local` (not checked in; Vite handles at build time)
- Server: Cloud Functions reference secrets via `defineSecret()` from Firebase params library
- Development Proxy: Vite dev server reads non-VITE_ secrets from `.env.local` for dev proxy

## Webhooks & Callbacks

**Incoming:**
- None detected; app is pull-only (client fetches data from APIs)

**Outgoing:**
- None configured; app does not send webhooks to external services
- Planning Center integration: One-way push (create/update/delete items in PC)

## API Proxy Architecture

All external API calls route through a proxy layer to centralize authentication and secret management:

**Architecture:**
```
┌─────────────────────────────────────┐
│   Browser (Vue 3 App)               │
│   src/utils/claudeApi.ts            │
│   src/utils/esvApi.ts               │
│   src/utils/planningCenterApi.ts    │
└────────────────┬────────────────────┘
                 │
                 │ HTTP with X-App-Auth token
                 ▼
┌─────────────────────────────────────┐
│   Proxy Layer (Cloud Function)      │
│   functions/src/index.ts            │
│   - Verifies Firebase ID token      │
│   - Injects server-held secrets     │
│   - Routes to upstream APIs         │
└────────────────┬────────────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
  Claude API  ESV API        Planning Center
```

**Flow:**
1. Client calls e.g., `fetch('/api/anthropic/v1/messages', { headers: X-App-Auth: token })`
2. Cloud Function proxy receives request, verifies token against Firebase Auth
3. If valid, proxy injects `X-API-Key: {CLAUDE_API_KEY}` (from Secret Manager)
4. Proxy forwards modified request to upstream API
5. Response returned to client

**Dev Proxy (Vite):**
- Same pattern: Vite dev server intercepts `/api/*` requests
- Reads `CLAUDE_API_KEY` and `ESV_API_KEY` from `.env.local` (for local development)
- Injects headers and forwards to actual APIs
- Planning Center proxy: Routes directly (no API key needed for dev)

## Integration Endpoints Summary

| Service | Endpoint | Auth | Method | Route | Key Location |
|---------|----------|------|--------|-------|--------------|
| Anthropic | `https://api.anthropic.com` | `X-API-Key` header | POST `/v1/messages` | `/api/anthropic` | Secret Manager |
| ESV | `https://api.esv.org` | `Authorization: Token` | GET `/v3/passage/text` | `/api/esv` | Secret Manager |
| Planning Center | `https://api.planningcenteronline.com` | Basic Auth | GET/POST/PATCH/DELETE `/services/v2/*` | `/api/planningcenter` | Firestore per-org |
| Firebase Auth | `https://identitytoolkit.googleapis.com` | SDK | Various | N/A (SDK direct) | Project config |
| Firestore | `https://firestore.googleapis.com` | ID token + rules | REST/gRPC | N/A (SDK direct) | Project config |

---

*Integration audit: 2026-07-16*
