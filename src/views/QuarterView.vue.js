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
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var auth_1 = require("@/stores/auth");
var quarters_1 = require("@/stores/quarters");
var roster_1 = require("@/stores/roster");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var VolunteerCsvImportModal_vue_1 = require("@/components/VolunteerCsvImportModal.vue");
var QuarterGrid_vue_1 = require("@/components/QuarterGrid.vue");
var RosterPrintLayout_vue_1 = require("@/components/RosterPrintLayout.vue");
var AvailabilityDrawer_vue_1 = require("@/components/AvailabilityDrawer.vue");
var AvailabilityRosterTable_vue_1 = require("@/components/AvailabilityRosterTable.vue");
var authStore = (0, auth_1.useAuthStore)();
var quartersStore = (0, quarters_1.useQuartersStore)();
var rosterStore = (0, roster_1.useRosterStore)();
// ── Quarter selection ────────────────────────────────────────────────────────
var selectedQuarterId = (0, vue_1.ref)(null);
// ── Availability drawer (D-02) — controlled by which person's drawer is open ──
var openPersonId = (0, vue_1.ref)(null);
// ── Tabbed layout ────────────────────────────────────────────────────────────
// Default to the schedule so it's reachable without scrolling past volunteer/date
// setup. Generating/regenerating/filling jumps back to schedule; adding a new
// quarter jumps to volunteers (set up availability first). Service dates is last.
var activeTab = (0, vue_1.ref)('schedule');
var selectedQuarter = (0, vue_1.computed)(function () {
    var _a;
    if (!selectedQuarterId.value)
        return null;
    return (_a = quartersStore.quarters.find(function (q) { return q.id === selectedQuarterId.value; })) !== null && _a !== void 0 ? _a : null;
});
// Header subline: "Q4 2026 · Oct 4 – Dec 27, 2026" using the quarter's first and
// last service dates. Falls back to just the label when no service dates exist.
var quarterSubheader = (0, vue_1.computed)(function () {
    var _a;
    if (quartersStore.isLoading)
        return 'Loading...';
    var q = selectedQuarter.value;
    if (!q)
        return 'No quarter selected';
    var dates = (_a = q.serviceDates) !== null && _a !== void 0 ? _a : [];
    if (dates.length === 0)
        return q.label;
    var sorted = __spreadArray([], dates, true).sort();
    var first = new Date("".concat(sorted[0], "T00:00:00"));
    var last = new Date("".concat(sorted[sorted.length - 1], "T00:00:00"));
    var firstStr = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    var lastStr = last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    var range = sorted.length === 1 ? lastStr : "".concat(firstStr, " \u2013 ").concat(lastStr);
    return "".concat(q.label, " \u00B7 ").concat(range);
});
// ── Quarter picker window ────────────────────────────────────────────────────
// With many quarters accumulated, the switcher only needs the previous quarter,
// the current quarter, and any future quarters — not the full backlog of past
// ones. Threshold is (current quarter − 1) by chronological key (year*4+quarter,
// consecutive quarters differ by exactly 1). The currently-selected quarter is
// always kept in the list so the switcher never renders blank.
function currentQuarterKey() {
    var now = new Date();
    return now.getFullYear() * 4 + (Math.floor(now.getMonth() / 3) + 1);
}
var pickerQuarters = (0, vue_1.computed)(function () {
    var minKey = currentQuarterKey() - 1;
    return quartersStore.quarters.filter(function (q) { return q.year * 4 + q.quarter >= minKey || q.id === selectedQuarterId.value; });
});
// Auto-select once loaded (only if nothing selected yet). Prefer the most
// recently created quarter within the picker window; fall back to the most
// recently created overall if every quarter is older than the window.
(0, vue_1.watch)(function () { return quartersStore.quarters; }, function (quarters) {
    if (!selectedQuarterId.value && quarters.length > 0) {
        var minKey_1 = currentQuarterKey() - 1;
        var inWindow = quarters.find(function (q) { return q.year * 4 + q.quarter >= minKey_1; });
        selectedQuarterId.value = (inWindow !== null && inWindow !== void 0 ? inWindow : quarters[0]).id;
    }
});
// ── Delete quarter (danger zone next to the switcher) ────────────────────────
var deleteConfirmOpen = (0, vue_1.ref)(false);
var deleteConfirmText = (0, vue_1.ref)('');
var deletingQuarter = (0, vue_1.ref)(false);
var deleteQuarterError = (0, vue_1.ref)('');
function cancelDeleteQuarter() {
    deleteConfirmOpen.value = false;
    deleteConfirmText.value = '';
    deleteQuarterError.value = '';
}
function onDeleteQuarter() {
    return __awaiter(this, void 0, void 0, function () {
        var deletedId, remaining, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedQuarter.value || deleteConfirmText.value !== 'DELETE')
                        return [2 /*return*/];
                    deletedId = selectedQuarter.value.id;
                    deletingQuarter.value = true;
                    deleteQuarterError.value = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, quartersStore.deleteQuarter(deletedId)
                        // Advance selection to the next remaining quarter (or clear). The snapshot
                        // listener may not have pruned the local list yet, so compute from the current
                        // list minus the just-deleted id; the shareUrl watch re-syncs off selectedQuarter.
                    ];
                case 2:
                    _a.sent();
                    remaining = quartersStore.quarters.filter(function (q) { return q.id !== deletedId; });
                    selectedQuarterId.value = remaining.length > 0 ? remaining[0].id : null;
                    deleteConfirmOpen.value = false;
                    deleteConfirmText.value = '';
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    deleteQuarterError.value = err_1 instanceof Error ? err_1.message : 'Failed to delete quarter.';
                    return [3 /*break*/, 5];
                case 4:
                    deletingQuarter.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── New quarter creation (Add-quarter modal, R-10/D-13) ─────────────────────
// The quarter chronologically after (year, quarter). Q4 rolls over to Q1 next year.
function quarterAfter(year, quarter) {
    if (quarter === 4)
        return { year: year + 1, quarter: 1 };
    return { year: year, quarter: (quarter + 1) };
}
// Fallback when no quarters exist yet: the quarter after the one we're currently
// in — we look forward, since you schedule the upcoming quarter, not the one
// already underway.
function nextQuarterFromToday() {
    var now = new Date();
    var currentQuarter = (Math.floor(now.getMonth() / 3) + 1);
    return quarterAfter(now.getFullYear(), currentQuarter);
}
// Default the modal to the quarter after the most recently scheduled quarter
// (the chronologically latest existing quarter). Falls back to the quarter after
// today when there are no quarters yet.
function defaultNextQuarter() {
    var quarters = quartersStore.quarters;
    if (quarters.length === 0)
        return nextQuarterFromToday();
    var latest = quarters.reduce(function (max, q) {
        return q.year * 4 + q.quarter > max.year * 4 + max.quarter ? q : max;
    });
    return quarterAfter(latest.year, latest.quarter);
}
var addQuarterOpen = (0, vue_1.ref)(false);
var newQuarterYear = (0, vue_1.ref)(defaultNextQuarter().year);
var newQuarterNum = (0, vue_1.ref)(defaultNextQuarter().quarter);
var newQuarterLabel = (0, vue_1.computed)(function () { return "Q".concat(newQuarterNum.value, " ").concat(newQuarterYear.value); });
function onOpenAddQuarter() {
    // Recompute on open so the default reflects the latest quarter, even after
    // adding one earlier in the same session.
    var _a = defaultNextQuarter(), year = _a.year, quarter = _a.quarter;
    newQuarterYear.value = year;
    newQuarterNum.value = quarter;
    addQuarterOpen.value = true;
}
function onCreateQuarter() {
    return __awaiter(this, void 0, void 0, function () {
        var id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, quartersStore.createQuarter(newQuarterYear.value, newQuarterNum.value, newQuarterLabel.value)];
                case 1:
                    id = _a.sent();
                    selectedQuarterId.value = id;
                    addQuarterOpen.value = false;
                    // A brand-new quarter needs volunteer availability set up first.
                    activeTab.value = 'volunteers';
                    return [2 /*return*/];
            }
        });
    });
}
function onCloseAddQuarter() {
    addQuarterOpen.value = false;
}
// ── Service dates ────────────────────────────────────────────────────────────
var newDateInput = (0, vue_1.ref)('');
function onAddDate() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!newDateInput.value || !selectedQuarter.value)
                        return [2 /*return*/];
                    return [4 /*yield*/, quartersStore.addServiceDate(selectedQuarter.value.id, newDateInput.value)];
                case 1:
                    _a.sent();
                    newDateInput.value = '';
                    return [2 /*return*/];
            }
        });
    });
}
function onRemoveDate(date) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedQuarter.value)
                        return [2 /*return*/];
                    return [4 /*yield*/, quartersStore.removeServiceDate(selectedQuarter.value.id, date)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function formatDateLabel(date) {
    var d = new Date("".concat(date, "T00:00:00"));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
// ── Per-date role overrides (inline, per service-date row) ───────────────────
// overrideDate is the date whose inline editor is currently expanded (null = none).
var overrideDate = (0, vue_1.ref)(null);
var overrideDraft = (0, vue_1.ref)({});
function openOverride(date) {
    overrideDate.value = date;
}
function closeOverride() {
    overrideDate.value = null;
}
function hasOverride(date) {
    var _a;
    var o = (_a = selectedQuarter.value) === null || _a === void 0 ? void 0 : _a.roleOverridesByDate[date];
    return !!o && o.length > 0;
}
(0, vue_1.watch)(overrideDate, function (date) {
    if (!date || !selectedQuarter.value) {
        overrideDraft.value = {};
        return;
    }
    var existing = selectedQuarter.value.roleOverridesByDate[date];
    var draft = {};
    var _loop_2 = function (role) {
        var match = existing === null || existing === void 0 ? void 0 : existing.find(function (r) { return r.roleId === role.id; });
        draft[role.id] = match ? match.count : role.defaultCount;
    };
    for (var _i = 0, _a = rosterStore.roles; _i < _a.length; _i++) {
        var role = _a[_i];
        _loop_2(role);
    }
    overrideDraft.value = draft;
});
function onSaveOverride() {
    return __awaiter(this, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!overrideDate.value || !selectedQuarter.value)
                        return [2 /*return*/];
                    config = rosterStore.roles.map(function (role) {
                        var _a;
                        return ({
                            roleId: role.id,
                            count: (_a = overrideDraft.value[role.id]) !== null && _a !== void 0 ? _a : role.defaultCount,
                        });
                    });
                    return [4 /*yield*/, quartersStore.setRoleOverrideForDate(selectedQuarter.value.id, overrideDate.value, config)];
                case 1:
                    _a.sent();
                    overrideDate.value = null;
                    return [2 /*return*/];
            }
        });
    });
}
// ── Generate / regenerate / fill gaps ───────────────────────────────────────
var proposeResult = (0, vue_1.ref)(null);
var showRegenerateConfirm = (0, vue_1.ref)(false);
// ── Last-regenerate change highlights ────────────────────────────────────────
var showChanges = (0, vue_1.ref)(true);
// Dates changed by the last generateProposal, scoped to the quarter in view so a
// stale set from another quarter never highlights this grid.
var changedDates = (0, vue_1.computed)(function () {
    var _a;
    var lr = quartersStore.lastRegenerate;
    if (!lr || lr.quarterId !== ((_a = selectedQuarter.value) === null || _a === void 0 ? void 0 : _a.id))
        return [];
    return lr.changedDates;
});
var hasAssignments = (0, vue_1.computed)(function () {
    if (!selectedQuarter.value)
        return false;
    return Object.values(selectedQuarter.value.calendar).some(function (roleMap) {
        return Object.values(roleMap).some(function (ids) { return ids.length > 0; });
    });
});
function onGenerateSchedule() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedQuarter.value)
                        return [2 /*return*/];
                    activeTab.value = 'schedule';
                    _a = proposeResult;
                    return [4 /*yield*/, quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')];
                case 1:
                    _a.value = _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function onFillGaps() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedQuarter.value)
                        return [2 /*return*/];
                    activeTab.value = 'schedule';
                    _a = proposeResult;
                    return [4 /*yield*/, quartersStore.generateProposal(selectedQuarter.value.id, 'fillGaps')];
                case 1:
                    _a.value = _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Opening the regenerate confirmation lives on the Schedule tab, so surface it.
function onRequestRegenerate() {
    activeTab.value = 'schedule';
    showRegenerateConfirm.value = true;
}
function onConfirmRegenerate() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedQuarter.value)
                        return [2 /*return*/];
                    activeTab.value = 'schedule';
                    _a = proposeResult;
                    return [4 /*yield*/, quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')];
                case 1:
                    _a.value = _b.sent();
                    showRegenerateConfirm.value = false;
                    return [2 /*return*/];
            }
        });
    });
}
// ── CSV import modal ─────────────────────────────────────────────────────────
var csvModalOpen = (0, vue_1.ref)(false);
function onCsvImported() {
    csvModalOpen.value = false;
}
// ── Finalize & Share (D-24) ─────────────────────────────────────────────────
var isFinalizing = (0, vue_1.ref)(false);
var shareUrl = (0, vue_1.ref)(null);
var shareCopied = (0, vue_1.ref)(false);
var shareError = (0, vue_1.ref)(null);
// Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that
// finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL
// only when the org has no configured slug yet.
function buildShareUrl(quarter, token) {
    var slug = authStore.orgSlug;
    if (slug) {
        return "".concat(window.location.origin, "/").concat(slug, "/quarter").concat(quarter.quarter, "-").concat(quarter.year);
    }
    return token ? "".concat(window.location.origin, "/quarter-share/").concat(token) : null;
}
// Reflect an already-finalized quarter's share link when switching quarters.
(0, vue_1.watch)(selectedQuarter, function (quarter) {
    shareUrl.value = (quarter === null || quarter === void 0 ? void 0 : quarter.shareToken) ? buildShareUrl(quarter, quarter.shareToken) : null;
    shareCopied.value = false;
    shareError.value = null;
}, { immediate: true });
function onFinalizeAndShare() {
    return __awaiter(this, void 0, void 0, function () {
        var token, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!selectedQuarter.value)
                        return [2 /*return*/];
                    isFinalizing.value = true;
                    shareError.value = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, quartersStore.finalizeAndShare(selectedQuarter.value.id)];
                case 2:
                    token = _a.sent();
                    shareUrl.value = buildShareUrl(selectedQuarter.value, token);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _a.sent();
                    console.error('Finalize & Share failed:', err_2);
                    shareError.value = 'Failed to finalize and share';
                    setTimeout(function () {
                        shareError.value = null;
                    }, 3000);
                    return [3 /*break*/, 5];
                case 4:
                    isFinalizing.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function onCopyShareUrl() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!shareUrl.value)
                        return [2 /*return*/];
                    if (!navigator.clipboard) return [3 /*break*/, 2];
                    return [4 /*yield*/, navigator.clipboard.writeText(shareUrl.value)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    shareCopied.value = true;
                    setTimeout(function () {
                        shareCopied.value = false;
                    }, 2000);
                    return [2 /*return*/];
            }
        });
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
function initStores() {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    quartersStore.subscribe(orgId);
    rosterStore.subscribe(orgId);
}
(0, vue_1.onMounted)(function () {
    initStores();
});
(0, vue_1.onUnmounted)(function () {
    quartersStore.unsubscribeAll();
    rosterStore.unsubscribeAll();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "print:hidden" }));
/** @type {[typeof AppShell, typeof AppShell, ]} */ ;
// @ts-ignore
var __VLS_0 = __VLS_asFunctionalComponent(AppShell_vue_1.default, new AppShell_vue_1.default({}));
var __VLS_1 = __VLS_0.apply(void 0, __spreadArray([{}], __VLS_functionalComponentArgsRest(__VLS_0), false));
__VLS_2.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-800" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-semibold text-gray-100" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
(__VLS_ctx.quarterSubheader);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start" }));
if (__VLS_ctx.quartersStore.quarters.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ for: "quarter-select" }, { class: "text-xs font-medium text-gray-400" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ id: "quarter-select", value: (__VLS_ctx.selectedQuarterId) }, { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    for (var _i = 0, _e = __VLS_getVForSourceType((__VLS_ctx.pickerQuarters)); _i < _e.length; _i++) {
        var q = _e[_i][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (q.id),
            value: (q.id),
        });
        (q.label);
    }
}
if (__VLS_ctx.selectedQuarter && !__VLS_ctx.hasAssignments) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onGenerateSchedule) }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
}
if (__VLS_ctx.selectedQuarter && __VLS_ctx.hasAssignments) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onFillGaps) }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
}
if (__VLS_ctx.selectedQuarter && __VLS_ctx.hasAssignments) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onRequestRegenerate) }, { class: "inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors" }));
}
if (__VLS_ctx.selectedQuarter && __VLS_ctx.hasAssignments) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onFinalizeAndShare) }, { disabled: (__VLS_ctx.isFinalizing) }), { class: "inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    });
    (__VLS_ctx.isFinalizing ? 'Finalizing...' : 'Finalize & Share');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onOpenAddQuarter) }, { type: "button" }), { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
if (__VLS_ctx.shareUrl) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-indigo-800 bg-indigo-950/40 p-4 mb-6 flex items-center gap-3 flex-wrap" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300 flex-1 min-w-0 truncate" }));
    (__VLS_ctx.shareUrl);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onCopyShareUrl) }, { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shrink-0" }));
    (__VLS_ctx.shareCopied ? 'Copied!' : 'Copy link');
}
if (__VLS_ctx.shareError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-red-400 mb-6" }));
    (__VLS_ctx.shareError);
}
if (__VLS_ctx.selectedQuarter) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1 mb-6 border-b border-gray-800 pb-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.selectedQuarter))
                return;
            __VLS_ctx.activeTab = 'schedule';
        } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'schedule'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.selectedQuarter))
                return;
            __VLS_ctx.activeTab = 'volunteers';
        } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'volunteers'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.selectedQuarter))
                return;
            __VLS_ctx.activeTab = 'serviceDates';
        } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'serviceDates'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, __assign(__assign({}, __VLS_directiveBindingRestFields), { value: (__VLS_ctx.activeTab === 'volunteers') }), null, null);
    /** @type {[typeof AvailabilityRosterTable, ]} */ ;
    // @ts-ignore
    var __VLS_3 = __VLS_asFunctionalComponent(AvailabilityRosterTable_vue_1.default, new AvailabilityRosterTable_vue_1.default(__assign({ 'onSelect': {} }, { quarter: (__VLS_ctx.selectedQuarter) })));
    var __VLS_4 = __VLS_3.apply(void 0, __spreadArray([__assign({ 'onSelect': {} }, { quarter: (__VLS_ctx.selectedQuarter) })], __VLS_functionalComponentArgsRest(__VLS_3), false));
    var __VLS_6 = void 0;
    var __VLS_7 = void 0;
    var __VLS_8 = void 0;
    var __VLS_9 = {
        onSelect: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.selectedQuarter))
                return;
            __VLS_ctx.openPersonId = $event;
        }
    };
    var __VLS_5;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, __assign(__assign({}, __VLS_directiveBindingRestFields), { value: (__VLS_ctx.activeTab === 'serviceDates') }), null, null);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "date" }, { class: "flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    (__VLS_ctx.newDateInput);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onAddDate) }, { class: "px-3 py-2 rounded-md text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)(__assign({ class: "divide-y divide-gray-800" }));
    var _loop_1 = function (date) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)(__assign({ class: "flex items-center justify-between py-2 text-sm text-gray-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-2" }));
        (__VLS_ctx.formatDateLabel(date));
        if (__VLS_ctx.hasOverride(date)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 border border-indigo-700/50 text-indigo-300" }));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.selectedQuarter))
                    return;
                __VLS_ctx.openOverride(date);
            } }, { class: "text-xs text-indigo-400 hover:text-indigo-300 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.selectedQuarter))
                    return;
                __VLS_ctx.onRemoveDate(date);
            } }, { 'aria-label': "Remove date" }), { class: "text-gray-500 hover:text-red-400 transition-colors px-1" }));
    };
    for (var _f = 0, _g = __VLS_getVForSourceType((__VLS_ctx.selectedQuarter.serviceDates)); _f < _g.length; _f++) {
        var date = _g[_f][0];
        _loop_1(date);
    }
    if (__VLS_ctx.selectedQuarter.serviceDates.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)(__assign({ class: "py-3 text-sm text-gray-600 text-center" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-10 border border-red-900/50 rounded-xl overflow-hidden" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-3 bg-red-950/30 border-b border-red-900/50" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-medium text-red-300" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-0.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-semibold text-gray-300" }));
    (__VLS_ctx.selectedQuarter.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-4" }));
    if (!__VLS_ctx.deleteConfirmOpen) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.selectedQuarter))
                    return;
                if (!(!__VLS_ctx.deleteConfirmOpen))
                    return;
                __VLS_ctx.deleteConfirmOpen = true;
            } }, { class: "text-xs px-3 py-1.5 rounded-md border border-red-700 text-red-300 hover:bg-red-900/30 transition-colors" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-mono font-semibold text-red-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-semibold text-gray-300" }));
        (__VLS_ctx.selectedQuarter.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 flex-wrap" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ placeholder: "DELETE" }, { class: "rounded-md bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-600" }));
        (__VLS_ctx.deleteConfirmText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onDeleteQuarter) }, { disabled: (__VLS_ctx.deleteConfirmText !== 'DELETE' || __VLS_ctx.deletingQuarter) }), { class: "text-xs px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" }));
        (__VLS_ctx.deletingQuarter ? 'Deleting…' : 'Delete quarter');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.cancelDeleteQuarter) }, { disabled: (__VLS_ctx.deletingQuarter) }), { class: "text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors" }));
        if (__VLS_ctx.deleteQuarterError) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-red-400" }));
            (__VLS_ctx.deleteQuarterError);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, __assign(__assign({}, __VLS_directiveBindingRestFields), { value: (__VLS_ctx.activeTab === 'schedule') }), null, null);
    if (__VLS_ctx.showRegenerateConfirm) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6 rounded-md bg-red-900/20 border border-red-800 p-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-red-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3 mt-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onConfirmRegenerate) }, { class: "px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.selectedQuarter))
                    return;
                if (!(__VLS_ctx.showRegenerateConfirm))
                    return;
                __VLS_ctx.showRegenerateConfirm = false;
            } }, { class: "px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
    }
    if (__VLS_ctx.proposeResult) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6 rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 flex items-center gap-6 flex-wrap" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xl font-semibold text-gray-100" }));
        (__VLS_ctx.proposeResult.unfilled.length);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xl font-semibold text-gray-100" }));
        (__VLS_ctx.proposeResult.pairingConflicts.length);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
        if (__VLS_ctx.changedDates.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "sm:ml-auto inline-flex items-center gap-2 text-sm text-gray-300 select-none cursor-pointer" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "checkbox" }, { class: "rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }));
            (__VLS_ctx.showChanges);
            (__VLS_ctx.changedDates.length);
        }
    }
    if (!__VLS_ctx.hasAssignments) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg border border-gray-800" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-base font-medium text-gray-300 mb-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500 max-w-sm mb-6" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onGenerateSchedule) }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-gray-800 overflow-hidden" }));
        /** @type {[typeof QuarterGrid, ]} */ ;
        // @ts-ignore
        var __VLS_10 = __VLS_asFunctionalComponent(QuarterGrid_vue_1.default, new QuarterGrid_vue_1.default({
            quarter: (__VLS_ctx.selectedQuarter),
            roles: (__VLS_ctx.rosterStore.roles),
            lastProposeResult: (__VLS_ctx.proposeResult),
            changedDates: (__VLS_ctx.showChanges ? __VLS_ctx.changedDates : []),
        }));
        var __VLS_11 = __VLS_10.apply(void 0, __spreadArray([{
                quarter: (__VLS_ctx.selectedQuarter),
                roles: (__VLS_ctx.rosterStore.roles),
                lastProposeResult: (__VLS_ctx.proposeResult),
                changedDates: (__VLS_ctx.showChanges ? __VLS_ctx.changedDates : []),
            }], __VLS_functionalComponentArgsRest(__VLS_10), false));
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg border border-gray-800" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-base font-medium text-gray-300 mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500 max-w-sm" }));
}
/** @type {[typeof VolunteerCsvImportModal, ]} */ ;
// @ts-ignore
var __VLS_13 = __VLS_asFunctionalComponent(VolunteerCsvImportModal_vue_1.default, new VolunteerCsvImportModal_vue_1.default(__assign(__assign({ 'onClose': {} }, { 'onImported': {} }), { open: (__VLS_ctx.csvModalOpen), quarter: (__VLS_ctx.selectedQuarter) })));
var __VLS_14 = __VLS_13.apply(void 0, __spreadArray([__assign(__assign({ 'onClose': {} }, { 'onImported': {} }), { open: (__VLS_ctx.csvModalOpen), quarter: (__VLS_ctx.selectedQuarter) })], __VLS_functionalComponentArgsRest(__VLS_13), false));
var __VLS_16;
var __VLS_17;
var __VLS_18;
var __VLS_19 = {
    onClose: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.csvModalOpen = false;
    }
};
var __VLS_20 = {
    onImported: (__VLS_ctx.onCsvImported)
};
var __VLS_15;
/** @type {[typeof AvailabilityDrawer, ]} */ ;
// @ts-ignore
var __VLS_21 = __VLS_asFunctionalComponent(AvailabilityDrawer_vue_1.default, new AvailabilityDrawer_vue_1.default(__assign({ 'onClose': {} }, { quarterId: ((_b = (_a = __VLS_ctx.selectedQuarter) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null), personId: (__VLS_ctx.openPersonId) })));
var __VLS_22 = __VLS_21.apply(void 0, __spreadArray([__assign({ 'onClose': {} }, { quarterId: ((_d = (_c = __VLS_ctx.selectedQuarter) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null), personId: (__VLS_ctx.openPersonId) })], __VLS_functionalComponentArgsRest(__VLS_21), false));
var __VLS_24;
var __VLS_25;
var __VLS_26;
var __VLS_27 = {
    onClose: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.openPersonId = null;
    }
};
var __VLS_23;
var __VLS_28 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
var __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    to: "body",
}));
var __VLS_30 = __VLS_29.apply(void 0, __spreadArray([{
        to: "body",
    }], __VLS_functionalComponentArgsRest(__VLS_29), false));
__VLS_31.slots.default;
var __VLS_32 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    enterActiveClass: "transition-opacity duration-200 ease-out",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-150 ease-in",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}));
var __VLS_34 = __VLS_33.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-opacity duration-200 ease-out",
        enterFromClass: "opacity-0",
        enterToClass: "opacity-100",
        leaveActiveClass: "transition-opacity duration-150 ease-in",
        leaveFromClass: "opacity-100",
        leaveToClass: "opacity-0",
    }], __VLS_functionalComponentArgsRest(__VLS_33), false));
__VLS_35.slots.default;
if (__VLS_ctx.addQuarterOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onCloseAddQuarter) }, { class: "fixed inset-0 z-40 bg-black/60" }));
}
var __VLS_35;
var __VLS_36 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    enterActiveClass: "transition-all duration-200 ease-out",
    enterFromClass: "opacity-0 scale-95",
    enterToClass: "opacity-100 scale-100",
    leaveActiveClass: "transition-all duration-150 ease-in",
    leaveFromClass: "opacity-100 scale-100",
    leaveToClass: "opacity-0 scale-95",
}));
var __VLS_38 = __VLS_37.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-all duration-200 ease-out",
        enterFromClass: "opacity-0 scale-95",
        enterToClass: "opacity-100 scale-100",
        leaveActiveClass: "transition-all duration-150 ease-in",
        leaveFromClass: "opacity-100 scale-100",
        leaveToClass: "opacity-0 scale-95",
    }], __VLS_functionalComponentArgsRest(__VLS_37), false));
__VLS_39.slots.default;
if (__VLS_ctx.addQuarterOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.onCloseAddQuarter) }, { class: "fixed inset-0 z-50 flex items-center justify-center p-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full max-w-sm bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-4 space-y-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-end gap-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "number" }, { class: "w-24 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    (__VLS_ctx.newQuarterYear);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs font-medium text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ value: (__VLS_ctx.newQuarterNum) }, { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (1),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (2),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (3),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (4),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3 px-6 py-4 border-t border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onCreateQuarter) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onCloseAddQuarter) }, { type: "button" }), { class: "px-4 py-2 rounded-md text-sm text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors" }));
}
var __VLS_39;
var __VLS_31;
var __VLS_40 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
var __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    to: "body",
}));
var __VLS_42 = __VLS_41.apply(void 0, __spreadArray([{
        to: "body",
    }], __VLS_functionalComponentArgsRest(__VLS_41), false));
__VLS_43.slots.default;
var __VLS_44 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    enterActiveClass: "transition-opacity duration-200 ease-out",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-150 ease-in",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}));
var __VLS_46 = __VLS_45.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-opacity duration-200 ease-out",
        enterFromClass: "opacity-0",
        enterToClass: "opacity-100",
        leaveActiveClass: "transition-opacity duration-150 ease-in",
        leaveFromClass: "opacity-100",
        leaveToClass: "opacity-0",
    }], __VLS_functionalComponentArgsRest(__VLS_45), false));
__VLS_47.slots.default;
if (__VLS_ctx.overrideDate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.closeOverride) }, { class: "fixed inset-0 z-40 bg-black/60" }));
}
var __VLS_47;
var __VLS_48 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    enterActiveClass: "transition-transform duration-200 ease-out",
    enterFromClass: "translate-x-full",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition-transform duration-150 ease-in",
    leaveFromClass: "translate-x-0",
    leaveToClass: "translate-x-full",
}));
var __VLS_50 = __VLS_49.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-transform duration-200 ease-out",
        enterFromClass: "translate-x-full",
        enterToClass: "translate-x-0",
        leaveActiveClass: "transition-transform duration-150 ease-in",
        leaveFromClass: "translate-x-0",
        leaveToClass: "translate-x-full",
    }], __VLS_functionalComponentArgsRest(__VLS_49), false));
__VLS_51.slots.default;
if (__VLS_ctx.overrideDate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-w-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mt-0.5 truncate" }));
    (__VLS_ctx.overrideDate ? __VLS_ctx.formatDateLabel(__VLS_ctx.overrideDate) : '');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.closeOverride) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onSaveOverride) }, { type: "button", disabled: (__VLS_ctx.rosterStore.roles.length === 0) }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.closeOverride) }, { type: "button" }), { class: "p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" }), { 'aria-label': "Close" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 overflow-y-auto px-6 py-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mb-4" }));
    if (__VLS_ctx.rosterStore.roles.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-gray-600" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-2" }));
        for (var _h = 0, _j = __VLS_getVForSourceType((__VLS_ctx.rosterStore.rolesSorted)); _h < _j.length; _h++) {
            var role = _j[_h][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (role.id) }, { class: "flex items-center justify-between gap-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-300 truncate" }));
            (role.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "number", min: "0" }, { class: "w-20 shrink-0 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
            (__VLS_ctx.overrideDraft[role.id]);
        }
    }
}
var __VLS_51;
var __VLS_43;
var __VLS_2;
if (__VLS_ctx.selectedQuarter) {
    /** @type {[typeof RosterPrintLayout, ]} */ ;
    // @ts-ignore
    var __VLS_52 = __VLS_asFunctionalComponent(RosterPrintLayout_vue_1.default, new RosterPrintLayout_vue_1.default({
        quarter: (__VLS_ctx.selectedQuarter),
        roles: (__VLS_ctx.rosterStore.roles),
    }));
    var __VLS_53 = __VLS_52.apply(void 0, __spreadArray([{
            quarter: (__VLS_ctx.selectedQuarter),
            roles: (__VLS_ctx.rosterStore.roles),
        }], __VLS_functionalComponentArgsRest(__VLS_52), false));
}
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['[&>*]:w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:[&>*]:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['[&>*]:justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:[&>*]:justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
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
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-800']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-950/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-10']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-950/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
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
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
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
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
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
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
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
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            VolunteerCsvImportModal: VolunteerCsvImportModal_vue_1.default,
            QuarterGrid: QuarterGrid_vue_1.default,
            RosterPrintLayout: RosterPrintLayout_vue_1.default,
            AvailabilityDrawer: AvailabilityDrawer_vue_1.default,
            AvailabilityRosterTable: AvailabilityRosterTable_vue_1.default,
            quartersStore: quartersStore,
            rosterStore: rosterStore,
            selectedQuarterId: selectedQuarterId,
            openPersonId: openPersonId,
            activeTab: activeTab,
            selectedQuarter: selectedQuarter,
            quarterSubheader: quarterSubheader,
            pickerQuarters: pickerQuarters,
            deleteConfirmOpen: deleteConfirmOpen,
            deleteConfirmText: deleteConfirmText,
            deletingQuarter: deletingQuarter,
            deleteQuarterError: deleteQuarterError,
            cancelDeleteQuarter: cancelDeleteQuarter,
            onDeleteQuarter: onDeleteQuarter,
            addQuarterOpen: addQuarterOpen,
            newQuarterYear: newQuarterYear,
            newQuarterNum: newQuarterNum,
            onOpenAddQuarter: onOpenAddQuarter,
            onCreateQuarter: onCreateQuarter,
            onCloseAddQuarter: onCloseAddQuarter,
            newDateInput: newDateInput,
            onAddDate: onAddDate,
            onRemoveDate: onRemoveDate,
            formatDateLabel: formatDateLabel,
            overrideDate: overrideDate,
            overrideDraft: overrideDraft,
            openOverride: openOverride,
            closeOverride: closeOverride,
            hasOverride: hasOverride,
            onSaveOverride: onSaveOverride,
            proposeResult: proposeResult,
            showRegenerateConfirm: showRegenerateConfirm,
            showChanges: showChanges,
            changedDates: changedDates,
            hasAssignments: hasAssignments,
            onGenerateSchedule: onGenerateSchedule,
            onFillGaps: onFillGaps,
            onRequestRegenerate: onRequestRegenerate,
            onConfirmRegenerate: onConfirmRegenerate,
            csvModalOpen: csvModalOpen,
            onCsvImported: onCsvImported,
            isFinalizing: isFinalizing,
            shareUrl: shareUrl,
            shareCopied: shareCopied,
            shareError: shareError,
            onFinalizeAndShare: onFinalizeAndShare,
            onCopyShareUrl: onCopyShareUrl,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
