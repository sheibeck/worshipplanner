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
exports.RESERVED_SLUGS = void 0;
exports.deriveSlug = deriveSlug;
exports.claimSlug = claimSlug;
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
/**
 * Derive a URL-safe slug from an organization name: lowercase, hyphenated,
 * with any run of non-alphanumeric characters collapsed to a single hyphen
 * and leading/trailing hyphens trimmed. Pure — no imports, cannot throw.
 */
function deriveSlug(orgName) {
    return orgName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
// Reserved app path segments (D-19) — a slug matching one of these would let
// an org's memorable URL be silently shadowed by an existing static route
// (Vue Router ranks static routes above dynamic ones). Must be checked
// before any claim write is attempted, not relied on at routing time.
exports.RESERVED_SLUGS = new Set([
    'songs',
    'roster',
    'volunteers',
    'schedule',
    'services',
    'team',
    'admins',
    'settings',
    'login',
    'share',
    'quarter-share',
    'public',
]);
/**
 * Claim a unique org slug via a create-only Firestore write against
 * orgSlugs/{candidate}. Reserved words are pre-filtered before any write —
 * a reserved candidate skips straight to the first numeric-suffixed
 * candidate. On a permission-denied error (existing doc → the rules deny
 * the implicit "update"), retries with the next numeric suffix
 * (base-2, base-3, …) until a candidate writes successfully.
 */
function claimSlug(baseSlug, orgId) {
    return __awaiter(this, void 0, Promise, function () {
        var suffix, candidate, err_1, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    suffix = 1;
                    _a.label = 1;
                case 1:
                    candidate = suffix === 1 ? baseSlug : "".concat(baseSlug, "-").concat(suffix);
                    if (exports.RESERVED_SLUGS.has(candidate)) {
                        suffix += 1;
                        return [3 /*break*/, 5];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(firebase_1.db, 'orgSlugs', candidate), { orgId: orgId })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, candidate];
                case 4:
                    err_1 = _a.sent();
                    code = err_1 === null || err_1 === void 0 ? void 0 : err_1.code;
                    if (code === 'permission-denied') {
                        suffix += 1;
                        return [3 /*break*/, 5];
                    }
                    throw err_1;
                case 5: return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
