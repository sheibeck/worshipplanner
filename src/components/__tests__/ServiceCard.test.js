"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var test_utils_1 = require("@vue/test-utils");
var ServiceCard_vue_1 = require("../ServiceCard.vue");
vitest_1.vi.mock('vue-router', function () { return ({
    useRouter: function () { return ({
        push: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    }); },
}); });
vitest_1.vi.mock('@/stores/services', function () { return ({
    useServiceStore: function () { return ({
        orgId: 'org-1',
        createShareToken: vitest_1.vi.fn(function () { return Promise.resolve('mock-token'); }),
    }); },
}); });
vitest_1.vi.mock('@/stores/songs', function () { return ({
    useSongStore: function () { return ({
        songs: [],
    }); },
}); });
var mockTimestamp = { toDate: function () { return new Date('2026-03-04'); } };
var mockService = {
    id: 'svc-001',
    date: '2026-03-08',
    name: '',
    progression: '1-2-2-3',
    teams: ['Choir'],
    status: 'draft',
    slots: [
        {
            kind: 'SONG',
            position: 1,
            requiredVwType: 1,
            songId: 'song-1',
            songTitle: 'Amazing Grace',
            songKey: 'G',
        },
        {
            kind: 'SONG',
            position: 2,
            requiredVwType: 2,
            songId: null,
            songTitle: null,
            songKey: null,
        },
        {
            kind: 'SONG',
            position: 3,
            requiredVwType: 2,
            songId: 'song-3',
            songTitle: 'Holy Holy Holy',
            songKey: 'E',
        },
        { kind: 'PRAYER', position: 4 },
        { kind: 'MESSAGE', position: 5 },
    ],
    sermonPassage: null,
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
};
var globalStubs = {
    'router-link': {
        template: '<a :href="to"><slot /></a>',
        props: ['to'],
    },
};
(0, vitest_1.describe)('ServiceCard', function () {
    (0, vitest_1.it)('renders formatted date with month and day', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Mar');
        (0, vitest_1.expect)(wrapper.text()).toContain('8');
    });
    (0, vitest_1.it)('renders Message in slot summary', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Message');
    });
    (0, vitest_1.it)('renders song titles from filled song slots', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Amazing Grace');
        (0, vitest_1.expect)(wrapper.text()).toContain('Holy Holy Holy');
    });
    (0, vitest_1.it)('renders "Empty" for unfilled song slots', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Empty');
    });
    (0, vitest_1.it)('renders status badge text', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('draft');
    });
    (0, vitest_1.it)('links to the correct /services/:id URL', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        var link = wrapper.find('a');
        (0, vitest_1.expect)(link.exists()).toBe(true);
        (0, vitest_1.expect)(link.attributes('href')).toBe('/services/svc-001');
    });
    (0, vitest_1.it)('uses flex-col layout with pinned footer', function () {
        var wrapper = (0, test_utils_1.mount)(ServiceCard_vue_1.default, {
            props: { service: mockService },
            global: { stubs: globalStubs },
        });
        // Root element uses flex column layout
        var root = wrapper.element;
        (0, vitest_1.expect)(root.className).toContain('flex');
        (0, vitest_1.expect)(root.className).toContain('flex-col');
        (0, vitest_1.expect)(root.className).toContain('h-full');
        // Body area grows to fill space
        var body = wrapper.find('a');
        (0, vitest_1.expect)(body.classes()).toContain('flex-1');
        // Footer does not shrink
        var footer = wrapper.find('[title="Share"]').element.closest('div');
        (0, vitest_1.expect)(footer.className).toContain('shrink-0');
    });
});
