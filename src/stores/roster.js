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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRosterStore = void 0;
var vue_1 = require("vue");
var pinia_1 = require("pinia");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var roster_1 = require("@/types/roster");
// Normalize a name for re-import matching: trim, collapse internal whitespace, lowercase.
function normalizeName(name) {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
exports.useRosterStore = (0, pinia_1.defineStore)('roster', function () {
    var people = (0, vue_1.ref)([]);
    var roles = (0, vue_1.ref)([]);
    var isLoading = (0, vue_1.ref)(true);
    var orgId = (0, vue_1.ref)(null);
    var unsubscribePeopleFn = null;
    var unsubscribeRolesFn = null;
    // active === true only — inactive (soft-deleted) people are excluded (D-20).
    var activePeople = (0, vue_1.computed)(function () { return people.value.filter(function (p) { return p.active; }); });
    // Alphabetical view of roles for DISPLAY only (dropdowns/checklists) — logic
    // and lookups (find-by-id, membership tests) must keep using `roles` (ordered
    // by `order`, which drives the scheduler's stable inner loop).
    var rolesSorted = (0, vue_1.computed)(function () { return __spreadArray([], roles.value, true).sort(function (a, b) { return a.name.localeCompare(b.name); }); });
    function subscribe(orgIdValue) {
        if (unsubscribePeopleFn) {
            unsubscribePeopleFn();
        }
        if (unsubscribeRolesFn) {
            unsubscribeRolesFn();
        }
        orgId.value = orgIdValue;
        var peopleQuery = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgIdValue, 'people'), (0, firestore_1.orderBy)('name'));
        unsubscribePeopleFn = (0, firestore_1.onSnapshot)(peopleQuery, function (snap) {
            people.value = snap.docs.map(function (d) { return (__assign({ id: d.id }, d.data())); });
            isLoading.value = false;
        });
        // Roles ordered by `order` ascending — drives the scheduler's stable inner loop.
        var rolesQuery = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgIdValue, 'roles'), (0, firestore_1.orderBy)('order'));
        unsubscribeRolesFn = (0, firestore_1.onSnapshot)(rolesQuery, function (snap) {
            roles.value = snap.docs.map(function (d) { return (__assign({ id: d.id }, d.data())); });
            // One-time migration (D-09): the seeded 'vocals' role predates the dedicated
            // 'vocals' RoleGroup and was originally classified under 'band'. Guarded,
            // case-insensitive name check, idempotent — never touches any other role.
            for (var _i = 0, _a = snap.docs; _i < _a.length; _i++) {
                var d = _a[_i];
                var data = d.data();
                if (String(data.name).toLowerCase() === 'vocals' && data.group === 'band') {
                    void (0, firestore_1.updateDoc)(d.ref, { group: 'vocals' });
                }
            }
        });
    }
    function unsubscribeAll() {
        unsubscribePeopleFn === null || unsubscribePeopleFn === void 0 ? void 0 : unsubscribePeopleFn();
        unsubscribePeopleFn = null;
        unsubscribeRolesFn === null || unsubscribeRolesFn === void 0 ? void 0 : unsubscribeRolesFn();
        unsubscribeRolesFn = null;
        orgId.value = null;
        people.value = [];
        roles.value = [];
        isLoading.value = true;
    }
    // D-04/D-07: this store no longer synthesizes or persists standing per-person
    // frequency — quarter-scoped serve cadence lives solely on PersonQuarterData
    // (see quarters.ts), never on the person doc.
    function addPerson(input) {
        return __awaiter(this, void 0, Promise, function () {
            var docRef;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'people'), {
                                name: input.name,
                                email: input.email,
                                phone: (_a = input.phone) !== null && _a !== void 0 ? _a : '',
                                roles: (_b = input.roles) !== null && _b !== void 0 ? _b : [],
                                pcPersonId: (_c = input.pcPersonId) !== null && _c !== void 0 ? _c : null,
                                active: true,
                                createdAt: (0, firestore_1.serverTimestamp)(),
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        docRef = _d.sent();
                        return [2 /*return*/, docRef.id];
                }
            });
        });
    }
    // D-04: writes only the standing fields this store persists — any other
    // properties a caller passes (e.g. a not-yet-migrated legacy per-person
    // cadence value) are intentionally not forwarded to Firestore.
    function updatePerson(id, patch) {
        return __awaiter(this, void 0, Promise, function () {
            var updates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        updates = { updatedAt: (0, firestore_1.serverTimestamp)() };
                        if (patch.name !== undefined)
                            updates.name = patch.name;
                        if (patch.email !== undefined)
                            updates.email = patch.email;
                        if (patch.phone !== undefined)
                            updates.phone = patch.phone;
                        if (patch.roles !== undefined)
                            updates.roles = patch.roles;
                        if (patch.pcPersonId !== undefined)
                            updates.pcPersonId = patch.pcPersonId;
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'people', id), updates)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function deactivatePerson(id) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'people', id), {
                                active: false,
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function reactivatePerson(id) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'people', id), {
                                active: true,
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // Permanently remove a single person. Intended for inactive volunteers only —
    // the UI surfaces this from the Inactive Volunteers list (deactivate first),
    // so an actively-scheduled person is never one click from deletion.
    function deletePerson(id) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'people', id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function upsertPeople(inputs) {
        return __awaiter(this, void 0, Promise, function () {
            var byPcId, byName, _i, _a, person, added, updated, _b, inputs_1, incoming, existing, updateData;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/, { added: 0, updated: 0 }
                                // Build lookup maps for O(1) matching: pcPersonId first, then normalized name.
                            ];
                        byPcId = new Map();
                        byName = new Map();
                        for (_i = 0, _a = people.value; _i < _a.length; _i++) {
                            person = _a[_i];
                            if (person.pcPersonId)
                                byPcId.set(person.pcPersonId, person);
                            byName.set(normalizeName(person.name), person);
                        }
                        added = 0;
                        updated = 0;
                        _b = 0, inputs_1 = inputs;
                        _g.label = 1;
                    case 1:
                        if (!(_b < inputs_1.length)) return [3 /*break*/, 6];
                        incoming = inputs_1[_b];
                        existing = void 0;
                        if (incoming.pcPersonId) {
                            existing = byPcId.get(incoming.pcPersonId);
                        }
                        if (!existing) {
                            existing = byName.get(normalizeName(incoming.name));
                        }
                        if (!existing) return [3 /*break*/, 3];
                        updateData = {
                            name: incoming.name,
                            email: incoming.email,
                            updatedAt: (0, firestore_1.serverTimestamp)(),
                        };
                        if (incoming.phone !== undefined)
                            updateData.phone = incoming.phone;
                        // Roles are MERGED (union), never replaced — an import must never remove a
                        // role an existing volunteer already has in Worship Planner. A PC/CSV import
                        // only ever tells us the roles that source knows about; roles added in-app
                        // (or from a different team's import) must be preserved.
                        if (incoming.roles !== undefined) {
                            updateData.roles = Array.from(new Set(__spreadArray(__spreadArray([], ((_c = existing.roles) !== null && _c !== void 0 ? _c : []), true), incoming.roles, true)));
                        }
                        if (incoming.pcPersonId !== undefined)
                            updateData.pcPersonId = incoming.pcPersonId;
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'people', existing.id), updateData)];
                    case 2:
                        _g.sent();
                        updated++;
                        return [3 /*break*/, 5];
                    case 3: 
                    // Brand-new person via import — standing fields only (D-04).
                    return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'people'), {
                            name: incoming.name,
                            email: incoming.email,
                            phone: (_d = incoming.phone) !== null && _d !== void 0 ? _d : '',
                            roles: (_e = incoming.roles) !== null && _e !== void 0 ? _e : [],
                            pcPersonId: (_f = incoming.pcPersonId) !== null && _f !== void 0 ? _f : null,
                            active: true,
                            createdAt: (0, firestore_1.serverTimestamp)(),
                            updatedAt: (0, firestore_1.serverTimestamp)(),
                        })];
                    case 4:
                        // Brand-new person via import — standing fields only (D-04).
                        _g.sent();
                        added++;
                        _g.label = 5;
                    case 5:
                        _b++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, { added: added, updated: updated }];
                }
            });
        });
    }
    // HARD-deletes every person doc for the org (irreversible). Used to clear a
    // bad wholesale import before re-importing selectively. Does NOT touch roles
    // or quarter docs. Batched at Firestore's 500-op limit. Returns count deleted.
    function deleteAllPeople() {
        return __awaiter(this, void 0, Promise, function () {
            var snap, deleted, batch, ops, _i, _a, d;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/, 0];
                        return [4 /*yield*/, (0, firestore_1.getDocs)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'people'))];
                    case 1:
                        snap = _b.sent();
                        deleted = 0;
                        batch = (0, firestore_1.writeBatch)(firebase_1.db);
                        ops = 0;
                        _i = 0, _a = snap.docs;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        d = _a[_i];
                        batch.delete(d.ref);
                        deleted++;
                        ops++;
                        if (!(ops === 500)) return [3 /*break*/, 4];
                        return [4 /*yield*/, batch.commit()];
                    case 3:
                        _b.sent();
                        batch = (0, firestore_1.writeBatch)(firebase_1.db);
                        ops = 0;
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        if (!(ops > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, batch.commit()];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7: return [2 /*return*/, deleted];
                }
            });
        });
    }
    // Seeds the grouped default role list (guitar/drums/vocals/bass/sound/
    // livestream/projection/scripture reader — see DEFAULT_ROLES) only when the
    // org has no roles yet. Calling this again once roles exist writes nothing.
    function seedDefaultRolesIfEmpty() {
        return __awaiter(this, void 0, Promise, function () {
            var _i, DEFAULT_ROLES_1, role;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        if (roles.value.length !== 0)
                            return [2 /*return*/];
                        _i = 0, DEFAULT_ROLES_1 = roster_1.DEFAULT_ROLES;
                        _a.label = 1;
                    case 1:
                        if (!(_i < DEFAULT_ROLES_1.length)) return [3 /*break*/, 4];
                        role = DEFAULT_ROLES_1[_i];
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'roles'), __assign(__assign({}, role), { createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function addRole(input) {
        return __awaiter(this, void 0, Promise, function () {
            var docRef;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'roles'), __assign(__assign({}, input), { createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        docRef = _a.sent();
                        return [2 /*return*/, docRef.id];
                }
            });
        });
    }
    function updateRole(id, patch) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'roles', id), __assign(__assign({}, patch), { updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function deleteRole(id) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        // Hard-delete the role config doc — clearing this role's assignments
                        // across quarters is handled by the quarters store / UI (Plan 06/08).
                        return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'roles', id))];
                    case 1:
                        // Hard-delete the role config doc — clearing this role's assignments
                        // across quarters is handled by the quarters store / UI (Plan 06/08).
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        people: people,
        roles: roles,
        isLoading: isLoading,
        orgId: orgId,
        activePeople: activePeople,
        rolesSorted: rolesSorted,
        subscribe: subscribe,
        unsubscribeAll: unsubscribeAll,
        addPerson: addPerson,
        updatePerson: updatePerson,
        deactivatePerson: deactivatePerson,
        reactivatePerson: reactivatePerson,
        deletePerson: deletePerson,
        upsertPeople: upsertPeople,
        deleteAllPeople: deleteAllPeople,
        seedDefaultRolesIfEmpty: seedDefaultRolesIfEmpty,
        addRole: addRole,
        updateRole: updateRole,
        deleteRole: deleteRole,
    };
});
