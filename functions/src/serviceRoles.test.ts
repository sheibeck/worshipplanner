import { describe, it, expect } from "vitest";
import {
  findQuarterForDate,
  resolveServiceRoleAssignments,
  resolveMessageRecipients,
  coerceLegacyRoleGroup,
  type PortedRole,
  type PortedService,
  type PortedQuarter,
  type PortedPerson,
  type RecipientSelection,
} from "./serviceRoles";

// Plain-object fixtures — no Firestore, no Timestamp, no mocks. These mirror the
// client resolver coverage (src/utils/__tests__/messagingRecipients.test.ts and
// serviceRoles.test.ts) and MUST be kept in lockstep with them: the functions
// port copies the resolve body verbatim, so a behavioral divergence here means
// the server send list would disagree with the composer's "Reaches N" estimate.

function makeRole(overrides: Partial<PortedRole> = {}): PortedRole {
  return {
    id: "role-guitar",
    name: "guitar",
    group: "band",
    order: 0,
    ...overrides,
  };
}

function makeQuarter(overrides: Partial<PortedQuarter> = {}): PortedQuarter {
  return {
    serviceDates: [],
    calendar: {},
    ...overrides,
  };
}

function makeService(overrides: Partial<PortedService> = {}): PortedService {
  return {
    date: "2026-08-02",
    ...overrides,
  };
}

function makePerson(overrides: Partial<PortedPerson> = {}): PortedPerson {
  return {
    id: "person-1",
    name: "Alice",
    email: "alice@example.com",
    ...overrides,
  };
}

function makeSelection(overrides: Partial<RecipientSelection> = {}): RecipientSelection {
  return {
    teams: [],
    individualPersonIds: [],
    includeEveryone: false,
    ...overrides,
  };
}

describe("findQuarterForDate", () => {
  it("returns the first quarter whose serviceDates includes the date", () => {
    const q1 = makeQuarter({ serviceDates: ["2026-08-02"] });
    const q2 = makeQuarter({ serviceDates: ["2026-08-09"] });
    expect(findQuarterForDate([q1, q2], "2026-08-09")).toBe(q2);
  });

  it("returns the FIRST match in array order when two quarters list the same date (documented tie-break)", () => {
    const q1 = makeQuarter({ serviceDates: ["2026-08-02"] });
    const q2 = makeQuarter({ serviceDates: ["2026-08-02"] });
    expect(findQuarterForDate([q1, q2], "2026-08-02")).toBe(q1);
  });

  it("returns undefined when no quarter matches", () => {
    const q1 = makeQuarter({ serviceDates: ["2026-08-02"] });
    expect(findQuarterForDate([q1], "2026-12-25")).toBeUndefined();
  });
});

describe("resolveServiceRoleAssignments", () => {
  it("sorts roles by order and resolves effectivePersonIds = quarter-scheduled when no override", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 1 });
    const sound = makeRole({ id: "role-sound", name: "sound", group: "tech", order: 0 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": {
          "role-guitar": ["person-1"],
          "role-sound": ["person-2"],
        },
      },
    });
    const service = makeService({ date: "2026-08-02" });

    const result = resolveServiceRoleAssignments(service, [quarter], [guitar, sound]);

    // sorted by order -> sound (0) before guitar (1)
    expect(result.map((r) => r.roleId)).toEqual(["role-sound", "role-guitar"]);
    expect(result[0].effectivePersonIds).toEqual(["person-2"]);
    expect(result[1].effectivePersonIds).toEqual(["person-1"]);
  });

  it("applies override ?? scheduled ?? [] — override wins, else scheduled, else empty", () => {
    const guitar = makeRole({ id: "role-guitar", order: 0 });
    const bass = makeRole({ id: "role-bass", name: "bass", order: 1 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: { "2026-08-02": { "role-guitar": ["person-1"] } },
    });
    // override for guitar replaces schedule; bass has neither -> []
    const service = makeService({
      date: "2026-08-02",
      roleAssignmentOverrides: { "role-guitar": ["person-9"] },
    });

    const result = resolveServiceRoleAssignments(service, [quarter], [guitar, bass]);
    const byId = Object.fromEntries(result.map((r) => [r.roleId, r]));

    expect(byId["role-guitar"].overriddenPersonIds).toEqual(["person-9"]);
    expect(byId["role-guitar"].effectivePersonIds).toEqual(["person-9"]);
    expect(byId["role-bass"].effectivePersonIds).toEqual([]);
  });
});

describe("resolveMessageRecipients", () => {
  it("Test A (team filter): teams=['band'] returns only people whose assigned role.group is band", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const sound = makeRole({ id: "role-sound", name: "sound", group: "tech", order: 1 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": { "role-guitar": ["person-1"], "role-sound": ["person-2"] },
      },
    });
    const service = makeService({ date: "2026-08-02" });
    const alice = makePerson({ id: "person-1", name: "Alice", email: "alice@example.com" });
    const bob = makePerson({ id: "person-2", name: "Bob", email: "bob@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar, sound]);
    const result = resolveMessageRecipients(assignments, [alice, bob], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([
      { id: "person-1", name: "Alice", email: "alice@example.com", roleNames: ["guitar"] },
    ]);
    expect(result.unreachableCount).toBe(0);
  });

  it("Test B (includeEveryone ignores teams): returns every assigned person regardless of group", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const sound = makeRole({ id: "role-sound", name: "sound", group: "tech", order: 1 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": { "role-guitar": ["person-1"], "role-sound": ["person-2"] },
      },
    });
    const service = makeService({ date: "2026-08-02" });
    const alice = makePerson({ id: "person-1", name: "Alice", email: "alice@example.com" });
    const bob = makePerson({ id: "person-2", name: "Bob", email: "bob@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar, sound]);
    const result = resolveMessageRecipients(
      assignments,
      [alice, bob],
      makeSelection({ teams: [], includeEveryone: true }),
    );

    expect(result.reachable.map((r) => r.id).sort()).toEqual(["person-1", "person-2"]);
    expect(result.unreachableCount).toBe(0);
  });

  it("Test C (individuals always included): individualPersonIds included even when not on any selected team", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: { "2026-08-02": { "role-guitar": ["person-1"] } },
    });
    const service = makeService({ date: "2026-08-02" });
    const alice = makePerson({ id: "person-1", name: "Alice", email: "alice@example.com" });
    const carol = makePerson({ id: "person-3", name: "Carol", email: "carol@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar]);
    const result = resolveMessageRecipients(
      assignments,
      [alice, carol],
      makeSelection({ teams: ["tech"], individualPersonIds: ["person-3"] }),
    );

    // Carol matched only as an individual — no team role names accrue to her.
    expect(result.reachable).toEqual([
      { id: "person-3", name: "Carol", email: "carol@example.com", roleNames: [] },
    ]);
    expect(result.unreachableCount).toBe(0);
  });

  it("Test D (dedup by person id): a person assigned to two matching roles appears exactly once", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const bass = makeRole({ id: "role-bass", name: "bass", group: "band", order: 1 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": { "role-guitar": ["person-1"], "role-bass": ["person-1"] },
      },
    });
    const service = makeService({ date: "2026-08-02" });
    const alice = makePerson({ id: "person-1", name: "Alice", email: "alice@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar, bass]);
    const result = resolveMessageRecipients(assignments, [alice], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toHaveLength(1);
    // deduped to one entry but BOTH role names accrue to her
    expect(result.reachable[0]).toEqual({
      id: "person-1",
      name: "Alice",
      email: "alice@example.com",
      roleNames: ["guitar", "bass"],
    });
    expect(result.unreachableCount).toBe(0);
  });

  it("Test E (empty-email assignee): a matched person with email === '' is excluded and increments unreachableCount", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: { "2026-08-02": { "role-guitar": ["person-1"] } },
    });
    const service = makeService({ date: "2026-08-02" });
    const noEmail = makePerson({ id: "person-1", name: "NoEmail", email: "" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar]);
    const result = resolveMessageRecipients(assignments, [noEmail], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([]);
    expect(result.unreachableCount).toBe(1);
  });

  it("Test F (unfilled role): a role with effectivePersonIds=[] contributes 0 recipients and no unreachable", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const quarter = makeQuarter({ serviceDates: ["2026-08-02"], calendar: {} });
    const service = makeService({ date: "2026-08-02" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar]);
    const result = resolveMessageRecipients(assignments, [], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([]);
    expect(result.unreachableCount).toBe(0);
  });

  it("Test G (stale personId silently skipped): matched id absent from people is skipped, no unreachable", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: { "2026-08-02": { "role-guitar": ["person-deleted"] } },
    });
    const service = makeService({ date: "2026-08-02" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar]);
    const result = resolveMessageRecipients(assignments, [], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([]);
    expect(result.unreachableCount).toBe(0);
  });

  it("Test H (stale vs unreachable distinguished): one stale id + one empty-email id inflate unreachableCount by only 1", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const bass = makeRole({ id: "role-bass", name: "bass", group: "band", order: 1 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": { "role-guitar": ["person-deleted"], "role-bass": ["person-1"] },
      },
    });
    const service = makeService({ date: "2026-08-02" });
    const noEmail = makePerson({ id: "person-1", name: "NoEmail", email: "" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar, bass]);
    const result = resolveMessageRecipients(assignments, [noEmail], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([]);
    expect(result.unreachableCount).toBe(1);
  });

  it("Test I (R139 per-recipient roleNames divergence): person A's roleNames differ from person B's", () => {
    const guitar = makeRole({ id: "role-guitar", name: "guitar", group: "band", order: 0 });
    const sound = makeRole({ id: "role-sound", name: "sound", group: "tech", order: 1 });
    const livestream = makeRole({ id: "role-ls", name: "livestream", group: "tech", order: 2 });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: {
        "2026-08-02": {
          "role-guitar": ["person-a"],
          "role-sound": ["person-b"],
          "role-ls": ["person-b"],
        },
      },
    });
    const service = makeService({ date: "2026-08-02" });
    const personA = makePerson({ id: "person-a", name: "Ann", email: "ann@example.com" });
    const personB = makePerson({ id: "person-b", name: "Bea", email: "bea@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [guitar, sound, livestream]);
    const result = resolveMessageRecipients(
      assignments,
      [personA, personB],
      makeSelection({ includeEveryone: true }),
    );

    const byId = Object.fromEntries(result.reachable.map((r) => [r.id, r.roleNames]));
    expect(byId["person-a"]).toEqual(["guitar"]);
    expect(byId["person-b"]).toEqual(["sound", "livestream"]);
    // the whole point of R139: A's roles are NOT B's roles
    expect(byId["person-a"]).not.toEqual(byId["person-b"]);
  });
});

describe("coerceLegacyRoleGroup (R250 read-time compat shim, CR-01 regression)", () => {
  it("coerces a legacy role doc stored with group 'vocals' to { group: 'band', vocal: true }", () => {
    expect(coerceLegacyRoleGroup({ group: "vocals" })).toEqual({ group: "band", vocal: true });
  });

  it("preserves an explicit vocal:false on a legacy doc rather than forcing true", () => {
    expect(coerceLegacyRoleGroup({ group: "vocals", vocal: false })).toEqual({
      group: "band",
      vocal: false,
    });
  });

  it("leaves a non-vocals role doc's group/vocal unchanged", () => {
    expect(coerceLegacyRoleGroup({ group: "band", vocal: true })).toEqual({
      group: "band",
      vocal: true,
    });
    expect(coerceLegacyRoleGroup({ group: "tech" })).toEqual({ group: "tech", vocal: undefined });
  });

  it("CR-01 regression: a role doc raw-read with group:'vocals' resolves under a 'band' team selection, matching the client's Reaches-N estimate", () => {
    // Simulates the exact drop bug: a Firestore role doc that has never been
    // migrated off the pre-Phase-85 shape (group: 'vocals'), fed through the
    // functions/src/index.ts role-load boundary's coercion before reaching
    // resolveMessageRecipients — proving the server send list now agrees with
    // the client's shim-coerced "Reaches N" estimate for the same org data.
    const legacyVocalsRoleDoc = { group: "vocals", name: "vocals" };
    const vocals = makeRole({
      id: "role-vocals",
      name: "vocals",
      order: 0,
      ...coerceLegacyRoleGroup(legacyVocalsRoleDoc),
    });
    const quarter = makeQuarter({
      serviceDates: ["2026-08-02"],
      calendar: { "2026-08-02": { "role-vocals": ["person-1"] } },
    });
    const service = makeService({ date: "2026-08-02" });
    const alice = makePerson({ id: "person-1", name: "Alice", email: "alice@example.com" });

    const assignments = resolveServiceRoleAssignments(service, [quarter], [vocals]);
    const result = resolveMessageRecipients(assignments, [alice], makeSelection({ teams: ["band"] }));

    expect(result.reachable).toEqual([
      { id: "person-1", name: "Alice", email: "alice@example.com", roleNames: ["vocals"] },
    ]);
    expect(result.unreachableCount).toBe(0);
  });
});
