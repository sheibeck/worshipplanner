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
var vitest_1 = require("vitest");
var test_utils_1 = require("@vue/test-utils");
var AvailabilityDrawer_vue_1 = require("../AvailabilityDrawer.vue");
// Q3 2026 Sundays (13 total) — same demo data as the sketch (.planning/sketches/001-availability-editor).
var SERVICE_DATES = [
    '2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26',
    '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30',
    '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
];
var FREQ_PRESET_COUNT = 5; // weekly, biweek, monthly, fillin, out
var mockSetPersonAvailability = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockUpdatePerson = vitest_1.vi.fn(function () { return Promise.resolve(); });
function makeQuarter(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'quarter-1', label: 'Q3 2026', year: 2026, quarter: 3, serviceDates: SERVICE_DATES, roleOverridesByDate: {}, personQuarterData: {
            'person-1': {
                personId: 'person-1',
                blackoutDates: ['2026-07-19'],
                pairedWith: ['dean'],
                roleFrequency: { sound: { tier: 'out', n: 0 } },
                note: 'x',
            },
        }, calendar: {}, status: 'draft', shareToken: null, createdAt: {}, updatedAt: {} }, overrides);
}
var mockQuarter = makeQuarter();
vitest_1.vi.mock('@/stores/quarters', function () { return ({
    useQuartersStore: function () { return ({
        getQuarter: function (id) {
            if (id !== mockQuarter.id)
                throw new Error("Quarter ".concat(id, " not found"));
            return mockQuarter;
        },
        setPersonAvailability: mockSetPersonAvailability,
    }); },
}); });
// person-1 holds two roles (one TECH, one VOCALS) so per-role tier controls (D-06)
// have something real to render for.
var mockPeople = [
    {
        id: 'person-1',
        name: 'Test Person',
        email: 'test@example.com',
        phone: '',
        active: true,
        roles: ['sound', 'vocals'],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
    {
        id: 'dean',
        name: 'Dean Woodard',
        email: 'dean@example.com',
        phone: '',
        active: true,
        roles: [],
        pcPersonId: null,
        createdAt: {},
        updatedAt: {},
    },
];
// 'guitar' is intentionally NOT held by person-1 — used to test toggling a
// role ON via the drawer's roles checklist (D-09).
var mockRoles = [
    { id: 'sound', name: 'Sound', group: 'tech', defaultCount: 1, order: 0 },
    { id: 'vocals', name: 'Vocals', group: 'vocals', defaultCount: 1, order: 1 },
    { id: 'guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 2 },
];
vitest_1.vi.mock('@/stores/roster', function () { return ({
    useRosterStore: function () { return ({
        people: mockPeople,
        roles: mockRoles,
        updatePerson: mockUpdatePerson,
    }); },
}); });
(0, vitest_1.describe)('AvailabilityDrawer', function () {
    function mountDrawer() {
        return (0, test_utils_1.mount)(AvailabilityDrawer_vue_1.default, {
            props: { quarterId: 'quarter-1', personId: 'person-1' },
            global: {
                // Render Teleport's default slot in place — content actually teleported to
                // document.body isn't reachable via wrapper.find/findAll.
                stubs: { Teleport: { template: '<div><slot /></div>' } },
            },
        });
    }
    (0, vitest_1.it)('renders one tier control (preset row) per held role, populated from roleFrequency with a regular/monthly default for absent roles (D-05/D-06)', function () {
        mockQuarter = makeQuarter();
        mockSetPersonAvailability.mockClear();
        mockUpdatePerson.mockClear();
        var wrapper = mountDrawer();
        var soundButtons = wrapper.findAll('button[data-role-id="sound"]');
        var vocalsButtons = wrapper.findAll('button[data-role-id="vocals"]');
        (0, vitest_1.expect)(soundButtons.length).toBe(FREQ_PRESET_COUNT);
        (0, vitest_1.expect)(vocalsButtons.length).toBe(FREQ_PRESET_COUNT);
        // Sound has an explicit roleFrequency entry: { tier: 'out', n: 0 }.
        var soundOut = soundButtons.find(function (b) { return b.attributes('data-preset') === 'out'; });
        (0, vitest_1.expect)(soundOut.attributes('data-active')).toBe('true');
        // Vocals has no roleFrequency entry — defaults to { tier: 'regular', n: 4 },
        // which maps to the 'monthly' preset (D-05).
        var vocalsMonthly = vocalsButtons.find(function (b) { return b.attributes('data-preset') === 'monthly'; });
        (0, vitest_1.expect)(vocalsMonthly.attributes('data-active')).toBe('true');
    });
    // WR-04 regression: a non-preset n (e.g. imported via CSV as a bare "3" or "1-in-6",
    // both valid frequencyLabelToN inputs) must not be shown as an active preset — previously
    // this fell back to highlighting "Monthly" as active even though the real cadence differs,
    // so clicking it silently overwrote the person's real n with 4.
    (0, vitest_1.it)('does not highlight any preset as active for a non-canonical regular-tier n, and shows a distinct custom readout', function () {
        mockQuarter = makeQuarter({
            personQuarterData: {
                'person-1': {
                    personId: 'person-1',
                    blackoutDates: [],
                    pairedWith: [],
                    roleFrequency: { sound: { tier: 'regular', n: 3 } },
                    note: '',
                },
            },
        });
        mockSetPersonAvailability.mockClear();
        mockUpdatePerson.mockClear();
        var wrapper = mountDrawer();
        var soundButtons = wrapper.findAll('button[data-role-id="sound"]');
        (0, vitest_1.expect)(soundButtons.length).toBe(FREQ_PRESET_COUNT);
        // None of weekly/biweek/monthly/fillin/out should be marked active for n:3.
        for (var _i = 0, soundButtons_1 = soundButtons; _i < soundButtons_1.length; _i++) {
            var button = soundButtons_1[_i];
            (0, vitest_1.expect)(button.attributes('data-active')).toBe('false');
        }
        // The readout explicitly surfaces the custom cadence instead of silently agreeing with
        // whichever preset the fallback used to pick.
        (0, vitest_1.expect)(wrapper.text()).toContain('Custom (1-in-3)');
    });
    (0, vitest_1.it)('does not render a date-range picker — per-Sunday click-to-toggle is the only blackout entry method (R-08)', function () {
        mockQuarter = makeQuarter();
        mockSetPersonAvailability.mockClear();
        mockUpdatePerson.mockClear();
        var wrapper = mountDrawer();
        (0, vitest_1.expect)(wrapper.findAll('input[type="date"]').length).toBe(0);
        (0, vitest_1.expect)(wrapper.text()).not.toContain('Block Sundays in range');
    });
    (0, vitest_1.it)('pre-populates blackout calendar, pairing chips, and quarter note from existing PersonQuarterData (D-07 unchanged)', function () {
        mockQuarter = makeQuarter();
        mockSetPersonAvailability.mockClear();
        mockUpdatePerson.mockClear();
        var wrapper = mountDrawer();
        // Blacked-out Sunday rendered marked off
        var blockedCell = wrapper.find('button[data-date="2026-07-19"]');
        (0, vitest_1.expect)(blockedCell.exists()).toBe(true);
        (0, vitest_1.expect)(blockedCell.classes()).toContain('line-through');
        // Pairing chip
        (0, vitest_1.expect)(wrapper.text()).toContain('Dean Woodard');
        // Note text
        var textarea = wrapper.find('textarea');
        (0, vitest_1.expect)(textarea.element.value).toBe('x');
    });
    (0, vitest_1.it)('calendar renders exactly one clickable Sunday per serviceDate and toggles blackout on click', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, sundayButtons, renderedDates, notYetBlocked, blockedNow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockQuarter = makeQuarter();
                    mockSetPersonAvailability.mockClear();
                    mockUpdatePerson.mockClear();
                    wrapper = mountDrawer();
                    sundayButtons = wrapper.findAll('button[data-role="sunday-cell"]');
                    (0, vitest_1.expect)(sundayButtons.length).toBe(SERVICE_DATES.length);
                    renderedDates = sundayButtons.map(function (b) { return b.attributes('data-date'); });
                    (0, vitest_1.expect)(renderedDates.sort()).toEqual(__spreadArray([], SERVICE_DATES, true).sort());
                    notYetBlocked = wrapper.find('button[data-date="2026-07-05"]');
                    (0, vitest_1.expect)(notYetBlocked.classes()).not.toContain('line-through');
                    return [4 /*yield*/, notYetBlocked.trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(notYetBlocked.classes()).toContain('line-through');
                    blockedNow = wrapper
                        .findAll('button[data-role="sunday-cell"]')
                        .filter(function (b) { return b.classes().includes('line-through'); })
                        .map(function (b) { return b.attributes('data-date'); });
                    (0, vitest_1.expect)(blockedNow.sort()).toEqual(['2026-07-05', '2026-07-19'].sort());
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('changing a per-role tier (Vocals -> Weekly) then saving calls setPersonAvailability with roleFrequency carrying every held role, and never writes a standing frequency through rosterStore (D-05)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, vocalsWeekly, saveButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockQuarter = makeQuarter();
                    mockSetPersonAvailability.mockClear();
                    mockUpdatePerson.mockClear();
                    wrapper = mountDrawer();
                    vocalsWeekly = wrapper
                        .findAll('button[data-role-id="vocals"]')
                        .find(function (b) { return b.attributes('data-preset') === 'weekly'; });
                    return [4 /*yield*/, vocalsWeekly.trigger('click')];
                case 1:
                    _a.sent();
                    saveButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; });
                    // Dirty now — Save is enabled.
                    (0, vitest_1.expect)(saveButton.element.disabled).toBe(false);
                    return [4 /*yield*/, saveButton.trigger('click')
                        // setPersonAvailability writes the full roleFrequency map for every held role,
                        // carrying Sound's unchanged Out tier alongside the newly-changed Vocals tier.
                    ];
                case 2:
                    _a.sent();
                    // setPersonAvailability writes the full roleFrequency map for every held role,
                    // carrying Sound's unchanged Out tier alongside the newly-changed Vocals tier.
                    (0, vitest_1.expect)(mockSetPersonAvailability).toHaveBeenCalledWith('quarter-1', 'person-1', {
                        blackoutDates: ['2026-07-19'],
                        pairedWith: ['dean'],
                        roleFrequency: { sound: { tier: 'out', n: 0 }, vocals: { tier: 'regular', n: 1 } },
                        note: 'x',
                    });
                    // No standing frequency write remains — frequency is fully quarter-scoped (D-05).
                    (0, vitest_1.expect)(mockUpdatePerson).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('dims/disables the Save button when there are no unsaved changes and enables it once the drawer is dirty (mirrors ServiceEditorView save affordance)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, saveButton, notYetBlocked;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockQuarter = makeQuarter();
                    mockSetPersonAvailability.mockClear();
                    mockUpdatePerson.mockClear();
                    wrapper = mountDrawer();
                    saveButton = function () { return wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; }); };
                    // Freshly opened, nothing changed → clean → Save dimmed + disabled.
                    (0, vitest_1.expect)(saveButton().element.disabled).toBe(true);
                    (0, vitest_1.expect)(saveButton().classes()).toContain('bg-indigo-600/40');
                    (0, vitest_1.expect)(saveButton().classes()).not.toContain('bg-indigo-600');
                    notYetBlocked = wrapper.find('button[data-date="2026-07-05"]');
                    return [4 /*yield*/, notYetBlocked.trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(saveButton().element.disabled).toBe(false);
                    (0, vitest_1.expect)(saveButton().classes()).toContain('bg-indigo-600');
                    (0, vitest_1.expect)(saveButton().classes()).not.toContain('bg-indigo-600/40');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('renders a roles checklist bound to person.roles and toggling a role ON calls the roster store (not the quarters store) (D-09)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, soundCheckbox, vocalsCheckbox, guitarCheckbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockQuarter = makeQuarter();
                    mockSetPersonAvailability.mockClear();
                    mockUpdatePerson.mockClear();
                    wrapper = mountDrawer();
                    soundCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="sound"]');
                    vocalsCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="vocals"]');
                    guitarCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="guitar"]');
                    (0, vitest_1.expect)(soundCheckbox.element.checked).toBe(true);
                    (0, vitest_1.expect)(vocalsCheckbox.element.checked).toBe(true);
                    (0, vitest_1.expect)(guitarCheckbox.element.checked).toBe(false);
                    return [4 /*yield*/, guitarCheckbox.trigger('change')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockUpdatePerson).toHaveBeenCalledWith('person-1', { roles: ['sound', 'vocals', 'guitar'] });
                    (0, vitest_1.expect)(mockSetPersonAvailability).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('toggling an already-held role OFF calls rosterStore.updatePerson with it removed (D-09)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, soundCheckbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockQuarter = makeQuarter();
                    mockSetPersonAvailability.mockClear();
                    mockUpdatePerson.mockClear();
                    wrapper = mountDrawer();
                    soundCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="sound"]');
                    return [4 /*yield*/, soundCheckbox.trigger('change')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockUpdatePerson).toHaveBeenCalledWith('person-1', { roles: ['vocals'] });
                    (0, vitest_1.expect)(mockSetPersonAvailability).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
});
