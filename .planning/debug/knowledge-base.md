# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## functions-emulator-load-failure — Emulator send path stalls; messages stuck "Sending…" (undeployed RESEND secret)
- **Date:** 2026-08-15
- **Error patterns:** Failed to load function, Failed to handle request for function, Failed to start functions, queueServiceMessage, sendQueuedMessage, messages stuck queued, Sending… spinner never resolves, onCall never returns, firebase functions emulator, RESEND_API_KEY, resolveSecretEnvs, defineSecret
- **Root cause:** In the local Functions emulator, invoking a secret-bound trigger runs firebase-tools' resolveSecretEnvs(), which fetches any bound secret absent from functions/.secret.local from Google Secret Manager. The v1.7 send path added sendQueuedMessage (binds RESEND_API_KEY) and messageWebhook (binds RESEND_WEBHOOK_SECRET); both secrets are undeployed and there was no functions/.secret.local, so resolveSecretEnvs stalls/fails and the sendQueuedMessage worker never runs — messages stay status "queued" (UI "Sending…"). queueServiceMessage binds no secret and works (107ms); its transient "Failed to load function." was a cold worker-load timeout (waitForSocketReady 30s). Handlers already read .value() lazily; not an app-code bug.
- **Fix:** Create functions/.secret.local (gitignored, placeholder values) with RESEND_API_KEY + RESEND_WEBHOOK_SECRET so resolveSecretEnvs resolves them locally and skips Secret Manager. Committed a .gitignore rule for .secret.local and a functions/.secret.local.example template. Owner must RESTART the emulator (secret resolution + trigger registration are startup-time).
- **Files changed:** .gitignore, functions/.secret.local.example (local-only, gitignored: functions/.secret.local)
---
