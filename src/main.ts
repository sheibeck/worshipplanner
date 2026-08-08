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

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
