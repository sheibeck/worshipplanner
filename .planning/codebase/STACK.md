# Technology Stack

**Analysis Date:** 2026-07-16

## Languages

**Primary:**
- TypeScript ~5.9.3 - Client and backend development
- JavaScript (ES Modules) - Runtime language

**Secondary:**
- Vue Single File Components (.vue) - Template/styling layer

## Runtime

**Environment:**
- Node.js ^20.19.0 || >=22.12.0 - Development and Cloud Functions

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vue 3.5.29 - Progressive JavaScript framework for UI
- Vue Router 5.0.3 - Client-side routing

**State Management:**
- Pinia 3.0.4 - Vue composition API state management

**Backend:**
- Firebase Admin SDK 13.10.0 - Server-side Firebase integration
- Firebase Functions 7.2.5 - Serverless backend via Google Cloud Functions

**Testing:**
- Vitest 4.0.18 - Unit testing framework
- @vue/test-utils 2.4.6 - Vue component testing
- @firebase/rules-unit-testing 5.0.0 - Firestore rules testing
- jsdom 28.1.0 - DOM simulation for tests

**Build/Dev:**
- Vite 7.3.1 - Frontend build tool and dev server
- @vitejs/plugin-vue 6.0.4 - Vue compilation for Vite

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk ^0.78.0 - Anthropic Claude API integration for AI suggestions
- firebase ^12.0.0 - Client SDK for Authentication and Firestore
- papaparse ^5.5.3 - CSV parsing/export for volunteer roster
- sortablejs ^1.15.7 - Drag-and-drop for schedule slots

**Infrastructure:**
- @tailwindcss/vite ^4.0.0 - Tailwind CSS integration
- tailwindcss ^4.0.0 - Utility-first CSS framework

**Development Quality:**
- eslint ^10.0.2 - JavaScript linting
- eslint-plugin-vue ~10.8.0 - Vue linting rules
- eslint-plugin-oxlint ~1.50.0 - Rust-based linter
- oxlint ~1.50.0 - High-performance linter
- prettier 3.8.1 - Code formatter
- vue-tsc 3.2.5 - Vue-aware TypeScript compiler
- npm-run-all2 ^8.0.4 - Concurrent script execution

**Type Definitions:**
- @types/node ^24.11.0
- @types/papaparse ^5.5.2
- @types/sortablejs ^1.15.9
- @types/jsdom ^28.0.0

## Configuration

**Environment:**
- Client env vars: Prefixed with `VITE_` (exposed to bundle)
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_USE_EMULATORS` (dev-only, enables local Firebase emulators)

- Server env vars: Non-prefixed (server-side only)
  - `CLAUDE_API_KEY` - Stored in Google Secret Manager
  - `ESV_API_KEY` - Stored in Google Secret Manager

**Build:**
- `vite.config.ts` - Vite configuration with Vue and Tailwind plugins
- `tsconfig.json` - TypeScript project references
- `tsconfig.app.json` - Application TypeScript settings
- `tsconfig.vitest.json` - Test environment TypeScript settings
- `tsconfig.node.json` - Build tool TypeScript settings
- `eslint.config.ts` - ESLint flat config with Vue and Vitest plugins
- `firebase.json` - Firebase Hosting and Cloud Functions configuration
- `firestore.indexes.json` - Firestore index definitions
- `firestore.rules` - Firestore security rules

## Platform Requirements

**Development:**
- Node.js 20.19.0 or 22.12.0+
- npm (included with Node.js)
- Firebase Emulator Suite (optional, for local development)
  - Firestore emulator (port 8080)
  - Auth emulator (port 9099)
  - Functions emulator (port 5001)
  - Emulator UI (port 4000)

**Production:**
- Firebase Hosting (Google Cloud)
- Cloud Functions (Google Cloud)
- Firestore database (Google Cloud)
- Google Secret Manager (for API keys)

## Backend Stack Notes (R318)

Behavioral/architectural "how it works" narration relocated out of backend source comments
(`functions/src/**`) per the Phase 109 comment convention (CONVENTIONS.md § Comment Convention).
Each entry cites the file:line range at the time of relocation (109-02).

### functions/src/messageTokens.ts

**Module overview (pure server-side token renderer for the send path, Phase 59, R138/R139):**
`sendQueuedMessage` (`functions/src/index.ts`) renders each recipient's subject and body from the
RAW token template stored on the message doc. This file is deliberately PURE — string in, string
out, no Firestore/Pinia/`@/` alias and no import of the client `buildServiceSnapshot` (which is
store-bound and not importable in the functions project, 59-RESEARCH.md Anti-Pattern). The caller
(the send trigger) Admin-SDK-loads the service/quarters/roles/people, derives the token values,
and calls this once PER RECIPIENT so `{{their_roles}}` and `{{name}}` reflect that person's own
roles/name (R139/R154). The supported tokens are substituted GLOBALLY; every other `{{token}}` is
left verbatim, and a template with no tokens is returned unchanged.

## Utils Stack Notes (R318)

Behavioral/architectural "how it works" narration relocated out of `src/utils/**` source comments
per the Phase 109 comment convention (CONVENTIONS.md § Comment Convention). Each entry cites the
file:line range at the time of relocation (109-03).

### src/utils/slideTypography.ts

**`FONT_CSS_LOADERS` (RESEARCH's "bundle strategy"):** on-demand loader for a non-eager curated
family — only the org's chosen default face is eager-imported in `main.ts`; the other five curated
families load lazily when previewed in Settings or requested by the presenter gate. Every
`import()` inside this table is a FULLY STATIC string literal — one per `{family, weight}` pair
drawn from `SLIDE_FONTS` — so Vite's import-analysis discovers and bundles each per-weight chunk on
its own. Do NOT collapse these back to a templated `import(\`…/${weight}.css\`)`: a
`@fontsource/*` specifier is a BARE (node_modules) import, and Vite 7's `dynamic-import-vars`
cannot statically analyze a variable inside a bare specifier ("must start with ./ or ../") — it
warns at build/dev time AND leaves the import un-bundled, so the lazy font load would throw at
runtime in a production build. The verbose per-weight literals are the price of correctness. Each
family value stays a `(weight) => Promise` function so `loadFontCss` and the `FONT_CSS_LOADERS`
membership test are unaffected; an unlisted weight resolves to a no-op, mirroring the `snapWeight`
ramp.

### src/utils/slotTypes.ts

**`buildSuggestedTemplateEntries`:** builds the Suggested Template's `ServiceTemplateEntry[]` — the
single shared definition of the suggested-template content (the R114 `applyReset` button and the
R115 `createService` empty-template fallback BOTH call this, so the preset can never fork into two
copies). Derived from `buildSlots('1-2-2-3')` so the suggested order and section defaults stay in
lockstep with the canonical progression preset. Fresh `crypto.randomUUID()` ids are minted per call
(the editor draft needs unique per-row keys; `buildSlotsFromTemplate` never reads `entry.id`, so
fresh ids are harmless on the createService path). Carries no `body` — the suggested entries are
bodyless; a church adds recurring MISC body text itself.

---

*Stack analysis: 2026-07-16*
