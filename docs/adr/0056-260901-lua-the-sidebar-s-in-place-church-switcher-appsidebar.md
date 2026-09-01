# 0056. 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->

## Status

Accepted

## Context

This rationale is applied consistently at 7 call site(s) across 7 files: `src/components/GettingStarted.vue`, `src/views/DashboardView.vue`, `src/views/QuarterView.vue`, `src/views/RosterView.vue`, `src/views/ServicesView.vue`, `src/views/SongsView.vue`, `src/views/TeamView.vue`. Documented at the time in `104-REVIEW`.

260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe (guarded by `if (!store.orgId)`, whic...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/components/GettingStarted.vue:119-125`:**

```

// 104-REVIEW CR-01: the sidebar's in-place church switcher changes
// authStore.orgId without a route change/remount (this panel stays mounted
// across a switch on the Dashboard), so the member-count listener must react
// to the org id itself rather than only reading it once in onMounted —
// otherwise it keeps counting the previous church's members after a switch.
// `immediate: true` replaces the old onMounted-only subscribe.
```

**`src/views/DashboardView.vue:275-285`:**

```
// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe (guarded by `if (!store.orgId)`,
// which would also defeat re-subscription since resetOrgScopedStores() nulls
// orgId before this fires) never re-points the shared stores on switch.
// Watching with `immediate: true` replaces the onMounted-only subscribe
// (mirrors TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the
// watcher hands in — never a mount-time captured value — so no write can land
// on the wrong church. Dashboard shares these stores with other views and has
// no onUnmounted of its own; the unsubscribe-then-resubscribe here is
// idempotent and null-guarded.
```

**`src/views/QuarterView.vue:844-851`, `src/views/SongsView.vue:352-359`:**

```

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch. Watching
// with `immediate: true` replaces the old onMounted-only subscribe (mirrors
// TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the watcher
// hands in — never a mount-time captured value — so no write can land on the
// wrong church.
```

**`src/views/RosterView.vue:759-767`:**

```

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch. Watching
// with `immediate: true` replaces the old onMounted-only subscribe (mirrors
// TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the watcher
// hands in — never a mount-time captured value — so no write can land on the
// wrong church. Stop any prior seed watches first so a switch never leaks the
// old church's seed watchers.
```

**`src/views/ServicesView.vue:381-388`:**

```

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch and this
// view sticks on "Loading services…" forever. Watching with `immediate: true`
// replaces the old onMounted-only subscribe (mirrors TeamView.vue 104-REVIEW
// CR-01). Always pass the LIVE new orgId the watcher hands in — never a
// mount-time captured value — so no write can land on the wrong church.
```

**`src/views/TeamView.vue:520-528`:**

```

// 104-REVIEW CR-01: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so this view's own onSnapshot listeners — not covered by
// resetOrgScopedStores(), which only knows about the Pinia store layer — must
// react to the org id themselves instead of reading it once. Watching with
// `immediate: true` replaces the old onMounted-only subscribe and guarantees a
// switch tears down the previous church's listeners before pointing new ones
// at the newly-selected church.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/GettingStarted.vue:119-125`
- `src/views/DashboardView.vue:275-285`
- `src/views/QuarterView.vue:844-851`
- `src/views/RosterView.vue:759-767`
- `src/views/ServicesView.vue:381-388`
- `src/views/SongsView.vue:352-359`
- `src/views/TeamView.vue:520-528`
