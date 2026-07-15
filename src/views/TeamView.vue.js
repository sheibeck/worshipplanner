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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var auth_1 = require("@/stores/auth");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var authStore = (0, auth_1.useAuthStore)();
// ── Data state ─────────────────────────────────────────────────────────────────
var members = (0, vue_1.ref)([]);
var pendingInvites = (0, vue_1.ref)([]);
// ── Invite form state ──────────────────────────────────────────────────────────
var inviteEmail = (0, vue_1.ref)('');
var inviteRole = (0, vue_1.ref)('viewer');
var inviteError = (0, vue_1.ref)(null);
var isInviting = (0, vue_1.ref)(false);
var invitedFeedback = (0, vue_1.ref)(null);
// ── Action state ───────────────────────────────────────────────────────────────
var confirmingRemoveUid = (0, vue_1.ref)(null);
var actionError = (0, vue_1.ref)(null);
// ── Subscriptions ──────────────────────────────────────────────────────────────
var membersUnsub = null;
var invitesUnsub = null;
// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isValidEmailFormat(email) {
    var e = email.trim();
    return e.includes('@') && e.includes('.');
}
function formatDate(ts) {
    if (!ts || !ts.toDate)
        return '—';
    var d = ts.toDate();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// ── Invite action ──────────────────────────────────────────────────────────────
function onInvite() {
    return __awaiter(this, void 0, void 0, function () {
        var email, normalized, orgId, user, batch, inviteRef, lookupRef, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    inviteError.value = null;
                    email = inviteEmail.value.trim();
                    if (!email || !isValidEmailFormat(email)) {
                        inviteError.value = 'Enter a valid email address';
                        return [2 /*return*/];
                    }
                    normalized = normalizeEmail(email);
                    if (members.value.some(function (m) { var _a; return ((_a = m.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalized; })) {
                        inviteError.value = 'This person is already a member';
                        return [2 /*return*/];
                    }
                    if (pendingInvites.value.some(function (i) { var _a; return ((_a = i.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalized; })) {
                        inviteError.value = 'An invite has already been sent to this email';
                        return [2 /*return*/];
                    }
                    orgId = authStore.orgId;
                    user = authStore.user;
                    if (!orgId || !user)
                        return [2 /*return*/];
                    isInviting.value = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    batch = (0, firestore_1.writeBatch)(firebase_1.db);
                    inviteRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', orgId, 'invites', normalized);
                    batch.set(inviteRef, {
                        role: inviteRole.value,
                        invitedBy: user.uid,
                        invitedAt: (0, firestore_1.serverTimestamp)(),
                        email: normalized,
                        status: 'pending',
                    });
                    lookupRef = (0, firestore_1.doc)(firebase_1.db, 'inviteLookup', normalized);
                    batch.set(lookupRef, {
                        orgId: orgId,
                        role: inviteRole.value,
                        invitedAt: (0, firestore_1.serverTimestamp)(),
                    });
                    return [4 /*yield*/, batch.commit()];
                case 2:
                    _a.sent();
                    invitedFeedback.value = normalized;
                    inviteEmail.value = '';
                    inviteRole.value = 'viewer';
                    // Clear success feedback after 2 seconds
                    setTimeout(function () {
                        invitedFeedback.value = null;
                    }, 2000);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error('[TeamView] invite error:', err_1);
                    inviteError.value = 'Failed to send invite. Please try again.';
                    return [3 /*break*/, 5];
                case 4:
                    isInviting.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── Cancel invite ──────────────────────────────────────────────────────────────
function onCancelInvite(email) {
    return __awaiter(this, void 0, void 0, function () {
        var orgId, batch, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orgId = authStore.orgId;
                    if (!orgId)
                        return [2 /*return*/];
                    actionError.value = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    batch = (0, firestore_1.writeBatch)(firebase_1.db);
                    batch.delete((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId, 'invites', email));
                    batch.delete((0, firestore_1.doc)(firebase_1.db, 'inviteLookup', email));
                    return [4 /*yield*/, batch.commit()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    console.error('[TeamView] cancel invite error:', err_2);
                    actionError.value = 'Failed to cancel invite. Please try again.';
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Role toggle ────────────────────────────────────────────────────────────────
function onToggleRole(member) {
    return __awaiter(this, void 0, void 0, function () {
        var orgId, editorCount, newRole, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orgId = authStore.orgId;
                    if (!orgId)
                        return [2 /*return*/];
                    actionError.value = null;
                    // Guard: demoting the last editor
                    if (member.role === 'editor') {
                        editorCount = members.value.filter(function (m) { return m.role === 'editor'; }).length;
                        if (editorCount === 1) {
                            actionError.value = 'Cannot remove the only editor. Assign another editor first.';
                            return [2 /*return*/];
                        }
                    }
                    newRole = member.role === 'editor' ? 'viewer' : 'editor';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId, 'members', member.uid), { role: newRole })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _a.sent();
                    console.error('[TeamView] role toggle error:', err_3);
                    actionError.value = 'Failed to update role. Please try again.';
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Remove member ──────────────────────────────────────────────────────────────
function onConfirmRemove(uid) {
    return __awaiter(this, void 0, void 0, function () {
        var orgId, target, editorCount, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orgId = authStore.orgId;
                    if (!orgId)
                        return [2 /*return*/];
                    actionError.value = null;
                    target = members.value.find(function (m) { return m.uid === uid; });
                    if ((target === null || target === void 0 ? void 0 : target.role) === 'editor') {
                        editorCount = members.value.filter(function (m) { return m.role === 'editor'; }).length;
                        if (editorCount === 1) {
                            actionError.value = 'Cannot remove the only editor. Assign another editor first.';
                            confirmingRemoveUid.value = null;
                            return [2 /*return*/];
                        }
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId, 'members', uid))];
                case 2:
                    _a.sent();
                    confirmingRemoveUid.value = null;
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _a.sent();
                    console.error('[TeamView] remove member error:', err_4);
                    actionError.value = 'Failed to remove member. Please try again.';
                    confirmingRemoveUid.value = null;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── Lifecycle ──────────────────────────────────────────────────────────────────
(0, vue_1.onMounted)(function () {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    membersUnsub = (0, firestore_1.onSnapshot)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId, 'members'), function (snap) {
        members.value = snap.docs.map(function (d) { return (__assign({ uid: d.id }, d.data())); });
    });
    invitesUnsub = (0, firestore_1.onSnapshot)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId, 'invites'), function (snap) {
        pendingInvites.value = snap.docs.map(function (d) { return (__assign({ email: d.id }, d.data())); });
    });
});
(0, vue_1.onUnmounted)(function () {
    membersUnsub === null || membersUnsub === void 0 ? void 0 : membersUnsub();
    invitesUnsub === null || invitesUnsub === void 0 ? void 0 : invitesUnsub();
});
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6 rounded-lg bg-gray-900 border border-gray-800 p-4" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-semibold text-gray-300 mb-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row gap-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.onInvite) }, { type: "email", placeholder: "Enter email address" }), { class: "flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" }));
(__VLS_ctx.inviteEmail);
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ value: (__VLS_ctx.inviteRole) }, { class: "bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "viewer",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "editor",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onInvite) }, { type: "button", disabled: (__VLS_ctx.isInviting) }), { class: "inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors" }));
(__VLS_ctx.isInviting ? 'Inviting...' : __VLS_ctx.invitedFeedback ? 'Invited!' : 'Invite');
if (__VLS_ctx.inviteError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-2" }));
    (__VLS_ctx.inviteError);
}
if (__VLS_ctx.invitedFeedback) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-green-400 text-sm mt-2" }));
    (__VLS_ctx.invitedFeedback);
}
if (!__VLS_ctx.authStore.orgId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-gray-400 py-8 text-center" }));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-gray-800 overflow-hidden" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "overflow-x-auto" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ class: "bg-gray-800/50 border-b border-gray-700" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)(__assign({ class: "divide-y divide-gray-800" }));
    var _loop_1 = function (member) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ key: (member.uid) }, { class: "hover:bg-gray-800/20 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-200" }));
        (member.displayName || (member.email ? member.email.split('@')[0] : 'Unknown'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400" }));
        (member.email || '');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "px-1.5 py-0.5 text-xs rounded" }, { class: (member.role === 'editor'
                ? 'bg-indigo-900/50 text-indigo-300'
                : 'bg-gray-700 text-gray-300') }));
        (member.role === 'editor' ? 'Editor' : 'Viewer');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400 text-sm" }));
        (__VLS_ctx.formatDate(member.joinedAt));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
        if (member.uid === ((_a = __VLS_ctx.authStore.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-500 italic" }));
        }
        else {
            if (__VLS_ctx.confirmingRemoveUid === member.uid) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-300 mr-2" }));
                (member.displayName || ((_b = member.email) !== null && _b !== void 0 ? _b : '').split('@')[0]);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a;
                        var _b = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _b[_i] = arguments[_i];
                        }
                        var $event = _b[0];
                        if (!!(!__VLS_ctx.authStore.orgId))
                            return;
                        if (!!(member.uid === ((_a = __VLS_ctx.authStore.user) === null || _a === void 0 ? void 0 : _a.uid)))
                            return;
                        if (!(__VLS_ctx.confirmingRemoveUid === member.uid))
                            return;
                        __VLS_ctx.onConfirmRemove(member.uid);
                    } }, { type: "button" }), { class: "text-xs text-red-400 hover:text-red-300 mr-2 transition-colors" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a;
                        var _b = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _b[_i] = arguments[_i];
                        }
                        var $event = _b[0];
                        if (!!(!__VLS_ctx.authStore.orgId))
                            return;
                        if (!!(member.uid === ((_a = __VLS_ctx.authStore.user) === null || _a === void 0 ? void 0 : _a.uid)))
                            return;
                        if (!(__VLS_ctx.confirmingRemoveUid === member.uid))
                            return;
                        __VLS_ctx.confirmingRemoveUid = null;
                    } }, { type: "button" }), { class: "text-xs text-gray-400 hover:text-gray-200 transition-colors" }));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a;
                        var _b = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _b[_i] = arguments[_i];
                        }
                        var $event = _b[0];
                        if (!!(!__VLS_ctx.authStore.orgId))
                            return;
                        if (!!(member.uid === ((_a = __VLS_ctx.authStore.user) === null || _a === void 0 ? void 0 : _a.uid)))
                            return;
                        if (!!(__VLS_ctx.confirmingRemoveUid === member.uid))
                            return;
                        __VLS_ctx.onToggleRole(member);
                    } }, { type: "button" }), { class: "text-sm text-gray-400 hover:text-gray-200 mr-3 transition-colors" }));
                (member.role === 'editor' ? 'Make Viewer' : 'Make Editor');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a;
                        var _b = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _b[_i] = arguments[_i];
                        }
                        var $event = _b[0];
                        if (!!(!__VLS_ctx.authStore.orgId))
                            return;
                        if (!!(member.uid === ((_a = __VLS_ctx.authStore.user) === null || _a === void 0 ? void 0 : _a.uid)))
                            return;
                        if (!!(__VLS_ctx.confirmingRemoveUid === member.uid))
                            return;
                        __VLS_ctx.confirmingRemoveUid = member.uid;
                    } }, { type: "button" }), { class: "text-sm text-red-400 hover:text-red-300 transition-colors" }));
            }
        }
    };
    for (var _i = 0, _c = __VLS_getVForSourceType((__VLS_ctx.members)); _i < _c.length; _i++) {
        var member = _c[_i][0];
        _loop_1(member);
    }
    var _loop_2 = function (invite) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ key: (invite.email) }, { class: "hover:bg-gray-800/20 transition-colors opacity-80" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400" }));
        (invite.email);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400" }));
        (invite.email);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1.5 flex-wrap" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "px-1.5 py-0.5 text-xs rounded" }, { class: (invite.role === 'editor'
                ? 'bg-indigo-900/50 text-indigo-300'
                : 'bg-gray-700 text-gray-300') }));
        (invite.role === 'editor' ? 'Editor' : 'Viewer');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 text-xs rounded" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400 text-sm" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(!__VLS_ctx.authStore.orgId))
                    return;
                __VLS_ctx.onCancelInvite(invite.email);
            } }, { type: "button" }), { class: "text-sm text-gray-400 hover:text-gray-200 transition-colors" }));
    };
    for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.pendingInvites)); _d < _e.length; _d++) {
        var invite = _e[_d][0];
        _loop_2(invite);
    }
    if (__VLS_ctx.members.length === 0 && __VLS_ctx.pendingInvites.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ colspan: "5" }, { class: "px-4 py-8 text-center text-sm text-gray-500" }));
    }
}
if (__VLS_ctx.actionError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-red-400 text-sm mt-3" }));
    (__VLS_ctx.actionError);
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
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/20']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            authStore: authStore,
            members: members,
            pendingInvites: pendingInvites,
            inviteEmail: inviteEmail,
            inviteRole: inviteRole,
            inviteError: inviteError,
            isInviting: isInviting,
            invitedFeedback: invitedFeedback,
            confirmingRemoveUid: confirmingRemoveUid,
            actionError: actionError,
            formatDate: formatDate,
            onInvite: onInvite,
            onCancelInvite: onCancelInvite,
            onToggleRole: onToggleRole,
            onConfirmRemove: onConfirmRemove,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
