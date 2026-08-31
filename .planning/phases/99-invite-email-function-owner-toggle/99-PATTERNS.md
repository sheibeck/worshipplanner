# Phase 99: Invite Email Function & Owner Toggle - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `functions/src/inviteOnboarding.ts` (NEW) | controller (Cloud Function callable) | request-response + event-driven side effect (Auth provisioning + email send) | `functions/src/orgProvisioning.ts` (`onboardOrganizationHandler`) + `functions/src/adminEmail.ts` (`sendAdminOnboardingEmail`) | exact (composite of two analogs) |
| `functions/src/index.ts` (EDIT — re-export) | route/registration | request-response | existing `import { onboardOrganization } from "./orgProvisioning"; export { onboardOrganization };` block | exact |
| `functions/src/appConfig.ts` (EDIT — add `onboarding` group) | config/model | CRUD (Firestore doc merge/coerce) | existing `messaging`/`cleanup` groups + `coerceMessaging`/`coerceCleanup` + `mergeAppConfig` wiring | exact |
| `src/config/appConfigDefaults.ts` (EDIT — mirror) | config/model (client mirror) | CRUD | existing `messaging` group + `mergeAppConfig` spread line | exact |
| `src/config/__tests__/appConfigDefaults.test.ts` (EDIT — drift-guard) | test | transform (snapshot/shape assertion) | existing drift-guard assertions for `messaging`/`cleanup` | exact |
| `src/components/admin/OnboardingConfigCard.vue` (NEW) | component | request-response (immediate-save toggle) | `src/components/admin/MessagingConfigCard.vue` (its `scheduledCronEnabled` checkbox block only, not the numeric fields) | exact |
| `src/components/admin/ConfigurationTab.vue` (EDIT — mount new card) | component (parent) | request-response | existing `<MessagingConfigCard />` mount + import line | exact |
| `functions/src/inviteOnboarding.test.ts` (NEW) | test | request-response | `functions/src/orgProvisioning.test.ts` (FakeFirestore + mocked `getAuth()`) + `functions/src/adminEmail.test.ts` (mocked `resend`/`firebase-functions/params`) | exact (composite) |
| `functions/src/appConfig.test.ts` (EDIT — add `onboarding` cases) | test | CRUD | existing `coerceMessaging`/`coerceCleanup` test blocks | exact |

## Pattern Assignments

### `functions/src/inviteOnboarding.ts` (controller, request-response)

**Analogs:** `functions/src/orgProvisioning.ts` (handler/wrapper shape, caller gate, email-format guard, Auth-target resolution, best-effort email) + `functions/src/adminEmail.ts` (Resend send construction) + `functions/src/index.ts:2609-2668` (`queueServiceMessageHandler`, org-editor caller gate — the only precedent for a non-super-admin gate)

**Imports pattern** (mirror `orgProvisioning.ts` top + `adminEmail.ts` top):
```typescript
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import { RESEND_API_KEY, SERVICE_SHARE_BASE_URL, bareEmailAddress, fromDisplayName } from "./params";
```

**Email-format guard** (copy verbatim shape from `functions/src/orgProvisioning.ts:80-85`):
```typescript
function assertValidEmailFormat(email: string): void {
  const trimmed = email.trim();
  if (!trimmed || trimmed.includes("/") || !trimmed.includes("@") || !trimmed.includes(".")) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
}
```
Note: this guard is module-private in `orgProvisioning.ts` (not exported) — write a fresh copy in the new module, do not attempt to import it.

**Org-editor caller gate** (copy verbatim shape from `functions/src/index.ts:2609-2668`, `queueServiceMessageHandler` — the ONLY existing org-editor precedent; there is no shared `assertOrgEditorCaller` helper to import):
```typescript
if (!request.auth) {
  throw new HttpsError("unauthenticated", "Sign in required.");
}
const memberDoc = await db.collection("organizations").doc(orgId)
  .collection("members").doc(request.auth.uid).get();
if (!memberDoc.exists) {
  throw new HttpsError("permission-denied", "You are not a member of this organization.");
}
const role = (memberDoc.data() as { role?: string } | undefined)?.role;
if (role !== "editor") {
  throw new HttpsError("permission-denied", "You must be an editor to invite members.");
}
```

**getUserByEmail / create discrimination pattern** (copy shape from `functions/src/orgProvisioning.ts:128-145`, `resolveAdminTarget`):
```typescript
const normalizedEmail = email.trim().toLowerCase();
try {
  const targetUser = await getAuth().getUserByEmail(normalizedEmail);
  // existing user — do NOT create; go straight to reset-link (non-Google) or notify (Google)
} catch (err) {
  if ((err as { code?: string })?.code === "auth/user-not-found") {
    // new user — createUser then continue
  } else {
    console.error("[inviteOnboarding] getUserByEmail failed:", err);
    throw err;
  }
}
```
Extend with the `auth/email-already-exists` race catch around `createUser` (Code Examples section of RESEARCH.md, already CITED against Firebase docs) — this exact catch-and-fall-through has no in-repo precedent but must mirror `resolveAdminTarget`'s discrimination style (check `err.code`, not `err.message`).

**Handler/wrapper split + secrets binding** (copy shape from `functions/src/orgProvisioning.ts:255-328`):
```typescript
export async function sendInviteOnboardingEmailHandler(
  request: CallableRequest<SendInviteOnboardingEmailRequest>,
): Promise<SendInviteOnboardingEmailResponse> {
  // caller gate -> validate -> getAppConfig gate -> branch -> Auth calls -> send -> return
}

export const sendInviteOnboardingEmail = onCall(
  { secrets: [RESEND_API_KEY] },
  sendInviteOnboardingEmailHandler,
);
```

**appConfig gate** (copy shape from `functions/src/orgProvisioning.ts`'s use of `getAppConfig` is absent there — use `adminEmail.ts:96` instead, `sendAdminOnboardingEmail`'s `const config = await getAppConfig(db);`):
```typescript
const config = await getAppConfig(db);
if (!config.onboarding.emailsEnabled) {
  return { emailSent: false, kind: "skipped-disabled" };
}
```

**Resend send construction** (copy verbatim from `functions/src/adminEmail.ts:96-109`, `sendAdminOnboardingEmail`):
```typescript
const fromEmail = bareEmailAddress(config.sender.fromAddress);
const displayName = fromDisplayName(orgName);
const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
const resend = new Resend(RESEND_API_KEY.value());
await resend.emails.send({ from, to, subject, text });
```

**Base-URL blank guard** (copy verbatim from `functions/src/adminEmail.ts:50-54`, `resolveAppBaseUrl` — module-private, not exported, write a fresh copy):
```typescript
function resolveAppBaseUrl(): string {
  const base = SERVICE_SHARE_BASE_URL.value().trim();
  if (base === "") return "";
  return base.replace(/\/+$/, "");
}
```

**Content builders** — do NOT import `buildInvitedContent`/`buildAddedContent` (module-private in `adminEmail.ts`, RESEARCH Pitfall 5). Write new builders in the same `{subject, text}`-returning shape as `functions/src/adminEmail.ts:56-82` (`buildAddedContent`/`buildInvitedContent`), e.g. `buildGoogleNotifyContent(orgName, to, baseUrl)` and `buildSetPasswordContent(orgName, to, baseUrl, resetLink)`.

**Best-effort error handling pattern** (copy shape from `functions/src/orgProvisioning.ts:301-320`, `onboardOrganizationHandler`'s post-transaction email try/catch): log with `console.error` including a module-tag prefix (`[inviteOnboarding] ...`), never let a Resend-send failure throw past this function — resolve `{ emailSent: false, kind }` instead. Per RESEARCH's Open-Questions recommendation, a `createUser`/`generatePasswordResetLink` failure (upstream of the Resend send) should THROW `HttpsError` rather than resolve softly, since it means the invitee has no usable path at all — this is a planner discretion call, documented here for consistency.

---

### `functions/src/index.ts` (route/registration, request-response)

**Analog:** existing re-export blocks for `onboardOrganization`, `assignOrgAdmin`, etc.

**Pattern** (copy exact shape):
```typescript
import { sendInviteOnboardingEmail } from "./inviteOnboarding";
export { sendInviteOnboardingEmail };
```
CRITICAL: a function not re-exported here fails `firebase deploy` with "No function matches the filter" (documented project-wide gotcha, CLAUDE.md + RESEARCH.md).

---

### `functions/src/appConfig.ts` (config/model, CRUD)

**Analog:** the `messaging`/`cleanup` groups (lines 24-104, 182-240 approx.)

**Interface addition** (mirror `messaging: {...}` block at line 44-48):
```typescript
export interface AppConfig {
  // ...existing groups...
  onboarding: {
    emailsEnabled: boolean;
  };
}
```

**DEFAULT_APP_CONFIG addition** (mirror `messaging: {...}` default block at line 91-95, default `false` mirrors `cleanup.*`/`messaging.scheduledCronEnabled`):
```typescript
export const DEFAULT_APP_CONFIG: AppConfig = {
  // ...existing groups...
  onboarding: {
    emailsEnabled: false, // fail-safe default until Resend domain verified + owner confirms
  },
};
```

**Coerce function** (mirror `coerceMessaging` at line 230-236, using the shared `coerceEnableFlag` at line 149):
```typescript
function coerceOnboarding(raw: unknown): AppConfig["onboarding"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    emailsEnabled: coerceEnableFlag(r.emailsEnabled),
  };
}
```

**mergeAppConfig wiring** (mirror line 251-260, add one line inside the returned object):
```typescript
export function mergeAppConfig(partial: Partial<AppConfig> | undefined): AppConfig {
  const p = partial ?? {};
  return {
    cleanup: coerceCleanup(p.cleanup),
    // ...
    messaging: coerceMessaging(p.messaging),
    onboarding: coerceOnboarding(p.onboarding),
    // ...
  };
}
```

---

### `src/config/appConfigDefaults.ts` (config/model, client mirror)

**Analog:** the `messaging` block (interface at ~line 36, DEFAULT_APP_CONFIG at ~line 91, mergeAppConfig spread at line 121)

**Pattern** — must stay byte-identical to the server mirror per the file's own header comment:
```typescript
export interface AppConfig {
  // ...
  onboarding: {
    emailsEnabled: boolean;
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  // ...
  onboarding: {
    emailsEnabled: false,
  },
};

export function mergeAppConfig(raw: AppConfigInput | undefined): AppConfig {
  const p = raw ?? {};
  return {
    // ...
    messaging: { ...DEFAULT_APP_CONFIG.messaging, ...p.messaging },
    onboarding: { ...DEFAULT_APP_CONFIG.onboarding, ...p.onboarding },
    // ...
  };
}
```

---

### `src/components/admin/OnboardingConfigCard.vue` (component, request-response)

**Analog:** `src/components/admin/MessagingConfigCard.vue` — specifically only its checkbox block (lines 9-21 template, `cronEnabledInput`/`onToggleCron`/`cronSavedFeedback`/`cronSaveError` script at lines 66-91). Do NOT copy the `ConfigNumberField` numeric-field portion — this phase has no numeric knob.

**Template pattern** (adapt lines 1-21 of `MessagingConfigCard.vue`):
```vue
<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Onboarding Emails</h2>
    <p class="text-xs text-gray-400 mb-3">
      Send an automated onboarding email to invited members (set-password link for
      non-Google addresses, a sign-in notice for Gmail/Google Workspace addresses).
    </p>
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        v-model="emailsEnabledInput"
        type="checkbox"
        @change="onToggleEmailsEnabled"
        class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
      />
      <span class="text-sm text-gray-200">Send invite onboarding emails</span>
    </label>
    <p v-if="savedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
    <p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
  </div>
</template>
```

**Script pattern** (copy shape from `MessagingConfigCard.vue:54-91` verbatim, renaming `messaging.scheduledCronEnabled` → `onboarding.emailsEnabled`):
```typescript
import { ref, watch } from 'vue'
import { useAppConfigStore } from '@/stores/appConfig'

const store = useAppConfigStore()

const emailsEnabledInput = ref(store.resolvedConfig.onboarding.emailsEnabled)
watch(
  () => store.resolvedConfig.onboarding.emailsEnabled,
  (v) => { emailsEnabledInput.value = v },
)

const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

async function onToggleEmailsEnabled(): Promise<void> {
  const newValue = emailsEnabledInput.value
  saveError.value = null
  try {
    await store.saveField('onboarding.emailsEnabled', newValue)
    savedFeedback.value = true
    setTimeout(() => { savedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[OnboardingConfigCard] save onboarding.emailsEnabled error:', err)
    saveError.value = 'Failed to save. Please try again.'
    emailsEnabledInput.value = !newValue // revert on failure
  }
}
```

Note: `isExplicitlySet` provenance-badge pattern (used for numeric fields via `ConfigNumberField`'s `:is-default` prop) is NOT directly wired for this simple checkbox in `MessagingConfigCard.vue`'s own cron toggle either — the cron checkbox has no `(default)` badge, only the numeric fields do. Follow that same precedent: a plain checkbox, no badge, unless CONTEXT.md's mention of the badge pattern is judged to require adding one (in which case `isExplicitlySet(store.rawDoc, 'onboarding.emailsEnabled')` from `@/config/appConfigDefaults` is the import to use).

---

### `src/components/admin/ConfigurationTab.vue` (component parent, EDIT)

**Analog:** existing `MessagingConfigCard` mount

**Pattern** (two one-line edits):
```vue
<!-- template, near line 118 -->
<OnboardingConfigCard />
```
```typescript
// script, near line 143
import OnboardingConfigCard from '@/components/admin/OnboardingConfigCard.vue'
```

---

### `functions/src/inviteOnboarding.test.ts` (test)

**Analogs:** `functions/src/orgProvisioning.test.ts` (FakeFirestore + mocked `getAuth()`) and `functions/src/adminEmail.test.ts` (mocked `resend` + `firebase-functions/params` seams)

Extend the mocked `getAuth()` to also stub `createUser` and `generatePasswordResetLink` (both new to this codebase — no existing mock precedent for them; add fresh `vi.fn()` mocks alongside the existing `getUserByEmail` mock). Test grouping per RESEARCH's Phase Requirements → Test Map: `"google"` (R289), `"set-password"` (R290), `"createUser"` (R291), `"disabled"` (R293), `"caller"` (auth gate).

---

### `functions/src/appConfig.test.ts` (test, EDIT)

**Analog:** existing `coerceMessaging`/`coerceCleanup` describe blocks — add parallel `coerceOnboarding` cases (default-false on missing/malformed input, `true` only on literal `true`) plus extend the `DEFAULT_APP_CONFIG` shape assertion.

---

### `src/config/__tests__/appConfigDefaults.test.ts` (test, EDIT)

**Analog:** existing drift-guard snapshot comparing `src/config/appConfigDefaults.ts` against `functions/src/appConfig.ts` byte-for-byte. Will fail immediately after the `appConfig.ts`/`appConfigDefaults.ts` edits until this file's expectations are updated to include `onboarding.emailsEnabled` — by design (documented in RESEARCH Wave 0 Gaps).

## Shared Patterns

### Caller-gate discipline (auth + authorization)
**Source:** `functions/src/orgProvisioning.ts:97-109` (`assertSuperAdminCaller`, pattern shape only — DO NOT use this one, it's super-admin) and `functions/src/index.ts:2609-2668` (`queueServiceMessageHandler`'s inline org-editor gate — the actual pattern to copy)
**Apply to:** `inviteOnboarding.ts`'s handler, as the very first thing it does before any Firestore write or Auth call.

### Best-effort external-call error handling
**Source:** `functions/src/orgProvisioning.ts:301-320` (`onboardOrganizationHandler`'s post-transaction email step) and `functions/src/adminEmail.ts`'s "throws on send failure so the caller can distinguish" contract
**Apply to:** `inviteOnboarding.ts`'s Resend-send step specifically (soft-fail to `{emailSent:false}`); Auth provisioning failures (`createUser`/`generatePasswordResetLink`) should throw per RESEARCH's Open Questions recommendation — these are NOT the same tier.

### appConfig extension (interface + DEFAULT + coerce + mergeAppConfig, server AND client mirror)
**Source:** `functions/src/appConfig.ts` (server) + `src/config/appConfigDefaults.ts` (client) — the `messaging`/`cleanup` groups
**Apply to:** the new `onboarding.emailsEnabled` group in both files; must stay byte-identical or the drift-guard test fails.

### Boolean-toggle Owner Console card (immediate-save-on-change, no Save button)
**Source:** `src/components/admin/MessagingConfigCard.vue` lines 9-21, 66-91 (the `scheduledCronEnabled` checkbox portion only)
**Apply to:** `OnboardingConfigCard.vue`'s single checkbox, via `store.saveField('onboarding.emailsEnabled', value)`.

### Resend email send construction (From-header, sender config)
**Source:** `functions/src/adminEmail.ts:91-109` (`sendAdminOnboardingEmail`)
**Apply to:** `inviteOnboarding.ts`'s send step, verbatim reuse of `bareEmailAddress`/`fromDisplayName`/`config.sender.fromAddress`/`RESEND_API_KEY.value()` from `params.ts`/`appConfig.ts`.

## No Analog Found

None — every file this phase touches has a strong existing analog in the codebase (this phase is explicitly scoped by RESEARCH.md as a "compose from existing, proven parts" task). The two genuinely new Admin SDK calls (`admin.auth().createUser`, `getAuth().generatePasswordResetLink`) have no in-repo precedent to copy from — their usage is CITED against official Firebase docs in RESEARCH.md's Code Examples section instead (see `functions/src/inviteOnboarding.ts` entry above for the citation-backed snippets).

## Metadata

**Analog search scope:** `functions/src/` (orgProvisioning.ts, adminEmail.ts, appConfig.ts, index.ts, params.ts, orgProvisioning.test.ts, adminEmail.test.ts, appConfig.test.ts), `src/config/` (appConfigDefaults.ts, __tests__/appConfigDefaults.test.ts), `src/components/admin/` (MessagingConfigCard.vue, ConfigurationTab.vue)
**Files scanned:** ~11 (read in full or targeted ranges this session)
**Pattern extraction date:** 2026-08-30
