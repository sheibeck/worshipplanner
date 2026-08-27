/**
 * Shared musical key lists used by ArrangementAccordion's Key <select> and
 * SongSlideOver's Key <input list>+<datalist> typeahead (R258). Single source
 * of truth so both surfaces stay in sync — values and order are byte-identical
 * to the literals that previously lived inline in ArrangementAccordion.vue.
 */
export const MAJOR_KEYS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

export const MINOR_KEYS = [
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm',
] as const
