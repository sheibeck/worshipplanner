/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/serviceRoles.ts) */

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

/** See ADR-0031 (docs/adr/0031-read-time-compat-shim-r250-mirrors-src-stores-roster-ts-s.md) */
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
  /** R413: narrow the matched set to people with at least one unconfirmed (or
   *  needs-reconfirmation) assignment for this service — per-assignment, not
   *  per-person. Hand-mirrored from the client's own field of the same name
   *  (src/utils/messagingRecipients.ts) — see that file's doc comment. */
  unconfirmedOnly?: boolean;
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
 * deduped (by person id), reachability-split recipient lists with per-recipient roleNames.
 * `confirmedKeys` (R413) is the set of `${roleId}_${emailLower}` keys currently
 * `'confirmed'` — this is the AUTHORITATIVE server-side filter (the client's
 * own preview-only mirror lives in src/utils/messagingRecipients.ts); only
 * consulted when `selection.unconfirmedOnly` is true.
 * See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/serviceRoles.ts)
 */
export function resolveMessageRecipients(
  assignments: ResolvedRoleAssignment[],
  people: PortedPerson[],
  selection: RecipientSelection,
  confirmedKeys?: Set<string>,
): { reachable: ReachableRecipient[]; unreachableCount: number } {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const roleNamesByPerson = new Map<string, string[]>();
  // R413: which roleIds a person matched THROUGH (team-matched assignments
  // only — mirrors roleNamesByPerson's own scope). A person added purely via
  // individualPersonIds with no team-matched role has no entry here and is
  // never filtered by unconfirmedOnly (nothing to check).
  const roleIdsByPerson = new Map<string, Set<string>>();
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
      if (selection.unconfirmedOnly) {
        let ids = roleIdsByPerson.get(pid);
        if (!ids) {
          ids = new Set();
          roleIdsByPerson.set(pid, ids);
        }
        ids.add(a.roleId);
      }
    }
  }
  for (const pid of selection.individualPersonIds) ensure(pid);

  const reachable: ReachableRecipient[] = [];
  let unreachableCount = 0;
  for (const pid of matchedOrder) {
    const person = peopleById.get(pid);
    if (!person) continue; // stale/deleted person id — silently skip, not unreachable
    if (selection.unconfirmedOnly && confirmedKeys) {
      const roleIds = roleIdsByPerson.get(pid);
      if (roleIds && roleIds.size > 0) {
        const emailLower = person.email.toLowerCase();
        const allConfirmed = Array.from(roleIds).every((roleId) =>
          confirmedKeys.has(`${roleId}_${emailLower}`),
        );
        if (allConfirmed) continue; // every matched assignment is confirmed — drop
      }
    }
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
