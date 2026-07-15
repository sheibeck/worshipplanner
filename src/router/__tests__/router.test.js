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
var vitest_1 = require("vitest");
var vue_router_1 = require("vue-router");
// We'll mock getCurrentUser at the module level
vitest_1.vi.mock('@/firebase', function () { return ({
    auth: {},
    db: {},
}); });
vitest_1.vi.mock('firebase/auth', function () { return ({
    getAuth: vitest_1.vi.fn(function () { return ({}); }),
    onAuthStateChanged: vitest_1.vi.fn(function (auth, callback) {
        // We won't auto-trigger in router tests — getCurrentUser controls it
        return function () { };
    }),
}); });
// Mock the router module so we can control getCurrentUser
var mockGetCurrentUser = vitest_1.vi.fn();
vitest_1.vi.mock('../index', function (importOriginal) { return __awaiter(void 0, void 0, void 0, function () {
    var mod;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, importOriginal()];
            case 1:
                mod = _a.sent();
                return [2 /*return*/, __assign(__assign({}, mod), { getCurrentUser: mockGetCurrentUser })];
        }
    });
}); });
var mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
};
// Create a test router with the same structure as the real one but using mocked getCurrentUser
function createTestRouter() {
    var _this = this;
    var router = (0, vue_router_1.createRouter)({
        history: (0, vue_router_1.createWebHistory)(),
        routes: [
            {
                path: '/login',
                name: 'login',
                component: { template: '<div>Login</div>' },
            },
            {
                path: '/',
                name: 'dashboard',
                component: { template: '<div>Dashboard</div>' },
                meta: { requiresAuth: true },
            },
            {
                path: '/public',
                name: 'public',
                component: { template: '<div>Public</div>' },
            },
            {
                path: '/share/:token',
                name: 'share',
                component: { template: '<div>Share</div>' },
                // No meta.requiresAuth — matches production router
            },
            {
                path: '/schedule',
                name: 'schedule',
                component: { template: '<div>Schedule</div>' },
                meta: { requiresAuth: true },
            },
            {
                path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
                name: 'quarter-memorable-share',
                component: { template: '<div>Quarter Memorable Share</div>' },
                // No meta.requiresAuth — matches production router (D-24)
            },
        ],
    });
    router.beforeEach(function (to) { return __awaiter(_this, void 0, void 0, function () {
        var user, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!to.meta.requiresAuth) return [3 /*break*/, 2];
                    return [4 /*yield*/, mockGetCurrentUser()];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        return [2 /*return*/, { name: 'login' }];
                    }
                    _a.label = 2;
                case 2:
                    if (!(to.name === 'login')) return [3 /*break*/, 4];
                    return [4 /*yield*/, mockGetCurrentUser()];
                case 3:
                    user = _a.sent();
                    if (user) {
                        return [2 /*return*/, { name: 'dashboard' }];
                    }
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); });
    return router;
}
(0, vitest_1.describe)('Router guard', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('protected routes (requiresAuth: true)', function () {
        (0, vitest_1.it)('redirects unauthenticated users to /login', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(null);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('login');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('allows authenticated users through to protected routes', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(mockUser);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('dashboard');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('/login route', function () {
        (0, vitest_1.it)('redirects authenticated users away from /login to /', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(mockUser);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/login')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('dashboard');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('allows unauthenticated users to access /login', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(null);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/login')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('login');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('public routes (no meta.requiresAuth)', function () {
        (0, vitest_1.it)('allows navigation to public routes regardless of auth state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(null);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/public')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('public');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('allows authenticated users to access public routes too', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(mockUser);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/public')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('public');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('share route', function () {
        (0, vitest_1.it)('allows unauthenticated users to access /share/:token without redirect', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(null);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/share/abc123')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('share');
                        (0, vitest_1.expect)(router.currentRoute.value.params.token).toBe('abc123');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('memorable quarter share route', function () {
        (0, vitest_1.it)('resolves /:slug/quarter:num-:year for a sample slug/quarter without redirect', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(null);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/gracechurch/quarter1-2026')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('quarter-memorable-share');
                        (0, vitest_1.expect)(router.currentRoute.value.params.slug).toBe('gracechurch');
                        (0, vitest_1.expect)(router.currentRoute.value.params.num).toBe('1');
                        (0, vitest_1.expect)(router.currentRoute.value.params.year).toBe('2026');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not shadow an existing static route when the first segment is reserved', function () { return __awaiter(void 0, void 0, void 0, function () {
            var router;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockGetCurrentUser.mockResolvedValue(mockUser);
                        router = createTestRouter();
                        return [4 /*yield*/, router.push('/schedule')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(router.currentRoute.value.name).toBe('schedule');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
