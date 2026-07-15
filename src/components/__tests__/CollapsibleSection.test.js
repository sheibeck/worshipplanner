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
var CollapsibleSection_vue_1 = require("../CollapsibleSection.vue");
(0, vitest_1.describe)('CollapsibleSection', function () {
    (0, vitest_1.beforeEach)(function () {
        localStorage.clear();
    });
    (0, vitest_1.it)('defaults to expanded (body slot visible) when no localStorage value exists (D-17)', function () {
        var wrapper = (0, test_utils_1.mount)(CollapsibleSection_vue_1.default, {
            props: { title: 'Volunteer Availability', storageKey: 'schedule.section.volunteerAvailability' },
            slots: { default: '<p>Body content</p>' },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Volunteer Availability');
        (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(true);
        (0, vitest_1.expect)(wrapper.text()).toContain('Body content');
    });
    (0, vitest_1.it)('clicking the header collapses the body and writes "closed" to localStorage', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wrapper = (0, test_utils_1.mount)(CollapsibleSection_vue_1.default, {
                        props: { title: 'Service dates', storageKey: 'schedule.section.serviceDates' },
                        slots: { default: '<p>Body content</p>' },
                    });
                    (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(true);
                    return [4 /*yield*/, wrapper.find('[data-role="collapsible-header"]').trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(false);
                    (0, vitest_1.expect)(localStorage.getItem('schedule.section.serviceDates')).toBe('closed');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('remounting with a "closed" localStorage value starts collapsed', function () {
        localStorage.setItem('schedule.section.generateControls', 'closed');
        var wrapper = (0, test_utils_1.mount)(CollapsibleSection_vue_1.default, {
            props: { title: 'Generate controls', storageKey: 'schedule.section.generateControls' },
            slots: { default: '<p>Body content</p>' },
        });
        (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(false);
    });
    (0, vitest_1.it)('clicking again on a collapsed section re-expands it and writes "open" to localStorage', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    localStorage.setItem('schedule.section.generateControls', 'closed');
                    wrapper = (0, test_utils_1.mount)(CollapsibleSection_vue_1.default, {
                        props: { title: 'Generate controls', storageKey: 'schedule.section.generateControls' },
                        slots: { default: '<p>Body content</p>' },
                    });
                    (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(false);
                    return [4 /*yield*/, wrapper.find('[data-role="collapsible-header"]').trigger('click')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.find('p').exists()).toBe(true);
                    (0, vitest_1.expect)(localStorage.getItem('schedule.section.generateControls')).toBe('open');
                    return [2 /*return*/];
            }
        });
    }); });
});
