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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var auth_1 = require("@/stores/auth");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var planningCenterApi_1 = require("@/utils/planningCenterApi");
var slug_1 = require("@/utils/slug");
var authStore = (0, auth_1.useAuthStore)();
// ── Local state ────────────────────────────────────────────────────────────────
var editName = (0, vue_1.ref)((_a = authStore.orgName) !== null && _a !== void 0 ? _a : '');
var isSaving = (0, vue_1.ref)(false);
var savedFeedback = (0, vue_1.ref)(false);
var saveError = (0, vue_1.ref)(null);
// ── Share URL slug state (R-02, D-18) ──────────────────────────────────────────
var editSlug = (0, vue_1.ref)('');
var persistedSlug = (0, vue_1.ref)(null);
var isSlugSaving = (0, vue_1.ref)(false);
var slugSavedFeedback = (0, vue_1.ref)(false);
var slugSaveError = (0, vue_1.ref)(null);
// ── PC credential state ────────────────────────────────────────────────────────
var editingPcCreds = (0, vue_1.ref)(false);
var pcAppIdInput = (0, vue_1.ref)('');
var pcSecretInput = (0, vue_1.ref)('');
var pcValidating = (0, vue_1.ref)(false);
var pcValidationError = (0, vue_1.ref)(null);
var pcSaveSuccess = (0, vue_1.ref)(false);
// ── Vertical Worship toggle state (D-15/D-16) ─────────────────────────────────
var vwModeInput = (0, vue_1.ref)(authStore.vwModeEnabled);
var vwSavedFeedback = (0, vue_1.ref)(false);
var vwSaveError = (0, vue_1.ref)(null);
// ── Computed ───────────────────────────────────────────────────────────────────
var isSaveDisabled = (0, vue_1.computed)(function () {
    return (isSaving.value ||
        editName.value.trim() === '' ||
        editName.value.trim() === authStore.orgName);
});
// Sanitized live preview so the helper text's {slug} segment updates as the user types,
// before any save/claim happens.
var liveSlugPreview = (0, vue_1.computed)(function () { return (0, slug_1.deriveSlug)(editSlug.value) || 'your-church'; });
var isSlugSaveDisabled = (0, vue_1.computed)(function () {
    var candidate = (0, slug_1.deriveSlug)(editSlug.value);
    return isSlugSaving.value || candidate === '' || candidate === persistedSlug.value;
});
// ── Sync editName if orgName changes externally (skip during save) ────────────
(0, vue_1.watch)(function () { return authStore.orgName; }, function (newName) {
    if (newName !== null && !isSaving.value) {
        editName.value = newName;
    }
});
// ── Load the org's persisted slug (or derive a live default from orgName) ─────
function loadOrgSlug() {
    return __awaiter(this, void 0, void 0, function () {
        var snap, data, slug, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!authStore.orgId)
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId))];
                case 2:
                    snap = _c.sent();
                    if (!snap.exists())
                        return [2 /*return*/];
                    data = snap.data();
                    slug = (_a = data.slug) !== null && _a !== void 0 ? _a : null;
                    persistedSlug.value = slug;
                    editSlug.value = slug !== null && slug !== void 0 ? slug : (0, slug_1.deriveSlug)((_b = authStore.orgName) !== null && _b !== void 0 ? _b : '');
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _c.sent();
                    console.error('[SettingsView] load org slug error:', err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
(0, vue_1.watch)(function () { return authStore.orgId; }, function (id) {
    if (id)
        loadOrgSlug();
}, { immediate: true });
// Keep the local checkbox in sync if the store's org context finishes loading
// after this component mounts (org doc is not live-synced — Pitfall 2 — so this
// only reflects our own mirror-writes and the initial async loadOrgContext read).
(0, vue_1.watch)(function () { return authStore.vwModeEnabled; }, function (val) {
    vwModeInput.value = val;
});
// ── Save action (Org name) ─────────────────────────────────────────────────────
function onSave() {
    return __awaiter(this, void 0, void 0, function () {
        var trimmed, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isSaveDisabled.value)
                        return [2 /*return*/];
                    if (!authStore.orgId)
                        return [2 /*return*/];
                    saveError.value = null;
                    isSaving.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    trimmed = editName.value.trim();
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId), { name: trimmed })];
                case 2:
                    _a.sent();
                    authStore.orgName = trimmed;
                    savedFeedback.value = true;
                    setTimeout(function () {
                        savedFeedback.value = false;
                    }, 2000);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _a.sent();
                    console.error('[SettingsView] save org name error:', err_2);
                    saveError.value = 'Failed to save. Please try again.';
                    return [3 /*break*/, 5];
                case 4:
                    isSaving.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── Save action (Share URL slug, R-02/D-18) ────────────────────────────────────
// Uniqueness always goes through claimSlug's create-only orgSlugs claim — never a raw
// updateDoc of organizations/{orgId}.slug alone.
function onSaveSlug() {
    return __awaiter(this, void 0, void 0, function () {
        var candidate, claimed, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isSlugSaveDisabled.value)
                        return [2 /*return*/];
                    if (!authStore.orgId)
                        return [2 /*return*/];
                    slugSaveError.value = null;
                    isSlugSaving.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    candidate = (0, slug_1.deriveSlug)(editSlug.value);
                    return [4 /*yield*/, (0, slug_1.claimSlug)(candidate, authStore.orgId)];
                case 2:
                    claimed = _a.sent();
                    if (claimed !== candidate) {
                        // The exact slug the user asked for is already claimed by another org — claimSlug's
                        // retry loop silently reserved a numeric-suffixed fallback instead. For a manual
                        // Settings edit that silent substitution would be surprising, so surface it as a
                        // collision rather than accepting it (D-18: manual edits should be explicit).
                        slugSaveError.value = 'That URL is already taken — try a different one.';
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId), { slug: claimed })];
                case 3:
                    _a.sent();
                    persistedSlug.value = claimed;
                    editSlug.value = claimed;
                    // Keep the shared auth-store slug current so share links (e.g. the Schedule
                    // page's Finalize & Share URL) reflect the new slug without a reload.
                    authStore.orgSlug = claimed;
                    slugSavedFeedback.value = true;
                    setTimeout(function () {
                        slugSavedFeedback.value = false;
                    }, 2000);
                    return [3 /*break*/, 6];
                case 4:
                    err_3 = _a.sent();
                    console.error('[SettingsView] save slug error:', err_3);
                    slugSaveError.value = 'That URL is already taken — try a different one.';
                    return [3 /*break*/, 6];
                case 5:
                    isSlugSaving.value = false;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ── PC credential actions ──────────────────────────────────────────────────────
function startEditPcCreds() {
    // Do NOT pre-fill inputs with actual values (per plan pitfall 6)
    pcAppIdInput.value = '';
    pcSecretInput.value = '';
    pcValidationError.value = null;
    editingPcCreds.value = true;
}
function cancelEditPcCreds() {
    editingPcCreds.value = false;
    pcAppIdInput.value = '';
    pcSecretInput.value = '';
    pcValidationError.value = null;
}
function onSavePcCredentials() {
    return __awaiter(this, void 0, void 0, function () {
        var result, err_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!authStore.orgId)
                        return [2 /*return*/];
                    if (!pcAppIdInput.value.trim() || !pcSecretInput.value.trim())
                        return [2 /*return*/];
                    pcValidating.value = true;
                    pcValidationError.value = null;
                    pcSaveSuccess.value = false;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)(pcAppIdInput.value.trim(), pcSecretInput.value.trim())];
                case 2:
                    result = _b.sent();
                    if (!result.valid) {
                        pcValidationError.value = (_a = result.error) !== null && _a !== void 0 ? _a : 'Invalid credentials';
                        return [2 /*return*/];
                    }
                    // Save to Firestore
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId), {
                            pcAppId: pcAppIdInput.value.trim(),
                            pcSecret: pcSecretInput.value.trim(),
                        })
                        // Update auth store
                    ];
                case 3:
                    // Save to Firestore
                    _b.sent();
                    // Update auth store
                    authStore.setPcCredentials(pcAppIdInput.value.trim(), pcSecretInput.value.trim());
                    pcSaveSuccess.value = true;
                    editingPcCreds.value = false;
                    setTimeout(function () {
                        pcSaveSuccess.value = false;
                    }, 2000);
                    // Clear inputs
                    pcAppIdInput.value = '';
                    pcSecretInput.value = '';
                    return [3 /*break*/, 6];
                case 4:
                    err_4 = _b.sent();
                    console.error('[SettingsView] save PC credentials error:', err_4);
                    pcValidationError.value = err_4 instanceof Error ? err_4.message : 'Failed to save credentials';
                    return [3 /*break*/, 6];
                case 5:
                    pcValidating.value = false;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function onClearPcCredentials() {
    return __awaiter(this, void 0, void 0, function () {
        var err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!authStore.orgId)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId), {
                            pcAppId: null,
                            pcSecret: null,
                        })];
                case 2:
                    _a.sent();
                    authStore.setPcCredentials(null, null);
                    editingPcCreds.value = false;
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _a.sent();
                    console.error('[SettingsView] clear PC credentials error:', err_5);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Vertical Worship toggle action (D-15/D-16) ─────────────────────────────────
// Mirror-write template follows onSaveSlug: updateDoc the org doc, then
// immediately reassign the store ref (org doc is not live-synced — Pitfall 2).
function onToggleVwMode() {
    return __awaiter(this, void 0, void 0, function () {
        var newValue, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!authStore.orgId || !authStore.isEditor)
                        return [2 /*return*/];
                    newValue = vwModeInput.value;
                    vwSaveError.value = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', authStore.orgId), { vwModeEnabled: newValue })];
                case 2:
                    _a.sent();
                    authStore.vwModeEnabled = newValue;
                    vwSavedFeedback.value = true;
                    setTimeout(function () {
                        vwSavedFeedback.value = false;
                    }, 2000);
                    return [3 /*break*/, 4];
                case 3:
                    err_6 = _a.sent();
                    console.error('[SettingsView] save vwModeEnabled error:', err_6);
                    vwSaveError.value = 'Failed to save. Please try again.';
                    // Revert the local checkbox to reflect the unsaved state
                    vwModeInput.value = !newValue;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
/** @type {[typeof AppShell, typeof AppShell, ]} */ ;
// @ts-ignore
var __VLS_0 = __VLS_asFunctionalComponent(AppShell_vue_1.default, new AppShell_vue_1.default({}));
var __VLS_1 = __VLS_0.apply(void 0, __spreadArray([{}], __VLS_functionalComponentArgsRest(__VLS_0), false));
var __VLS_3 = {};
__VLS_2.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8 max-w-4xl" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6 pb-4 border-b border-gray-800" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-semibold text-gray-100" }));
if (__VLS_ctx.authStore.orgName) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
    (__VLS_ctx.authStore.orgName);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-gray-900 border border-gray-800 p-4" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-semibold text-gray-300 mb-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.onSave) }, { value: (__VLS_ctx.editName), type: "text", placeholder: "Enter organization name" }), { class: "w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-3 flex items-center gap-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onSave) }, { type: "button", disabled: (__VLS_ctx.isSaveDisabled) }), { class: "inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
(__VLS_ctx.isSaving ? 'Saving...' : __VLS_ctx.savedFeedback ? 'Saved!' : 'Save');
if (__VLS_ctx.saveError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-2" }));
    (__VLS_ctx.saveError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-6 pt-6 border-t border-gray-800" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.onSaveSlug) }, { value: (__VLS_ctx.editSlug), type: "text", placeholder: "Enter a URL slug" }), { class: "w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-1" }));
(__VLS_ctx.liveSlugPreview);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-3 flex items-center gap-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onSaveSlug) }, { type: "button", disabled: (__VLS_ctx.isSlugSaveDisabled) }), { class: "inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
(__VLS_ctx.isSlugSaving ? 'Saving...' : __VLS_ctx.slugSavedFeedback ? 'Saved!' : 'Save');
if (__VLS_ctx.slugSaveError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-2" }));
    (__VLS_ctx.slugSaveError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-semibold text-gray-300 mb-3" }));
if (__VLS_ctx.authStore.hasPcCredentials && !__VLS_ctx.editingPcCreds) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-2 mb-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-mono text-sm text-gray-400" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-mono text-sm text-gray-400" }));
    if (__VLS_ctx.pcSaveSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-green-400 text-sm mb-2" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 flex-wrap" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.startEditPcCreds) }, { type: "button" }), { class: "bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onClearPcCredentials) }, { type: "button" }), { class: "bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.pcAppIdInput), type: "text", placeholder: "Your Planning Center App ID" }, { class: "w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "block text-xs text-gray-400 mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "password", placeholder: "Your Planning Center Secret" }, { class: "w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" }));
    (__VLS_ctx.pcSecretInput);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign({ href: "https://planningcenteronline.com/api_passwords", target: "_blank", rel: "noopener noreferrer" }, { class: "text-indigo-400 hover:text-indigo-300" }));
    if (__VLS_ctx.pcValidationError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-2" }));
        (__VLS_ctx.pcValidationError);
    }
    if (__VLS_ctx.pcSaveSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-green-400 text-sm mt-2" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-3 flex items-center gap-2 flex-wrap" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onSavePcCredentials) }, { type: "button", disabled: (__VLS_ctx.pcValidating || !__VLS_ctx.pcAppIdInput.trim() || !__VLS_ctx.pcSecretInput.trim()) }), { class: "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
    (__VLS_ctx.pcValidating ? 'Validating...' : 'Save & Validate');
    if (__VLS_ctx.editingPcCreds) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.cancelEditPcCreds) }, { type: "button" }), { class: "bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-semibold text-gray-300 mb-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "flex items-center gap-3" }, { class: (__VLS_ctx.authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed') }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onChange: (__VLS_ctx.onToggleVwMode) }, { type: "checkbox", disabled: (!__VLS_ctx.authStore.isEditor) }), { class: "h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0" }));
(__VLS_ctx.vwModeInput);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-200" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-2" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-4 rounded-md bg-gray-950/40 border border-gray-800 p-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400 mb-2" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)(__assign({ class: "text-xs text-gray-400 space-y-1.5 mb-2 list-disc list-inside" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-medium text-gray-200" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-medium text-gray-200" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-medium text-gray-200" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-400" }));
if (__VLS_ctx.vwSavedFeedback) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-green-400 text-sm mt-2" }));
}
if (__VLS_ctx.vwSaveError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-2" }));
    (__VLS_ctx.vwSaveError);
}
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
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
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-80']} */ ;
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
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-80']} */ ;
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
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-80']} */ ;
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
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-80']} */ ;
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
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-950/40']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
/** @type {__VLS_StyleScopedClasses['list-inside']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            authStore: authStore,
            editName: editName,
            isSaving: isSaving,
            savedFeedback: savedFeedback,
            saveError: saveError,
            editSlug: editSlug,
            isSlugSaving: isSlugSaving,
            slugSavedFeedback: slugSavedFeedback,
            slugSaveError: slugSaveError,
            editingPcCreds: editingPcCreds,
            pcAppIdInput: pcAppIdInput,
            pcSecretInput: pcSecretInput,
            pcValidating: pcValidating,
            pcValidationError: pcValidationError,
            pcSaveSuccess: pcSaveSuccess,
            vwModeInput: vwModeInput,
            vwSavedFeedback: vwSavedFeedback,
            vwSaveError: vwSaveError,
            isSaveDisabled: isSaveDisabled,
            liveSlugPreview: liveSlugPreview,
            isSlugSaveDisabled: isSlugSaveDisabled,
            onSave: onSave,
            onSaveSlug: onSaveSlug,
            startEditPcCreds: startEditPcCreds,
            cancelEditPcCreds: cancelEditPcCreds,
            onSavePcCredentials: onSavePcCredentials,
            onClearPcCredentials: onClearPcCredentials,
            onToggleVwMode: onToggleVwMode,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
