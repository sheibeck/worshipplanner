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
var quarters_1 = require("@/stores/quarters");
var roster_1 = require("@/stores/roster");
var useUnsavedGuard_1 = require("@/composables/useUnsavedGuard");
var props = defineProps();
var emit = defineEmits();
var quartersStore = (0, quarters_1.useQuartersStore)();
var rosterStore = (0, roster_1.useRosterStore)();
var FREQ_PRESETS = [
    { key: 'weekly', label: 'Every week', n: 1, tier: 'regular' },
    { key: 'biweek', label: 'Twice a month', n: 2, tier: 'regular' },
    { key: 'monthly', label: 'Monthly', n: 4, tier: 'regular' },
    { key: 'fillin', label: 'As-needed (fill-in)', n: 0, tier: 'fillin' },
    { key: 'out', label: 'Out this quarter', n: 0, tier: 'out' },
];
// Static class maps (never dynamically constructed — Tailwind v4 purge safety).
var PRESET_ON_CLASS = {
    weekly: 'bg-indigo-600 border-indigo-600 text-white',
    biweek: 'bg-indigo-600 border-indigo-600 text-white',
    monthly: 'bg-indigo-600 border-indigo-600 text-white',
    fillin: 'bg-amber-500 border-amber-500 text-gray-950',
    out: 'bg-red-600 border-red-600 text-white',
};
var PRESET_OFF_CLASS = 'bg-gray-800 border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600';
// ── Draft state — loaded from standing (rosterStore.people) + quarter-scoped
// (quartersStore.getQuarter(...).personQuarterData), reset whenever personId changes ──
var draft = (0, vue_1.reactive)({
    name: '',
    email: '',
    blackoutDates: [],
    pairedWith: [],
    // Quarter-scoped, per-role serve frequency (D-04/D-05) — single source of
    // truth, one entry per currently-held role. Replaces the old standing
    // per-person cadence field plus the old quarter-scoped tier-only split.
    roleFrequency: {},
    note: '',
    // Standing roles (D-09) — editable from this drawer too, written through the
    // roster store the moment a checkbox is toggled (not deferred to Save).
    roles: [],
});
var quarter = (0, vue_1.computed)(function () {
    if (!props.quarterId)
        return null;
    try {
        return quartersStore.getQuarter(props.quarterId);
    }
    catch (_a) {
        return null;
    }
});
var serviceDates = (0, vue_1.computed)(function () { var _a, _b; return (_b = (_a = quarter.value) === null || _a === void 0 ? void 0 : _a.serviceDates) !== null && _b !== void 0 ? _b : []; });
// Held roles (D-06) — driven by draft.roles (not the live roster snapshot) so a
// role just toggled on/off in this drawer's checklist (D-09) immediately shows
// or hides its per-role frequency control, without waiting on a Firestore
// round-trip.
var heldRoles = (0, vue_1.computed)(function () {
    return draft.roles
        .map(function (id) { return rosterStore.roles.find(function (r) { return r.id === id; }); })
        .filter(function (r) { return r !== undefined; });
});
// Declared ahead of loadDraft/the immediate watcher below (which runs synchronously
// during setup) so they're initialized before first use — refs declared later in this
// file would still be in the temporal dead zone when the immediate watcher fires.
var pairQuery = (0, vue_1.ref)('');
var pairMenuOpen = (0, vue_1.ref)(false);
// ── Unsaved-changes guard ──────────────────────────────────────────────────
// Only the deferred (Save-button) edits count as "unsaved" — blackout dates,
// pairings, note, and per-role frequency. draft.roles is excluded: the Roles
// checklist writes through rosterStore.updatePerson immediately on toggle
// (see onToggleRole below), so it's never part of a pending/discardable edit.
var unsavedGuard = (0, useUnsavedGuard_1.useUnsavedGuard)(function () { return ({
    blackoutDates: draft.blackoutDates,
    pairedWith: draft.pairedWith,
    roleFrequency: draft.roleFrequency,
    note: draft.note,
}); });
function loadDraft(personId) {
    var _a, _b, _c, _d, _e, _f;
    var person = rosterStore.people.find(function (p) { return p.id === personId; });
    var pqd = (_a = quarter.value) === null || _a === void 0 ? void 0 : _a.personQuarterData[personId];
    draft.name = (_b = person === null || person === void 0 ? void 0 : person.name) !== null && _b !== void 0 ? _b : '';
    draft.email = (_c = person === null || person === void 0 ? void 0 : person.email) !== null && _c !== void 0 ? _c : '';
    draft.blackoutDates = (pqd === null || pqd === void 0 ? void 0 : pqd.blackoutDates) ? __spreadArray([], pqd.blackoutDates, true) : [];
    draft.pairedWith = (pqd === null || pqd === void 0 ? void 0 : pqd.pairedWith) ? __spreadArray([], pqd.pairedWith, true) : [];
    draft.note = (_d = pqd === null || pqd === void 0 ? void 0 : pqd.note) !== null && _d !== void 0 ? _d : '';
    draft.roles = person ? __spreadArray([], person.roles, true) : [];
    // Quarter-scoped, per-role frequency (D-04/D-05) — one entry per currently
    // held role, defaulting to { tier: 'regular', n: 4 } when absent.
    draft.roleFrequency = {};
    for (var _i = 0, _g = draft.roles; _i < _g.length; _i++) {
        var roleId = _g[_i];
        draft.roleFrequency[roleId] = (_f = (_e = pqd === null || pqd === void 0 ? void 0 : pqd.roleFrequency) === null || _e === void 0 ? void 0 : _e[roleId]) !== null && _f !== void 0 ? _f : { tier: 'regular', n: 4 };
    }
    pairQuery.value = '';
    pairMenuOpen.value = false;
    unsavedGuard.capture();
}
(0, vue_1.watch)(function () { return props.personId; }, function (id) {
    if (id)
        loadDraft(id);
}, { immediate: true });
// ── Roles checklist (D-09) — STANDING data, written through the roster store
// the instant a checkbox is toggled (same rosterStore.updatePerson path
// RosterView.vue's Edit Volunteer form uses), never deferred to the drawer's
// own Save button and never routed through quartersStore (D-08 — disjoint
// schemas: Person.roles vs PersonQuarterData.roleFrequency).
function onToggleRole(roleId) {
    var i = draft.roles.indexOf(roleId);
    if (i >= 0) {
        draft.roles.splice(i, 1);
    }
    else {
        draft.roles.push(roleId);
    }
    if (props.personId) {
        void rosterStore.updatePerson(props.personId, { roles: __spreadArray([], draft.roles, true) });
    }
}
// ── Serve frequency (per-role quarter tier + cadence, D-05/D-06) ───────────
// draft.roleFrequency[roleId] carries both the tier AND the cadence n in one
// write (D-05) — no separate standing frequency field remains. The 'regular'
// tier's active preset is derived from n (weekly n=1, biweek n=2, monthly n=4).
// WR-04: a non-preset n (e.g. "3" or "1-in-6" imported via CSV — both valid,
// supported frequencyLabelToN inputs) must NOT be shown as an active preset —
// 'monthly' previously matched by fallback, misrepresenting the real cadence
// and turning a click on "Monthly" into a silent, no-op-looking overwrite.
// 'custom' is a display-only state: it never matches any rendered preset's
// key, so no preset button is ever wrongly highlighted as active for it.
function activeRoleTierPresetKey(roleId) {
    var _a, _b;
    var entry = (_a = draft.roleFrequency[roleId]) !== null && _a !== void 0 ? _a : { tier: 'regular', n: 4 };
    if (entry.tier === 'fillin')
        return 'fillin';
    if (entry.tier === 'out')
        return 'out';
    var preset = FREQ_PRESETS.find(function (p) { return p.tier === 'regular' && p.n === entry.n; });
    return (_b = preset === null || preset === void 0 ? void 0 : preset.key) !== null && _b !== void 0 ? _b : 'custom';
}
function presetButtonClassFor(roleId, key) {
    return activeRoleTierPresetKey(roleId) === key ? PRESET_ON_CLASS[key] : PRESET_OFF_CLASS;
}
function selectRoleTierPreset(roleId, key) {
    var preset = FREQ_PRESETS.find(function (p) { return p.key === key; });
    draft.roleFrequency[roleId] = { tier: preset.tier, n: preset.n };
}
function roleFreqReadout(roleId) {
    var _a;
    var entry = (_a = draft.roleFrequency[roleId]) !== null && _a !== void 0 ? _a : { tier: 'regular', n: 4 };
    if (entry.tier === 'out') {
        return 'Excluded from every proposal this quarter.';
    }
    var servable = serviceDates.value.length - draft.blackoutDates.length;
    if (entry.tier === 'fillin') {
        return "Only scheduled to fill gaps \u00B7 available on ".concat(servable, " of ").concat(serviceDates.value.length, " Sundays");
    }
    var approx = Math.min(servable, Math.ceil(serviceDates.value.length / entry.n));
    // WR-04: no preset button is shown active for a non-canonical n, so make the custom
    // cadence explicit in the readout text too, rather than relying on the reader to notice
    // the number doesn't match any highlighted preset.
    var customPrefix = activeRoleTierPresetKey(roleId) === 'custom' ? "Custom (1-in-".concat(entry.n, ") \u00B7 ") : '';
    return "".concat(customPrefix, "\u2248 ").concat(approx, " of ").concat(serviceDates.value.length, " Sundays");
}
// ── Sundays-only calendar (never a generic date-picker — iterates serviceDates directly) ──
function isBlackedOut(date) {
    return draft.blackoutDates.includes(date);
}
function toggleDate(date) {
    var i = draft.blackoutDates.indexOf(date);
    if (i >= 0) {
        draft.blackoutDates.splice(i, 1);
    }
    else {
        draft.blackoutDates.push(date);
    }
}
function ordinalOf(date) {
    var day = Number(date.split('-')[2]);
    return Math.floor((day - 1) / 7) + 1;
}
function ordinalLabel(n) {
    var suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return "".concat(n).concat(suffix);
}
function ordinalDowLabel(date) {
    return "".concat(ordinalLabel(ordinalOf(date)), " Sun");
}
function dayOfMonth(date) {
    return Number(date.split('-')[2]);
}
function monthLabel(date) {
    var d = new Date("".concat(date, "T00:00:00"));
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function showsMonthLabel(date) {
    var idx = serviceDates.value.indexOf(date);
    if (idx <= 0)
        return true;
    var prev = serviceDates.value[idx - 1];
    return monthLabel(prev) !== monthLabel(date);
}
function ordFullySelected(n) {
    var inMonth = serviceDates.value.filter(function (d) { return ordinalOf(d) === n; });
    return inMonth.length > 0 && inMonth.every(function (d) { return draft.blackoutDates.includes(d); });
}
function toggleNth(n) {
    var inMonth = serviceDates.value.filter(function (d) { return ordinalOf(d) === n; });
    var allSelected = inMonth.length > 0 && inMonth.every(function (d) { return draft.blackoutDates.includes(d); });
    if (allSelected) {
        draft.blackoutDates = draft.blackoutDates.filter(function (d) { return !inMonth.includes(d); });
    }
    else {
        for (var _i = 0, inMonth_1 = inMonth; _i < inMonth_1.length; _i++) {
            var d = inMonth_1[_i];
            if (!draft.blackoutDates.includes(d))
                draft.blackoutDates.push(d);
        }
    }
}
function clearAllBlackouts() {
    draft.blackoutDates = [];
}
// ── Must-serve-with typeahead ────────────────────────────────────────────────
var pairCandidates = (0, vue_1.computed)(function () {
    var q = pairQuery.value.trim().toLowerCase();
    // Only active volunteers are offerable as a new pairing — an inactive person
    // is excluded from schedule proposals, so pairing to one would be a dead link.
    // (Existing pairing chips still resolve their name from the full people list.)
    return rosterStore.activePeople
        .filter(function (p) { return p.id !== props.personId && !draft.pairedWith.includes(p.id); })
        .filter(function (p) { return q === '' || p.name.toLowerCase().includes(q); })
        .slice(0, 6);
});
function addPair(id) {
    if (!draft.pairedWith.includes(id))
        draft.pairedWith.push(id);
    pairQuery.value = '';
    pairMenuOpen.value = false;
}
function removePair(id) {
    draft.pairedWith = draft.pairedWith.filter(function (x) { return x !== id; });
}
function onPairBlur() {
    window.setTimeout(function () {
        pairMenuOpen.value = false;
    }, 150);
}
function pairedPersonName(id) {
    var _a, _b;
    return (_b = (_a = rosterStore.people.find(function (p) { return p.id === id; })) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : id;
}
// ── Save / close ─────────────────────────────────────────────────────────────
function onSave() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!props.quarterId || !props.personId)
                        return [2 /*return*/];
                    // Quarter-scoped fields go through quartersStore.setPersonAvailability ONLY —
                    // roleFrequency is now the single source of truth for serve cadence (D-05),
                    // no standing frequency write remains (frequency is fully quarter-scoped).
                    return [4 /*yield*/, quartersStore.setPersonAvailability(props.quarterId, props.personId, {
                            blackoutDates: draft.blackoutDates,
                            pairedWith: draft.pairedWith,
                            roleFrequency: draft.roleFrequency,
                            note: draft.note,
                        })];
                case 1:
                    // Quarter-scoped fields go through quartersStore.setPersonAvailability ONLY —
                    // roleFrequency is now the single source of truth for serve cadence (D-05),
                    // no standing frequency write remains (frequency is fully quarter-scoped).
                    _a.sent();
                    emit('close');
                    return [2 /*return*/];
            }
        });
    });
}
function onClose() {
    if (!unsavedGuard.confirmDiscard())
        return;
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
if (__VLS_ctx.personId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onClose) }, { class: "fixed inset-0 z-40 bg-black/60" }));
}
var __VLS_7;
var __VLS_8 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    enterActiveClass: "transition-transform duration-200 ease-out",
    enterFromClass: "translate-x-full",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition-transform duration-150 ease-in",
    leaveFromClass: "translate-x-0",
    leaveToClass: "translate-x-full",
}));
var __VLS_10 = __VLS_9.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-transform duration-200 ease-out",
        enterFromClass: "translate-x-full",
        enterToClass: "translate-x-0",
        leaveActiveClass: "transition-transform duration-150 ease-in",
        leaveFromClass: "translate-x-0",
        leaveToClass: "translate-x-full",
    }], __VLS_functionalComponentArgsRest(__VLS_9), false));
__VLS_11.slots.default;
if (__VLS_ctx.personId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-w-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100 truncate" }));
    (__VLS_ctx.draft.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mt-0.5 truncate" }));
    (__VLS_ctx.draft.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onClose) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign(__assign({ onClick: (__VLS_ctx.onSave) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors" }), { class: (__VLS_ctx.unsavedGuard.isDirty.value
            ? 'bg-indigo-600 hover:bg-indigo-500'
            : 'bg-indigo-600/40 cursor-default text-white/50') }), { disabled: (!__VLS_ctx.unsavedGuard.isDirty.value) }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onClose) }, { type: "button" }), { class: "p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" }), { 'aria-label': "Close" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 overflow-y-auto px-6 py-5 space-y-6" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-xs font-bold uppercase tracking-wide text-gray-500 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-normal normal-case text-gray-600" }));
    var _loop_1 = function (role) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (role.id) }, { class: "mb-3 last:mb-0" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-300 mb-1.5" }));
        (role.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-2" }));
        var _loop_7 = function (preset) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.personId))
                        return;
                    __VLS_ctx.selectRoleTierPreset(role.id, preset.key);
                } }, { key: (preset.key), type: "button", 'data-role': "freq-preset", 'data-role-id': (role.id), 'data-preset': (preset.key), 'data-active': (__VLS_ctx.activeRoleTierPresetKey(role.id) === preset.key) }), { class: "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors" }), { class: (__VLS_ctx.presetButtonClassFor(role.id, preset.key)) }));
            (preset.label);
        };
        for (var _m = 0, _o = __VLS_getVForSourceType((__VLS_ctx.FREQ_PRESETS)); _m < _o.length; _m++) {
            var preset = _o[_m][0];
            _loop_7(preset);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mt-1.5" }));
        (__VLS_ctx.roleFreqReadout(role.id));
    };
    for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.heldRoles)); _i < _a.length; _i++) {
        var role = _a[_i][0];
        _loop_1(role);
    }
    if (__VLS_ctx.heldRoles.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-600 mb-2" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "border-t border-gray-800 pt-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-xs font-bold uppercase tracking-wide text-gray-500 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-normal normal-case text-gray-600" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-2 mb-3" }));
    var _loop_2 = function (n) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.personId))
                    return;
                __VLS_ctx.toggleNth(n);
            } }, { key: (n), type: "button" }), { class: "text-xs px-3 py-1 rounded-full border transition-colors" }), { class: (__VLS_ctx.ordFullySelected(n)
                ? 'bg-amber-500 border-amber-500 text-gray-950'
                : 'border-dashed border-gray-700 text-gray-400 hover:text-amber-300 hover:border-amber-700') }));
        (__VLS_ctx.ordinalLabel(n));
    };
    for (var _b = 0, _c = __VLS_getVForSourceType(([1, 2, 3, 4, 5])); _b < _c.length; _b++) {
        var n = _c[_b][0];
        _loop_2(n);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-3 text-xs text-gray-400 flex-wrap" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.clearAllBlackouts) }, { type: "button" }), { class: "px-2 py-1 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-4 gap-2" }));
    var _loop_3 = function (date) {
        (date);
        if (__VLS_ctx.showsMonthLabel(date)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "col-span-4 text-xs font-bold uppercase tracking-wide text-gray-600 mt-2 mb-0.5" }));
            (__VLS_ctx.monthLabel(date));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.personId))
                    return;
                __VLS_ctx.toggleDate(date);
            } }, { type: "button", 'data-role': "sunday-cell", 'data-date': (date) }), { class: "rounded-md border px-2 py-2 text-xs font-semibold text-center transition-transform active:scale-95" }), { class: (__VLS_ctx.isBlackedOut(date)
                ? 'bg-red-900/30 border-red-700/60 text-red-300 line-through'
                : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600') }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "block text-[10px] font-normal text-gray-500" }));
        (__VLS_ctx.ordinalDowLabel(date));
        (__VLS_ctx.dayOfMonth(date));
    };
    for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.serviceDates)); _d < _e.length; _d++) {
        var date = _e[_d][0];
        _loop_3(date);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mt-2.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)(__assign({ class: "text-gray-200" }));
    (__VLS_ctx.draft.blackoutDates.length);
    (__VLS_ctx.draft.blackoutDates.length === 1 ? '' : 's');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)(__assign({ class: "text-green-400" }));
    (__VLS_ctx.serviceDates.length - __VLS_ctx.draft.blackoutDates.length);
    (__VLS_ctx.serviceDates.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "border-t border-gray-800 pt-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-xs font-bold uppercase tracking-wide text-gray-500 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-normal normal-case text-gray-600" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign({ onFocus: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.personId))
                return;
            __VLS_ctx.pairMenuOpen = true;
        } }, { onBlur: (__VLS_ctx.onPairBlur) }), { value: (__VLS_ctx.pairQuery), type: "text", placeholder: "Type a name&hellip;" }), { class: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200" }));
    if (__VLS_ctx.pairMenuOpen && __VLS_ctx.pairCandidates.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 max-h-48 overflow-auto" }));
        var _loop_4 = function (candidate) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign({ onMousedown: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.personId))
                        return;
                    if (!(__VLS_ctx.pairMenuOpen && __VLS_ctx.pairCandidates.length > 0))
                        return;
                    __VLS_ctx.addPair(candidate.id);
                } }, { key: (candidate.id) }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white cursor-pointer" }));
            (candidate.name);
        };
        for (var _f = 0, _g = __VLS_getVForSourceType((__VLS_ctx.pairCandidates)); _f < _g.length; _f++) {
            var candidate = _g[_f][0];
            _loop_4(candidate);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-2 mt-2.5" }));
    var _loop_5 = function (id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ key: (id) }, { class: "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-purple-900/40 border border-purple-700/50 text-purple-200" }));
        (__VLS_ctx.pairedPersonName(id));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.personId))
                    return;
                __VLS_ctx.removePair(id);
            } }, { type: "button" }), { class: "text-purple-300 hover:text-white" }), { 'aria-label': "Remove pairing" }));
    };
    for (var _h = 0, _j = __VLS_getVForSourceType((__VLS_ctx.draft.pairedWith)); _h < _j.length; _h++) {
        var id = _j[_h][0];
        _loop_5(id);
    }
    if (__VLS_ctx.draft.pairedWith.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-600" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "border-t border-gray-800 pt-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-xs font-bold uppercase tracking-wide text-gray-500 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-normal normal-case text-gray-600" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)(__assign(__assign({ value: (__VLS_ctx.draft.note), rows: "3" }, { class: "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 resize-y" }), { placeholder: "e.g. try again in the Fall" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "border-t border-gray-800 pt-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-xs font-bold uppercase tracking-wide text-gray-500 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-normal normal-case text-gray-600" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-x-4 gap-y-2" }));
    var _loop_6 = function (role) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ key: (role.id) }, { class: "inline-flex items-center gap-1.5 text-sm text-gray-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.personId))
                    return;
                __VLS_ctx.onToggleRole(role.id);
            } }, { type: "checkbox", 'data-role': "role-checkbox", 'data-role-id': (role.id), checked: (__VLS_ctx.draft.roles.includes(role.id)) }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }));
        (role.name);
    };
    for (var _k = 0, _l = __VLS_getVForSourceType((__VLS_ctx.rosterStore.roles)); _k < _l.length; _k++) {
        var role = _l[_k][0];
        _loop_6(role);
    }
    if (__VLS_ctx.rosterStore.roles.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-600" }));
    }
}
var __VLS_11;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['last:mb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['top-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-purple-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-y']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            rosterStore: rosterStore,
            FREQ_PRESETS: FREQ_PRESETS,
            draft: draft,
            serviceDates: serviceDates,
            heldRoles: heldRoles,
            pairQuery: pairQuery,
            pairMenuOpen: pairMenuOpen,
            unsavedGuard: unsavedGuard,
            onToggleRole: onToggleRole,
            activeRoleTierPresetKey: activeRoleTierPresetKey,
            presetButtonClassFor: presetButtonClassFor,
            selectRoleTierPreset: selectRoleTierPreset,
            roleFreqReadout: roleFreqReadout,
            isBlackedOut: isBlackedOut,
            toggleDate: toggleDate,
            ordinalLabel: ordinalLabel,
            ordinalDowLabel: ordinalDowLabel,
            dayOfMonth: dayOfMonth,
            monthLabel: monthLabel,
            showsMonthLabel: showsMonthLabel,
            ordFullySelected: ordFullySelected,
            toggleNth: toggleNth,
            clearAllBlackouts: clearAllBlackouts,
            pairCandidates: pairCandidates,
            addPair: addPair,
            removePair: removePair,
            onPairBlur: onPairBlur,
            pairedPersonName: pairedPersonName,
            onSave: onSave,
            onClose: onClose,
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
