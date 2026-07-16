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
exports.useAuthStore = void 0;
var vue_1 = require("vue");
var pinia_1 = require("pinia");
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var memberUnsub = null;
exports.useAuthStore = (0, pinia_1.defineStore)('auth', function () {
    var user = (0, vue_1.ref)(null);
    var isReady = (0, vue_1.ref)(false);
    var orgId = (0, vue_1.ref)(null);
    var orgName = (0, vue_1.ref)(null);
    // Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.
    var orgSlug = (0, vue_1.ref)(null);
    var userRole = (0, vue_1.ref)(null);
    // Planning Center credential state
    var pcAppId = (0, vue_1.ref)(null);
    var pcSecret = (0, vue_1.ref)(null);
    // Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON —
    // missing field on legacy org docs means VW mode is enabled. Single source of
    // truth every VW surface gates on (D-16). Mirror-written from Settings; NOT
    // live-synced via onSnapshot (Pitfall 2).
    var vwModeEnabled = (0, vue_1.ref)(true);
    var isAuthenticated = (0, vue_1.computed)(function () { return user.value !== null; });
    var isEditor = (0, vue_1.computed)(function () { return userRole.value === 'editor'; });
    var hasPcCredentials = (0, vue_1.computed)(function () {
        return pcAppId.value !== null &&
            pcSecret.value !== null &&
            pcAppId.value !== '' &&
            pcSecret.value !== '';
    });
    var pcCredentials = (0, vue_1.computed)(function () {
        if (!hasPcCredentials.value)
            return null;
        return {
            appId: pcAppId.value,
            secret: pcSecret.value,
        };
    });
    function waitForRole() {
        return new Promise(function (resolve) {
            if (userRole.value !== null || !isAuthenticated.value) {
                resolve();
                return;
            }
            var unwatch = (0, vue_1.watch)(userRole, function (val) {
                if (val !== null) {
                    unwatch();
                    resolve();
                }
            });
        });
    }
    function loadOrgContext(uid) {
        return __awaiter(this, void 0, Promise, function () {
            var userRef, userSnap, userData, ids, orgRef, orgSnap, orgData;
            var _this = this;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        userRef = (0, firestore_1.doc)(firebase_1.db, 'users', uid);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(userRef)];
                    case 1:
                        userSnap = _g.sent();
                        userData = userSnap.exists() ? userSnap.data() : null;
                        ids = (_a = userData === null || userData === void 0 ? void 0 : userData.orgIds) !== null && _a !== void 0 ? _a : [];
                        if (ids.length === 0) {
                            orgId.value = null;
                            orgName.value = null;
                            orgSlug.value = null;
                            userRole.value = null;
                            pcAppId.value = null;
                            pcSecret.value = null;
                            vwModeEnabled.value = true;
                            return [2 /*return*/];
                        }
                        orgId.value = ids[0];
                        orgRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', ids[0]);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(orgRef)];
                    case 2:
                        orgSnap = _g.sent();
                        if (orgSnap.exists()) {
                            orgData = orgSnap.data();
                            orgName.value = (_b = orgData.name) !== null && _b !== void 0 ? _b : null;
                            orgSlug.value = (_c = orgData.slug) !== null && _c !== void 0 ? _c : null;
                            pcAppId.value = (_d = orgData.pcAppId) !== null && _d !== void 0 ? _d : null;
                            pcSecret.value = (_e = orgData.pcSecret) !== null && _e !== void 0 ? _e : null;
                            vwModeEnabled.value = (_f = orgData.vwModeEnabled) !== null && _f !== void 0 ? _f : true;
                        }
                        // Unsubscribe from previous listener if any
                        memberUnsub === null || memberUnsub === void 0 ? void 0 : memberUnsub();
                        memberUnsub = (0, firestore_1.onSnapshot)((0, firestore_1.doc)(firebase_1.db, 'organizations', ids[0], 'members', uid), function (snap) { return __awaiter(_this, void 0, void 0, function () {
                            var data, role, patch;
                            var _a, _b, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        if (!snap.exists()) {
                                            userRole.value = null;
                                            return [2 /*return*/];
                                        }
                                        data = snap.data();
                                        role = data.role;
                                        patch = {};
                                        if (role === 'admin')
                                            patch.role = 'editor';
                                        if (!data.email && ((_a = user.value) === null || _a === void 0 ? void 0 : _a.email)) {
                                            patch.email = (_b = user.value.email) !== null && _b !== void 0 ? _b : '';
                                            patch.displayName = (_c = user.value.displayName) !== null && _c !== void 0 ? _c : '';
                                        }
                                        if (!(Object.keys(patch).length > 0)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, (0, firestore_1.updateDoc)(snap.ref, patch)];
                                    case 1:
                                        _d.sent();
                                        if (role === 'admin')
                                            return [2 /*return*/]; // next snapshot sets userRole
                                        _d.label = 2;
                                    case 2:
                                        userRole.value = (role === 'admin' ? 'editor' : role);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [2 /*return*/];
                }
            });
        });
    }
    // Listen for auth state changes
    (0, auth_1.onAuthStateChanged)(firebase_1.auth, function (firebaseUser) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user.value = firebaseUser;
                    if (!firebaseUser) return [3 /*break*/, 3];
                    return [4 /*yield*/, ensureUserDocument(firebaseUser)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, loadOrgContext(firebaseUser.uid)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    orgId.value = null;
                    orgName.value = null;
                    orgSlug.value = null;
                    userRole.value = null;
                    vwModeEnabled.value = true;
                    memberUnsub === null || memberUnsub === void 0 ? void 0 : memberUnsub();
                    memberUnsub = null;
                    _a.label = 4;
                case 4:
                    isReady.value = true;
                    return [2 /*return*/];
            }
        });
    }); });
    function ensureUserDocument(firebaseUser) {
        return __awaiter(this, void 0, Promise, function () {
            var userRef, userSnap, userData, hasOrg, email, lookupRef, lookupSnap, inviteData, inviteOrgId, role, batch, inviteRef, memberRef, batch, orgRef, newOrgId, memberRef;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        userRef = (0, firestore_1.doc)(firebase_1.db, 'users', firebaseUser.uid);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(userRef)
                            // Update/create the user profile document
                        ];
                    case 1:
                        userSnap = _f.sent();
                        // Update/create the user profile document
                        return [4 /*yield*/, (0, firestore_1.setDoc)(userRef, {
                                email: firebaseUser.email,
                                displayName: firebaseUser.displayName,
                                photoURL: firebaseUser.photoURL,
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            }, { merge: true })
                            // Always check for pending invite (even if user already has an org)
                        ];
                    case 2:
                        // Update/create the user profile document
                        _f.sent();
                        userData = userSnap.exists() ? userSnap.data() : null;
                        hasOrg = (userData === null || userData === void 0 ? void 0 : userData.orgIds) && userData.orgIds.length > 0;
                        email = (_a = firebaseUser.email) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                        if (!email) return [3 /*break*/, 5];
                        lookupRef = (0, firestore_1.doc)(firebase_1.db, 'inviteLookup', email);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(lookupRef)];
                    case 3:
                        lookupSnap = _f.sent();
                        if (!lookupSnap.exists()) return [3 /*break*/, 5];
                        inviteData = lookupSnap.data();
                        inviteOrgId = inviteData.orgId;
                        role = inviteData.role;
                        batch = (0, firestore_1.writeBatch)(firebase_1.db);
                        // Delete inviteLookup entry
                        batch.delete(lookupRef);
                        inviteRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', inviteOrgId, 'invites', email);
                        batch.delete(inviteRef);
                        memberRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', inviteOrgId, 'members', firebaseUser.uid);
                        batch.set(memberRef, {
                            role: role,
                            joinedAt: (0, firestore_1.serverTimestamp)(),
                            displayName: (_b = firebaseUser.displayName) !== null && _b !== void 0 ? _b : '',
                            email: (_c = firebaseUser.email) !== null && _c !== void 0 ? _c : '',
                        });
                        // Switch user to the invited org
                        batch.update(userRef, { orgIds: [inviteOrgId] });
                        return [4 /*yield*/, batch.commit()];
                    case 4:
                        _f.sent();
                        return [2 /*return*/];
                    case 5:
                        if (!!hasOrg) return [3 /*break*/, 7];
                        batch = (0, firestore_1.writeBatch)(firebase_1.db);
                        orgRef = (0, firestore_1.doc)((0, firestore_1.collection)(firebase_1.db, 'organizations'));
                        newOrgId = orgRef.id;
                        batch.set(orgRef, {
                            name: "".concat(firebaseUser.displayName || 'My', "'s Church"),
                            createdAt: (0, firestore_1.serverTimestamp)(),
                            createdBy: firebaseUser.uid,
                        });
                        memberRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', newOrgId, 'members', firebaseUser.uid);
                        batch.set(memberRef, {
                            role: 'editor',
                            joinedAt: (0, firestore_1.serverTimestamp)(),
                            displayName: (_d = firebaseUser.displayName) !== null && _d !== void 0 ? _d : '',
                            email: (_e = firebaseUser.email) !== null && _e !== void 0 ? _e : '',
                        });
                        batch.update(userRef, {
                            orgIds: [newOrgId],
                        });
                        return [4 /*yield*/, batch.commit()];
                    case 6:
                        _f.sent();
                        _f.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function loginWithGoogle() {
        return __awaiter(this, void 0, Promise, function () {
            var provider, result, error_1, firebaseError;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        provider = new auth_1.GoogleAuthProvider();
                        return [4 /*yield*/, (0, auth_1.signInWithPopup)(firebase_1.auth, provider)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, ensureUserDocument(result.user)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, result.user];
                    case 3:
                        error_1 = _a.sent();
                        firebaseError = error_1;
                        if ((firebaseError === null || firebaseError === void 0 ? void 0 : firebaseError.code) === 'auth/popup-closed-by-user') {
                            return [2 /*return*/, null];
                        }
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function loginWithEmail(email, password) {
        return __awaiter(this, void 0, Promise, function () {
            var result, error_2, firebaseError, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 7]);
                        return [4 /*yield*/, (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, email, password)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, ensureUserDocument(result.user)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, result.user];
                    case 3:
                        error_2 = _a.sent();
                        firebaseError = error_2;
                        if (!((firebaseError === null || firebaseError === void 0 ? void 0 : firebaseError.code) === 'auth/user-not-found' ||
                            (firebaseError === null || firebaseError === void 0 ? void 0 : firebaseError.code) === 'auth/invalid-credential')) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, email, password)];
                    case 4:
                        result = _a.sent();
                        return [4 /*yield*/, ensureUserDocument(result.user)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, result.user];
                    case 6: throw error_2;
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function registerWithEmail(email, password) {
        return __awaiter(this, void 0, Promise, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, email, password)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, ensureUserDocument(result.user)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, result.user];
                }
            });
        });
    }
    function resetPassword(email) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, auth_1.sendPasswordResetEmail)(firebase_1.auth, email)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function logout() {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        orgId.value = null;
                        orgName.value = null;
                        orgSlug.value = null;
                        userRole.value = null;
                        pcAppId.value = null;
                        pcSecret.value = null;
                        vwModeEnabled.value = true;
                        memberUnsub === null || memberUnsub === void 0 ? void 0 : memberUnsub();
                        memberUnsub = null;
                        return [4 /*yield*/, (0, auth_1.signOut)(firebase_1.auth)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function setPcCredentials(appId, secret) {
        pcAppId.value = appId;
        pcSecret.value = secret;
    }
    return {
        user: user,
        isReady: isReady,
        isAuthenticated: isAuthenticated,
        orgId: orgId,
        orgName: orgName,
        orgSlug: orgSlug,
        userRole: userRole,
        isEditor: isEditor,
        waitForRole: waitForRole,
        loginWithGoogle: loginWithGoogle,
        loginWithEmail: loginWithEmail,
        registerWithEmail: registerWithEmail,
        resetPassword: resetPassword,
        logout: logout,
        ensureUserDocument: ensureUserDocument,
        pcAppId: pcAppId,
        pcSecret: pcSecret,
        hasPcCredentials: hasPcCredentials,
        pcCredentials: pcCredentials,
        setPcCredentials: setPcCredentials,
        vwModeEnabled: vwModeEnabled,
    };
});
