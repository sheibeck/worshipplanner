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
exports.useQuartersStore = void 0;
var vue_1 = require("vue");
var pinia_1 = require("pinia");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var quarterDates_1 = require("@/utils/quarterDates");
var scheduler_1 = require("@/utils/scheduler");
var roster_1 = require("@/stores/roster");
var slug_1 = require("@/utils/slug");
// D-06: chronological ordering key for (year, quarterNum) — pure helper, no side effects.
function quarterKey(year, quarterNum) {
    return year * 4 + quarterNum;
}
// D-06: finds the chronologically prior quarter (if any) for new-quarter seeding.
function findPriorQuarter(quarters, year, quarterNum) {
    var target = quarterKey(year, quarterNum);
    return quarters
        .filter(function (q) { return quarterKey(q.year, q.quarter) < target; })
        .sort(function (a, b) { return quarterKey(b.year, b.quarter) - quarterKey(a.year, a.quarter); })[0];
}
exports.useQuartersStore = (0, pinia_1.defineStore)('quarters', function () {
    var quarters = (0, vue_1.ref)([]);
    var isLoading = (0, vue_1.ref)(true);
    var orgId = (0, vue_1.ref)(null);
    // Ephemeral (in-memory) record of which service dates had their assignments
    // change on the last generateProposal run, so the UI can highlight them. Not
    // persisted — cleared on reload, scoped to a quarter so a stale set from
    // another quarter never highlights the wrong grid.
    var lastRegenerate = (0, vue_1.ref)(null);
    var unsubscribeFn = null;
    function subscribe(orgIdValue) {
        if (unsubscribeFn) {
            unsubscribeFn();
        }
        orgId.value = orgIdValue;
        var q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgIdValue, 'quarters'), (0, firestore_1.orderBy)('createdAt', 'desc'));
        unsubscribeFn = (0, firestore_1.onSnapshot)(q, function (snap) {
            quarters.value = snap.docs.map(function (d) { return (__assign({ id: d.id }, d.data())); });
            isLoading.value = false;
        });
    }
    function unsubscribeAll() {
        unsubscribeFn === null || unsubscribeFn === void 0 ? void 0 : unsubscribeFn();
        unsubscribeFn = null;
        orgId.value = null;
        quarters.value = [];
        isLoading.value = true;
    }
    function getQuarter(quarterId) {
        var quarter = quarters.value.find(function (q) { return q.id === quarterId; });
        if (!quarter)
            throw new Error("Quarter ".concat(quarterId, " not found"));
        return quarter;
    }
    function updateQuarter(id, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', id), __assign(__assign({}, data), { updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // D-06: seeds each (person, role) frequency + pairing from the chronologically prior
    // quarter when one exists, else defaults to once/month (N=4). Blackout Sundays never
    // carry forward — always reset to []. T-16-01-01: this whole-map construction is safe
    // ONLY at quarter creation (writing into a brand-new, empty doc) — ongoing edits use
    // the scoped dot-path writes in setPersonAvailability/applyCsvToQuarter, never this path.
    function createQuarter(year, quarter, label) {
        return __awaiter(this, void 0, Promise, function () {
            var rosterStore, prior, personQuarterData, _i, _a, person, priorPQD, roleFrequency, _b, _c, roleId, docRef;
            var _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        rosterStore = (0, roster_1.useRosterStore)();
                        prior = findPriorQuarter(quarters.value, year, quarter);
                        personQuarterData = {};
                        // Only seed active volunteers — inactive people are excluded from schedule
                        // proposals, so seeding quarter data for them just creates throwaway entries.
                        for (_i = 0, _a = rosterStore.activePeople; _i < _a.length; _i++) {
                            person = _a[_i];
                            priorPQD = prior === null || prior === void 0 ? void 0 : prior.personQuarterData[person.id];
                            roleFrequency = {};
                            for (_b = 0, _c = person.roles; _b < _c.length; _b++) {
                                roleId = _c[_b];
                                roleFrequency[roleId] = (_e = (_d = priorPQD === null || priorPQD === void 0 ? void 0 : priorPQD.roleFrequency) === null || _d === void 0 ? void 0 : _d[roleId]) !== null && _e !== void 0 ? _e : { tier: 'regular', n: 4 };
                            }
                            personQuarterData[person.id] = {
                                personId: person.id,
                                blackoutDates: [], // D-06: never carried forward, always resets
                                pairedWith: (_f = priorPQD === null || priorPQD === void 0 ? void 0 : priorPQD.pairedWith) !== null && _f !== void 0 ? _f : [], // D-06: seeded from previous quarter when present
                                roleFrequency: roleFrequency,
                            };
                        }
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'quarters'), {
                                label: label,
                                year: year,
                                quarter: quarter,
                                serviceDates: (0, quarterDates_1.generateSundaysInQuarter)(year, quarter),
                                roleOverridesByDate: {},
                                personQuarterData: personQuarterData,
                                calendar: {},
                                status: 'draft',
                                shareToken: null,
                                createdAt: (0, firestore_1.serverTimestamp)(),
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        docRef = _g.sent();
                        return [2 /*return*/, docRef.id];
                }
            });
        });
    }
    function addServiceDate(quarterId, date) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, serviceDates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        quarter = getQuarter(quarterId);
                        serviceDates = (0, quarterDates_1.applyDateAdditionsRemovals)(quarter.serviceDates, { add: [date] });
                        return [4 /*yield*/, updateQuarter(quarterId, { serviceDates: serviceDates })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function removeServiceDate(quarterId, date) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, serviceDates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        quarter = getQuarter(quarterId);
                        serviceDates = (0, quarterDates_1.applyDateAdditionsRemovals)(quarter.serviceDates, { remove: [date] });
                        return [4 /*yield*/, updateQuarter(quarterId, { serviceDates: serviceDates })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function setRoleOverrideForDate(quarterId, date, config) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, roleOverridesByDate;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        quarter = getQuarter(quarterId);
                        roleOverridesByDate = __assign(__assign({}, quarter.roleOverridesByDate), (_a = {}, _a[date] = config, _a));
                        return [4 /*yield*/, updateQuarter(quarterId, { roleOverridesByDate: roleOverridesByDate })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing
    // fields are upserted through the roster store (Pitfall 3). People absent from `rows` keep
    // their existing personQuarterData entry untouched — except for a bidirectional pairing
    // merge below, which only ever adds a partner id to an existing (or fresh) entry.
    function applyCsvToQuarter(quarterId, rows) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, rosterStore, personQuarterData, _i, rows_1, row, _a, rows_2, row, _b, _c, partnerId, partnerEntry;
            var _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        quarter = getQuarter(quarterId);
                        rosterStore = (0, roster_1.useRosterStore)();
                        personQuarterData = __assign({}, quarter.personQuarterData);
                        _i = 0, rows_1 = rows;
                        _f.label = 1;
                    case 1:
                        if (!(_i < rows_1.length)) return [3 /*break*/, 5];
                        row = rows_1[_i];
                        if (!(Object.keys(row.standing).length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, rosterStore.updatePerson(row.personId, row.standing)];
                    case 2:
                        _f.sent();
                        _f.label = 3;
                    case 3:
                        personQuarterData[row.personId] = {
                            personId: row.personId,
                            blackoutDates: row.blackoutDates,
                            pairedWith: row.pairedWith,
                            roleFrequency: (_d = row.roleFrequency) !== null && _d !== void 0 ? _d : {},
                        };
                        _f.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5:
                        // Bidirectional pairing: a partner not present in `rows` still gets the reciprocal
                        // pairing merged into their (otherwise untouched) entry.
                        for (_a = 0, rows_2 = rows; _a < rows_2.length; _a++) {
                            row = rows_2[_a];
                            for (_b = 0, _c = row.pairedWith; _b < _c.length; _b++) {
                                partnerId = _c[_b];
                                partnerEntry = (_e = personQuarterData[partnerId]) !== null && _e !== void 0 ? _e : {
                                    personId: partnerId,
                                    blackoutDates: [],
                                    pairedWith: [],
                                    roleFrequency: {},
                                };
                                if (!partnerEntry.pairedWith.includes(row.personId)) {
                                    personQuarterData[partnerId] = __assign(__assign({}, partnerEntry), { pairedWith: __spreadArray(__spreadArray([], partnerEntry.pairedWith, true), [row.personId], false) });
                                }
                            }
                        }
                        return [4 /*yield*/, updateQuarter(quarterId, { personQuarterData: personQuarterData })];
                    case 6:
                        _f.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // D-03/D-05/D-06: single-person quarter-data save from the availability drawer. Writes only
    // scoped `personQuarterData.${id}` / `personQuarterData.${id}.pairedWith` dot-paths — never the
    // whole `personQuarterData` map — so concurrent edits to other people's entries aren't clobbered
    // (T-14-03-01). Performs a symmetric added/removed diff against the *previous* pairedWith so a
    // dropped partner is reciprocally un-paired, not just left as a stale one-directional link
    // (T-14-03-02 / 14-RESEARCH Pitfall 2).
    function setPersonAvailability(quarterId, personId, data) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, previous, added, removed, updates, _i, added_1, partnerId, existingPartnerData, partnerPaired, _a, removed_1, partnerId, partnerData;
            var _b;
            var _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        quarter = getQuarter(quarterId);
                        previous = (_d = (_c = quarter.personQuarterData[personId]) === null || _c === void 0 ? void 0 : _c.pairedWith) !== null && _d !== void 0 ? _d : [];
                        added = data.pairedWith.filter(function (id) { return !previous.includes(id); });
                        removed = previous.filter(function (id) { return !data.pairedWith.includes(id); });
                        updates = (_b = {},
                            _b["personQuarterData.".concat(personId)] = __assign({ personId: personId }, data),
                            _b.updatedAt = (0, firestore_1.serverTimestamp)(),
                            _b);
                        for (_i = 0, added_1 = added; _i < added_1.length; _i++) {
                            partnerId = added_1[_i];
                            existingPartnerData = quarter.personQuarterData[partnerId];
                            partnerPaired = (_e = existingPartnerData === null || existingPartnerData === void 0 ? void 0 : existingPartnerData.pairedWith) !== null && _e !== void 0 ? _e : [];
                            if (!partnerPaired.includes(personId)) {
                                if (existingPartnerData) {
                                    // D-05 gap closure: partner already has an entry (possibly with tuned roleFrequency) —
                                    // write ONLY the scoped pairedWith sub-path so every other field, including
                                    // roleFrequency, is left untouched. A whole-object replace here would silently erase
                                    // the partner's tuned per-role cadence (this is a Firestore field replacement, not
                                    // a merge).
                                    updates["personQuarterData.".concat(partnerId, ".pairedWith")] = __spreadArray(__spreadArray([], partnerPaired, true), [personId], false);
                                }
                                else {
                                    // Brand-new partner — no prior entry exists, so there is nothing to preserve.
                                    // Seed a complete, well-formed PersonQuarterData with defaults so downstream
                                    // unguarded `.blackoutDates.includes(date)` reads (QuarterGrid.vue, scheduler.ts)
                                    // never see a partial doc.
                                    updates["personQuarterData.".concat(partnerId)] = {
                                        personId: partnerId,
                                        blackoutDates: [],
                                        pairedWith: [personId],
                                        roleFrequency: {},
                                        note: '',
                                    };
                                }
                            }
                        }
                        for (_a = 0, removed_1 = removed; _a < removed_1.length; _a++) {
                            partnerId = removed_1[_a];
                            partnerData = quarter.personQuarterData[partnerId];
                            if (partnerData) {
                                updates["personQuarterData.".concat(partnerId, ".pairedWith")] = partnerData.pairedWith.filter(function (id) { return id !== personId; });
                            }
                        }
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', quarterId), updates)];
                    case 1:
                        _f.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function buildResolveRolesForDate(quarter, roles) {
        var defaultConfig = roles
            .slice()
            .sort(function (a, b) { return a.order - b.order; })
            .map(function (r) { return ({ roleId: r.id, count: r.defaultCount }); });
        return function (date) { var _a; return (_a = quarter.roleOverridesByDate[date]) !== null && _a !== void 0 ? _a : defaultConfig; };
    }
    // D-12: projects Role[]→roleId→RoleGroup lookup so the scheduler's group co-occurrence
    // rules (TECH exclusivity, 1-BAND/1-VOCALS cap) are actually enforced in production, not just
    // at the unit level inside scheduler.ts. Unknown/stale roleIds default to 'other' (the
    // least-restrictive group) so a missing lookup entry never crashes or silently blocks a slot.
    function buildRoleGroupOf(roles) {
        var groupById = new Map(roles.map(function (r) { return [r.id, r.group]; }));
        return function (roleId) { var _a; return (_a = groupById.get(roleId)) !== null && _a !== void 0 ? _a : 'other'; };
    }
    function generateProposal(quarterId, mode) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, rosterStore, resolveRolesForDate, personQuarterData, result, prevCalendar, changedDates, _i, _a, date, prevRoles, nextRoles, roleIds, changed, _loop_1, _b, roleIds_1, roleId, state_1;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        quarter = getQuarter(quarterId);
                        rosterStore = (0, roster_1.useRosterStore)();
                        resolveRolesForDate = buildResolveRolesForDate(quarter, rosterStore.roles);
                        personQuarterData = Object.values(quarter.personQuarterData);
                        result = (0, scheduler_1.proposeQuarterSchedule)(rosterStore.activePeople, quarter.serviceDates, resolveRolesForDate, personQuarterData, mode === 'fillGaps' ? quarter.calendar : undefined, buildRoleGroupOf(rosterStore.roles));
                        prevCalendar = quarter.calendar;
                        changedDates = [];
                        for (_i = 0, _a = quarter.serviceDates; _i < _a.length; _i++) {
                            date = _a[_i];
                            prevRoles = (_c = prevCalendar[date]) !== null && _c !== void 0 ? _c : {};
                            nextRoles = (_d = result.calendar[date]) !== null && _d !== void 0 ? _d : {};
                            roleIds = new Set(__spreadArray(__spreadArray([], Object.keys(prevRoles), true), Object.keys(nextRoles), true));
                            changed = false;
                            _loop_1 = function (roleId) {
                                var a = __spreadArray([], ((_e = prevRoles[roleId]) !== null && _e !== void 0 ? _e : []), true).sort();
                                var b = __spreadArray([], ((_f = nextRoles[roleId]) !== null && _f !== void 0 ? _f : []), true).sort();
                                if (a.length !== b.length || a.some(function (v, i) { return v !== b[i]; })) {
                                    changed = true;
                                    return "break";
                                }
                            };
                            for (_b = 0, roleIds_1 = roleIds; _b < roleIds_1.length; _b++) {
                                roleId = roleIds_1[_b];
                                state_1 = _loop_1(roleId);
                                if (state_1 === "break")
                                    break;
                            }
                            if (changed)
                                changedDates.push(date);
                        }
                        lastRegenerate.value = { quarterId: quarterId, changedDates: changedDates };
                        return [4 /*yield*/, updateQuarter(quarterId, { calendar: result.calendar })];
                    case 1:
                        _g.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    }
    // Scoped cell edits — each writes only `calendar.{date}.{roleId}` via Firestore dot-path
    // field update, leaving every other cell in the calendar untouched (D-22).
    function assignPerson(quarterId, date, roleId, personId) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, existing;
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        quarter = getQuarter(quarterId);
                        existing = (_c = (_b = quarter.calendar[date]) === null || _b === void 0 ? void 0 : _b[roleId]) !== null && _c !== void 0 ? _c : [];
                        if (existing.includes(personId))
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', quarterId), (_a = {},
                                _a["calendar.".concat(date, ".").concat(roleId)] = __spreadArray(__spreadArray([], existing, true), [personId], false),
                                _a.updatedAt = (0, firestore_1.serverTimestamp)(),
                                _a))];
                    case 1:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function clearAssignment(quarterId, date, roleId, personId) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, existing;
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        quarter = getQuarter(quarterId);
                        existing = (_c = (_b = quarter.calendar[date]) === null || _b === void 0 ? void 0 : _b[roleId]) !== null && _c !== void 0 ? _c : [];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', quarterId), (_a = {},
                                _a["calendar.".concat(date, ".").concat(roleId)] = existing.filter(function (id) { return id !== personId; }),
                                _a.updatedAt = (0, firestore_1.serverTimestamp)(),
                                _a))];
                    case 1:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function swapAssignment(quarterId, date, roleId, fromPersonId, toPersonId) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, existing;
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        quarter = getQuarter(quarterId);
                        existing = (_c = (_b = quarter.calendar[date]) === null || _b === void 0 ? void 0 : _b[roleId]) !== null && _c !== void 0 ? _c : [];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', quarterId), (_a = {},
                                _a["calendar.".concat(date, ".").concat(roleId)] = existing.map(function (id) { return (id === fromPersonId ? toPersonId : id); }),
                                _a.updatedAt = (0, firestore_1.serverTimestamp)(),
                                _a))];
                    case 1:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // Finalize + public share (D-24). No Planning Center write of any kind (D-21) — the
    // quarterSnapshot is a denormalized, read-only copy resolving person NAMES (not raw ids)
    // so the public view needs no roster access and no PII beyond names is exposed (T-13-06-02).
    function finalizeAndShare(quarterId) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, rosterStore, array, token, nameById, calendarWithNames, _i, _a, _b, date, roleMap, _c, _d, _e, roleId, personIds, orgRef, orgSnap, orgData, slug, derived, base, err_1;
            var _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        quarter = getQuarter(quarterId);
                        rosterStore = (0, roster_1.useRosterStore)();
                        array = new Uint8Array(18);
                        crypto.getRandomValues(array);
                        token = Array.from(array, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
                        nameById = new Map(rosterStore.people.map(function (p) { return [p.id, p.name]; }));
                        calendarWithNames = {};
                        for (_i = 0, _a = Object.entries(quarter.calendar); _i < _a.length; _i++) {
                            _b = _a[_i], date = _b[0], roleMap = _b[1];
                            calendarWithNames[date] = {};
                            for (_c = 0, _d = Object.entries(roleMap); _c < _d.length; _c++) {
                                _e = _d[_c], roleId = _e[0], personIds = _e[1];
                                calendarWithNames[date][roleId] = personIds.map(function (id) { var _a; return (_a = nameById.get(id)) !== null && _a !== void 0 ? _a : id; });
                            }
                        }
                        return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(firebase_1.db, 'shareTokens', token), {
                                orgId: orgId.value,
                                quarterId: quarterId,
                                quarterSnapshot: {
                                    label: quarter.label,
                                    serviceDates: quarter.serviceDates,
                                    roles: rosterStore.roles.map(function (r) { return ({ id: r.id, name: r.name, group: r.group }); }),
                                    calendar: calendarWithNames,
                                },
                                createdAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _g.sent();
                        return [4 /*yield*/, updateQuarter(quarterId, { status: 'finalized', shareToken: token })
                            // R-02/D-18: resolve (or claim, on first share) the org's memorable-URL slug, then
                            // write the quarterShares/{slug}__q{N}-{year} doc — a stable doc ID so every finalize
                            // OVERWRITES in place (Pitfall 2), never accumulates like shareTokens above. Reuses the
                            // exact calendarWithNames/roles/label/serviceDates snapshot already built — names only,
                            // no email/phone (D-24).
                            //
                            // WR-06: by this point the opaque shareTokens doc AND the quarter's finalized status
                            // have already been committed above — a failure in this memorable-URL step must NOT
                            // surface as a hard "Failed to finalize and share" to the caller, since the finalize
                            // itself already succeeded. This whole step is therefore soft-fail: any error here is
                            // logged and swallowed, and the opaque token is still returned.
                        ];
                    case 2:
                        _g.sent();
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 9, , 10]);
                        orgRef = (0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(orgRef)];
                    case 4:
                        orgSnap = _g.sent();
                        orgData = orgSnap.exists() ? orgSnap.data() : {};
                        slug = orgData.slug;
                        if (!!slug) return [3 /*break*/, 7];
                        derived = (0, slug_1.deriveSlug)((_f = orgData.name) !== null && _f !== void 0 ? _f : '');
                        base = derived || 'org';
                        return [4 /*yield*/, (0, slug_1.claimSlug)(base, orgId.value)];
                    case 5:
                        slug = _g.sent();
                        return [4 /*yield*/, (0, firestore_1.updateDoc)(orgRef, { slug: slug })];
                    case 6:
                        _g.sent();
                        _g.label = 7;
                    case 7: return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(firebase_1.db, 'quarterShares', "".concat(slug, "__q").concat(quarter.quarter, "-").concat(quarter.year)), {
                            // CR-01: the owning orgId is stored on the doc so firestore.rules can scope
                            // create/update to editors of the org that actually owns this share (the shareId
                            // itself is a guessable, deterministic string, so this field is what closes the
                            // cross-tenant write gap).
                            orgId: orgId.value,
                            orgSlug: slug,
                            quarterSnapshot: {
                                label: quarter.label,
                                serviceDates: quarter.serviceDates,
                                roles: rosterStore.roles.map(function (r) { return ({ id: r.id, name: r.name, group: r.group }); }),
                                calendar: calendarWithNames,
                            },
                            token: token,
                            updatedAt: (0, firestore_1.serverTimestamp)(),
                        })];
                    case 8:
                        _g.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        err_1 = _g.sent();
                        console.error('finalizeAndShare: memorable-URL slug/quarterShares write failed — the opaque share link above already succeeded', err_1);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, token];
                }
            });
        });
    }
    // Delete an entire quarter — its setup (personQuarterData), its generated schedule
    // (calendar), and any public share artifacts finalizeAndShare wrote for it. The
    // public docs are revoked FIRST so a deleted quarter can never leave a live,
    // unauthenticated share link dangling. Deleting shareTokens/quarterShares requires
    // the org-editor delete rules added alongside this action; each delete is guarded by
    // a getDoc existence check so we never issue a delete against a non-existent doc
    // (which the rules deny on a null `resource`). If revocation fails (e.g. rules not
    // yet deployed), this throws before the quarter is removed — no orphaned link.
    function deleteQuarter(quarterId) {
        return __awaiter(this, void 0, Promise, function () {
            var quarter, tokenRef, tokenSnap, orgSnap, slug, shareRef, shareSnap;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        quarter = getQuarter(quarterId);
                        if (!quarter.shareToken) return [3 /*break*/, 7];
                        tokenRef = (0, firestore_1.doc)(firebase_1.db, 'shareTokens', quarter.shareToken);
                        return [4 /*yield*/, (0, firestore_1.getDoc)(tokenRef)];
                    case 1:
                        tokenSnap = _a.sent();
                        if (!tokenSnap.exists()) return [3 /*break*/, 3];
                        return [4 /*yield*/, (0, firestore_1.deleteDoc)(tokenRef)
                            // 2. Memorable-URL share (quarterShares/{slug}__q{N}-{year}) — the doc id is
                            // deterministic from the org slug plus this quarter's number/year.
                        ];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value))];
                    case 4:
                        orgSnap = _a.sent();
                        slug = orgSnap.exists() ? orgSnap.data().slug : undefined;
                        if (!slug) return [3 /*break*/, 7];
                        shareRef = (0, firestore_1.doc)(firebase_1.db, 'quarterShares', "".concat(slug, "__q").concat(quarter.quarter, "-").concat(quarter.year));
                        return [4 /*yield*/, (0, firestore_1.getDoc)(shareRef)];
                    case 5:
                        shareSnap = _a.sent();
                        if (!shareSnap.exists()) return [3 /*break*/, 7];
                        return [4 /*yield*/, (0, firestore_1.deleteDoc)(shareRef)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: 
                    // 3. Delete the quarter document itself.
                    return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'quarters', quarterId))];
                    case 8:
                        // 3. Delete the quarter document itself.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        quarters: quarters,
        isLoading: isLoading,
        orgId: orgId,
        lastRegenerate: lastRegenerate,
        subscribe: subscribe,
        unsubscribeAll: unsubscribeAll,
        getQuarter: getQuarter,
        createQuarter: createQuarter,
        addServiceDate: addServiceDate,
        removeServiceDate: removeServiceDate,
        setRoleOverrideForDate: setRoleOverrideForDate,
        applyCsvToQuarter: applyCsvToQuarter,
        setPersonAvailability: setPersonAvailability,
        buildResolveRolesForDate: buildResolveRolesForDate,
        buildRoleGroupOf: buildRoleGroupOf,
        generateProposal: generateProposal,
        assignPerson: assignPerson,
        clearAssignment: clearAssignment,
        swapAssignment: swapAssignment,
        finalizeAndShare: finalizeAndShare,
        deleteQuarter: deleteQuarter,
    };
});
