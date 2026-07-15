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
var SongTable_vue_1 = require("../SongTable.vue");
// Mirrors QuarterGrid.test.ts's pattern: mock the store modules directly rather
// than pulling in @pinia/testing (not a project dependency) or a real Pinia +
// firebase mock stack.
var mockUpdateSong = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockToggleColumn = vitest_1.vi.fn();
var mockResetColumns = vitest_1.vi.fn();
var mockColumnVisibility = {
    category: true,
    key: true,
    ccli: true,
    lastUsed: true,
    tags: true,
    themes: true,
};
// Singleton store object so a test can observe searchQuery mutations made by
// the listing's click-to-filter (filterByPill) behavior.
var mockSongStore = {
    get columnVisibility() { return mockColumnVisibility; },
    allUserTags: [],
    searchQuery: '',
    updateSong: mockUpdateSong,
    toggleColumn: mockToggleColumn,
    resetColumns: mockResetColumns,
};
vitest_1.vi.mock('@/stores/songs', function () { return ({
    useSongStore: function () { return mockSongStore; },
}); });
var mockVwModeEnabled = true;
vitest_1.vi.mock('@/stores/auth', function () { return ({
    useAuthStore: function () { return ({
        get vwModeEnabled() { return mockVwModeEnabled; },
    }); },
}); });
// jsdom does not implement IntersectionObserver — SongTable's onMounted sets one
// up for scroll-based load-more. Stub it so mount() doesn't throw.
var MockIntersectionObserver = /** @class */ (function () {
    function MockIntersectionObserver() {
    }
    MockIntersectionObserver.prototype.observe = function () { };
    MockIntersectionObserver.prototype.unobserve = function () { };
    MockIntersectionObserver.prototype.disconnect = function () { };
    return MockIntersectionObserver;
}());
vitest_1.vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
function makeSong(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '12345', author: 'John Newton', themes: ['Grace', 'Redemption'], notes: '', vwTypes: [1], arrangements: [], primaryArrangementId: null, lastUsedAt: null, createdAt: {}, updatedAt: {}, pcSongId: null, hidden: false, tags: ['Christmas'], removedThemes: [] }, overrides);
}
function mountTable(songs) {
    if (songs === void 0) { songs = [makeSong()]; }
    return (0, test_utils_1.mount)(SongTable_vue_1.default, { props: { songs: songs, loading: false } });
}
(0, vitest_1.describe)('SongTable', function () {
    (0, vitest_1.beforeEach)(function () {
        mockColumnVisibility = {
            category: true,
            key: true,
            ccli: true,
            lastUsed: true,
            tags: true,
            themes: true,
        };
        mockVwModeEnabled = true;
        mockSongStore.searchQuery = '';
        mockUpdateSong.mockClear();
        mockToggleColumn.mockClear();
        mockResetColumns.mockClear();
    });
    (0, vitest_1.describe)('column visibility', function () {
        (0, vitest_1.it)('does not render the Themes column header when columnVisibility.themes is false', function () {
            mockColumnVisibility = __assign(__assign({}, mockColumnVisibility), { themes: false });
            var wrapper = mountTable();
            var headers = wrapper.findAll('th').map(function (th) { return th.text(); });
            (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Themes'); })).toBe(false);
        });
        (0, vitest_1.it)('renders the Themes column header when columnVisibility.themes is true', function () {
            var wrapper = mountTable();
            var headers = wrapper.findAll('th').map(function (th) { return th.text(); });
            (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Themes'); })).toBe(true);
        });
    });
    (0, vitest_1.describe)('VW mode gating', function () {
        (0, vitest_1.it)('does not render the Category column header when vwModeEnabled is false', function () {
            mockVwModeEnabled = false;
            var wrapper = mountTable();
            var headers = wrapper.findAll('th').map(function (th) { return th.text(); });
            (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Category'); })).toBe(false);
        });
        (0, vitest_1.it)('renders the Category column header when vwModeEnabled is true', function () {
            var wrapper = mountTable();
            var headers = wrapper.findAll('th').map(function (th) { return th.text(); });
            (0, vitest_1.expect)(headers.some(function (h) { return h.includes('Category'); })).toBe(true);
        });
    });
    (0, vitest_1.describe)('Tags/Themes split', function () {
        (0, vitest_1.it)('renders tags in the Tags cell and themes in the Themes cell, with no team pills', function () {
            var wrapper = mountTable([
                makeSong({ tags: ['Christmas', 'Choir'], themes: ['Grace'] }),
            ]);
            var text = wrapper.text();
            (0, vitest_1.expect)(text).toContain('Christmas');
            (0, vitest_1.expect)(text).toContain('Grace');
            // Team tags are folded into the flat tags set upstream (D-01/D-12) — 'Choir'
            // renders as an ordinary tag pill alongside 'Christmas', not a separate team pill.
            (0, vitest_1.expect)(text).toContain('Choir');
        });
        (0, vitest_1.it)('does not render inline add/remove controls on the listing (display-only)', function () {
            var wrapper = mountTable([makeSong({ tags: ['Christmas'], themes: ['Grace'] })]);
            // No inline edit inputs and no remove/add affordances in the listing pills —
            // editing lives on the edit screen (SongSlideOver).
            (0, vitest_1.expect)(wrapper.find('input[placeholder="tag name"]').exists()).toBe(false);
            (0, vitest_1.expect)(wrapper.find('input[placeholder="theme name"]').exists()).toBe(false);
            (0, vitest_1.expect)(wrapper.find('button[aria-label="Remove tag"]').exists()).toBe(false);
            (0, vitest_1.expect)(wrapper.find('button[aria-label="Remove theme"]').exists()).toBe(false);
        });
    });
    (0, vitest_1.describe)('click-to-filter', function () {
        (0, vitest_1.it)('sets a tag:-scoped search query when a tag pill is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ tags: ['Christmas'], themes: [] })]);
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Christmas' && s.attributes('title') === 'Filter by this tag'; });
                        (0, vitest_1.expect)(tagPill).toBeTruthy();
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('tag:Christmas');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets a theme:-scoped search query when a theme pill is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, themePill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ tags: [], themes: ['Grace'] })]);
                        themePill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Grace' && s.attributes('title') === 'Filter by this theme'; });
                        (0, vitest_1.expect)(themePill).toBeTruthy();
                        return [4 /*yield*/, themePill.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('theme:Grace');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets a type:-scoped search query when a category badge is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, badge;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ vwTypes: [2] })]);
                        badge = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Type 2' && s.classes().includes('cursor-pointer'); });
                        (0, vitest_1.expect)(badge).toBeTruthy();
                        return [4 /*yield*/, badge.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('type:2');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('appends (does not replace) when a second pill is clicked — additive AND', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, badge, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ vwTypes: [2], tags: ['Acoustic'], themes: [] })]);
                        badge = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Type 2' && s.classes().includes('cursor-pointer'); });
                        return [4 /*yield*/, badge.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('type:2');
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag'; });
                        return [4 /*yield*/, tagPill.trigger('click')
                            // Both terms present, space-separated, in click order.
                        ];
                    case 2:
                        _a.sent();
                        // Both terms present, space-separated, in click order.
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('type:2 tag:Acoustic');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('preserves free text the user already typed and appends the pill term', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockSongStore.searchQuery = 'grace';
                        wrapper = mountTable([makeSong({ tags: ['Acoustic'], themes: [] })]);
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag'; });
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('grace tag:Acoustic');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not stack duplicates when the same pill is clicked twice', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ tags: ['Acoustic'], themes: [] })]);
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag'; });
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('tag:Acoustic');
                        return [2 /*return*/];
                }
            });
        }); });
        // WR-01: a whitespace-token de-dupe check breaks for multi-word tag/theme
        // values (e.g. "tag:Christmas Eve" fragments into two tokens on split).
        (0, vitest_1.it)('does not stack duplicates when a multi-word tag pill is clicked twice', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ tags: ['Christmas Eve'], themes: [] })]);
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this tag'; });
                        (0, vitest_1.expect)(tagPill).toBeTruthy();
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('tag:Christmas Eve');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not stack duplicates when a multi-word theme pill is clicked twice', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, themePill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = mountTable([makeSong({ tags: [], themes: ['Christmas Eve'] })]);
                        themePill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this theme'; });
                        (0, vitest_1.expect)(themePill).toBeTruthy();
                        return [4 /*yield*/, themePill.trigger('click')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, themePill.trigger('click')];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('theme:Christmas Eve');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not falsely de-dupe a multi-word term against a different prior term with overlapping prefix', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, tagPill;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockSongStore.searchQuery = 'tag:Christmas';
                        wrapper = mountTable([makeSong({ tags: ['Christmas Eve'], themes: [] })]);
                        tagPill = wrapper
                            .findAll('span')
                            .find(function (s) { return s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this tag'; });
                        return [4 /*yield*/, tagPill.trigger('click')];
                    case 1:
                        _a.sent();
                        (0, vitest_1.expect)(mockSongStore.searchQuery).toBe('tag:Christmas tag:Christmas Eve');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
