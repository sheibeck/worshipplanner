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

// Owner UAT (output windows must auto-fullscreen) — request fullscreen for an
// output window (/present/*) as the VERY FIRST thing this module does, BEFORE
// createApp + the router/auth bootstrap. A popup inherits a transient user
// activation from the opener's window.open (~5s budget); the old
// useOutputWindow onMounted requestFullscreen() ran only AFTER the full SPA +
// async auth/router beforeEach had consumed that budget, so the request
// rejected and the manual "Re-enter fullscreen" button appeared. Firing it here
// — synchronously, with nothing awaited before it — lands the request inside the
// live activation window. The control already opens each output window
// positioned on its assigned monitor, so a PLAIN requestFullscreen() (no
// { screen }) goes fullscreen on the correct screen. Wrapped in try/catch and
// .catch-swallowed so it can NEVER break app startup; the onMounted attempt in
// useOutputWindow stays as a backup and the manual affordance as the final
// fallback.
try {
  if (location.pathname.startsWith('/present/')) {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
} catch {
  // Absent API / disallowed context — never block startup.
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
