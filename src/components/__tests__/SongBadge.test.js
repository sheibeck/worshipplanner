"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var test_utils_1 = require("@vue/test-utils");
var SongBadge_vue_1 = require("../SongBadge.vue");
(0, vitest_1.describe)('SongBadge', function () {
    (0, vitest_1.describe)('VW type 1', function () {
        (0, vitest_1.it)('renders "Type 1" text', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [1] } });
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 1');
        });
        (0, vitest_1.it)('has blue styling classes', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [1] } });
            var span = wrapper.find('span.bg-blue-900\\/50');
            (0, vitest_1.expect)(span.classes()).toContain('bg-blue-900/50');
            (0, vitest_1.expect)(span.classes()).toContain('text-blue-300');
            (0, vitest_1.expect)(span.classes()).toContain('border-blue-800');
        });
    });
    (0, vitest_1.describe)('VW type 2', function () {
        (0, vitest_1.it)('renders "Type 2" text', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [2] } });
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 2');
        });
        (0, vitest_1.it)('has purple styling classes', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [2] } });
            var span = wrapper.find('span.bg-purple-900\\/50');
            (0, vitest_1.expect)(span.classes()).toContain('bg-purple-900/50');
            (0, vitest_1.expect)(span.classes()).toContain('text-purple-300');
            (0, vitest_1.expect)(span.classes()).toContain('border-purple-800');
        });
    });
    (0, vitest_1.describe)('VW type 3', function () {
        (0, vitest_1.it)('renders "Type 3" text', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [3] } });
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 3');
        });
        (0, vitest_1.it)('has amber styling classes', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [3] } });
            var span = wrapper.find('span.bg-amber-900\\/50');
            (0, vitest_1.expect)(span.classes()).toContain('bg-amber-900/50');
            (0, vitest_1.expect)(span.classes()).toContain('text-amber-300');
            (0, vitest_1.expect)(span.classes()).toContain('border-amber-800');
        });
    });
    (0, vitest_1.describe)('empty types array (uncategorized)', function () {
        (0, vitest_1.it)('renders a muted dash badge when types is empty', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [] } });
            (0, vitest_1.expect)(wrapper.find('span').exists()).toBe(true);
            // Should not render "Type" text
            (0, vitest_1.expect)(wrapper.text()).not.toContain('Type');
        });
        (0, vitest_1.it)('has muted gray styling classes', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [] } });
            var span = wrapper.find('span.bg-gray-800');
            (0, vitest_1.expect)(span.classes()).toContain('bg-gray-800');
            (0, vitest_1.expect)(span.classes()).toContain('text-gray-500');
            (0, vitest_1.expect)(span.classes()).toContain('border-gray-700');
        });
    });
    (0, vitest_1.describe)('multiple types', function () {
        (0, vitest_1.it)('renders two badge spans for types [1, 2]', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [1, 2] } });
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 1');
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 2');
            var badges = wrapper.findAll('span.border');
            (0, vitest_1.expect)(badges).toHaveLength(2);
        });
        (0, vitest_1.it)('renders three badge spans for types [1, 2, 3]', function () {
            var wrapper = (0, test_utils_1.mount)(SongBadge_vue_1.default, { props: { types: [1, 2, 3] } });
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 1');
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 2');
            (0, vitest_1.expect)(wrapper.text()).toContain('Type 3');
        });
    });
});
