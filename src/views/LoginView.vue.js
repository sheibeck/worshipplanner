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
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var vue_router_1 = require("vue-router");
var auth_1 = require("@/stores/auth");
var router = (0, vue_router_1.useRouter)();
var authStore = (0, auth_1.useAuthStore)();
var email = (0, vue_1.ref)('');
var password = (0, vue_1.ref)('');
var resetEmail = (0, vue_1.ref)('');
var errorMessage = (0, vue_1.ref)('');
var resetMessage = (0, vue_1.ref)('');
var isLoading = (0, vue_1.ref)(false);
var loadingMethod = (0, vue_1.ref)(null);
var showForgotPassword = (0, vue_1.ref)(false);
function mapFirebaseError(code) {
    switch (code) {
        case 'auth/wrong-password':
            return 'Incorrect password. Try again or reset your password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/popup-closed-by-user':
            return '';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        default:
            return "Sign-in failed. Please try again.";
    }
}
function handleGoogleSignIn() {
    return __awaiter(this, void 0, void 0, function () {
        var user, err_1, firebaseErr, msg;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    errorMessage.value = '';
                    isLoading.value = true;
                    loadingMethod.value = 'google';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, authStore.loginWithGoogle()];
                case 2:
                    user = _b.sent();
                    if (!user) return [3 /*break*/, 4];
                    return [4 /*yield*/, router.push('/')];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    err_1 = _b.sent();
                    firebaseErr = err_1;
                    msg = mapFirebaseError((_a = firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.code) !== null && _a !== void 0 ? _a : '');
                    errorMessage.value = msg || (firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.message) || 'An unexpected error occurred.';
                    return [3 /*break*/, 7];
                case 6:
                    isLoading.value = false;
                    loadingMethod.value = null;
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function handleEmailSignIn() {
    return __awaiter(this, void 0, void 0, function () {
        var err_2, firebaseErr;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    errorMessage.value = '';
                    isLoading.value = true;
                    loadingMethod.value = 'email';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, authStore.loginWithEmail(email.value, password.value)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, router.push('/')];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_2 = _b.sent();
                    firebaseErr = err_2;
                    errorMessage.value = mapFirebaseError((_a = firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.code) !== null && _a !== void 0 ? _a : '') || (firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.message) || 'An unexpected error occurred.';
                    return [3 /*break*/, 6];
                case 5:
                    isLoading.value = false;
                    loadingMethod.value = null;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function handleForgotPassword() {
    return __awaiter(this, void 0, void 0, function () {
        var err_3, firebaseErr;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    errorMessage.value = '';
                    isLoading.value = true;
                    loadingMethod.value = 'reset';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, authStore.resetPassword(resetEmail.value)];
                case 2:
                    _b.sent();
                    resetMessage.value = "Reset link sent to ".concat(resetEmail.value, ". Check your inbox.");
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _b.sent();
                    firebaseErr = err_3;
                    errorMessage.value = mapFirebaseError((_a = firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.code) !== null && _a !== void 0 ? _a : '') || (firebaseErr === null || firebaseErr === void 0 ? void 0 : firebaseErr.message) || 'Failed to send reset email.';
                    return [3 /*break*/, 5];
                case 4:
                    isLoading.value = false;
                    loadingMethod.value = null;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-h-screen bg-gray-950 flex items-center justify-center px-4" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full max-w-sm" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center mb-8" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-2xl font-semibold text-white tracking-tight" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5" }));
if (!__VLS_ctx.showForgotPassword) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.handleGoogleSignIn) }, { disabled: (__VLS_ctx.isLoading) }), { class: "w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-100 hover:bg-gray-700 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" }));
    if (!__VLS_ctx.isLoading || __VLS_ctx.loadingMethod !== 'google') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 48 48" }, { class: "w-5 h-5 shrink-0" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            fill: "#EA4335",
            d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            fill: "#4285F4",
            d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            fill: "#FBBC05",
            d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            fill: "#34A853",
            d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            fill: "none",
            d: "M0 0h48v48H0z",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "w-5 h-5 animate-spin text-gray-400" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.loadingMethod === 'google' && __VLS_ctx.isLoading ? 'Signing in...' : 'Sign in with Google');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative my-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute inset-0 flex items-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-full border-t border-gray-800" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative flex justify-center text-xs" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "px-2 bg-gray-900 text-gray-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)(__assign({ onSubmit: (__VLS_ctx.handleEmailSignIn) }, { class: "space-y-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ for: "email" }, { class: "sr-only" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ id: "email", type: "email", autocomplete: "email", required: true, placeholder: "Email address" }, { class: "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" }));
    (__VLS_ctx.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ for: "password" }, { class: "sr-only" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ id: "password", type: "password", autocomplete: "current-password", required: true, placeholder: "Password" }, { class: "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" }));
    (__VLS_ctx.password);
    if (__VLS_ctx.errorMessage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2" }));
        (__VLS_ctx.errorMessage);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ type: "submit", disabled: (__VLS_ctx.isLoading) }, { class: "w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }));
    (__VLS_ctx.loadingMethod === 'email' && __VLS_ctx.isLoading ? 'Signing in...' : 'Sign in');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(!__VLS_ctx.showForgotPassword))
                return;
            __VLS_ctx.showForgotPassword = true;
            __VLS_ctx.errorMessage = '';
        } }, { type: "button" }), { class: "text-xs text-indigo-400 hover:text-indigo-300 hover:underline" }));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(!__VLS_ctx.showForgotPassword))
                return;
            __VLS_ctx.showForgotPassword = false;
            __VLS_ctx.resetEmail = '';
            __VLS_ctx.resetMessage = '';
            __VLS_ctx.errorMessage = '';
        } }, { class: "text-gray-500 hover:text-gray-300 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M15 19l-7-7 7-7",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-medium text-gray-100" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mb-4" }));
    if (!__VLS_ctx.resetMessage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)(__assign({ onSubmit: (__VLS_ctx.handleForgotPassword) }, { class: "space-y-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ type: "email", required: true, placeholder: "Email address" }, { class: "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" }));
        (__VLS_ctx.resetEmail);
        if (__VLS_ctx.errorMessage) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2" }));
            (__VLS_ctx.errorMessage);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ type: "submit", disabled: (__VLS_ctx.isLoading) }, { class: "w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }));
        (__VLS_ctx.isLoading ? 'Sending...' : 'Send reset link');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center space-y-3" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mx-auto" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5 text-green-400" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M5 13l4 4L19 7",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-300" }));
        (__VLS_ctx.resetMessage);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(!__VLS_ctx.showForgotPassword))
                    return;
                if (!!(!__VLS_ctx.resetMessage))
                    return;
                __VLS_ctx.showForgotPassword = false;
                __VLS_ctx.resetEmail = '';
                __VLS_ctx.resetMessage = '';
            } }, { class: "text-xs text-indigo-400 hover:underline" }));
    }
}
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-950']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['my-5']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-950']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-950']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['h-10']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            email: email,
            password: password,
            resetEmail: resetEmail,
            errorMessage: errorMessage,
            resetMessage: resetMessage,
            isLoading: isLoading,
            loadingMethod: loadingMethod,
            showForgotPassword: showForgotPassword,
            handleGoogleSignIn: handleGoogleSignIn,
            handleEmailSignIn: handleEmailSignIn,
            handleForgotPassword: handleForgotPassword,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
