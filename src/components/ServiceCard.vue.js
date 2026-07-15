"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var vue_router_1 = require("vue-router");
var services_1 = require("@/stores/services");
var songs_1 = require("@/stores/songs");
var TeamTagPill_vue_1 = require("@/components/TeamTagPill.vue");
var scripture_1 = require("@/utils/scripture");
var props = defineProps();
var router = (0, vue_router_1.useRouter)();
var serviceStore = (0, services_1.useServiceStore)();
var songStore = (0, songs_1.useSongStore)();
var isSharing = (0, vue_1.ref)(false);
var shareCopied = (0, vue_1.ref)(false);
var displayTeams = (0, vue_1.computed)(function () {
    return props.service.teams.map(function (team) {
        if (team === 'Special' && props.service.name) {
            return "Special: ".concat(props.service.name);
        }
        return team;
    });
});
var parsedDate = (0, vue_1.computed)(function () {
    var _a = props.service.date.split('-').map(Number), year = _a[0], month = _a[1], day = _a[2];
    return new Date(year, month - 1, day);
});
// Date formatting: "Sun, Mar 8" (with year if not current year)
var formattedDate = (0, vue_1.computed)(function () {
    var d = parsedDate.value;
    var options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    };
    if (d.getFullYear() !== new Date().getFullYear()) {
        options.year = 'numeric';
    }
    return d.toLocaleDateString('en-US', options);
});
var sermonPassageLabel = (0, vue_1.computed)(function () {
    var sp = props.service.sermonPassage;
    if (!sp)
        return '';
    if (sp.verseStart && sp.verseEnd)
        return "".concat(sp.book, " ").concat(sp.chapter, ":").concat(sp.verseStart, "-").concat(sp.verseEnd);
    return "".concat(sp.book, " ").concat(sp.chapter);
});
var sermonPassageUrl = (0, vue_1.computed)(function () {
    var sp = props.service.sermonPassage;
    if (!sp)
        return '';
    return (0, scripture_1.esvLink)(sp.book, sp.chapter);
});
var messageIndex = (0, vue_1.computed)(function () {
    return props.service.slots.findIndex(function (s) { return s.kind === 'MESSAGE'; });
});
var openingSlots = (0, vue_1.computed)(function () {
    return props.service.slots.slice(0, messageIndex.value);
});
var sendingSlots = (0, vue_1.computed)(function () {
    return props.service.slots.slice(messageIndex.value + 1);
});
function slotLabel(slot) {
    switch (slot.kind) {
        case 'SONG':
            return slot.songTitle ? "Song \u2014 ".concat(slot.songTitle) : 'Song — Empty';
        case 'SCRIPTURE':
            if (!slot.book)
                return 'Scripture — Empty';
            return slot.verseStart && slot.verseEnd
                ? "Scripture \u2014 ".concat(slot.book, " ").concat(slot.chapter, ":").concat(slot.verseStart, "-").concat(slot.verseEnd)
                : "Scripture \u2014 ".concat(slot.book, " ").concat(slot.chapter);
        case 'PRAYER':
            return '--- Prayer ---';
        case 'MESSAGE':
            return 'Message';
        case 'HYMN':
            return slot.hymnName ? "Hymn \u2014 ".concat(slot.hymnName).concat(slot.hymnNumber ? " #".concat(slot.hymnNumber) : '') : 'Hymn — Empty';
    }
}
function slotPrefix(slot) {
    if (slot.kind === 'SONG')
        return 'Song — ';
    if (slot.kind === 'SCRIPTURE')
        return 'Scripture — ';
    if (slot.kind === 'HYMN')
        return 'Hymn — ';
    return '';
}
function slotName(slot) {
    var _a;
    if (slot.kind === 'SONG')
        return (_a = slot.songTitle) !== null && _a !== void 0 ? _a : 'Empty';
    if (slot.kind === 'HYMN')
        return slot.hymnName ? "".concat(slot.hymnName).concat(slot.hymnNumber ? " #".concat(slot.hymnNumber) : '') : 'Empty';
    if (slot.kind === 'SCRIPTURE' && slot.book) {
        return slot.verseStart && slot.verseEnd
            ? "".concat(slot.book, " ").concat(slot.chapter, ":").concat(slot.verseStart, "-").concat(slot.verseEnd)
            : "".concat(slot.book, " ").concat(slot.chapter);
    }
    return '';
}
function slotHasContent(slot) {
    if (slot.kind === 'SONG')
        return !!slot.songTitle;
    if (slot.kind === 'SCRIPTURE')
        return !!slot.book;
    if (slot.kind === 'HYMN')
        return !!slot.hymnName;
    return false;
}
function slotUrl(slot) {
    var _a;
    if (slot.kind === 'SONG' && slot.songId) {
        var ccli = (_a = songStore.songs.find(function (s) { return s.id === slot.songId; })) === null || _a === void 0 ? void 0 : _a.ccliNumber;
        if (ccli)
            return "https://songselect.ccli.com/songs/".concat(ccli);
    }
    if (slot.kind === 'SCRIPTURE' && slot.book && slot.chapter) {
        return (0, scripture_1.esvLink)(slot.book, slot.chapter);
    }
    return null;
}
function slotTextClass(slot) {
    if (slot.kind === 'SONG')
        return slot.songTitle ? 'text-gray-400' : 'text-gray-500 italic';
    if (slot.kind === 'SCRIPTURE')
        return slot.book ? 'text-gray-400' : 'text-gray-500 italic';
    if (slot.kind === 'PRAYER')
        return 'text-gray-600';
    return 'text-gray-500';
}
// Static status class lookup (Tailwind v4 purge safety)
var statusClasses = {
    draft: 'bg-gray-800 text-gray-400 border border-gray-700',
    planned: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
    exported: 'bg-green-900/50 text-green-300 border border-green-800',
};
var statusClass = (0, vue_1.computed)(function () { var _a; return (_a = statusClasses[props.service.status]) !== null && _a !== void 0 ? _a : 'bg-gray-800 text-gray-400'; });
function onShare() {
    return __awaiter(this, void 0, void 0, function () {
        var token, url, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!serviceStore.orgId)
                        return [2 /*return*/];
                    isSharing.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, serviceStore.createShareToken(props.service, serviceStore.orgId)];
                case 2:
                    token = _a.sent();
                    url = "".concat(window.location.origin, "/share/").concat(token);
                    return [4 /*yield*/, navigator.clipboard.writeText(url)];
                case 3:
                    _a.sent();
                    shareCopied.value = true;
                    setTimeout(function () {
                        shareCopied.value = false;
                    }, 2000);
                    return [3 /*break*/, 6];
                case 4:
                    err_1 = _a.sent();
                    console.error('Share failed:', err_1);
                    return [3 /*break*/, 6];
                case 5:
                    isSharing.value = false;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function onPrint() {
    router.push('/services/' + props.service.id).then(function () {
        setTimeout(function () { return window.print(); }, 300);
    });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col h-full rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden" }));
var __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
var __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0(__assign({ to: ('/services/' + __VLS_ctx.service.id) }, { class: "block flex-1 min-h-0 px-3 py-2.5" })));
var __VLS_2 = __VLS_1.apply(void 0, __spreadArray([__assign({ to: ('/services/' + __VLS_ctx.service.id) }, { class: "block flex-1 min-h-0 px-3 py-2.5" })], __VLS_functionalComponentArgsRest(__VLS_1), false));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-2 mb-1.5" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 min-w-0" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-semibold text-gray-100" }));
(__VLS_ctx.formattedDate);
if (__VLS_ctx.sermonPassageLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign({ onClick: function () { } }, { href: (__VLS_ctx.sermonPassageUrl), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 transition-colors" }));
    (__VLS_ctx.sermonPassageLabel);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0" }, { class: (__VLS_ctx.statusClass) }));
if (__VLS_ctx.service.status === 'exported') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor" }, { class: "h-3 w-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'fill-rule': "evenodd",
        d: "M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z",
        'clip-rule': "evenodd",
    });
}
else if (__VLS_ctx.service.status === 'planned') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor" }, { class: "h-3 w-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'fill-rule': "evenodd",
        d: "M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z",
        'clip-rule': "evenodd",
    });
}
(__VLS_ctx.service.status);
if (__VLS_ctx.service.teams.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 mb-1" }));
    for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.displayTeams)); _i < _a.length; _i++) {
        var team = _a[_i][0];
        /** @type {[typeof TeamTagPill, ]} */ ;
        // @ts-ignore
        var __VLS_4 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
            key: (team),
            tag: (team),
        }));
        var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([{
                key: (team),
                tag: (team),
            }], __VLS_functionalComponentArgsRest(__VLS_4), false));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs space-y-0.5" }));
for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.openingSlots)); _b < _c.length; _b++) {
    var slot = _c[_b][0];
    (slot.position);
    if (__VLS_ctx.slotUrl(slot)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate text-gray-400" }));
        (__VLS_ctx.slotPrefix(slot));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign({ onClick: function () { } }, { href: (__VLS_ctx.slotUrl(slot)), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 transition-colors" }));
        (__VLS_ctx.slotName(slot));
    }
    else if (__VLS_ctx.slotHasContent(slot)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate text-gray-400" }));
        (__VLS_ctx.slotPrefix(slot));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-indigo-400" }));
        (__VLS_ctx.slotName(slot));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate" }, { class: (__VLS_ctx.slotTextClass(slot)) }));
        (__VLS_ctx.slotLabel(slot));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-600 text-xs my-0.5" }));
for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.sendingSlots)); _d < _e.length; _d++) {
    var slot = _e[_d][0];
    (slot.position);
    if (__VLS_ctx.slotUrl(slot)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate text-gray-400" }));
        (__VLS_ctx.slotPrefix(slot));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign({ onClick: function () { } }, { href: (__VLS_ctx.slotUrl(slot)), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 transition-colors" }));
        (__VLS_ctx.slotName(slot));
    }
    else if (__VLS_ctx.slotHasContent(slot)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate text-gray-400" }));
        (__VLS_ctx.slotPrefix(slot));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-indigo-400" }));
        (__VLS_ctx.slotName(slot));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "truncate" }, { class: (__VLS_ctx.slotTextClass(slot)) }));
        (__VLS_ctx.slotLabel(slot));
    }
}
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onShare) }, { type: "button", disabled: (__VLS_ctx.isSharing) }), { class: "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" }), { title: "Share" }));
if (!__VLS_ctx.shareCopied) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5 text-green-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M5 13l4 4L19 7",
    });
}
(__VLS_ctx.isSharing ? '...' : __VLS_ctx.shareCopied ? 'Copied!' : 'Share');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onPrint) }, { type: "button" }), { class: "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" }), { title: "Print" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    d: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['my-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            TeamTagPill: TeamTagPill_vue_1.default,
            isSharing: isSharing,
            shareCopied: shareCopied,
            displayTeams: displayTeams,
            formattedDate: formattedDate,
            sermonPassageLabel: sermonPassageLabel,
            sermonPassageUrl: sermonPassageUrl,
            openingSlots: openingSlots,
            sendingSlots: sendingSlots,
            slotLabel: slotLabel,
            slotPrefix: slotPrefix,
            slotName: slotName,
            slotHasContent: slotHasContent,
            slotUrl: slotUrl,
            slotTextClass: slotTextClass,
            statusClass: statusClass,
            onShare: onShare,
            onPrint: onPrint,
        };
    },
    __typeProps: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
