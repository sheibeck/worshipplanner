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
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var scheduler_1 = require("@/utils/scheduler");
// Factory helper for Person. Frequency behavior is entirely quarter-scoped now (D-04/D-05) —
// see makePQD's roleFrequency for the single source of truth the scheduler reads.
function makePerson(overrides) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
        id: overrides.id,
        name: (_a = overrides.name) !== null && _a !== void 0 ? _a : overrides.id,
        email: (_b = overrides.email) !== null && _b !== void 0 ? _b : "".concat(overrides.id, "@example.com"),
        phone: (_c = overrides.phone) !== null && _c !== void 0 ? _c : '',
        active: (_d = overrides.active) !== null && _d !== void 0 ? _d : true,
        roles: (_e = overrides.roles) !== null && _e !== void 0 ? _e : [],
        pcPersonId: (_f = overrides.pcPersonId) !== null && _f !== void 0 ? _f : null,
        createdAt: (_g = overrides.createdAt) !== null && _g !== void 0 ? _g : {},
        updatedAt: (_h = overrides.updatedAt) !== null && _h !== void 0 ? _h : {},
    };
}
// Factory helper for PersonQuarterData. Quarter-scoped, per-role frequency (D-04/D-05) is the
// single source of truth: roleFrequency[roleId] = { tier, n }. Absent role entry (or no PQD at
// all) defaults to { tier: 'regular', n: 4 } inside the scheduler.
function makePQD(overrides) {
    var _a, _b;
    return __assign(__assign({ personId: overrides.personId, blackoutDates: (_a = overrides.blackoutDates) !== null && _a !== void 0 ? _a : [], pairedWith: (_b = overrides.pairedWith) !== null && _b !== void 0 ? _b : [] }, (overrides.roleFrequency !== undefined ? { roleFrequency: overrides.roleFrequency } : {})), (overrides.note !== undefined ? { note: overrides.note } : {}));
}
// Small helper to build a single-role roleFrequency map inline at call sites.
function freq(roleId, tier, n) {
    var _a;
    return _a = {}, _a[roleId] = { tier: tier, n: n }, _a;
}
// Simple static role resolver (no per-date overrides) unless a map is passed
function makeResolver(defaultRoles, overrides) {
    return function (date) { var _a; return (_a = overrides === null || overrides === void 0 ? void 0 : overrides[date]) !== null && _a !== void 0 ? _a : defaultRoles; };
}
// roleId -> RoleGroup lookup helper, mirroring makeResolver's shape. Unknown roleIds default to
// 'other' (safe default per D-10 implementation notes), matching proposeQuarterSchedule's own default.
function makeRoleGroupOf(map) {
    return function (roleId) { var _a; return (_a = map[roleId]) !== null && _a !== void 0 ? _a : 'other'; };
}
(0, vitest_1.describe)('proposeQuarterSchedule', function () {
    (0, vitest_1.it)('blackout: never assigns a person on a blacked-out date, leaving the slot unfilled if they were the only candidate', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['guitar'] })];
        var dates = ['2026-01-04', '2026-01-11'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [makePQD({ personId: 'p1', blackoutDates: ['2026-01-04'] })];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
        // second week, no blackout — p1 should be assigned
        (0, vitest_1.expect)((_c = result.calendar['2026-01-11']) === null || _c === void 0 ? void 0 : _c['guitar']).toContain('p1');
    });
    (0, vitest_1.it)('multi: fills a role with count 2 using exactly 2 distinct people; one person can appear in two roles same date (D-04)', function () {
        var _a, _b, _c, _d;
        var people = [
            makePerson({ id: 'p1', roles: ['guitar', 'vocals'] }),
            makePerson({ id: 'p2', roles: ['guitar'] }),
            makePerson({ id: 'p3', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 2 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        var guitarAssignees = (_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : [];
        (0, vitest_1.expect)(guitarAssignees).toHaveLength(2);
        (0, vitest_1.expect)(new Set(guitarAssignees).size).toBe(2);
        // p1 is eligible for both guitar and vocals — confirm a person can hold two roles same date
        var vocalsAssignees = (_d = (_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['vocals']) !== null && _d !== void 0 ? _d : [];
        (0, vitest_1.expect)(vocalsAssignees).toContain('p1');
    });
    (0, vitest_1.it)('deficit: a weekly (N=1) never-served person outranks a monthly (N=4) already-served person', function () {
        var _a;
        var people = [
            makePerson({ id: 'weekly', roles: ['guitar'] }),
            makePerson({ id: 'monthly', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [
            makePQD({ personId: 'weekly', roleFrequency: freq('guitar', 'regular', 1) }),
            makePQD({ personId: 'monthly', roleFrequency: freq('guitar', 'regular', 4) }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        // dateIndex 0: weekly deficit = 1/1 - 0 = 1; monthly deficit = 1/4 - 0 = 0.25
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['weekly']);
    });
    (0, vitest_1.it)('deficit tie-break: identical deficits resolve deterministically and repeat runs yield identical calendars', function () {
        var _a, _b, _c;
        var people = [
            makePerson({ id: 'zed', name: 'Zed', roles: ['guitar'] }),
            makePerson({ id: 'amy', name: 'Amy', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [
            makePQD({ personId: 'zed', roleFrequency: freq('guitar', 'regular', 1) }),
            makePQD({ personId: 'amy', roleFrequency: freq('guitar', 'regular', 1) }),
        ];
        var result1 = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        var result2 = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        // Both have identical deficit (1/1 - 0 = 1) and identical servedCount (0) —
        // tie-break falls to name.localeCompare: 'Amy' < 'Zed'
        (0, vitest_1.expect)((_a = result1.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['amy']);
        (0, vitest_1.expect)((_b = result2.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['guitar']).toEqual((_c = result1.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['guitar']);
    });
    (0, vitest_1.it)('unfilled: a role with zero eligible/available candidates yields an unfilled entry, no fabricated assignment', function () {
        var _a, _b;
        var people = [makePerson({ id: 'p1', roles: ['vocals'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).toHaveLength(0);
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
        (0, vitest_1.expect)(result.servedCounts['p1']).toBe(0);
    });
    (0, vitest_1.it)('pairing: when person A is scheduled, paired partner B is also assigned that date in one of B\'s own eligible roles (D-09)', function () {
        var _a, _b;
        var people = [
            makePerson({ id: 'a', roles: ['guitar'] }),
            makePerson({ id: 'b', roles: ['vocals'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [
            makePQD({ personId: 'a', pairedWith: ['b'] }),
            makePQD({ personId: 'b', pairedWith: ['a'] }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toContain('a');
        (0, vitest_1.expect)((_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals']).toContain('b');
    });
    (0, vitest_1.it)('pairing conflict: if partner B is blacked out, no assignment is made for B and a pairingConflicts entry is recorded (D-07 wins)', function () {
        var _a, _b, _c;
        var people = [
            makePerson({ id: 'a', roles: ['guitar'] }),
            makePerson({ id: 'b', roles: ['vocals'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [
            makePQD({ personId: 'a', pairedWith: ['b'] }),
            makePQD({ personId: 'b', pairedWith: ['a'], blackoutDates: ['2026-01-04'] }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toContain('a');
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals']) !== null && _c !== void 0 ? _c : []).not.toContain('b');
        (0, vitest_1.expect)(result.pairingConflicts).toContainEqual(vitest_1.expect.objectContaining({ date: '2026-01-04', personId: 'a', partnerId: 'b' }));
    });
    (0, vitest_1.it)('override: resolveRolesForDate per-date override (count 0 for livestream, count 2 for vocals) is honored over the default (D-02)', function () {
        var _a, _b, _c;
        var people = [
            makePerson({ id: 'p1', roles: ['livestream', 'vocals'] }),
            makePerson({ id: 'p2', roles: ['vocals'] }),
        ];
        var dates = ['2026-01-04'];
        var defaultRoles = [
            { roleId: 'livestream', count: 1 },
            { roleId: 'vocals', count: 1 },
        ];
        var overrides = {
            '2026-01-04': [
                { roleId: 'livestream', count: 0 },
                { roleId: 'vocals', count: 2 },
            ],
        };
        var resolver = makeResolver(defaultRoles, overrides);
        var pqd = [];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['livestream']) !== null && _b !== void 0 ? _b : []).toHaveLength(0);
        (0, vitest_1.expect)((_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['vocals']).toHaveLength(2);
    });
    (0, vitest_1.it)('consecutive: an N=1 person eligible+available every week IS assigned on consecutive weeks (no back-to-back suppression, D-12)', function () {
        var _a;
        var people = [makePerson({ id: 'p1', roles: ['guitar'] })];
        var dates = ['2026-01-04', '2026-01-11', '2026-01-18'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [makePQD({ personId: 'p1', roleFrequency: freq('guitar', 'regular', 1) })];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        for (var _i = 0, dates_1 = dates; _i < dates_1.length; _i++) {
            var date = dates_1[_i];
            (0, vitest_1.expect)((_a = result.calendar[date]) === null || _a === void 0 ? void 0 : _a['guitar']).toContain('p1');
        }
        (0, vitest_1.expect)(result.servedCounts['p1']).toBe(3);
    });
    (0, vitest_1.it)('even spread: the sole monthly (N=4) guitarist is spaced evenly across the quarter (weeks 1 & 5), NOT front-loaded into consecutive weeks (Gabriel scenario)', function () {
        // Gabriel is the ONLY guitarist and set to serve ~monthly (N=4). Over an 8-week span "1-in-4"
        // means he should land ~once a month — spread across the quarter, not booked every week nor
        // clustered into the first few weeks and then dropped. With the even-spread cadence gate he
        // is only eligible while behind pace (dateIndex+1)/4, so he serves week 1 (index 0) and
        // week 5 (index 4) — a gap of 4 — and the rest are left blank.
        var dates = ['2026-01-04', '2026-01-11', '2026-01-18', '2026-01-25', '2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22'];
        var people = [makePerson({ id: 'gabriel', name: 'Gabriel', roles: ['guitar'] })];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [makePQD({ personId: 'gabriel', roleFrequency: freq('guitar', 'regular', 4) })];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        var servedIndices = dates
            .map(function (d, i) { var _a, _b; return (((_b = (_a = result.calendar[d]) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).includes('gabriel') ? i : -1); })
            .filter(function (i) { return i >= 0; });
        // Spread evenly at a 1-in-4 cadence — indices 0 and 4, NOT front-loaded to 0,1.
        (0, vitest_1.expect)(servedIndices).toEqual([0, 4]);
        (0, vitest_1.expect)(result.servedCounts['gabriel']).toBe(2);
        // The other 6 weeks are blank (unfilled), not fabricated assignments.
        var blankDates = dates.filter(function (d) { var _a, _b; return ((_b = (_a = result.calendar[d]) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).length === 0; });
        (0, vitest_1.expect)(blankDates).toHaveLength(6);
        for (var _i = 0, blankDates_1 = blankDates; _i < blankDates_1.length; _i++) {
            var d = blankDates_1[_i];
            (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: d, roleId: 'guitar' });
        }
    });
    (0, vitest_1.it)('fillin: a regular-tier candidate is chosen over a fillin-tier candidate (fillin is never auto-scheduled)', function () {
        var _a;
        var people = [
            makePerson({ id: 'reg', roles: ['guitar'] }),
            makePerson({ id: 'fill', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [
            makePQD({ personId: 'reg', roleFrequency: freq('guitar', 'regular', 1) }),
            makePQD({ personId: 'fill', roleFrequency: freq('guitar', 'fillin', 1) }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        // Only the regular-tier person is auto-scheduled — fillin-tier is manual-only.
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['reg']);
    });
    (0, vitest_1.it)('fillin manual-only: a fillin-tier person is NEVER auto-scheduled, even as the sole candidate — the slot is left unfilled', function () {
        var _a, _b, _c, _d, _e;
        var people = [
            makePerson({ id: 'reg', roles: ['guitar'] }),
            makePerson({ id: 'fill', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [
            makePQD({
                personId: 'reg',
                roleFrequency: freq('guitar', 'regular', 1),
                blackoutDates: ['2026-01-04'],
            }),
            makePQD({ personId: 'fill', roleFrequency: freq('guitar', 'fillin', 1) }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        // reg is blacked out -> zero regular candidates. There is NO fillin last-resort auto-fill:
        // the coordinator schedules fill-ins by hand, so the slot is left blank.
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).toHaveLength(0);
        (0, vitest_1.expect)((_d = (_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['guitar']) !== null && _d !== void 0 ? _d : []).not.toContain('fill');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
        (0, vitest_1.expect)((_e = result.servedCounts['fill']) !== null && _e !== void 0 ? _e : 0).toBe(0);
    });
    (0, vitest_1.it)('out tier: an out-tier person eligible by role is never assigned and never appears in unfilled as a filler', function () {
        var _a, _b, _c, _d;
        var people = [makePerson({ id: 'out1', roles: ['guitar'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [makePQD({ personId: 'out1', roleFrequency: freq('guitar', 'out', 4) })];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).not.toContain('out1');
        (0, vitest_1.expect)((_d = (_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['guitar']) !== null && _d !== void 0 ? _d : []).toHaveLength(0);
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
    });
    (0, vitest_1.it)('out tier: paired partner who is out-tier is not force-scheduled and produces a pairingConflicts entry', function () {
        var _a, _b, _c;
        var people = [
            makePerson({ id: 'a', roles: ['guitar'] }),
            makePerson({ id: 'b', roles: ['vocals'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [
            makePQD({ personId: 'a', pairedWith: ['b'] }),
            makePQD({ personId: 'b', pairedWith: ['a'], roleFrequency: freq('vocals', 'out', 4) }),
        ];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toContain('a');
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals']) !== null && _c !== void 0 ? _c : []).not.toContain('b');
        (0, vitest_1.expect)(result.pairingConflicts).toContainEqual(vitest_1.expect.objectContaining({ date: '2026-01-04', personId: 'a', partnerId: 'b', reason: 'partner out this quarter' }));
    });
    (0, vitest_1.it)('default safety: a candidate whose PersonQuarterData has no roleFrequency entry for a role (or no PQD entry at all) defaults to regular tier with N=4, identical to prior fallback behavior', function () {
        var _a;
        var people = [
            makePerson({ id: 'p1', roles: ['guitar'] }),
            makePerson({ id: 'p2', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        // p1 has no PQD entry at all; p2 has a PQD entry but no roleFrequency map for 'guitar'
        var pqd = [makePQD({ personId: 'p2', note: 'has a PQD entry but no roleFrequency for guitar' })];
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
        // Both default to {tier: 'regular', n: 4} -> identical deficit (0.25) and servedCount (0) —
        // tie-break falls to name.localeCompare: 'p1' < 'p2'
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
    });
    (0, vitest_1.it)('fill gaps: existingCalendar seeds servedCounts so locked assignments reflect in deficit, only empty slots get filled', function () {
        var _a, _b;
        var people = [
            makePerson({ id: 'p1', roles: ['guitar'] }),
            makePerson({ id: 'p2', roles: ['guitar'] }),
        ];
        var dates = ['2026-01-04', '2026-01-11'];
        var resolver = makeResolver([{ roleId: 'guitar', count: 1 }]);
        var pqd = [
            makePQD({ personId: 'p1', roleFrequency: freq('guitar', 'regular', 1) }),
            makePQD({ personId: 'p2', roleFrequency: freq('guitar', 'regular', 1) }),
        ];
        var existingCalendar = {
            '2026-01-04': { guitar: ['p1'] },
        };
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd, existingCalendar);
        // locked assignment preserved
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
        // servedCounts seeded from the locked assignment
        (0, vitest_1.expect)(result.servedCounts['p1']).toBeGreaterThanOrEqual(1);
        // second date's empty slot gets filled by the algorithm (p2 has higher deficit, since p1 already served)
        (0, vitest_1.expect)((_b = result.calendar['2026-01-11']) === null || _b === void 0 ? void 0 : _b['guitar']).toContain('p2');
    });
    // --- D-10/D-12 group co-occurrence enforcement + D-05 per-role cadence/tier (Phase 15) ---
    (0, vitest_1.it)('group TECH exclusivity: a person already on a TECH role that date is ineligible for a same-date BAND role (D-10)', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['sound', 'guitar'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'sound', count: 1 },
            { roleId: 'guitar', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ sound: 'tech', guitar: 'band' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['sound']).toEqual(['p1']);
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['guitar']) !== null && _c !== void 0 ? _c : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
    });
    (0, vitest_1.it)('group TECH exclusivity (vice versa): a person already on a BAND role that date is ineligible for a same-date TECH role (D-10)', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['guitar', 'sound'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'sound', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ guitar: 'band', sound: 'tech' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['sound']) !== null && _c !== void 0 ? _c : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'sound' });
    });
    (0, vitest_1.it)('group cardinality: a person already holding one BAND role that date is not given a second BAND role (D-10)', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['guitar', 'bass'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'bass', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ guitar: 'band', bass: 'band' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['bass']) !== null && _c !== void 0 ? _c : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'bass' });
    });
    (0, vitest_1.it)('group cardinality: a person already holding one VOCALS role that date is not given a second VOCALS role (D-10)', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['vocals1', 'vocals2'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'vocals1', count: 1 },
            { roleId: 'vocals2', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ vocals1: 'vocals', vocals2: 'vocals' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['vocals1']).toEqual(['p1']);
        (0, vitest_1.expect)((_c = (_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals2']) !== null && _c !== void 0 ? _c : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'vocals2' });
    });
    (0, vitest_1.it)('group cardinality: OTHER group is uncapped — a person can hold two OTHER roles the same date (D-10)', function () {
        var _a, _b;
        var people = [makePerson({ id: 'p1', roles: ['other1', 'other2'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'other1', count: 1 },
            { roleId: 'other2', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ other1: 'other', other2: 'other' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['other1']).toEqual(['p1']);
        (0, vitest_1.expect)((_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['other2']).toEqual(['p1']);
    });
    (0, vitest_1.it)('group allowed combo: 1 BAND + 1 VOCALS for the same person on one date IS produced when that is the fair assignment (D-10)', function () {
        var _a, _b;
        var people = [makePerson({ id: 'p1', roles: ['guitar', 'vocals'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, [], undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
        (0, vitest_1.expect)((_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals']).toEqual(['p1']);
    });
    (0, vitest_1.it)('propagatePairing group case (Pitfall 2, D-12): a partner pulled in via pairing to a TECH role is correctly excluded from a later conflicting BAND role, never producing an illegal combo', function () {
        var _a, _b, _c, _d;
        // 'a' has no group-conflicting roles; 'b' is paired with 'a' and has roles spanning
        // both TECH ('sound') and BAND ('guitar'). Processing order: other_role (fills 'a' directly,
        // which propagates the pairing and pulls 'b' into 'sound'), then 'sound' (already filled by
        // the pairing propagation), then 'guitar' (the ONLY remaining candidate is 'b', who must now
        // be excluded because 'b' already holds a TECH role this date via propagatePairing).
        var people = [
            makePerson({ id: 'a', roles: ['other_role'] }),
            makePerson({ id: 'b', roles: ['sound', 'guitar'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'other_role', count: 1 },
            { roleId: 'sound', count: 1 },
            { roleId: 'guitar', count: 1 },
        ]);
        var pqd = [
            makePQD({ personId: 'a', pairedWith: ['b'] }),
            makePQD({ personId: 'b', pairedWith: ['a'] }),
        ];
        var roleGroupOf = makeRoleGroupOf({ other_role: 'other', sound: 'tech', guitar: 'band' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd, undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['other_role']).toEqual(['a']);
        // 'b' was pulled into 'sound' (TECH) via propagatePairing.
        (0, vitest_1.expect)((_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['sound']).toEqual(['b']);
        // 'b' must NEVER also appear in 'guitar' (BAND) — that would be an illegal TECH+BAND combo.
        (0, vitest_1.expect)((_d = (_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['guitar']) !== null && _d !== void 0 ? _d : []).not.toContain('b');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
    });
    (0, vitest_1.it)('per-role cadence: deficit is scored against each role\'s own N, not a blended per-person total (D-05)', function () {
        var _a, _b;
        // p1 has an equally-weekly need for BOTH guitar and vocals (N=1 each). p4 only needs vocals
        // monthly (N=4). On the very first date, p1's guitar assignment (processed first in
        // rolesForDate order) must NOT inflate p1's vocals deficit via a shared/blended served
        // counter — if it did, p1's vocals deficit would incorrectly drop to 0 and p4 (0.25) would
        // wrongly win vocals despite p1's genuinely higher (tied, weekly) need.
        var people = [
            makePerson({ id: 'p1', name: 'Amy', roles: ['guitar', 'vocals'] }),
            makePerson({ id: 'p4', name: 'Zoe', roles: ['vocals'] }),
        ];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [
            makePQD({
                personId: 'p1',
                roleFrequency: { guitar: { tier: 'regular', n: 1 }, vocals: { tier: 'regular', n: 1 } },
            }),
            makePQD({ personId: 'p4', roleFrequency: freq('vocals', 'regular', 4) }),
        ];
        var roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd, undefined, roleGroupOf);
        (0, vitest_1.expect)((_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']).toEqual(['p1']);
        // Per-role tracking: p1's vocals-specific served count is still 0 going into the vocals
        // scoring pass (guitar's serve doesn't leak into vocals' deficit) — p1 (deficit 1) beats p4
        // (deficit 0.25) fairly.
        (0, vitest_1.expect)((_b = result.calendar['2026-01-04']) === null || _b === void 0 ? void 0 : _b['vocals']).toEqual(['p1']);
    });
    (0, vitest_1.it)('per-role tier: a person \'out\' for one role but \'regular\' for another is excluded only from the \'out\' role (D-05)', function () {
        var _a, _b, _c;
        var people = [makePerson({ id: 'p1', roles: ['guitar', 'vocals'] })];
        var dates = ['2026-01-04'];
        var resolver = makeResolver([
            { roleId: 'guitar', count: 1 },
            { roleId: 'vocals', count: 1 },
        ]);
        var pqd = [
            makePQD({
                personId: 'p1',
                roleFrequency: { guitar: { tier: 'out', n: 4 }, vocals: { tier: 'regular', n: 4 } },
            }),
        ];
        var roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' });
        var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd, undefined, roleGroupOf);
        (0, vitest_1.expect)((_b = (_a = result.calendar['2026-01-04']) === null || _a === void 0 ? void 0 : _a['guitar']) !== null && _b !== void 0 ? _b : []).not.toContain('p1');
        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' });
        (0, vitest_1.expect)((_c = result.calendar['2026-01-04']) === null || _c === void 0 ? void 0 : _c['vocals']).toEqual(['p1']);
    });
    // --- R-12: propagatePairing gated by remaining per-role cadence budget (D-01/D-02/D-03) ---
    (0, vitest_1.describe)('cadence-gated pairing (R-12)', function () {
        // Canonical Nolan/Tim scenario, constructed per RESEARCH.md Pitfall 4's mitigation: Nolan's
        // only role ('vocals') is the SAME role Tim holds (co-vocalist shape), which sidesteps the
        // documented residual edge case (Open Question 1 — the main loop's independent selection
        // path) by adding a third regular vocalist (Jamie) who out-competes Nolan for the single
        // slot every date, so Nolan is never chosen directly by the main eligible() loop — his only
        // route onto the calendar is via propagatePairing off a Tim (or Jamie) pick.
        function buildNolanTimScenario(dateCount) {
            var dates = Array.from({ length: dateCount }, function (_, i) {
                var d = new Date('2026-01-04T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + i * 7);
                return d.toISOString().slice(0, 10);
            });
            var people = [
                makePerson({ id: 'tim', name: 'Tim', roles: ['vocals'] }),
                makePerson({ id: 'nolan', name: 'Nolan', roles: ['vocals'] }),
                makePerson({ id: 'jamie', name: 'Jamie', roles: ['vocals'] }),
            ];
            var resolver = makeResolver([{ roleId: 'vocals', count: 1 }]);
            var pqd = [
                makePQD({ personId: 'tim', pairedWith: ['nolan'], roleFrequency: freq('vocals', 'regular', 2) }),
                makePQD({ personId: 'nolan', pairedWith: ['tim'], roleFrequency: freq('vocals', 'regular', 4) }),
                makePQD({ personId: 'jamie', roleFrequency: freq('vocals', 'regular', 2) }),
            ];
            var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
            return { dates: dates, result: result };
        }
        (0, vitest_1.it)('containment: every date Nolan serves, Tim also serves that date — across the FULL calendar, not just dates Tim already served (D-01)', function () {
            var _a, _b;
            var _c = buildNolanTimScenario(26), dates = _c.dates, result = _c.result;
            for (var _i = 0, dates_2 = dates; _i < dates_2.length; _i++) {
                var date = dates_2[_i];
                var vocals = (_b = (_a = result.calendar[date]) === null || _a === void 0 ? void 0 : _a['vocals']) !== null && _b !== void 0 ? _b : [];
                if (vocals.includes('nolan')) {
                    (0, vitest_1.expect)(vocals).toContain('tim');
                }
            }
        });
        (0, vitest_1.it)('cadence budget: Nolan\'s served count is capped at his own remaining-cadence budget (ceil(dates/4)), never inflated to Tim\'s cadence (D-01/D-02)', function () {
            var result = buildNolanTimScenario(26).result;
            // budget = ceil(26 / 4) = 7
            (0, vitest_1.expect)(result.servedCounts['nolan']).toBe(7);
            // Tim serves far more often than Nolan (his own ~twice-a-month cadence, competing with
            // Jamie for the shared slot) — proof pairing did NOT drag Nolan up to Tim's cadence.
            (0, vitest_1.expect)(result.servedCounts['tim']).toBeGreaterThan(result.servedCounts['nolan']);
        });
        (0, vitest_1.it)('even spread: Nolan\'s pulled-in occurrences land on a consistent cadence, inherited from Tim\'s already-evenly-spread schedule — not clustered together (D-02)', function () {
            var _a = buildNolanTimScenario(26), dates = _a.dates, result = _a.result;
            var nolanIndices = dates
                .map(function (date, i) { var _a, _b; return ({ i: i, served: ((_b = (_a = result.calendar[date]) === null || _a === void 0 ? void 0 : _a['vocals']) !== null && _b !== void 0 ? _b : []).includes('nolan') }); })
                .filter(function (e) { return e.served; })
                .map(function (e) { return e.i; });
            var gaps = nolanIndices.slice(1).map(function (v, i) { return v - nolanIndices[i]; });
            // Every gap between consecutive Nolan occurrences is identical AND equals his own 1-in-4
            // cadence — evenly spaced across the WHOLE quarter, not front-loaded into the first half at
            // Tim's 1-in-2 rate (the "Nolan 2x/month then nothing" bug: that would show gap 2, not 4).
            (0, vitest_1.expect)(new Set(gaps).size).toBe(1);
            (0, vitest_1.expect)(gaps[0]).toBe(4);
            // Occurrences span the full calendar — the last one lands in the final quarter of dates,
            // not clustered up front.
            (0, vitest_1.expect)(nolanIndices[nolanIndices.length - 1]).toBeGreaterThanOrEqual(dates.length - 4);
            (0, vitest_1.expect)(gaps[0]).toBeGreaterThan(1);
        });
        (0, vitest_1.it)('silent skip: once Nolan\'s cadence budget is exhausted, Tim\'s remaining ("extra") dates proceed alone with NO pairingConflicts entry recorded (D-03)', function () {
            var _a = buildNolanTimScenario(26), dates = _a.dates, result = _a.result;
            (0, vitest_1.expect)(result.pairingConflicts).toHaveLength(0);
            var timAloneDates = dates.filter(function (date) {
                var _a, _b;
                var vocals = (_b = (_a = result.calendar[date]) === null || _a === void 0 ? void 0 : _a['vocals']) !== null && _b !== void 0 ? _b : [];
                return vocals.includes('tim') && !vocals.includes('nolan');
            });
            // Tim has at least one date where his cadence exceeds what Nolan's budget can absorb —
            // that date proceeds with Tim alone, silently (no conflict entry for it).
            (0, vitest_1.expect)(timAloneDates.length).toBeGreaterThan(0);
        });
    });
    // --- WR-02 regression: a fillin-tier partner (the drawer's "As-needed (fill-in)" preset,
    // which writes n:0) is manual-only and must never be auto-pulled in via pairing. Doubly
    // guarded: propagatePairing excludes non-regular tiers, and withinCadence treats n<=0 as
    // "no valid cadence" (no divide-by-zero into an always-passing gate). ---
    (0, vitest_1.describe)('fillin-tier n=0 cadence gate (WR-02)', function () {
        (0, vitest_1.it)('a paired fillin-tier partner with n:0 is never pulled in via pairing propagation (manual-only; no divide-by-zero)', function () {
            var _a, _b, _c;
            var dates = Array.from({ length: 12 }, function (_, i) {
                var d = new Date('2026-01-04T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + i * 7);
                return d.toISOString().slice(0, 10);
            });
            var people = [
                makePerson({ id: 'tim', name: 'Tim', roles: ['vocals'] }),
                makePerson({ id: 'casey', name: 'Casey', roles: ['vocals'] }),
                makePerson({ id: 'jamie', name: 'Jamie', roles: ['vocals'] }),
            ];
            var resolver = makeResolver([{ roleId: 'vocals', count: 1 }]);
            var pqd = [
                makePQD({ personId: 'tim', pairedWith: ['casey'], roleFrequency: freq('vocals', 'regular', 2) }),
                // n:0 — exactly the value AvailabilityDrawer.vue's "As-needed (fill-in)" preset writes.
                makePQD({ personId: 'casey', pairedWith: ['tim'], roleFrequency: freq('vocals', 'fillin', 0) }),
                // Jamie always out-competes Casey for the single regular slot so Casey (fillin-tier)
                // is never chosen directly by the main eligible() loop — her only route onto the
                // calendar would be via propagatePairing off Tim, same isolation trick as the
                // Nolan/Tim scenario above.
                makePQD({ personId: 'jamie', roleFrequency: freq('vocals', 'regular', 2) }),
            ];
            var result = (0, scheduler_1.proposeQuarterSchedule)(people, dates, resolver, pqd);
            // Casey is fillin-tier -> excluded from pairing pull-in (manual-only), and even if she
            // weren't, withinCadence returns false for n<=0 rather than dividing 12/0 into an
            // always-passing gate. Either way she is never proactively pulled onto Tim's dates.
            (0, vitest_1.expect)((_a = result.servedCounts['casey']) !== null && _a !== void 0 ? _a : 0).toBe(0);
            for (var _i = 0, dates_3 = dates; _i < dates_3.length; _i++) {
                var date = dates_3[_i];
                (0, vitest_1.expect)((_c = (_b = result.calendar[date]) === null || _b === void 0 ? void 0 : _b['vocals']) !== null && _c !== void 0 ? _c : []).not.toContain('casey');
            }
            // Cadence-driven skip is silent (D-03) — no pairingConflicts entries for Casey.
            (0, vitest_1.expect)(result.pairingConflicts.filter(function (c) { return c.partnerId === 'casey'; })).toHaveLength(0);
        });
    });
});
