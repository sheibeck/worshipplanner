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
var auth_1 = require("@/stores/auth");
var songs_1 = require("@/stores/songs");
var pcSongImport_1 = require("@/utils/pcSongImport");
var props = defineProps();
var emit = defineEmits();
var authStore = (0, auth_1.useAuthStore)();
var songStore = (0, songs_1.useSongStore)();
var step = (0, vue_1.ref)('idle');
var errorMessage = (0, vue_1.ref)('');
// Checked by default: only import songs not already in the library.
var newOnly = (0, vue_1.ref)(true);
// Partitioned mapped songs from PC (stored between fetch and confirm)
var newSongs = (0, vue_1.ref)([]);
var existingSongs = (0, vue_1.ref)([]);
// Preview counts
var preview = (0, vue_1.ref)({ toAdd: 0, toUpdate: 0 });
// ── Reset on open ──────────────────────────────────────────────────────────────
(0, vue_1.watch)(function () { return props.open; }, function (isOpen) {
    if (isOpen)
        resetToIdle();
});
function resetToIdle() {
    step.value = 'idle';
    errorMessage.value = '';
    newSongs.value = [];
    existingSongs.value = [];
    preview.value = { toAdd: 0, toUpdate: 0 };
}
// ── Actions ───────────────────────────────────────────────────────────────────
function onStartFetch() {
    return __awaiter(this, void 0, void 0, function () {
        var creds, songs, partition, err_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    creds = authStore.pcCredentials;
                    if (!creds)
                        return [2 /*return*/];
                    step.value = 'fetching';
                    errorMessage.value = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAndMapPcSongs)(creds.appId, creds.secret)];
                case 2:
                    songs = _a.sent();
                    partition = (0, pcSongImport_1.partitionPcSongs)(songs, songStore.songs);
                    newSongs.value = partition.newSongs;
                    existingSongs.value = partition.existingSongs;
                    preview.value = { toAdd: partition.newSongs.length, toUpdate: partition.existingSongs.length };
                    step.value = 'preview';
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    message = err_1 instanceof Error ? err_1.message : 'An unknown error occurred';
                    errorMessage.value = message;
                    step.value = 'error';
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function onConfirmImport() {
    return __awaiter(this, void 0, void 0, function () {
        var songsToImport, err_2, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    step.value = 'importing';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    songsToImport = newOnly.value ? newSongs.value : __spreadArray(__spreadArray([], newSongs.value, true), existingSongs.value, true);
                    return [4 /*yield*/, songStore.upsertSongs(songsToImport)];
                case 2:
                    _a.sent();
                    step.value = 'done';
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    message = err_2 instanceof Error ? err_2.message : 'An unknown error occurred';
                    errorMessage.value = message;
                    step.value = 'error';
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Close ──────────────────────────────────────────────────────────────────────
function onClose() {
    if (step.value === 'fetching' || step.value === 'importing')
        return;
    emit('close');
}
function onDoneClose() {
    var importedCount = newOnly.value ? preview.value.toAdd : preview.value.toAdd + preview.value.toUpdate;
    emit('imported', importedCount);
    emit('close');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
var __VLS_0 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
var __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "body",
}));
var __VLS_2 = __VLS_1.apply(void 0, __spreadArray([{
        to: "body",
    }], __VLS_functionalComponentArgsRest(__VLS_1), false));
__VLS_3.slots.default;
var __VLS_4 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    enterActiveClass: "transition-opacity duration-200 ease-out",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-150 ease-in",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}));
var __VLS_6 = __VLS_5.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-opacity duration-200 ease-out",
        enterFromClass: "opacity-0",
        enterToClass: "opacity-100",
        leaveActiveClass: "transition-opacity duration-150 ease-in",
        leaveFromClass: "opacity-100",
        leaveToClass: "opacity-0",
    }], __VLS_functionalComponentArgsRest(__VLS_5), false));
__VLS_7.slots.default;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-0 z-40 bg-black/60" }));
}
var __VLS_7;
var __VLS_8 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    enterActiveClass: "transition-all duration-200 ease-out",
    enterFromClass: "opacity-0 scale-95",
    enterToClass: "opacity-100 scale-100",
    leaveActiveClass: "transition-all duration-150 ease-in",
    leaveFromClass: "opacity-100 scale-100",
    leaveToClass: "opacity-0 scale-95",
}));
var __VLS_10 = __VLS_9.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-all duration-200 ease-out",
        enterFromClass: "opacity-0 scale-95",
        enterToClass: "opacity-100 scale-100",
        leaveActiveClass: "transition-all duration-150 ease-in",
        leaveFromClass: "opacity-100 scale-100",
        leaveToClass: "opacity-0 scale-95",
    }], __VLS_functionalComponentArgsRest(__VLS_9), false));
__VLS_11.slots.default;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-0 z-50 flex items-center justify-center p-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full max-w-lg max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mt-0.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onClose) }, { type: "button" }), { class: "p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" }), { 'aria-label': "Close" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 overflow-y-auto" }));
    if (__VLS_ctx.step === 'idle') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8" }));
        if (!__VLS_ctx.authStore.hasPcCredentials) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-red-900/20 border border-red-800 p-4 mb-6" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-start gap-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5 text-red-400 shrink-0 mt-0.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-medium text-red-300" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-red-400/80 mt-1" }));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center py-4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "p-4 rounded-full bg-indigo-900/30 border border-indigo-800/50 inline-flex mb-4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-8 w-8 text-indigo-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "1.5" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
            if (!__VLS_ctx.newOnly) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-1" }));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "mt-4 flex items-center justify-center gap-2 cursor-pointer select-none" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ id: "pc-import-new-only", type: "checkbox" }, { class: "h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900" }));
            (__VLS_ctx.newOnly);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-300" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-1" }));
        }
    }
    else if (__VLS_ctx.step === 'fetching') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-12 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
    }
    else if (__VLS_ctx.step === 'preview') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-gray-800/60 border border-gray-700 p-5" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-sm font-semibold text-gray-200 mb-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-2 gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-green-900/20 border border-green-800/50 p-4 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-2xl font-bold text-green-300" }));
        (__VLS_ctx.preview.toAdd);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-green-400/80 mt-1" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-blue-900/20 border border-blue-800/50 p-4 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-2xl font-bold text-blue-300" }));
        (__VLS_ctx.preview.toUpdate);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-blue-400/80 mt-1" }));
        (__VLS_ctx.newOnly ? 'Existing songs skipped' : 'Existing songs to update');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-4 text-center" }));
        (__VLS_ctx.preview.toAdd + __VLS_ctx.preview.toUpdate);
    }
    else if (__VLS_ctx.step === 'importing') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-12 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
    }
    else if (__VLS_ctx.step === 'done') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-10 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "p-3 rounded-full bg-green-900/30 border border-green-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-8 w-8 text-green-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M5 13l4 4L19 7",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-base font-semibold text-gray-100" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
        (__VLS_ctx.preview.toAdd);
        (__VLS_ctx.preview.toAdd !== 1 ? 's' : '');
        (__VLS_ctx.preview.toUpdate);
        (__VLS_ctx.preview.toUpdate !== 1 ? 's' : '');
        (__VLS_ctx.newOnly ? 'skipped' : 'updated');
    }
    else if (__VLS_ctx.step === 'error') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-red-900/20 border border-red-800 p-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-start gap-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5 text-red-400 shrink-0 mt-0.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-medium text-red-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-red-400/80 mt-1" }));
        (__VLS_ctx.errorMessage);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 shrink-0" }));
    if (__VLS_ctx.step !== 'done' && __VLS_ctx.step !== 'importing') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onClose) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
    }
    if (__VLS_ctx.step === 'idle') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onStartFetch) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }), { disabled: (!__VLS_ctx.authStore.hasPcCredentials) }));
    }
    if (__VLS_ctx.step === 'error') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onStartFetch) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors" }));
    }
    if (__VLS_ctx.step === 'preview') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onConfirmImport) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors" }));
    }
    if (__VLS_ctx.step === 'done') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onDoneClose) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors" }));
    }
}
var __VLS_11;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[90vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800/60']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            authStore: authStore,
            step: step,
            errorMessage: errorMessage,
            newOnly: newOnly,
            preview: preview,
            onStartFetch: onStartFetch,
            onConfirmImport: onConfirmImport,
            onClose: onClose,
            onDoneClose: onDoneClose,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
