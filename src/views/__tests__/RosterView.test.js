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
var RosterView_vue_1 = require("../RosterView.vue");
var mockAddPerson = vitest_1.vi.fn(function () { return Promise.resolve('new-id'); });
var mockUpdatePerson = vitest_1.vi.fn(function (_id, _input) { return Promise.resolve(); });
var mockDeactivatePerson = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockReactivatePerson = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockDeletePerson = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockDeleteAllPeople = vitest_1.vi.fn(function () { return Promise.resolve(0); });
var mockSeedDefaultRolesIfEmpty = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockSubscribe = vitest_1.vi.fn();
var mockUnsubscribeAll = vitest_1.vi.fn();
// Roles alphabetically: drums, guitar, vocals (rolesSorted mirrors the store's
// alphabetical-by-name computed used for display/iteration in the form).
var mockRoles = [
    { id: 'r-drums', name: 'drums', group: 'band', defaultCount: 1, order: 1 },
    { id: 'r-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
    { id: 'r-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
];
var mockPeople = [];
vitest_1.vi.mock('@/stores/auth', function () { return ({
    useAuthStore: function () { return ({ orgId: 'org-1' }); },
}); });
vitest_1.vi.mock('@/stores/roster', function () { return ({
    useRosterStore: function () { return ({
        people: mockPeople,
        roles: mockRoles,
        isLoading: false,
        activePeople: mockPeople.filter(function (p) { return p.active; }),
        rolesSorted: __spreadArray([], mockRoles, true).sort(function (a, b) { return a.name.localeCompare(b.name); }),
        subscribe: mockSubscribe,
        unsubscribeAll: mockUnsubscribeAll,
        addPerson: mockAddPerson,
        updatePerson: mockUpdatePerson,
        deactivatePerson: mockDeactivatePerson,
        reactivatePerson: mockReactivatePerson,
        deletePerson: mockDeletePerson,
        seedDefaultRolesIfEmpty: mockSeedDefaultRolesIfEmpty,
        deleteAllPeople: mockDeleteAllPeople,
    }); },
}); });
// Cast via `unknown` — the Person type still carries its (deprecated, to be
// removed in plan 16-11) standing-frequency field, but this roles-only-form
// test suite never constructs or asserts on it (D-07/D-04).
function makePerson(overrides) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        id: overrides.id,
        name: overrides.name,
        email: (_a = overrides.email) !== null && _a !== void 0 ? _a : "".concat(overrides.id, "@example.com"),
        phone: (_b = overrides.phone) !== null && _b !== void 0 ? _b : '',
        active: (_c = overrides.active) !== null && _c !== void 0 ? _c : true,
        roles: (_d = overrides.roles) !== null && _d !== void 0 ? _d : [],
        pcPersonId: (_e = overrides.pcPersonId) !== null && _e !== void 0 ? _e : null,
        createdAt: (_f = overrides.createdAt) !== null && _f !== void 0 ? _f : {},
        updatedAt: (_g = overrides.updatedAt) !== null && _g !== void 0 ? _g : {},
    };
}
function mountRosterView() {
    return (0, test_utils_1.mount)(RosterView_vue_1.default, {
        global: {
            stubs: {
                AppShell: { template: '<div><slot /></div>' },
                RolesConfigPanel: { template: '<div />' },
                RosterImportModal: { template: '<div />' },
                Teleport: { template: '<div><slot /></div>' },
            },
        },
    });
}
(0, vitest_1.describe)('RosterView — roles-only Volunteer form (D-07)', function () {
    (0, vitest_1.beforeEach)(function () {
        mockAddPerson.mockClear();
        mockUpdatePerson.mockClear();
        mockDeactivatePerson.mockClear();
        mockReactivatePerson.mockClear();
        mockDeletePerson.mockClear();
    });
    (0, vitest_1.it)('does not render a serve-frequency/cadence control anywhere in the form', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [
                        makePerson({
                            id: 'p-1',
                            name: 'Alice',
                            roles: ['r-guitar', 'r-vocals'],
                        }),
                    ];
                    wrapper = mountRosterView();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.findAll('select[data-role="cadence-select"]').length).toBe(0);
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('Serve frequency by role');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('renders the roles checklist and toggles a role on/off', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, row, guitarCheckbox, drumsCheckbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [
                        makePerson({
                            id: 'p-1',
                            name: 'Alice',
                            roles: ['r-guitar'],
                        }),
                    ];
                    wrapper = mountRosterView();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 1:
                    _a.sent();
                    guitarCheckbox = wrapper
                        .findAll('input[type="checkbox"]')
                        .find(function (c) { return c.attributes('value') === 'r-guitar'; });
                    (0, vitest_1.expect)(guitarCheckbox.element.checked).toBe(true);
                    drumsCheckbox = wrapper
                        .findAll('input[type="checkbox"]')
                        .find(function (c) { return c.attributes('value') === 'r-drums'; });
                    (0, vitest_1.expect)(drumsCheckbox.element.checked).toBe(false);
                    return [4 /*yield*/, drumsCheckbox.setValue(true)];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(drumsCheckbox.element.checked).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('onSaveVolunteer payload includes only name/email/phone/roles — no frequency fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, row, form, _a, personId, input;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockPeople = [
                        makePerson({
                            id: 'p-1',
                            name: 'Alice',
                            roles: ['r-guitar', 'r-vocals'],
                        }),
                    ];
                    wrapper = mountRosterView();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 1:
                    _b.sent();
                    form = wrapper.find('form#volunteer-form');
                    return [4 /*yield*/, form.trigger('submit.prevent')];
                case 2:
                    _b.sent();
                    (0, vitest_1.expect)(mockUpdatePerson).toHaveBeenCalledTimes(1);
                    _a = mockUpdatePerson.mock.calls[0], personId = _a[0], input = _a[1];
                    (0, vitest_1.expect)(personId).toBe('p-1');
                    (0, vitest_1.expect)(input).toEqual({
                        name: 'Alice',
                        email: 'p-1@example.com',
                        phone: '',
                        roles: ['r-guitar', 'r-vocals'],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('RosterView — collapsible dense sections (R-11)', function () {
    (0, vitest_1.it)('wraps Roles config in CollapsibleSection', function () {
        mockPeople = [
            makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
        ];
        var wrapper = mountRosterView();
        (0, vitest_1.expect)(wrapper.text()).toContain('Roles config');
    });
});
(0, vitest_1.describe)('RosterView — unified table with Show-inactive toggle (260713-d60)', function () {
    (0, vitest_1.it)('hides inactive people by default and shows them when "Show inactive" is toggled on', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, toggle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [
                        makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
                        makePerson({ id: 'p-inactive', name: 'Bob', active: false, roles: [] }),
                    ];
                    wrapper = mountRosterView();
                    (0, vitest_1.expect)(wrapper.text()).toContain('Alice');
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('Bob');
                    toggle = wrapper.find('input[type="checkbox"]');
                    return [4 /*yield*/, toggle.setValue(true)];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).toContain('Bob');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('renders a Status column with Active/Inactive pills instead of Actions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, headers, toggle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [
                        makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
                        makePerson({ id: 'p-inactive', name: 'Bob', active: false, roles: [] }),
                    ];
                    wrapper = mountRosterView();
                    headers = wrapper.findAll('th').map(function (h) { return h.text(); });
                    (0, vitest_1.expect)(headers).toContain('Status');
                    (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Actions'); })).toBe(false);
                    (0, vitest_1.expect)(wrapper.text()).toContain('Active');
                    toggle = wrapper.find('input[type="checkbox"]');
                    return [4 /*yield*/, toggle.setValue(true)];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).toContain('Inactive');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does not render a per-row Deactivate button', function () {
        mockPeople = [makePerson({ id: 'p-1', name: 'Alice', active: true, roles: [] })];
        var wrapper = mountRosterView();
        var buttons = wrapper.findAll('button').map(function (b) { return b.text(); });
        (0, vitest_1.expect)(buttons.some(function (t) { return t.includes('Deactivate'); })).toBe(false);
    });
});
(0, vitest_1.describe)('RosterView — drawer status actions (immediate-apply, 260713-d60)', function () {
    (0, vitest_1.beforeEach)(function () {
        mockDeactivatePerson.mockClear();
        mockReactivatePerson.mockClear();
        mockDeletePerson.mockClear();
        mockUpdatePerson.mockClear();
    });
    (0, vitest_1.it)('shows a Deactivate control for an active person and calls deactivatePerson, not updatePerson', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, row, deactivateBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', active: true, roles: [] })];
                    wrapper = mountRosterView();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 1:
                    _a.sent();
                    deactivateBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Deactivate'; });
                    return [4 /*yield*/, deactivateBtn.trigger('click')];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(mockDeactivatePerson).toHaveBeenCalledTimes(1);
                    (0, vitest_1.expect)(mockDeactivatePerson).toHaveBeenCalledWith('p-1');
                    (0, vitest_1.expect)(mockUpdatePerson).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('shows Reactivate and a Delete affordance for an inactive person; clicking Reactivate calls reactivatePerson', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, toggle, row, reactivateBtn, deleteBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [makePerson({ id: 'p-1', name: 'Bob', active: false, roles: [] })];
                    wrapper = mountRosterView();
                    toggle = wrapper.find('input[type="checkbox"]');
                    return [4 /*yield*/, toggle.setValue(true)];
                case 1:
                    _a.sent();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 2:
                    _a.sent();
                    reactivateBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Reactivate'; });
                    return [4 /*yield*/, reactivateBtn.trigger('click')];
                case 3:
                    _a.sent();
                    (0, vitest_1.expect)(mockReactivatePerson).toHaveBeenCalledTimes(1);
                    (0, vitest_1.expect)(mockReactivatePerson).toHaveBeenCalledWith('p-1');
                    deleteBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Delete permanently'; });
                    (0, vitest_1.expect)(deleteBtn).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('permanently deletes an inactive person from the drawer after confirmation', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, toggle, row, deleteBtn, confirmDeleteBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [makePerson({ id: 'p-1', name: 'Bob', active: false, roles: [] })];
                    wrapper = mountRosterView();
                    toggle = wrapper.find('input[type="checkbox"]');
                    return [4 /*yield*/, toggle.setValue(true)];
                case 1:
                    _a.sent();
                    row = wrapper.findAll('tbody tr')[0];
                    return [4 /*yield*/, row.trigger('click')];
                case 2:
                    _a.sent();
                    deleteBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Delete permanently'; });
                    return [4 /*yield*/, deleteBtn.trigger('click')];
                case 3:
                    _a.sent();
                    confirmDeleteBtn = wrapper.findAll('button').find(function (b) { return b.text() === 'Delete'; });
                    return [4 /*yield*/, confirmDeleteBtn.trigger('click')];
                case 4:
                    _a.sent();
                    (0, vitest_1.expect)(mockDeletePerson).toHaveBeenCalledTimes(1);
                    (0, vitest_1.expect)(mockDeletePerson).toHaveBeenCalledWith('p-1');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does not render the status action section when adding a new volunteer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, addBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [];
                    wrapper = mountRosterView();
                    addBtn = wrapper.findAll('button').find(function (b) { return b.text().includes('Add Volunteer'); });
                    return [4 /*yield*/, addBtn.trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('Deactivate');
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('Reactivate');
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('RosterView — name/role sort (frequency sort removed)', function () {
    (0, vitest_1.beforeEach)(function () {
        mockUpdatePerson.mockClear();
    });
    (0, vitest_1.it)('sorts alphabetically by name and toggles direction', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, nameCells, names, nameHeader, namesDesc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPeople = [
                        makePerson({ id: 'p-bob', name: 'Bob', roles: [] }),
                        makePerson({ id: 'p-alice', name: 'Alice', roles: ['r-guitar'] }),
                        makePerson({ id: 'p-zoe', name: 'Zoe', roles: ['r-vocals'] }),
                    ];
                    wrapper = mountRosterView();
                    nameCells = wrapper.findAll('tbody tr td:first-child');
                    names = nameCells.map(function (c) { return c.text(); });
                    (0, vitest_1.expect)(names).toEqual(['Alice', 'Bob', 'Zoe']);
                    nameHeader = wrapper.findAll('button').find(function (b) { return b.text().includes('Name'); });
                    return [4 /*yield*/, nameHeader.trigger('click')];
                case 1:
                    _a.sent();
                    namesDesc = wrapper.findAll('tbody tr td:first-child').map(function (c) { return c.text(); });
                    (0, vitest_1.expect)(namesDesc).toEqual(['Zoe', 'Bob', 'Alice']);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('has no Frequency column header', function () {
        mockPeople = [makePerson({ id: 'p-1', name: 'Alice', roles: [] })];
        var wrapper = mountRosterView();
        var headers = wrapper.findAll('th').map(function (h) { return h.text(); });
        (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Frequency'); })).toBe(false);
    });
});
