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
// Mock esvApi before importing planningCenterApi
vitest_1.vi.mock('@/utils/esvApi', function () { return ({
    fetchPassageText: vitest_1.vi.fn(),
}); });
var esvApi_1 = require("@/utils/esvApi");
var planningCenterApi_1 = require("@/utils/planningCenterApi");
var mockTimestamp = { toDate: function () { return new Date('2026-03-08'); } };
function makeService(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'svc-001', date: '2026-03-08', name: 'Sunday Service', progression: '1-2-2-3', teams: [], status: 'planned', slots: [], sermonPassage: null, sermonTopic: '', notes: '', createdAt: mockTimestamp, updatedAt: mockTimestamp }, overrides);
}
(0, vitest_1.describe)('buildPlanTitle', function () {
    (0, vitest_1.it)('returns scripture ref with teams in parens when sermonPassage and teams are present', function () {
        var service = makeService({
            sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
            teams: ['Choir'],
        });
        (0, vitest_1.expect)((0, planningCenterApi_1.buildPlanTitle)(service)).toBe('Romans 8:1-11 (Choir)');
    });
    (0, vitest_1.it)('returns service name when sermonPassage is null and name is non-empty', function () {
        var service = makeService({ sermonPassage: null, name: 'Easter', teams: [] });
        (0, vitest_1.expect)((0, planningCenterApi_1.buildPlanTitle)(service)).toBe('Easter');
    });
    (0, vitest_1.it)('returns "Service" fallback when sermonPassage is null and name is empty', function () {
        var service = makeService({ sermonPassage: null, name: '', teams: [] });
        (0, vitest_1.expect)((0, planningCenterApi_1.buildPlanTitle)(service)).toBe('Service');
    });
    (0, vitest_1.it)('returns scripture ref with multiple teams joined by comma', function () {
        var service = makeService({
            sermonPassage: { book: 'Revelation', chapter: 12 },
            teams: ['Choir', 'Orchestra'],
        });
        (0, vitest_1.expect)((0, planningCenterApi_1.buildPlanTitle)(service)).toBe('Revelation 12 (Choir, Orchestra)');
    });
    (0, vitest_1.it)('returns scripture ref without parens when no teams', function () {
        var service = makeService({
            sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
            teams: [],
        });
        (0, vitest_1.expect)((0, planningCenterApi_1.buildPlanTitle)(service)).toBe('Romans 8:1-11');
    });
});
(0, vitest_1.describe)('validatePcCredentials', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('returns {valid: true} when fetch returns 200', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ valid: true });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns {valid: false, error: "Invalid credentials"} when fetch returns 401', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ valid: false, error: 'Invalid credentials' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns {valid: false, error: "Network error"} when fetch throws', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ valid: false, error: 'Network error' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns {valid: false, error: "API error: 500"} when fetch returns other non-ok status', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ valid: false, error: 'API error: 500' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('sends Authorization header with Basic auth', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, options, headers;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.validatePcCredentials)('myapp', 'mysecret')];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    headers = options === null || options === void 0 ? void 0 : options.headers;
                    (0, vitest_1.expect)(headers === null || headers === void 0 ? void 0 : headers.Authorization).toBe('Basic ' + btoa('myapp:mysecret'));
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchServiceTypes', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('returns array of {id, name} from JSON:API response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: '123', attributes: { name: 'Sunday Gathering' } },
                            { id: '456', attributes: { name: 'Wednesday Night' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypes)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { id: '123', name: 'Sunday Gathering' },
                        { id: '456', name: 'Wednesday Night' },
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns empty array when data is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypes)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchTemplates', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('returns array of {id, name} from JSON:API response at /service_types/{id}/plan_templates', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 'tmpl-1', attributes: { name: 'Standard Template' } },
                            { id: 'tmpl-2', attributes: { name: 'Holiday Template' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTemplates)('app-id', 'secret', 'svc-type-1')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { id: 'tmpl-1', name: 'Standard Template' },
                        { id: 'tmpl-2', name: 'Holiday Template' },
                    ]);
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plan_templates');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchTemplates)('app-id', 'secret', 'svc-type-1')).rejects.toThrow('Failed to fetch templates: 400')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchTemplateItems', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('fetches items from template endpoint and returns mapped array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: '1', attributes: { title: 'Worship Song', item_type: 'song', sequence: 1 } },
                            { id: '2', attributes: { title: 'Prayer', item_type: 'regular', sequence: 2 } },
                            { id: '3', attributes: { title: 'Scripture Reading', item_type: 'regular', sequence: 3, html_details: '<p>Read aloud</p>' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTemplateItems)('app-id', 'secret', 'svc-type-1', 'tmpl-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { title: 'Worship Song', itemType: 'song', sequence: 1, description: undefined },
                        { title: 'Prayer', itemType: 'regular', sequence: 2, description: undefined },
                        { title: 'Scripture Reading', itemType: 'regular', sequence: 3, description: '<p>Read aloud</p>' },
                    ]);
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plan_templates/tmpl-42/items');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchTemplateItems)('app-id', 'secret', 'svc-type-1', 'tmpl-42')).rejects.toThrow('Failed to fetch template items: 404')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('createPlan', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('sends POST to /service_types/{id}/plans with JSON:API body and returns plan ID', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, _a, url, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'plan-123' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlan)('app-id', 'secret', 'svc-type-1', 'Romans 8:1-11')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(result).toBe('plan-123');
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plans');
                    (0, vitest_1.expect)(options === null || options === void 0 ? void 0 : options.method).toBe('POST');
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.type).toBe('Plan');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Romans 8:1-11');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('sends only title in attributes (no date fields)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'plan-456' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createPlan)('app-id', 'secret', 'svc-type-1', 'Easter')];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes).toEqual({ title: 'Easter' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.createPlan)('app-id', 'secret', 'svc-type-1', 'Title')).rejects.toThrow()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('createItem', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('sends POST with item_type "song_arrangement" for songs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, _a, url, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-001' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Come Thou Fount',
                            itemType: 'song_arrangement',
                        })];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(result).toBe('item-001');
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plans/plan-1/items');
                    (0, vitest_1.expect)(options === null || options === void 0 ? void 0 : options.method).toBe('POST');
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Come Thou Fount');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('sends POST with item_type "regular" for non-song items', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-002' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Prayer',
                            itemType: 'regular',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('regular');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('includes html_details when description is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-003' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Scripture',
                            itemType: 'regular',
                            description: 'In the beginning...',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.html_details).toBe('In the beginning...');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does not include html_details when description is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-004' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Prayer',
                            itemType: 'regular',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.html_details).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', { title: 'Test', itemType: 'regular' })).rejects.toThrow()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('updateItem', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('sends PATCH to /service_types/{id}/plans/{planId}/items/{itemId}', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, url, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.updateItem)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
                            title: 'Come Thou Fount',
                            itemType: 'song_arrangement',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plans/plan-1/items/item-5');
                    (0, vitest_1.expect)(options === null || options === void 0 ? void 0 : options.method).toBe('PATCH');
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.type).toBe('Item');
                    (0, vitest_1.expect)(body.data.id).toBe('item-5');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Come Thou Fount');
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('only includes provided attributes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.updateItem)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
                            title: 'Updated Title',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes).toEqual({ title: 'Updated Title' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.updateItem)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', { title: 'X' })).rejects.toThrow('Failed to update item: 403')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('searchSongByCcli', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('calls GET /songs?where[ccli_number]=<ccli> and returns {id, title} on match', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 'pc-song-42', attributes: { title: 'Great Is Thy Faithfulness' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.searchSongByCcli)('app-id', 'secret', '1234567')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ id: 'pc-song-42', title: 'Great Is Thy Faithfulness' });
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/songs?where[ccli_number]=1234567');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when PC returns empty data array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.searchSongByCcli)('app-id', 'secret', '9999999')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null (does not throw) on network/API errors', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
                    return [4 /*yield*/, (0, planningCenterApi_1.searchSongByCcli)('app-id', 'secret', '1234567')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchSongArrangements', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('calls GET /songs/{songId}/arrangements and returns array of {id, name, key}', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 'arr-1', attributes: { name: 'Default Arrangement', chord_chart_key: 'G' } },
                            { id: 'arr-2', attributes: { name: 'Acoustic', chord_chart_key: null } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchSongArrangements)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { id: 'arr-1', name: 'Default Arrangement', key: 'G' },
                        { id: 'arr-2', name: 'Acoustic', key: '' },
                    ]);
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/songs/pc-song-42/arrangements');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns empty array on error (does not throw)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchSongArrangements)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('createItem with arrangement', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('includes arrangement relationship in POST body when arrangementId provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-song-1' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Come Thou Fount',
                            itemType: 'song',
                            arrangementId: 'arr-1',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.relationships.arrangement.data).toEqual({
                        type: 'Arrangement',
                        id: 'arr-1',
                    });
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does not include relationships when arrangementId is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-2' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Prayer',
                            itemType: 'regular',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.relationships).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('createItem type union', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('accepts "song" as a valid itemType for createItem', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = { data: { id: 'item-song-1' } };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItem)('app-id', 'secret', 'svc-type-1', 'plan-1', {
                            title: 'Test Song',
                            itemType: 'song',
                        })];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(result).toBe('item-song-1');
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('accepts "song" as a valid itemType for updateItem', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.updateItem)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
                            itemType: 'song',
                        })];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song');
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('addSlotAsItem', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
        vitest_1.vi.mocked(esvApi_1.fetchPassageText).mockResolvedValue('In the beginning God created the heavens...');
    });
    var defaultFetchResponse = function () {
        return vitest_1.vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }));
    };
    (0, vitest_1.it)('maps SONG slot without CCLI match to song_arrangement with bare song title', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Come Thou Fount',
                        songKey: 'G',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - Come Thou Fount');
                    (0, vitest_1.expect)(body.data.relationships).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('looks up CCLI first and creates song item with arrangement relationship in POST', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot, searchUrl, arrUrl, schedUrl, _a, createOpts, createBody;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'Come Thou Fount',
                            ccliNumber: '1234567',
                            author: 'Robert Robinson',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Come Thou Fount',
                        songKey: 'G',
                    };
                    // Mock: searchSongByCcli (found), fetchSongArrangements, song_schedules (no history), then createItem
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // song_schedules (no history)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })); // createItem
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)
                        // 4 fetch calls: search, arrangements, song_schedules, createItem
                    ];
                case 1:
                    _b.sent();
                    // 4 fetch calls: search, arrangements, song_schedules, createItem
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(4);
                    searchUrl = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(searchUrl).toContain('/songs?where[ccli_number]=1234567');
                    arrUrl = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    (0, vitest_1.expect)(arrUrl).toContain('/songs/pc-song-42/arrangements');
                    schedUrl = vitest_1.vi.mocked(fetch).mock.calls[2][0];
                    (0, vitest_1.expect)(schedUrl).toContain('/songs/pc-song-42/song_schedules?filter=three_most_recent');
                    _a = vitest_1.vi.mocked(fetch).mock.calls[3], createOpts = _a[1];
                    createBody = JSON.parse(createOpts === null || createOpts === void 0 ? void 0 : createOpts.body);
                    (0, vitest_1.expect)(createBody.data.attributes.item_type).toBe('song');
                    (0, vitest_1.expect)(createBody.data.relationships.song.data).toEqual({ type: 'Song', id: 'pc-song-42' });
                    (0, vitest_1.expect)(createBody.data.relationships.arrangement.data).toEqual({ type: 'Arrangement', id: 'arr-1' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does not search PC when song has empty ccliNumber', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'Custom Song',
                            ccliNumber: '',
                            author: '',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Custom Song',
                        songKey: 'C',
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)
                        // Only 1 fetch call (createItem), no search
                    ];
                case 1:
                    _a.sent();
                    // Only 1 fetch call (createItem), no search
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('creates item as song_arrangement when searchSongByCcli returns null', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot, result, _a, createOpts, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'New Song',
                            ccliNumber: '9999999',
                            author: '',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'New Song',
                        songKey: 'D',
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // searchSongByCcli returns empty
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })); // createItem
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(result).toBe('item-99');
                    // 2 fetch calls: search (no match) + createItem (as song_arrangement)
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(2);
                    _a = vitest_1.vi.mocked(fetch).mock.calls[1], createOpts = _a[1];
                    body = JSON.parse(createOpts === null || createOpts === void 0 ? void 0 : createOpts.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    (0, vitest_1.expect)(body.data.relationships).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('creates item as song with song relationship when CCLI matches but no arrangements', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot, _a, createOpts, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'Song',
                            ccliNumber: '1234567',
                            author: '',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Song',
                        songKey: 'E',
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Song' } }] }), { status: 200 })) // searchSongByCcli
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // fetchSongArrangements returns empty
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // song_schedules (no history)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })); // createItem
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)
                        // 4 fetch calls: search + arrangements (empty) + song_schedules + createItem (as song with song relationship)
                    ];
                case 1:
                    _b.sent();
                    // 4 fetch calls: search + arrangements (empty) + song_schedules + createItem (as song with song relationship)
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(4);
                    _a = vitest_1.vi.mocked(fetch).mock.calls[3], createOpts = _a[1];
                    body = JSON.parse(createOpts === null || createOpts === void 0 ? void 0 : createOpts.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song');
                    (0, vitest_1.expect)(body.data.relationships.song.data).toEqual({ type: 'Song', id: 'pc-song-42' });
                    (0, vitest_1.expect)(body.data.relationships.arrangement).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('HYMN slot still uses item_type "song_arrangement"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = {
                        kind: 'HYMN',
                        position: 1,
                        hymnName: 'Be Thou My Vision',
                        hymnNumber: '382',
                        verses: '',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps HYMN slot to song_arrangement with "Name #Number" format', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = {
                        kind: 'HYMN',
                        position: 1,
                        hymnName: 'Amazing Grace',
                        hymnNumber: '337',
                        verses: '1, 3, 4',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('song_arrangement');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - Amazing Grace #337 (vv. 1, 3, 4)');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps HYMN slot without number using just name', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = {
                        kind: 'HYMN',
                        position: 1,
                        hymnName: 'Holy Holy Holy',
                        hymnNumber: '',
                        verses: '',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - Holy Holy Holy');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps SCRIPTURE slot to regular item with title and ESV text as description', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    vitest_1.vi.mocked(esvApi_1.fetchPassageText).mockResolvedValueOnce('For God so loved the world...');
                    slot = {
                        kind: 'SCRIPTURE',
                        position: 2,
                        book: 'John',
                        chapter: 3,
                        verseStart: 16,
                        verseEnd: 17,
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('regular');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Scripture - John 3:16-17');
                    (0, vitest_1.expect)(body.data.attributes.html_details).toBe('For God so loved the world...');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps PRAYER slot to regular item with title "Prayer"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = { kind: 'PRAYER', position: 3 };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 3, [])];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('regular');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Prayer');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps MESSAGE slot to regular item with title "Message" and no description when sermonPassage is null', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = { kind: 'MESSAGE', position: 4 };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], null)];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.item_type).toBe('regular');
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Message');
                    (0, vitest_1.expect)(body.data.attributes.html_details).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('maps MESSAGE slot with sermonPassage to regular item with formatted passage as description', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, sermonPassage, _a, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultFetchResponse();
                    slot = { kind: 'MESSAGE', position: 4 };
                    sermonPassage = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], sermonPassage)];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], options = _a[1];
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Message');
                    (0, vitest_1.expect)(body.data.attributes.html_details).toBe('Romans 8:1-11');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('skips SONG slots with null songId (does not call fetch)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: null,
                        songTitle: null,
                        songKey: null,
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])
                        // fetch should NOT be called (slot is skipped)
                    ];
                case 1:
                    _a.sent();
                    // fetch should NOT be called (slot is skipped)
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('catches ESV fetch errors silently for SCRIPTURE slots', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    defaultFetchResponse();
                    vitest_1.vi.mocked(esvApi_1.fetchPassageText).mockRejectedValueOnce(new Error('ESV API error'));
                    slot = {
                        kind: 'SCRIPTURE',
                        position: 2,
                        book: 'Psalms',
                        chapter: 23,
                        verseStart: 1,
                        verseEnd: 6,
                    };
                    // Should not throw
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [])).resolves.not.toThrow()];
                case 1:
                    // Should not throw
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('copies item notes per category from last scheduled item via POST', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot, scheduleResponse, lastItemResponse, result, _a, noteUrl1, noteOpts1, noteBody1, _b, noteUrl2, noteOpts2, noteBody2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'Come Thou Fount',
                            ccliNumber: '1234567',
                            author: 'Robert Robinson',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Come Thou Fount',
                        songKey: 'G',
                    };
                    scheduleResponse = {
                        data: [{
                                id: 'sched-1',
                                relationships: {
                                    item: { data: { id: 'last-item-1' } },
                                    plan: { data: { id: 'plan-prev' } },
                                    service_type: { data: { id: 'st-prev' } },
                                },
                            }],
                    };
                    lastItemResponse = {
                        data: { attributes: {} },
                        included: [
                            {
                                type: 'ItemNote',
                                id: 'note-1',
                                attributes: { content: 'John Smith' },
                                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-person' } } },
                            },
                            {
                                type: 'ItemNote',
                                id: 'note-2',
                                attributes: { content: 'Lead vocals' },
                                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-vocals' } } },
                            },
                        ],
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
                        .mockResolvedValueOnce(new Response(JSON.stringify(scheduleResponse), { status: 200 })) // song_schedules
                        .mockResolvedValueOnce(new Response(JSON.stringify(lastItemResponse), { status: 200 })) // fetch last item with notes
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem
                        .mockResolvedValueOnce(new Response('{}', { status: 201 })) // createItemNote for note-1
                        .mockResolvedValueOnce(new Response('{}', { status: 201 })); // createItemNote for note-2
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)];
                case 1:
                    result = _c.sent();
                    (0, vitest_1.expect)(result).toBe('item-99');
                    // 7 fetch calls: search + arrangements + song_schedules + lastItem + createItem + 2 note POSTs
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(7);
                    _a = vitest_1.vi.mocked(fetch).mock.calls[5], noteUrl1 = _a[0], noteOpts1 = _a[1];
                    (0, vitest_1.expect)(noteUrl1).toContain('/items/item-99/item_notes');
                    noteBody1 = JSON.parse(noteOpts1 === null || noteOpts1 === void 0 ? void 0 : noteOpts1.body);
                    (0, vitest_1.expect)(noteBody1.data.attributes.item_note_category_id).toBe('cat-person');
                    (0, vitest_1.expect)(noteBody1.data.attributes.content).toBe('John Smith');
                    _b = vitest_1.vi.mocked(fetch).mock.calls[6], noteUrl2 = _b[0], noteOpts2 = _b[1];
                    (0, vitest_1.expect)(noteUrl2).toContain('/items/item-99/item_notes');
                    noteBody2 = JSON.parse(noteOpts2 === null || noteOpts2 === void 0 ? void 0 : noteOpts2.body);
                    (0, vitest_1.expect)(noteBody2.data.attributes.item_note_category_id).toBe('cat-vocals');
                    (0, vitest_1.expect)(noteBody2.data.attributes.content).toBe('Lead vocals');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('createItemNote failure does not abort export', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTimestampLocal, songs, slot, scheduleResponse, lastItemResponse, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockTimestampLocal = { toDate: function () { return new Date('2026-03-08'); } };
                    songs = [{
                            id: 'song-1',
                            title: 'Come Thou Fount',
                            ccliNumber: '1234567',
                            author: '',
                            themes: [],
                            notes: '',
                            tags: [],
                            removedThemes: [],
                            vwTypes: [1],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                            createdAt: mockTimestampLocal,
                            updatedAt: mockTimestampLocal,
                        }];
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-1',
                        songTitle: 'Come Thou Fount',
                        songKey: 'G',
                    };
                    scheduleResponse = {
                        data: [{
                                id: 'sched-1',
                                relationships: {
                                    item: { data: { id: 'last-item-1' } },
                                    plan: { data: { id: 'plan-prev' } },
                                    service_type: { data: { id: 'st-prev' } },
                                },
                            }],
                    };
                    lastItemResponse = {
                        data: { attributes: {} },
                        included: [
                            {
                                type: 'ItemNote',
                                id: 'note-1',
                                attributes: { content: 'John Smith' },
                                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-person' } } },
                            },
                        ],
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
                        .mockResolvedValueOnce(new Response(JSON.stringify(scheduleResponse), { status: 200 })) // song_schedules
                        .mockResolvedValueOnce(new Response(JSON.stringify(lastItemResponse), { status: 200 })) // fetch last item
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem
                        .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 })); // createItemNote fails
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBe('item-99');
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchLastScheduledItem', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    var mockScheduleResponse = function (itemId, planId, stId) {
        if (itemId === void 0) { itemId = 'item-last-1'; }
        if (planId === void 0) { planId = 'plan-prev'; }
        if (stId === void 0) { stId = 'st-1'; }
        return ({
            data: [{
                    id: 'sched-1',
                    relationships: {
                        item: { data: { id: itemId } },
                        plan: { data: { id: planId } },
                        service_type: { data: { id: stId } },
                    },
                }],
        });
    };
    var mockItemResponse = function (notes) {
        if (notes === void 0) { notes = []; }
        return ({
            data: { attributes: {} },
            included: notes.map(function (n) { return ({
                type: 'ItemNote',
                id: n.id,
                attributes: { content: n.content },
                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: n.catId } } },
            }); }),
        });
    };
    (0, vitest_1.it)('returns { notes } on success when song has been scheduled before', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, schedUrl, itemUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockItemResponse([
                        { id: 'note-1', content: 'John Smith', catId: 'cat-person' },
                        { id: 'note-2', content: 'Lead vocals', catId: 'cat-vocals' },
                    ])), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({
                        notes: [
                            { categoryId: 'cat-person', content: 'John Smith' },
                            { categoryId: 'cat-vocals', content: 'Lead vocals' },
                        ],
                        arrangementId: null,
                    });
                    schedUrl = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(schedUrl).toContain('/songs/pc-song-42/song_schedules?filter=three_most_recent');
                    itemUrl = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    (0, vitest_1.expect)(itemUrl).toContain('/service_types/st-1/plans/plan-prev/items/item-last-1?include=item_notes');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns { notes: [] } when no item notes exist', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockItemResponse()), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ notes: [], arrangementId: null });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('extracts the arrangement id from the item relationships', function () { return __awaiter(void 0, void 0, void 0, function () {
        var itemResponse, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemResponse = {
                        data: { attributes: {}, relationships: { arrangement: { data: { type: 'Arrangement', id: 'arr-77' } } } },
                        included: [],
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(itemResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({ notes: [], arrangementId: 'arr-77' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when song_schedules returns empty array (song never scheduled)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when song_schedules response is not ok', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when item fetch response is not ok', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
                        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null (does not throw) on network error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('ignores included items that are not ItemNote type', function () { return __awaiter(void 0, void 0, void 0, function () {
        var itemResponse, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemResponse = {
                        data: { attributes: {} },
                        included: [
                            {
                                type: 'Song',
                                id: 'song-1',
                                attributes: { content: 'Should be ignored' },
                                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-1' } } },
                            },
                            {
                                type: 'ItemNote',
                                id: 'note-1',
                                attributes: { content: 'Actual note' },
                                relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-2' } } },
                            },
                        ],
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(itemResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)('app-id', 'secret', 'pc-song-42')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual({
                        notes: [{ categoryId: 'cat-2', content: 'Actual note' }],
                        arrangementId: null,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('addSlotAsItem - Worship Song prefix', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('SONG with songTitle produces title "Worship Song - I Believe"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, createCall, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }));
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'song-abc',
                        songTitle: 'I Believe',
                        songKey: 'G',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])
                        // Find the fetch call whose URL ends with /items (createItem POST)
                    ];
                case 1:
                    _a.sent();
                    createCall = vitest_1.vi.mocked(fetch).mock.calls.find(function (_a) {
                        var url = _a[0];
                        return url.endsWith('/items');
                    });
                    (0, vitest_1.expect)(createCall).toBeDefined();
                    body = JSON.parse(createCall[1].body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - I Believe');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('SONG with undefined songTitle produces title "Worship Song - [Empty Song]"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, createCall, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }));
                    slot = {
                        kind: 'SONG',
                        position: 0,
                        requiredVwType: 1,
                        songId: 'abc',
                        songTitle: undefined,
                        songKey: null,
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])];
                case 1:
                    _a.sent();
                    createCall = vitest_1.vi.mocked(fetch).mock.calls.find(function (_a) {
                        var url = _a[0];
                        return url.endsWith('/items');
                    });
                    (0, vitest_1.expect)(createCall).toBeDefined();
                    body = JSON.parse(createCall[1].body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - [Empty Song]');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('HYMN with hymnName, hymnNumber, and verses produces "Worship Song - Holy, Holy, Holy #1 (vv. 1-3)"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, createCall, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }));
                    slot = {
                        kind: 'HYMN',
                        position: 1,
                        hymnName: 'Holy, Holy, Holy',
                        hymnNumber: '1',
                        verses: '1-3',
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [])];
                case 1:
                    _a.sent();
                    createCall = vitest_1.vi.mocked(fetch).mock.calls.find(function (_a) {
                        var url = _a[0];
                        return url.endsWith('/items');
                    });
                    (0, vitest_1.expect)(createCall).toBeDefined();
                    body = JSON.parse(createCall[1].body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - Holy, Holy, Holy #1 (vv. 1-3)');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('HYMN with bare hymnName (no number, no verses) produces "Worship Song - Amazing Grace"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var slot, createCall, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }));
                    slot = {
                        kind: 'HYMN',
                        position: 1,
                        hymnName: 'Amazing Grace',
                        hymnNumber: undefined,
                        verses: undefined,
                    };
                    return [4 /*yield*/, (0, planningCenterApi_1.addSlotAsItem)('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [])];
                case 1:
                    _a.sent();
                    createCall = vitest_1.vi.mocked(fetch).mock.calls.find(function (_a) {
                        var url = _a[0];
                        return url.endsWith('/items');
                    });
                    (0, vitest_1.expect)(createCall).toBeDefined();
                    body = JSON.parse(createCall[1].body);
                    (0, vitest_1.expect)(body.data.attributes.title).toBe('Worship Song - Amazing Grace');
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('createItemNote', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('sends POST to /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes with correct body', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, url, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.createItemNote)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-99', 'cat-person', 'John Smith')];
                case 1:
                    _b.sent();
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(1);
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/svc-type-1/plans/plan-1/items/item-99/item_notes');
                    (0, vitest_1.expect)(options === null || options === void 0 ? void 0 : options.method).toBe('POST');
                    body = JSON.parse(options === null || options === void 0 ? void 0 : options.body);
                    (0, vitest_1.expect)(body.data.type).toBe('ItemNote');
                    (0, vitest_1.expect)(body.data.attributes.item_note_category_id).toBe('cat-person');
                    (0, vitest_1.expect)(body.data.attributes.content).toBe('John Smith');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.createItemNote)('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-99', 'cat-1', 'content')).rejects.toThrow('Failed to create item note: 400')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('deleteItem', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('sends DELETE to /service_types/ST/plans/P/items/I and resolves on 204', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, url, options, headers;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.deleteItem)('app', 'sec', 'ST', 'P', 'I')];
                case 1:
                    _b.sent();
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(1);
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/ST/plans/P/items/I');
                    (0, vitest_1.expect)(options.method).toBe('DELETE');
                    headers = options.headers;
                    (0, vitest_1.expect)(headers.Authorization).toBe('Basic ' + btoa('app:sec'));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response with status in message', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.deleteItem)('app', 'sec', 'ST', 'P', 'I')).rejects.toThrow('Failed to delete item: 404')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchPlanItems', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('maps id, title, sequence, itemType, and length (preserving null)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 'i1', attributes: { title: 'Worship Song - A', sequence: 1, item_type: 'song', length: 300 } },
                            { id: 'i2', attributes: { title: 'Message', sequence: 2, item_type: 'regular', length: null } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanItems)('app', 'sec', 'ST', 'P')];
                case 1:
                    result = _a.sent();
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/service_types/ST/plans/P/items');
                    (0, vitest_1.expect)(result).toEqual([
                        { id: 'i1', title: 'Worship Song - A', sequence: 1, itemType: 'song', length: 300 },
                        { id: 'i2', title: 'Message', sequence: 2, itemType: 'regular', length: null },
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('coerces a missing length attribute to null', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockResponse = {
                        data: [{ id: 'i1', attributes: { title: 'Item', sequence: 1, item_type: 'regular' } }],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanItems)('app', 'sec', 'ST', 'P')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.length).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchServiceTypeTeams', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('maps response data to {id, name}[] and hits correct URL', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 't1', attributes: { name: 'Orchestra' } },
                            { id: 't2', attributes: { name: 'Choir' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchServiceTypeTeams)('app', 'sec', 'ST')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { id: 't1', name: 'Orchestra' },
                        { id: 't2', name: 'Choir' },
                    ]);
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/service_types/ST/teams');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchServiceTypeTeams)('app', 'sec', 'ST')).rejects.toThrow('Failed to fetch teams: 500')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('addNeededPosition', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('POSTs to needed_positions with team and team_position relationships', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, url, options, body;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 201 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.addNeededPosition)('app', 'sec', 'ST', 'P', 'TEAM1', 'POS1')];
                case 1:
                    _b.sent();
                    _a = vitest_1.vi.mocked(fetch).mock.calls[0], url = _a[0], options = _a[1];
                    (0, vitest_1.expect)(url).toContain('/service_types/ST/plans/P/needed_positions');
                    (0, vitest_1.expect)(options.method).toBe('POST');
                    body = JSON.parse(options.body);
                    (0, vitest_1.expect)(body.data.type).toBe('NeededPosition');
                    (0, vitest_1.expect)(body.data.attributes.quantity).toBe(1);
                    (0, vitest_1.expect)(body.data.relationships.team.data).toEqual({ type: 'Team', id: 'TEAM1' });
                    (0, vitest_1.expect)(body.data.relationships.team_position.data).toEqual({ type: 'TeamPosition', id: 'POS1' });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 422 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.addNeededPosition)('app', 'sec', 'ST', 'P', 'TEAM1', 'POS1')).rejects.toThrow('Failed to add position POS1 for team TEAM1: 422')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchTeamPositions', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('returns positions for a team from /teams/{id}/team_positions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockPayload, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPayload = {
                        data: [
                            { id: 'P1', attributes: { name: 'Lead Guitar' } },
                            { id: 'P2', attributes: { name: 'Drums' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockPayload), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTeamPositions)('app', 'sec', 'TEAM1')];
                case 1:
                    result = _a.sent();
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/teams/TEAM1/team_positions');
                    (0, vitest_1.expect)(result).toEqual([{ id: 'P1', name: 'Lead Guitar' }, { id: 'P2', name: 'Drums' }]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns empty array on non-ok response (non-fatal)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 404 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchTeamPositions)('app', 'sec', 'TEAM1')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchPlanNeededPositionTeamIds', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('returns a Set of team IDs from existing needed_positions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockPayload, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockPayload = {
                        data: [
                            { relationships: { team: { data: { id: 'T1', type: 'Team' } } } },
                            { relationships: { team: { data: { id: 'T2', type: 'Team' } } } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockPayload), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanNeededPositionTeamIds)('app', 'sec', 'ST', 'P')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual(new Set(['T1', 'T2']));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns empty Set on non-ok response (non-fatal)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 500 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanNeededPositionTeamIds)('app', 'sec', 'ST', 'P')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual(new Set());
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchPlanTimes', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('maps response data to {id, timeType}[] and hits correct URL', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            { id: 'pt1', attributes: { time_type: 'service' } },
                            { id: 'pt2', attributes: { time_type: 'rehearsal' } },
                        ],
                    };
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPlanTimes)('app', 'sec', 'ST', 'P')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toEqual([
                        { id: 'pt1', timeType: 'service' },
                        { id: 'pt2', timeType: 'rehearsal' },
                    ]);
                    url = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(url).toContain('/service_types/ST/plans/P/plan_times');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws on non-ok response', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchPlanTimes)('app', 'sec', 'ST', 'P')).rejects.toThrow('Failed to fetch plan times: 500')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchAllPeople', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('follows links.next across 2 pages and returns the concatenated people array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var page1, page2, result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    page1 = {
                        data: [
                            { id: 'p1', attributes: { first_name: 'Ann', last_name: 'Lee', name: 'Ann Lee' } },
                        ],
                        links: {
                            self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=0',
                            next: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
                        },
                    };
                    page2 = {
                        data: [
                            { id: 'p2', attributes: { first_name: 'Bo', last_name: 'Ray', name: 'Bo Ray' } },
                        ],
                        links: {
                            self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
                        },
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAllPeople)('app-id', 'secret')];
                case 1:
                    result = _c.sent();
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(2);
                    (0, vitest_1.expect)(result).toHaveLength(2);
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.id).toBe('p1');
                    (0, vitest_1.expect)((_b = result[1]) === null || _b === void 0 ? void 0 : _b.id).toBe('p2');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('rewrites the absolute PC next-link URL to the proxy path before the second fetch', function () { return __awaiter(void 0, void 0, void 0, function () {
        var page1, page2, secondUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    page1 = {
                        data: [{ id: 'p1', attributes: { name: 'Ann Lee' } }],
                        links: {
                            self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=0',
                            next: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
                        },
                    };
                    page2 = {
                        data: [{ id: 'p2', attributes: { name: 'Bo Ray' } }],
                        links: { self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100' },
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAllPeople)('app-id', 'secret')];
                case 1:
                    _a.sent();
                    secondUrl = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    (0, vitest_1.expect)(secondUrl).not.toContain('api.planningcenteronline.com');
                    (0, vitest_1.expect)(secondUrl).toContain('/api/planningcenter/services/v2/people');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('retries a 429 response respecting Retry-After, then succeeds', function () { return __awaiter(void 0, void 0, void 0, function () {
        var okResponse, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    okResponse = {
                        data: [{ id: 'p1', attributes: { name: 'Ann Lee' } }],
                        links: { self: 'https://api.planningcenteronline.com/services/v2/people' },
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '0' } }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAllPeople)('app-id', 'secret')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(2);
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.id).toBe('p1');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws when the final response is not ok', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchAllPeople)('app-id', 'secret')).rejects.toThrow('Failed to fetch people: 500')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchPeopleForTeamPositions', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    (0, vitest_1.it)('filters by selectedPositionIds, dedupes a person on two selected positions, and paginates across pages', function () { return __awaiter(void 0, void 0, void 0, function () {
        var page1, page2, result, firstUrl, secondUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    page1 = {
                        data: [
                            { id: 'a1', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS1' } } } },
                            { id: 'a2', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS2' } } } },
                            { id: 'a3', relationships: { person: { data: { id: 'p2' } }, team_position: { data: { id: 'POS_UNSELECTED' } } } },
                        ],
                        included: [
                            { type: 'Person', id: 'p1', attributes: { name: 'Ann Lee' } },
                            { type: 'Person', id: 'p2', attributes: { name: 'Bo Ray' } },
                        ],
                        links: {
                            self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=0',
                            next: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=100',
                        },
                    };
                    page2 = {
                        data: [
                            { id: 'a4', relationships: { person: { data: { id: 'p3' } }, team_position: { data: { id: 'POS1' } } } },
                        ],
                        included: [{ type: 'Person', id: 'p3', attributes: { name: 'Cy Doe' } }],
                        links: {
                            self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=100',
                        },
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
                        // Per-person email lookups (batched) after pagination — Map order: p1, p3
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'ann@example.com' } }] }), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'cy@example.com' } }] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPeopleForTeamPositions)('app', 'sec', 'TEAM1', new Set(['POS1', 'POS2']))
                        // 2 assignment pages + 2 per-person email lookups
                    ];
                case 1:
                    result = _a.sent();
                    // 2 assignment pages + 2 per-person email lookups
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(4);
                    firstUrl = vitest_1.vi.mocked(fetch).mock.calls[0][0];
                    (0, vitest_1.expect)(firstUrl).toContain('/teams/TEAM1/person_team_position_assignments');
                    (0, vitest_1.expect)(firstUrl).toContain('include=person');
                    secondUrl = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    (0, vitest_1.expect)(secondUrl).not.toContain('api.planningcenteronline.com');
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch).mock.calls[2][0]).toContain('/people/p1/emails');
                    (0, vitest_1.expect)(result).toHaveLength(2);
                    (0, vitest_1.expect)(result).toEqual(vitest_1.expect.arrayContaining([
                        { pcPersonId: 'p1', name: 'Ann Lee', email: 'ann@example.com' },
                        { pcPersonId: 'p3', name: 'Cy Doe', email: 'cy@example.com' },
                    ]));
                    (0, vitest_1.expect)(result.find(function (r) { return r.pcPersonId === 'p2'; })).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('retries a 429 response respecting Retry-After, then succeeds', function () { return __awaiter(void 0, void 0, void 0, function () {
        var okPayload, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    okPayload = {
                        data: [
                            { id: 'a1', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS1' } } } },
                        ],
                        included: [{ type: 'Person', id: 'p1', attributes: { name: 'Ann Lee' } }],
                        links: { self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments' },
                    };
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '0' } }))
                        .mockResolvedValueOnce(new Response(JSON.stringify(okPayload), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'ann@example.com' } }] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchPeopleForTeamPositions)('app', 'sec', 'TEAM1', new Set(['POS1']))
                        // 429 retry + ok assignment page + 1 per-person email lookup
                    ];
                case 1:
                    result = _a.sent();
                    // 429 retry + ok assignment page + 1 per-person email lookup
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(3);
                    (0, vitest_1.expect)(result).toEqual([{ pcPersonId: 'p1', name: 'Ann Lee', email: 'ann@example.com' }]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('throws when the final response is not ok', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
                    return [4 /*yield*/, (0, vitest_1.expect)((0, planningCenterApi_1.fetchPeopleForTeamPositions)('app', 'sec', 'TEAM1', new Set(['POS1']))).rejects.toThrow('Failed to fetch team position assignments: 500')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('mapPcPersonToUpsert', function () {
    (0, vitest_1.it)('builds name from attributes.name when present', function () {
        var person = { id: 'p1', attributes: { name: 'Ann Lee', first_name: 'Ann', last_name: 'Lee' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, ['ann@example.com']);
        (0, vitest_1.expect)(result.name).toBe('Ann Lee');
    });
    (0, vitest_1.it)('builds name from first_name + last_name trimmed when attributes.name is absent', function () {
        var person = { id: 'p2', attributes: { first_name: 'Bo', last_name: 'Ray' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, []);
        (0, vitest_1.expect)(result.name).toBe('Bo Ray');
    });
    (0, vitest_1.it)('sets email from the first supplied email', function () {
        var person = { id: 'p3', attributes: { name: 'Cy Doe' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, ['cy@example.com', 'other@example.com']);
        (0, vitest_1.expect)(result.email).toBe('cy@example.com');
    });
    (0, vitest_1.it)('yields email "" (no throw) when emails array is empty', function () {
        var person = { id: 'p4', attributes: { name: 'Dee Fox' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, []);
        (0, vitest_1.expect)(result.email).toBe('');
    });
    (0, vitest_1.it)('sets phone to "" ALWAYS', function () {
        var person = { id: 'p5', attributes: { name: 'Eli Gray' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, ['eli@example.com']);
        (0, vitest_1.expect)(result.phone).toBe('');
    });
    (0, vitest_1.it)('sets pcPersonId to the person id', function () {
        var person = { id: 'pc-99', attributes: { name: 'Fay Hall' } };
        var result = (0, planningCenterApi_1.mapPcPersonToUpsert)(person, []);
        (0, vitest_1.expect)(result.pcPersonId).toBe('pc-99');
    });
});
(0, vitest_1.describe)('fetchAndMapPeople', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn());
    });
    function makePeopleListResponse(count) {
        return {
            data: Array.from({ length: count }, function (_, i) { return ({
                id: "p".concat(i + 1),
                attributes: { name: "Person ".concat(i + 1) },
            }); }),
            links: { self: 'https://api.planningcenteronline.com/services/v2/people' },
        };
    }
    (0, vitest_1.it)('fetches all people then their emails, returning UpsertPersonInput[] with name+email and phone ""', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, emailsUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 })) // people list
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'p1@example.com' } }] }), { status: 200 })); // p1 emails
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAndMapPeople)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    (0, vitest_1.expect)(result[0]).toEqual({
                        name: 'Person 1',
                        email: 'p1@example.com',
                        phone: '',
                        pcPersonId: 'p1',
                    });
                    emailsUrl = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    (0, vitest_1.expect)(emailsUrl).toContain('/people/p1/emails');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('reads the email address from the "address" attribute', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'someone@example.com' } }] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAndMapPeople)('app-id', 'secret')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.email).toBe('someone@example.com');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('yields email "" and still includes the person when the emails endpoint returns empty data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    vitest_1.vi.mocked(fetch)
                        .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 }))
                        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAndMapPeople)('app-id', 'secret')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.email).toBe('');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('issues email fetches in batches of 3 and returns one UpsertPersonInput per fetched person (no silent drops)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var i, result, batch1Call1, batch1Call2, batch1Call3, batch2Call1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(4)), { status: 200 }));
                    // 4 subsequent email fetches — one per person, in call order p1..p4
                    for (i = 1; i <= 4; i++) {
                        vitest_1.vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: "p".concat(i, "@example.com") } }] }), { status: 200 }));
                    }
                    return [4 /*yield*/, (0, planningCenterApi_1.fetchAndMapPeople)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toHaveLength(4);
                    // 1 people-list call + 4 email calls
                    (0, vitest_1.expect)(vitest_1.vi.mocked(fetch)).toHaveBeenCalledTimes(5);
                    batch1Call1 = vitest_1.vi.mocked(fetch).mock.calls[1][0];
                    batch1Call2 = vitest_1.vi.mocked(fetch).mock.calls[2][0];
                    batch1Call3 = vitest_1.vi.mocked(fetch).mock.calls[3][0];
                    batch2Call1 = vitest_1.vi.mocked(fetch).mock.calls[4][0];
                    (0, vitest_1.expect)(batch1Call1).toContain('/people/p1/emails');
                    (0, vitest_1.expect)(batch1Call2).toContain('/people/p2/emails');
                    (0, vitest_1.expect)(batch1Call3).toContain('/people/p3/emails');
                    (0, vitest_1.expect)(batch2Call1).toContain('/people/p4/emails');
                    return [2 /*return*/];
            }
        });
    }); });
});
