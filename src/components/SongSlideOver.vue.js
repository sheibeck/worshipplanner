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
var songs_1 = require("@/stores/songs");
var auth_1 = require("@/stores/auth");
var useUnsavedGuard_1 = require("@/composables/useUnsavedGuard");
var props = defineProps();
var emit = defineEmits();
var songStore = (0, songs_1.useSongStore)();
var authStore = (0, auth_1.useAuthStore)();
function emptyForm() {
    return {
        title: '',
        ccliNumber: '',
        author: '',
        vwTypes: [],
        themes: [],
        notes: '',
        tags: [],
        arrangements: [],
        primaryArrangementId: null,
    };
}
function songToForm(song) {
    var _a, _b, _c, _d;
    return {
        title: song.title,
        ccliNumber: String((_a = song.ccliNumber) !== null && _a !== void 0 ? _a : ''),
        author: song.author,
        vwTypes: __spreadArray([], ((_b = song.vwTypes) !== null && _b !== void 0 ? _b : []), true),
        themes: __spreadArray([], song.themes, true),
        notes: song.notes,
        tags: __spreadArray([], ((_c = song.tags) !== null && _c !== void 0 ? _c : []), true),
        arrangements: song.arrangements.map(function (a) { return (__assign(__assign({}, a), { teamTags: __spreadArray([], a.teamTags, true) })); }),
        primaryArrangementId: (_d = song.primaryArrangementId) !== null && _d !== void 0 ? _d : null,
    };
}
var form = (0, vue_1.ref)(emptyForm());
var themesInput = (0, vue_1.ref)('');
var userTagInput = (0, vue_1.ref)('');
var titleError = (0, vue_1.ref)(false);
var showDeleteConfirm = (0, vue_1.ref)(false);
var isSaving = (0, vue_1.ref)(false);
var isDeleting = (0, vue_1.ref)(false);
// ── Unsaved-changes guard ──────────────────────────────────────────────────
// Snapshot covers the editable form fields + the raw themes text input (the
// latter can be dirtied without yet having been parsed back into form.themes).
var unsavedGuard = (0, useUnsavedGuard_1.useUnsavedGuard)(function () { return ({ form: form.value, themesInput: themesInput.value }); });
// Keep themesInput in sync with form.themes when panel opens
(0, vue_1.watch)(function () { return props.open; }, function (isOpen) {
    if (isOpen) {
        if (props.song) {
            form.value = songToForm(props.song);
        }
        else {
            form.value = emptyForm();
        }
        themesInput.value = form.value.themes.join(', ');
        userTagInput.value = '';
        titleError.value = false;
        showDeleteConfirm.value = false;
        unsavedGuard.capture();
    }
});
var isCreateMode = (0, vue_1.computed)(function () { return props.song === null; });
// ── Available tags ─────────────────────────────────────────────────────────────
// Predefined former "team tag" names — folded into the flat User Tags editor (D-01).
// Seeded into the type-ahead so users can still quickly apply them as ordinary tags.
var PREDEFINED_TAGS = ['Choir', 'Orchestra', 'Hymn'];
// Type-ahead suggestions for the User Tags input: predefined names + tags already in use.
var tagSuggestions = (0, vue_1.computed)(function () {
    var tags = new Set(PREDEFINED_TAGS);
    songStore.allUserTags.forEach(function (t) { return tags.add(t); });
    return Array.from(tags).sort();
});
// ── VW Type ────────────────────────────────────────────────────────────────────
var vwTypeLabels = {
    1: '1 - Call to Worship',
    2: '2 - Intimate',
    3: '3 - Ascription',
};
// Static classes to prevent Tailwind purge
var vwTypeSelected = {
    1: 'bg-blue-700 border-blue-500 text-white',
    2: 'bg-purple-700 border-purple-500 text-white',
    3: 'bg-amber-700 border-amber-500 text-white',
};
var vwTypeUnselected = {
    1: 'bg-gray-800 border-gray-700 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700',
    2: 'bg-gray-800 border-gray-700 text-purple-400 hover:bg-purple-900/30 hover:border-purple-700',
    3: 'bg-gray-800 border-gray-700 text-amber-400 hover:bg-amber-900/30 hover:border-amber-700',
};
function vwTypeClasses(type) {
    return form.value.vwTypes.includes(type) ? vwTypeSelected[type] : vwTypeUnselected[type];
}
function toggleVwType(type) {
    var idx = form.value.vwTypes.indexOf(type);
    if (idx >= 0) {
        form.value.vwTypes.splice(idx, 1);
    }
    else {
        form.value.vwTypes.push(type);
    }
}
// ── User tags (ad-hoc free-text) ───────────────────────────────────────────────
function toggleUserTag(tag) {
    var idx = form.value.tags.indexOf(tag);
    if (idx >= 0) {
        form.value.tags.splice(idx, 1);
    }
    else {
        form.value.tags.push(tag);
    }
}
function addUserTags() {
    var newTags = userTagInput.value
        .split(',')
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
    for (var _i = 0, newTags_1 = newTags; _i < newTags_1.length; _i++) {
        var tag = newTags_1[_i];
        if (!form.value.tags.includes(tag)) {
            form.value.tags.push(tag);
        }
    }
    userTagInput.value = '';
}
function removeUserTag(tag) {
    var idx = form.value.tags.indexOf(tag);
    if (idx >= 0) {
        form.value.tags.splice(idx, 1);
    }
}
// ── Save / Cancel / Delete ────────────────────────────────────────────────────
function onSave() {
    return __awaiter(this, void 0, void 0, function () {
        var title, themes, oldThemes, newlyRemoved, removedThemes, arrangements, primaryArrangementId, data;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    title = form.value.title.trim();
                    if (!title) {
                        titleError.value = true;
                        return [2 /*return*/];
                    }
                    titleError.value = false;
                    themes = themesInput.value
                        .split(',')
                        .map(function (t) { return t.trim(); })
                        .filter(Boolean);
                    oldThemes = (_b = (_a = props.song) === null || _a === void 0 ? void 0 : _a.themes) !== null && _b !== void 0 ? _b : [];
                    newlyRemoved = oldThemes.filter(function (t) { return !themes.includes(t); });
                    removedThemes = Array.from(new Set(__spreadArray(__spreadArray([], ((_d = (_c = props.song) === null || _c === void 0 ? void 0 : _c.removedThemes) !== null && _d !== void 0 ? _d : []), true), newlyRemoved, true))).filter(function (t) { return !themes.includes(t); });
                    arrangements = form.value.arrangements;
                    primaryArrangementId = form.value.primaryArrangementId &&
                        arrangements.some(function (a) { return a.id === form.value.primaryArrangementId; })
                        ? form.value.primaryArrangementId
                        : ((_f = (_e = arrangements[0]) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : null);
                    data = {
                        title: title,
                        ccliNumber: String((_g = form.value.ccliNumber) !== null && _g !== void 0 ? _g : '').trim(),
                        author: form.value.author.trim(),
                        vwTypes: form.value.vwTypes,
                        themes: themes,
                        notes: form.value.notes.trim(),
                        tags: form.value.tags,
                        arrangements: arrangements,
                        primaryArrangementId: primaryArrangementId,
                        lastUsedAt: (_j = (_h = props.song) === null || _h === void 0 ? void 0 : _h.lastUsedAt) !== null && _j !== void 0 ? _j : null,
                        hidden: (_l = (_k = props.song) === null || _k === void 0 ? void 0 : _k.hidden) !== null && _l !== void 0 ? _l : false,
                        pcSongId: (_o = (_m = props.song) === null || _m === void 0 ? void 0 : _m.pcSongId) !== null && _o !== void 0 ? _o : null,
                        removedThemes: removedThemes,
                    };
                    isSaving.value = true;
                    _p.label = 1;
                case 1:
                    _p.trys.push([1, , 6, 7]);
                    if (!isCreateMode.value) return [3 /*break*/, 3];
                    return [4 /*yield*/, songStore.addSong(data)];
                case 2:
                    _p.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, songStore.updateSong(props.song.id, data)];
                case 4:
                    _p.sent();
                    _p.label = 5;
                case 5:
                    emit('saved');
                    return [3 /*break*/, 7];
                case 6:
                    isSaving.value = false;
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function onCancel() {
    if (!unsavedGuard.confirmDiscard())
        return;
    emit('close');
}
function onDelete() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!props.song)
                        return [2 /*return*/];
                    isDeleting.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, songStore.deleteSong(props.song.id)];
                case 2:
                    _a.sent();
                    emit('deleted');
                    return [3 /*break*/, 4];
                case 3:
                    isDeleting.value = false;
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onCancel) }, { class: "fixed inset-0 z-40 bg-black/30" }));
}
var __VLS_7;
var __VLS_8 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    enterActiveClass: "transition-transform duration-250 ease-out",
    enterFromClass: "translate-x-full",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition-transform duration-200 ease-in",
    leaveFromClass: "translate-x-0",
    leaveToClass: "translate-x-full",
}));
var __VLS_10 = __VLS_9.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-transform duration-250 ease-out",
        enterFromClass: "translate-x-full",
        enterToClass: "translate-x-0",
        leaveActiveClass: "transition-transform duration-200 ease-in",
        leaveFromClass: "translate-x-0",
        leaveToClass: "translate-x-full",
    }], __VLS_functionalComponentArgsRest(__VLS_9), false));
__VLS_11.slots.default;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100" }));
    (__VLS_ctx.isCreateMode ? 'New Song' : 'Edit Song');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onCancel) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign(__assign({ onClick: (__VLS_ctx.onSave) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors" }), { class: (__VLS_ctx.unsavedGuard.isDirty.value && !__VLS_ctx.isSaving
            ? 'bg-indigo-600 hover:bg-indigo-500'
            : 'bg-indigo-600/40 cursor-default text-white/50') }), { disabled: (!__VLS_ctx.unsavedGuard.isDirty.value || __VLS_ctx.isSaving) }));
    (__VLS_ctx.isSaving ? 'Saving...' : 'Save');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onCancel) }, { type: "button" }), { class: "p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" }), { 'aria-label': "Close" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 overflow-y-auto px-5 py-5 space-y-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-red-400" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ value: (__VLS_ctx.form.title), type: "text", placeholder: "Song title" }, { class: "w-full rounded-md bg-gray-800 border text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" }), { class: (__VLS_ctx.titleError ? 'border-red-500' : 'border-gray-700') }));
    if (__VLS_ctx.titleError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "mt-1 text-xs text-red-400" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-2 gap-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.form.ccliNumber), type: "text", placeholder: "e.g. 7047788" }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.form.author), type: "text", placeholder: "e.g. Hillsong" }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    if (__VLS_ctx.authStore.vwModeEnabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex gap-2" }));
        var _loop_1 = function (t) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(__VLS_ctx.authStore.vwModeEnabled))
                        return;
                    __VLS_ctx.toggleVwType(t);
                } }, { key: (t), type: "button" }), { class: "flex-1 py-2 rounded-md text-sm font-semibold border transition-colors" }), { class: (__VLS_ctx.vwTypeClasses(t)) }));
            (__VLS_ctx.vwTypeLabels[t]);
        };
        for (var _i = 0, _a = __VLS_getVForSourceType([1, 2, 3]); _i < _a.length; _i++) {
            var t = _a[_i][0];
            _loop_1(t);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600 font-normal" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.themesInput), type: "text", placeholder: "e.g. worship, praise, Easter" }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)(__assign({ value: (__VLS_ctx.form.notes), rows: "3", placeholder: "Song notes..." }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-2 mb-2" }));
    var _loop_2 = function (tag) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ key: (tag) }, { class: "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border bg-pink-900/50 text-pink-300 border-pink-800" }));
        (tag);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.open))
                    return;
                __VLS_ctx.removeUserTag(tag);
            } }, { type: "button" }), { class: "ml-0.5 text-pink-400 hover:text-pink-200 leading-none" }), { 'aria-label': "Remove tag" }));
    };
    for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.form.tags)); _b < _c.length; _b++) {
        var tag = _c[_b][0];
        _loop_2(tag);
    }
    if (__VLS_ctx.form.tags.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-600" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex gap-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.addUserTags) }, { value: (__VLS_ctx.userTagInput), type: "text", list: "ss-existing-user-tags", placeholder: "e.g. Christmas, Lent" }), { class: "flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.datalist, __VLS_intrinsicElements.datalist)({
        id: "ss-existing-user-tags",
    });
    for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.tagSuggestions)); _d < _e.length; _d++) {
        var t = _e[_d][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option)({
            key: (t),
            value: (t),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.addUserTags) }, { type: "button" }), { class: "px-3 py-2 rounded-md text-sm font-medium text-pink-300 bg-pink-900/30 border border-pink-800 hover:bg-pink-900/50 transition-colors" }));
    if (__VLS_ctx.form.arrangements.length > 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600 font-normal" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ value: (__VLS_ctx.form.primaryArrangementId) }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
        for (var _f = 0, _g = __VLS_getVForSourceType((__VLS_ctx.form.arrangements)); _f < _g.length; _f++) {
            var arr = _g[_f][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (arr.id),
                value: (arr.id),
            });
            (arr.name);
            (arr.key ? " \u2014 ".concat(arr.key) : '');
        }
    }
    if (!__VLS_ctx.isCreateMode) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "pt-2 border-t border-gray-800" }));
        if (!__VLS_ctx.showDeleteConfirm) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(!__VLS_ctx.isCreateMode))
                        return;
                    if (!(!__VLS_ctx.showDeleteConfirm))
                        return;
                    __VLS_ctx.showDeleteConfirm = true;
                } }, { type: "button" }), { class: "text-sm text-red-400 hover:text-red-300 transition-colors" }));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-red-900/20 border border-red-800 p-4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200 mb-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)(__assign({ class: "text-white" }));
            (__VLS_ctx.form.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex gap-2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(!__VLS_ctx.isCreateMode))
                        return;
                    if (!!(!__VLS_ctx.showDeleteConfirm))
                        return;
                    __VLS_ctx.showDeleteConfirm = false;
                } }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onDelete) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors" }), { disabled: (__VLS_ctx.isDeleting) }));
            (__VLS_ctx.isDeleting ? 'Deleting...' : 'Delete');
        }
    }
}
var __VLS_11;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-y-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[480px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-none']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-pink-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-pink-300']} */ ;
/** @type {__VLS_StyleScopedClasses['border-pink-800']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-pink-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-pink-200']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-pink-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-pink-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-pink-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-pink-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-pink-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-pink-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            authStore: authStore,
            form: form,
            themesInput: themesInput,
            userTagInput: userTagInput,
            titleError: titleError,
            showDeleteConfirm: showDeleteConfirm,
            isSaving: isSaving,
            isDeleting: isDeleting,
            unsavedGuard: unsavedGuard,
            isCreateMode: isCreateMode,
            tagSuggestions: tagSuggestions,
            vwTypeLabels: vwTypeLabels,
            vwTypeClasses: vwTypeClasses,
            toggleVwType: toggleVwType,
            addUserTags: addUserTags,
            removeUserTag: removeUserTag,
            onSave: onSave,
            onCancel: onCancel,
            onDelete: onDelete,
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
