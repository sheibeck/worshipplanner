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
var vitest_1 = require("vitest");
var test_utils_1 = require("@vue/test-utils");
var AvailabilityRosterTable_vue_1 = require("../AvailabilityRosterTable.vue");
var SERVICE_DATES = ['2026-07-05', '2026-07-12', '2026-07-19'];
var mockRoles = [
    { id: 'role-guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 0 },
    { id: 'role-drums', name: 'Drums', group: 'band', defaultCount: 1, order: 1 },
];
// person-out-role: 'out' for role-guitar only, 'regular' for role-drums (per-role, D-05).
// person-fillin-role: 'fillin' for role-guitar only, no other roleFrequency entry.
// person-out-all: 'out' for its one held role — genuinely out all quarter.
// person-regular: no personQuarterData entry at all (defaults to 'regular').
var mockPeople = [
    {
        id: 'person-out-role',
        name: 'Outrole Ollie',
        email: 'ollie@example.com',
        phone: '',
        active: true,
        roles: ['role-guitar', 'role-drums'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
    {
        id: 'person-fillin-role',
        name: 'Fillin Fiona',
        email: 'fiona@example.com',
        phone: '',
        active: true,
        roles: ['role-guitar'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
    {
        id: 'person-out-all',
        name: 'Allout Alan',
        email: 'alan@example.com',
        phone: '',
        active: true,
        roles: ['role-drums'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
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
];
vitest_1.vi.mock('@/stores/roster', function () { return ({
    useRosterStore: function () { return ({
        people: mockPeople,
        activePeople: mockPeople,
        roles: mockRoles,
    }); },
}); });
function makeQuarter() {
    return {
        id: 'quarter-1',
        label: 'Q3 2026',
        year: 2026,
        quarter: 3,
        serviceDates: SERVICE_DATES,
        roleOverridesByDate: {},
        personQuarterData: {
            'person-out-role': {
                personId: 'person-out-role',
                // Intentionally unsorted to prove chronological sorting in the column.
                blackoutDates: ['2026-07-19', '2026-07-05'],
                pairedWith: [],
                roleFrequency: {
                    'role-guitar': { tier: 'out', n: 4 },
                    'role-drums': { tier: 'regular', n: 4 },
                },
                note: 'Traveling the first two Sundays',
            },
            'person-fillin-role': {
                personId: 'person-fillin-role',
                blackoutDates: [],
                pairedWith: [],
                roleFrequency: {
                    'role-guitar': { tier: 'fillin', n: 4 },
                },
                note: '',
            },
            'person-out-all': {
                personId: 'person-out-all',
                blackoutDates: [],
                pairedWith: [],
                roleFrequency: {
                    'role-drums': { tier: 'out', n: 2 },
                },
                note: '',
            },
        },
        calendar: {},
        status: 'draft',
        shareToken: null,
        createdAt: {},
        updatedAt: {},
    };
}
(0, vitest_1.describe)('AvailabilityRosterTable — Roles & Frequency + Blackout & Note columns', function () {
    (0, vitest_1.it)('renders "Roles & Frequency" and "Blackout & Note" headers (no standalone Frequency/Roles/Quarter Note/Status)', function () {
        var wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
        var headers = wrapper.findAll('thead th').map(function (th) { return th.text(); });
        (0, vitest_1.expect)(headers).toContain('Roles & Frequency');
        (0, vitest_1.expect)(headers).toContain('Blackout & Note');
        (0, vitest_1.expect)(headers).not.toContain('Frequency');
        (0, vitest_1.expect)(headers).not.toContain('Roles');
        (0, vitest_1.expect)(headers).not.toContain('Quarter Note');
        (0, vitest_1.expect)(headers).not.toContain('Status');
    });
    (0, vitest_1.it)('shows EACH held role with its OWN per-role frequency (multi-role volunteer)', function () {
        var wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
        // Ollie holds Guitar (tier out) + Drums (regular, n=4 → Monthly). Both roles and
        // both distinct frequencies must appear — not a single collapsed aggregate.
        var ollieRow = wrapper.findAll('tr').find(function (r) { return r.text().includes('Outrole Ollie'); });
        (0, vitest_1.expect)(ollieRow.text()).toContain('Guitar');
        (0, vitest_1.expect)(ollieRow.text()).toContain('Drums');
        (0, vitest_1.expect)(ollieRow.text()).toContain('Out this quarter'); // guitar tier
        (0, vitest_1.expect)(ollieRow.text()).toContain('Monthly'); // drums cadence
    });
    (0, vitest_1.it)('labels a fill-in role as "Fill-in" and a default (no-entry) role as "Monthly"', function () {
        var wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
        var fionaRow = wrapper.findAll('tr').find(function (r) { return r.text().includes('Fillin Fiona'); });
        (0, vitest_1.expect)(fionaRow.text()).toContain('Fill-in'); // role-guitar tier fillin
        // Rachel has no personQuarterData entry → her one role defaults to n=4 → Monthly.
        var rachelRow = wrapper.findAll('tr').find(function (r) { return r.text().includes('Regular Rachel'); });
        (0, vitest_1.expect)(rachelRow.text()).toContain('Monthly');
    });
    (0, vitest_1.it)('shows actual blackout dates (chronologically sorted) plus the note in the Blackout & Note column', function () {
        var wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
        var ollieRow = wrapper.findAll('tr').find(function (r) { return r.text().includes('Outrole Ollie'); });
        // Actual dates, formatted and sorted (Jul 5 before Jul 19) — not just a count.
        (0, vitest_1.expect)(ollieRow.text()).toContain('Jul 5');
        (0, vitest_1.expect)(ollieRow.text()).toContain('Jul 19');
        (0, vitest_1.expect)(ollieRow.text().indexOf('Jul 5')).toBeLessThan(ollieRow.text().indexOf('Jul 19'));
        // …and the free-text note.
        (0, vitest_1.expect)(ollieRow.text()).toContain('Traveling the first two Sundays');
    });
    (0, vitest_1.it)('renders the em-dash placeholder when a person has no blackout dates and no note', function () {
        var wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
        // Fiona: no blackout dates, empty note. Her row text otherwise contains 'Fill-in'
        // / 'Guitar' (never an em-dash), so the only '—' is the empty-cell placeholder.
        var fionaRow = wrapper.findAll('tr').find(function (r) { return r.text().includes('Fillin Fiona'); });
        (0, vitest_1.expect)(fionaRow.text()).toContain('—');
    });
    (0, vitest_1.it)('keeps the "Out this quarter" filter working off the aggregate tier (R-05)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, outFilterBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wrapper = (0, test_utils_1.mount)(AvailabilityRosterTable_vue_1.default, { props: { quarter: makeQuarter() } });
                    outFilterBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Out this quarter'; });
                    return [4 /*yield*/, outFilterBtn.trigger('click')
                        // Ollie is out for one held role → aggregate 'out' → included.
                    ];
                case 1:
                    _a.sent();
                    // Ollie is out for one held role → aggregate 'out' → included.
                    (0, vitest_1.expect)(wrapper.text()).toContain('Outrole Ollie');
                    // Fiona is fill-in, not out → excluded.
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('Fillin Fiona');
                    return [2 /*return*/];
            }
        });
    }); });
});
