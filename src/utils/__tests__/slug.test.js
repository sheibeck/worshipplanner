"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
// deriveSlug/RESERVED_SLUGS are pure; claimSlug's Firestore create-only retry
// semantics are covered by the emulator-backed rules test (Task 2) — mock the
// Firestore/firebase modules here purely to avoid real Firebase app init at
// import time (`@/firebase`'s getAuth() throws on an invalid test API key).
vitest_1.vi.mock('firebase/firestore', function () { return ({
    doc: vitest_1.vi.fn(),
    setDoc: vitest_1.vi.fn(),
}); });
vitest_1.vi.mock('@/firebase', function () { return ({
    db: {},
}); });
var slug_1 = require("@/utils/slug");
(0, vitest_1.describe)('deriveSlug', function () {
    (0, vitest_1.it)('lowercases and hyphenates a simple org name', function () {
        (0, vitest_1.expect)((0, slug_1.deriveSlug)('Grace Church')).toBe('grace-church');
    });
    (0, vitest_1.it)('strips non-alphanumerics to [a-z0-9-]+ only', function () {
        (0, vitest_1.expect)((0, slug_1.deriveSlug)("St. Paul's Community Church!")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        (0, vitest_1.expect)((0, slug_1.deriveSlug)("St. Paul's Community Church!")).toBe('st-paul-s-community-church');
    });
    (0, vitest_1.it)('trims leading/trailing hyphens produced by leading/trailing punctuation', function () {
        (0, vitest_1.expect)((0, slug_1.deriveSlug)('  --Grace Church--  ')).toBe('grace-church');
    });
    (0, vitest_1.it)('collapses runs of non-alphanumeric characters into a single hyphen', function () {
        (0, vitest_1.expect)((0, slug_1.deriveSlug)('Grace   &&&   Church')).toBe('grace-church');
    });
    (0, vitest_1.it)('matches the sanitization contract for arbitrary mixed input', function () {
        var result = (0, slug_1.deriveSlug)('123 Main St. Fellowship (East Campus)');
        (0, vitest_1.expect)(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });
    (0, vitest_1.it)('a reserved word input derives to a value present in RESERVED_SLUGS', function () {
        var result = (0, slug_1.deriveSlug)('Settings');
        (0, vitest_1.expect)(result).toBe('settings');
        (0, vitest_1.expect)(slug_1.RESERVED_SLUGS.has(result)).toBe(true);
    });
});
(0, vitest_1.describe)('RESERVED_SLUGS', function () {
    (0, vitest_1.it)('contains all 12 reserved segments from D-19 (plus renamed /volunteers, /admins routes)', function () {
        var expected = [
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
        ];
        (0, vitest_1.expect)(slug_1.RESERVED_SLUGS.size).toBe(12);
        for (var _i = 0, expected_1 = expected; _i < expected_1.length; _i++) {
            var word = expected_1[_i];
            (0, vitest_1.expect)(slug_1.RESERVED_SLUGS.has(word)).toBe(true);
        }
    });
});
