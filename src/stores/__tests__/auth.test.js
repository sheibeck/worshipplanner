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
var vitest_1 = require("vitest");
var pinia_1 = require("pinia");
// Mock firebase/auth module
vitest_1.vi.mock('firebase/auth', function () {
    var mockOnAuthStateChangedCallbacks = [];
    var MockGoogleAuthProvider = /** @class */ (function () {
        function MockGoogleAuthProvider() {
            this.providerId = 'google.com';
        }
        return MockGoogleAuthProvider;
    }());
    return {
        getAuth: vitest_1.vi.fn(function () { return ({}); }),
        GoogleAuthProvider: MockGoogleAuthProvider,
        signInWithPopup: vitest_1.vi.fn(),
        signInWithEmailAndPassword: vitest_1.vi.fn(),
        createUserWithEmailAndPassword: vitest_1.vi.fn(),
        sendPasswordResetEmail: vitest_1.vi.fn(),
        signOut: vitest_1.vi.fn(),
        onAuthStateChanged: vitest_1.vi.fn(function (auth, callback) {
            mockOnAuthStateChangedCallbacks.push(callback);
            globalThis.__authCallbacks = mockOnAuthStateChangedCallbacks;
            // Return unsubscribe function
            return function () { };
        }),
    };
});
// Mock firebase/firestore module
vitest_1.vi.mock('firebase/firestore', function () { return ({
    getFirestore: vitest_1.vi.fn(function () { return ({}); }),
    doc: vitest_1.vi.fn(function () { return ({ id: 'mock-doc' }); }),
    setDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    getDoc: vitest_1.vi.fn(function () {
        return Promise.resolve({
            exists: function () { return false; },
            data: function () { return null; },
        });
    }),
    onSnapshot: vitest_1.vi.fn(function () { return function () { }; }),
    updateDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    collection: vitest_1.vi.fn(),
    addDoc: vitest_1.vi.fn(function () { return Promise.resolve({ id: 'new-org-id' }); }),
    writeBatch: vitest_1.vi.fn(function () { return ({
        set: vitest_1.vi.fn(),
        update: vitest_1.vi.fn(),
        delete: vitest_1.vi.fn(),
        commit: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    }); }),
    serverTimestamp: vitest_1.vi.fn(function () { return new Date(); }),
}); });
// Mock @/firebase module
vitest_1.vi.mock('@/firebase', function () { return ({
    auth: {},
    db: {},
}); });
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
};
function triggerAuthStateChange(user) {
    return __awaiter(this, void 0, void 0, function () {
        var callbacks;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    callbacks = globalThis.__authCallbacks;
                    if (!callbacks) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.all(callbacks.map(function (cb) { return cb(user); }))];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
/** Path-aware doc()/getDoc() mock setup for loadOrgContext coverage. */
function mockOrgDocPath(orgData) {
    vitest_1.vi.mocked(firestore_1.doc).mockImplementation(function (_db) {
        var segments = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            segments[_i - 1] = arguments[_i];
        }
        return ({ path: segments.join('/') });
    });
    vitest_1.vi.mocked(firestore_1.getDoc).mockImplementation(function (ref) {
        var path = ref.path;
        if (path === 'users/test-uid') {
            return Promise.resolve({
                exists: function () { return true; },
                data: function () { return ({ orgIds: ['org-1'] }); },
            });
        }
        if (path === 'organizations/org-1') {
            return Promise.resolve({
                exists: function () { return orgData !== null; },
                data: function () { return orgData; },
            });
        }
        return Promise.resolve({ exists: function () { return false; }, data: function () { return null; } });
    });
}
(0, vitest_1.describe)('useAuthStore', function () {
    (0, vitest_1.beforeEach)(function () {
        (0, pinia_1.setActivePinia)((0, pinia_1.createPinia)());
        vitest_1.vi.clearAllMocks();
        globalThis.__authCallbacks = [];
    });
    (0, vitest_1.describe)('initial state', function () {
        (0, vitest_1.it)('starts with user as null', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        (0, vitest_1.expect)(store.user).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('starts with isReady as false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        (0, vitest_1.expect)(store.isReady).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('isAuthenticated is false when user is null', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        (0, vitest_1.expect)(store.isAuthenticated).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('isReady', function () {
        (0, vitest_1.it)('becomes true after onAuthStateChanged fires', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        (0, vitest_1.expect)(store.isReady).toBe(false);
                        triggerAuthStateChange(null);
                        (0, vitest_1.expect)(store.isReady).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('isAuthenticated becomes true when user is set via onAuthStateChanged', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        triggerAuthStateChange(mockUser);
                        (0, vitest_1.expect)(store.isAuthenticated).toBe(true);
                        (0, vitest_1.expect)(store.user).toEqual(mockUser);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('loginWithGoogle', function () {
        (0, vitest_1.it)('calls signInWithPopup with GoogleAuthProvider', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithPopup).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithGoogle()];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.signInWithPopup).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns user on success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithPopup).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithGoogle()];
                    case 2:
                        result = _a.sent();
                        (0, vitest_1.expect)(result).toEqual(mockUser);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns null when popup is closed by user', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithPopup).mockRejectedValueOnce({
                            code: 'auth/popup-closed-by-user',
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithGoogle()];
                    case 2:
                        result = _a.sent();
                        (0, vitest_1.expect)(result).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('loginWithEmail', function () {
        (0, vitest_1.it)('calls signInWithEmailAndPassword with correct args', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithEmailAndPassword).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithEmail('test@example.com', 'password123')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.signInWithEmailAndPassword).toHaveBeenCalledWith(vitest_1.expect.anything(), 'test@example.com', 'password123');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('auto-creates account on auth/user-not-found', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithEmailAndPassword).mockRejectedValueOnce({
                            code: 'auth/user-not-found',
                        });
                        vitest_1.vi.mocked(auth_1.createUserWithEmailAndPassword).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithEmail('new@example.com', 'password123')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.createUserWithEmailAndPassword).toHaveBeenCalledWith(vitest_1.expect.anything(), 'new@example.com', 'password123');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('also auto-creates account on auth/invalid-credential', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signInWithEmailAndPassword).mockRejectedValueOnce({
                            code: 'auth/invalid-credential',
                        });
                        vitest_1.vi.mocked(auth_1.createUserWithEmailAndPassword).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithEmail('new@example.com', 'password123')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.createUserWithEmailAndPassword).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('registerWithEmail', function () {
        (0, vitest_1.it)('calls createUserWithEmailAndPassword directly', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.createUserWithEmailAndPassword).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.registerWithEmail('new@example.com', 'password123')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.createUserWithEmailAndPassword).toHaveBeenCalledWith(vitest_1.expect.anything(), 'new@example.com', 'password123');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('resetPassword', function () {
        (0, vitest_1.it)('calls sendPasswordResetEmail with provided email', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.sendPasswordResetEmail).mockResolvedValueOnce(undefined);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.resetPassword('test@example.com')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.sendPasswordResetEmail).toHaveBeenCalledWith(vitest_1.expect.anything(), 'test@example.com');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('logout', function () {
        (0, vitest_1.it)('calls signOut', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signOut).mockResolvedValueOnce(undefined);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.logout()];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(auth_1.signOut).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('user becomes null after logout', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vitest_1.vi.mocked(auth_1.signOut).mockResolvedValueOnce(undefined);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        // Set user first
                        triggerAuthStateChange(mockUser);
                        (0, vitest_1.expect)(store.user).toEqual(mockUser);
                        // Logout
                        return [4 /*yield*/, store.logout()];
                    case 2:
                        // Logout
                        _a.sent();
                        triggerAuthStateChange(null);
                        (0, vitest_1.expect)(store.user).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('ensureUserDocument', function () {
        (0, vitest_1.it)('creates user document after login', function () { return __awaiter(void 0, void 0, void 0, function () {
            var setDoc, useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        setDoc = (_a.sent()).setDoc;
                        vitest_1.vi.mocked(auth_1.signInWithPopup).mockResolvedValueOnce({
                            user: mockUser,
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 2:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, store.loginWithGoogle()];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(setDoc).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('vwModeEnabled (D-15/D-16)', function () {
        (0, vitest_1.it)('defaults to true after loadOrgContext when the org doc has no vwModeEnabled field', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockOrgDocPath({ name: 'Test Org' });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, triggerAuthStateChange(mockUser)];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(store.vwModeEnabled).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('reflects an explicit false vwModeEnabled field on the org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, triggerAuthStateChange(mockUser)];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(store.vwModeEnabled).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('resets to true on logout', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useAuthStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false });
                        vitest_1.vi.mocked(auth_1.signOut).mockResolvedValueOnce(undefined);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../auth'); })];
                    case 1:
                        useAuthStore = (_a.sent()).useAuthStore;
                        store = useAuthStore();
                        return [4 /*yield*/, triggerAuthStateChange(mockUser)];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(store.vwModeEnabled).toBe(false);
                        return [4 /*yield*/, store.logout()];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(store.vwModeEnabled).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
