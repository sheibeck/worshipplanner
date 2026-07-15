"use strict";
// Pure date-math helpers for quarter service-date generation (D-01).
// No Firestore, no Vue, no Date.now() — dates are derived entirely from year/quarter inputs.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSundaysInQuarter = generateSundaysInQuarter;
exports.applyDateAdditionsRemovals = applyDateAdditionsRemovals;
var fmtDate = function (d) {
    return "".concat(d.getFullYear(), "-").concat(String(d.getMonth() + 1).padStart(2, '0'), "-").concat(String(d.getDate()).padStart(2, '0'));
};
/**
 * Returns every Sunday in the given quarter as zero-padded YYYY-MM-DD strings, ascending.
 * Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec.
 */
function generateSundaysInQuarter(year, quarter) {
    var startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
    var start = new Date(year, startMonth, 1);
    var end = new Date(year, startMonth + 3, 0); // last day of the quarter
    var sundays = [];
    var d = new Date(start);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // advance to first Sunday on/after start
    while (d <= end) {
        sundays.push(fmtDate(d));
        d.setDate(d.getDate() + 7);
    }
    return sundays;
}
/**
 * Applies one-off date additions/removals to a base list of service dates.
 * Returns a sorted, de-duplicated array of YYYY-MM-DD strings.
 */
function applyDateAdditionsRemovals(dates, changes) {
    var _a, _b;
    var set = new Set(dates);
    for (var _i = 0, _c = (_a = changes.add) !== null && _a !== void 0 ? _a : []; _i < _c.length; _i++) {
        var d = _c[_i];
        set.add(d);
    }
    for (var _d = 0, _e = (_b = changes.remove) !== null && _b !== void 0 ? _b : []; _d < _e.length; _d++) {
        var d = _e[_d];
        set.delete(d);
    }
    return Array.from(set).sort();
}
