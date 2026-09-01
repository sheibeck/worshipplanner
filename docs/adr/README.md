# Architecture Decision Records

This directory holds MADR-lite ADRs extracted from decision-rationale (`R-`/`WR-`/`CR-`/`Pitfall`-tagged)
source comments during Phase 108 (Comment Audit & Decision-Rationale Extraction, R317). Each ADR carries
the "why" that previously lived inline in code comments; the source comment is now reduced to a short
pointer of the form `// See ADR-NNNN (docs/adr/NNNN-title.md)`.

## Template (MADR-lite)

Each ADR file carries five second-level headings, in this order: **Title** (as the H1), **Status**
(Accepted | Superseded | Deprecated), **Context** (what problem or constraint prompted this
decision), **Decision** (what was decided, and where useful, the rejected alternatives), and
**Consequences** (tradeoffs, gotchas, and what re-opens if this decision is reversed without
re-deriving the rationale). Plus an optional **Source comments** backlink list of
`path/to/file.ts:START-END` references.

## Index

| ID | Title | Status |
|----|-------|--------|
| ADR-0001 | [Super-admin explicitly enables it. Written ONLY by the](./0001-super-admin-explicitly-enables-it-written-only-by-the.md) | Accepted |
| ADR-0002 | [AiMasterEnabled's own audit-trail siblings](./0002-aimasterenabled-s-own-audit-trail-siblings.md) | Accepted |
| ADR-0003 | [R233/T-80-02/T-80-03: createdBy is a provenance/audit field that must](./0003-r233-t-80-02-t-80-03-createdby-is-a-provenance-audit-field-t.md) | Accepted |
| ADR-0004 | [Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy](./0004-flow-1-org-creation-cr-01-getafter-alone-only-proves-created.md) | Accepted |
| ADR-0005 | [Legitimate deletion path. It exists solely to close the client-side](./0005-legitimate-deletion-path-it-exists-solely-to-close-the-clien.md) | Accepted |
| ADR-0006 | [Was isSignedIn() with no org check. Phase 41's adoption logic](./0006-was-issignedin-with-no-org-check-phase-41-s-adoption-logic.md) | Accepted |
| ADR-0007 | [Org slug claims: public read, org-editor-scoped create-only](./0007-org-slug-claims-public-read-org-editor-scoped-create-only.md) | Accepted |
| ADR-0008 | [Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's](./0008-mirrors-readnumericknob-s-zero-vs-falsy-discipline-index-ts.md) | Accepted |
| ADR-0009 | [The single shared calendar-date parse convention for a Service.date](./0009-the-single-shared-calendar-date-parse-convention-for-a-servi.md) | Accepted |
| ADR-0010 | [A missing/malformed date used to fall through as data.date ?? ""](./0010-a-missing-malformed-date-used-to-fall-through-as-data-date.md) | Accepted |
| ADR-0011 | [Decision.action is "skip" (reason "not-primary-org" or](./0011-decision-action-is-skip-reason-not-primary-org-or.md) | Accepted |
| ADR-0012 | [The ~1000-byte custom-claims cap throws auth/claims-too-large -- give](./0012-the-1000-byte-custom-claims-cap-throws-auth-claims-too-large.md) | Accepted |
| ADR-0013 | [Node lib/backfillOrgClaims.js # dry run (default) node](./0013-node-lib-backfillorgclaims-js-dry-run-default-node.md) | Accepted |
| ADR-0014 | [Requires no pre-existing super-admin. RESOLVES BY EMAIL: exactly like](./0014-requires-no-pre-existing-super-admin-resolves-by-email-exact.md) | Accepted |
| ADR-0015 | [Node lib/bootstrapSuperAdmin.js --email owner@example.com # dry run](./0015-node-lib-bootstrapsuperadmin-js-email-owner-example-com-dry.md) | Accepted |
| ADR-0016 | [Two call sites this module was extracted to fix. No try/catch here](./0016-two-call-sites-this-module-was-extracted-to-fix-no-try-catch.md) | Accepted |
| ADR-0017 | [The atomic counterpart to calling clearClaimKeys then](./0017-the-atomic-counterpart-to-calling-clearclaimkeys-then.md) | Accepted |
| ADR-0018 | [Patches (or deletes) ONE key inside a NESTED map claim (e.g](./0018-patches-or-deletes-one-key-inside-a-nested-map-claim-e-g.md) | Accepted |
| ADR-0019 | [NLT auth travels as a key QUERY PARAMETER, not a header — unlike the](./0019-nlt-auth-travels-as-a-key-query-parameter-not-a-header-unlik.md) | Accepted |
| ADR-0020 | [Cached form (no {fresh:true}) -- the api handler is a hot request](./0020-cached-form-no-fresh-true-the-api-handler-is-a-hot-request.md) | Accepted |
| ADR-0021 | [R164: an explicit maxInstances ceiling motivated by the highest-cost](./0021-r164-an-explicit-maxinstances-ceiling-motivated-by-the-highe.md) | Accepted |
| ADR-0022 | [Reject a streamed request outright rather than forward it](./0022-reject-a-streamed-request-outright-rather-than-forward-it.md) | Accepted |
| ADR-0023 | [PROJECTED check, not a check against the pre-send count](./0023-projected-check-not-a-check-against-the-pre-send-count.md) | Accepted |
| ADR-0024 | [-- a disabled org must never reach even the cheapest of those checks](./0024-a-disabled-org-must-never-reach-even-the-cheapest-of-those-c.md) | Accepted |
| ADR-0025 | [Custom metadata (not the GCS-reserved top-level fields) -- Phase 22's](./0025-custom-metadata-not-the-gcs-reserved-top-level-fields-phase.md) | Accepted |
| ADR-0026 | [NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only](./0026-note-orphancount-not-deletedobjectcount-deletedobjectcount-o.md) | Accepted |
| ADR-0027 | [Load the org settings for THIS org (cached). Read settings.messaging](./0027-load-the-org-settings-for-this-org-cached-read-settings-mess.md) | Accepted |
| ADR-0028 | [The send half of the queue-then-trigger path: an onDocumentCreated](./0028-the-send-half-of-the-queue-then-trigger-path-an-ondocumentcr.md) | Accepted |
| ADR-0029 | [(Google-managed, no DNS access). fromDisplayName + bareEmailAddress](./0029-google-managed-no-dns-access-fromdisplayname-bareemailaddres.md) | Accepted |
| ADR-0030 | [The three message-level ids become Resend tags (Pitfall 3). If any is](./0030-the-three-message-level-ids-become-resend-tags-pitfall-3-if.md) | Accepted |
| ADR-0031 | [Read-time compat shim (R250, mirrors src/stores/roster.ts's](./0031-read-time-compat-shim-r250-mirrors-src-stores-roster-ts-s.md) | Accepted |
| ADR-0032 | [R171: per-org daily Resend send quota -- a fixed-window Admin-SDK](./0032-r171-per-org-daily-resend-send-quota-a-fixed-window-admin-sd.md) | Accepted |
| ADR-0033 | [Never stranded (R290, R291). The onboarding.emailsEnabled owner](./0033-never-stranded-r290-r291-the-onboarding-emailsenabled-owner.md) | Accepted |
| ADR-0034 | [Resolve the app's usable share/sign-in base URL, or '' when](./0034-resolve-the-app-s-usable-share-sign-in-base-url-or-when.md) | Accepted |
| ADR-0035 | [Collapse any CR/LF out of a header-bound value (the email subject)](./0035-collapse-any-cr-lf-out-of-a-header-bound-value-the-email-sub.md) | Accepted |
| ADR-0036 | [Bind every provisioning + send to a REAL pending invite record](./0036-bind-every-provisioning-send-to-a-real-pending-invite-record.md) | Accepted |
| ADR-0037 | [Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2](./0037-non-google-branch-resolve-or-create-the-auth-user-first-pitf.md) | Accepted |
| ADR-0038 | [Surface a friendly HttpsError instead of the raw Firebase error](./0038-surface-a-friendly-httpserror-instead-of-the-raw-firebase-er.md) | Accepted |
| ADR-0039 | [Operation in this codebase. It is gated by the SAME](./0039-operation-in-this-codebase-it-is-gated-by-the-same.md) | Accepted |
| ADR-0040 | [T-77-02: the client's echoed confirmName proves nothing on its own](./0040-t-77-02-the-client-s-echoed-confirmname-proves-nothing-on-it.md) | Accepted |
| ADR-0041 | [--- READ phase (Pattern 2 / Pitfall 1): everything below MUST](./0041-read-phase-pattern-2-pitfall-1-everything-below-must.md) | Accepted |
| ADR-0042 | [--- Storage: every object under orgs/{orgId}/ (media, backgrounds](./0042-storage-every-object-under-orgs-orgid-media-backgrounds.md) | Accepted |
| ADR-0043 | [This cascade is comparably or more expensive than parsePptx](./0043-this-cascade-is-comparably-or-more-expensive-than-parsepptx.md) | Accepted |
| ADR-0044 | [Belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a](./0044-belt-and-suspenders-76-review-md-refuse-to-grow-membership-o.md) | Accepted |
| ADR-0045 | [Whether the member document exists AFTER this write. false only for a](./0045-whether-the-member-document-exists-after-this-write-false-on.md) | Accepted |
| ADR-0046 | [Two cases, extended unchanged. The whole body is wrapped in try/catch](./0046-two-cases-extended-unchanged-the-whole-body-is-wrapped-in-tr.md) | Accepted |
| ADR-0047 | [Recomputed from the SAME surviving-org list orgs was just built from](./0047-recomputed-from-the-same-surviving-org-list-orgs-was-just-bu.md) | Accepted |
| ADR-0048 | [A genuine primary-membership delete. Clearing the primary keys and](./0048-a-genuine-primary-membership-delete-clearing-the-primary-key.md) | Accepted |
| ADR-0049 | [Never attempt the revoke after a failed claim patch -- mirrors the](./0049-never-attempt-the-revoke-after-a-failed-claim-patch-mirrors.md) | Accepted |
| ADR-0050 | [Resolves an admin-assignment target by email -- the ONLY network/Auth](./0050-resolves-an-admin-assignment-target-by-email-the-only-networ.md) | Accepted |
| ADR-0051 | [If this admin is already a member of this org, preserve their](./0051-if-this-admin-is-already-a-member-of-this-org-preserve-their.md) | Accepted |
| ADR-0052 | [The testable handler body, exported separately from the onCall](./0052-the-testable-handler-body-exported-separately-from-the-oncal.md) | Accepted |
| ADR-0053 | [The DISABLE branch writes BOTH aiMasterEnabled: false AND](./0053-the-disable-branch-writes-both-aimasterenabled-false-and.md) | Accepted |
| ADR-0054 | [Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open](./0054-mixed-content-heuristic-threshold-21-research-md-pitfall-4-o.md) | Accepted |
| ADR-0055 | [OCR is never enabled -- this phase only needs text/image extraction](./0055-ocr-is-never-enabled-this-phase-only-needs-text-image-extrac.md) | Accepted |
| ADR-0056 | [Grant must be validated as an actual boolean, not branched on with](./0056-grant-must-be-validated-as-an-actual-boolean-not-branched-on.md) | Accepted |
| ADR-0057 | [Per-request-unique profile directory INSIDE the request's own working](./0057-per-request-unique-profile-directory-inside-the-request-s-ow.md) | Accepted |
| ADR-0058 | [Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of](./0058-step-1-pptx-pdf-explicit-timeout-bounds-the-dos-blast-radius.md) | Accepted |
| ADR-0059 | [SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the](./0059-slideactionmenu-vue-s-aria-menu-pattern-reused-verbatim-open.md) | Accepted |
| ADR-0060 | [Push() only arms its auto-dismiss timer when opts is omitted entirely](./0060-push-only-arms-its-auto-dismiss-timer-when-opts-is-omitted-e.md) | Accepted |
| ADR-0061 | [A pause()-interrupted play() rejects with AbortError, not](./0061-a-pause-interrupted-play-rejects-with-aborterror-not.md) | Accepted |
| ADR-0062 | [No preset button is shown active for a non-canonical n, so make the](./0062-no-preset-button-is-shown-active-for-a-non-canonical-n-so-ma.md) | Accepted |
| ADR-0063 | [Click-between-verses divider UX per direct owner feedback: the](./0063-click-between-verses-divider-ux-per-direct-owner-feedback-th.md) | Accepted |
| ADR-0064 | [The refactor to status-branching dropped the generic catch, leaving](./0064-the-refactor-to-status-branching-dropped-the-generic-catch-l.md) | Accepted |
| ADR-0065 | [Same guard as onAiSplit's stampVersion -- the per-item override](./0065-same-guard-as-onaisplit-s-stampversion-the-per-item-override.md) | Accepted |
| ADR-0066 | [260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->](./0066-260901-lua-the-sidebar-s-in-place-church-switcher-appsidebar.md) | Accepted |
| ADR-0067 | [TeamsStore.subscribe()'s onSnapshot is async, so if the dialog](./0067-teamsstore-subscribe-s-onsnapshot-is-async-so-if-the-dialog.md) | Accepted |
| ADR-0068 | [The exit button must stay reachable even if the idle-hide timer has](./0068-the-exit-button-must-stay-reachable-even-if-the-idle-hide-ti.md) | Accepted |
| ADR-0069 | [Change: the provenance helpers in @/utils/scripture and the per-slide](./0069-change-the-provenance-helpers-in-utils-scripture-and-the-per.md) | Accepted |
| ADR-0070 | [── Keyboard — bound on the viewer root only, never window/document](./0070-keyboard-bound-on-the-viewer-root-only-never-window-document.md) | Accepted |
| ADR-0071 | [R094 — the font-load gate. Runs regardless of whether there are](./0071-r094-the-font-load-gate-runs-regardless-of-whether-there-are.md) | Accepted |
| ADR-0072 | [Raw/unfiltered service-date count for the quarter, independent of any](./0072-raw-unfiltered-service-date-count-for-the-quarter-independen.md) | Accepted |
| ADR-0073 | [The pre-Phase-88 inline "Add Role" flow guarded its payload with](./0073-the-pre-phase-88-inline-add-role-flow-guarded-its-payload-wi.md) | Accepted |
| ADR-0074 | [The single shared two-gate AI-affordance check -- mirrors](./0074-the-single-shared-two-gate-ai-affordance-check-mirrors.md) | Accepted |
| ADR-0075 | [AuthStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render](./0075-authstore-isbibleapienabled-wr-01-103-review-so-it-doesn-t-r.md) | Accepted |
| ADR-0076 | [Routed through the scriptureApi.ts dispatcher — the single](./0076-routed-through-the-scriptureapi-ts-dispatcher-the-single.md) | Accepted |
| ADR-0077 | [Test-only seam (matches PptxImportModal.vue's existing defineExpose](./0077-test-only-seam-matches-pptximportmodal-vue-s-existing-define.md) | Accepted |
| ADR-0078 | [Consumer-owned row/list markup — receives the shared tag-filtered](./0078-consumer-owned-row-list-markup-receives-the-shared-tag-filte.md) | Accepted |
| ADR-0079 | [A stable identity per performanceOrder SLOT (not per section id, not](./0079-a-stable-identity-per-performanceorder-slot-not-per-section.md) | Accepted |
| ADR-0080 | [Compare kind too — today the only way a section's kind is set is at](./0080-compare-kind-too-today-the-only-way-a-section-s-kind-is-set.md) | Accepted |
| ADR-0081 | [R117: the write-source complement to sliceSectionIntoSlides's](./0081-r117-the-write-source-complement-to-slicesectionintoslides-s.md) | Accepted |
| ADR-0082 | [Resolve against visibleSongs so a cached suggestion for a](./0082-resolve-against-visiblesongs-so-a-cached-suggestion-for-a.md) | Accepted |
| ADR-0083 | [Renaming orphans the name-keyed reference on every service that](./0083-renaming-orphans-the-name-keyed-reference-on-every-service-t.md) | Accepted |
| ADR-0084 | [Dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate](./0084-dedupe-on-read-see-teamrecurrenceslideover-vue-a-duplicate.md) | Accepted |
| ADR-0085 | [Teams are consumed by NAME everywhere a service selects them (the](./0085-teams-are-consumed-by-name-everywhere-a-service-selects-them.md) | Accepted |
| ADR-0086 | [Deliberately NO rel="noopener". The only current](./0086-deliberately-no-rel-noopener-the-only-current.md) | Accepted |
| ADR-0087 | [NotAllowedError (autoplay policy) and AbortError (the play() request](./0087-notallowederror-autoplay-policy-and-aborterror-the-play-requ.md) | Accepted |
| ADR-0088 | [── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH](./0088-cross-field-rule-ratelimitperday-ratelimitpermin-research.md) | Accepted |
| ADR-0089 | [Mirror of the above (review WR-01): the original cross-field rule was](./0089-mirror-of-the-above-review-wr-01-the-original-cross-field-ru.md) | Accepted |
| ADR-0090 | [The element that had focus immediately before the dialog opened](./0090-the-element-that-had-focus-immediately-before-the-dialog-ope.md) | Accepted |
| ADR-0091 | [Gated on confirming so EVERY dismissal path (backdrop click, panel](./0091-gated-on-confirming-so-every-dismissal-path-backdrop-click-p.md) | Accepted |
| ADR-0092 | [V-model.number on a native type="number" input leaves inputValue as](./0092-v-model-number-on-a-native-type-number-input-leaves-inputval.md) | Accepted |
| ADR-0093 | [Exact, case-sensitive comparison (trim only, no lowercasing](./0093-exact-case-sensitive-comparison-trim-only-no-lowercasing.md) | Accepted |
| ADR-0094 | [Tracks whether a given org's current toggleFeedback message is a](./0094-tracks-whether-a-given-org-s-current-togglefeedback-message.md) | Accepted |
| ADR-0095 | [The Enter-key handler on the admin-email input isn't gated by](./0095-the-enter-key-handler-on-the-admin-email-input-isn-t-gated-b.md) | Accepted |
| ADR-0096 | [ClaimFailures is the resilience signal 76-RESEARCH.md's Pitfall 4](./0096-claimfailures-is-the-resilience-signal-76-research-md-s-pitf.md) | Accepted |
| ADR-0097 | [── Enter-church action (R224)](./0097-enter-church-action-r224.md) | Accepted |
| ADR-0098 | [EnterOrgAsSuperAdmin now signals success/failure instead of silently](./0098-enterorgassuperadmin-now-signals-success-failure-instead-of.md) | Accepted |
| ADR-0099 | [A display dot is a REOPEN affordance ONLY when it represents a](./0099-a-display-dot-is-a-reopen-affordance-only-when-it-represents.md) | Accepted |
| ADR-0100 | [Deliberately NO scrim, structurally ported from EditSlideDrawer.vue](./0100-deliberately-no-scrim-structurally-ported-from-editslidedraw.md) | Accepted |
| ADR-0101 | [── Draft state (Pitfall #3 — critical)](./0101-draft-state-pitfall-3-critical.md) | Accepted |
| ADR-0102 | [Must actively DROP it (26-RESEARCH.md Pitfall 7, 26-UI-SPEC.md Mockup](./0102-must-actively-drop-it-26-research-md-pitfall-7-26-ui-spec-md.md) | Accepted |
| ADR-0103 | [For its own duration (25-REVIEW-FIX WR-01), so offering a](./0103-for-its-own-duration-25-review-fix-wr-01-so-offering-a.md) | Accepted |
| ADR-0104 | [This drawer's OWN failure state (26-RESEARCH.md Pitfall 6)](./0104-this-drawer-s-own-failure-state-26-research-md-pitfall-6.md) | Accepted |
| ADR-0105 | [Open. It follows the selection — it never closes itself on a](./0105-open-it-follows-the-selection-it-never-closes-itself-on-a.md) | Accepted |
| ADR-0106 | [ConfirmDiscard() is instantiated below (unsavedGuard, Task 3), but](./0106-confirmdiscard-is-instantiated-below-unsavedguard-task-3-but.md) | Accepted |
| ADR-0107 | [Flips the selected section entry's speaker to the next one in the](./0107-flips-the-selected-section-entry-s-speaker-to-the-next-one-i.md) | Accepted |
| ADR-0108 | [The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2)](./0108-the-fresh-base-write-t-26-05-01-26-research-md-pattern-2-pit.md) | Accepted |
| ADR-0109 | [Sequential, NOT Promise.all. Each writeField call reads](./0109-sequential-not-promise-all-each-writefield-call-reads.md) | Accepted |
| ADR-0110 | [Optimal, and recorded as a decision rather than an oversight](./0110-optimal-and-recorded-as-a-decision-rather-than-an-oversight.md) | Accepted |
| ADR-0111 | [Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns](./0111-phase-90-extracted-from-presentationviewer-vue-slidecanvas-o.md) | Accepted |
| ADR-0112 | [Keys the VideoPlayer instance on the SLIDE (WR-02) so switching](./0112-keys-the-videoplayer-instance-on-the-slide-wr-02-so-switchin.md) | Accepted |
| ADR-0113 | [The invisible hit-area padding is asymmetric, not](./0113-the-invisible-hit-area-padding-is-asymmetric-not.md) | Accepted |
| ADR-0114 | [Slide-group mutation in the codebase does (never the localService](./0114-slide-group-mutation-in-the-codebase-does-never-the-localser.md) | Accepted |
| ADR-0115 | [Reset whenever the selected plan item changes. openMenuEntryId is](./0115-reset-whenever-the-selected-plan-item-changes-openmenuentryi.md) | Accepted |
| ADR-0116 | [No on-demand materialization step is needed here, unlike every](./0116-no-on-demand-materialization-step-is-needed-here-unlike-ever.md) | Accepted |
| ADR-0117 | [Entries (unsorted, as returned) is the snapshot this append was](./0117-entries-unsorted-as-returned-is-the-snapshot-this-append-was.md) | Accepted |
| ADR-0118 | [Present (D-05). - selectedSlideId — the individual slide (an](./0118-present-d-05-selectedslideid-the-individual-slide-an.md) | Accepted |
| ADR-0119 | [The drawer has one body, so there is no mode to set — Duplicate and](./0119-the-drawer-has-one-body-so-there-is-no-mode-to-set-duplicate.md) | Accepted |
| ADR-0120 | [Clear a dangling slide selection rather than chasing the id-minting](./0120-clear-a-dangling-slide-selection-rather-than-chasing-the-id.md) | Accepted |
| ADR-0121 | [A newer mutation may have already run its own watcher while this save](./0121-a-newer-mutation-may-have-already-run-its-own-watcher-while.md) | Accepted |
| ADR-0122 | [Check for an inflight save BEFORE clearing the debounce timer, not](./0122-check-for-an-inflight-save-before-clearing-the-debounce-time.md) | Accepted |
| ADR-0123 | [── Lifecycle](./0123-lifecycle.md) | Accepted |
| ADR-0124 | [This listener ONLY updates isFullscreen. It must NEVER call any](./0124-this-listener-only-updates-isfullscreen-it-must-never-call-a.md) | Accepted |
| ADR-0125 | [5 — only a synchronous in-window gesture can re-enter; the](./0125-5-only-a-synchronous-in-window-gesture-can-re-enter-the.md) | Accepted |
| ADR-0126 | [Monotonic Go-live token + unmount flag guarding a LATE](./0126-monotonic-go-live-token-unmount-flag-guarding-a-late.md) | Accepted |
| ADR-0127 | [Which display was refused when EXACTLY ONE of the two window.open](./0127-which-display-was-refused-when-exactly-one-of-the-two-window.md) | Accepted |
| ADR-0128 | [PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act](./0128-pre-live-state-a-live-only-enter-go-live-and-escape-act.md) | Accepted |
| ADR-0129 | [The Go-live gesture entry — bound to the run-go-live-btn click, run](./0129-the-go-live-gesture-entry-bound-to-the-run-go-live-btn-click.md) | Accepted |
| ADR-0130 | [Stale (a newer attempt superseded us) or the view has torn down — do](./0130-stale-a-newer-attempt-superseded-us-or-the-view-has-torn-dow.md) | Accepted |
| ADR-0131 | [MonitorChanged is RunDisplaysPanel's own source of truth for the](./0131-monitorchanged-is-rundisplayspanel-s-own-source-of-truth-for.md) | Accepted |
| ADR-0132 | [Explicit, mirrors endServiceTeardown's defense-in-depth](./0132-explicit-mirrors-endserviceteardown-s-defense-in-depth.md) | Accepted |
| ADR-0133 | [ReconcileLoop() reads filmstrip.value.slides.length as a PLAIN](./0133-reconcileloop-reads-filmstrip-value-slides-length-as-a-plain.md) | Accepted |
| ADR-0134 | [Shared service-load + read-only assembly slice (Phase 95](./0134-shared-service-load-read-only-assembly-slice-phase-95.md) | Accepted |
| ADR-0135 | [Service subscription — key the service source off the SAME resolved](./0135-service-subscription-key-the-service-source-off-the-same-res.md) | Accepted |
| ADR-0136 | [PptxRendersStore is a Pinia singleton, but this composable's](./0136-pptxrendersstore-is-a-pinia-singleton-but-this-composable-s.md) | Accepted |
| ADR-0137 | [ActiveSlideshowAssemblyInstances still includes THIS instance at this](./0137-activeslideshowassemblyinstances-still-includes-this-instanc.md) | Accepted |
| ADR-0138 | [--- Phase 42 (R079/R080): resolve and cache rendered-page download](./0138-phase-42-r079-r080-resolve-and-cache-rendered-page-download.md) | Accepted |
| ADR-0139 | [Only the CURRENT count's entry is ever read again](./0139-only-the-current-count-s-entry-is-ever-read-again.md) | Accepted |
| ADR-0140 | [This is the one branch that empties a Congregational group's section](./0140-this-is-the-one-branch-that-empties-a-congregational-group-s.md) | Accepted |
| ADR-0141 | [Outcome.group.slides is the snapshot this rebuild was computed FROM](./0141-outcome-group-slides-is-the-snapshot-this-rebuild-was-comput.md) | Accepted |
| ADR-0142 | [AppConfig interface + DEFAULTAPPCONFIG (lines 24-97 as of Phase 69)](./0142-appconfig-interface-defaultappconfig-lines-24-97-as-of-phase.md) | Accepted |
| ADR-0143 | [Eager-load the DEFAULT slide face (R094) so the default family+weight](./0143-eager-load-the-default-slide-face-r094-so-the-default-family.md) | Accepted |
| ADR-0144 | [(68-REVIEW.md) — wait for the store's own onAuthStateChanged listener](./0144-68-review-md-wait-for-the-store-s-own-onauthstatechanged-lis.md) | Accepted |
| ADR-0145 | [Memorable share-URL slug (R-02/D-18) — used to build](./0145-memorable-share-url-slug-r-02-d-18-used-to-build.md) | Accepted |
| ADR-0146 | [Church-level Vertical Worship 1-2-3 methodology toggle (D-15)](./0146-church-level-vertical-worship-1-2-3-methodology-toggle-d-15.md) | Accepted |
| ADR-0147 | [Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the](./0147-phase-82-r242-r243-the-super-admin-master-ai-gate-read-from.md) | Accepted |
| ADR-0148 | [Via enterOrgAsSuperAdmin, with NO membership document of their own](./0148-via-enterorgassuperadmin-with-no-membership-document-of-thei.md) | Accepted |
| ADR-0149 | [(68-REVIEW.md) — the requiresSuperAdmin router guard read](./0149-68-review-md-the-requiressuperadmin-router-guard-read.md) | Accepted |
| ADR-0150 | [R213 (Phase 76) — the SAME full org-context reset the pre-existing](./0150-r213-phase-76-the-same-full-org-context-reset-the-pre-existi.md) | Accepted |
| ADR-0151 | [SlideTypography is deep-merged specifically — the plain](./0151-slidetypography-is-deep-merged-specifically-the-plain.md) | Accepted |
| ADR-0152 | [(46-REVIEW.md) — eager-load the org's actual chosen slide face here](./0152-46-review-md-eager-load-the-org-s-actual-chosen-slide-face-h.md) | Accepted |
| ADR-0153 | [D-19: replace ONLY the CSV-present people's quarter-scoped entries](./0153-d-19-replace-only-the-csv-present-people-s-quarter-scoped-en.md) | Accepted |
| ADR-0154 | [R-02/D-18: resolve (or claim, on first share) the org's memorable-URL](./0154-r-02-d-18-resolve-or-claim-on-first-share-the-org-s-memorabl.md) | Accepted |
| ADR-0155 | [The owning orgId is stored on the doc so firestore.rules can scope](./0155-the-owning-orgid-is-stored-on-the-doc-so-firestore-rules-can.md) | Accepted |
| ADR-0156 | [1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed](./0156-1-legacy-group-vocals-r250-pre-phase-85-docs-the-narrowed.md) | Accepted |
| ADR-0157 | [Module-level (not store-internal) so both the toast fallback below](./0157-module-level-not-store-internal-so-both-the-toast-fallback-b.md) | Accepted |
| ADR-0158 | [Keyed by surfaceId so several autosaving surfaces can be mounted](./0158-keyed-by-surfaceid-so-several-autosaving-surfaces-can-be-mou.md) | Accepted |
| ADR-0159 | [ShareLinkCache is subscription-scoped state exactly like everything](./0159-sharelinkcache-is-subscription-scoped-state-exactly-like-eve.md) | Accepted |
| ADR-0160 | [SONG-slot songIds present in a service, deduped source for both](./0160-song-slot-songids-present-in-a-service-deduped-source-for-bo.md) | Accepted |
| ADR-0161 | [Those songs fall back to their remaining locked MAX (or null if this](./0161-those-songs-fall-back-to-their-remaining-locked-max-or-null.md) | Accepted |
| ADR-0162 | [Mirrors TeamView.vue's onCancelInvite pattern — surface the failure](./0162-mirrors-teamview-vue-s-oncancelinvite-pattern-surface-the-fa.md) | Accepted |
| ADR-0163 | [This doc is keyed purely by slug+date, and the app enforces no](./0163-this-doc-is-keyed-purely-by-slug-date-and-the-app-enforces-n.md) | Accepted |
| ADR-0164 | [R-02/D-18: memorable-URL secondary write, mirroring](./0164-r-02-d-18-memorable-url-secondary-write-mirroring.md) | Accepted |
| ADR-0165 | [Subscribes to shareTokens or serviceShareLinks, so a write to either](./0165-subscribes-to-sharetokens-or-servicesharelinks-so-a-write-to.md) | Accepted |
| ADR-0166 | [Only a genuine permission-denied is treated as permanent-for-session](./0166-only-a-genuine-permission-denied-is-treated-as-permanent-for.md) | Accepted |
| ADR-0167 | [Input carries no bed by default (D-19 — the slot-media migration is](./0167-input-carries-no-bed-by-default-d-19-the-slot-media-migratio.md) | Accepted |
| ADR-0168 | [DeleteField() is the only way to actually remove a field. If the](./0168-deletefield-is-the-only-way-to-actually-remove-a-field-if-th.md) | Accepted |
| ADR-0169 | [Helper: entries present on the LIVE document but absent from both the](./0169-helper-entries-present-on-the-live-document-but-absent-from.md) | Accepted |
| ADR-0170 | [(two callers computing the same "append one entry" delta from the](./0170-two-callers-computing-the-same-append-one-entry-delta-from-t.md) | Accepted |
| ADR-0171 | [Seeds the default team list (Choir/Orchestra/Communion/Special) only](./0171-seeds-the-default-team-list-choir-orchestra-communion-specia.md) | Accepted |
| ADR-0172 | [APP-ONLY / manual — NOT fetchable from Planning Center Services v2](./0172-app-only-manual-not-fetchable-from-planning-center-services.md) | Accepted |
| ADR-0173 | [Equals the stored GroupSlideEntry.id this slide was resolved from](./0173-equals-the-stored-groupslideentry-id-this-slide-was-resolved.md) | Accepted |
| ADR-0174 | [1. SlideGroup.id === SlideGroup.slotId === the anchoring](./0174-1-slidegroup-id-slidegroup-slotid-the-anchoring.md) | Accepted |
| ADR-0175 | [D-79 default team list — byte-identical to the pre-Phase-79](./0175-d-79-default-team-list-byte-identical-to-the-pre-phase-79.md) | Accepted |
| ADR-0176 | [Guard lives INSIDE the try so a throw from useAuthStore() (e.g. no](./0176-guard-lives-inside-the-try-so-a-throw-from-useauthstore-e-g.md) | Accepted |
| ADR-0177 | [Because the structured-outputs JSON Schema subset supports no](./0177-because-the-structured-outputs-json-schema-subset-supports-n.md) | Accepted |
| ADR-0178 | [In the ready state an identity is the reconciler's synthetic](./0178-in-the-ready-state-an-identity-is-the-reconciler-s-synthetic.md) | Accepted |
| ADR-0179 | [Prefix for the synthetic ready-state entry identity this module mints](./0179-prefix-for-the-synthetic-ready-state-entry-identity-this-mod.md) | Accepted |
| ADR-0180 | [An EXPLICIT render.status === 'ready' check, not an implicit](./0180-an-explicit-render-status-ready-check-not-an-implicit.md) | Accepted |
| ADR-0181 | [Mints the stable per-entry identity derivedIdentityKey/](./0181-mints-the-stable-per-entry-identity-derivedidentitykey.md) | Accepted |
| ADR-0182 | [The promise — a positional deck.slides[i] <-> rendered-page-i+1](./0182-the-promise-a-positional-deck-slides-i-rendered-page-i-1.md) | Accepted |
| ADR-0183 | [This describes the physical cable plugged into THIS device, not an](./0183-this-describes-the-physical-cable-plugged-into-this-device-n.md) | Accepted |
| ADR-0184 | [Routed through the scriptureApi.ts dispatcher — the phase's single](./0184-routed-through-the-scriptureapi-ts-dispatcher-the-phase-s-si.md) | Accepted |
| ADR-0185 | [Raw PC person shape returned from the Planning Center Services v2](./0185-raw-pc-person-shape-returned-from-the-planning-center-servic.md) | Accepted |
| ADR-0186 | [Fetch the distinct people currently serving one of the caller's](./0186-fetch-the-distinct-people-currently-serving-one-of-the-calle.md) | Accepted |
| ADR-0187 | [Whether adding candidateRoleId to a person's already-assigned roleIds](./0187-whether-adding-candidateroleid-to-a-person-s-already-assigne.md) | Accepted |
| ADR-0188 | [Caller (quarters.ts) builds this from rosterStore.roles. Unknown](./0188-caller-quarters-ts-builds-this-from-rosterstore-roles-unknow.md) | Accepted |
| ADR-0189 | [A person stays eligible for a role on the date at dateIndex ONLY](./0189-a-person-stays-eligible-for-a-role-on-the-date-at-dateindex.md) | Accepted |
| ADR-0190 | [R260 — a pulled-in paired partner who is themselves a multi-role](./0190-r260-a-pulled-in-paired-partner-who-is-themselves-a-multi-ro.md) | Accepted |
| ADR-0191 | [Matches a clause-ending mark followed by whitespace. Deliberately](./0191-matches-a-clause-ending-mark-followed-by-whitespace-delibera.md) | Accepted |
| ADR-0192 | [Always included as the passage's own start/end anchors, even when the](./0192-always-included-as-the-passage-s-own-start-end-anchors-even.md) | Accepted |
| ADR-0193 | [Fix (47-REVIEW): the verse range that actually belongs to a segment](./0193-fix-47-review-the-verse-range-that-actually-belongs-to-a-seg.md) | Accepted |
| ADR-0194 | [Store or Vue reactivity — callers (the composable) load data, decide](./0194-store-or-vue-reactivity-callers-the-composable-load-data-dec.md) | Accepted |
| ADR-0195 | [Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 /](./0195-additive-only-song-rebuild-d-02-research-md-pattern-3-strate.md) | Accepted |
| ADR-0196 | [Retained-but-unresolvable entries — kept relative to each other](./0196-retained-but-unresolvable-entries-kept-relative-to-each-othe.md) | Accepted |
| ADR-0197 | [A rejected document.fonts.load() is a FAILED load, not a stalled one](./0197-a-rejected-document-fonts-load-is-a-failed-load-not-a-stalle.md) | Accepted |
| ADR-0198 | [Two resolution paths, per slot: 1. A slot with a materialized](./0198-two-resolution-paths-per-slot-1-a-slot-with-a-materialized.md) | Accepted |
| ADR-0199 | [No blackout arm here — this whole case 'lyric': branch is unreachable](./0199-no-blackout-arm-here-this-whole-case-lyric-branch-is-unreach.md) | Accepted |
| ADR-0200 | [R055/R056/R057: slide → group → song, most specific wins. Computed](./0200-r055-r056-r057-slide-group-song-most-specific-wins-computed.md) | Accepted |
| ADR-0201 | [Song lookup keyed on the GROUP's owning song (via the slot), not the](./0201-song-lookup-keyed-on-the-group-s-owning-song-via-the-slot-no.md) | Accepted |
| ADR-0202 | [A blackout slide never carries a background, matching](./0202-a-blackout-slide-never-carries-a-background-matching.md) | Accepted |
| ADR-0203 | [Reads PROGRESSIONSLOTTYPES[progression] as an ORDERED SEQUENCE of VW](./0203-reads-progressionslottypes-progression-as-an-ordered-sequenc.md) | Accepted |
| ADR-0204 | [This application has no per-song address today — /songs is a flat](./0204-this-application-has-no-per-song-address-today-songs-is-a-fl.md) | Accepted |
| ADR-0205 | [Derives the numbered row list option 2a draws from a (sections](./0205-derives-the-numbered-row-list-option-2a-draws-from-a-section.md) | Accepted |
| ADR-0206 | [R304 / PITFALLS Pitfall 5: a blackout section is excluded from](./0206-r304-pitfalls-pitfall-5-a-blackout-section-is-excluded-from.md) | Accepted |
| ADR-0207 | [Mirror the bareInt branch's > 0 guard — "1-in-0" (and any other](./0207-mirror-the-bareint-branch-s-0-guard-1-in-0-and-any-other.md) | Accepted |
| ADR-0208 | [Normalize a name for comparison: trim, collapse internal whitespace](./0208-normalize-a-name-for-comparison-trim-collapse-internal-white.md) | Accepted |
| ADR-0209 | [R271 / Pitfall 6 — the ONE interactive element in this view, shown](./0209-r271-pitfall-6-the-one-interactive-element-in-this-view-show.md) | Accepted |
| ADR-0210 | [The shared output-window lifecycle-core (R272 reuse-not-fork)](./0210-the-shared-output-window-lifecycle-core-r272-reuse-not-fork.md) | Accepted |
| ADR-0211 | [R271 / Pitfall 6 — the ONE interactive element, shown ONLY when](./0211-r271-pitfall-6-the-one-interactive-element-shown-only-when.md) | Accepted |
| ADR-0212 | [The shared output-window lifecycle-core (R272 reuse-not-fork)](./0212-the-shared-output-window-lifecycle-core-r272-reuse-not-fork-2.md) | Accepted |
| ADR-0213 | [State: dirtyEdits tracks whether the operator has made unsaved](./0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md) | Accepted |
| ADR-0214 | [Monotonic token guarding against a stale getScreenDetails()](./0214-monotonic-token-guarding-against-a-stale-getscreendetails.md) | Accepted |
| ADR-0215 | [Layout changed since the mapping was saved — never guess the new](./0215-layout-changed-since-the-mapping-was-saved-never-guess-the-n.md) | Accepted |
| ADR-0216 | [The single most gesture-sensitive line in this phase](./0216-the-single-most-gesture-sensitive-line-in-this-phase.md) | Accepted |
| ADR-0217 | [Roving tabindex on the tab bar (above) removes inactive tabs from the](./0217-roving-tabindex-on-the-tab-bar-above-removes-inactive-tabs-f.md) | Accepted |
| ADR-0218 | [UseRoute()/useRouter() return undefined when this view is mounted](./0218-useroute-userouter-return-undefined-when-this-view-is-mounte.md) | Accepted |
| ADR-0219 | [── New quarter creation (Add-quarter modal, R-10/D-13)](./0219-new-quarter-creation-add-quarter-modal-r-10-d-13.md) | Accepted |
| ADR-0220 | [Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY)](./0220-prefer-the-memorable-slug-based-public-url-slug-quartern-yyy.md) | Accepted |
| ADR-0221 | [PARTIAL (WR-02): EXACTLY ONE output window opened; the other was](./0221-partial-wr-02-exactly-one-output-window-opened-the-other-was.md) | Accepted |
| ADR-0222 | [R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the](./0222-r276-97-08-09-the-entire-phase-92-96-control-core-the.md) | Accepted |
| ADR-0223 | [LocalService. Keyed on congregationalSlot.id (WR-04](./0223-localservice-keyed-on-congregationalslot-id-wr-04.md) | Accepted |
| ADR-0224 | [Fix: do NOT restore a closure-captured pre-drag snapshot here](./0224-fix-do-not-restore-a-closure-captured-pre-drag-snapshot-here.md) | Accepted |
| ADR-0225 | [Non-editor: no roster/quarters data was ever subscribed to (Pitfall](./0225-non-editor-no-roster-quarters-data-was-ever-subscribed-to-pi.md) | Accepted |
| ADR-0226 | [Declared before the watcher below (rather than down with the rest of](./0226-declared-before-the-watcher-below-rather-than-down-with-the.md) | Accepted |
| ADR-0227 | [An outstanding 'error' means a real, unsaved edit is still sitting in](./0227-an-outstanding-error-means-a-real-unsaved-edit-is-still-sitt.md) | Accepted |
| ADR-0228 | [AuthStore.isEditor resolves asynchronously (loadOrgContext runs off](./0228-authstore-iseditor-resolves-asynchronously-loadorgcontext-ru.md) | Accepted |
| ADR-0229 | [Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no](./0229-roles-tab-data-pitfall-4-t-17-04-01-cr-05-services-id-has-no.md) | Accepted |
| ADR-0230 | [LifecycleError is declared earlier (with the autosave watcher block)](./0230-lifecycleerror-is-declared-earlier-with-the-autosave-watcher.md) | Accepted |
| ADR-0231 | [READ BEFORE WRITE: the snapshot's prior existence is the first-lock](./0231-read-before-write-the-snapshot-s-prior-existence-is-the-firs.md) | Accepted |
| ADR-0232 | [IMPORTED slots reference PPTX/image decks with no analogous PC item](./0232-imported-slots-reference-pptx-image-decks-with-no-analogous.md) | Accepted |
| ADR-0233 | [The pre-migration bottom-row button was :disabled="!localService ||](./0233-the-pre-migration-bottom-row-button-was-disabled-localservic.md) | Accepted |
| ADR-0234 | [Optimistic local update. assignment.effectivePersonIds is derived](./0234-optimistic-local-update-assignment-effectivepersonids-is-der.md) | Accepted |
| ADR-0235 | [Snapshot exactly what is about to be sent, so the "mark clean" step](./0235-snapshot-exactly-what-is-about-to-be-sent-so-the-mark-clean.md) | Accepted |
| ADR-0236 | [── Save action (Share URL slug, R-02/D-18)](./0236-save-action-share-url-slug-r-02-d-18.md) | Accepted |
| ADR-0237 | [Keep the local checkbox in sync if the store's org context finishes](./0237-keep-the-local-checkbox-in-sync-if-the-store-s-org-context-f.md) | Accepted |
| ADR-0238 | [A genuinely failed dynamic import here would otherwise surface as an](./0238-a-genuinely-failed-dynamic-import-here-would-otherwise-surfa.md) | Accepted |
| ADR-0239 | [ReminderDaysBefore MUST persist as a number — v-model.number already](./0239-reminderdaysbefore-must-persist-as-a-number-v-model-number-a.md) | Accepted |
| ADR-0240 | [Clear query param without navigation. WR-01: AWAITED — route.query](./0240-clear-query-param-without-navigation-wr-01-awaited-route-que.md) | Accepted |
| ADR-0241 | [Org-level AI features toggle (WR-01, 39-REVIEW). Required (not](./0241-org-level-ai-features-toggle-wr-01-39-review-required-not.md) | Accepted |
| ADR-0242 | [R101 (48-03): Print, relocated verbatim from the page-bottom button](./0242-r101-48-03-print-relocated-verbatim-from-the-page-bottom-but.md) | Accepted |
| ADR-0243 | [HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The](./0243-hide-on-fail-when-messaging-is-off-owner-uat-2026-08-17-the.md) | Accepted |
| ADR-0244 | ["Suggest All Songs" is a live AI entry point (calls](./0244-suggest-all-songs-is-a-live-ai-entry-point-calls.md) | Accepted |
