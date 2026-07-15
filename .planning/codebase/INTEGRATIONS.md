# External Integrations

**Analysis Date:** 2026-07-15

## APIs & External Services

**AI & Suggestions:**
- Anthropic API (Claude) - AI-powered song and scripture suggestions for worship services
  - SDK: @anthropic-ai/sdk ^0.78.0
  - Model: claude-haiku-4-5-20251001
  - Auth: X-API-Key header (server-side only)
  - Environment Variable: CLAUDE_API_KEY (stored in Cloud Function secrets)
  - Integration: `src/utils/claudeApi.ts` → getSongSuggestions(), getScriptureSuggestions()
  - Request Path: /api/anthropic (proxied)

**Bible Content:**
- ESV API (English Standard Version) - Scripture text retrieval for worship planning
  - SDK: fetch-based HTTP client
  - Auth: Authorization Token header (server-side only)
  - Environment Variable: ESV_API_KEY (stored in Cloud Function secrets)
  - Integration: `src/utils/esvApi.ts` → fetchPassageText()
  - Request Path: /api/esv/v3/passage/text/ (proxied)

**Church Planning:**
- Planning Center Online API - Integration with church planning workflow
  - SDK: Fetch-based HTTP client
  - Auth: Basic Auth (app ID + secret, client-provided in settings)
  - Environment Variable: None (credentials managed in Firestore)
  - Integration: `src/utils/planningCenterApi.ts` → validatePcCredentials(), fetchServiceTypes(), fetchTemplates()
  - Request Path: /api/planningcenter/services/v2 (proxied)
  - Features: Service type enumeration, plan template fetching, song/scripture export
  - Credentials Storage: Firestore user document fields (pcAppId, pcSecret)

## Data Storage

**Databases:**
- Firestore (Firebase NoSQL) - Primary application database
  - Connection: Via firebase ^12.0.0 SDK
  - Client SDK: getFirestore() in `src/firebase/index.ts`
  - Admin SDK: firebase-admin ^13.10.0 in `functions/src/index.ts`
  - Collections: users, organizations, services, quarters, songs, roster, etc.
  - Real-time: onSnapshot listeners for reactive state synchronization
  - Security: firestore.rules (deployment rules in `firestore.rules`)

**Indexes:**
- Firestore Composite Indexes
  - Configuration: `firestore.indexes.json`
  - Managed via Firebase CLI

**File Storage:**
- Local filesystem only
  - CSV exports via PapaParse (client-side generation)
  - No cloud file storage (Google Cloud Storage) integration

**Caching:**
- In-Memory: Pinia stores cache application state
- Browser Local Storage: Session persistence (Vue Router history, auth tokens)
- Service Worker: Not configured (full network fetch)

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Implementation: `src/firebase/index.ts` (getAuth())
  - Integration: `src/stores/auth.ts` (useAuthStore)
  - Sign-In Methods:
    - Google OAuth 2.0 (signInWithPopup via GoogleAuthProvider)
    - Email + Password (signInWithEmailAndPassword, createUserWithEmailAndPassword)
    - Password Reset (sendPasswordResetEmail)
  - ID Token Usage: X-App-Auth header sent to Cloud Function proxy for authorization
  - Token Verification: getAuth().verifyIdToken() in `functions/src/index.ts`
  - Session: onAuthStateChanged listener for reactive user state

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, etc.)
- Manual console.error logging in error handlers

**Logs:**
- Browser Console: console.error() in error handlers
- Cloud Functions: Node.js stdout/stderr to Cloud Logging (GCP)
- Firebase Emulator: stdout to terminal during local dev

**Performance:**
- No APM (Application Performance Monitoring) detected
- No analytics collection (Google Analytics, Mixpanel, etc.)

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting
  - Deployment: `firebase deploy` via Firebase CLI
  - Configuration: `firebase.json` (rewrites, public root)
  - Public Root: `dist/` (Vite build output)
  - Rewrites: `/api/**` → Cloud Function "api", `**` → index.html (SPA)

**Cloud Functions:**
- Firebase Cloud Functions (2nd Gen)
  - Runtime: Node.js 22
  - Entry: `functions/src/index.ts` → export const api
  - Deployed as: Single HTTP function named "api"
  - Triggers: HTTPS
  - Secrets: CLAUDE_API_KEY, ESV_API_KEY (Google Secret Manager)
  - Deployment: `firebase deploy --only functions`

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, CircleCI config)
- Manual `npm run build && firebase deploy` workflow

**Local Emulation:**
- Firebase Emulator Suite
  - Services: Auth, Firestore, Cloud Functions, UI
  - Script: `npm run test:rules` (emulator-based Firestore rule testing)
  - Configuration: `firebase.json` emulators section

## Environment Configuration

**Required env vars (client):**
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID
- VITE_USE_EMULATORS (optional, local dev only)

**Required env vars (server/secrets):**
- CLAUDE_API_KEY (Cloud Function secret)
- ESV_API_KEY (Cloud Function secret)

**Secrets location:**
- Local dev: `.env.local` file (never committed)
- Cloud: Google Secret Manager (gcloud secrets)
  - Set via: `firebase functions:secrets:set CLAUDE_API_KEY`

**Proxy Configuration:**
- Dev Server: `vite.config.ts` defines /api/* proxy targets
- Production: Firebase Hosting rewrites route /api/* to Cloud Function
- Supported Proxies:
  - `/api/anthropic` → https://api.anthropic.com
  - `/api/esv` → https://api.esv.org
  - `/api/planningcenter` → https://api.planningcenteronline.com

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook receivers)

**Outgoing:**
- None detected (no third-party webhook dispatches)
- Firestore listeners used for real-time sync instead

## Data Flow & Access Patterns

**Authentication Flow:**
1. User signs in via Firebase Auth (Google OAuth or Email)
2. Firebase client SDK obtains ID token
3. Token stored in browser session by Firebase SDK
4. Subsequent API calls to Cloud Function include token in X-App-Auth header
5. Cloud Function verifies token before forwarding to Anthropic/ESV

**Song Suggestion Flow:**
1. Frontend calls `getSongSuggestions()` with sermon context
2. Anthropic SDK client created with baseURL=/api/anthropic
3. Request intercepted by dev server proxy or Firebase Hosting rewrite
4. Cloud Function verifies caller is authenticated
5. Injects CLAUDE_API_KEY into request headers
6. Forwards to api.anthropic.com
7. Response returned to frontend, parsed and validated

**Scripture Lookup Flow:**
1. Frontend calls `fetchPassageText()` with passage query
2. Fetch to `/api/esv/v3/passage/text/` with auth headers
3. Cloud Function verifies caller
4. Injects ESV_API_KEY into Authorization header
5. Forwards to api.esv.org
6. Response parsed and returned

**Planning Center Integration:**
1. User enters App ID and Secret in Settings UI
2. Credentials stored in Firestore user document
3. Frontend retrieves from auth store (pcAppId, pcSecret)
4. Credentials sent in Basic Auth header to /api/planningcenter
5. Cloud Function forwards to Planning Center API (no secret injection)
6. Response used for service type/template enumeration

## Rate Limiting & Quotas

**Anthropic API:**
- Subject to Anthropic's rate limits (not explicitly configured)
- Model: claude-haiku-4-5-20251001 (low cost, suitable for real-time suggestions)

**ESV API:**
- Shared key held server-side, subject to ESV's rate plan
- Passage lookups typically low-volume

**Planning Center API:**
- Depends on church's Planning Center subscription tier
- No rate limiting implemented in proxy

---

*Integration audit: 2026-07-15*
