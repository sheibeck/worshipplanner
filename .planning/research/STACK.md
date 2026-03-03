# Stack Research

**Domain:** Church worship service planning web app
**Researched:** 2026-03-03
**Confidence:** HIGH (core stack verified via official docs/npm; supporting libraries MEDIUM where versions sourced from WebSearch)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue 3 | ^3.5.x | Frontend framework | Team constraint (non-negotiable). Composition API + `<script setup>` is the current standard pattern — better TypeScript inference, smaller bundles, and more reusable logic than Options API. |
| Vite | ^7.3.x | Build tool & dev server | Official Vue build tool. v7 is current stable (31M weekly downloads). Hot module replacement makes development fast. `create-vue` scaffolds Vite by default. |
| TypeScript | ^5.x | Type safety | Not strictly required but strongly recommended. Vue 3 + Composition API was designed with TypeScript in mind. `<script setup lang="ts">` catches Firestore schema mismatches at compile time — critical for a data-heavy app. |
| Firebase JS SDK | ^12.x | Backend services (Firestore + Auth) | Team constraint (non-negotiable). v12 is current stable (12.10.0 as of March 2026). Modular API (v9+) supports tree-shaking so only imported services are bundled. |
| VueFire | ^3.2.2 | Vue-native Firebase bindings | Official Firebase bindings for Vue, maintained by the Vue core team. Provides composables (`useCollection`, `useDocument`, `useCurrentUser`) that integrate with Firestore reactivity without manual subscription management. Latest stable: 3.2.2 (July 2024). |

### Routing & State

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue Router | ^5.0.3 | Client-side routing | Official Vue router. v5 (Feb 2025) merges `unplugin-vue-router` for file-based routing into core — no breaking changes from v4. New projects should start on v5 to avoid a future migration. |
| Pinia | ^3.0.4 | Global state management | Official Vue state management, replaces Vuex. v3 is current stable (Vue 3 only). Zero boilerplate — actions update state directly, no mutations. ~1.5kb. DevTools integration built in. Vuex is maintenance-only. |

### UI & Styling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PrimeVue | ^4.4.x | UI component library | 90+ components, 480K weekly downloads, active development (4.4.1 released Feb 2026). Headless/unstyled mode available for custom theming. Significantly more flexible than Vuetify (which locks you to Material Design). Better suited than Quasar for a pure web SPA (Quasar's strength is cross-platform builds). For a worship planning app, pre-built DataTable, Dropdown, Calendar, and Dialog components eliminate weeks of work. |
| Tailwind CSS | ^4.x | Utility-first CSS | Use alongside PrimeVue in unstyled mode OR as a complement for layout/spacing where PrimeVue components don't apply. Tailwind v4 drops config file — simpler setup. Pairs naturally with PrimeVue's Volt theme layer. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PapaParse | ^5.5.3 | CSV parsing | Song import from Planning Center CSV export. No dependencies, handles multi-MB files in-browser via Web Workers. The only serious CSV parser for JS — use it for the CSV import feature. |
| VeeValidate + @vee-validate/zod | ^4.x | Form validation + schema | Song edit forms, service plan forms. VeeValidate provides Vue-native composables (`useForm`, `defineField`); Zod provides schema-level validation and TypeScript inference. Pair: `VeeValidate 4 + Zod 3 + @vee-validate/zod`. |
| vite-plugin-pwa | ^1.2.0 | Progressive Web App | Mobile-friendly install + offline access for pulling up plans during rehearsal. Zero-config PWA for Vite. Generates service worker and web app manifest automatically. Requires Vite 5+. |
| date-fns | ^4.x | Date manipulation | Usage tracking (last scheduled date), week-by-week views, "X weeks since last used" calculations. Smaller and tree-shakeable vs moment.js. No global state side effects. |
| pinia-plugin-persistedstate | ^4.x | Store persistence | Persist auth state and UI preferences (active team config, last viewed week) across page refreshes. Official Pinia recommendation for localStorage persistence. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit testing | Built by the Vite team. v4 is current. Shares Vite config — no separate test bundler. `@vue/test-utils` for component testing. Run with `vitest run` in CI. |
| @vue/test-utils | Component testing | Official Vue testing utility. Works with Vitest. Test song suggestion logic and service plan builder components. |
| ESLint + `eslint-plugin-vue` | Linting | Official Vue ESLint plugin. Use `plugin:vue/vue3-recommended` ruleset. Catches template errors at lint time. |
| Firebase Emulator Suite | Local dev/test | Run Firestore + Auth locally during development. Critical for testing Security Rules without hitting production. `firebase emulators:start`. |
| `firebase-tools` CLI | Deploy + emulators | Firebase CLI for deploying to Firebase Hosting and running emulators. Install globally: `npm install -g firebase-tools`. |

### Infrastructure

| Service | Purpose | Notes |
|---------|---------|-------|
| Firebase Hosting | Static SPA hosting | Pairs naturally with Firebase backend. CDN-backed, HTTPS by default, SPA rewrites built-in. `firebase deploy` pushes the Vite build. Free tier covers a 2-3 planner app indefinitely. |
| Firestore | Primary database | NoSQL document DB. Real-time listeners via VueFire composables. Structure: `songs/`, `services/`, `teams/`, `tasks/`, `usageHistory/` top-level collections. |
| Firebase Authentication | User auth | Google OAuth + email/password — both supported natively. VueFire's `useCurrentUser()` composable provides reactive auth state. Use redirect-based login (not popup) for mobile compatibility. |

---

## Installation

```bash
# Scaffold project
npm create vue@latest worship-planner
# Select: TypeScript yes, Vue Router yes, Pinia yes, ESLint yes, Vitest yes

# Core Firebase + VueFire
npm install firebase vuefire

# UI components
npm install primevue @primevue/themes

# Styling
npm install tailwindcss @tailwindcss/vite

# CSV parsing
npm install papaparse
npm install -D @types/papaparse

# Form validation
npm install vee-validate @vee-validate/zod zod

# Date utilities
npm install date-fns

# State persistence
npm install pinia-plugin-persistedstate

# PWA
npm install -D vite-plugin-pwa

# Dev tools
npm install -D vitest @vue/test-utils @vitejs/plugin-vue

# Firebase CLI (global)
npm install -g firebase-tools
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| PrimeVue | Vuetify | If Material Design is a hard requirement and you want the most battle-tested library. Vuetify has more stars (40K vs 14K) but enforces Material Design rigidly. |
| PrimeVue | Quasar | If you need to ship to mobile native or Electron from the same codebase. For web-only PWA, Quasar is overkill. |
| PrimeVue | shadcn-vue | If you want copy-paste components with full ownership (no npm dep). Good for very custom UIs; requires more setup time upfront. |
| VueFire | Manual Firebase SDK | If VueFire composables don't cover your use case (e.g., batch writes with complex transactions). VueFire covers 90% of CRUD patterns for Firestore. |
| date-fns | Day.js | Day.js is marginally smaller (2kb vs 13kb tree-shaken). Use Day.js if bundle size is critical; date-fns has better TypeScript types and is more widely used in Vue ecosystem. |
| Pinia | Vuex | Never for new projects. Vuex is in maintenance mode, receives no new features, and requires mutations boilerplate. |
| Vite | Vue CLI (webpack) | Never for new projects. Vue CLI is in maintenance mode as of 2024. |
| Vue Router 5 | Vue Router 4 | Vue Router 4 is still supported but use v5 for new projects — no migration cost and it's the forward path. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vuex | In maintenance mode since Pinia became official. Mutations add boilerplate with no benefit. | Pinia |
| Vue CLI / `@vue/cli` | Maintenance mode. Webpack-based, significantly slower than Vite. No longer recommended by Vue team. | `npm create vue@latest` (Vite) |
| moment.js | 67kb, mutable API, timezone hell, not tree-shakeable. Deprecated by its own authors for new projects. | date-fns |
| html2pdf.js / jsPDF for print | These libraries struggle with complex layouts and produce pixel-shifted PDFs. For a worship order of service, CSS `@media print` + `window.print()` is simpler, more reliable, and produces proper typography. | CSS `@media print` styles + `window.print()` |
| VueFire 2.x | Incompatible with Firebase SDK v9+ modular API. v3 is the rewrite for the modern SDK. | VueFire 3.x |
| Options API | Still valid but inferior TypeScript support and harder to extract logic into composables. Composition API is the Vue 3 standard. | Composition API with `<script setup lang="ts">` |
| `@firebase/firestore` direct imports only | Loses VueFire's reactive binding composables. You'd reinvent the subscription/cleanup wheel manually. | Use VueFire composables; drop to raw SDK only for batch writes or transactions. |

---

## Stack Patterns by Variant

**For the song suggestions algorithm (stateful, complex logic):**
- Implement as a Pinia store (`useSongSuggestionStore`) with getters for filtered/ranked songs
- Store recent usage in Firestore, cache in Pinia store with `pinia-plugin-persistedstate`
- Because: pure component state won't survive navigation; songs and usage data are shared across multiple views

**For CSV import:**
- Use PapaParse in `worker: true` mode (Web Worker) for the Planning Center export — exports can be 100+ songs with 5 arrangements each
- Because: synchronous parsing of large CSVs blocks the UI thread and makes the app feel frozen

**For print/share service plans:**
- Use CSS `@media print` with a dedicated `.print-layout` component, not a PDF library
- Because: the order of service is text-heavy with consistent formatting — CSS print handles it perfectly, and users can Save as PDF from browser print dialog
- Add `window.print()` trigger from a "Print" button

**For auth routing:**
- Use Vue Router navigation guards (`router.beforeEach`) to check `useCurrentUser()` from VueFire
- Redirect unauthenticated users to `/login`; redirect authenticated users away from `/login`
- Because: VueFire's `useCurrentUser()` is reactive and works naturally in composables called by navigation guards

**For PWA offline behavior:**
- Cache song stable and current week's service plan in service worker
- Use `vite-plugin-pwa`'s `generateSW` strategy with `runtimeCaching` for Firestore API calls
- Because: worship leaders need to pull up plans on phones during rehearsal even with spotty connectivity

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| VueFire ^3.2.2 | Firebase SDK ^9.x–^12.x, Vue 3 | VueFire 3 requires Firebase SDK >= 9 modular API. Compatible with current Firebase 12. |
| vite-plugin-pwa ^1.2.0 | Vite ^5.x, ^6.x, ^7.x | Plugin requires Vite 5+. Works with current Vite 7. |
| Pinia ^3.0.4 | Vue 3 only | Pinia 3 dropped Vue 2 support. Vue 3.x is required. |
| Vue Router ^5.0.3 | Vue 3 | Router 5 is Vue 3 only. Router 4 remains available for Vue 2 compat projects. |
| PrimeVue ^4.x | Vue 3 | PrimeVue 4 is Vue 3 only. PrimeVue 3 was the last Vue 2 version. |
| Vite ^7.x | Node.js ^18 or ^20 | Vite 7 requires Node.js 18+. Drop Node 16 before scaffolding. |

---

## Sources

- [VueFire Official Docs — Getting Started](https://vuefire.vuejs.org/guide/getting-started.html) — VueFire version 3.2.2, peer dependencies, installation (HIGH confidence)
- [VueFire GitHub Releases](https://github.com/vuejs/vuefire/releases) — Latest release July 20 2024 (HIGH confidence)
- [Vue Router GitHub Releases](https://github.com/vuejs/router/releases) — v5.0.3 released Feb 19 2025 (HIGH confidence)
- [vite-plugin-pwa GitHub](https://github.com/vite-pwa/vite-plugin-pwa) — v1.2.0 released Nov 27 2025, requires Vite 5+ (HIGH confidence)
- [Pinia npm](https://www.npmjs.com/package/pinia) — v3.0.4 current stable (HIGH confidence)
- [Firebase JS SDK Release Notes](https://firebase.google.com/support/release-notes/js) — Firebase npm v12.10.0 confirmed (HIGH confidence)
- [Vite 7.0 Announcement](https://vite.dev/blog/announcing-vite7) — v7.3.1 current stable (HIGH confidence)
- [PapaParse npm](https://www.npmjs.com/package/papaparse) — v5.5.3, no dependencies, 9 months old (HIGH confidence)
- [PrimeVue npm](https://www.npmjs.com/package/primevue) — v4.4.1 published Feb 2026 (HIGH confidence)
- [Vue.js Official — State Management Guide](https://vuejs.org/guide/scaling-up/state-management) — Pinia recommended, Vuex maintenance-only (HIGH confidence)
- [Vue Router Migration v4-to-v5](https://router.vuejs.org/guide/migration/v4-to-v5) — No breaking changes confirmed (HIGH confidence)
- WebSearch: Vite 7 current stable, PrimeVue vs Vuetify vs Quasar comparison, VeeValidate + Zod recommendation (MEDIUM confidence — multiple credible sources agree)
- WebSearch: date-fns vs moment.js, CSS print vs html2pdf, pinia-plugin-persistedstate (MEDIUM confidence)

---

*Stack research for: Church worship service planning web app (Vue 3 + Firebase)*
*Researched: 2026-03-03*
