import './assets/main.css'
// See ADR-0143 (docs/adr/0143-eager-load-the-default-slide-face-r094-so-the-default-family.md)
import '@fontsource/inter/400.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// NOTE: deliberately NO module-load requestFullscreen() here for /present/* windows —
// a popup loses transient activation before its bootstrap completes. See
// .planning/codebase/STACK.md (Store & Entry-Point Stack Notes (R318) -> src/main.ts).

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
