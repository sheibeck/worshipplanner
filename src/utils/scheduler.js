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
exports.evaluateGroupCombo = evaluateGroupCombo;
exports.isGroupCompatible = isGroupCompatible;
exports.proposeQuarterSchedule = proposeQuarterSchedule;
/**
 * Pure group co-occurrence rule (D-10, derived purely from group, NOT configurable):
 * - TECH is exclusive: a person holding a TECH role that date cannot also hold any
 *   BAND/VOCALS/OTHER role that date, and vice versa.
 * - Cardinality per person per date: at most 1 BAND role, at most 1 VOCALS role. OTHER is
 *   uncapped. The canonical allowed combo is "1 BAND + 1 VOCALS (+ OTHER)".
 * Exported so QuarterGrid.vue (plan 15-06) can reuse the exact same evaluation for its
 * manual-grid warning badge, since it cannot import scheduler.ts's internal closures.
 */
function evaluateGroupCombo(roleIds, roleGroupOf) {
    var groups = roleIds.map(function (id) { return roleGroupOf(id); });
    var hasTech = groups.includes('tech');
    var hasNonTech = groups.some(function (g) { return g !== 'tech'; });
    if (hasTech && hasNonTech) {
        return { ok: false, reason: 'TECH is exclusive of all other role groups on the same date' };
    }
    var bandCount = groups.filter(function (g) { return g === 'band'; }).length;
    if (bandCount > 1) {
        return { ok: false, reason: 'at most 1 BAND role per person per date' };
    }
    var vocalsCount = groups.filter(function (g) { return g === 'vocals'; }).length;
    if (vocalsCount > 1) {
        return { ok: false, reason: 'at most 1 VOCALS role per person per date' };
    }
    return { ok: true };
}
/**
 * Whether adding `candidateRoleId` to a person's already-assigned roleIds for a given date
 * (`assignedRoleIdsThisDate`) keeps the resulting combo legal (D-10/D-12). Pure/deterministic —
 * used by BOTH the main `eligible()` filter and `propagatePairing`'s role selection so paired
 * partners can never be pulled into an illegal combo (RESEARCH Pitfall 2).
 */
function isGroupCompatible(assignedRoleIdsThisDate, candidateRoleId, roleGroupOf) {
    return evaluateGroupCombo(__spreadArray(__spreadArray([], assignedRoleIdsThisDate, true), [candidateRoleId], false), roleGroupOf).ok;
}
/**
 * Deterministic, pure, greedy weighted-fair-share quarterly scheduler (D-06 through D-12).
 *
 * Processes service dates chronologically; for each date, fills each role's slots (in the
 * order returned by resolveRolesForDate) by picking the eligible/available candidate furthest
 * below their 1-in-N frequency target for THAT role (D-05 — cadence and tier are scored per
 * (person, role), not blended across a person's roles). Blackout dates (D-07) and pairings
 * (D-09) are hard constraints — never violated. Unfillable slots are reported in `unfilled`
 * rather than fabricating an assignment (D-10); pairings that can't be honored (partner
 * blacked out, out-tier for every eligible role, or no group-compatible role available) are
 * reported in `pairingConflicts` rather than silently dropped or forced. Group co-occurrence
 * rules (D-10) are enforced identically in both the main assignment loop and the pairing
 * propagation path via the shared `isGroupCompatible` helper (RESEARCH Pitfall 2).
 *
 * Pure function: no database reads/writes, no framework imports, no wall-clock reads, no
 * non-deterministic randomness — fully deterministic and unit-testable, mirroring the
 * pattern established by src/utils/suggestions.ts.
 */
function proposeQuarterSchedule(people, serviceDates, resolveRolesForDate, personQuarterData, existingCalendar, 
// Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other'
// (safe default) so existing call-sites that omit this param keep compiling and behave as
// "everything combines" (RESEARCH Pitfall 1).
roleGroupOf) {
    var _a, _b, _c;
    if (roleGroupOf === void 0) { roleGroupOf = function () { return 'other'; }; }
    var pqdById = new Map(personQuarterData.map(function (p) { return [p.personId, p]; }));
    var isBlackedOut = function (personId, date) { var _a, _b; return (_b = (_a = pqdById.get(personId)) === null || _a === void 0 ? void 0 : _a.blackoutDates.includes(date)) !== null && _b !== void 0 ? _b : false; };
    var partnersOf = function (personId) { var _a, _b; return (_b = (_a = pqdById.get(personId)) === null || _a === void 0 ? void 0 : _a.pairedWith) !== null && _b !== void 0 ? _b : []; };
    // undefined = pre-migration data (or no PQD entry at all) — treat as 'regular' (D-05).
    // Quarter-scoped, per-role single source of truth (D-04) — tier and cadence-N both read
    // from PersonQuarterData.roleFrequency; absent role entry defaults to {tier:'regular', n:4}.
    var roleFrequencyOf = function (personId, roleId) { var _a, _b, _c; return (_c = (_b = (_a = pqdById.get(personId)) === null || _a === void 0 ? void 0 : _a.roleFrequency) === null || _b === void 0 ? void 0 : _b[roleId]) !== null && _c !== void 0 ? _c : { tier: 'regular', n: 4 }; };
    var tierOf = function (personId, roleId) {
        return roleFrequencyOf(personId, roleId).tier;
    };
    // D-01/D-02 — even-spread cadence gate. "1-in-N" means "serve at most once every N dates", so
    // a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served
    // count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are
    // behind their ideal pace. This is what spreads a monthly (n=4) person evenly across the WHOLE
    // quarter (weeks 1, 5, 9, 13…) instead of greedily booking them every week until a flat
    // whole-quarter budget runs out and then leaving the rest blank (the front-loading bug: the
    // sole guitarist getting every Sunday in June, then nothing). A simple count ceiling can't do
    // this — the target has to advance with the calendar. WR-02: n<=0 (the drawer's "As-needed
    // (fill-in)" preset writes n:0, and malformed/legacy entries could too) has no valid cadence,
    // so the person is NEVER proactively scheduled — no divide-by-zero into Infinity. Used by BOTH
    // the main assignment loop and propagatePairing so direct picks and pull-ins are spaced
    // identically (no front-loading on either path).
    var withinCadence = function (personId, roleId, dateIndex) {
        var n = roleFrequencyOf(personId, roleId).n;
        if (n <= 0)
            return false;
        return getServedByRole(personId, roleId) < (dateIndex + 1) / n;
    };
    // Aggregate served count — kept for the external ProposeResult.servedCounts shape (unchanged,
    // Record<personId, number>; nothing outside scheduler.ts reads it beyond that shape).
    var served = new Map(people.map(function (p) { return [p.id, 0]; }));
    // Internal per-(person, role) served tracking, keyed `${personId}::${roleId}` — deficit
    // scoring uses this so one role's cadence never leaks into another role's fairness (D-05).
    var servedByRole = new Map();
    var servedByRoleKey = function (personId, roleId) { return "".concat(personId, "::").concat(roleId); };
    var getServedByRole = function (personId, roleId) { var _a; return (_a = servedByRole.get(servedByRoleKey(personId, roleId))) !== null && _a !== void 0 ? _a : 0; };
    var calendar = {};
    var unfilled = [];
    var pairingConflicts = [];
    // Seed with existing (locked) assignments in "fill gaps" mode so servedCount/deficit
    // accounts for people already scheduled.
    if (existingCalendar) {
        for (var _i = 0, serviceDates_1 = serviceDates; _i < serviceDates_1.length; _i++) {
            var date = serviceDates_1[_i];
            calendar[date] = __assign({}, ((_a = existingCalendar[date]) !== null && _a !== void 0 ? _a : {}));
            for (var _d = 0, _e = Object.entries((_b = calendar[date]) !== null && _b !== void 0 ? _b : {}); _d < _e.length; _d++) {
                var _f = _e[_d], roleId = _f[0], ids = _f[1];
                for (var _g = 0, _h = ids !== null && ids !== void 0 ? ids : []; _g < _h.length; _g++) {
                    var id = _h[_g];
                    served.set(id, ((_c = served.get(id)) !== null && _c !== void 0 ? _c : 0) + 1);
                    servedByRole.set(servedByRoleKey(id, roleId), getServedByRole(id, roleId) + 1);
                }
            }
        }
    }
    serviceDates.forEach(function (date, dateIndex) {
        var _a, _b;
        var _c;
        (_a = calendar[date]) !== null && _a !== void 0 ? _a : (calendar[date] = {});
        var rolesForDate = resolveRolesForDate(date);
        // Roles a person already holds THIS date — recomputed fresh (reads live calendar[date]
        // state), so it correctly reflects assignments made moments earlier in the same date's
        // processing, including ones made via propagatePairing.
        var rolesHeldThisDate = function (personId) {
            var _a;
            return Object.entries((_a = calendar[date]) !== null && _a !== void 0 ? _a : {})
                .filter(function (_a) {
                var ids = _a[1];
                return ids === null || ids === void 0 ? void 0 : ids.includes(personId);
            })
                .map(function (_a) {
                var roleId = _a[0];
                return roleId;
            });
        };
        var assignToRole = function (roleId, personId) {
            var _a, _b;
            var _c;
            (_a = (_c = calendar[date])[roleId]) !== null && _a !== void 0 ? _a : (_c[roleId] = []);
            if (!calendar[date][roleId].includes(personId)) {
                calendar[date][roleId].push(personId);
                served.set(personId, ((_b = served.get(personId)) !== null && _b !== void 0 ? _b : 0) + 1);
                servedByRole.set(servedByRoleKey(personId, roleId), getServedByRole(personId, roleId) + 1);
            }
        };
        var propagatePairing = function (personId, visited) {
            var _a;
            var _loop_2 = function (partnerId) {
                if (visited.has(partnerId))
                    return "continue";
                visited.add(partnerId);
                var alreadyToday = Object.values((_a = calendar[date]) !== null && _a !== void 0 ? _a : {}).some(function (ids) { return ids.includes(partnerId); });
                if (alreadyToday)
                    return "continue";
                if (isBlackedOut(partnerId, date)) {
                    pairingConflicts.push({ date: date, personId: personId, partnerId: partnerId, reason: 'partner blacked out' });
                    return "continue";
                }
                var partner = people.find(function (p) { return p.id === partnerId; });
                if (!partner)
                    return "continue";
                // Own roles only (D-09) — prefer a role with remaining template capacity, else overflow
                // first eligible role.
                var roleMatchesByName = rolesForDate.filter(function (r) { return partner.roles.includes(r.roleId); });
                if (roleMatchesByName.length === 0) {
                    pairingConflicts.push({ date: date, personId: personId, partnerId: partnerId, reason: 'no eligible role for partner today' });
                    return "continue";
                }
                var notOutTier = roleMatchesByName.filter(function (r) { return tierOf(partnerId, r.roleId) !== 'out'; });
                if (notOutTier.length === 0) {
                    pairingConflicts.push({ date: date, personId: personId, partnerId: partnerId, reason: 'partner out this quarter' });
                    return "continue";
                }
                // Fill-in tier is manual-only — a paired fill-in partner is NOT auto-pulled in. Silent
                // skip (like the cadence skip below), not a genuine conflict: the coordinator schedules
                // fill-ins by hand.
                var regularRoles = notOutTier.filter(function (r) { return tierOf(partnerId, r.roleId) === 'regular'; });
                if (regularRoles.length === 0)
                    return "continue";
                // D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent
                // role-selection path. It MUST apply the exact same shared group-compatibility check as
                // the main loop below, or a paired partner can silently be pulled into an illegal combo.
                var eligibleRoles = regularRoles.filter(function (r) {
                    return isGroupCompatible(rolesHeldThisDate(partnerId), r.roleId, roleGroupOf);
                });
                if (eligibleRoles.length === 0) {
                    pairingConflicts.push({ date: date, personId: personId, partnerId: partnerId, reason: 'group rule violation for partner today' });
                    return "continue";
                }
                // D-01/D-02 — only pull the partner in on the occurrences where they're behind their OWN
                // even-spread per-role pace (same withinCadence gate the main loop uses). This gives
                // containment its correct asymmetric shape AND spreads the pull-ins evenly: a lower-cadence
                // partner (e.g. Nolan, ~once/month) lands on an evenly-spaced subset of the higher-cadence
                // anchor's (e.g. Tim, ~twice/month) dates — every 4th of Tim's dates, not front-loaded onto
                // Tim's first several. Tim's "extra" occurrences beyond Nolan's pace proceed without Nolan,
                // never inflating Nolan's serve count up to Tim's cadence (anti-pattern rejected by D-01).
                var spaced = eligibleRoles.filter(function (r) { return withinCadence(partnerId, r.roleId, dateIndex); });
                if (spaced.length === 0) {
                    return "continue";
                }
                // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
                // this gate only constrains pull-ins via propagation. If the partner independently holds
                // a role the anchor does not, the main loop's spacing pass could in principle still pick
                // the partner directly on a date the anchor isn't serving at all, which a maximally strict
                // reading of containment would forbid. The canonical pairing shape (co-vocalists /
                // parent-child sharing the same role) does not hit this edge case, so it's shipped as-is.
                var withCapacity = spaced.find(function (r) { var _a, _b; return ((_b = (_a = calendar[date][r.roleId]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) < r.count; });
                var target = withCapacity !== null && withCapacity !== void 0 ? withCapacity : spaced[0];
                assignToRole(target.roleId, partnerId);
                propagatePairing(partnerId, visited); // handle chained pairings (e.g. two kids, one parent)
            };
            for (var _i = 0, _b = partnersOf(personId); _i < _b.length; _i++) {
                var partnerId = _b[_i];
                _loop_2(partnerId);
            }
        };
        var _loop_1 = function (roleId, count) {
            (_b = (_c = calendar[date])[roleId]) !== null && _b !== void 0 ? _b : (_c[roleId] = []);
            var _loop_3 = function () {
                var alreadyInRole = new Set(calendar[date][roleId]);
                // Only 'regular'-tier people are auto-scheduled. 'fillin'-tier is manual-only — the
                // coordinator fills those gaps by hand (there is intentionally NO last-resort fillin
                // auto-fill), and 'out'-tier is excluded for the whole quarter. A regular candidate
                // stays eligible only while still BEHIND their even-spread cadence pace
                // (withinCadence): "1-in-N" means once every N dates, so a monthly (n=4) person is only
                // eligible on ~every 4th date and lands evenly across the whole quarter instead of being
                // front-loaded into the first few weeks and then dropped. When nobody is behind their
                // pace, the slot is left BLANK (pushed to `unfilled`) rather than over-serving someone:
                // hard caps win over full coverage, and blank spots are acceptable/expected (they get
                // filled in by hand). This is what stops the "only guitarist gets booked every single
                // week" and "once-a-month person lands twice a month" over-scheduling.
                var candidates = people.filter(function (p) {
                    return p.active &&
                        p.roles.includes(roleId) &&
                        !isBlackedOut(p.id, date) &&
                        !alreadyInRole.has(p.id) &&
                        tierOf(p.id, roleId) === 'regular' &&
                        withinCadence(p.id, roleId, dateIndex) &&
                        // D-10/D-12 — same shared helper as propagatePairing above.
                        isGroupCompatible(rolesHeldThisDate(p.id), roleId, roleGroupOf);
                });
                if (candidates.length === 0) {
                    unfilled.push({ date: date, roleId: roleId });
                    return "break";
                }
                var scored = candidates
                    .map(function (p) {
                    // Per-role cadence (D-05): N sourced from the quarter-scoped roleFrequency entry
                    // (D-04); absent role entry defaults to n=4 via roleFrequencyOf. Only regular-tier
                    // candidates reach here, so the deficit formula always applies.
                    var n = roleFrequencyOf(p.id, roleId).n;
                    return {
                        p: p,
                        deficit: (dateIndex + 1) / n - getServedByRole(p.id, roleId),
                    };
                })
                    .sort(function (a, b) {
                    return b.deficit - a.deficit ||
                        getServedByRole(a.p.id, roleId) - getServedByRole(b.p.id, roleId) ||
                        a.p.name.localeCompare(b.p.name);
                });
                var chosen = scored[0].p;
                assignToRole(roleId, chosen.id);
                propagatePairing(chosen.id, new Set([chosen.id]));
            };
            while (calendar[date][roleId].length < count) {
                var state_1 = _loop_3();
                if (state_1 === "break")
                    break;
            }
        };
        for (var _i = 0, rolesForDate_1 = rolesForDate; _i < rolesForDate_1.length; _i++) {
            var _d = rolesForDate_1[_i], roleId = _d.roleId, count = _d.count;
            _loop_1(roleId, count);
        }
    });
    return { calendar: calendar, servedCounts: Object.fromEntries(served), unfilled: unfilled, pairingConflicts: pairingConflicts };
}
