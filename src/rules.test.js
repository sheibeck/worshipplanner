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
var vitest_1 = require("vitest");
var rules_unit_testing_1 = require("@firebase/rules-unit-testing");
var fs_1 = require("fs");
var firestore_1 = require("firebase/firestore");
var testEnv;
(0, vitest_1.beforeAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, rules_unit_testing_1.initializeTestEnvironment)({
                    projectId: 'test-project',
                    firestore: {
                        rules: (0, fs_1.readFileSync)('firestore.rules', 'utf8'),
                        host: '127.0.0.1',
                        port: 8080,
                    },
                })];
            case 1:
                testEnv = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, vitest_1.afterEach)(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, testEnv.clearFirestore()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, vitest_1.afterAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, testEnv.cleanup()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
// Helper: seed a membership doc bypassing rules
function seedMembershipDoc(orgId, uid, role) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testEnv.withSecurityRulesDisabled(function (context) { return __awaiter(_this, void 0, void 0, function () {
                        var db;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    db = context.firestore();
                                    return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', orgId, 'members', uid), {
                                            role: role,
                                            joinedAt: new Date(),
                                        })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Helper: seed any doc bypassing rules
function seedDoc(path, data) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testEnv.withSecurityRulesDisabled(function (context) { return __awaiter(_this, void 0, void 0, function () {
                        var db, parts, ref;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    db = context.firestore();
                                    parts = path.split('/');
                                    ref = firestore_1.doc.apply(void 0, __spreadArray([db, parts[0]], parts.slice(1), false));
                                    return [4 /*yield*/, (0, firestore_1.setDoc)(ref, data)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
(0, vitest_1.describe)('Unauthenticated access', function () {
    (0, vitest_1.it)('denies unauthenticated read on /organizations/{orgId}', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA')))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies unauthenticated read on /users/{uid}', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'users', 'userA')))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('Org member access', function () {
    (0, vitest_1.it)('allows org member to read their org', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows org member to read members subcollection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'members', 'userA')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows org editor to read nested collections (songs)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('organizations/orgA/songs/song1', { title: 'Amazing Grace' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'songs', 'song1')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('Cross-org isolation', function () {
    (0, vitest_1.it)('denies cross-org read on org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgB')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies cross-org nested collection read', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgB', 'songs', 'song1')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('User profile isolation', function () {
    (0, vitest_1.it)('allows user to read own profile', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'users', 'userA')))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies user from reading another user profile', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'users', 'userB')))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('Editor vs viewer write permissions', function () {
    (0, vitest_1.it)('allows editor to write org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA'), {
                            name: "UserA's Church",
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies viewer from writing org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA'), {
                            name: "UserA's Church",
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('Catch-all deny', function () {
    (0, vitest_1.it)('denies access to undefined paths', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'randomCollection', 'randomDoc')))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('orgSlugs — public read, org-editor-scoped create-once claim (WR-01)', function () {
    (0, vitest_1.it)('allows unauthenticated read of an orgSlugs doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('orgSlugs/grace-church', { orgId: 'orgA' })];
                case 1:
                    _a.sent();
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows an editor of the target org to create an unclaimed orgSlugs doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // WR-01 regression: a signed-in user with no membership in the target orgId must NOT be
    // able to claim a slug for it (slug-squatting with an arbitrary/victim orgId).
    (0, vitest_1.it)('denies a signed-in user with no membership in the target org from claiming a slug for it', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies a member of a DIFFERENT org from claiming a slug for orgA (cross-tenant slug-squatting)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies unauthenticated write to orgSlugs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies a second write to an already-claimed orgSlugs slug, even from an editor of the new orgId (first-writer-wins)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('orgSlugs/grace-church', { orgId: 'orgA' })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'orgSlugs', 'grace-church'), { orgId: 'orgB' }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('quarterShares — public read, org-editor-scoped create/update (CR-01)', function () {
    (0, vitest_1.it)('allows unauthenticated read of a quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 1:
                    _a.sent();
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows an editor of the owning org to create a quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgA',
                            orgSlug: 'grace-church',
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies a signed-in user with no membership in the target org from creating a quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgA',
                            orgSlug: 'grace-church',
                        }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies a member of a DIFFERENT org from creating a quarterShares doc for orgA (cross-tenant)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgA',
                            orgSlug: 'grace-church',
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows an editor of the owning org to update (overwrite-in-place) an existing quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgA',
                            orgSlug: 'grace-church',
                            updatedAgain: true,
                        }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // CR-01 regression: this test previously asserted the overwrite SUCCEEDED for a completely
    // unaffiliated user (no membership seeded for any org) — that assertion encoded the
    // cross-tenant vulnerability itself. It is now inverted to assert the write is DENIED.
    (0, vitest_1.it)('denies a signed-in user with no org membership from overwriting another org\'s existing quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgSlug: 'grace-church',
                            orgId: 'orgA',
                            updatedAgain: true,
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies an editor of a DIFFERENT org from overwriting orgA\'s existing quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgA',
                            orgSlug: 'grace-church',
                            updatedAgain: true,
                        }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies an editor of the owning org from reassigning an existing quarterShares doc to a different orgId', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), {
                            orgId: 'orgB',
                            orgSlug: 'grace-church',
                            updatedAgain: true,
                        }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies unauthenticated write to quarterShares', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026'), { orgId: 'orgA', orgSlug: 'grace-church' }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // Delete = revoke a public share when its quarter is deleted (deleteQuarter).
    (0, vitest_1.it)('allows an editor of the owning org to delete a quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies an editor of a DIFFERENT org from deleting orgA\'s quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies unauthenticated delete of a quarterShares doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })];
                case 1:
                    _a.sent();
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'quarterShares', 'grace-church__q3-2026')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('shareTokens — public read, signed-in create, editor-scoped delete (revoke on quarter delete)', function () {
    (0, vitest_1.it)('allows unauthenticated read of a shareTokens doc (public share link)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })];
                case 1:
                    _a.sent();
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'shareTokens', 'tok-abc')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('allows an editor of the owning org to delete a shareTokens doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'shareTokens', 'tok-abc')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies an editor of a DIFFERENT org from deleting orgA\'s shareTokens doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgB', 'userB', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userB');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'shareTokens', 'tok-abc')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies unauthenticated delete of a shareTokens doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })];
                case 1:
                    _a.sent();
                    context = testEnv.unauthenticatedContext();
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'shareTokens', 'tok-abc')))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('denies updating a shareTokens doc (frozen snapshot — update stays false)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'shareTokens', 'tok-abc'), { orgId: 'orgA', quarterId: 'q1', tampered: true }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('Editor/Viewer RBAC', function () {
    (0, vitest_1.it)('editor can write to songs collection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'songs', 'song1'), {
                            title: 'Amazing Grace',
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer cannot write to songs collection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'songs', 'song1'), {
                            title: 'Amazing Grace',
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer cannot read songs collection (songs are editor-only)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('organizations/orgA/songs/song1', { title: 'Amazing Grace' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'songs', 'song1')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer can read services collection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('organizations/orgA/services/svc1', { date: '2026-03-07' })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'services', 'svc1')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer cannot write to services collection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'services', 'svc1'), {
                            date: '2026-03-07',
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('editor can read invites subcollection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('organizations/orgA/invites/member@example.com', {
                            role: 'viewer',
                            status: 'pending',
                        })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'invites', 'member@example.com')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer cannot read invites subcollection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, seedDoc('organizations/orgA/invites/member@example.com', {
                            role: 'viewer',
                            status: 'pending',
                        })];
                case 2:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'invites', 'member@example.com')))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('editor can write to invites subcollection', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA', 'invites', 'member@example.com'), {
                            role: 'viewer',
                            status: 'pending',
                            invitedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('editor can write to org doc (update name)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'editor')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA'), {
                            name: 'Grace Community Church',
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('viewer cannot write to org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
        var context, db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, seedMembershipDoc('orgA', 'userA', 'viewer')];
                case 1:
                    _a.sent();
                    context = testEnv.authenticatedContext('userA');
                    db = context.firestore();
                    return [4 /*yield*/, (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(db, 'organizations', 'orgA'), {
                            name: 'Grace Community Church',
                            updatedAt: new Date(),
                        }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
