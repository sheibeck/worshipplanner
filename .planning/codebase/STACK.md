# Technology Stack

**Analysis Date:** 2026-07-15

## Languages

**Primary:**
- TypeScript ~5.9.3 - All source code and configuration
- Vue 3 ^3.5.29 - Frontend UI framework

**Secondary:**
- JavaScript - Build scripts, dev server utilities
- CSS/HTML - Styling and markup (Tailwind, Vue templates)

## Runtime

**Environment:**
- Node.js ^20.19.0 || >=22.12.0 (development and production)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core Frontend:**
- Vue 3 ^3.5.29 - Reactive UI framework (`src/`)
- Vue Router ^5.0.3 - Client-side routing (`src/router/index.ts`)
- Pinia ^3.0.4 - State management (`src/stores/`)

**Backend:**
- Firebase Cloud Functions v7.2.5 - Serverless API layer (`functions/src/index.ts`)
- Firebase Admin SDK ^13.10.0 - Server-side Firebase integration

**Testing:**
- Vitest ^4.0.18 - Unit and integration test runner
- Vue Test Utils ^2.4.6 - Vue component testing utilities
- jsdom ^28.1.0 - DOM environment for tests
- @firebase/rules-unit-testing ^5.0.0 - Firestore security rule testing

**Build & Dev:**
- Vite ^7.3.1 - Build tool and dev server (`vite.config.ts`)
- @vitejs/plugin-vue ^6.0.4 - Vue SFC support
- @tailwindcss/vite ^4.0.0 - TailwindCSS integration

**Type Checking:**
- vue-tsc ^3.2.5 - Vue + TypeScript compiler (`tsconfig.app.json`)

## Key Dependencies

**Critical:**
- Firebase ^12.0.0 - Client SDK for Auth, Firestore, and real-time data
  - Handles: Authentication, NoSQL database, real-time listeners
  - Config: `src/firebase/index.ts`, environment variables via `VITE_FIREBASE_*`

- @anthropic-ai/sdk ^0.78.0 - Claude API client
  - Model: claude-haiku-4-5-20251001
  - Purpose: Song and scripture suggestions for worship planning
  - Integration: `src/utils/claudeApi.ts` (proxied through Cloud Function)

**Frontend Utilities:**
- PapaParse ^5.5.3 - CSV parsing for import/export flows
- SortableJS ^1.15.7 - Drag-and-drop list reordering
- Vue Router - Client-side navigation
- Pinia - Reactive state store

**CSS & Styling:**
- TailwindCSS ^4.0.0 - Utility-first CSS framework
- Automatically injected via `@tailwindcss/vite` in build

**Development Tools:**
- ESLint ^10.0.2 - JavaScript/TypeScript linting
- Oxlint ~1.50.0 - Ultra-fast Rust-based linter
- Prettier 3.8.1 - Code formatter
- npm-run-all2 ^8.0.4 - Script parallelization

## Configuration

**Environment:**
- `.env.local.example` - Template for local development (never committed)
- Environment variables:
  - `VITE_FIREBASE_*` - Firebase configuration (6 variables)
  - `VITE_USE_EMULATORS` - Enable local Firebase emulators (true/false)
  - `CLAUDE_API_KEY` - Claude API key (server-side in Cloud Function, never in browser)
  - `ESV_API_KEY` - Bible API key (server-side in Cloud Function, never in browser)

**Build:**
- `vite.config.ts` - Main build configuration with Vue, TailwindCSS, dev proxy
- `tsconfig.json` - TypeScript project references (app, node, vitest configs)
- `tsconfig.app.json` - App-specific compiler options with path aliases (`@/*`)
- `tsconfig.node.json` - Node/Vite configuration compilation
- `tsconfig.vitest.json` - Vitest test environment configuration
- `eslint.config.ts` - ESLint configuration with Vue, TypeScript, Oxlint plugins
- `firebase.json` - Firebase CLI configuration for deployment

**Type Definitions:**
- `env.d.ts` - Vite environment variable type definitions
- Auto-generated `.d.ts` files from Vue SFCs

## Platform Requirements

**Development:**
- Node.js 20.19.0 or higher (or 22.12.0+)
- npm (included with Node.js)
- Firebase CLI (for local emulation and deployment)
- Git (version control)

**Production:**
- Firebase Cloud (hosting, functions, firestore)
- Google Cloud Platform (Secret Manager for API keys)
- Node.js 22 (Cloud Functions runtime)

**Local Development Services:**
- Firebase Emulator Suite:
  - Auth emulator: localhost:9099
  - Firestore emulator: localhost:8080
  - Cloud Functions emulator: localhost:5001
  - Emulator UI: localhost:4000

## Architecture Highlights

**Client-Side (Browser):**
- Single-page application (SPA) with client-side routing
- Reactive state via Pinia stores
- Incremental static generation via Vue Router lazy-loading
- API calls proxied through `/api/*` paths to hide credentials

**Server-Side (Cloud Functions):**
- Express-like HTTP handler (`functions/src/index.ts`)
- Secret injection for Anthropic and ESV API keys
- Firebase Authentication verification gate for protected APIs
- HTTP proxy forwarding to external services

**Build Pipeline:**
- TypeScript compilation via vue-tsc (incremental)
- Vite bundling with Vue plugin
- Output to `dist/` for Firebase Hosting
- Firebase CLI deployment integration

---

*Stack analysis: 2026-07-15*
