"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIsMobile = useIsMobile;
var vue_1 = require("vue");
/**
 * Reactive desktop/mobile detection backed by a CSS media query, not `window.innerWidth`
 * polling. Matrix vs. list are structurally different DOM trees (not a CSS show/hide pair),
 * so the mobile fallback (D-14) needs a real breakpoint signal to pick the initial view.
 */
function useIsMobile(query) {
    var _a;
    if (query === void 0) { query = '(min-width: 640px)'; }
    var mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query)
        : null;
    var isDesktop = (0, vue_1.ref)((_a = mediaQuery === null || mediaQuery === void 0 ? void 0 : mediaQuery.matches) !== null && _a !== void 0 ? _a : true);
    function onChange(event) {
        isDesktop.value = event.matches;
    }
    (0, vue_1.onMounted)(function () {
        mediaQuery === null || mediaQuery === void 0 ? void 0 : mediaQuery.addEventListener('change', onChange);
    });
    (0, vue_1.onUnmounted)(function () {
        mediaQuery === null || mediaQuery === void 0 ? void 0 : mediaQuery.removeEventListener('change', onChange);
    });
    return { isDesktop: isDesktop };
}
