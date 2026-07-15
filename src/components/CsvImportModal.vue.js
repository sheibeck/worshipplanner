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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var papaparse_1 = require("papaparse");
var songs_1 = require("@/stores/songs");
var csvImport_1 = require("@/utils/csvImport");
var props = defineProps();
var emit = defineEmits();
var songStore = (0, songs_1.useSongStore)();
var step = (0, vue_1.ref)('select');
var fileInputRef = (0, vue_1.ref)(null);
var isDragging = (0, vue_1.ref)(false);
var detectedColumns = (0, vue_1.ref)([]);
var previewSongs = (0, vue_1.ref)([]);
var checkedRows = (0, vue_1.ref)([]);
var importTotal = (0, vue_1.ref)(0);
var importProgress = (0, vue_1.ref)(0);
var importedCount = (0, vue_1.ref)(0);
// ── Reset on open ──────────────────────────────────────────────────────────────
(0, vue_1.watch)(function () { return props.open; }, function (isOpen) {
    if (isOpen)
        resetToSelect();
});
function resetToSelect() {
    step.value = 'select';
    isDragging.value = false;
    detectedColumns.value = [];
    previewSongs.value = [];
    checkedRows.value = [];
    importTotal.value = 0;
    importProgress.value = 0;
    importedCount.value = 0;
    if (fileInputRef.value)
        fileInputRef.value.value = '';
}
// ── Computed preview stats ─────────────────────────────────────────────────────
var totalCount = (0, vue_1.computed)(function () { return previewSongs.value.length; });
var duplicateCount = (0, vue_1.computed)(function () { return previewSongs.value.filter(function (s) { return s.isDuplicate; }).length; });
var warningCount = (0, vue_1.computed)(function () { return previewSongs.value.filter(function (s) { return !s.isDuplicate && s._warnings.length > 0; }).length; });
var checkedNonDuplicateCount = (0, vue_1.computed)(function () {
    return previewSongs.value.reduce(function (count, song, idx) {
        if (!song.isDuplicate && checkedRows.value[idx])
            return count + 1;
        return count;
    }, 0);
});
var allNonDuplicatesChecked = (0, vue_1.computed)(function () {
    var nonDups = previewSongs.value.filter(function (s) { return !s.isDuplicate; });
    if (nonDups.length === 0)
        return false;
    return nonDups.every(function (_, i) {
        var actualIdx = previewSongs.value.indexOf(nonDups[i]);
        return checkedRows.value[actualIdx];
    });
});
var someNonDuplicatesChecked = (0, vue_1.computed)(function () {
    if (allNonDuplicatesChecked.value)
        return false;
    return previewSongs.value.some(function (song, idx) { return !song.isDuplicate && checkedRows.value[idx]; });
});
function toggleAllNonDuplicates(event) {
    var checked = event.target.checked;
    checkedRows.value = previewSongs.value.map(function (song) { return (song.isDuplicate ? false : checked); });
}
// ── File handling ──────────────────────────────────────────────────────────────
function onDrop(event) {
    var _a;
    isDragging.value = false;
    var file = (_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.files[0];
    if (file)
        processFile(file);
}
function onFileInputChange(event) {
    var _a;
    var file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
    if (file)
        processFile(file);
}
function processFile(file) {
    step.value = 'parsing';
    papaparse_1.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            var _a;
            detectedColumns.value = (_a = results.meta.fields) !== null && _a !== void 0 ? _a : [];
            console.log('[CsvImportModal] detected columns:', detectedColumns.value);
            // Map rows to ParsedSongPreview
            var mapped = results.data.map(function (row) { return (0, csvImport_1.mapRowToSong)(row); });
            // Detect duplicates against existing songs in the store
            var withDuplicates = (0, csvImport_1.detectDuplicates)(mapped, songStore.songs);
            previewSongs.value = withDuplicates;
            // Default: all non-duplicate rows checked
            checkedRows.value = withDuplicates.map(function (s) { return !s.isDuplicate; });
            step.value = 'preview';
        },
        error: function (err) {
            console.error('[CsvImportModal] PapaParse error:', err);
            step.value = 'select';
        },
    });
}
// ── Import ─────────────────────────────────────────────────────────────────────
function onImport() {
    return __awaiter(this, void 0, void 0, function () {
        var toImport, songInputs, CHUNK, imported, i, chunk;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    toImport = previewSongs.value.filter(function (song, idx) { return !song.isDuplicate && checkedRows.value[idx]; });
                    if (toImport.length === 0)
                        return [2 /*return*/];
                    importTotal.value = toImport.length;
                    importProgress.value = 0;
                    step.value = 'importing';
                    songInputs = toImport.map(function (_a) {
                        var _d = _a.isDuplicate, _w = _a._warnings, song = __rest(_a, ["isDuplicate", "_warnings"]);
                        return (__assign(__assign({}, song), { removedThemes: [] }));
                    });
                    CHUNK = 100;
                    imported = 0;
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < songInputs.length)) return [3 /*break*/, 4];
                    chunk = songInputs.slice(i, i + CHUNK);
                    return [4 /*yield*/, songStore.importSongs(chunk)];
                case 2:
                    _a.sent();
                    imported += chunk.length;
                    importProgress.value = Math.round((imported / importTotal.value) * 100);
                    _a.label = 3;
                case 3:
                    i += CHUNK;
                    return [3 /*break*/, 1];
                case 4:
                    importedCount.value = imported;
                    step.value = 'done';
                    return [2 /*return*/];
            }
        });
    });
}
// ── Close ──────────────────────────────────────────────────────────────────────
function onClose() {
    if (step.value === 'importing')
        return; // prevent close while importing
    emit('close');
}
function onDoneClose() {
    emit('imported', importedCount.value);
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onClose) }, { class: "fixed inset-0 z-40 bg-black/60" }));
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onClose) }, { class: "fixed inset-0 z-50 flex items-center justify-center p-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col" }));
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
    if (__VLS_ctx.step === 'select') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-6" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign(__assign(__assign(__assign({ onDragover: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.open))
                    return;
                if (!(__VLS_ctx.step === 'select'))
                    return;
                __VLS_ctx.isDragging = true;
            } }, { onDragleave: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.open))
                    return;
                if (!(__VLS_ctx.step === 'select'))
                    return;
                __VLS_ctx.isDragging = false;
            } }), { onDrop: (__VLS_ctx.onDrop) }), { onClick: function () {
                var _a;
                var _b = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _b[_i] = arguments[_i];
                }
                var $event = _b[0];
                if (!(__VLS_ctx.open))
                    return;
                if (!(__VLS_ctx.step === 'select'))
                    return;
                (_a = __VLS_ctx.fileInputRef) === null || _a === void 0 ? void 0 : _a.click();
            } }), { class: "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer" }), { class: (__VLS_ctx.isDragging
                ? 'border-indigo-500 bg-indigo-900/10'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800') }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "p-3 rounded-full bg-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-8 w-8 text-gray-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "1.5" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-medium text-gray-200" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-1" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-600" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: (__VLS_ctx.onFileInputChange) }, { ref: "fileInputRef", type: "file", accept: ".csv" }), { class: "hidden" }));
        /** @type {typeof __VLS_ctx.fileInputRef} */ ;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-5 p-4 rounded-lg bg-gray-800 border border-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-medium text-gray-300 mb-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ol, __VLS_intrinsicElements.ol)(__assign({ class: "text-xs text-gray-500 space-y-1 list-decimal list-inside" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    }
    else if (__VLS_ctx.step === 'parsing') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-12 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
    }
    else if (__VLS_ctx.step === 'preview') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col" }));
        if (__VLS_ctx.detectedColumns.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 pt-4 pb-2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.details, __VLS_intrinsicElements.details)(__assign({ class: "text-xs" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.summary, __VLS_intrinsicElements.summary)(__assign({ class: "text-gray-500 cursor-pointer hover:text-gray-400 transition-colors" }));
            (__VLS_ctx.detectedColumns.length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-2 p-3 rounded-md bg-gray-800 border border-gray-700 font-mono text-gray-400 leading-relaxed break-all" }));
            (__VLS_ctx.detectedColumns.join(', '));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-3 border-b border-gray-800 flex items-center gap-4 flex-wrap shrink-0" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm font-medium text-gray-200" }));
        (__VLS_ctx.totalCount);
        (__VLS_ctx.totalCount !== 1 ? 's' : '');
        if (__VLS_ctx.duplicateCount > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/60 text-red-300" }));
            (__VLS_ctx.duplicateCount);
            (__VLS_ctx.duplicateCount !== 1 ? 's' : '');
        }
        if (__VLS_ctx.warningCount > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/60 text-yellow-300" }));
            (__VLS_ctx.warningCount);
            (__VLS_ctx.warningCount !== 1 ? 's' : '');
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400 ml-auto" }));
        (__VLS_ctx.checkedNonDuplicateCount);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "overflow-x-auto" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ class: "border-b border-gray-800" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left w-8" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: (__VLS_ctx.toggleAllNonDuplicates) }, { type: "checkbox", checked: (__VLS_ctx.allNonDuplicatesChecked), indeterminate: (__VLS_ctx.someNonDuplicatesChecked) }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden sm:table-cell" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden md:table-cell" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden md:table-cell" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
        var _loop_1 = function (song, idx) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign(__assign({ key: (idx) }, { class: "border-b border-gray-800/50 transition-colors" }), { class: (song.isDuplicate
                    ? 'bg-red-900/10 hover:bg-red-900/20'
                    : song._warnings.length > 0
                        ? 'bg-yellow-900/10 hover:bg-yellow-900/20'
                        : 'hover:bg-gray-800/40') }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5" }));
            if (!song.isDuplicate) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.open))
                            return;
                        if (!!(__VLS_ctx.step === 'select'))
                            return;
                        if (!!(__VLS_ctx.step === 'parsing'))
                            return;
                        if (!(__VLS_ctx.step === 'preview'))
                            return;
                        if (!(!song.isDuplicate))
                            return;
                        __VLS_ctx.checkedRows[idx] = !__VLS_ctx.checkedRows[idx];
                    } }, { type: "checkbox", checked: (__VLS_ctx.checkedRows[idx]) }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500" }));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-700 text-xs" }));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-200" }, { class: (song.isDuplicate ? 'line-through text-gray-500' : '') }));
            (song.title || '(no title)');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5 text-gray-400 hidden sm:table-cell" }));
            (song.ccliNumber || '—');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5 text-gray-400 hidden md:table-cell" }));
            (song.author || '—');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5 text-gray-400 hidden md:table-cell" }));
            (((_a = song.arrangements[0]) === null || _a === void 0 ? void 0 : _a.key) || '—');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-2.5" }));
            if (song.isDuplicate) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400" }));
            }
            else if (song._warnings.length > 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/50 text-yellow-400" }, { title: (song._warnings.join(', ')) }));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400" }));
            }
        };
        for (var _i = 0, _b = __VLS_getVForSourceType((__VLS_ctx.previewSongs)); _i < _b.length; _i++) {
            var _c = _b[_i], song = _c[0], idx = _c[1];
            _loop_1(song, idx);
        }
    }
    else if (__VLS_ctx.step === 'importing') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-12 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center gap-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
        (__VLS_ctx.importTotal);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "bg-indigo-500 h-full rounded-full transition-all duration-300" }, { style: ({ width: __VLS_ctx.importProgress + '%' }) }));
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
        (__VLS_ctx.importedCount);
        (__VLS_ctx.importedCount !== 1 ? 's' : '');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-4 border-t border-gray-800 flex items-center justify-between shrink-0" }));
    if (__VLS_ctx.step === 'preview') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.resetToSelect) }, { type: "button" }), { class: "text-sm text-gray-400 hover:text-gray-200 transition-colors" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3" }));
    if (__VLS_ctx.step !== 'done' && __VLS_ctx.step !== 'importing') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onClose) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
    }
    if (__VLS_ctx.step === 'preview') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onImport) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }), { disabled: (__VLS_ctx.checkedNonDuplicateCount === 0) }));
        (__VLS_ctx.checkedNonDuplicateCount);
        (__VLS_ctx.checkedNonDuplicateCount !== 1 ? 's' : '');
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
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
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
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['list-decimal']} */ ;
/** @type {__VLS_StyleScopedClasses['list-inside']} */ ;
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-700/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-yellow-700/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-yellow-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-700/40']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
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
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
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
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
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
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            step: step,
            fileInputRef: fileInputRef,
            isDragging: isDragging,
            detectedColumns: detectedColumns,
            previewSongs: previewSongs,
            checkedRows: checkedRows,
            importTotal: importTotal,
            importProgress: importProgress,
            importedCount: importedCount,
            resetToSelect: resetToSelect,
            totalCount: totalCount,
            duplicateCount: duplicateCount,
            warningCount: warningCount,
            checkedNonDuplicateCount: checkedNonDuplicateCount,
            allNonDuplicatesChecked: allNonDuplicatesChecked,
            someNonDuplicatesChecked: someNonDuplicatesChecked,
            toggleAllNonDuplicates: toggleAllNonDuplicates,
            onDrop: onDrop,
            onFileInputChange: onFileInputChange,
            onImport: onImport,
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
