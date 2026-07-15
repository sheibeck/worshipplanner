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
var SongSlideOver_vue_1 = require("../SongSlideOver.vue");
// Mirrors SongTable.test.ts's pattern: mock the store modules directly rather
// than pulling in @pinia/testing (not a project dependency) or a real Pinia +
// firebase mock stack.
var mockAddSong = vitest_1.vi.fn(function (_data) { return Promise.resolve(); });
var mockUpdateSong = vitest_1.vi.fn(function (_id, _data) { return Promise.resolve(); });
var mockDeleteSong = vitest_1.vi.fn(function (_id) { return Promise.resolve(); });
var mockSongStore = {
    allUserTags: [],
    addSong: mockAddSong,
    updateSong: mockUpdateSong,
    deleteSong: mockDeleteSong,
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
function makeSong(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '12345', author: 'John Newton', themes: ['Grace', 'Redemption'], notes: '', vwTypes: [1], arrangements: [], primaryArrangementId: null, lastUsedAt: null, createdAt: {}, updatedAt: {}, pcSongId: 'pc-1', hidden: false, tags: ['Christmas'], removedThemes: [] }, overrides);
}
// The drawer's watch(() => props.open, ...) seeds form state from a false->true
// transition (mirrors real usage — SongsView mounts it once with open=false and
// flips it true on edit-click). Mount closed, then open it so that seeding runs.
function mountDrawer(song) {
    return __awaiter(this, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wrapper = (0, test_utils_1.mount)(SongSlideOver_vue_1.default, {
                        props: { open: false, song: song },
                        global: {
                            // Render Teleport's default slot in place — content actually teleported to
                            // document.body isn't reachable via wrapper.find/findAll.
                            stubs: { Teleport: { template: '<div><slot /></div>' } },
                        },
                    });
                    return [4 /*yield*/, wrapper.setProps({ open: true })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, wrapper];
            }
        });
    });
}
(0, vitest_1.describe)('SongSlideOver — save', function () {
    (0, vitest_1.beforeEach)(function () {
        mockVwModeEnabled = true;
        mockAddSong.mockClear();
        mockUpdateSong.mockClear();
        mockDeleteSong.mockClear();
    });
    // CR-02 (D-14): removing a theme from the free-text Themes field must record
    // it into removedThemes on save so it doesn't reappear on the next PC re-import.
    (0, vitest_1.it)('appends a removed theme to removedThemes on save', function () { return __awaiter(void 0, void 0, void 0, function () {
        var song, wrapper, themesInput, saveButton, _a, data;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: [] });
                    return [4 /*yield*/, mountDrawer(song)];
                case 1:
                    wrapper = _b.sent();
                    themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]');
                    return [4 /*yield*/, themesInput.setValue('Grace')];
                case 2:
                    _b.sent();
                    saveButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; });
                    (0, vitest_1.expect)(saveButton).toBeTruthy();
                    return [4 /*yield*/, saveButton.trigger('click')];
                case 3:
                    _b.sent();
                    (0, vitest_1.expect)(mockUpdateSong).toHaveBeenCalledTimes(1);
                    _a = mockUpdateSong.mock.calls[0], data = _a[1];
                    (0, vitest_1.expect)(data.themes).toEqual(['Grace']);
                    (0, vitest_1.expect)(data.removedThemes).toEqual(['Redemption']);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('merges a newly removed theme with any previously removedThemes (de-duped)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var song, wrapper, themesInput, saveButton, _a, data;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: ['Old'] });
                    return [4 /*yield*/, mountDrawer(song)];
                case 1:
                    wrapper = _b.sent();
                    themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]');
                    return [4 /*yield*/, themesInput.setValue('Grace')];
                case 2:
                    _b.sent();
                    saveButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; });
                    return [4 /*yield*/, saveButton.trigger('click')];
                case 3:
                    _b.sent();
                    (0, vitest_1.expect)(mockUpdateSong).toHaveBeenCalledTimes(1);
                    _a = mockUpdateSong.mock.calls[0], data = _a[1];
                    (0, vitest_1.expect)(data.removedThemes).toEqual(vitest_1.expect.arrayContaining(['Old', 'Redemption']));
                    (0, vitest_1.expect)(data.removedThemes.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    // CR-02 (D-14): re-adding a previously-removed theme must prune it back out
    // of removedThemes so it's no longer suppressed on the next re-import.
    (0, vitest_1.it)('prunes a re-added theme from removedThemes on save', function () { return __awaiter(void 0, void 0, void 0, function () {
        var song, wrapper, themesInput, saveButton, _a, data;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    song = makeSong({ themes: ['Grace'], removedThemes: ['Redemption'] });
                    return [4 /*yield*/, mountDrawer(song)];
                case 1:
                    wrapper = _b.sent();
                    themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]');
                    return [4 /*yield*/, themesInput.setValue('Grace, Redemption')];
                case 2:
                    _b.sent();
                    saveButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; });
                    return [4 /*yield*/, saveButton.trigger('click')];
                case 3:
                    _b.sent();
                    (0, vitest_1.expect)(mockUpdateSong).toHaveBeenCalledTimes(1);
                    _a = mockUpdateSong.mock.calls[0], data = _a[1];
                    (0, vitest_1.expect)(data.themes).toEqual(['Grace', 'Redemption']);
                    (0, vitest_1.expect)(data.removedThemes).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('leaves removedThemes unchanged when the themes set is untouched', function () { return __awaiter(void 0, void 0, void 0, function () {
        var song, wrapper, saveButton, _a, data;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: ['Old'] });
                    return [4 /*yield*/, mountDrawer(song)
                        // Dirty a different field so Save is enabled without touching themesInput.
                    ];
                case 1:
                    wrapper = _b.sent();
                    // Dirty a different field so Save is enabled without touching themesInput.
                    return [4 /*yield*/, wrapper.find('input[placeholder="e.g. Hillsong"]').setValue('New Author')];
                case 2:
                    // Dirty a different field so Save is enabled without touching themesInput.
                    _b.sent();
                    saveButton = wrapper.findAll('button').find(function (b) { return b.text() === 'Save'; });
                    return [4 /*yield*/, saveButton.trigger('click')];
                case 3:
                    _b.sent();
                    (0, vitest_1.expect)(mockUpdateSong).toHaveBeenCalledTimes(1);
                    _a = mockUpdateSong.mock.calls[0], data = _a[1];
                    (0, vitest_1.expect)(data.removedThemes).toEqual(['Old']);
                    return [2 /*return*/];
            }
        });
    }); });
});
