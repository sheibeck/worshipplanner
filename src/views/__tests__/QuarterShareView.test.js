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
// Mock vue-router — mirrors ShareView.test.ts's harness, extended with a mutable
// query object (view/name persistence) and a spy-able router.replace.
var mockRouterReplace = vitest_1.vi.fn();
var mockRouteQuery = {};
vitest_1.vi.mock('vue-router', function () { return ({
    useRoute: vitest_1.vi.fn(function () { return ({
        params: { token: 'test-token-123' },
        query: mockRouteQuery,
    }); }),
    useRouter: vitest_1.vi.fn(function () { return ({
        replace: mockRouterReplace,
    }); }),
}); });
// Mock @/firebase
vitest_1.vi.mock('@/firebase', function () { return ({
    db: {},
}); });
// Mock firebase/firestore — getDoc is controlled per test
var mockGetDoc = vitest_1.vi.fn();
vitest_1.vi.mock('firebase/firestore', function () { return ({
    doc: vitest_1.vi.fn(function (_db) {
        var _a;
        var segments = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            segments[_i - 1] = arguments[_i];
        }
        return ({
            id: (_a = segments[segments.length - 1]) !== null && _a !== void 0 ? _a : 'mock-id',
            path: segments.join('/'),
        });
    }),
    getDoc: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return mockGetDoc.apply(void 0, args);
    },
}); });
var mockSnapshot = {
    label: 'Q1 2026',
    serviceDates: ['2026-01-04', '2026-01-11'],
    roles: [
        { id: 'r1', name: 'Vocals', group: 'band' },
        { id: 'r2', name: 'Sound', group: 'tech' },
    ],
    calendar: {
        '2026-01-04': { r1: ['Alice', 'Bob'], r2: ['Carol'] },
        '2026-01-11': { r1: ['Bob'], r2: [] },
    },
};
function mountQuarterShareView() {
    return __awaiter(this, void 0, void 0, function () {
        var QuarterShareView;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../QuarterShareView.vue'); })];
                case 1:
                    QuarterShareView = (_a.sent()).default;
                    return [2 /*return*/, (0, test_utils_1.mount)(QuarterShareView)];
            }
        });
    });
}
(0, vitest_1.describe)('QuarterShareView', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
        mockRouteQuery = {};
        mockGetDoc.mockResolvedValue({
            exists: function () { return true; },
            data: function () { return ({ quarterSnapshot: mockSnapshot }); },
        });
    });
    (0, vitest_1.it)('renders the matrix view by default with roles as columns and dates as rows', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountQuarterShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()
                        // Role columns
                    ];
                case 2:
                    _a.sent();
                    // Role columns
                    (0, vitest_1.expect)(wrapper.text()).toContain('Vocals');
                    (0, vitest_1.expect)(wrapper.text()).toContain('Sound');
                    // Date rows with multi-person comma-separated cell
                    (0, vitest_1.expect)(wrapper.text()).toContain('Alice, Bob');
                    (0, vitest_1.expect)(wrapper.text()).toContain('Carol');
                    // Matrix is a <table>
                    (0, vitest_1.expect)(wrapper.find('table').exists()).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('toggles to the list view when List is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, listButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountQuarterShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    listButton = wrapper.findAll('button').find(function (b) { return b.text() === 'List'; });
                    (0, vitest_1.expect)(listButton).toBeTruthy();
                    return [4 /*yield*/, listButton.trigger('click')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 4:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.find('table').exists()).toBe(false);
                    (0, vitest_1.expect)(wrapper.text()).toContain('Alice');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('hides dates where the filtered person serves nothing, in matrix view', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, input, candidate, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountQuarterShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    input = wrapper.find('input[placeholder="Filter by name…"]');
                    (0, vitest_1.expect)(input.exists()).toBe(true);
                    return [4 /*yield*/, input.setValue('Alice')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, input.trigger('focus')];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 5:
                    _a.sent();
                    candidate = wrapper.findAll('[data-role="name-candidate"]').find(function (c) { return c.text() === 'Alice'; });
                    (0, vitest_1.expect)(candidate).toBeTruthy();
                    return [4 /*yield*/, candidate.trigger('mousedown')];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()
                        // Alice only serves on 2026-01-04 — 2026-01-11 should be hidden
                    ];
                case 7:
                    _a.sent();
                    rows = wrapper.findAll('tbody tr');
                    (0, vitest_1.expect)(rows.length).toBe(1);
                    (0, vitest_1.expect)(wrapper.text()).toContain('Alice, Bob');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('hides non-serving dates in list view too, and "Show everyone" clears the filter', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, listButton, input, candidate, clearButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountQuarterShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    listButton = wrapper.findAll('button').find(function (b) { return b.text() === 'List'; });
                    return [4 /*yield*/, listButton.trigger('click')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 4:
                    _a.sent();
                    input = wrapper.find('input[placeholder="Filter by name…"]');
                    return [4 /*yield*/, input.setValue('Alice')];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, input.trigger('focus')];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 7:
                    _a.sent();
                    candidate = wrapper.findAll('[data-role="name-candidate"]').find(function (c) { return c.text() === 'Alice'; });
                    return [4 /*yield*/, candidate.trigger('mousedown')];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 9:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('January 11');
                    clearButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Show everyone'; });
                    (0, vitest_1.expect)(clearButton).toBeTruthy();
                    return [4 /*yield*/, clearButton.trigger('click')];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()
                        // Clearing restores all dates
                    ];
                case 11:
                    _a.sent();
                    // Clearing restores all dates
                    (0, vitest_1.expect)(wrapper.text()).toContain('January 11');
                    return [2 /*return*/];
            }
        });
    }); });
    // WR-05 regression: a name filter matching zero dates must NOT show "No service dates" —
    // the quarter plainly has service dates, the filter just excluded all of them.
    (0, vitest_1.it)('shows a distinct zero-match message (not "No service dates") when a name filter matches zero dates, in matrix view', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockRouteQuery = { name: 'Nobody' };
                    return [4 /*yield*/, mountQuarterShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.find('tbody tr').exists()).toBe(false);
                    (0, vitest_1.expect)(wrapper.text()).not.toContain('No service dates');
                    (0, vitest_1.expect)(wrapper.text()).toContain('No dates found for Nobody');
                    return [2 /*return*/];
            }
        });
    }); });
});
