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
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var test_utils_1 = require("@vue/test-utils");
var QuarterGrid_vue_1 = require("../QuarterGrid.vue");
var mockAssignPerson = vitest_1.vi.fn();
var mockClearAssignment = vitest_1.vi.fn();
var mockSwapAssignment = vitest_1.vi.fn();
vitest_1.vi.mock('@/stores/quarters', function () { return ({
    useQuartersStore: function () { return ({
        assignPerson: mockAssignPerson,
        clearAssignment: mockClearAssignment,
        swapAssignment: mockSwapAssignment,
    }); },
}); });
var mockActivePeople = [
    {
        id: 'person-regular',
        name: 'Regular Rachel',
        email: 'rachel@example.com',
        phone: '',
        active: true,
        roles: ['role-guitar'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
    {
        id: 'person-out',
        name: 'Outbound Otto',
        email: 'otto@example.com',
        phone: '',
        active: true,
        roles: ['role-guitar'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
    {
        id: 'person-role-tier',
        name: 'Perrole Petra',
        email: 'petra@example.com',
        phone: '',
        active: true,
        roles: ['role-guitar', 'role-drums'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
];
vitest_1.vi.mock('@/stores/roster', function () { return ({
    useRosterStore: function () { return ({
        people: mockActivePeople,
        activePeople: mockActivePeople,
    }); },
}); });
function makeRoles() {
    return [{ id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 }];
}
function makeQuarter(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'quarter-1', label: 'Q3 2026', year: 2026, quarter: 3, serviceDates: ['2026-07-05'], roleOverridesByDate: {}, personQuarterData: {
            'person-out': {
                personId: 'person-out',
                blackoutDates: [],
                pairedWith: [],
                roleFrequency: { 'role-guitar': { tier: 'out', n: 4 } },
                note: '',
            },
        }, calendar: {}, status: 'draft', shareToken: null, createdAt: {}, updatedAt: {} }, overrides);
}
// The group editor slide-out (R-14) is a Teleport; stub it so teleported content is
// reachable via wrapper.find/findAll/text (mirrors AvailabilityDrawer.test.ts's pattern).
function mountGrid(props) {
    return (0, test_utils_1.mount)(QuarterGrid_vue_1.default, {
        props: props,
        global: {
            stubs: { Teleport: { template: '<div><slot /></div>' } },
        },
    });
}
// Open the whole-row drawer for a given date by clicking its row.
function openRow(wrapper, date) {
    return __awaiter(this, void 0, void 0, function () {
        var row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = wrapper.find("tr[data-date=\"".concat(date, "\"]"));
                    (0, vitest_1.expect)(row.exists()).toBe(true);
                    return [4 /*yield*/, row.trigger('click')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
(0, vitest_1.describe)('QuarterGrid', function () {
    (0, vitest_1.it)('excludes an out tier person from the manual gap-filling candidate list', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, section;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wrapper = mountGrid({
                        quarter: makeQuarter(),
                        roles: makeRoles(),
                        lastProposeResult: null,
                    });
                    // Open the row drawer to reveal the per-role candidate list.
                    return [4 /*yield*/, openRow(wrapper, '2026-07-05')];
                case 1:
                    // Open the row drawer to reveal the per-role candidate list.
                    _a.sent();
                    section = wrapper.find('[data-role-section="role-guitar"]');
                    (0, vitest_1.expect)(section.text()).toContain('Regular Rachel');
                    (0, vitest_1.expect)(section.text()).not.toContain('Outbound Otto');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('still offers a person with no roleFrequency entry (defaults regular) as a candidate', function () { return __awaiter(void 0, void 0, void 0, function () {
        var quarter, wrapper, section;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    quarter = makeQuarter({ personQuarterData: {} });
                    wrapper = mountGrid({
                        quarter: quarter,
                        roles: makeRoles(),
                        lastProposeResult: null,
                    });
                    return [4 /*yield*/, openRow(wrapper, '2026-07-05')];
                case 1:
                    _a.sent();
                    section = wrapper.find('[data-role-section="role-guitar"]');
                    (0, vitest_1.expect)(section.text()).toContain('Regular Rachel');
                    (0, vitest_1.expect)(section.text()).toContain('Outbound Otto');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('excludes a person from a candidate list only for the role they are out for, per-role (D-05 gap closure, R-05 single source)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var DATE, roles, quarter, wrapper, guitarSection, drumsSection;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    DATE = '2026-07-05';
                    roles = [
                        { id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
                        { id: 'role-drums', name: 'drums', group: 'band', defaultCount: 1, order: 1 },
                    ];
                    quarter = makeQuarter({
                        serviceDates: [DATE],
                        personQuarterData: {
                            'person-role-tier': {
                                personId: 'person-role-tier',
                                blackoutDates: [],
                                pairedWith: [],
                                roleFrequency: {
                                    'role-guitar': { tier: 'out', n: 4 },
                                    'role-drums': { tier: 'regular', n: 4 },
                                },
                                note: '',
                            },
                        },
                    });
                    wrapper = mountGrid({ quarter: quarter, roles: roles, lastProposeResult: null });
                    // The whole-row drawer shows every role section at once. Petra is 'out' for
                    // guitar (excluded there) but 'regular' for drums (offered there) — per-role,
                    // not per-person.
                    return [4 /*yield*/, openRow(wrapper, DATE)];
                case 1:
                    // The whole-row drawer shows every role section at once. Petra is 'out' for
                    // guitar (excluded there) but 'regular' for drums (offered there) — per-role,
                    // not per-person.
                    _a.sent();
                    guitarSection = wrapper.find('[data-role-section="role-guitar"]');
                    drumsSection = wrapper.find('[data-role-section="role-drums"]');
                    (0, vitest_1.expect)(guitarSection.text()).not.toContain('Perrole Petra');
                    (0, vitest_1.expect)(drumsSection.text()).toContain('Perrole Petra');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.describe)('whole-row click opens the slide-out row editor', function () {
        var DATE = '2026-07-05';
        (0, vitest_1.it)('clicking a date row opens the slide-out editor titled with that date', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        wrapper = mountGrid({
                            quarter: makeQuarter({ serviceDates: [DATE], calendar: (_a = {}, _a[DATE] = { 'role-guitar': ['person-regular'] }, _a) }),
                            roles: makeRoles(),
                            lastProposeResult: null,
                        });
                        // Slide-out is closed initially — the close button (panel-only element) absent.
                        (0, vitest_1.expect)(wrapper.find('[aria-label="Close editor"]').exists()).toBe(false);
                        return [4 /*yield*/, openRow(wrapper, DATE)
                            // Panel now rendered (Teleport stubbed in place) with the date title.
                        ];
                    case 1:
                        _b.sent();
                        // Panel now rendered (Teleport stubbed in place) with the date title.
                        (0, vitest_1.expect)(wrapper.find('[aria-label="Close editor"]').exists()).toBe(true);
                        (0, vitest_1.expect)(wrapper.text()).toContain('Sun, Jul 5');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('row-drawer actions invoke the corresponding store methods', function () {
        var DATE = '2026-07-05';
        (0, vitest_1.it)('assigning a person from the "Add a person" select calls assignPerson', function () { return __awaiter(void 0, void 0, void 0, function () {
            var quarter, wrapper, section, addSelect, assignButton;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAssignPerson.mockClear();
                        quarter = makeQuarter({ serviceDates: [DATE] });
                        wrapper = mountGrid({ quarter: quarter, roles: makeRoles(), lastProposeResult: null });
                        return [4 /*yield*/, openRow(wrapper, DATE)];
                    case 1:
                        _a.sent();
                        section = wrapper.find('[data-role-section="role-guitar"]');
                        addSelect = section.find('select');
                        return [4 /*yield*/, addSelect.setValue('person-regular')];
                    case 2:
                        _a.sent();
                        assignButton = section.findAll('button').find(function (b) { return b.text() === 'Assign' && !b.attributes('disabled'); });
                        return [4 /*yield*/, assignButton.trigger('click')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(mockAssignPerson).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('clearing an assigned person from the drawer\'s Clear button calls clearAssignment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var quarter, wrapper, clearButton;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockClearAssignment.mockClear();
                        quarter = makeQuarter({
                            serviceDates: [DATE],
                            calendar: (_a = {}, _a[DATE] = { 'role-guitar': ['person-regular'] }, _a),
                        });
                        wrapper = mountGrid({ quarter: quarter, roles: makeRoles(), lastProposeResult: null });
                        return [4 /*yield*/, openRow(wrapper, DATE)];
                    case 1:
                        _b.sent();
                        clearButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Clear'; });
                        return [4 /*yield*/, clearButton.trigger('click')];
                    case 2:
                        _b.sent();
                        (0, vitest_1.expect)(mockClearAssignment).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('swapping an assigned person via the swap select calls swapAssignment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var quarter, wrapper, swapSelect;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockSwapAssignment.mockClear();
                        quarter = makeQuarter({
                            serviceDates: [DATE],
                            calendar: (_a = {}, _a[DATE] = { 'role-guitar': ['person-regular'] }, _a),
                        });
                        wrapper = mountGrid({ quarter: quarter, roles: makeRoles(), lastProposeResult: null });
                        return [4 /*yield*/, openRow(wrapper, DATE)
                            // First select in the guitar section is the swap select for the assigned person.
                        ];
                    case 1:
                        _b.sent();
                        swapSelect = wrapper.find('[data-role-section="role-guitar"]').findAll('select')[0];
                        return [4 /*yield*/, swapSelect.setValue('person-role-tier')];
                    case 2:
                        _b.sent();
                        (0, vitest_1.expect)(mockSwapAssignment).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular', 'person-role-tier');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
(0, vitest_1.describe)('QuarterGrid — live group co-occurrence warning (D-11)', function () {
    var DATE = '2026-07-05';
    function makeRolesFull() {
        return [
            { id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
            { id: 'role-bass', name: 'bass', group: 'band', defaultCount: 1, order: 1 },
            { id: 'role-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
            { id: 'role-sound', name: 'sound', group: 'tech', defaultCount: 1, order: 3 },
        ];
    }
    function cellFor(wrapper, roleId) {
        return wrapper.find("td[data-role-id=\"".concat(roleId, "\"][data-date=\"").concat(DATE, "\"]"));
    }
    (0, vitest_1.it)('shows a group conflict marker on both cells when the same person holds a TECH role and a BAND role the same date, and does not remove either assignment', function () {
        var _a;
        var quarter = makeQuarter({
            serviceDates: [DATE],
            calendar: (_a = {},
                _a[DATE] = {
                    'role-guitar': ['person-regular'],
                    'role-sound': ['person-regular'],
                },
                _a),
        });
        var wrapper = mountGrid({ quarter: quarter, roles: makeRolesFull(), lastProposeResult: null });
        var guitarCell = cellFor(wrapper, 'role-guitar');
        var soundCell = cellFor(wrapper, 'role-sound');
        (0, vitest_1.expect)(guitarCell.text()).toContain('group');
        (0, vitest_1.expect)(soundCell.text()).toContain('group');
        // The warning never blocks the edit — the assignment stays present in both cells.
        (0, vitest_1.expect)(guitarCell.text()).toContain('Regular Rachel');
        (0, vitest_1.expect)(soundCell.text()).toContain('Regular Rachel');
    });
    (0, vitest_1.it)('shows a group conflict marker on both cells when a person holds 2 BAND roles the same date', function () {
        var _a;
        var quarter = makeQuarter({
            serviceDates: [DATE],
            calendar: (_a = {},
                _a[DATE] = {
                    'role-guitar': ['person-regular'],
                    'role-bass': ['person-regular'],
                },
                _a),
        });
        var wrapper = mountGrid({ quarter: quarter, roles: makeRolesFull(), lastProposeResult: null });
        var guitarCell = cellFor(wrapper, 'role-guitar');
        var bassCell = cellFor(wrapper, 'role-bass');
        (0, vitest_1.expect)(guitarCell.text()).toContain('group');
        (0, vitest_1.expect)(bassCell.text()).toContain('group');
    });
    (0, vitest_1.it)('shows NO group conflict marker for the legal 1 BAND + 1 VOCALS combo', function () {
        var _a;
        var quarter = makeQuarter({
            serviceDates: [DATE],
            calendar: (_a = {},
                _a[DATE] = {
                    'role-guitar': ['person-regular'],
                    'role-vocals': ['person-regular'],
                },
                _a),
        });
        var wrapper = mountGrid({ quarter: quarter, roles: makeRolesFull(), lastProposeResult: null });
        var guitarCell = cellFor(wrapper, 'role-guitar');
        var vocalsCell = cellFor(wrapper, 'role-vocals');
        (0, vitest_1.expect)(guitarCell.text()).not.toContain('group');
        (0, vitest_1.expect)(vocalsCell.text()).not.toContain('group');
    });
});
