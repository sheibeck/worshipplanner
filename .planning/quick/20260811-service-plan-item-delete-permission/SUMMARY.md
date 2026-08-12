---
status: complete
slug: service-plan-item-delete-permission
date: 2026-08-11
deploy_required: true
---

# Quick fix — Service-plan item delete blocked by `PERMISSION_DENIED`

## Symptom (owner report)
Clicking ✕ on a service-plan item → confirm modal → Delete does nothing; the item is not removed.
Console: `ServiceEditorView.vue:2791 Failed to delete slide group for removed slot: FirebaseError:
PERMISSION_DENIED: evaluation error at L153:26 for 'delete' @ L153 … Null value error.`

## Root cause
`confirmSlotDelete` (`ServiceEditorView.vue:2826-2839`) awaits the slideGroups `deleteGroup` **first** and,
on failure, deliberately **aborts** without removing the slot — so a denied slide-group delete leaves the
item in place. The delete was denied because the `firestore.rules` `slideGroups` delete rule **errored**
(a rule that errors is treated as DENY), via two unguarded null-derefs both reachable at the `allow delete`
line:

1. **`serviceId` present-but-null.** The orphan-guard only caught a *missing* `serviceId` key
   (`!keys().hasAll(['serviceId'])`). A group whose `serviceId` field is present **but null** fell through
   to `parentGone(null)` → `svcPath(null)` builds a path with a null segment → *"Null value error"* → the
   group was **wedged undeletable**. (For an editor — whose `isOrgEditor` returns true — this is the actual
   null; Firestore reported the error at the statement start, `L153:26` = `isOrgEditor`.)
2. **`isOrgEditor` unguarded `get().data.role`.** Unlike its sibling `isOrgMember` (which uses `exists()`),
   `isOrgEditor` did a bare `get(members/uid).data.role` — which errors (→ deny) when the caller has no
   member doc or no `role` field. Hardened as defense-in-depth so the delete rule can never error.

## Fix (`firestore.rules`)
- `isOrgEditor`: now `isSignedIn() && exists(memberPath) && get(memberPath).data.get('role','') in ['editor','admin']` — resolves to a clean `false` instead of erroring. Behavior-preserving for real editors (all 147 rules tests pass).
- `slideGroups` delete: added `|| resource.data.serviceId == null` to the orphan branch (reached only when the key is present, so the dot-access is null-safe), so a present-but-null `serviceId` is treated as an orphan (deletable) and `parentGone/parentDraft(null)` is never evaluated.

No client change: the client's `serviceId` write paths are typed `string` + `stripUndefined`, so they
never write `null` (a missing value becomes an *absent* key, which was already deletable). The null-serviceId
group is a legacy/edge artifact; the rule fix makes it — and any future one — deletable.

## Tests (`src/rules.test.ts`, emulator-backed)
New `describe('slideGroups delete null-safety')` — 7 cases, all green against the running emulator:
- ALLOW: editor deletes a null-serviceId group (the wedged-orphan — RED on the old rules, GREEN now),
  a legacy no-serviceId group, a valid-serviceId+draft-parent group, and an orphan (parent gone).
- DENY (preserved): a valid-serviceId group whose parent is **planned/locked**; a signed-in non-member;
  a member whose doc has no `role`.

**Gates:** `npx vitest run --config vitest.rules.config.ts` → **147/147 pass** (0 regressions).
`npm run type-check` (vue-tsc --build) → clean.

## ⚠ DEPLOY REQUIRED (owner step)
`firestore.rules` changes are inert until deployed. The bug persists in production until:

```
firebase deploy --only firestore:rules
```

Per the standing grant, deploys are the owner's step — this was NOT deployed by the fix.
