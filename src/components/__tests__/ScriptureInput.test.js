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
var vue_1 = require("vue");
var test_utils_1 = require("@vue/test-utils");
var ScriptureInput_vue_1 = require("../ScriptureInput.vue");
// Use real BIBLE_BOOKS since it's a pure constant (no side effects)
// Mock esvLink, scripturesOverlap, and parseScriptureInput for controlled testing
vitest_1.vi.mock('@/utils/scripture', function () { return ({
    BIBLE_BOOKS: [
        'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
        'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
        '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
        'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
        'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
        'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
        'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
        'Haggai', 'Zechariah', 'Malachi',
        'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
        '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
        'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
        '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
        'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
        'Jude', 'Revelation',
    ],
    esvLink: vitest_1.vi.fn(function (book, chapter) {
        return "https://www.esv.org/".concat(book, "+").concat(chapter);
    }),
    scripturesOverlap: vitest_1.vi.fn(function () { return false; }),
    // Use a simple real implementation so component behaviour is testable
    parseScriptureInput: vitest_1.vi.fn(function (text) {
        var _a;
        var trimmed = text.trim();
        if (!trimmed)
            return null;
        var match = trimmed.match(/^(.+?)\s+(\d+)(?::(.+))?$/);
        if (!match)
            return null;
        var bookToken = match[1], chapterToken = match[2], verseExpr = match[3];
        var BOOKS = [
            'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
            'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
            '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
            'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
            'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
            'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
            'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
            'Haggai', 'Zechariah', 'Malachi',
            'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
            '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
            'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
            '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
            'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
            'Jude', 'Revelation',
        ];
        var inputLower = bookToken.trim().toLowerCase();
        var exactMatch = BOOKS.find(function (b) { return b.toLowerCase() === inputLower; });
        var resolvedBook = null;
        if (exactMatch) {
            resolvedBook = exactMatch;
        }
        else {
            if (inputLower.length < 4)
                return null;
            var prefixMatches = BOOKS.filter(function (b) { return b.toLowerCase().startsWith(inputLower); });
            if (prefixMatches.length === 1)
                resolvedBook = prefixMatches[0];
            else
                return null;
        }
        var chapter = parseInt(chapterToken, 10);
        if (isNaN(chapter) || chapter <= 0)
            return null;
        var verseStart;
        var verseEnd;
        if (verseExpr !== undefined) {
            var nums = ((_a = verseExpr.trim().match(/\d+/g)) !== null && _a !== void 0 ? _a : []).map(Number);
            if (nums.length === 0)
                return null;
            if (nums.length === 1) {
                verseStart = nums[0];
            }
            else {
                verseStart = Math.min.apply(Math, nums);
                verseEnd = Math.max.apply(Math, nums);
            }
        }
        var result = { book: resolvedBook, chapter: chapter };
        if (verseStart !== undefined)
            result.verseStart = verseStart;
        if (verseEnd !== undefined)
            result.verseEnd = verseEnd;
        return result;
    }),
}); });
vitest_1.vi.mock('@/utils/esvApi', function () { return ({
    fetchPassageText: vitest_1.vi.fn(function () { return Promise.resolve('Mocked passage text'); }),
}); });
vitest_1.vi.mock('@/utils/claudeApi', function () { return ({
    getScriptureSuggestions: vitest_1.vi.fn(function () { return Promise.resolve(null); }),
}); });
(0, vitest_1.describe)('ScriptureInput', function () {
    var defaultProps = {
        modelValue: null,
        sermonPassage: null,
        showOverlapWarning: true,
        label: 'Scripture Reading',
    };
    (0, vitest_1.describe)('Freeform text input', function () {
        (0, vitest_1.it)('renders a single text input (no select element)', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
            (0, vitest_1.expect)(wrapper.find('select').exists()).toBe(false);
            (0, vitest_1.expect)(wrapper.find('input[type="text"]').exists()).toBe(true);
        });
        (0, vitest_1.it)('shows placeholder text for Scripture Reading label', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
            var input = wrapper.find('input[type="text"]');
            (0, vitest_1.expect)(input.attributes('placeholder')).toContain('Isaiah 53:1-6');
        });
        (0, vitest_1.it)('shows placeholder text for Sermon Passage label', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { label: 'Sermon Passage' }),
            });
            var input = wrapper.find('input[type="text"]');
            (0, vitest_1.expect)(input.attributes('placeholder')).toContain('Romans 8:28');
        });
        (0, vitest_1.it)('typing "Isaiah 53:1-6" emits the correct ScriptureRef', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input, emitted, lastEmit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
                        input = wrapper.find('input[type="text"]');
                        return [4 /*yield*/, input.setValue('Isaiah 53:1-6')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, input.trigger('input')];
                    case 2:
                        _a.sent();
                        emitted = wrapper.emitted('update:modelValue');
                        (0, vitest_1.expect)(emitted).toBeTruthy();
                        lastEmit = emitted[emitted.length - 1];
                        (0, vitest_1.expect)(lastEmit[0]).toEqual({ book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('typing "Romans 8:28" emits ScriptureRef with single verse', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input, emitted, lastEmit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
                        input = wrapper.find('input[type="text"]');
                        return [4 /*yield*/, input.setValue('Romans 8:28')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, input.trigger('input')];
                    case 2:
                        _a.sent();
                        emitted = wrapper.emitted('update:modelValue');
                        (0, vitest_1.expect)(emitted).toBeTruthy();
                        lastEmit = emitted[emitted.length - 1];
                        (0, vitest_1.expect)(lastEmit[0]).toEqual({ book: 'Romans', chapter: 8, verseStart: 28 });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('typing "John 3" emits ScriptureRef with book and chapter only', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input, emitted, lastEmit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
                        input = wrapper.find('input[type="text"]');
                        return [4 /*yield*/, input.setValue('John 3')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, input.trigger('input')];
                    case 2:
                        _a.sent();
                        emitted = wrapper.emitted('update:modelValue');
                        (0, vitest_1.expect)(emitted).toBeTruthy();
                        lastEmit = emitted[emitted.length - 1];
                        (0, vitest_1.expect)(lastEmit[0]).toEqual({ book: 'John', chapter: 3 });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('typing junk text emits null and shows parse error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input, emitted, lastEmit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
                        input = wrapper.find('input[type="text"]');
                        return [4 /*yield*/, input.setValue('junk text here')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, input.trigger('input')];
                    case 2:
                        _a.sent();
                        emitted = wrapper.emitted('update:modelValue');
                        (0, vitest_1.expect)(emitted).toBeTruthy();
                        lastEmit = emitted[emitted.length - 1];
                        (0, vitest_1.expect)(lastEmit[0]).toBeNull();
                        (0, vitest_1.expect)(wrapper.text()).toContain('Unrecognized reference');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('clearing the input emits null with no parse error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input, emitted, lastEmit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
                        input = wrapper.find('input[type="text"]');
                        return [4 /*yield*/, input.setValue('')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, input.trigger('input')];
                    case 2:
                        _a.sent();
                        emitted = wrapper.emitted('update:modelValue');
                        (0, vitest_1.expect)(emitted).toBeTruthy();
                        lastEmit = emitted[emitted.length - 1];
                        (0, vitest_1.expect)(lastEmit[0]).toBeNull();
                        (0, vitest_1.expect)(wrapper.text()).not.toContain('Unrecognized reference');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('ESV link', function () {
        (0, vitest_1.it)('does not show ESV link when input is empty', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, { props: defaultProps });
            (0, vitest_1.expect)(wrapper.text()).not.toContain('ESV');
        });
        (0, vitest_1.it)('shows a link containing "ESV" text when modelValue has book and chapter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper;
            return __generator(this, function (_a) {
                wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                    props: __assign(__assign({}, defaultProps), { modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 } }),
                });
                (0, vitest_1.expect)(wrapper.text()).toContain('ESV');
                return [2 /*return*/];
            });
        }); });
        (0, vitest_1.it)('shows ESV link when modelValue has only book+chapter (no verses)', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3 } }),
            });
            (0, vitest_1.expect)(wrapper.text()).toContain('ESV');
        });
        (0, vitest_1.it)('does not show ESV link when modelValue is null', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: null }),
            });
            (0, vitest_1.expect)(wrapper.text()).not.toContain('ESV');
        });
    });
    (0, vitest_1.describe)('Overlap warning', function () {
        (0, vitest_1.it)('shows overlap warning when showOverlapWarning=true and overlap is detected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var scripturesOverlap, wrapper;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('@/utils/scripture'); })];
                    case 1:
                        scripturesOverlap = (_a.sent()).scripturesOverlap;
                        vitest_1.vi.mocked(scripturesOverlap).mockReturnValue(true);
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                            props: {
                                modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
                                sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
                                showOverlapWarning: true,
                                label: 'Scripture Reading',
                            },
                        });
                        (0, vitest_1.expect)(wrapper.text()).toContain('overlaps with the sermon passage');
                        vitest_1.vi.mocked(scripturesOverlap).mockReturnValue(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not show overlap warning when showOverlapWarning=false even with overlapping passages', function () { return __awaiter(void 0, void 0, void 0, function () {
            var scripturesOverlap, wrapper;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('@/utils/scripture'); })];
                    case 1:
                        scripturesOverlap = (_a.sent()).scripturesOverlap;
                        vitest_1.vi.mocked(scripturesOverlap).mockReturnValue(true);
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                            props: {
                                modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
                                sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
                                showOverlapWarning: false,
                                label: 'Scripture Reading',
                            },
                        });
                        (0, vitest_1.expect)(wrapper.text()).not.toContain('overlaps with the sermon passage');
                        vitest_1.vi.mocked(scripturesOverlap).mockReturnValue(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('Preview dismiss', function () {
        (0, vitest_1.it)('close button dismisses the preview panel and re-shows the Preview passage button', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, previewBtn, closeBtn;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                            props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 } }),
                        });
                        previewBtn = wrapper.findAll('button').find(function (b) { return b.text().includes('Preview passage'); });
                        (0, vitest_1.expect)(previewBtn).toBeTruthy();
                        return [4 /*yield*/, previewBtn.trigger('click')
                            // Wait for async fetch to resolve
                        ];
                    case 1:
                        _a.sent();
                        // Wait for async fetch to resolve
                        return [4 /*yield*/, (0, vue_1.nextTick)()];
                    case 2:
                        // Wait for async fetch to resolve
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.flushPromises)()
                            // Passage text should be visible
                        ];
                    case 3:
                        _a.sent();
                        // Passage text should be visible
                        (0, vitest_1.expect)(wrapper.text()).toContain('Mocked passage text');
                        closeBtn = wrapper.find('button[aria-label="Close preview"]');
                        (0, vitest_1.expect)(closeBtn.exists()).toBe(true);
                        return [4 /*yield*/, closeBtn.trigger('click')];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, vue_1.nextTick)()
                            // Passage text should be gone
                        ];
                    case 5:
                        _a.sent();
                        // Passage text should be gone
                        (0, vitest_1.expect)(wrapper.text()).not.toContain('Mocked passage text');
                        // Preview passage button should be visible again
                        (0, vitest_1.expect)(wrapper.text()).toContain('Preview passage');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('Preview passage', function () {
        (0, vitest_1.it)('shows preview button when book and chapter are present', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3 } }),
            });
            (0, vitest_1.expect)(wrapper.text()).toContain('Preview passage');
        });
        (0, vitest_1.it)('shows preview button when all 4 fields are filled', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 } }),
            });
            (0, vitest_1.expect)(wrapper.text()).toContain('Preview passage');
            (0, vitest_1.expect)(wrapper.text()).toContain('ESV');
        });
        (0, vitest_1.it)('ESV link is still visible when all 4 fields are filled', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 } }),
            });
            (0, vitest_1.expect)(wrapper.text()).toContain('ESV');
        });
    });
    (0, vitest_1.describe)('modelValue population', function () {
        (0, vitest_1.it)('populates text input from modelValue on mount', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 } }),
            });
            var input = wrapper.find('input[type="text"]');
            (0, vitest_1.expect)(input.element.value).toBe('Isaiah 53:1-6');
        });
        (0, vitest_1.it)('populates text input with chapter only when no verses in modelValue', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3 } }),
            });
            var input = wrapper.find('input[type="text"]');
            (0, vitest_1.expect)(input.element.value).toBe('John 3');
        });
        (0, vitest_1.it)('populates text input with single verse when only verseStart set', function () {
            var wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                props: __assign(__assign({}, defaultProps), { modelValue: { book: 'Romans', chapter: 8, verseStart: 28 } }),
            });
            var input = wrapper.find('input[type="text"]');
            (0, vitest_1.expect)(input.element.value).toBe('Romans 8:28');
        });
        (0, vitest_1.it)('clears text input when modelValue becomes null externally', function () { return __awaiter(void 0, void 0, void 0, function () {
            var wrapper, input;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wrapper = (0, test_utils_1.mount)(ScriptureInput_vue_1.default, {
                            props: __assign(__assign({}, defaultProps), { modelValue: { book: 'John', chapter: 3 } }),
                        });
                        return [4 /*yield*/, wrapper.setProps({ modelValue: null })];
                    case 1:
                        _a.sent();
                        input = wrapper.find('input[type="text"]');
                        (0, vitest_1.expect)(input.element.value).toBe('');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
