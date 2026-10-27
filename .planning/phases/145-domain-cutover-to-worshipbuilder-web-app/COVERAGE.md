# API Coverage — Firebase Hosting / Cloud Storage CORS / Firebase Auth config (Phase 145)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> The detector originally fired on the phrase "Firebase SDK" in the old bridge plan's must-haves. That bridge was
> dropped by the owner's scope cut on 2026-10-27 (CONTEXT "Amendment 2"): the old addresses are now a plain
> Hosting redirect. This phase adds no runtime API integration. The matrix covers the platform configuration
> surfaces it does touch.

| capability | decision | reason |
|---|---|---|
| hosting-multisite-targets | INTEGRATE | |
| hosting-function-rewrite | INTEGRATE | |
| hosting-spa-rewrite | INTEGRATE | |
| hosting-reserved-urls | INTEGRATE | |
| hosting-headers | INTEGRATE | |
| hosting-redirects | INTEGRATE | |
| hosting-release-rollback | INTEGRATE | |
| hosting-clone | INTEGRATE | |
| hosting-cleanurls-trailingslash-i18n | OPT-OUT | explicitly out of scope — would alter the request path, and R451 requires the exact path/query/hash |
| hosting-preview-channels | OPT-OUT | not needed — the new site is smoke-tested live before the redirect deploy (runbook Step 4) |
| hosting-custom-domain | OPT-OUT | explicitly out of scope — deferred to backlog 999.14 |
| storage-bucket-cors | INTEGRATE | |
| auth-authorized-domains | INTEGRATE | |
| auth-authdomain-switch | OPT-OUT | explicitly out of scope — deferred to backlog 999.14 |
| identity-toolkit-admin-api | OPT-OUT | not needed — the authorized-domain change is an owner-run console step, and this phase makes no production writes from code |
| functions-params-default | INTEGRATE | |
| app-check | OPT-OUT | not needed — the app does not use App Check (145-RESEARCH "Other Origin-Scoped Configuration") |
