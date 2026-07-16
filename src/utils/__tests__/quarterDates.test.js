"use strict";
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
var quarterDates_1 = require("@/utils/quarterDates");
(0, vitest_1.describe)('generateSundaysInQuarter', function () {
    (0, vitest_1.it)('returns every Sunday from 2026-07-01 through 2026-09-30 for Q3 2026, ascending', function () {
        var result = (0, quarterDates_1.generateSundaysInQuarter)(2026, 3);
        (0, vitest_1.expect)(result).toEqual([
            '2026-07-05',
            '2026-07-12',
            '2026-07-19',
            '2026-07-26',
            '2026-08-02',
            '2026-08-09',
            '2026-08-16',
            '2026-08-23',
            '2026-08-30',
            '2026-09-06',
            '2026-09-13',
            '2026-09-20',
            '2026-09-27',
        ]);
    });
    (0, vitest_1.it)('Q1 boundary: first returned date is the first Sunday on/after Jan 1; last is the last Sunday on/before Mar 31', function () {
        var result = (0, quarterDates_1.generateSundaysInQuarter)(2026, 1);
        (0, vitest_1.expect)(result[0]).toBe('2026-01-04'); // Jan 1, 2026 is a Thursday; first Sunday is Jan 4
        (0, vitest_1.expect)(result[result.length - 1]).toBe('2026-03-29'); // last Sunday on/before Mar 31, 2026
    });
    (0, vitest_1.it)('every returned string is zero-padded YYYY-MM-DD and parses to a Sunday (getDay() === 0)', function () {
        var result = (0, quarterDates_1.generateSundaysInQuarter)(2026, 2);
        (0, vitest_1.expect)(result.length).toBeGreaterThan(0);
        for (var _i = 0, result_1 = result; _i < result_1.length; _i++) {
            var dateStr = result_1[_i];
            (0, vitest_1.expect)(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            var parsed = new Date(dateStr + 'T00:00:00');
            (0, vitest_1.expect)(parsed.getDay()).toBe(0);
        }
    });
    (0, vitest_1.it)('returns dates in ascending (sorted) order', function () {
        var result = (0, quarterDates_1.generateSundaysInQuarter)(2026, 4);
        var sorted = __spreadArray([], result, true).sort();
        (0, vitest_1.expect)(result).toEqual(sorted);
    });
});
(0, vitest_1.describe)('applyDateAdditionsRemovals', function () {
    (0, vitest_1.it)('adds a date and removes a date, sorted ascending and de-duplicated', function () {
        var base = ['2026-07-05', '2026-07-12', '2026-07-19'];
        var result = (0, quarterDates_1.applyDateAdditionsRemovals)(base, {
            add: ['2026-08-19'],
            remove: ['2026-07-05'],
        });
        (0, vitest_1.expect)(result).toEqual(['2026-07-12', '2026-07-19', '2026-08-19']);
    });
    (0, vitest_1.it)('returns the base list unchanged (sorted, deduped) when add/remove are empty', function () {
        var base = ['2026-07-19', '2026-07-05', '2026-07-12'];
        var result = (0, quarterDates_1.applyDateAdditionsRemovals)(base, {});
        (0, vitest_1.expect)(result).toEqual(['2026-07-05', '2026-07-12', '2026-07-19']);
    });
    (0, vitest_1.it)('de-duplicates when an added date already exists in base', function () {
        var base = ['2026-07-05', '2026-07-12'];
        var result = (0, quarterDates_1.applyDateAdditionsRemovals)(base, { add: ['2026-07-05'] });
        (0, vitest_1.expect)(result).toEqual(['2026-07-05', '2026-07-12']);
    });
    (0, vitest_1.it)('handles removing a date not present in base without error', function () {
        var base = ['2026-07-05', '2026-07-12'];
        var result = (0, quarterDates_1.applyDateAdditionsRemovals)(base, { remove: ['2026-12-25'] });
        (0, vitest_1.expect)(result).toEqual(['2026-07-05', '2026-07-12']);
    });
});
