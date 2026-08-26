import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  backfillLastUsedForOrg,
  computeLastUsedDate,
  serviceDateToMillis,
  isLockedStatus,
  type LastUsedServiceInput,
} from "./backfillLastUsed";

// Mirrors functions/src/backfillOrgClaims.test.ts's established mocking seams:
// getFirestore() is mocked to return a fake Firestore whose collection()/doc()
// chain resolves organizations/{orgId}/services and organizations/{orgId}/songs.
// Timestamp is ALSO mocked here (backfillOrgClaims.test.ts never needed this --
// this is the first functions test to construct/compare Admin SDK Timestamps) as
// a small stateful class carrying millis, with fromMillis + isEqual + toMillis so
// the idempotency check (`existing.isEqual(next)`) in backfillLastUsed.ts works
// against fixture data exactly as it would against real Firestore Timestamps.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => {
  class FakeTimestamp {
    constructor(public readonly millis: number) {}
    static fromMillis(ms: number): FakeTimestamp {
      return new FakeTimestamp(ms);
    }
    isEqual(other: unknown): boolean {
      return other instanceof FakeTimestamp && other.millis === this.millis;
    }
    toMillis(): number {
      return this.millis;
    }
  }
  return {
    getFirestore: vi.fn(),
    Timestamp: FakeTimestamp,
  };
});

const ORG_ID = "berean";

interface FakeSongRecord {
  id: string;
  lastUsedAt: InstanceType<typeof Timestamp> | null;
}

/**
 * Builds a fake org whose organizations/{orgId}/services and .../songs
 * collections resolve from the given fixtures, wired through the SAME
 * getFirestore() mock backfillLastUsedForOrg calls. Song docs are backed by
 * mutable `FakeSongRecord`s so a `.ref.update()` call is genuinely visible to a
 * SUBSEQUENT `backfillLastUsedForOrg` call against the same records (needed to
 * prove idempotency across two real calls, not just by construction).
 */
function buildOrg(services: LastUsedServiceInput[], songRecords: FakeSongRecord[]) {
  const serviceDocs = services.map((service) => ({
    data: () => ({
      status: service.status,
      date: service.date,
      slots: service.songIds.map((songId) => ({ kind: "SONG", songId })),
    }),
  }));

  const updateSpies = new Map<string, ReturnType<typeof vi.fn>>();
  const songDocs = songRecords.map((record) => {
    const updateSpy = vi.fn(async (patch: { lastUsedAt: InstanceType<typeof Timestamp> }) => {
      record.lastUsedAt = patch.lastUsedAt;
    });
    updateSpies.set(record.id, updateSpy);
    return {
      id: record.id,
      data: () => ({ lastUsedAt: record.lastUsedAt }),
      ref: { update: updateSpy },
    };
  });

  const orgDoc = {
    collection: vi.fn((name: string) => {
      if (name === "services") return { get: vi.fn(async () => ({ docs: serviceDocs })) };
      if (name === "songs") return { get: vi.fn(async () => ({ docs: songDocs })) };
      throw new Error(`buildOrg: unexpected sub-collection "${name}"`);
    }),
  };

  vi.mocked(getFirestore).mockReturnValue({
    collection: vi.fn((name: string) => {
      if (name !== "organizations") throw new Error(`buildOrg: unexpected collection "${name}"`);
      return { doc: vi.fn(() => orgDoc) };
    }),
  } as never);

  return { updateSpies };
}

const SERVICES: LastUsedServiceInput[] = [
  // Song A: locked 'exported' (later) + locked 'planned' (earlier) -> MAX = the later date.
  { status: "exported", date: "2026-09-06", songIds: ["songA"] },
  { status: "planned", date: "2026-08-11", songIds: ["songA"] },
  // Song B: only ever in a DRAFT service -> no locked service contains it.
  { status: "draft", date: "2026-12-25", songIds: ["songB"] },
  // Song D: one locked service, already reflected in its lastUsedAt below.
  { status: "planned", date: "2026-07-01", songIds: ["songD"] },
  // Song C is in NO service at all -- deliberately absent from every entry above.
];

function freshSongRecords(): FakeSongRecord[] {
  return [
    { id: "songA", lastUsedAt: null },
    { id: "songB", lastUsedAt: Timestamp.fromMillis(1000) }, // e.g. a PC-import date
    { id: "songC", lastUsedAt: Timestamp.fromMillis(2000) }, // in no service -- must never change
    { id: "songD", lastUsedAt: Timestamp.fromMillis(serviceDateToMillis("2026-07-01")) }, // already current
  ];
}

afterEach(() => {
  vi.mocked(getFirestore).mockReset();
});

describe("backfillLastUsedForOrg", () => {
  it("dry run (apply: false): classifies every song but never calls .update()", async () => {
    const { updateSpies } = buildOrg(SERVICES, freshSongRecords());

    const summary = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: false });

    // songA: has a locked MAX and no current value -> would be processed.
    // songB: draft-only -> skipped. songC: no service -> skipped. songD: already-current -> skipped.
    expect(summary).toEqual({ processed: 1, skipped: 3, failed: [], malformedServices: [] });
    for (const spy of updateSpies.values()) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("apply (apply: true): writes ONLY Song A, to the MAX locked date; B/C/D untouched", async () => {
    const { updateSpies } = buildOrg(SERVICES, freshSongRecords());

    const summary = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });

    expect(summary).toEqual({ processed: 1, skipped: 3, failed: [], malformedServices: [] });
    expect(updateSpies.get("songA")).toHaveBeenCalledTimes(1);
    expect(updateSpies.get("songA")).toHaveBeenCalledWith({
      lastUsedAt: Timestamp.fromMillis(serviceDateToMillis("2026-09-06")),
    });
    expect(updateSpies.get("songB")).not.toHaveBeenCalled();
    expect(updateSpies.get("songC")).not.toHaveBeenCalled();
    expect(updateSpies.get("songD")).not.toHaveBeenCalled();
  });

  it("conservative write rule: a song with no locked service (draft-only, or no service) is NEVER blanked", async () => {
    const records = freshSongRecords();
    buildOrg(SERVICES, records);

    await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });

    const songB = records.find((r) => r.id === "songB")!;
    const songC = records.find((r) => r.id === "songC")!;
    // Both retain their original (e.g. Planning-Center-imported) values -- never nulled.
    expect(songB.lastUsedAt).toEqual(Timestamp.fromMillis(1000));
    expect(songC.lastUsedAt).toEqual(Timestamp.fromMillis(2000));
  });

  it("idempotent: re-running --apply against the post-write state writes nothing on the second run", async () => {
    const records = freshSongRecords();
    buildOrg(SERVICES, records);

    const firstRun = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });
    expect(firstRun).toEqual({ processed: 1, skipped: 3, failed: [], malformedServices: [] });

    // Re-mock against the SAME (now-mutated) records -- songA's record was updated
    // in place by the first run's .update() spy, so this genuinely re-derives from
    // post-write state rather than asserting idempotency by construction.
    const { updateSpies: secondRunSpies } = buildOrg(SERVICES, records);

    const secondRun = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });

    expect(secondRun).toEqual({ processed: 0, skipped: 4, failed: [], malformedServices: [] });
    for (const spy of secondRunSpies.values()) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("per-song failure: a song whose data() throws is recorded in failed, and other songs are still processed", async () => {
    const records = freshSongRecords();
    const { updateSpies } = buildOrg(SERVICES, records);

    // Force songD's data() to throw, simulating a malformed/unreadable doc.
    vi.mocked(getFirestore).mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name !== "organizations") throw new Error(`unexpected collection "${name}"`);
        return {
          doc: vi.fn(() => ({
            collection: vi.fn((sub: string) => {
              if (sub === "services") {
                return {
                  get: vi.fn(async () => ({
                    docs: SERVICES.map((service) => ({
                      data: () => ({
                        status: service.status,
                        date: service.date,
                        slots: service.songIds.map((songId) => ({ kind: "SONG", songId })),
                      }),
                    })),
                  })),
                };
              }
              if (sub === "songs") {
                return {
                  get: vi.fn(async () => ({
                    docs: records.map((record) => {
                      if (record.id === "songD") {
                        return {
                          id: "songD",
                          data: () => {
                            throw new Error("corrupt document");
                          },
                          ref: { update: vi.fn() },
                        };
                      }
                      return {
                        id: record.id,
                        data: () => ({ lastUsedAt: record.lastUsedAt }),
                        ref: { update: updateSpies.get(record.id) },
                      };
                    }),
                  })),
                };
              }
              throw new Error(`unexpected sub-collection "${sub}"`);
            }),
          })),
        };
      }),
    } as never);

    const summary = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });

    expect(summary.failed).toEqual([{ songId: "songD", error: expect.stringContaining("corrupt document") }]);
    // songA is still processed despite songD's failure.
    expect(summary.processed).toBe(1);
  });

  it("WR-02: a service with a missing date is excluded from MAX computation and reported in malformedServices, not silently NaN'd", async () => {
    vi.mocked(getFirestore).mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name !== "organizations") throw new Error(`unexpected collection "${name}"`);
        return {
          doc: vi.fn(() => ({
            collection: vi.fn((sub: string) => {
              if (sub === "services") {
                return {
                  get: vi.fn(async () => ({
                    docs: [
                      {
                        id: "service-bad-date",
                        data: () => ({
                          status: "planned",
                          date: undefined,
                          slots: [{ kind: "SONG", songId: "songE" }],
                        }),
                      },
                    ],
                  })),
                };
              }
              if (sub === "songs") {
                return {
                  get: vi.fn(async () => ({
                    docs: [{ id: "songE", data: () => ({ lastUsedAt: null }), ref: { update: vi.fn() } }],
                  })),
                };
              }
              throw new Error(`unexpected sub-collection "${sub}"`);
            }),
          })),
        };
      }),
    } as never);

    const summary = await backfillLastUsedForOrg({ orgId: ORG_ID, apply: true });

    expect(summary.malformedServices).toEqual(["service-bad-date"]);
    // songE's only containing service was excluded as malformed -- it is
    // treated exactly like "no locked service contains this song": a
    // conservative SKIP, never a NaN Timestamp write and never a `failed`
    // entry (that would conflate a bad-service-doc condition with a
    // genuinely unreadable song doc).
    expect(summary.skipped).toBe(1);
    expect(summary.processed).toBe(0);
    expect(summary.failed).toEqual([]);
  });
});

describe("mirrored derivation parity with src/utils/lastUsed.ts (84-01)", () => {
  // Same cases as src/utils/__tests__/lastUsed.test.ts -- a copy/paste drift in
  // backfillLastUsed.ts's mirrored core would fail these.
  it("isLockedStatus: draft is not locked; planned/exported are locked", () => {
    expect(isLockedStatus("draft")).toBe(false);
    expect(isLockedStatus("planned")).toBe(true);
    expect(isLockedStatus("exported")).toBe(true);
  });

  it("computeLastUsedDate: null for a song in no service", () => {
    expect(computeLastUsedDate("song-1", [])).toBeNull();
  });

  it("computeLastUsedDate: null for a song only in draft services", () => {
    const services: LastUsedServiceInput[] = [{ status: "draft", date: "2026-09-06", songIds: ["song-1"] }];
    expect(computeLastUsedDate("song-1", services)).toBeNull();
  });

  it("computeLastUsedDate: MAX across multiple locked services -- later date wins", () => {
    const services: LastUsedServiceInput[] = [
      { status: "planned", date: "2026-08-11", songIds: ["song-1"] },
      { status: "exported", date: "2026-09-06", songIds: ["song-1"] },
    ];
    expect(computeLastUsedDate("song-1", services)).toBe("2026-09-06");
  });

  it("computeLastUsedDate: a tie on the same date returns that date", () => {
    const services: LastUsedServiceInput[] = [
      { status: "planned", date: "2026-09-06", songIds: ["song-1"] },
      { status: "exported", date: "2026-09-06", songIds: ["song-1"] },
    ];
    expect(computeLastUsedDate("song-1", services)).toBe("2026-09-06");
  });

  it("computeLastUsedDate: draft never contributes even with a later date", () => {
    const services: LastUsedServiceInput[] = [
      { status: "planned", date: "2026-08-11", songIds: ["song-1"] },
      { status: "draft", date: "2026-12-25", songIds: ["song-1"] },
    ];
    expect(computeLastUsedDate("song-1", services)).toBe("2026-08-11");
  });

  // WR-03 (84-REVIEW): UTC-midnight, not local-midnight -- deterministic
  // regardless of the host machine's ambient TZ this Admin-SDK script runs
  // under.
  it("serviceDateToMillis: matches the UTC-midnight parse convention", () => {
    expect(serviceDateToMillis("2026-09-06")).toBe(Date.UTC(2026, 8, 6));
  });

  it("serviceDateToMillis: monotonic with calendar order", () => {
    expect(serviceDateToMillis("2026-08-11")).toBeLessThan(serviceDateToMillis("2026-09-06"));
  });

  it("serviceDateToMillis: matches src/utils/lastUsed.ts's UTC-midnight value byte-for-byte (mirrored-copy parity)", () => {
    expect(serviceDateToMillis("2026-01-01")).toBe(Date.UTC(2026, 0, 1));
    expect(serviceDateToMillis("2026-12-31")).toBe(Date.UTC(2026, 11, 31));
  });
});
