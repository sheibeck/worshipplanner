"use strict";
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
exports.getCurrentUser = getCurrentUser;
var vue_router_1 = require("vue-router");
var auth_1 = require("firebase/auth");
var firebase_1 = require("@/firebase");
function getCurrentUser() {
    return new Promise(function (resolve) {
        var unsubscribe = (0, auth_1.onAuthStateChanged)(firebase_1.auth, function (user) {
            unsubscribe();
            resolve(user);
        });
    });
}
var router = (0, vue_router_1.createRouter)({
    history: (0, vue_router_1.createWebHistory)(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: function () { return Promise.resolve().then(function () { return require('../views/LoginView.vue'); }); },
        },
        {
            path: '/',
            name: 'dashboard',
            component: function () { return Promise.resolve().then(function () { return require('../views/DashboardView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/songs',
            name: 'songs',
            component: function () { return Promise.resolve().then(function () { return require('../views/SongsView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/volunteers',
            name: 'volunteers',
            component: function () { return Promise.resolve().then(function () { return require('../views/RosterView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/schedule',
            name: 'schedule',
            component: function () { return Promise.resolve().then(function () { return require('../views/QuarterView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/services',
            name: 'services',
            component: function () { return Promise.resolve().then(function () { return require('../views/ServicesView.vue'); }); },
            meta: { requiresAuth: true },
        },
        {
            path: '/services/:id',
            name: 'service-editor',
            component: function () { return Promise.resolve().then(function () { return require('../views/ServiceEditorView.vue'); }); },
            meta: { requiresAuth: true },
        },
        {
            path: '/admins',
            name: 'admins',
            component: function () { return Promise.resolve().then(function () { return require('../views/TeamView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/settings',
            name: 'settings',
            component: function () { return Promise.resolve().then(function () { return require('../views/SettingsView.vue'); }); },
            meta: { requiresAuth: true, requiresEditor: true },
        },
        {
            path: '/share/:token',
            name: 'share',
            component: function () { return Promise.resolve().then(function () { return require('../views/ShareView.vue'); }); },
            // Intentionally no meta.requiresAuth — public route for unauthenticated viewers
        },
        {
            path: '/quarter-share/:token',
            name: 'quarter-share',
            component: function () { return Promise.resolve().then(function () { return require('../views/QuarterShareView.vue'); }); },
            // Intentionally no meta.requiresAuth — public route for unauthenticated viewers (D-24)
        },
        {
            path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
            name: 'quarter-memorable-share',
            component: function () { return Promise.resolve().then(function () { return require('../views/QuarterShareView.vue'); }); },
            // Intentionally no meta.requiresAuth — public route for unauthenticated viewers (D-24).
            // Appended after all static routes: Vue Router ranks static segments above dynamic
            // ones, so this can never shadow /songs, /volunteers, /schedule, etc. (D-19).
        },
    ],
});
router.beforeEach(function (to) { return __awaiter(void 0, void 0, void 0, function () {
    var user, useAuthStore, authStore, user, useAuthStore, authStore;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!to.meta.requiresAuth) return [3 /*break*/, 2];
                return [4 /*yield*/, getCurrentUser()];
            case 1:
                user = _a.sent();
                if (!user) {
                    return [2 /*return*/, { name: 'login' }];
                }
                _a.label = 2;
            case 2:
                if (!to.meta.requiresEditor) return [3 /*break*/, 5];
                return [4 /*yield*/, Promise.resolve().then(function () { return require('../stores/auth'); })];
            case 3:
                useAuthStore = (_a.sent()).useAuthStore;
                authStore = useAuthStore();
                return [4 /*yield*/, authStore.waitForRole()];
            case 4:
                _a.sent();
                if (!authStore.isEditor) {
                    return [2 /*return*/, { name: 'services' }];
                }
                _a.label = 5;
            case 5:
                if (!(to.name === 'login')) return [3 /*break*/, 9];
                return [4 /*yield*/, getCurrentUser()];
            case 6:
                user = _a.sent();
                if (!user) return [3 /*break*/, 9];
                return [4 /*yield*/, Promise.resolve().then(function () { return require('../stores/auth'); })];
            case 7:
                useAuthStore = (_a.sent()).useAuthStore;
                authStore = useAuthStore();
                return [4 /*yield*/, authStore.waitForRole()];
            case 8:
                _a.sent();
                return [2 /*return*/, { name: authStore.isEditor ? 'dashboard' : 'services' }];
            case 9: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
