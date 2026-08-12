---
status: awaiting_human_verify
trigger: "service-plan item delete STILL failing with Firestore rules Null value error (3rd occurrence), evaluation error at L160:26 for delete"
created: 2026-08-12
updated: 2026-08-12
---

## Current Focus

hypothesis: CONFIRMED — never-materialized slideGroup delete -> resource == null -> resource.data.keys() dereferences null -> "Null value error".
test: Emulator probe "delete a NEVER-MATERIALIZED group" reproduced the byte-identical error; fix (resource == null first OR operand) flips it GREEN; full suite 149/149.
expecting: Owner reload/deploy of firestore.rules for the live env to recover.
next_action: AWAITING owner — reload emulator (if localhost uses it) and/or `firebase deploy --only firestore:rules` for production. Fix committed 03b96bc.

## Symptoms

expected: Deleting a service-plan item (slot) removes it. Client confirmSlotDelete awaits slideGroups deleteGroup, which must succeed.
actual: PERMISSION_DENIED: evaluation error at L160:26 for 'delete' @ L160, false for 'delete' @ L248, false for 'delete' @ L368, Null value error. Slot stays.
errors: "evaluation error at L160:26 ... Null value error" (3rd occurrence; was L153:26 before the 38df34f fix shifted +7 lines)
reproduction: Owner on localhost, 2026-08-12, confirmSlotDelete -> deleteGroup await rejects.
started: Recurring; "fixed" twice (38df34f and prior). Still fails.

## Eliminated

## Evidence

- timestamp: 2026-08-12
  checked: firestore.rules L160 column 26
  found: L160:26 = the `isOrgEditor(orgId)` token, which is the START of the `allow delete: if <expr>` boolean. Firestore reports evaluation errors at the statement-start position, NOT the exact erroring sub-expression (prior SUMMARY confirms this: L153:26 was reported but the real null was in the serviceId branch).
  implication: The surviving null-deref could be ANYWHERE in L160-170 or inside isOrgEditor. Do not assume it is isOrgEditor.

- timestamp: 2026-08-12
  checked: Prior fix SUMMARY (20260811-service-plan-item-delete-permission)
  found: Fix added `|| resource.data.serviceId == null` to the delete OR-chain and made isOrgEditor exists()-guarded with `.data.get('role','')`. 147/147 rules tests passed. deploy_required: true, NOT deployed.
  implication: Two hypotheses live — (1) a DIFFERENT null-deref shape survived the fix; (2) deploy staleness (localhost hits prod, fix never deployed). But error moved L153->L160 (+7), suggesting the FIXED rule is what's evaluated.

## Reasoning Checkpoint

hypothesis: Deleting a slot whose slideGroup was NEVER materialized calls deleteDoc on a non-existent doc; the rule evaluates with resource==null; `resource.data.keys().hasAll(['serviceId'])` dereferences null.data -> "Null value error" -> rule errors -> DENY.
confirming_evidence:
  - Probe "delete a NEVER-MATERIALIZED group" reproduced the EXACT error: "evaluation error at L160:26 ... Null value error." (byte-identical to owner report)
  - The other erroring shapes (list/map serviceId) give a DIFFERENT error ("Unsupported operation error"), and the client types serviceId as string so cannot write them.
  - Client seam confirmed: confirmSlotDelete -> deleteGroup unconditionally for any slotId (ServiceEditorView.vue:2880); slideGroups store comment relies on deleteDoc-missing-is-a-no-op, which is false once the rule errors.
  - The same resource==null pattern is already documented as load-bearing in THIS file for serviceShareLinks (T-41-09, L301-315).
falsification_test: Add `resource == null ||` as the first operand of the delete OR-group; if the null-deref theory is right, the never-materialized delete flips RED->GREEN and no other test regresses.
fix_rationale: `resource == null` short-circuits the OR to true BEFORE any resource.data access, so null is never dereferenced. Still gated by isOrgEditor(orgId) so org isolation is preserved (only an org editor can delete a non-existent doc under that org). Deleting a non-existent doc is harmless (no data). Mirrors the existing T-41-09 idiom verbatim.
blind_spots: list/map serviceId still errors (Unsupported operation, not Null value) but is unreachable from the typed client — left unfixed to stay minimal; noted in report.

## Resolution

root_cause: The slideGroups `allow delete` rule dereferences `resource.data` (via `resource.data.keys().hasAll(['serviceId'])`) as its first OR operand. When a slot's slideGroup was never materialized, the deleted doc does not exist, so `resource == null` and `resource.data` raises "Null value error" — the rule errors, which Firestore treats as DENY. Prior fixes only guarded the group document's FIELD shapes (null/absent serviceId, isOrgEditor role); none guarded the document NOT EXISTING.
fix: Add `resource == null ||` as the first operand of the delete OR-group in firestore.rules, still under the isOrgEditor(orgId) gate.
verification: RED (never-materialized delete errors "Null value error") -> GREEN after fix; full rules suite passes.
files_changed: [firestore.rules, src/rules.test.ts]
