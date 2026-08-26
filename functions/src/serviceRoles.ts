/**
 * Server-side recipient resolver (Phase 59, R131/R139).
 *
 * `functions/` is a standalone TypeScript project (its own tsconfig with
 * include:["src"], no `@/` alias — it cannot import from the client `src/` tree),
 * so this file is a DUPLICATE of the pure client resolvers rather than an import,
 * following the same precedent as `functions/src/pptxParser.ts` (which hand-mirrors
 * the app slide types). Ported verbatim from:
 *   src/utils/serviceRoles.ts        -> findQuarterForDate, resolveServiceRoleAssignments
 *   src/utils/messagingRecipients.ts -> the reachability split of resolveRecipients
 *
 * The port is PURE (types only, no Firestore): 59-03's sendQueuedMessageHandler
 * Admin-SDK-loads the service/quarters/roles/people arrays in the CALLER and feeds
 * them through these functions. Keep the resolve body in lockstep with the client
 * originals — a drift would make the server send list disagree with the composer's
 * "Reaches N" estimate.
 *
 * The ONLY behavioral addition over the client resolver is per-recipient roleNames
 * (resolveMessageRecipients), which the send trigger needs to render {{their_roles}}
 * correctly for each recipient (R139).
 *
 * Phase 85 (R250): the client narrowed RoleGroup to "band" | "tech" | "other" and
 * folded vocals into Band via a `vocal` flag, with a read-time compat shim
 * (src/stores/roster.ts) coercing any legacy `group: 'vocals'` doc to
 * `{ group: 'band', vocal: true }`. This file's RoleGroup is narrowed to match, and
 * the equivalent coercion is applied where roles are Admin-SDK-loaded
 * (functions/src/index.ts, sendQueuedMessageHandler) — the ONE read boundary on the
 * server side, mirroring the client's ONE read boundary in roster.ts's onSnapshot.
 */

// Minimal functions-local domain types, hand-mirrored from the app's canonical
// types (src/types/roster.ts, src/types/service.ts). Only the fields the algorithm
// touches are declared — not the full Firestore document shapes.
export type RoleGroup = "band" | "tech" | "other";

export interface PortedRole {
  id: string;
  name: string;
  group: RoleGroup;
  /** true for a singing role — a Band role exempt from the one-instrument cap
   *  (R250/R252). Not used by resolveMessageRecipients' team matching (a vocal
   *  role already carries group: 'band'), but ported for shape parity with the
   *  client Role type and to keep the read-time coercion below self-describing. */
  vocal?: boolean;
  order: number;
}

/**
 * Read-time compat shim (R250, mirrors src/stores/roster.ts's onSnapshot shim):
 * coerces a legacy role doc stored with `group: 'vocals'` to `{ group: 'band',
 * vocal: true }`. Read-time ONLY — no Firestore write migration is performed (same
 * "no data migration" decision as the client). Exported (rather than inlined at the
 * call site) so the server's one role-load boundary
 * (functions/src/index.ts, sendQueuedMessageHandler) and this file's own tests share
 * exactly one coercion implementation — the drift this function exists to close was
 * that a raw, un-shimmed Admin SDK read let a legacy vocalist silently drop out of a
 * "Band" team send while the client's "Reaches N" estimate still counted them
 * (CR-01, 85-REVIEW.md).
 */
export function coerceLegacyRoleGroup(data: {
  group?: string;
  vocal?: boolean;
  [key: string]: unknown;
}): { group: RoleGroup; vocal?: boolean } {
  if (data.group === "vocals") {
    return { group: "band", vocal: data.vocal ?? true };
  }
  return { group: data.group as RoleGroup, vocal: data.vocal };
}

export interface PortedService {
  date: string;
  roleAssignmentOverrides?: Record<string, string[]>;
}

export interface PortedQuarter {
  serviceDates: string[];
  calendar: Record<string, Record<string, string[]>>;
}

export interface PortedPerson {
  id: string;
  name: string;
  email: string;
}

export interface RecipientSelection {
  teams: RoleGroup[];
  individualPersonIds: string[];
  includeEveryone: boolean;
}

export interface ResolvedRoleAssignment {
  roleId: string;
  roleName: string;
  group: RoleGroup;
  scheduledPersonIds: string[];
  overriddenPersonIds: string[] | null;
  effectivePersonIds: string[];
}

export interface ReachableRecipient {
  id: string;
  name: string;
  email: string;
  /** Names of every matched role this person effectively fills (R139 basis). */
  roleNames: string[];
}

/**
 * Returns the first quarter whose serviceDates includes the given date, or
 * undefined when none match. First-match in array order is the deterministic,
 * documented tie-break (verbatim from the client resolver).
 */
export function findQuarterForDate(
  quarters: PortedQuarter[],
  date: string,
): PortedQuarter | undefined {
  return quarters.find((q) => q.serviceDates.includes(date));
}

/**
 * Resolves, for each role sorted by order, the effective person assignment for a
 * service's date: override ?? quarter-scheduled ?? []. Overrides are never mutated
 * onto the schedule — the Quarter/calendar remains the unmerged source of truth.
 */
export function resolveServiceRoleAssignments(
  service: PortedService,
  quarters: PortedQuarter[],
  roles: PortedRole[],
): ResolvedRoleAssignment[] {
  const quarter = findQuarterForDate(quarters, service.date);
  const scheduleForDate = quarter?.calendar[service.date] ?? {};

  return roles
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((role) => {
      const scheduledPersonIds = scheduleForDate[role.id] ?? [];
      const overriddenPersonIds = service.roleAssignmentOverrides?.[role.id] ?? null;
      return {
        roleId: role.id,
        roleName: role.name,
        group: role.group,
        scheduledPersonIds,
        overriddenPersonIds,
        effectivePersonIds: overriddenPersonIds ?? scheduledPersonIds,
      };
    });
}

/**
 * Resolves a { teams, individualPersonIds, includeEveryone } selection into
 * deduped (by person id), reachability-split recipient lists with per-recipient
 * roleNames. Server-side enrichment of the client resolveRecipients split.
 *
 * - includeEveryone matches every assigned role regardless of group.
 * - A person assigned to two matching roles/teams is deduped to one entry and
 *   accumulates BOTH role names (in resolve order) onto roleNames.
 * - A matched person with email === '' is excluded from `reachable` and
 *   increments `unreachableCount`.
 * - An unfilled role (effectivePersonIds === []) contributes 0 recipients and
 *   does NOT change unreachableCount.
 * - A matched personId absent from `people` (stale/deleted) is silently skipped
 *   and does NOT increment unreachableCount.
 * - individualPersonIds are always included; a person matched ONLY as an
 *   individual carries roleNames === [] (no team role accrues to them).
 *
 * PURE: the caller (59-03 sendQueuedMessageHandler) resolves `assignments` via
 * resolveServiceRoleAssignments and loads `people` from Firestore, then feeds
 * both arrays here — no Firestore access inside this function.
 */
export function resolveMessageRecipients(
  assignments: ResolvedRoleAssignment[],
  people: PortedPerson[],
  selection: RecipientSelection,
): { reachable: ReachableRecipient[]; unreachableCount: number } {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const roleNamesByPerson = new Map<string, string[]>();
  const matchedOrder: string[] = []; // first-seen order, mirrors the client Set iteration

  const ensure = (pid: string): string[] => {
    let names = roleNamesByPerson.get(pid);
    if (!names) {
      names = [];
      roleNamesByPerson.set(pid, names);
      matchedOrder.push(pid);
    }
    return names;
  };

  for (const a of assignments) {
    const matchesTeam = selection.includeEveryone || selection.teams.includes(a.group);
    if (!matchesTeam) continue;
    for (const pid of a.effectivePersonIds) {
      const names = ensure(pid);
      if (!names.includes(a.roleName)) names.push(a.roleName);
    }
  }
  for (const pid of selection.individualPersonIds) ensure(pid);

  const reachable: ReachableRecipient[] = [];
  let unreachableCount = 0;
  for (const pid of matchedOrder) {
    const person = peopleById.get(pid);
    if (!person) continue; // stale/deleted person id — silently skip, not unreachable
    if (person.email === "") {
      unreachableCount++;
    } else {
      reachable.push({
        id: person.id,
        name: person.name,
        email: person.email,
        roleNames: roleNamesByPerson.get(pid) ?? [],
      });
    }
  }
  return { reachable, unreachableCount };
}
