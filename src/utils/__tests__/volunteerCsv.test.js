"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var volunteerCsv_1 = require("@/utils/volunteerCsv");
function makePerson(id, name, active) {
    if (active === void 0) { active = true; }
    return {
        id: id,
        name: name,
        email: '',
        phone: '',
        active: active,
        roles: [],
        pcPersonId: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: null,
    };
}
(0, vitest_1.describe)('parseVolunteerCsvRow', function () {
    (0, vitest_1.it)('parses a well-formed row into a ParsedVolunteerRow', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: 'Sarah Smith',
            Roles: 'vocals; guitar',
            Frequency: 'twice a month',
            'Blackout Dates': '2026-07-05; 2026-08-16',
            'Serve-With': 'Ben Smith',
        });
        (0, vitest_1.expect)(result).toEqual({
            name: 'Sarah Smith',
            rolesRaw: ['vocals', 'guitar'],
            frequencyN: 2,
            blackoutCellRaw: '2026-07-05; 2026-08-16',
            serveWithRaw: ['Ben Smith'],
            warnings: [],
        });
    });
    (0, vitest_1.it)('pushes a "Missing name" warning when Name is empty', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: '',
            Roles: 'vocals',
            Frequency: 'weekly',
            'Blackout Dates': '',
            'Serve-With': '',
        });
        (0, vitest_1.expect)(result.warnings).toContain('Missing name');
    });
    (0, vitest_1.it)('defaults frequencyN and warns when Frequency is unrecognized', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: 'Jamie Lee',
            Roles: 'drums',
            Frequency: 'sometimes-ish',
            'Blackout Dates': '',
            'Serve-With': '',
        });
        (0, vitest_1.expect)(result.frequencyN).toBe(4);
        (0, vitest_1.expect)(result.warnings.some(function (w) { return w.includes('Frequency'); })).toBe(true);
    });
    // WR-03 regression: "1-in-0" is matched by the "1-in-N" shape but N=0 is invalid — it must
    // surface the same unrecognized/defaulted warning as an invalid bare integer, not be
    // silently accepted (which is what let scheduler.ts see an Infinity deficit score).
    (0, vitest_1.it)('defaults frequencyN to 4 and warns for "1-in-0" (non-positive N)', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: 'Jamie Lee',
            Roles: 'drums',
            Frequency: '1-in-0',
            'Blackout Dates': '',
            'Serve-With': '',
        });
        (0, vitest_1.expect)(result.frequencyN).toBe(4);
        (0, vitest_1.expect)(result.warnings.some(function (w) { return w.includes('Frequency'); })).toBe(true);
    });
    (0, vitest_1.it)('splits multi-value cells on ";", trims, and drops empties', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: 'Pat Doe',
            Roles: 'vocals;  ; guitar',
            Frequency: 'weekly',
            'Blackout Dates': '',
            'Serve-With': '',
        });
        (0, vitest_1.expect)(result.rolesRaw).toEqual(['vocals', 'guitar']);
    });
});
(0, vitest_1.describe)('parseVolunteerCsvRow — no per-role CSV schema change (Pitfall 4, D-07 graceful degrade)', function () {
    (0, vitest_1.it)('emits exactly one scalar frequencyN per row, regardless of role count — no per-role structure', function () {
        var result = (0, volunteerCsv_1.parseVolunteerCsvRow)({
            Name: 'Multi Role Person',
            Roles: 'guitar; vocals; bass',
            Frequency: 'twice a month',
            'Blackout Dates': '',
            'Serve-With': '',
        });
        (0, vitest_1.expect)(typeof result.frequencyN).toBe('number');
        (0, vitest_1.expect)(result.frequencyN).toBe(2);
        (0, vitest_1.expect)(result.rolesRaw).toHaveLength(3);
        // Exact key set — proves the parser's output shape is unchanged by Phase 15
        // (the per-role application happens at the caller layer, not here).
        (0, vitest_1.expect)(Object.keys(result)).toEqual([
            'name',
            'rolesRaw',
            'frequencyN',
            'blackoutCellRaw',
            'serveWithRaw',
            'warnings',
        ]);
    });
});
(0, vitest_1.describe)('frequencyLabelToN', function () {
    (0, vitest_1.it)('maps known friendly labels', function () {
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('weekly')).toBe(1);
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('twice a month')).toBe(2);
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('once a month')).toBe(4);
    });
    (0, vitest_1.it)('parses a bare integer string', function () {
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('3')).toBe(3);
    });
    (0, vitest_1.it)('parses a "1-in-N" string', function () {
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('1-in-6')).toBe(6);
    });
    (0, vitest_1.it)('defaults unknown labels to 4', function () {
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('whenever')).toBe(4);
    });
    // WR-03 regression: "1-in-0" must not be accepted as a literal N=0 (which would produce an
    // Infinity deficit score in scheduler.ts) — it must fall back to the same default-4 path as
    // an invalid bare integer like "0" or "-5".
    (0, vitest_1.it)('rejects "1-in-0" (non-positive N) and defaults to 4, same as an invalid bare integer', function () {
        (0, vitest_1.expect)((0, volunteerCsv_1.frequencyLabelToN)('1-in-0')).toBe(4);
    });
});
(0, vitest_1.describe)('expandBlackoutCell', function () {
    var serviceDates = [
        '2026-07-05',
        '2026-08-09',
        '2026-08-16',
        '2026-08-23',
        '2026-08-30',
        '2026-09-06',
    ];
    (0, vitest_1.it)('expands a range to exactly the in-range Sundays (inclusive endpoints) plus a single date', function () {
        var result = (0, volunteerCsv_1.expandBlackoutCell)('2026-07-05; 2026-08-02..2026-08-30', serviceDates);
        (0, vitest_1.expect)(result).toEqual([
            '2026-07-05',
            '2026-08-09',
            '2026-08-16',
            '2026-08-23',
            '2026-08-30',
        ]);
    });
    (0, vitest_1.it)('ignores a date not present in serviceDates', function () {
        var result = (0, volunteerCsv_1.expandBlackoutCell)('2026-12-25', serviceDates);
        (0, vitest_1.expect)(result).toEqual([]);
    });
    (0, vitest_1.it)('returns a de-duplicated, ascending list', function () {
        var result = (0, volunteerCsv_1.expandBlackoutCell)('2026-08-16; 2026-08-09..2026-08-16', serviceDates);
        (0, vitest_1.expect)(result).toEqual(['2026-08-09', '2026-08-16']);
    });
});
(0, vitest_1.describe)('matchNameToPerson', function () {
    (0, vitest_1.it)('matches despite double internal whitespace', function () {
        var roster = [makePerson('p1', 'sarah  smith')];
        var result = (0, volunteerCsv_1.matchNameToPerson)('Sarah Smith', roster);
        (0, vitest_1.expect)(result).toEqual({ status: 'matched', personId: 'p1', candidates: [] });
    });
    (0, vitest_1.it)('matches despite trailing whitespace', function () {
        var roster = [makePerson('p1', 'Sarah Smith ')];
        var result = (0, volunteerCsv_1.matchNameToPerson)('Sarah Smith', roster);
        (0, vitest_1.expect)(result.status).toBe('matched');
        (0, vitest_1.expect)(result.personId).toBe('p1');
    });
    (0, vitest_1.it)('returns ambiguous with all candidate ids when two people normalize the same', function () {
        var roster = [makePerson('p1', 'Chris'), makePerson('p2', 'chris ')];
        var result = (0, volunteerCsv_1.matchNameToPerson)('Chris', roster);
        (0, vitest_1.expect)(result.status).toBe('ambiguous');
        (0, vitest_1.expect)(result.personId).toBeNull();
        (0, vitest_1.expect)(result.candidates.sort()).toEqual(['p1', 'p2']);
    });
    (0, vitest_1.it)('returns unmatched with null personId when no roster entry normalizes the same', function () {
        var roster = [makePerson('p1', 'Sarah Smith')];
        var result = (0, volunteerCsv_1.matchNameToPerson)('Nobody Here', roster);
        (0, vitest_1.expect)(result).toEqual({ status: 'unmatched', personId: null, candidates: [] });
    });
    (0, vitest_1.it)('includes inactive people in matching (caller decides eligibility)', function () {
        var roster = [makePerson('p1', 'Sarah Smith', false)];
        var result = (0, volunteerCsv_1.matchNameToPerson)('Sarah Smith', roster);
        (0, vitest_1.expect)(result.status).toBe('matched');
        (0, vitest_1.expect)(result.personId).toBe('p1');
    });
    (0, vitest_1.it)('does not mutate the roster input and is deterministic across calls', function () {
        var roster = [makePerson('p1', 'Sarah Smith')];
        var snapshot = JSON.stringify(roster);
        var first = (0, volunteerCsv_1.matchNameToPerson)('Sarah Smith', roster);
        var second = (0, volunteerCsv_1.matchNameToPerson)('Sarah Smith', roster);
        (0, vitest_1.expect)(JSON.stringify(roster)).toBe(snapshot);
        (0, vitest_1.expect)(first).toEqual(second);
    });
});
