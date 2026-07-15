"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLES = void 0;
// D-03 default role list, grouped. Leaders self-assign and are intentionally excluded (D-05).
// DEFAULT_ROLES omits `id` (assigned by Firestore on seed). Default counts are Claude's discretion — use 1 each.
exports.DEFAULT_ROLES = [
    { name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
    { name: 'drums', group: 'band', defaultCount: 1, order: 1 },
    { name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
    { name: 'bass', group: 'band', defaultCount: 1, order: 3 },
    { name: 'sound', group: 'tech', defaultCount: 1, order: 4 },
    { name: 'livestream', group: 'tech', defaultCount: 1, order: 5 },
    { name: 'projection', group: 'tech', defaultCount: 1, order: 6 },
    { name: 'scripture reader', group: 'other', defaultCount: 1, order: 7 },
];
