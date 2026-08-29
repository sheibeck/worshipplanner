- [97-06] Out-of-scope type error in src/components/run/RunFilmstrip.vue(22,30) TS2345 (number|undefined) — owned by a concurrent wave-2 plan (97-04/05/07), NOT touched by 97-06. Not fixed here per plan's disjoint-files rule.

## From 97-04 (2026-08-29)
- `vue-tsc --build` reports 5 TS errors in RunFilmstrip.vue / RunFilmstrip.test.ts — owned by a concurrent wave-2 plan (97-05/06/07), NOT 97-04. Left untouched per scope boundary.
