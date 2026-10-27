# API Coverage — Firebase Hosting / Cloud Storage CORS / Firebase Auth config (Phase 145)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> The detector fired on the phrase "Firebase SDK" in 145-03's must-haves, which states that the bridge bundle
> contains no SDK code. This phase adds no runtime API integration. The matrix covers the platform
> configuration surfaces it does touch.

| capability | decision | reason |
|---|---|---|
| hosting-multisite-targets | INTEGRATE | |
| hosting-function-rewrite | INTEGRATE | |
| hosting-spa-rewrite | INTEGRATE | |
| hosting-reserved-urls | INTEGRATE | |
| hosting-headers | INTEGRATE | |
| hosting-release-rollback | INTEGRATE | |
| hosting-clone | INTEGRATE | |
| hosting-redirects | OPT-OUT | explicitly out of scope — a server 301 cannot carry per-origin localStorage; the client bridge replaces it |
| hosting-cleanurls-trailingslash-i18n | OPT-OUT | explicitly out of scope — would alter the request path, and R451 requires the exact path/query/hash |
| hosting-preview-channels | OPT-OUT | not needed — the new site is smoke-tested live before the bridge deploy (runbook Step 4) |
| hosting-custom-domain | OPT-OUT | explicitly out of scope — deferred to backlog 999.14 |
| storage-bucket-cors | INTEGRATE | |
| auth-authorized-domains | INTEGRATE | |
| auth-authdomain-switch | OPT-OUT | explicitly out of scope — deferred to backlog 999.14 |
| identity-toolkit-admin-api | OPT-OUT | not needed — the authorized-domain change is an owner-run console step, and this phase makes no production writes from code |
| functions-params-default | INTEGRATE | |
| app-check | OPT-OUT | not needed — the app does not use App Check (145-RESEARCH "Other Origin-Scoped Configuration") |
