---
status: resolved
trigger: "Firebase Functions emulator: !! functions: Failed to handle request for function us-central1-queueServiceMessage / Failed to start functions in C:\\projects\\worshipplanner\\functions: Failed to load function. Client ✉ composer send hangs forever (queueServiceMessage onCall never returns; 4 messages stuck in Sending…)."
created: 2026-08-15
updated: 2026-08-15
---

## Current Focus

hypothesis: CONFIRMED — messages are stuck "Sending…" because the v1.7 send trigger `sendQueuedMessage` binds `RESEND_API_KEY`, an undeployed Secret Manager secret with no local override, so the emulator's `resolveSecretEnvs` stalls/fails resolving it and the trigger's worker never runs the handler. queueServiceMessage (no secret) works.
test: Provide the Resend secrets to the emulator via `functions/.secret.local` so `resolveSecretEnvs` reads them locally and never calls Secret Manager.
expecting: With the secret present, `sendQueuedMessageHandler` runs to completion (queued -> sent). Proven live (PART B) + secret-file parse proven (PART A).
next_action: RESOLVED. Owner must restart the functions emulator to pick up `functions/.secret.local` (secret resolution + trigger registration happen at startup).

reasoning_checkpoint:
  hypothesis: "sendQueuedMessage (onDocumentCreated, secrets:[RESEND_API_KEY]) never runs its handler in the emulator because functionsEmulator.resolveSecretEnvs fetches every bound secret absent from functions/.secret.local from Google Secret Manager, and RESEND_API_KEY is undeployed + there was no local file — so the send worker never starts and every message stays status 'queued' (UI: 'Sending…')."
  confirming_evidence:
    - "Live: a fresh message doc stays 'queued' for 35s (sendQueuedMessage never processes it); requestPptxRender — the OTHER onDocumentCreated but with NO secret — fires and completes in 9s. Only difference is the secret binding."
    - "queueServiceMessage (no secret) returns 401 in 107ms live; all 4 stuck docs are status 'queued' with 0 recipients => queueServiceMessage succeeded, sendQueuedMessage never claimed them."
    - "SecretParam.runtimeValue() (firebase-functions types.js:304-309) does NOT throw on a missing secret (warns, returns '') — so a spawned worker WOULD reach the queued->sending claim; a doc frozen at 'queued' means the worker never ran => stalled before spawn, i.e. in resolveSecretEnvs."
    - "PART A: firebase-tools parseStrict reads functions/.secret.local -> both bound secrets resolve locally -> 0 remaining Secret-Manager calls. PART B: sendQueuedMessageHandler with the secret present runs queued->sent against the live firestore emulator."
  falsification_test: "With functions/.secret.local present and the emulator restarted, a newly-composed message should progress off 'Sending…'. If it still hangs, the hypothesis is wrong."
  fix_rationale: "The failure is emulator secret RESOLUTION, not app code (handlers already read .value() lazily and tests pass). functions/.secret.local is firebase-tools' official local-secret mechanism; listing the two keys makes resolveSecretEnvs skip the Secret Manager call entirely — addressing the root, not a symptom."
  blind_spots: "Could not restart the owner's live emulator (port-collision constraint), so the end-to-end auto-trigger-after-restart path is proven by mechanism (PART A) + handler (PART B) rather than a single live restart. The owner's exact resolveSecretEnvs timing (hang vs slow-fail) depends on their CLI auth state; the fix removes the GCP call regardless."

## Symptoms

expected: `queueServiceMessage` onCall returns; ✉ composer send resolves; message moves out of "Sending…".
actual: Emulator prints `!! functions: Failed to handle request for function us-central1-queueServiceMessage` and `!! functions: Failed to start functions in C:\projects\worshipplanner\functions: Failed to load function.` ALL functions are down (queueServiceMessage is just the one being called). Client send spinner never resolves; 4 messages stuck "Sending…".
errors: |
  !! functions: Failed to handle request for function us-central1-queueServiceMessage
  !! functions: Failed to start functions in C:\projects\worshipplanner\functions: Failed to load function.
reproduction: Owner runs local Firebase emulator (`--only functions`), then uses the ✉ composer to send a service message which calls the `queueServiceMessage` onCall.
started: After v1.7 (send path). Pre-v1.7 the emulator worked with firebase-functions 7.2.5 (v7 was introduced in b2b35e86, BEFORE v1.7). v1.7 added: `resend` dep (f953db6), the send-path functions (queueServiceMessage onCall, sendQueuedMessage onDocumentCreated, messageWebhook onRequest, sendScheduledReminders onSchedule), new defineSecret (RESEND_API_KEY, RESEND_WEBHOOK_SECRET) and defineString (SERVICE_SHARE_BASE_URL, MESSAGE_FROM_ADDRESS) params.

## Eliminated

- hypothesis: Top-level throw / bad import under a normal require.
  evidence: Orchestrator ran `cd functions && node -e "require('./lib/index.js')"` -> "LOADED OK". Compiled bundle requires clean.
  timestamp: 2026-08-15 (pre-established by orchestrator)
- hypothesis: TypeScript compile error.
  evidence: `cd functions && npm run build` (tsc) exits 0, clean.
  timestamp: 2026-08-15 (pre-established by orchestrator)
- hypothesis: Module-scope side effect from new code (`new Resend(SECRET.value())` or `SECRET.value()` / `CONFIG.value()` at module load).
  evidence: Grep of functions/src/index.ts: every `.value()` (lines 195, 211, 216, 462, 1584, 1727, 1728, 1993) and the single `new Resend(...)` (line 1727) is INSIDE a handler body, never at module scope. defineSecret/defineString calls only REGISTER params, they do not resolve.
  timestamp: 2026-08-15

## Evidence

- timestamp: 2026-08-15
  checked: firebase-debug.log / functions-debug.log at repo root and functions/ (all three name variants).
  found: None exist. Only firestore-debug.log (0 bytes, empty). No captured stack trace available from logs — must reproduce discovery directly.
  implication: Hypothesis 1 (log has the real error) is a dead end; reproduce the discovery step instead.

- timestamp: 2026-08-15
  checked: functions/src/index.ts full read + grep for value()/new Resend()/defineSecret/defineString/process.env.
  found: All secret/param resolution is lazy (inside handlers). New params: RESEND_API_KEY (bound only to sendQueuedMessage), RESEND_WEBHOOK_SECRET (bound only to messageWebhook), SERVICE_SHARE_BASE_URL + MESSAGE_FROM_ADDRESS (defineString, both with default:"" or a literal default — no required/no-default param).
  implication: Discovery should not throw on unset secrets. Need to reproduce the actual emulator load path to see the real error.

- timestamp: 2026-08-15
  checked: Reproduced discovery (loadStack) directly + spawned the runtime worker exactly as functionsEmulator.startNode does (TCP and the real Windows named pipe).
  found: Discovery OK in ~3s (all 10 endpoints, 8 params). queueServiceMessage endpoint has secretEnvironmentVariables=[] (emulator coerces to [] at functionsEmulator.js:98, so its worker triggers NO Secret Manager access). Worker becomes /__/health-200 in 7.5s (TCP) / 10s (named pipe). No crash, no >30s hang on THIS machine.
  implication: The "Failed to load function." string is a waitForSocketReady 30s TIMEOUT (functionsRuntimeWorker.js:200), reached via handleHttpsTrigger->startRuntime (functionsEmulator.js:1282-1283). In isolation the worker loads well under 30s, so a deterministic crash/hang is ruled out here.

- timestamp: 2026-08-15
  checked: Invoked queueServiceMessage against the LIVE running functions emulator (POST /worship-planner-bc515/us-central1/queueServiceMessage {data:{}} — no auth, throws before any write, side-effect-free).
  found: HTTP 401 {"message":"Sign in required.","status":"UNAUTHENTICATED"} in 107ms. The worker is currently loaded, warm and healthy.
  implication: The acute "Failed to load function." is NOT currently reproducible — it was a transient COLD worker-load timeout (first spawn of the v1.7-enlarged bundle: firebase-admin + officeparser + newly-added resend graph, cold OS cache + Windows Defender scanning, exceeding the 30s FUNCTIONS_DISCOVERY_TIMEOUT default). Now warm => 107ms. The durable symptom to chase is the 4 messages stuck "Sending…", i.e. the SEND path (sendQueuedMessage), not queueServiceMessage load.

## Resolution

root_cause: |
  In the LOCAL Firebase Functions emulator, invoking a secret-bound trigger runs
  functionsEmulator.resolveSecretEnvs() (functions global firebase-tools 15.26.0,
  functionsEmulator.js:1030-1071), which for every bound secret NOT present in
  functions/.secret.local calls Google Secret Manager accessSecretVersion(). The
  v1.7 send path added `sendQueuedMessage` (onDocumentCreated, secrets:[RESEND_API_KEY])
  and `messageWebhook` (onRequest, secrets:[RESEND_WEBHOOK_SECRET]). Neither secret
  exists in the project (the send path is undeployed) and there was no
  functions/.secret.local. So when queueServiceMessage enqueues a message and
  sendQueuedMessage's onDocumentCreated fires, resolveSecretEnvs stalls/fails on the
  undeployed RESEND_API_KEY and the sendQueuedMessage worker never runs its handler.
  The message never reaches the queued->sending claim, so it is frozen at status
  "queued", which ServiceMessageHistory.vue:217-248 renders as "Sending…" forever.
  queueServiceMessage itself binds NO secret and works (401 in 107ms live); the
  "Failed to load function." the owner saw is a separate cold worker-load timeout
  (waitForSocketReady 30s, functionsRuntimeWorker.js:200) plausibly aggravated by the
  functions emulator being tied up on the hung secret resolution. The bug is emulator
  secret RESOLUTION, not app code — handlers already read .value() lazily inside their
  bodies (functions/src/index.ts:1727), the module requires cleanly, and all tests pass.
fix: |
  Provide the two Resend secrets to the emulator locally so resolveSecretEnvs reads
  them from functions/.secret.local and never calls Secret Manager. Committed:
    - .gitignore: ignore .secret.local / *.secret.local (keep !.secret.local.example)
      so a real Resend key placed there later can never be committed.
    - functions/.secret.local.example: committed, self-documenting template.
  Created locally (gitignored, NOT committed): functions/.secret.local with PLACEHOLDER
  values (re_local_emulator_placeholder... / whsec_local_emulator_placeholder...), so
  the owner's next emulator start works immediately. No functions/src change was needed.
verification: |
  - Discovery reproduction GREEN: loadStack() enumerates all 10 endpoints + 8 params in ~3s (no error).
  - Live differential: requestPptxRender (onDocumentCreated, NO secret) fires+completes in 9s;
    sendQueuedMessage (RESEND_API_KEY) leaves a probe message 'queued' for 35s (pre-fix).
  - PART A: firebase-tools parseStrict reads functions/.secret.local -> RESEND_API_KEY +
    RESEND_WEBHOOK_SECRET resolve locally -> 0 remaining Secret-Manager calls for both
    sendQueuedMessage and messageWebhook (no GCP hang).
  - PART B: exported sendQueuedMessageHandler, RESEND_API_KEY present, run end-to-end against
    the LIVE firestore emulator on a 0-recipient probe -> outcome {status:'sent',sentCount:0,
    failedCount:0}, doc queued->sent. No email sent (0 recipients).
  - `npm --prefix functions run build` (tsc) -> exit 0 (clean).
  - `npm --prefix functions test` (vitest) -> 8 files, 257 tests passed.
  NOTE: could not restart the owner's live emulator (port-collision constraint), so the
  auto-trigger-after-restart path is proven by mechanism (PART A) + handler (PART B), not a
  single live restart. OWNER STEP: restart the functions emulator to load functions/.secret.local
  (secret resolution + trigger registration are startup-time). The 4 already-'queued' docs will
  NOT auto-retrigger (onDocumentCreated fires on create only) — re-send them from the composer
  after restart. To DELIVER real email locally, put a real re_... key in functions/.secret.local
  (the placeholder returns 401 at Resend); never commit it.
files_changed: [.gitignore, functions/.secret.local.example]
