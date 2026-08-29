import './assets/main.css'
// Eager-load the DEFAULT slide face (R094) so the default family+weight is
// resident before the very first paint. This is a static import evaluated
// at module load, before app.mount() — the eager path Pitfall 4
// (46-RESEARCH.md) warns against skipping. Non-default org faces are loaded
// on demand by the presenter gate (46-04) and the Settings preview (46-03)
// via src/utils/slideTypography.ts::loadFontCss.
import '@fontsource/inter/400.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// NOTE (output-window fullscreen): there is deliberately NO module-load
// requestFullscreen() here for /present/* windows. A popup opened via
// window.open does NOT retain transient user-activation once its SPA/auth
// bootstrap runs, so a requestFullscreen() at module load ALWAYS rejected with
// "API can only be initiated by a user gesture" — the console error the owner
// saw, and it never actually went fullscreen. Auto-fullscreen for output
// windows is now driven by Fullscreen Capability Delegation from the opener
// (the control window, which HAS activation from the Go-live click) — see
// useRunControl.ts (delegates) + useOutputWindow.ts (requests on delegation) —
// with a guaranteed one-tap-anywhere affordance as the fallback.

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
