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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var vue_router_1 = require("vue-router");
var auth_1 = require("@/stores/auth");
var services_1 = require("@/stores/services");
var songs_1 = require("@/stores/songs");
var slotTypes_1 = require("@/utils/slotTypes");
var scripture_1 = require("@/utils/scripture");
var songSearch_1 = require("@/utils/songSearch");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var SongBadge_vue_1 = require("@/components/SongBadge.vue");
var SongSlotPicker_vue_1 = require("@/components/SongSlotPicker.vue");
var ScriptureInput_vue_1 = require("@/components/ScriptureInput.vue");
var ServicePrintLayout_vue_1 = require("@/components/ServicePrintLayout.vue");
var planningCenterExport_1 = require("@/utils/planningCenterExport");
var planningCenterApi_1 = require("@/utils/planningCenterApi");
var firestore_1 = require("firebase/firestore");
var sortablejs_1 = require("sortablejs");
var claudeApi_1 = require("@/utils/claudeApi");
var route = (0, vue_router_1.useRoute)();
var router = (0, vue_router_1.useRouter)();
var authStore = (0, auth_1.useAuthStore)();
var serviceStore = (0, services_1.useServiceStore)();
var songStore = (0, songs_1.useSongStore)();
// ── Constants ─────────────────────────────────────────────────────────────────
var AVAILABLE_TEAMS = ['Choir', 'Orchestra', 'Communion', 'Special'];
// Teams that should be pre-checked in the PC export dialog every time, regardless
// of what the service has flagged. Matched as case-insensitive substrings against
// the team name fetched from Planning Center, because PC names may vary slightly
// (e.g. "Worship Vocals" vs "Worship - Vocals").
var DEFAULT_PC_TEAM_NAMES = [
    'Preacher and Deacon and other Leaders',
    'Scripture Reading',
    'Worship Vocals',
    'Worship Band',
    'Pray-er',
    'Sanctuary Sound',
    'Livestream Sound',
    'Projection',
    'Livestream Camera',
];
/**
 * Decide whether a Planning Center team should be pre-checked when the export
 * dialog opens. Returns true if EITHER:
 *   (a) the PC team name contains any DEFAULT_PC_TEAM_NAMES entry (case-insensitive substring), OR
 *   (b) any conditional team flag on the service exactly matches the PC team name (case-insensitive).
 * Case (b) preserves the existing pre-Quick behavior for Orchestra / Choir / Communion / Special.
 */
function shouldPreselectPcTeam(pcTeamName, serviceTeams) {
    var lowerName = pcTeamName.toLowerCase();
    var matchesDefault = DEFAULT_PC_TEAM_NAMES.some(function (d) { return lowerName.includes(d.toLowerCase()); });
    if (matchesDefault)
        return true;
    return serviceTeams.some(function (svcTeam) { return svcTeam.toLowerCase() === lowerName; });
}
var statusBadgeClasses = {
    draft: 'bg-gray-800 text-gray-400 border-gray-700',
    planned: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
    exported: 'bg-green-900/50 text-green-300 border-green-800',
};
// ── Local state ────────────────────────────────────────────────────────────────
var localService = (0, vue_1.ref)(null);
var originalService = (0, vue_1.ref)(null);
var isSaving = (0, vue_1.ref)(false);
var pcCopied = (0, vue_1.ref)(false);
// ── Autosave state ─────────────────────────────────────────────────────────────
var previousService = (0, vue_1.ref)(null); // snapshot before last autosave (for undo)
var autosaveStatus = (0, vue_1.ref)('idle');
var autosaveTimer = null;
var autosaveInitialized = false; // suppress first-load trigger
var autosaveSaving = false; // inflight guard — prevents concurrent saves
var isSharing = (0, vue_1.ref)(false);
var shareCopied = (0, vue_1.ref)(false);
var shareError = (0, vue_1.ref)(null);
var showAddMenu = (0, vue_1.ref)(false);
var showDeleteConfirm = (0, vue_1.ref)(false);
var isDeleting = (0, vue_1.ref)(false);
// D-14: slot delete confirmation
var showSlotDeleteConfirm = (0, vue_1.ref)(false);
var pendingDeleteIndex = (0, vue_1.ref)(null);
// D-14: tracks whether the pending delete is a "clear song" (true) vs remove slot (false)
var pendingDeleteIsClear = (0, vue_1.ref)(false);
// D-16: element-type-aware delete-confirmation copy
var pendingSlotKind = (0, vue_1.computed)(function () {
    var _a, _b, _c;
    return pendingDeleteIndex.value != null
        ? ((_c = (_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.slots[pendingDeleteIndex.value]) === null || _b === void 0 ? void 0 : _b.kind) !== null && _c !== void 0 ? _c : null)
        : null;
});
var deleteConfirmHeading = (0, vue_1.computed)(function () {
    return pendingDeleteIsClear.value
        ? 'Remove this item?' // clear-song path keeps existing wording
        : 'Remove this element from the plan?';
} // D-16 remove-element wording
);
var deleteConfirmBody = (0, vue_1.computed)(function () {
    if (pendingDeleteIsClear.value) {
        return 'This will delete the assigned song, scripture, or content from the plan. This cannot be undone.';
    }
    var label = pendingSlotKind.value ? elementLabel(pendingSlotKind.value) : 'this element';
    return "This will remove ".concat(label, " from the service plan. This cannot be undone.");
});
// ── Export to PC state ─────────────────────────────────────────────────────────
var isExporting = (0, vue_1.ref)(false);
var pcExported = (0, vue_1.ref)(false); // green toast after success
var exportError = (0, vue_1.ref)(null); // red banner on error
// Export dialog state
var showExportDialog = (0, vue_1.ref)(false);
var exportServiceTypes = (0, vue_1.ref)([]);
var exportTemplates = (0, vue_1.ref)([]);
var exportSelectedServiceTypeId = (0, vue_1.ref)('');
var exportSelectedTemplateId = (0, vue_1.ref)('');
var exportLoading = (0, vue_1.ref)(false);
var existingPlan = (0, vue_1.ref)(null);
var exportMode = (0, vue_1.ref)('new');
var pcTeams = (0, vue_1.ref)([]);
var selectedPcTeamIds = (0, vue_1.ref)([]);
// ── Computed: editing guard ─────────────────────────────────────────────────────
var isExportedLocked = (0, vue_1.computed)(function () { var _a; return ((_a = localService.value) === null || _a === void 0 ? void 0 : _a.status) === 'exported'; });
// ── AI state ───────────────────────────────────────────────────────────────────
// Keyed by slot index — AI-drafted songs awaiting accept/reject
var aiDraftSongs = (0, vue_1.ref)(new Map());
// Loading state for "Suggest All" bulk flow
var aiSuggestingAll = (0, vue_1.ref)(false);
// Session cache keyed by sermon context + slot VW type (JSON.stringify)
var aiSongCache = (0, vue_1.ref)(new Map());
// Per-slot loading state for individual dropdown AI picks
var aiPerSlotLoading = (0, vue_1.ref)(new Map());
// Per-slot AI results for dropdown display
var aiPerSlotResults = (0, vue_1.ref)(new Map());
// Per-slot error state for dropdown display
var aiPerSlotError = (0, vue_1.ref)(new Map());
// ── Sortable ───────────────────────────────────────────────────────────────────
var slotContainerRef = (0, vue_1.ref)(null);
var sortableInstance = null;
(0, vue_1.watch)(slotContainerRef, function (el) {
    if (el && !sortableInstance) {
        sortableInstance = sortablejs_1.default.create(el, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'opacity-30',
            onEnd: function (evt) {
                return __awaiter(this, void 0, void 0, function () {
                    var parent, ref_1, slots, moved, reindexed;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                if (!localService.value || evt.oldIndex == null || evt.newIndex == null)
                                    return [2 /*return*/];
                                if (evt.oldIndex === evt.newIndex)
                                    return [2 /*return*/];
                                parent = evt.item.parentNode;
                                if (parent) {
                                    ref_1 = parent.children[evt.oldIndex];
                                    parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? (_a = ref_1 === null || ref_1 === void 0 ? void 0 : ref_1.nextSibling) !== null && _a !== void 0 ? _a : null : ref_1 !== null && ref_1 !== void 0 ? ref_1 : null);
                                }
                                slots = __spreadArray([], localService.value.slots, true);
                                moved = slots.splice(evt.oldIndex, 1)[0];
                                if (!moved)
                                    return [2 /*return*/];
                                slots.splice(evt.newIndex, 0, moved);
                                reindexed = (0, slotTypes_1.reindexSlots)(slots);
                                localService.value.slots = reindexed;
                                if (!serviceId.value) return [3 /*break*/, 4];
                                if (autosaveTimer) {
                                    clearTimeout(autosaveTimer);
                                    autosaveTimer = null;
                                }
                                autosaveSaving = true;
                                autosaveStatus.value = 'saving';
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, , 3, 4]);
                                return [4 /*yield*/, serviceStore.updateService(serviceId.value, { slots: reindexed })];
                            case 2:
                                _b.sent();
                                originalService.value = JSON.parse(JSON.stringify(localService.value));
                                autosaveStatus.value = 'saved';
                                setTimeout(function () {
                                    if (autosaveStatus.value === 'saved')
                                        autosaveStatus.value = 'idle';
                                }, 3000);
                                return [3 /*break*/, 4];
                            case 3:
                                autosaveSaving = false;
                                return [7 /*endfinally*/];
                            case 4: return [2 /*return*/];
                        }
                    });
                });
            },
        });
    }
}, { flush: 'post' });
// ── Computed ───────────────────────────────────────────────────────────────────
var serviceId = (0, vue_1.computed)(function () { return route.params.id; });
var parsedDate = (0, vue_1.computed)(function () {
    var _a, _b, _c, _d;
    if (!((_a = localService.value) === null || _a === void 0 ? void 0 : _a.date))
        return null;
    var parts = localService.value.date.split('-').map(Number);
    var year = (_b = parts[0]) !== null && _b !== void 0 ? _b : 0;
    var month = (_c = parts[1]) !== null && _c !== void 0 ? _c : 1;
    var day = (_d = parts[2]) !== null && _d !== void 0 ? _d : 1;
    return new Date(year, month - 1, day);
});
var formattedDate = (0, vue_1.computed)(function () {
    if (!parsedDate.value)
        return '';
    return parsedDate.value.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
});
function onDateChange(newDate) {
    if (!localService.value || !newDate)
        return;
    localService.value.date = newDate;
}
var isDirty = (0, vue_1.computed)(function () {
    if (!localService.value || !originalService.value)
        return false;
    return JSON.stringify(localService.value) !== JSON.stringify(originalService.value);
});
var hasSermonContext = (0, vue_1.computed)(function () { var _a, _b, _c; return !!(((_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.sermonTopic) === null || _b === void 0 ? void 0 : _b.trim()) || ((_c = localService.value) === null || _c === void 0 ? void 0 : _c.sermonPassage)); });
var recentServiceSongIds = (0, vue_1.computed)(function () {
    var eightWeeksAgo = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000;
    var cutoff = new Date(eightWeeksAgo).toISOString().slice(0, 10); // YYYY-MM-DD
    var ids = new Set();
    for (var _i = 0, _a = serviceStore.services; _i < _a.length; _i++) {
        var service = _a[_i];
        // services are ordered by date desc; skip current service
        if (service.id === serviceId.value)
            continue;
        if (service.date < cutoff)
            break;
        for (var _b = 0, _c = service.slots; _b < _c.length; _b++) {
            var slot = _c[_b];
            if (slot.kind === 'SONG') {
                var songId = slot.songId;
                if (songId)
                    ids.add(songId);
            }
        }
    }
    return Array.from(ids);
});
var recentScriptureRefs = (0, vue_1.computed)(function () {
    var eightWeeksAgo = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000;
    var cutoff = new Date(eightWeeksAgo).toISOString().slice(0, 10); // YYYY-MM-DD
    var refs = [];
    for (var _i = 0, _a = serviceStore.services; _i < _a.length; _i++) {
        var service = _a[_i];
        // services are ordered by date desc; skip current service
        if (service.id === serviceId.value)
            continue;
        if (service.date < cutoff)
            break;
        for (var _b = 0, _c = service.slots; _b < _c.length; _b++) {
            var slot = _c[_b];
            if (slot.kind === 'SCRIPTURE') {
                var s = slot;
                if (s.book && s.chapter && s.verseStart && s.verseEnd) {
                    refs.push({ book: s.book, chapter: s.chapter, verseStart: s.verseStart, verseEnd: s.verseEnd });
                }
            }
        }
    }
    return refs;
});
// ── Watch for service store changes ───────────────────────────────────────────
(0, vue_1.watch)(function () { return serviceStore.services; }, function (services) {
    var found = services.find(function (s) { return s.id === serviceId.value; });
    if (!found)
        return;
    if (!localService.value) {
        // Initial load: populate from store
        localService.value = JSON.parse(JSON.stringify(found));
        originalService.value = JSON.parse(JSON.stringify(found));
        // Reset autosave state when service first loads (or re-loads)
        autosaveInitialized = false;
        previousService.value = null;
        autosaveStatus.value = 'idle';
    }
    else if (autosaveStatus.value === 'idle' || autosaveStatus.value === 'saved') {
        // Remote update arrived while user is not actively editing — apply it.
        // This is what makes two simultaneous viewers see each other's changes.
        // Guard: skip if the remote version matches what we already have (avoid
        // spurious re-renders after our own save completes).
        var remoteJson = JSON.stringify(found);
        var localJson = JSON.stringify(localService.value);
        if (remoteJson !== localJson) {
            localService.value = JSON.parse(remoteJson);
            originalService.value = JSON.parse(remoteJson);
            // Reset autosaveInitialized so the watcher's first local mutation
            // after a remote merge is NOT mistakenly treated as user-initiated.
            autosaveInitialized = false;
        }
    }
    // If autosaveStatus is 'pending' or 'saving', the user is actively editing —
    // do not overwrite their in-progress work. Their save will win.
}, { immediate: true, deep: true });
// ── AI sermon context watcher — clear caches on context change ─────────────────
(0, vue_1.watch)(function () { var _a, _b; return [(_a = localService.value) === null || _a === void 0 ? void 0 : _a.sermonTopic, (_b = localService.value) === null || _b === void 0 ? void 0 : _b.sermonPassage]; }, function () {
    aiSongCache.value.clear();
    aiPerSlotResults.value.clear();
    aiPerSlotError.value.clear();
    aiPerSlotLoading.value.clear();
}, { deep: true });
// ── Autosave watcher ────────────────────────────────────────────────────────────
(0, vue_1.watch)(localService, function () {
    // Skip: not loaded yet, or no actual change
    if (!localService.value || !originalService.value)
        return;
    // Viewers cannot autosave
    if (!authStore.isEditor)
        return;
    // Suppress the trigger that fires when service first loads from the store
    if (!autosaveInitialized) {
        autosaveInitialized = true;
        return;
    }
    if (!isDirty.value)
        return;
    // D-17: always mark pending so status never strands; re-arm timer if it was cleared (e.g. after immediate reorder-save)
    autosaveStatus.value = 'pending';
    if (autosaveTimer)
        clearTimeout(autosaveTimer);
    var scheduleAutosave = function () {
        autosaveTimer = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // D-17: clear the handle immediately so autosaveTimer === null is reachable for the re-arm guard
                        autosaveTimer = null;
                        if (!isDirty.value) {
                            autosaveStatus.value = 'idle';
                            return [2 /*return*/];
                        }
                        // A save is already in flight — reschedule so this slot state gets saved
                        if (autosaveSaving) {
                            scheduleAutosave();
                            return [2 /*return*/];
                        }
                        // Snapshot pre-change state before saving (enables undo)
                        previousService.value = JSON.parse(JSON.stringify(originalService.value));
                        autosaveSaving = true;
                        autosaveStatus.value = 'saving';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, onSave()];
                    case 2:
                        _a.sent();
                        autosaveStatus.value = 'saved';
                        // Fade "Saved" indicator after 3 seconds
                        setTimeout(function () {
                            if (autosaveStatus.value === 'saved')
                                autosaveStatus.value = 'idle';
                        }, 3000);
                        return [3 /*break*/, 4];
                    case 3:
                        autosaveSaving = false;
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); }, 800);
    };
    scheduleAutosave();
}, { deep: true });
// ── Init ───────────────────────────────────────────────────────────────────────
function initStores() {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    if (!serviceStore.orgId) {
        serviceStore.subscribe(orgId);
    }
    if (!songStore.orgId) {
        songStore.subscribe(orgId);
    }
}
(0, vue_1.onMounted)(function () {
    initStores();
    // Ctrl+Z / Cmd+Z undo shortcut
    function handleUndoKey(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            // Only intercept if undo is available (not inside a text input where browser undo should apply)
            var tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA')
                return;
            if (!previousService.value)
                return;
            e.preventDefault();
            onUndo();
        }
    }
    document.addEventListener('keydown', handleUndoKey);
    (0, vue_1.onUnmounted)(function () { return document.removeEventListener('keydown', handleUndoKey); });
});
(0, vue_1.onUnmounted)(function () {
    sortableInstance === null || sortableInstance === void 0 ? void 0 : sortableInstance.destroy();
    sortableInstance = null;
    if (autosaveTimer)
        clearTimeout(autosaveTimer);
    autosaveSaving = false;
    // Don't unsubscribe serviceStore here — DashboardView may still be using it
});
// ── CCLI helper ────────────────────────────────────────────────────────────────
function getCcliNumber(songId) {
    var _a;
    return ((_a = songStore.songs.find(function (s) { return s.id === songId; })) === null || _a === void 0 ? void 0 : _a.ccliNumber) || null;
}
// ── Status toggle ──────────────────────────────────────────────────────────────
function toggleStatus() {
    if (!localService.value)
        return;
    var current = localService.value.status;
    if (current === 'draft') {
        localService.value.status = 'planned';
    }
    else if (current === 'planned') {
        localService.value.status = 'exported';
    }
    else {
        // exported -> draft
        localService.value.status = 'draft';
    }
}
// ── Team toggle ────────────────────────────────────────────────────────────────
function toggleTeam(team) {
    if (!localService.value)
        return;
    var teams = localService.value.teams;
    var idx = teams.indexOf(team);
    if (idx >= 0) {
        localService.value.teams = teams.filter(function (_, i) { return i !== idx; });
    }
    else {
        localService.value.teams = __spreadArray(__spreadArray([], teams, true), [team], false);
    }
}
// ── Dynamic slot add/remove ────────────────────────────────────────────────────
function addSlot(kind, vwType) {
    if (!localService.value)
        return;
    var newSlot = (0, slotTypes_1.createSlot)(kind, vwType);
    localService.value.slots.push(newSlot);
    localService.value.slots = (0, slotTypes_1.reindexSlots)(localService.value.slots);
    showAddMenu.value = false;
}
// ── Slot populated check (D-14) ────────────────────────────────────────────────
function isSlotPopulated(slot) {
    var _a, _b, _c, _d;
    if (slot.kind === 'SONG') {
        return slot.songId != null;
    }
    if (slot.kind === 'SCRIPTURE') {
        var s = slot;
        return !!(s.book || s.chapter || s.verseStart || s.verseEnd);
    }
    if (slot.kind === 'MESSAGE' || slot.kind === 'PRAYER') {
        var s = slot;
        return !!(((_a = s.linkUrl) === null || _a === void 0 ? void 0 : _a.trim()) || ((_b = s.linkLabel) === null || _b === void 0 ? void 0 : _b.trim()));
    }
    if (slot.kind === 'HYMN') {
        var s = slot;
        return !!(((_c = s.hymnName) === null || _c === void 0 ? void 0 : _c.trim()) || ((_d = s.hymnNumber) === null || _d === void 0 ? void 0 : _d.trim()));
    }
    return false;
}
// ── Slot remove (with D-14 confirmation gate) ──────────────────────────────────
function performRemoveSlot(index) {
    if (!localService.value)
        return;
    localService.value.slots.splice(index, 1);
    localService.value.slots = (0, slotTypes_1.reindexSlots)(localService.value.slots);
}
function removeSlot(index) {
    if (!localService.value)
        return;
    var slot = localService.value.slots[index];
    if (!slot)
        return;
    // D-15: confirm ALL element removals, including empty/blank rows
    pendingDeleteIndex.value = index;
    pendingDeleteIsClear.value = false;
    showSlotDeleteConfirm.value = true;
}
function elementLabel(kind) {
    switch (kind) {
        case 'SONG': return 'this song';
        case 'SCRIPTURE': return 'this scripture';
        case 'HYMN': return 'this hymn';
        case 'MESSAGE': return 'this message';
        case 'PRAYER': return 'this prayer';
        default: return 'this element';
    }
}
function confirmSlotDelete() {
    var _a;
    if (pendingDeleteIndex.value == null)
        return;
    if (pendingDeleteIsClear.value) {
        // Clear-song path
        var slot = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.slots[pendingDeleteIndex.value];
        if ((slot === null || slot === void 0 ? void 0 : slot.kind) === 'SONG') {
            var updated = __assign(__assign({}, slot), { songId: null, songTitle: null, songKey: null });
            localService.value.slots[pendingDeleteIndex.value] = updated;
        }
    }
    else {
        performRemoveSlot(pendingDeleteIndex.value);
    }
    showSlotDeleteConfirm.value = false;
    pendingDeleteIndex.value = null;
    pendingDeleteIsClear.value = false;
}
// ── Song assignment ────────────────────────────────────────────────────────────
function onSelectSong(index, song) {
    if (!localService.value)
        return;
    var slot = localService.value.slots[index];
    if (!slot)
        return;
    if (slot.kind === 'SONG') {
        var updated = __assign(__assign({}, slot), { songId: song.id, songTitle: song.title, songKey: song.key });
        localService.value.slots[index] = updated;
    }
}
function onClearSong(index) {
    if (!localService.value)
        return;
    var slot = localService.value.slots[index];
    if (!slot)
        return;
    if (slot.kind === 'SONG') {
        if (slot.songId != null) {
            // D-14: slot has an assigned song — gate behind confirm dialog
            pendingDeleteIndex.value = index;
            pendingDeleteIsClear.value = true;
            showSlotDeleteConfirm.value = true;
            return;
        }
        // No song assigned — clear directly (no data loss)
        var updated = __assign(__assign({}, slot), { songId: null, songTitle: null, songKey: null });
        localService.value.slots[index] = updated;
    }
}
// ── AI cache key ───────────────────────────────────────────────────────────────
function aiCacheKey(slotVwType) {
    var _a, _b, _c, _d;
    return JSON.stringify({
        topic: (_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.sermonTopic) !== null && _b !== void 0 ? _b : '',
        passage: (_d = (_c = localService.value) === null || _c === void 0 ? void 0 : _c.sermonPassage) !== null && _d !== void 0 ? _d : null,
        slotVwType: slotVwType,
    });
}
// ── Suggest All Songs ──────────────────────────────────────────────────────────
function suggestAllSongs() {
    return __awaiter(this, void 0, void 0, function () {
        var sermonTopic, sermonPassage, isOrchestraService, base, librarySource, songLibrary, recentIds, batchAcceptedIds_1, _loop_3, i;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!localService.value || !hasSermonContext.value)
                        return [2 /*return*/];
                    aiSuggestingAll.value = true;
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, , 6, 7]);
                    sermonTopic = (_a = localService.value.sermonTopic) !== null && _a !== void 0 ? _a : null;
                    sermonPassage = (_b = localService.value.sermonPassage) !== null && _b !== void 0 ? _b : null;
                    isOrchestraService = ((_d = (_c = localService.value) === null || _c === void 0 ? void 0 : _c.teams) !== null && _d !== void 0 ? _d : []).includes('Orchestra');
                    base = songStore.aiCandidateSongs;
                    librarySource = isOrchestraService
                        ? base.filter(function (s) { return s.tags.includes('Orchestra'); })
                        : base;
                    songLibrary = librarySource.map(function (s) { return ({
                        id: s.id,
                        title: s.title,
                        ccliNumber: s.ccliNumber,
                        vwTypes: s.vwTypes,
                        themes: s.themes,
                        lastUsedAt: s.lastUsedAt,
                    }); });
                    recentIds = recentServiceSongIds.value;
                    batchAcceptedIds_1 = [];
                    _loop_3 = function (i) {
                        var slot, songSlot, alreadySelectedIds, _i, _f, s, id, _g, batchAcceptedIds_2, id, result, suggestion, song, key, newMap;
                        return __generator(this, function (_h) {
                            switch (_h.label) {
                                case 0:
                                    slot = localService.value.slots[i];
                                    if (!slot || slot.kind !== 'SONG')
                                        return [2 /*return*/, "continue"];
                                    songSlot = slot;
                                    alreadySelectedIds = [];
                                    for (_i = 0, _f = localService.value.slots; _i < _f.length; _i++) {
                                        s = _f[_i];
                                        if (s.kind === 'SONG') {
                                            id = s.songId;
                                            if (id)
                                                alreadySelectedIds.push(id);
                                        }
                                    }
                                    // Include batch picks so far
                                    for (_g = 0, batchAcceptedIds_2 = batchAcceptedIds_1; _g < batchAcceptedIds_2.length; _g++) {
                                        id = batchAcceptedIds_2[_g];
                                        if (!alreadySelectedIds.includes(id))
                                            alreadySelectedIds.push(id);
                                    }
                                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                                            sermonTopic: sermonTopic,
                                            sermonPassage: sermonPassage,
                                            slotVwType: songSlot.requiredVwType,
                                            alreadySelectedSongIds: alreadySelectedIds,
                                            songLibrary: songLibrary,
                                            recentServiceSongIds: recentIds,
                                        })];
                                case 1:
                                    result = _h.sent();
                                    if (!result || result.length === 0)
                                        return [2 /*return*/, "continue"];
                                    suggestion = result.find(function (s) { return !alreadySelectedIds.includes(s.songId) && !batchAcceptedIds_1.includes(s.songId); });
                                    if (!suggestion)
                                        return [2 /*return*/, "continue"];
                                    song = songStore.songs.find(function (s) { return s.id === suggestion.songId; });
                                    if (!song)
                                        return [2 /*return*/, "continue"];
                                    key = (0, songSearch_1.getPrimaryKey)(song);
                                    newMap = new Map(aiDraftSongs.value);
                                    newMap.set(i, {
                                        songId: song.id,
                                        songTitle: song.title,
                                        songKey: key,
                                        reason: suggestion.reason,
                                    });
                                    aiDraftSongs.value = newMap;
                                    // Track this ID for subsequent calls in the batch
                                    batchAcceptedIds_1.push(song.id);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _e.label = 2;
                case 2:
                    if (!(i < localService.value.slots.length)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_3(i)];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 7];
                case 6:
                    aiSuggestingAll.value = false;
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// ── Fetch AI suggestions for a single slot (called by SongSlotPicker emit) ──────
function fetchAiForSlot(slotIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var slot, songSlot, cacheKey, cached, newResults, newLoading, newErrors, alreadySelectedIds, _i, _a, s, id, isOrchestraService, base, librarySource, result, newCache, newResultsMap, errMap, _b, errMap, loadingMap;
        var _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!localService.value)
                        return [2 /*return*/];
                    slot = localService.value.slots[slotIndex];
                    if (!slot || slot.kind !== 'SONG')
                        return [2 /*return*/];
                    songSlot = slot;
                    cacheKey = aiCacheKey(songSlot.requiredVwType);
                    // Check cache first
                    if (aiSongCache.value.has(cacheKey)) {
                        cached = aiSongCache.value.get(cacheKey);
                        newResults = new Map(aiPerSlotResults.value);
                        newResults.set(slotIndex, cached);
                        aiPerSlotResults.value = newResults;
                        return [2 /*return*/];
                    }
                    newLoading = new Map(aiPerSlotLoading.value);
                    newLoading.set(slotIndex, true);
                    aiPerSlotLoading.value = newLoading;
                    newErrors = new Map(aiPerSlotError.value);
                    newErrors.delete(slotIndex);
                    aiPerSlotError.value = newErrors;
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, 4, 5]);
                    alreadySelectedIds = [];
                    for (_i = 0, _a = localService.value.slots; _i < _a.length; _i++) {
                        s = _a[_i];
                        if (s.kind === 'SONG') {
                            id = s.songId;
                            if (id)
                                alreadySelectedIds.push(id);
                        }
                    }
                    isOrchestraService = ((_d = (_c = localService.value) === null || _c === void 0 ? void 0 : _c.teams) !== null && _d !== void 0 ? _d : []).includes('Orchestra');
                    base = songStore.aiCandidateSongs;
                    librarySource = isOrchestraService
                        ? base.filter(function (s) { return s.tags.includes('Orchestra'); })
                        : base;
                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                            sermonTopic: (_e = localService.value.sermonTopic) !== null && _e !== void 0 ? _e : null,
                            sermonPassage: (_f = localService.value.sermonPassage) !== null && _f !== void 0 ? _f : null,
                            slotVwType: songSlot.requiredVwType,
                            alreadySelectedSongIds: alreadySelectedIds,
                            songLibrary: librarySource.map(function (s) { return ({
                                id: s.id,
                                title: s.title,
                                ccliNumber: s.ccliNumber,
                                vwTypes: s.vwTypes,
                                themes: s.themes,
                                lastUsedAt: s.lastUsedAt,
                            }); }),
                            recentServiceSongIds: recentServiceSongIds.value,
                        })];
                case 2:
                    result = _g.sent();
                    if (result) {
                        newCache = new Map(aiSongCache.value);
                        newCache.set(cacheKey, result);
                        aiSongCache.value = newCache;
                        newResultsMap = new Map(aiPerSlotResults.value);
                        newResultsMap.set(slotIndex, result);
                        aiPerSlotResults.value = newResultsMap;
                    }
                    else {
                        errMap = new Map(aiPerSlotError.value);
                        errMap.set(slotIndex, true);
                        aiPerSlotError.value = errMap;
                    }
                    return [3 /*break*/, 5];
                case 3:
                    _b = _g.sent();
                    errMap = new Map(aiPerSlotError.value);
                    errMap.set(slotIndex, true);
                    aiPerSlotError.value = errMap;
                    return [3 /*break*/, 5];
                case 4:
                    loadingMap = new Map(aiPerSlotLoading.value);
                    loadingMap.delete(slotIndex);
                    aiPerSlotLoading.value = loadingMap;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── Accept / Reject AI draft songs ─────────────────────────────────────────────
function acceptAiSong(index) {
    var draft = aiDraftSongs.value.get(index);
    if (!draft)
        return;
    onSelectSong(index, { id: draft.songId, title: draft.songTitle, key: draft.songKey });
    var newMap = new Map(aiDraftSongs.value);
    newMap.delete(index);
    aiDraftSongs.value = newMap;
}
function rejectAiSong(index) {
    var newMap = new Map(aiDraftSongs.value);
    newMap.delete(index);
    aiDraftSongs.value = newMap;
}
// ── Scripture ──────────────────────────────────────────────────────────────────
function slotToScriptureRef(slot) {
    if (!slot.book || !slot.chapter || !slot.verseStart || !slot.verseEnd)
        return null;
    return {
        book: slot.book,
        chapter: slot.chapter,
        verseStart: slot.verseStart,
        verseEnd: slot.verseEnd,
    };
}
function onScriptureChange(index, ref) {
    var _a, _b, _c, _d;
    if (!localService.value)
        return;
    var slot = localService.value.slots[index];
    if (!slot)
        return;
    if (slot.kind === 'SCRIPTURE') {
        localService.value.slots[index] = __assign(__assign({}, slot), { book: (_a = ref === null || ref === void 0 ? void 0 : ref.book) !== null && _a !== void 0 ? _a : null, chapter: (_b = ref === null || ref === void 0 ? void 0 : ref.chapter) !== null && _b !== void 0 ? _b : null, verseStart: (_c = ref === null || ref === void 0 ? void 0 : ref.verseStart) !== null && _c !== void 0 ? _c : null, verseEnd: (_d = ref === null || ref === void 0 ? void 0 : ref.verseEnd) !== null && _d !== void 0 ? _d : null });
    }
}
function onSermonPassageChange(ref) {
    if (!localService.value)
        return;
    localService.value.sermonPassage = ref;
}
// Keep for use in ScriptureInput overlap detection (via the component itself)
function checkScriptureOverlap(slot) {
    var _a, _b;
    var reading = slotToScriptureRef(slot);
    var sermon = (_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.sermonPassage) !== null && _b !== void 0 ? _b : null;
    if (!reading || !sermon)
        return false;
    return (0, scripture_1.scripturesOverlap)(reading, sermon);
}
// Suppress unused warning — this function is available for future template use
void checkScriptureOverlap;
// ── Print & Copy for PC ────────────────────────────────────────────────────────
function onPrint() {
    window.print();
}
function onCopyForPC() {
    return __awaiter(this, void 0, void 0, function () {
        var text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!localService.value)
                        return [2 /*return*/];
                    text = (0, planningCenterExport_1.formatForPlanningCenter)(localService.value, songStore.songs);
                    if (!navigator.clipboard) return [3 /*break*/, 2];
                    return [4 /*yield*/, navigator.clipboard.writeText(text)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    pcCopied.value = true;
                    setTimeout(function () {
                        pcCopied.value = false;
                    }, 2000);
                    return [2 /*return*/];
            }
        });
    });
}
function checkForExistingPlan() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, appId, secret, plans, targetDate_1, match, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value || !((_c = localService.value) === null || _c === void 0 ? void 0 : _c.date)) {
                        existingPlan.value = null;
                        return [2 /*return*/];
                    }
                    _a = authStore.pcCredentials, appId = _a.appId, secret = _a.secret;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlans)(appId, secret, exportSelectedServiceTypeId.value, {
                            after: localService.value.date,
                            before: localService.value.date,
                        })
                        // sortDate is a full ISO datetime — match just the date portion
                    ];
                case 2:
                    plans = _d.sent();
                    targetDate_1 = localService.value.date;
                    match = plans.find(function (p) { var _a; return (_a = p.sortDate) === null || _a === void 0 ? void 0 : _a.startsWith(targetDate_1); });
                    existingPlan.value = match !== null && match !== void 0 ? match : null;
                    exportMode.value = existingPlan.value ? 'existing' : 'new';
                    return [3 /*break*/, 4];
                case 3:
                    _b = _d.sent();
                    existingPlan.value = null;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function onExportToPC() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, appId, secret, _b, sundayType, _c, _d, _e, e_1;
        var _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    if (!localService.value)
                        return [2 /*return*/];
                    if (!authStore.hasPcCredentials || !authStore.pcCredentials)
                        return [2 /*return*/];
                    showExportDialog.value = true;
                    exportError.value = null;
                    exportLoading.value = true;
                    existingPlan.value = null;
                    exportMode.value = 'new';
                    pcTeams.value = [];
                    selectedPcTeamIds.value = [];
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 9, 10, 11]);
                    _a = authStore.pcCredentials, appId = _a.appId, secret = _a.secret;
                    _b = exportServiceTypes;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypes)(appId, secret)
                        // Default to service type whose name contains "Sunday", else first
                    ];
                case 2:
                    _b.value = _l.sent();
                    sundayType = exportServiceTypes.value.find(function (t) {
                        return t.name.toLowerCase().includes('sunday');
                    });
                    exportSelectedServiceTypeId.value = (_h = (_f = sundayType === null || sundayType === void 0 ? void 0 : sundayType.id) !== null && _f !== void 0 ? _f : (_g = exportServiceTypes.value[0]) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : '';
                    if (!exportSelectedServiceTypeId.value) return [3 /*break*/, 8];
                    _c = exportTemplates;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTemplates)(appId, secret, exportSelectedServiceTypeId.value)];
                case 3:
                    _c.value = _l.sent();
                    exportSelectedTemplateId.value = (_k = (_j = exportTemplates.value[0]) === null || _j === void 0 ? void 0 : _j.id) !== null && _k !== void 0 ? _k : '';
                    // Check if a plan already exists for this date
                    return [4 /*yield*/, checkForExistingPlan()
                        // Fetch PC teams for the selected service type and pre-select matching ones (D-04, D-05)
                    ];
                case 4:
                    // Check if a plan already exists for this date
                    _l.sent();
                    _l.label = 5;
                case 5:
                    _l.trys.push([5, 7, , 8]);
                    _d = pcTeams;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypeTeams)(appId, secret, exportSelectedServiceTypeId.value)];
                case 6:
                    _d.value = _l.sent();
                    selectedPcTeamIds.value = pcTeams.value
                        .filter(function (pcTeam) { var _a, _b; return shouldPreselectPcTeam(pcTeam.name, (_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.teams) !== null && _b !== void 0 ? _b : []); })
                        .map(function (t) { return t.id; });
                    return [3 /*break*/, 8];
                case 7:
                    _e = _l.sent();
                    // Non-fatal: if teams cannot be fetched, export can still proceed without team add
                    pcTeams.value = [];
                    selectedPcTeamIds.value = [];
                    return [3 /*break*/, 8];
                case 8: return [3 /*break*/, 11];
                case 9:
                    e_1 = _l.sent();
                    exportError.value = e_1 instanceof Error ? e_1.message : 'Failed to load export options';
                    return [3 /*break*/, 11];
                case 10:
                    exportLoading.value = false;
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
function onServiceTypeChange() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, appId, secret, _b, _c, _d, _e;
        var _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value)
                        return [2 /*return*/];
                    _a = authStore.pcCredentials, appId = _a.appId, secret = _a.secret;
                    exportTemplates.value = [];
                    exportSelectedTemplateId.value = '';
                    existingPlan.value = null;
                    exportMode.value = 'new';
                    pcTeams.value = [];
                    selectedPcTeamIds.value = [];
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 8, , 9]);
                    _b = exportTemplates;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTemplates)(appId, secret, exportSelectedServiceTypeId.value)];
                case 2:
                    _b.value = _h.sent();
                    exportSelectedTemplateId.value = (_g = (_f = exportTemplates.value[0]) === null || _f === void 0 ? void 0 : _f.id) !== null && _g !== void 0 ? _g : '';
                    return [4 /*yield*/, checkForExistingPlan()];
                case 3:
                    _h.sent();
                    _h.label = 4;
                case 4:
                    _h.trys.push([4, 6, , 7]);
                    _c = pcTeams;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypeTeams)(appId, secret, exportSelectedServiceTypeId.value)];
                case 5:
                    _c.value = _h.sent();
                    selectedPcTeamIds.value = pcTeams.value
                        .filter(function (pcTeam) { var _a, _b; return shouldPreselectPcTeam(pcTeam.name, (_b = (_a = localService.value) === null || _a === void 0 ? void 0 : _a.teams) !== null && _b !== void 0 ? _b : []); })
                        .map(function (t) { return t.id; });
                    return [3 /*break*/, 7];
                case 6:
                    _d = _h.sent();
                    pcTeams.value = [];
                    selectedPcTeamIds.value = [];
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 9];
                case 8:
                    _e = _h.sent();
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function onConfirmExport() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, appId, secret, serviceTypeId, failures, planId, songSlots, scriptureSlots, existingItems, songIndex, scriptureIndex, songMatches, scriptureMatches, unmatchedPlaceholderIds, _i, existingItems_1, item, titleLower, isSongItem, NON_SCRIPTURE_REGULAR_TITLES, isScriptureItem, _b, unmatchedPlaceholderIds_1, itemId, _c, _d, songMatches_1, _e, item, slot, _f, label, _g, scriptureMatches_1, _h, item, slot, _j, sequence, i, _k, slot, i, _l, templateId, baseTitle, serviceDate, toUtc, wed, wedStr, sequence, songIndex, scriptureIndex, templateItems, _m, templateItems_1, tItem, titleLower, isSongItem, isScriptureItem, e_2, i, _o, slot, i, _p, _q, _r, slot, _s, label, alreadyPresentTeamIds, _t, _u, teamId, positions, _v, positions_1, position, err_1, e_3;
        var _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        return __generator(this, function (_6) {
            switch (_6.label) {
                case 0:
                    if (!localService.value)
                        return [2 /*return*/];
                    if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value)
                        return [2 /*return*/];
                    isExporting.value = true;
                    exportError.value = null;
                    _6.label = 1;
                case 1:
                    _6.trys.push([1, 85, 86, 87]);
                    _a = authStore.pcCredentials, appId = _a.appId, secret = _a.secret;
                    serviceTypeId = exportSelectedServiceTypeId.value;
                    failures = [];
                    planId = void 0;
                    songSlots = localService.value.slots.filter(function (s) { return s.kind === 'SONG' || s.kind === 'HYMN'; });
                    scriptureSlots = localService.value.slots.filter(function (s) { return s.kind === 'SCRIPTURE'; });
                    if (!(exportMode.value === 'existing' && existingPlan.value)) return [3 /*break*/, 35];
                    // ── Add to existing plan: replace placeholders, then append leftovers (D-02) ──
                    planId = existingPlan.value.id;
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanItems)(appId, secret, serviceTypeId, planId)
                        // First pass — classify placeholders into three buckets
                    ];
                case 2:
                    existingItems = _6.sent();
                    songIndex = 0;
                    scriptureIndex = 0;
                    songMatches = [];
                    scriptureMatches = [];
                    unmatchedPlaceholderIds = [];
                    for (_i = 0, existingItems_1 = existingItems; _i < existingItems_1.length; _i++) {
                        item = existingItems_1[_i];
                        titleLower = item.title.toLowerCase();
                        isSongItem = titleLower.includes('worship song')
                            || item.itemType === 'song'
                            || item.itemType === 'song_arrangement';
                        NON_SCRIPTURE_REGULAR_TITLES = new Set(['message', 'prayer']);
                        isScriptureItem = titleLower.startsWith('scripture - ')
                            || titleLower.includes('scripture reading')
                            || (item.itemType === 'regular' && !NON_SCRIPTURE_REGULAR_TITLES.has(titleLower));
                        if (isSongItem && songIndex < songSlots.length) {
                            songMatches.push({ item: item, slot: songSlots[songIndex] });
                            songIndex++;
                        }
                        else if (!isSongItem && isScriptureItem && scriptureIndex < scriptureSlots.length) {
                            scriptureMatches.push({ item: item, slot: scriptureSlots[scriptureIndex] });
                            scriptureIndex++;
                        }
                        else if (isSongItem || titleLower.includes('scripture reading')) {
                            // Only push unmatched song items or explicit 'scripture reading' placeholders
                            unmatchedPlaceholderIds.push(item.id);
                        }
                    }
                    _b = 0, unmatchedPlaceholderIds_1 = unmatchedPlaceholderIds;
                    _6.label = 3;
                case 3:
                    if (!(_b < unmatchedPlaceholderIds_1.length)) return [3 /*break*/, 8];
                    itemId = unmatchedPlaceholderIds_1[_b];
                    _6.label = 4;
                case 4:
                    _6.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, planningCenterApi_1.deleteItem)(appId, secret, serviceTypeId, planId, itemId)];
                case 5:
                    _6.sent();
                    return [3 /*break*/, 7];
                case 6:
                    _c = _6.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _b++;
                    return [3 /*break*/, 3];
                case 8:
                    _d = 0, songMatches_1 = songMatches;
                    _6.label = 9;
                case 9:
                    if (!(_d < songMatches_1.length)) return [3 /*break*/, 15];
                    _e = songMatches_1[_d], item = _e.item, slot = _e.slot;
                    _6.label = 10;
                case 10:
                    _6.trys.push([10, 13, , 14]);
                    return [4 /*yield*/, (0, planningCenterApi_1.deleteItem)(appId, secret, serviceTypeId, planId, item.id)];
                case 11:
                    _6.sent();
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, slot, item.sequence, songStore.songs, localService.value.sermonPassage, (_w = item.length) !== null && _w !== void 0 ? _w : undefined)];
                case 12:
                    _6.sent();
                    return [3 /*break*/, 14];
                case 13:
                    _f = _6.sent();
                    label = slot.kind === 'SONG'
                        ? ((_x = slot.songTitle) !== null && _x !== void 0 ? _x : 'Song')
                        : ((_y = slot.hymnName) !== null && _y !== void 0 ? _y : 'Hymn');
                    failures.push(label);
                    return [3 /*break*/, 14];
                case 14:
                    _d++;
                    return [3 /*break*/, 9];
                case 15:
                    _g = 0, scriptureMatches_1 = scriptureMatches;
                    _6.label = 16;
                case 16:
                    if (!(_g < scriptureMatches_1.length)) return [3 /*break*/, 22];
                    _h = scriptureMatches_1[_g], item = _h.item, slot = _h.slot;
                    _6.label = 17;
                case 17:
                    _6.trys.push([17, 20, , 21]);
                    return [4 /*yield*/, (0, planningCenterApi_1.deleteItem)(appId, secret, serviceTypeId, planId, item.id)];
                case 18:
                    _6.sent();
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, slot, item.sequence, songStore.songs, localService.value.sermonPassage, (_z = item.length) !== null && _z !== void 0 ? _z : undefined)];
                case 19:
                    _6.sent();
                    return [3 /*break*/, 21];
                case 20:
                    _j = _6.sent();
                    failures.push('Scripture');
                    return [3 /*break*/, 21];
                case 21:
                    _g++;
                    return [3 /*break*/, 16];
                case 22:
                    sequence = existingItems.length > 0
                        ? Math.max.apply(Math, existingItems.map(function (i) { return i.sequence; })) + 1
                        : 1;
                    i = songIndex;
                    _6.label = 23;
                case 23:
                    if (!(i < songSlots.length)) return [3 /*break*/, 28];
                    _6.label = 24;
                case 24:
                    _6.trys.push([24, 26, , 27]);
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, songSlots[i], sequence, songStore.songs, localService.value.sermonPassage)];
                case 25:
                    _6.sent();
                    sequence++;
                    return [3 /*break*/, 27];
                case 26:
                    _k = _6.sent();
                    slot = songSlots[i];
                    failures.push(slot.kind === 'SONG' ? ((_0 = slot.songTitle) !== null && _0 !== void 0 ? _0 : 'Song') : ((_1 = slot.hymnName) !== null && _1 !== void 0 ? _1 : 'Hymn'));
                    return [3 /*break*/, 27];
                case 27:
                    i++;
                    return [3 /*break*/, 23];
                case 28:
                    i = scriptureIndex;
                    _6.label = 29;
                case 29:
                    if (!(i < scriptureSlots.length)) return [3 /*break*/, 34];
                    _6.label = 30;
                case 30:
                    _6.trys.push([30, 32, , 33]);
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, scriptureSlots[i], sequence, songStore.songs, localService.value.sermonPassage)];
                case 31:
                    _6.sent();
                    sequence++;
                    return [3 /*break*/, 33];
                case 32:
                    _l = _6.sent();
                    failures.push('Scripture');
                    return [3 /*break*/, 33];
                case 33:
                    i++;
                    return [3 /*break*/, 29];
                case 34: return [3 /*break*/, 71];
                case 35:
                    templateId = exportSelectedTemplateId.value || undefined;
                    baseTitle = (0, planningCenterApi_1.buildPlanTitle)(localService.value);
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlan)(appId, secret, serviceTypeId, baseTitle)
                        // Add plan times (service date determines sort_date)
                        // PC treats times as UTC, so convert local times to UTC ISO strings
                    ];
                case 36:
                    planId = _6.sent();
                    if (!localService.value.date) return [3 /*break*/, 40];
                    serviceDate = localService.value.date // YYYY-MM-DD
                    ;
                    toUtc = function (dateStr, hours, minutes) {
                        return new Date(new Date(dateStr + 'T00:00:00').setHours(hours, minutes, 0, 0));
                    };
                    wed = new Date(serviceDate + 'T00:00:00');
                    wed.setDate(wed.getDate() - ((wed.getDay() + 4) % 7));
                    wedStr = "".concat(wed.getFullYear(), "-").concat(String(wed.getMonth() + 1).padStart(2, '0'), "-").concat(String(wed.getDate()).padStart(2, '0'));
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlanTime)(appId, secret, serviceTypeId, planId, {
                            startsAt: toUtc(wedStr, 18, 30).toISOString(),
                            endsAt: toUtc(wedStr, 20, 30).toISOString(),
                            timeType: 'rehearsal',
                            name: 'Wednesday Rehearsal',
                        }).catch(function () { })];
                case 37:
                    _6.sent();
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlanTime)(appId, secret, serviceTypeId, planId, {
                            startsAt: toUtc(serviceDate, 8, 15).toISOString(),
                            endsAt: toUtc(serviceDate, 10, 15).toISOString(),
                            timeType: 'rehearsal',
                            name: 'Sunday Rehearsal',
                        }).catch(function () { })];
                case 38:
                    _6.sent();
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlanTime)(appId, secret, serviceTypeId, planId, {
                            startsAt: toUtc(serviceDate, 10, 30).toISOString(),
                            endsAt: toUtc(serviceDate, 12, 0).toISOString(),
                            timeType: 'service',
                        }).catch(function () { })];
                case 39:
                    _6.sent();
                    _6.label = 40;
                case 40:
                    sequence = 1;
                    songIndex = 0;
                    scriptureIndex = 0;
                    if (!templateId) return [3 /*break*/, 65];
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTemplateItems)(appId, secret, serviceTypeId, templateId)];
                case 41:
                    templateItems = _6.sent();
                    templateItems.sort(function (a, b) { return a.sequence - b.sequence; });
                    _m = 0, templateItems_1 = templateItems;
                    _6.label = 42;
                case 42:
                    if (!(_m < templateItems_1.length)) return [3 /*break*/, 52];
                    tItem = templateItems_1[_m];
                    titleLower = tItem.title.toLowerCase();
                    isSongItem = titleLower.includes('worship song');
                    isScriptureItem = titleLower.startsWith('scripture - ') || titleLower.includes('scripture reading');
                    _6.label = 43;
                case 43:
                    _6.trys.push([43, 50, , 51]);
                    if (!(isSongItem && songIndex < songSlots.length)) return [3 /*break*/, 45];
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, songSlots[songIndex], sequence, songStore.songs, localService.value.sermonPassage, tItem.length)];
                case 44:
                    _6.sent();
                    songIndex++;
                    return [3 /*break*/, 49];
                case 45:
                    if (!(isScriptureItem && scriptureIndex < scriptureSlots.length)) return [3 /*break*/, 47];
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, scriptureSlots[scriptureIndex], sequence, songStore.songs, localService.value.sermonPassage, tItem.length)];
                case 46:
                    _6.sent();
                    scriptureIndex++;
                    return [3 /*break*/, 49];
                case 47:
                    if (!(!isSongItem && !isScriptureItem)) return [3 /*break*/, 49];
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)(appId, secret, serviceTypeId, planId, {
                            title: tItem.title,
                            itemType: tItem.itemType === 'header' ? 'header' : 'regular',
                            description: tItem.description,
                            sequence: sequence,
                            length: tItem.length,
                        })];
                case 48:
                    _6.sent();
                    _6.label = 49;
                case 49:
                    sequence++;
                    return [3 /*break*/, 51];
                case 50:
                    e_2 = _6.sent();
                    failures.push(tItem.title);
                    return [3 /*break*/, 51];
                case 51:
                    _m++;
                    return [3 /*break*/, 42];
                case 52:
                    i = songIndex;
                    _6.label = 53;
                case 53:
                    if (!(i < songSlots.length)) return [3 /*break*/, 58];
                    _6.label = 54;
                case 54:
                    _6.trys.push([54, 56, , 57]);
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, songSlots[i], sequence, songStore.songs, localService.value.sermonPassage)];
                case 55:
                    _6.sent();
                    sequence++;
                    return [3 /*break*/, 57];
                case 56:
                    _o = _6.sent();
                    slot = songSlots[i];
                    failures.push(slot.kind === 'SONG' ? ((_2 = slot.songTitle) !== null && _2 !== void 0 ? _2 : 'Song') : ((_3 = slot.hymnName) !== null && _3 !== void 0 ? _3 : 'Hymn'));
                    return [3 /*break*/, 57];
                case 57:
                    i++;
                    return [3 /*break*/, 53];
                case 58:
                    i = scriptureIndex;
                    _6.label = 59;
                case 59:
                    if (!(i < scriptureSlots.length)) return [3 /*break*/, 64];
                    _6.label = 60;
                case 60:
                    _6.trys.push([60, 62, , 63]);
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, scriptureSlots[i], sequence, songStore.songs, localService.value.sermonPassage)];
                case 61:
                    _6.sent();
                    sequence++;
                    return [3 /*break*/, 63];
                case 62:
                    _p = _6.sent();
                    failures.push('Scripture');
                    return [3 /*break*/, 63];
                case 63:
                    i++;
                    return [3 /*break*/, 59];
                case 64: return [3 /*break*/, 71];
                case 65:
                    _q = 0, _r = localService.value.slots;
                    _6.label = 66;
                case 66:
                    if (!(_q < _r.length)) return [3 /*break*/, 71];
                    slot = _r[_q];
                    _6.label = 67;
                case 67:
                    _6.trys.push([67, 69, , 70]);
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, localService.value.sermonPassage)];
                case 68:
                    _6.sent();
                    sequence++;
                    return [3 /*break*/, 70];
                case 69:
                    _s = _6.sent();
                    label = slot.kind === 'SONG' ? (_4 = slot.songTitle) !== null && _4 !== void 0 ? _4 : 'Song'
                        : slot.kind === 'HYMN' ? (_5 = slot.hymnName) !== null && _5 !== void 0 ? _5 : 'Hymn'
                            : slot.kind === 'SCRIPTURE' ? 'Scripture'
                                : slot.kind;
                    failures.push(label);
                    return [3 /*break*/, 70];
                case 70:
                    _q++;
                    return [3 /*break*/, 66];
                case 71:
                    if (!(selectedPcTeamIds.value.length > 0)) return [3 /*break*/, 83];
                    alreadyPresentTeamIds = new Set();
                    if (!(exportMode.value === 'existing')) return [3 /*break*/, 73];
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanNeededPositionTeamIds)(appId, secret, serviceTypeId, planId)];
                case 72:
                    alreadyPresentTeamIds = _6.sent();
                    _6.label = 73;
                case 73:
                    _t = 0, _u = selectedPcTeamIds.value;
                    _6.label = 74;
                case 74:
                    if (!(_t < _u.length)) return [3 /*break*/, 83];
                    teamId = _u[_t];
                    if (alreadyPresentTeamIds.has(teamId))
                        return [3 /*break*/, 82];
                    _6.label = 75;
                case 75:
                    _6.trys.push([75, 81, , 82]);
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTeamPositions)(appId, secret, teamId)];
                case 76:
                    positions = _6.sent();
                    _v = 0, positions_1 = positions;
                    _6.label = 77;
                case 77:
                    if (!(_v < positions_1.length)) return [3 /*break*/, 80];
                    position = positions_1[_v];
                    return [4 /*yield*/, (0, planningCenterApi_1.addNeededPosition)(appId, secret, serviceTypeId, planId, teamId, position.id)];
                case 78:
                    _6.sent();
                    _6.label = 79;
                case 79:
                    _v++;
                    return [3 /*break*/, 77];
                case 80: return [3 /*break*/, 82];
                case 81:
                    err_1 = _6.sent();
                    console.error("[PC export] addNeededPosition failed for team ".concat(teamId, ":"), err_1);
                    return [3 /*break*/, 82];
                case 82:
                    _t++;
                    return [3 /*break*/, 74];
                case 83: 
                // Mark service as exported in Firestore
                return [4 /*yield*/, serviceStore.updateService(localService.value.id, {
                        pcExportedAt: (0, firestore_1.serverTimestamp)(),
                        pcPlanId: planId,
                        status: 'exported',
                    })];
                case 84:
                    // Mark service as exported in Firestore
                    _6.sent();
                    localService.value.pcExportedAt = new Date();
                    localService.value.pcPlanId = planId;
                    localService.value.status = 'exported';
                    showExportDialog.value = false;
                    if (failures.length > 0) {
                        exportError.value = "Plan ".concat(exportMode.value === 'existing' ? 'updated' : 'created', " but ").concat(failures.length, " item(s) failed: ").concat(failures.join(', '));
                    }
                    else {
                        pcExported.value = true;
                        setTimeout(function () { pcExported.value = false; }, 3000);
                    }
                    return [3 /*break*/, 87];
                case 85:
                    e_3 = _6.sent();
                    exportError.value = e_3 instanceof Error ? e_3.message : 'Export failed';
                    return [3 /*break*/, 87];
                case 86:
                    isExporting.value = false;
                    return [7 /*endfinally*/];
                case 87: return [2 /*return*/];
            }
        });
    });
}
function onShare() {
    return __awaiter(this, void 0, void 0, function () {
        var token, url, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!localService.value || !serviceStore.orgId)
                        return [2 /*return*/];
                    isSharing.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, serviceStore.createShareToken(localService.value, serviceStore.orgId)];
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
                    err_2 = _a.sent();
                    console.error('Share failed:', err_2);
                    shareError.value = 'Failed to create share link';
                    setTimeout(function () {
                        shareError.value = null;
                    }, 3000);
                    return [3 /*break*/, 6];
                case 5:
                    isSharing.value = false;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ── Delete ─────────────────────────────────────────────────────────────────────
function onDelete() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!localService.value)
                        return [2 /*return*/];
                    isDeleting.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, serviceStore.deleteService(serviceId.value)];
                case 2:
                    _a.sent();
                    router.push('/services');
                    return [3 /*break*/, 4];
                case 3:
                    isDeleting.value = false;
                    showDeleteConfirm.value = false;
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Save ───────────────────────────────────────────────────────────────────────
function onSave() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, id, createdAt, updatedAt, data, original, newSongIds, oldSongIds, _loop_4, _i, newSongIds_1, songId;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!localService.value || !isDirty.value)
                        return [2 /*return*/];
                    isSaving.value = true;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, , 7, 8]);
                    _a = localService.value, id = _a.id, createdAt = _a.createdAt, updatedAt = _a.updatedAt, data = __rest(_a, ["id", "createdAt", "updatedAt"]);
                    if (!originalService.value) return [3 /*break*/, 5];
                    original = originalService.value;
                    newSongIds = new Set(localService.value.slots
                        .filter(function (s) { return s.kind === 'SONG' && s.songId; })
                        .map(function (s) { return s.songId; }));
                    oldSongIds = new Set(original.slots
                        .filter(function (s) { return s.kind === 'SONG' && s.songId; })
                        .map(function (s) { return s.songId; }));
                    _loop_4 = function (songId) {
                        var songSlot;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    if (!!oldSongIds.has(songId)) return [3 /*break*/, 2];
                                    songSlot = localService.value.slots.find(function (s) { return s.kind === 'SONG' && s.songId === songId; });
                                    return [4 /*yield*/, serviceStore.assignSongToSlot(id, localService.value.slots.indexOf(songSlot), {
                                            id: songId,
                                            title: songSlot.songTitle,
                                            key: songSlot.songKey,
                                        })];
                                case 1:
                                    _d.sent();
                                    _d.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, newSongIds_1 = newSongIds;
                    _c.label = 2;
                case 2:
                    if (!(_i < newSongIds_1.length)) return [3 /*break*/, 5];
                    songId = newSongIds_1[_i];
                    return [5 /*yield**/, _loop_4(songId)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: 
                // Persist the full slot array (reindexed) and other fields
                return [4 /*yield*/, serviceStore.updateService(id, {
                        name: data.name,
                        teams: data.teams,
                        sermonPassage: data.sermonPassage,
                        sermonTopic: (_b = data.sermonTopic) !== null && _b !== void 0 ? _b : '',
                        notes: data.notes,
                        status: data.status,
                        slots: (0, slotTypes_1.reindexSlots)(data.slots),
                    })
                    // Mark current local state as clean (don't overwrite localService — user may still be typing)
                ];
                case 6:
                    // Persist the full slot array (reindexed) and other fields
                    _c.sent();
                    // Mark current local state as clean (don't overwrite localService — user may still be typing)
                    originalService.value = JSON.parse(JSON.stringify(localService.value));
                    return [3 /*break*/, 8];
                case 7:
                    isSaving.value = false;
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// ── Undo (restore previous autosave snapshot) ───────────────────────────────────
function onUndo() {
    if (!previousService.value)
        return;
    // Restore previous snapshot — this will trigger another autosave after 0.5s
    localService.value = JSON.parse(JSON.stringify(previousService.value));
    previousService.value = null;
    autosaveStatus.value = 'idle';
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
    }
}
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-4" }));
if (__VLS_ctx.serviceStore.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "animate-pulse space-y-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 bg-gray-800 rounded w-64" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-4 bg-gray-800 rounded w-48" }));
    for (var _i = 0, _y = __VLS_getVForSourceType((9)); _i < _y.length; _i++) {
        var i = _y[_i][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (i) }, { class: "h-20 bg-gray-800 rounded" }));
    }
}
else if (!__VLS_ctx.localService) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center py-16" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-400 text-lg mb-4" }));
    var __VLS_3 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    var __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3(__assign({ to: "/services" }, { class: "text-indigo-400 hover:text-indigo-300 text-sm transition-colors" })));
    var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([__assign({ to: "/services" }, { class: "text-indigo-400 hover:text-indigo-300 text-sm transition-colors" })], __VLS_functionalComponentArgsRest(__VLS_4), false));
    __VLS_6.slots.default;
    var __VLS_6;
}
else {
    var __VLS_7 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    var __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7(__assign({ to: "/services" }, { class: "inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3" })));
    var __VLS_9 = __VLS_8.apply(void 0, __spreadArray([__assign({ to: "/services" }, { class: "inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3" })], __VLS_functionalComponentArgsRest(__VLS_8), false));
    __VLS_10.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M15 19l-7-7 7-7",
    });
    var __VLS_10;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3" }));
    if (!__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-semibold text-gray-100" }));
        (__VLS_ctx.formattedDate);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!!(!__VLS_ctx.authStore.isEditor))
                    return;
                __VLS_ctx.$refs.dateInput.showPicker();
            } }, { type: "button" }), { class: "text-xl font-semibold text-gray-100 hover:text-indigo-300 transition-colors cursor-pointer" }));
        (__VLS_ctx.formattedDate);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!!(!__VLS_ctx.authStore.isEditor))
                    return;
                __VLS_ctx.onDateChange($event.target.value);
            } }, { ref: "dateInput", type: "date", value: (__VLS_ctx.localService.date) }), { class: "absolute inset-0 opacity-0 w-0 h-0 pointer-events-none" }));
        /** @type {typeof __VLS_ctx.dateInput} */ ;
    }
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.toggleStatus) }, { type: "button" }), { class: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity" }), { class: (__VLS_ctx.statusBadgeClasses[__VLS_ctx.localService.status]) }));
        if (__VLS_ctx.localService.status === 'planned') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor" }, { class: "h-3 w-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'fill-rule': "evenodd",
                d: "M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z",
                'clip-rule': "evenodd",
            });
        }
        else if (__VLS_ctx.localService.status === 'exported') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor" }, { class: "h-3 w-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'fill-rule': "evenodd",
                d: "M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z",
                'clip-rule': "evenodd",
            });
        }
        (__VLS_ctx.localService.status === 'exported' ? 'Exported' : __VLS_ctx.localService.status === 'planned' ? 'Planned' : 'Draft');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border" }, { class: (__VLS_ctx.statusBadgeClasses[__VLS_ctx.localService.status]) }));
        (__VLS_ctx.localService.status === 'exported' ? 'Exported' : __VLS_ctx.localService.status === 'planned' ? 'Planned' : 'Draft');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3" }));
    if (__VLS_ctx.authStore.isEditor) {
        if (__VLS_ctx.autosaveStatus === 'pending' || __VLS_ctx.autosaveStatus === 'saving') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400 italic" }));
            (__VLS_ctx.autosaveStatus === 'saving' ? 'Saving...' : 'Saving soon...');
        }
        else if (__VLS_ctx.autosaveStatus === 'saved') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-green-400" }));
        }
        else if (__VLS_ctx.isDirty) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-amber-400" }));
        }
    }
    if (__VLS_ctx.authStore.isEditor && __VLS_ctx.previousService) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onUndo) }, { type: "button", title: "Undo last save (Ctrl+Z)" }), { class: "print:hidden inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
        });
    }
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.suggestAllSongs) }, { type: "button", disabled: (!__VLS_ctx.hasSermonContext || __VLS_ctx.aiSuggestingAll || __VLS_ctx.isExportedLocked), title: (__VLS_ctx.isExportedLocked ? 'Service is exported — cycle badge back to Draft to edit' : !__VLS_ctx.hasSermonContext ? 'Add a sermon topic or passage for AI suggestions' : undefined) }), { class: "print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-indigo-400" }), { viewBox: "0 0 24 24", fill: "currentColor" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            d: "M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z",
        });
        (__VLS_ctx.aiSuggestingAll ? 'Suggesting...' : 'Suggest All Songs');
    }
    if (__VLS_ctx.authStore.hasPcCredentials) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onExportToPC) }, { type: "button", 'data-testid': "export-pc-btn", disabled: (__VLS_ctx.isExporting || __VLS_ctx.localService.status !== 'planned'), title: (__VLS_ctx.localService.status === 'draft' ? 'Mark service as Planned to export' : __VLS_ctx.localService.status === 'exported' ? 'Already exported to Planning Center' : undefined) }), { class: "print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border" }), { class: (__VLS_ctx.localService.status === 'exported'
                ? 'text-gray-500 bg-gray-800/50 border-gray-700 cursor-not-allowed'
                : __VLS_ctx.localService.status !== 'planned'
                    ? 'text-gray-500 bg-gray-800/50 border-gray-700 cursor-not-allowed'
                    : __VLS_ctx.isExporting
                        ? 'text-gray-400 bg-gray-800 border-gray-700 cursor-wait'
                        : 'text-gray-200 bg-gray-800 hover:bg-gray-700 border-gray-700') }));
        if (__VLS_ctx.isExporting) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "animate-spin h-4 w-4" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" }));
        }
        else if (__VLS_ctx.localService.status === 'exported') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-green-500" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M5 13l4 4L19 7",
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
            });
        }
        (__VLS_ctx.isExporting ? 'Exporting...' : __VLS_ctx.localService.status === 'exported' ? 'Exported' : 'Export to PC');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onCopyForPC) }, { type: "button", 'data-testid': "copy-pc-btn", disabled: (!__VLS_ctx.localService) }), { class: "print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
        if (!__VLS_ctx.pcCopied) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-green-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M5 13l4 4L19 7",
            });
        }
        (__VLS_ctx.pcCopied ? 'Copied!' : 'Copy for PC');
    }
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onSave) }, { type: "button", disabled: (!__VLS_ctx.isDirty || __VLS_ctx.isSaving) }), { class: "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors" }), { class: (__VLS_ctx.isDirty && !__VLS_ctx.isSaving
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-indigo-600/40 cursor-not-allowed text-white/50') }));
        (__VLS_ctx.isSaving ? 'Saving...' : 'Save');
    }
    var __VLS_11 = {}.Teleport;
    /** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
    // @ts-ignore
    var __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
        to: "body",
    }));
    var __VLS_13 = __VLS_12.apply(void 0, __spreadArray([{
            to: "body",
        }], __VLS_functionalComponentArgsRest(__VLS_12), false));
    __VLS_14.slots.default;
    if (__VLS_ctx.showDeleteConfirm) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-0 z-50 flex items-center justify-center bg-black/60" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100 mb-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mb-6" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-200" }));
        (__VLS_ctx.formattedDate);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex justify-end gap-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!(__VLS_ctx.showDeleteConfirm))
                    return;
                __VLS_ctx.showDeleteConfirm = false;
            } }, { type: "button", disabled: (__VLS_ctx.isDeleting) }), { class: "rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onDelete) }, { type: "button", disabled: (__VLS_ctx.isDeleting) }), { class: "rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors disabled:opacity-50" }));
        (__VLS_ctx.isDeleting ? 'Deleting...' : 'Delete');
    }
    var __VLS_14;
    var __VLS_15 = {}.Teleport;
    /** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
    // @ts-ignore
    var __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        to: "body",
    }));
    var __VLS_17 = __VLS_16.apply(void 0, __spreadArray([{
            to: "body",
        }], __VLS_functionalComponentArgsRest(__VLS_16), false));
    __VLS_18.slots.default;
    if (__VLS_ctx.showSlotDeleteConfirm) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-0 z-50 flex items-center justify-center bg-black/60" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100 mb-2" }));
        (__VLS_ctx.deleteConfirmHeading);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mb-6" }));
        (__VLS_ctx.deleteConfirmBody);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex justify-end gap-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!(__VLS_ctx.showSlotDeleteConfirm))
                    return;
                __VLS_ctx.showSlotDeleteConfirm = false;
                __VLS_ctx.pendingDeleteIndex = null;
                __VLS_ctx.pendingDeleteIsClear = false;
            } }, { type: "button" }), { class: "rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.confirmSlotDelete) }, { type: "button" }), { class: "rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors" }));
    }
    var __VLS_18;
    var __VLS_19 = {}.Teleport;
    /** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
    // @ts-ignore
    var __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
        to: "body",
    }));
    var __VLS_21 = __VLS_20.apply(void 0, __spreadArray([{
            to: "body",
        }], __VLS_functionalComponentArgsRest(__VLS_20), false));
    __VLS_22.slots.default;
    if (__VLS_ctx.showExportDialog) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed inset-0 z-50 flex items-center justify-center bg-black/60" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100 mb-4" }));
        if (__VLS_ctx.exportLoading) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-gray-400 py-4 text-center" }));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign(__assign({ onChange: (__VLS_ctx.onServiceTypeChange) }, { value: (__VLS_ctx.exportSelectedServiceTypeId) }), { class: "w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
            for (var _z = 0, _0 = __VLS_getVForSourceType((__VLS_ctx.exportServiceTypes)); _z < _0.length; _z++) {
                var st = _0[_z][0];
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (st.id),
                    value: (st.id),
                });
                (st.name);
            }
            if (__VLS_ctx.existingPlan) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3 rounded-md bg-amber-900/20 border border-amber-800 px-3 py-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-amber-300 mb-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-medium text-amber-200" }));
                (__VLS_ctx.existingPlan.dates);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex gap-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(__VLS_ctx.showExportDialog))
                            return;
                        if (!!(__VLS_ctx.exportLoading))
                            return;
                        if (!(__VLS_ctx.existingPlan))
                            return;
                        __VLS_ctx.exportMode = 'existing';
                    } }, { type: "button" }), { class: "px-3 py-1 rounded text-xs font-medium transition-colors" }), { class: (__VLS_ctx.exportMode === 'existing'
                        ? 'bg-amber-700 text-amber-100 border border-amber-600'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600') }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(__VLS_ctx.showExportDialog))
                            return;
                        if (!!(__VLS_ctx.exportLoading))
                            return;
                        if (!(__VLS_ctx.existingPlan))
                            return;
                        __VLS_ctx.exportMode = 'new';
                    } }, { type: "button" }), { class: "px-3 py-1 rounded text-xs font-medium transition-colors" }), { class: (__VLS_ctx.exportMode === 'new'
                        ? 'bg-indigo-700 text-indigo-100 border border-indigo-600'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600') }));
            }
            if (__VLS_ctx.exportMode === 'new') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ value: (__VLS_ctx.exportSelectedTemplateId) }, { class: "w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    value: "",
                });
                for (var _1 = 0, _2 = __VLS_getVForSourceType((__VLS_ctx.exportTemplates)); _1 < _2.length; _1++) {
                    var t = _2[_1][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                        key: (t.id),
                        value: (t.id),
                    });
                    (t.name);
                }
            }
            if (__VLS_ctx.pcTeams.length > 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-1" }));
                for (var _3 = 0, _4 = __VLS_getVForSourceType((__VLS_ctx.pcTeams)); _3 < _4.length; _3++) {
                    var team = _4[_3][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ key: (team.id) }, { class: "flex items-center gap-2 text-sm text-gray-200 cursor-pointer" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "checkbox", value: (team.id) }, { class: "h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }));
                    (__VLS_ctx.selectedPcTeamIds);
                    (team.name);
                }
            }
            if (__VLS_ctx.exportMode === 'existing') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mb-3" }));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
            (__VLS_ctx.formattedDate);
            if (__VLS_ctx.exportError) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mb-3" }));
                (__VLS_ctx.exportError);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex justify-end gap-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.showExportDialog))
                        return;
                    if (!!(__VLS_ctx.exportLoading))
                        return;
                    __VLS_ctx.showExportDialog = false;
                    __VLS_ctx.exportError = null;
                } }, { type: "button", disabled: (__VLS_ctx.isExporting) }), { class: "rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onConfirmExport) }, { type: "button", disabled: (__VLS_ctx.isExporting || !__VLS_ctx.exportSelectedServiceTypeId) }), { class: "rounded-md px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50" }));
            (__VLS_ctx.isExporting ? 'Exporting...' : __VLS_ctx.exportMode === 'existing' ? 'Add to Plan' : 'Export');
        }
    }
    var __VLS_22;
    if (__VLS_ctx.pcExported) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3 rounded-md bg-green-900/30 border border-green-800 px-4 py-2 text-sm text-green-400 flex items-center gap-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 flex-shrink-0" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M5 13l4 4L19 7",
        });
    }
    if (__VLS_ctx.exportError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3 rounded-md bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-400 flex items-center justify-between gap-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 flex-shrink-0" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.exportError);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!(__VLS_ctx.exportError))
                    return;
                __VLS_ctx.exportError = null;
            } }, { class: "text-red-400 hover:text-red-300" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M6 18L18 6M6 6l12 12",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap" }));
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap items-center gap-4" }));
        var _loop_1 = function (team) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ key: (team) }, { class: "flex items-center gap-2 cursor-pointer" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor))
                        return;
                    __VLS_ctx.toggleTeam(team);
                } }, { type: "checkbox", checked: (__VLS_ctx.localService.teams.includes(team)), disabled: (__VLS_ctx.isExportedLocked) }), { class: "h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 disabled:opacity-50" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-200" }));
            (team);
        };
        for (var _5 = 0, _6 = __VLS_getVForSourceType((__VLS_ctx.AVAILABLE_TEAMS)); _5 < _6.length; _5++) {
            var team = _6[_5][0];
            _loop_1(team);
        }
        if (__VLS_ctx.localService.teams.includes('Special')) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.localService.name), type: "text", placeholder: "e.g. Good Friday, Easter", disabled: (__VLS_ctx.isExportedLocked) }, { class: "rounded-md bg-gray-800 border border-gray-700 text-indigo-300 text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-48 disabled:opacity-50" }));
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap items-center gap-2" }));
        for (var _7 = 0, _8 = __VLS_getVForSourceType((__VLS_ctx.localService.teams)); _7 < _8.length; _7++) {
            var team = _8[_7][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ key: (team) }, { class: "text-sm text-gray-200" }));
            (team);
        }
        if (__VLS_ctx.localService.teams.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-500 italic" }));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-start gap-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap mt-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 space-y-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mb-1" }));
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.localService.sermonTopic), type: "text", placeholder: "e.g. Grace and forgiveness, The prodigal son", disabled: (__VLS_ctx.isExportedLocked) }, { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
        (__VLS_ctx.localService.sermonTopic || '—');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mb-1" }));
    if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
        /** @type {[typeof ScriptureInput, ]} */ ;
        // @ts-ignore
        var __VLS_23 = __VLS_asFunctionalComponent(ScriptureInput_vue_1.default, new ScriptureInput_vue_1.default(__assign({ 'onUpdate:modelValue': {} }, { modelValue: (__VLS_ctx.localService.sermonPassage), sermonPassage: (null), showOverlapWarning: (false), label: "Sermon Passage" })));
        var __VLS_24 = __VLS_23.apply(void 0, __spreadArray([__assign({ 'onUpdate:modelValue': {} }, { modelValue: (__VLS_ctx.localService.sermonPassage), sermonPassage: (null), showOverlapWarning: (false), label: "Sermon Passage" })], __VLS_functionalComponentArgsRest(__VLS_23), false));
        var __VLS_26 = void 0;
        var __VLS_27 = void 0;
        var __VLS_28 = void 0;
        var __VLS_29 = {
            'onUpdate:modelValue': (__VLS_ctx.onSermonPassageChange)
        };
        var __VLS_25;
    }
    else if (__VLS_ctx.authStore.isEditor && __VLS_ctx.isExportedLocked) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
        (__VLS_ctx.localService.sermonPassage
            ? "".concat(__VLS_ctx.localService.sermonPassage.book, " ").concat(__VLS_ctx.localService.sermonPassage.chapter, ":").concat(__VLS_ctx.localService.sermonPassage.verseStart).concat(__VLS_ctx.localService.sermonPassage.verseEnd ? '-' + __VLS_ctx.localService.sermonPassage.verseEnd : '')
            : '—');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
        (__VLS_ctx.localService.sermonPassage
            ? "".concat(__VLS_ctx.localService.sermonPassage.book, " ").concat(__VLS_ctx.localService.sermonPassage.chapter, ":").concat(__VLS_ctx.localService.sermonPassage.verseStart).concat(__VLS_ctx.localService.sermonPassage.verseEnd ? '-' + __VLS_ctx.localService.sermonPassage.verseEnd : '')
            : '—');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ ref: "slotContainerRef" }, { class: "space-y-1.5" }));
    /** @type {typeof __VLS_ctx.slotContainerRef} */ ;
    var _loop_2 = function (slot, index) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (slot.kind + '-' + slot.position) }, { class: "rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2" }));
        if (__VLS_ctx.authStore.isEditor) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0 mt-0.5" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { viewBox: "0 0 20 20", fill: "currentColor" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                d: "M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 min-w-0" }));
        if (slot.kind === 'SONG') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider" }));
            (__VLS_ctx.slotLabel(slot, index));
            if (slot.songId && __VLS_ctx.authStore.vwModeEnabled) {
                /** @type {[typeof SongBadge, ]} */ ;
                // @ts-ignore
                var __VLS_30 = __VLS_asFunctionalComponent(SongBadge_vue_1.default, new SongBadge_vue_1.default({
                    types: ((_b = (_a = __VLS_ctx.songStore.songs.find(function (s) { return s.id === slot.songId; })) === null || _a === void 0 ? void 0 : _a.vwTypes) !== null && _b !== void 0 ? _b : []),
                }));
                var __VLS_31 = __VLS_30.apply(void 0, __spreadArray([{
                        types: ((_d = (_c = __VLS_ctx.songStore.songs.find(function (s) { return s.id === slot.songId; })) === null || _c === void 0 ? void 0 : _c.vwTypes) !== null && _d !== void 0 ? _d : []),
                    }], __VLS_functionalComponentArgsRest(__VLS_30), false));
            }
            if (slot.songId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 min-w-0 flex-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-medium text-gray-100 truncate" }));
                (slot.songTitle);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600 flex-shrink-0" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400 flex-shrink-0" }));
                (slot.songKey || '—');
                if (__VLS_ctx.getCcliNumber(slot.songId)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-700 flex-shrink-0" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign({ onClick: function () { } }, { href: ("https://songselect.ccli.com/songs/".concat(__VLS_ctx.getCcliNumber(slot.songId))), target: "_blank", rel: "noopener" }), { class: "text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex-shrink-0" }));
                    (__VLS_ctx.getCcliNumber(slot.songId));
                }
                if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                            var _a = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                _a[_i] = arguments[_i];
                            }
                            var $event = _a[0];
                            if (!!(__VLS_ctx.serviceStore.isLoading))
                                return;
                            if (!!(!__VLS_ctx.localService))
                                return;
                            if (!(slot.kind === 'SONG'))
                                return;
                            if (!(slot.songId))
                                return;
                            if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                                return;
                            __VLS_ctx.onClearSong(index);
                        } }, { type: "button" }), { class: "text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0" }), { title: "Remove song" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M6 18L18 6M6 6l12 12",
                    });
                }
            }
            if (__VLS_ctx.authStore.isEditor && __VLS_ctx.aiDraftSongs.has(index)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-3 rounded-md bg-indigo-950/50 border border-indigo-800/60 px-3 py-2 mb-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 min-w-0" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-medium text-gray-300" }));
                ((_e = __VLS_ctx.aiDraftSongs.get(index)) === null || _e === void 0 ? void 0 : _e.songTitle);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-indigo-400 mt-0.5" }));
                ((_f = __VLS_ctx.aiDraftSongs.get(index)) === null || _f === void 0 ? void 0 : _f.reason);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1 flex-shrink-0" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(slot.kind === 'SONG'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && __VLS_ctx.aiDraftSongs.has(index)))
                            return;
                        __VLS_ctx.acceptAiSong(index);
                    } }, { type: "button" }), { class: "p-1 rounded text-green-400 hover:text-green-300 hover:bg-green-900/30 transition-colors" }), { title: "Accept AI suggestion" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                    'stroke-linecap': "round",
                    'stroke-linejoin': "round",
                    d: "M5 13l4 4L19 7",
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(slot.kind === 'SONG'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && __VLS_ctx.aiDraftSongs.has(index)))
                            return;
                        __VLS_ctx.rejectAiSong(index);
                    } }, { type: "button" }), { class: "p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors" }), { title: "Reject AI suggestion" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                    'stroke-linecap': "round",
                    'stroke-linejoin': "round",
                    d: "M6 18L18 6M6 6l12 12",
                });
            }
            if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                /** @type {[typeof SongSlotPicker, ]} */ ;
                // @ts-ignore
                var __VLS_33 = __VLS_asFunctionalComponent(SongSlotPicker_vue_1.default, new SongSlotPicker_vue_1.default(__assign(__assign(__assign({ 'onSelect': {} }, { 'onClear': {} }), { 'onRequestAiSuggestions': {} }), { requiredVwType: (slot.requiredVwType), serviceTeams: (__VLS_ctx.localService.teams), currentSongId: (slot.songId), songs: (__VLS_ctx.songStore.songs), aiSuggestions: (__VLS_ctx.aiPerSlotResults.get(index)), aiLoading: ((_g = __VLS_ctx.aiPerSlotLoading.get(index)) !== null && _g !== void 0 ? _g : false), aiError: ((_h = __VLS_ctx.aiPerSlotError.get(index)) !== null && _h !== void 0 ? _h : false), hasSermonContext: (__VLS_ctx.hasSermonContext) })));
                var __VLS_34 = __VLS_33.apply(void 0, __spreadArray([__assign(__assign(__assign({ 'onSelect': {} }, { 'onClear': {} }), { 'onRequestAiSuggestions': {} }), { requiredVwType: (slot.requiredVwType), serviceTeams: (__VLS_ctx.localService.teams), currentSongId: (slot.songId), songs: (__VLS_ctx.songStore.songs), aiSuggestions: (__VLS_ctx.aiPerSlotResults.get(index)), aiLoading: ((_j = __VLS_ctx.aiPerSlotLoading.get(index)) !== null && _j !== void 0 ? _j : false), aiError: ((_k = __VLS_ctx.aiPerSlotError.get(index)) !== null && _k !== void 0 ? _k : false), hasSermonContext: (__VLS_ctx.hasSermonContext) })], __VLS_functionalComponentArgsRest(__VLS_33), false));
                var __VLS_36 = void 0;
                var __VLS_37 = void 0;
                var __VLS_38 = void 0;
                var __VLS_39 = {
                    onSelect: (function (song) { return __VLS_ctx.onSelectSong(index, song); })
                };
                var __VLS_40 = {
                    onClear: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(slot.kind === 'SONG'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        __VLS_ctx.onClearSong(index);
                    }
                };
                var __VLS_41 = {
                    onRequestAiSuggestions: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!(slot.kind === 'SONG'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        __VLS_ctx.fetchAiForSlot(index);
                    }
                };
            }
            else if (!slot.songId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500 italic" }));
            }
        }
        else if (slot.kind === 'SCRIPTURE') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-4" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1" }));
            if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                /** @type {[typeof ScriptureInput, ]} */ ;
                // @ts-ignore
                var __VLS_42 = __VLS_asFunctionalComponent(ScriptureInput_vue_1.default, new ScriptureInput_vue_1.default(__assign({ 'onUpdate:modelValue': {} }, { modelValue: (__VLS_ctx.slotToScriptureRef(slot)), sermonPassage: (__VLS_ctx.localService.sermonPassage), showOverlapWarning: (true), showAiSuggest: (true), sermonTopic: ((_l = __VLS_ctx.localService.sermonTopic) !== null && _l !== void 0 ? _l : ''), recentScriptures: (__VLS_ctx.recentScriptureRefs), label: "Scripture Reading" })));
                var __VLS_43 = __VLS_42.apply(void 0, __spreadArray([__assign({ 'onUpdate:modelValue': {} }, { modelValue: (__VLS_ctx.slotToScriptureRef(slot)), sermonPassage: (__VLS_ctx.localService.sermonPassage), showOverlapWarning: (true), showAiSuggest: (true), sermonTopic: ((_m = __VLS_ctx.localService.sermonTopic) !== null && _m !== void 0 ? _m : ''), recentScriptures: (__VLS_ctx.recentScriptureRefs), label: "Scripture Reading" })], __VLS_functionalComponentArgsRest(__VLS_42), false));
                var __VLS_45 = void 0;
                var __VLS_46 = void 0;
                var __VLS_47 = void 0;
                var __VLS_48 = {
                    'onUpdate:modelValue': (function (ref) { return __VLS_ctx.onScriptureChange(index, ref); })
                };
            }
            else if (__VLS_ctx.authStore.isEditor && __VLS_ctx.isExportedLocked) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
                (__VLS_ctx.slotToScriptureRef(slot)
                    ? "".concat((_o = __VLS_ctx.slotToScriptureRef(slot)) === null || _o === void 0 ? void 0 : _o.book, " ").concat((_p = __VLS_ctx.slotToScriptureRef(slot)) === null || _p === void 0 ? void 0 : _p.chapter, ":").concat((_q = __VLS_ctx.slotToScriptureRef(slot)) === null || _q === void 0 ? void 0 : _q.verseStart).concat(((_r = __VLS_ctx.slotToScriptureRef(slot)) === null || _r === void 0 ? void 0 : _r.verseEnd) ? '-' + ((_s = __VLS_ctx.slotToScriptureRef(slot)) === null || _s === void 0 ? void 0 : _s.verseEnd) : '')
                    : 'Scripture — Empty');
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
                (__VLS_ctx.slotToScriptureRef(slot)
                    ? "".concat((_t = __VLS_ctx.slotToScriptureRef(slot)) === null || _t === void 0 ? void 0 : _t.book, " ").concat((_u = __VLS_ctx.slotToScriptureRef(slot)) === null || _u === void 0 ? void 0 : _u.chapter, ":").concat((_v = __VLS_ctx.slotToScriptureRef(slot)) === null || _v === void 0 ? void 0 : _v.verseStart).concat(((_w = __VLS_ctx.slotToScriptureRef(slot)) === null || _w === void 0 ? void 0 : _w.verseEnd) ? '-' + ((_x = __VLS_ctx.slotToScriptureRef(slot)) === null || _x === void 0 ? void 0 : _x.verseEnd) : '')
                    : 'Scripture — Empty');
            }
        }
        else if (slot.kind === 'PRAYER') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-600 italic" }));
            if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mt-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!(slot.kind === 'PRAYER'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.linkLabel = $event.target.value;
                    } }, { value: (slot.linkLabel), type: "text", placeholder: "Link label (optional)" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!(slot.kind === 'PRAYER'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.linkUrl = $event.target.value;
                    } }, { value: (slot.linkUrl), type: "url", placeholder: "https://..." }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1" }));
                if (slot.linkUrl) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign(__assign({ onClick: function () { } }, { href: (slot.linkUrl), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0" }), { title: "Open link" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
                    });
                }
            }
            else if (slot.linkUrl) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mt-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign({ href: (slot.linkUrl), target: "_blank", rel: "noopener" }, { class: "text-xs text-indigo-400 hover:text-indigo-300 transition-colors" }));
                (slot.linkLabel || slot.linkUrl);
            }
        }
        else if (slot.kind === 'MESSAGE') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-600 italic" }));
            if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mt-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!!(slot.kind === 'PRAYER'))
                            return;
                        if (!(slot.kind === 'MESSAGE'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.linkLabel = $event.target.value;
                    } }, { value: (slot.linkLabel), type: "text", placeholder: "Link label (optional)" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!!(slot.kind === 'PRAYER'))
                            return;
                        if (!(slot.kind === 'MESSAGE'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.linkUrl = $event.target.value;
                    } }, { value: (slot.linkUrl), type: "url", placeholder: "https://..." }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1" }));
                if (slot.linkUrl) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign(__assign({ onClick: function () { } }, { href: (slot.linkUrl), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0" }), { title: "Open link" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
                    });
                }
            }
            else if (slot.linkUrl) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mt-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign({ href: (slot.linkUrl), target: "_blank", rel: "noopener" }, { class: "text-xs text-indigo-400 hover:text-indigo-300 transition-colors" }));
                (slot.linkLabel || slot.linkUrl);
            }
        }
        else if (slot.kind === 'HYMN') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-gray-400 uppercase tracking-wider" }));
            if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap items-center gap-2 mt-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!!(slot.kind === 'PRAYER'))
                            return;
                        if (!!(slot.kind === 'MESSAGE'))
                            return;
                        if (!(slot.kind === 'HYMN'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.hymnName = $event.target.value;
                    } }, { value: (slot.hymnName), type: "text", placeholder: "Hymn Name" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1 min-w-32" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!!(slot.kind === 'PRAYER'))
                            return;
                        if (!!(slot.kind === 'MESSAGE'))
                            return;
                        if (!(slot.kind === 'HYMN'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.hymnNumber = $event.target.value;
                    } }, { value: (slot.hymnNumber), type: "text", placeholder: "# (e.g. 337)" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-24" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onInput: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!!(!__VLS_ctx.localService))
                            return;
                        if (!!(slot.kind === 'SONG'))
                            return;
                        if (!!(slot.kind === 'SCRIPTURE'))
                            return;
                        if (!!(slot.kind === 'PRAYER'))
                            return;
                        if (!!(slot.kind === 'MESSAGE'))
                            return;
                        if (!(slot.kind === 'HYMN'))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                            return;
                        slot.verses = $event.target.value;
                    } }, { value: (slot.verses), type: "text", placeholder: "Verses (e.g. 1, 3, 4)" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36" }));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-1" }));
                if (slot.hymnName) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-200" }));
                    (slot.hymnName);
                    if (slot.hymnNumber) {
                        (slot.hymnNumber);
                    }
                    if (slot.verses) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400" }));
                        (slot.verses);
                    }
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 italic" }));
                }
            }
        }
        if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    __VLS_ctx.removeSlot(index);
                } }, { type: "button" }), { class: "text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5" }), { title: "Remove element" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M6 18L18 6M6 6l12 12",
            });
        }
    };
    var __VLS_35, __VLS_44;
    for (var _9 = 0, _10 = __VLS_getVForSourceType((__VLS_ctx.localService.slots)); _9 < _10.length; _9++) {
        var _11 = _10[_9], slot = _11[0], index = _11[1];
        _loop_2(slot, index);
    }
    if (__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-2 relative" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                    return;
                __VLS_ctx.showAddMenu = !__VLS_ctx.showAddMenu;
            } }, { type: "button" }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 transition-colors border border-gray-700 border-dashed" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M12 4v16m8-8H4",
        });
        if (__VLS_ctx.showAddMenu) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.showAddMenu = false;
                } }, { class: "fixed inset-0 z-10" }));
        }
        if (__VLS_ctx.showAddMenu) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute left-0 bottom-full mb-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.addSlot('SONG', 2);
                } }, { type: "button" }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.addSlot('SCRIPTURE');
                } }, { type: "button" }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.addSlot('PRAYER');
                } }, { type: "button" }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.addSlot('MESSAGE');
                } }, { type: "button" }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!!(!__VLS_ctx.localService))
                        return;
                    if (!(__VLS_ctx.authStore.isEditor && !__VLS_ctx.isExportedLocked))
                        return;
                    if (!(__VLS_ctx.showAddMenu))
                        return;
                    __VLS_ctx.addSlot('HYMN');
                } }, { type: "button" }), { class: "px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors" }));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center gap-2 print:hidden" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onPrint) }, { type: "button", 'data-testid': "print-btn", disabled: (!__VLS_ctx.localService) }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onShare) }, { type: "button", disabled: (!__VLS_ctx.localService || __VLS_ctx.isSharing) }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
    if (!__VLS_ctx.shareCopied) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-green-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M5 13l4 4L19 7",
        });
    }
    (__VLS_ctx.isSharing ? 'Sharing...' : __VLS_ctx.shareCopied ? 'Link Copied!' : __VLS_ctx.shareError ? __VLS_ctx.shareError : 'Share');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)(__assign({ class: "flex-1" }));
    if (__VLS_ctx.authStore.isEditor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.serviceStore.isLoading))
                    return;
                if (!!(!__VLS_ctx.localService))
                    return;
                if (!(__VLS_ctx.authStore.isEditor))
                    return;
                __VLS_ctx.showDeleteConfirm = true;
            } }, { type: "button" }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-400 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
        });
    }
}
var __VLS_2;
if (__VLS_ctx.localService) {
    /** @type {[typeof ServicePrintLayout, ]} */ ;
    // @ts-ignore
    var __VLS_49 = __VLS_asFunctionalComponent(ServicePrintLayout_vue_1.default, new ServicePrintLayout_vue_1.default({
        service: (__VLS_ctx.localService),
        songs: (__VLS_ctx.songStore.songs),
    }));
    var __VLS_50 = __VLS_49.apply(void 0, __spreadArray([{
            service: (__VLS_ctx.localService),
            songs: (__VLS_ctx.songStore.songs),
        }], __VLS_functionalComponentArgsRest(__VLS_49), false));
}
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['h-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
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
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
/** @type {__VLS_StyleScopedClasses['active:cursor-grabbing']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-950/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-800/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-green-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-36']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-36']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-32']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-36']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-44']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['print:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            slotLabel: slotTypes_1.slotLabel,
            AppShell: AppShell_vue_1.default,
            SongBadge: SongBadge_vue_1.default,
            SongSlotPicker: SongSlotPicker_vue_1.default,
            ScriptureInput: ScriptureInput_vue_1.default,
            ServicePrintLayout: ServicePrintLayout_vue_1.default,
            authStore: authStore,
            serviceStore: serviceStore,
            songStore: songStore,
            AVAILABLE_TEAMS: AVAILABLE_TEAMS,
            statusBadgeClasses: statusBadgeClasses,
            localService: localService,
            isSaving: isSaving,
            pcCopied: pcCopied,
            previousService: previousService,
            autosaveStatus: autosaveStatus,
            isSharing: isSharing,
            shareCopied: shareCopied,
            shareError: shareError,
            showAddMenu: showAddMenu,
            showDeleteConfirm: showDeleteConfirm,
            isDeleting: isDeleting,
            showSlotDeleteConfirm: showSlotDeleteConfirm,
            pendingDeleteIndex: pendingDeleteIndex,
            pendingDeleteIsClear: pendingDeleteIsClear,
            deleteConfirmHeading: deleteConfirmHeading,
            deleteConfirmBody: deleteConfirmBody,
            isExporting: isExporting,
            pcExported: pcExported,
            exportError: exportError,
            showExportDialog: showExportDialog,
            exportServiceTypes: exportServiceTypes,
            exportTemplates: exportTemplates,
            exportSelectedServiceTypeId: exportSelectedServiceTypeId,
            exportSelectedTemplateId: exportSelectedTemplateId,
            exportLoading: exportLoading,
            existingPlan: existingPlan,
            exportMode: exportMode,
            pcTeams: pcTeams,
            selectedPcTeamIds: selectedPcTeamIds,
            isExportedLocked: isExportedLocked,
            aiDraftSongs: aiDraftSongs,
            aiSuggestingAll: aiSuggestingAll,
            aiPerSlotLoading: aiPerSlotLoading,
            aiPerSlotResults: aiPerSlotResults,
            aiPerSlotError: aiPerSlotError,
            slotContainerRef: slotContainerRef,
            formattedDate: formattedDate,
            onDateChange: onDateChange,
            isDirty: isDirty,
            hasSermonContext: hasSermonContext,
            recentScriptureRefs: recentScriptureRefs,
            getCcliNumber: getCcliNumber,
            toggleStatus: toggleStatus,
            toggleTeam: toggleTeam,
            addSlot: addSlot,
            removeSlot: removeSlot,
            confirmSlotDelete: confirmSlotDelete,
            onSelectSong: onSelectSong,
            onClearSong: onClearSong,
            suggestAllSongs: suggestAllSongs,
            fetchAiForSlot: fetchAiForSlot,
            acceptAiSong: acceptAiSong,
            rejectAiSong: rejectAiSong,
            slotToScriptureRef: slotToScriptureRef,
            onScriptureChange: onScriptureChange,
            onSermonPassageChange: onSermonPassageChange,
            onPrint: onPrint,
            onCopyForPC: onCopyForPC,
            onExportToPC: onExportToPC,
            onServiceTypeChange: onServiceTypeChange,
            onConfirmExport: onConfirmExport,
            onShare: onShare,
            onDelete: onDelete,
            onSave: onSave,
            onUndo: onUndo,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
