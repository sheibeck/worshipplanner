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

---

*Stack analysis: 2026-07-16*
