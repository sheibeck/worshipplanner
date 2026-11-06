# 0249. New services start with a default rehearsal that follows the service date

## Status

Accepted; supersedes ADR-0245 (b) and the reversed parts of ADR-0245 (a)

## Context

Owner decisions of 2026-11-06 (R459-R465), promoted from backlog 999.15. The Times tab asked for a date every time, for a rehearsal that lands on the same weekday nearly every week. Saving a date change never worked, because `onSave` has an allow-list that never held `date`.

## Decision

- **(a) New services start with one rehearsal.** This supersedes ADR-0245 (b). `createService` adds one rehearsal when a default day and a usable first default time are set, and writes `rehearsals: []` otherwise.
- **(b) The add form pre-fills the default date.** This supersedes the parts of ADR-0245 (a) that said a rehearsal is created only by the Times-tab add form, and that its date is always picked by the planner. ADR-0245 (c)-(f) stand.
- **(c) The marker is a row flag, `autoAdded: true`, not a service-level id.** It rides the persisted `rehearsals` array, needs no new `onSave` plumbing, and leaves with the row on Remove. A service-level id would need both the payload and the mirror, and would dangle after Remove. Absent means not auto-added; clearing uses `delete`, so an edited row is byte-identical to a hand-added one.
- **(d) The weekday is stored as `number | null`, 0 Sunday to 6 Saturday.** It matches `getUTCDay()` and keeps Sunday distinct from none. Always read it through `normalizeWeekday`, never by truthiness.
- **(e) Calendar maths is UTC arithmetic on the `YYYY-MM-DD` text,** the ADR-0009 convention, because local construction is off by a day at UTC-11 and UTC+14. A moved rehearsal takes its weekday from its own date, not from Settings. A day-delta shift was rejected because it breaks the weekday when a move is not a whole number of weeks.
- **(f) One shared `toPublicRehearsal` narrows rows in both projections,** so the two cannot drift. It is used nowhere else, since it would strip the marker from the editor's rows.
- **(g) A changed service date is now saved.** `date` is in the `onSave` payload and in the mirror comparison, at the same key position, per ADR-0235.
- **(h) When a date changes, `updateService` removes `serviceShares/{slug}__service-{oldDate}`.** It keys on a real change, because `onSave` now sends `date` on every save. The old date comes from the local cache, or from one direct read before the write when a dated write misses the cache; after the write the doc would already hold the new date. The removal runs after the service write and the share refresh, and only once the new date's doc exists and records this service, because `writeSharePayload` soft-fails the memorable write internally, so ordering alone proves nothing. It keeps the ADR-0163 ownership guard and soft-fails, like the other share writes. The token link is untouched.
- **(i) Undo restores the whole snapshot** (owner decision, 2026-11-06), so the date, the rehearsals and the marker return together. This is the one way a marker comes back after an edit: undoing means the edit never happened. The rule that an edit ends auto-moving for good covers setting a value back by hand.

## Consequences

The Rules are unchanged, and an editor could forge the flag, which is harmless because it only decides auto-moving on that one service. If the new page cannot be written or the removal fails, the old page stays and no later save retries, because the old date is gone by then. On a local cache miss the share refresh does not run, so the new page usually does not exist and the old page stays. Two services on one date still share one memorable page, so moving the one the page records removes it until the other's next save writes it again. The owner accepts this (AC-RHD-68), and the other service's token link is unaffected. The Planning Center export's hard-coded rehearsal is unchanged.

- Autosave writes the whole document, so a stale second tab with unsaved edits can write back the old date and rows. `date` always travels with `rehearsals`, so that write stays consistent.

## Source comments

- `src/utils/rehearsalTimes.ts`
- `src/types/organization.ts`
- `src/types/service.ts`
- `src/stores/services.ts` (`createService`, `updateService`)
- `src/views/SettingsView.vue`
- `src/components/ServiceTimesPanel.vue`
- `src/views/ServiceEditorView.vue`
