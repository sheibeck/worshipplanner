---
status: resolved
trigger: |
  DATA_START
  Non-Gmail users cannot complete login/account setup. When a new user like
  bob@someemail.com is added via the in-app invite UI, they appear to receive no
  email and have no way to set their password. Attempting to use the "reset
  password" link to set up a password does not work. Need to vet the full
  non-Google (email/password) login flow end-to-end and fix whatever is broken.
  Note: testing so far has been done exclusively with Gmail/Google sign-in accounts.
  DATA_END
created: 2026-08-30
updated: 2026-08-30
---

# Debug Session: non-gmail-password-setup

## Symptoms

- **Expected behavior:** An admin invites a non-Google user (e.g. bob@someemail.com)
  through the in-app invite UI. The invited user receives an email allowing them to
  set a password and sign in with email/password. A "forgot/reset password" flow also
  works for setting or recovering a password.
- **Actual behavior:** Invited non-Gmail user appears to receive no email and has no
  way to set a password. Using "reset password" to establish a password does not work.
- **Error messages:** Unknown — not yet captured (user unsure of exact failure point).
- **Timeline:** Likely never worked; all prior testing used Google/Gmail sign-in, so
  the email/password path was never exercised.
- **Reproduction:** Invite a non-Gmail email via the in-app invite UI; observe no email;
  attempt "reset password" to set a password; it fails.

## Key context (from intake)

- Invite path: **in-app invite UI** — the app is expected to trigger the invite/email.
- Reset symptom: **unsure** — could be no email sent, email not delivered, or a broken
  action link. Investigation must determine which.
- Auth stack: Firebase Authentication. Google sign-in works; email/password path unvetted.

## Current Focus

reasoning_checkpoint:
  hypothesis: "TeamView.vue's in-app 'Invite a team member' flow (onInvite) never sends
    any email and never creates a Firebase Auth account for the invited user — it only
    writes two Firestore documents (organizations/{orgId}/invites/{email} and
    inviteLookup/{email}). Firebase Auth account creation for an email/password user is
    deferred entirely to the invitee's FIRST successful sign-in attempt (Google popup, or
    LoginView.vue's plain 'Sign in' form, whose loginWithEmail() silently falls through to
    createUserWithEmailAndPassword when signInWithEmailAndPassword fails with
    auth/user-not-found or auth/invalid-credential). No UI copy anywhere tells a first-time
    invitee this 'type any password into Sign in' mechanic exists. Because of this, the
    'Forgot password?' flow can never work for a new invitee either — sendPasswordResetEmail
    can only reset a password for an account that already exists, and theirs does not exist
    until they've already signed in once by some other means. This is a self-consistent,
    single root cause that explains all three reported symptoms at once (no email, no way
    to set a password, reset-password not working)."
  confirming_evidence:
    - "src/views/TeamView.vue:260-286 onInvite() — reads directly: batch.set on
      organizations/{orgId}/invites/{email} and inviteLookup/{email} only. No callable
      function invoked, no sendPasswordResetEmail/sendSignInLinkToEmail, no admin.auth()
      call of any kind on this path."
    - "src/stores/auth.ts:732-796 ensureUserDocument() — the ONLY place a members/{uid} doc
      is created from an invite; it runs from onAuthStateChanged/loginWithGoogle/
      loginWithEmail/registerWithEmail, i.e. only AFTER the user has already authenticated.
      There is no earlier point where an Auth account is provisioned for an invited email."
    - "src/stores/auth.ts:813-831 loginWithEmail() — auto-creates
      (createUserWithEmailAndPassword) on auth/user-not-found or auth/invalid-credential;
      this is the ONLY account-bootstrap path for a non-Google invitee, and it is triggered
      by the plain 'Sign in' button with no distinguishing copy/affordance."
    - "src/views/LoginView.vue — 'Sign in' form has no 'Create account' link or explanatory
      copy; 'Forgot password?' is the only other affordance, which requires a pre-existing
      account and therefore cannot bootstrap a first-time invitee."
    - ".planning/milestones/v1.0-phases/07-.../07-CONTEXT.md:19,89 — explicit, documented
      product decision: 'No email is sent — the editor tells the person verbally to sign
      up... The invite flow is deliberately low-tech: no email service, no Firebase
      Functions.' Confirms 'no email' is original intended behavior, not a regression —
      but the UI's 'Invite sent to {email}!' copy (TeamView.vue:38) actively contradicts
      this design by claiming an email WAS sent."
    - "functions/src/orgProvisioning.ts (onboardOrganizationHandler) + adminEmail.ts
      (sendAdminOnboardingEmail) — a DIFFERENT invite path (super-admin 'onboard
      organization' / assign-org-admin) DOES send a real email via Resend, proving the
      team has a working send pattern available, but it was never wired into TeamView's
      ordinary team-member invite. Even that email's 'invited' copy only says 'sign in
      with this email to get started' — no password-set link, same undiscoverable
      auto-create-on-sign-in reliance."
    - "functions/DEPLOY-EMAIL-DOMAIN.md + functions/src/appConfig.ts:102 — even the
      EXISTING Resend send path defaults to onboarding@resend.dev, which 'only delivers to
      the Resend account owner's own inbox' until the owner completes an external DNS
      domain-verification runbook. This is a secondary, deployment-level precondition any
      email-based fix would also need, independent of the code-level root cause."
    - "firebase.json + src/router — no custom __/auth/action handler route exists; the app
      relies entirely on Firebase's default hosted action-handling page for any password-
      reset link (not itself broken, just confirms nothing custom is/was built)."
  falsification_test: "If TeamView.vue's onInvite() called any email-sending code (Cloud
    Function, sendPasswordResetEmail, sendSignInLinkToEmail) OR if ensureUserDocument /
    a Cloud Function trigger created a Firebase Auth account for the invited email at
    invite time (not lazily at first sign-in), this hypothesis would be false. Read in
    full; neither exists on this path."
  fix_rationale: "The root cause is a genuine capability gap (by original Phase 07 design),
    not a broken implementation of an existing capability — there is no small code change
    that 'fixes' a feature that was deliberately never built. A correct fix requires: (1) a
    new server-side email dispatch on invite (mirroring the existing
    sendAdminOnboardingEmail/Resend pattern), and (2) a real Auth-account-bootstrap
    mechanism usable BEFORE first sign-in (e.g. admin.auth().createUser +
    generatePasswordResetLink, or sendSignInLinkToEmail/passwordless), since Firebase's
    password reset cannot operate on an account that doesn't exist yet. This is a design
    decision with production/security implications (which bootstrap mechanism, secrets
    usage, and an external Resend domain-verification prerequisite for real delivery) —
    not a 'smallest fix' debugging patch."
  blind_spots: "Whether the Firebase Console's Email/Password sign-in provider is actually
    toggled ON in production is UNVERIFIED — a live Identity Toolkit API check was
    attempted (gcloud access token + REST call) and was blocked by the sandbox's auto-mode
    permission classifier as a live-credential action. If it is OFF, signInWithEmailAndPassword
    / createUserWithEmailAndPassword both throw auth/operation-not-allowed, which
    LoginView.vue's mapFirebaseError() does not specifically handle (falls to the generic
    'Sign-in failed. Please try again.' message) — this would look identical to the
    reported symptom and compounds, but does not replace, the primary root cause above.
    Needs an owner check: Firebase Console -> Authentication -> Sign-in method ->
    Email/Password."

next_action: DONE — applied the misleading-copy fix in TeamView.vue (verified via
  `npx vitest run src/views/__tests__/TeamView.test.ts`, 8/8 pass). Root cause fully
  diagnosed and documented in Resolution below. AWAITING owner decision on fix direction
  for the structural gap (no real invite email, no password-bootstrap mechanism for a
  brand-new non-Google user) before any further code is written — see Resolution.fix for
  the three concrete direction options to choose from.

## Owner Decisions (2026-08-30)

- **Bootstrap mechanism CHOSEN:** (a) set-password link — a new Cloud Function calls
  `admin.auth().createUser()` for the invited email, then emails a
  `generatePasswordResetLink()` ("set your password") link via the existing Resend
  pattern (`functions/src/adminEmail.ts`). Rejected: passwordless magic link.
- **Build route CHOSEN:** proper GSD phase — handed off to a NEW MILESTONE (v2.5,
  "Non-Google User Onboarding") via `/gsd-new-milestone`, since v2.4 is shipped/archived.
- **Interim copy fix:** committed (a1b65032) — truthful "no email is sent" post-invite
  message; will be replaced when the real invite-email flow ships.
- **OWNER TODO before/for the phase (external, unautomatable):**
  1. Verify Firebase Console → Authentication → Sign-in method → **Email/Password is
     ENABLED** for `worship-planner-bc515` (if OFF, sign-in/create both throw
     `auth/operation-not-allowed`; compounding secondary cause).
  2. Complete `functions/DEPLOY-EMAIL-DOMAIN.md` Resend DNS domain verification, or real
     invite emails to non-owner addresses will silently not deliver (default
     `onboarding@resend.dev` only reaches the Resend account owner's inbox).

This debug session is RESOLVED (root cause found + interim fix shipped). The structural
build is tracked as milestone v2.5.

## Evidence

- timestamp: 2026-08-30
  checked: src/stores/auth.ts (full file)
  found: loginWithEmail() auto-creates an account via createUserWithEmailAndPassword when
    signInWithEmailAndPassword throws auth/user-not-found or auth/invalid-credential.
    resetPassword() is a thin wrapper around sendPasswordResetEmail(auth, email) with no
    actionCodeSettings. ensureUserDocument() is the sole invite-redemption point, reading
    inviteLookup/{email} and granting org membership — but only runs post-authentication.
  implication: email/password IS wired into the app's auth layer (not Google-only in code),
    but account creation for an invited user is entirely lazy/implicit and undiscoverable.

- timestamp: 2026-08-30
  checked: src/views/TeamView.vue (onInvite, lines 235-298)
  found: onInvite() writes organizations/{orgId}/invites/{email} and inviteLookup/{email}
    via a Firestore batch only. No callable/HTTP function invoked. UI shows "Invited!" and
    "Invite sent to {email}!" on success.
  implication: the in-app invite flow performs zero email dispatch and zero Auth account
    provisioning; the success copy is misleading (an admin is told an email was sent when
    none was).

- timestamp: 2026-08-30
  checked: src/views/LoginView.vue (full file)
  found: "Sign in" form has no register/create-account affordance or copy. "Forgot
    password?" -> handleForgotPassword -> authStore.resetPassword(email) ->
    sendPasswordResetEmail. No indication anywhere that typing a new password into "Sign
    in" creates an account.
  implication: an invited user who tries "Forgot password" (the natural first move for
    someone with no password) hits a dead end — Firebase can't reset a password for an
    account that doesn't exist yet, and nothing tells them to just "sign in" instead.

- timestamp: 2026-08-30
  checked: .planning/milestones/v1.0-phases/07-invite-users-.../07-CONTEXT.md
  found: explicit locked decision (2026-03-04): "No email is sent — the editor tells the
    person verbally to sign up; the app matches them by email on sign-in." "The invite
    flow is deliberately low-tech: no email service, no Firebase Functions."
  implication: the "no email" behavior is original intended design, not a regression —
    the actual defect is (a) the misleading UI copy contradicting that design, and (b) the
    design itself has no working bootstrap path for a user who wasn't personally told the
    trick, which is exactly what the bug report describes.

- timestamp: 2026-08-30
  checked: functions/src/orgProvisioning.ts + functions/src/adminEmail.ts
  found: a SEPARATE super-admin-only invite path (onboardOrganization / assignOrgAdmin)
    DOES send a real email via Resend (sendAdminOnboardingEmail), gated on RESEND_API_KEY.
    Its "invited" copy: "Sign in to Worship Planner with this email address ({to}) to get
    started" — still relies on the same undiscoverable auto-create-on-sign-in mechanic, no
    password-set link.
  implication: a working Resend send pattern already exists in the codebase and could be
    extended to TeamView's invite flow, but (1) was never wired there, and (2) even where
    it exists, doesn't solve the "how does a brand-new user get a password" problem.

- timestamp: 2026-08-30
  checked: functions/DEPLOY-EMAIL-DOMAIN.md, functions/src/appConfig.ts:102
  found: DEFAULT_APP_CONFIG.sender.fromAddress = "onboarding@resend.dev", which per the
    runbook "only delivers to the Resend account owner's own inbox" until a real domain is
    DNS-verified in Resend by the owner (external, unautomatable ops work).
  implication: even a fully-wired invite email would silently fail to reach a real
    non-owner invitee (bob@someemail.com) unless this owner-run domain verification has
    already been completed — a secondary precondition for any email-based fix.

- timestamp: 2026-08-30
  checked: firestore.rules lines 240-288 (members/{uid} create rule)
  found: the invite-acceptance branch (getAfter/get() logic, R104) matches the current
    ensureUserDocument()/TeamView.vue invite data shape exactly — role compared against
    organizations/{orgId}/invites/{email}'s stored role, both invite docs written with the
    same role value. No rules mismatch found on this path.
  implication: eliminates "security rules silently reject invite-acceptance membership
    writes" as a contributing cause — ruled out.

- timestamp: 2026-08-30
  checked: attempted live check of Firebase Auth sign-in provider config via gcloud access
    token + Identity Toolkit Admin API REST call
  found: blocked by the sandbox's auto-mode permission classifier (live-credential/
    production API action denied).
  implication: cannot confirm from this session whether Email/Password sign-in is actually
    toggled ON in the Firebase Console for worship-planner-bc515 — flagged as an open
    blind spot requiring an owner-side manual check, not ruled in or out.

## Eliminated

- hypothesis: firestore.rules denies the invite-acceptance membership write (a security
    rules regression), causing ensureUserDocument()'s batch.commit() to silently fail.
  evidence: firestore.rules:249-280 (R104 rule) was read directly and matches the exact
    role/email shape TeamView.vue's invite docs and auth.ts's ensureUserDocument() write —
    invites/{email}.role equals inviteLookup/{email}.role at write time, and the rule's
    get()/exists() branch checks the correct (org-scoped invites) doc. No mismatch found.
  timestamp: 2026-08-30

- hypothesis: the app is Google-sign-in-only in code, with no email/password provider
    wiring at all (i.e. the "email/password path" literally doesn't exist client-side).
  evidence: src/stores/auth.ts imports and calls signInWithEmailAndPassword,
    createUserWithEmailAndPassword, and sendPasswordResetEmail; src/views/LoginView.vue
    renders a full email/password sign-in form plus a forgot-password flow. The client-side
    wiring exists and is reasonably complete (including a defensible handling of both
    auth/user-not-found and auth/invalid-credential for the enumeration-protection case).
  timestamp: 2026-08-30

## Resolution

root_cause: |
  TeamView.vue's in-app "Invite a team member" flow (onInvite, src/views/TeamView.vue:235-298)
  performs ONLY two Firestore batch writes (organizations/{orgId}/invites/{email} and
  inviteLookup/{email}) — no email is ever sent (no Cloud Function, no sendPasswordResetEmail,
  no sendSignInLinkToEmail) and no Firebase Auth account is created for the invited email.
  This is confirmed as the ORIGINAL, deliberate Phase 07 product design (07-CONTEXT.md,
  2026-03-04): "No email is sent — the editor tells the person verbally to sign up... no email
  service, no Firebase Functions." An invited user's Firebase Auth account is created lazily,
  only on their FIRST successful sign-in — via Google, or via LoginView.vue's plain "Sign in"
  form, whose loginWithEmail() silently auto-creates an account (createUserWithEmailAndPassword)
  with whatever password they type, when signInWithEmailAndPassword fails with
  auth/user-not-found or auth/invalid-credential. Nothing in the UI communicates this
  auto-create-on-sign-in mechanic to a first-time invitee (no "Create account" link/copy), and
  "Forgot password?" — the natural next move for someone with no password — cannot work for
  them either: Firebase's sendPasswordResetEmail can only reset a password for an account that
  already exists, and theirs doesn't exist until they've already signed in some other way. This
  single root cause accounts for all three reported symptoms (no email received, no way to set
  a password, reset-password not working). Firestore security rules were verified NOT to be a
  contributing cause (Eliminated). Whether the Firebase Console's Email/Password provider is
  toggled ON in production is unverified (blocked by sandbox classifier on a live API check) —
  flagged as an owner-side follow-up, not part of the confirmed root cause.

fix: |
  Applied now (small, safe, self-contained): corrected TeamView.vue's misleading
  post-invite success copy ("Invited!" / "Invite sent to {email}!"), which claimed an email
  was dispatched when none is, per the confirmed by-design "no email" behavior. New copy makes
  clear the invite record was created and that the admin must tell the person to sign in.

  NOT applied (requires a design decision + owner-run external ops, out of debug-fix scope):
  a real invite-notification email + a working password-bootstrap mechanism for a brand-new
  non-Google user. The existing Resend-based pattern (functions/src/adminEmail.ts +
  orgProvisioning.ts's onboardOrganization) could be extended to TeamView's invite flow, but
  needs (1) a chosen account-bootstrap mechanism usable BEFORE first sign-in — e.g.
  admin.auth().createUser() + generatePasswordResetLink(), or sendSignInLinkToEmail
  (passwordless) — since Firebase cannot reset a password for an account that doesn't exist
  yet, and (2) the owner completing functions/DEPLOY-EMAIL-DOMAIN.md's Resend domain
  verification runbook, since the default onboarding@resend.dev sender only delivers to the
  Resend account owner's own inbox. Recommended: route this through a proper GSD phase
  (new Cloud Function + secrets + UI wiring + tests) rather than an ad hoc debug patch.

verification: pending — see fix note above; the UI-copy correction is self-evidently correct
  (matches actual behavior) but the full symptom (no way to set a password) is NOT yet
  resolved and remains open pending the owner's decision on fix direction.

files_changed:
  - src/views/TeamView.vue (corrected misleading post-invite success/error copy — no
    functional/logic change)
