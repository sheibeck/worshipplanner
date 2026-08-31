import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  DEFAULT_APP_CONFIG,
  getAppConfig,
  resetAppConfigCacheForTest,
} from "./appConfig";

// --- appConfig.test.ts (R180 shape, R182 merge, R183 cache, R184 fail-safe) --
//
// Structure mirrors the existing readNumericKnob/readDeleteCap/
// readAiProxyLimits describe() blocks in index.test.ts. A minimal fake
// Firestore stands in for the Admin SDK: collection().doc().get() returns
// a controllable { exists, data() }, with .get() a vi.fn() so call-count
// (the R183 cache-hit/fresh-bypass/TTL-expiry invariants) is assertable.

interface FakeSnap {
  exists: boolean;
  data: () => unknown;
}

function makeFakeDb(snap: FakeSnap): { db: Firestore; get: ReturnType<typeof vi.fn> } {
  const get = vi.fn().mockResolvedValue(snap);
  const doc = vi.fn().mockReturnValue({ get });
  const collection = vi.fn().mockReturnValue({ doc });
  const db = { collection } as unknown as Firestore;
  return { db, get };
}

function missingSnap(): FakeSnap {
  return { exists: false, data: () => undefined };
}

function docSnap(data: unknown): FakeSnap {
  return { exists: true, data: () => data };
}

beforeEach(() => {
  resetAppConfigCacheForTest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DEFAULT_APP_CONFIG shape", () => {
  it("carries every documented knob with the exact default values (R180)", () => {
    expect(DEFAULT_APP_CONFIG).toEqual({
      cleanup: {
        mediaEnabled: false,
        pptxRenderEnabled: false,
        backgroundEnabled: false,
        pptxSourceEnabled: false,
      },
      retention: {
        mediaDays: 30,
        orphanRenderStaleHours: 24,
        backgroundDays: 30,
        pptxSourceDays: 30,
      },
      deleteCapPerRun: 500,
      aiProxy: {
        rateLimitPerMin: 20,
        rateLimitPerDay: 500,
        allowedModels: ["claude-haiku-4-5-20251001"],
        maxTokensCeiling: 2048,
      },
      messaging: {
        scheduledCronEnabled: false,
        maxRecipients: 200,
        orgDailyEmailQuota: 1000,
      },
      onboarding: {
        emailsEnabled: false,
      },
      sender: {
        fromName: "",
        fromAddress: "onboarding@resend.dev",
      },
    });
  });
});

describe("getAppConfig: R182 empty doc reproduces defaults", () => {
  it("a missing doc (exists:false) deep-equals DEFAULT_APP_CONFIG", async () => {
    const { db } = makeFakeDb(missingSnap());
    const result = await getAppConfig(db);
    expect(result).toEqual(DEFAULT_APP_CONFIG);
  });

  it("an existing but empty doc ({}) deep-equals DEFAULT_APP_CONFIG", async () => {
    const { db } = makeFakeDb(docSnap({}));
    const result = await getAppConfig(db);
    expect(result).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe("getAppConfig: R182 partial doc deep-merge", () => {
  it("a doc setting one nested key leaves every sibling default intact", async () => {
    const { db } = makeFakeDb(docSnap({ cleanup: { mediaEnabled: true } }));
    const result = await getAppConfig(db);
    expect(result.cleanup.mediaEnabled).toBe(true);
    expect(result.cleanup.pptxRenderEnabled).toBe(false);
    expect(result.cleanup.backgroundEnabled).toBe(false);
    expect(result.cleanup.pptxSourceEnabled).toBe(false);
    expect(result.retention).toEqual(DEFAULT_APP_CONFIG.retention);
    expect(result.deleteCapPerRun).toBe(DEFAULT_APP_CONFIG.deleteCapPerRun);
    expect(result.aiProxy).toEqual(DEFAULT_APP_CONFIG.aiProxy);
    expect(result.messaging).toEqual(DEFAULT_APP_CONFIG.messaging);
    expect(result.onboarding).toEqual(DEFAULT_APP_CONFIG.onboarding);
    expect(result.sender).toEqual(DEFAULT_APP_CONFIG.sender);
  });
});

describe("getAppConfig: R183 TTL cache", () => {
  it("TTL cache hit: two calls within the TTL trigger exactly ONE Firestore read", async () => {
    const { db, get } = makeFakeDb(docSnap({}));
    await getAppConfig(db);
    await getAppConfig(db);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("fresh bypasses cache: {fresh:true} always re-reads even with a warm cache", async () => {
    const { db, get } = makeFakeDb(docSnap({}));
    await getAppConfig(db);
    await getAppConfig(db, { fresh: true });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("TTL expiry: a call after the TTL window re-reads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { db, get } = makeFakeDb(docSnap({}));
    await getAppConfig(db);
    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z")); // +61s, past the 60s TTL
    await getAppConfig(db);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("R184 fail-closed: cleanup + cron flags", () => {
  const flags = [
    "mediaEnabled",
    "pptxRenderEnabled",
    "backgroundEnabled",
    "pptxSourceEnabled",
  ] as const;

  it.each(flags)("cleanup.%s resolves false for malformed input", async (flag) => {
    for (const bad of ["true", 1, null]) {
      resetAppConfigCacheForTest();
      const { db } = makeFakeDb(docSnap({ cleanup: { [flag]: bad } }));
      const result = await getAppConfig(db);
      expect(result.cleanup[flag]).toBe(false);
    }
  });

  it("messaging.scheduledCronEnabled resolves false for malformed input", async () => {
    for (const bad of ["true", 1, null]) {
      resetAppConfigCacheForTest();
      const { db } = makeFakeDb(docSnap({ messaging: { scheduledCronEnabled: bad } }));
      const result = await getAppConfig(db);
      expect(result.messaging.scheduledCronEnabled).toBe(false);
    }
  });

  it("cleanup flags honor a literal true", async () => {
    const { db } = makeFakeDb(docSnap({ cleanup: { mediaEnabled: true } }));
    const result = await getAppConfig(db);
    expect(result.cleanup.mediaEnabled).toBe(true);
  });

  it("onboarding.emailsEnabled resolves false for malformed input (R293)", async () => {
    for (const bad of ["true", 1, null, {}]) {
      resetAppConfigCacheForTest();
      const { db } = makeFakeDb(docSnap({ onboarding: { emailsEnabled: bad } }));
      const result = await getAppConfig(db);
      expect(result.onboarding.emailsEnabled).toBe(false);
    }
  });

  it("an absent/empty onboarding group resolves emailsEnabled false (R293 fail-closed)", async () => {
    for (const bad of [undefined, {}]) {
      resetAppConfigCacheForTest();
      const { db } = makeFakeDb(docSnap({ onboarding: bad }));
      const result = await getAppConfig(db);
      expect(result.onboarding.emailsEnabled).toBe(false);
    }
  });

  it("onboarding.emailsEnabled honors a literal true", async () => {
    const { db } = makeFakeDb(docSnap({ onboarding: { emailsEnabled: true } }));
    const result = await getAppConfig(db);
    expect(result.onboarding.emailsEnabled).toBe(true);
  });
});

describe("R184 fail-closed: aiProxy.allowedModels", () => {
  it.each([[], "x", {}])("resolves to the restrictive default list for %j", async (bad) => {
    const { db } = makeFakeDb(docSnap({ aiProxy: { allowedModels: bad } }));
    const result = await getAppConfig(db);
    expect(result.aiProxy.allowedModels).toEqual(["claude-haiku-4-5-20251001"]);
  });

  it("honors a valid non-empty allow-list", async () => {
    const { db } = makeFakeDb(docSnap({ aiProxy: { allowedModels: ["m1", "m2"] } }));
    const result = await getAppConfig(db);
    expect(result.aiProxy.allowedModels).toEqual(["m1", "m2"]);
  });
});

describe("R184 fail open capped: numeric knobs", () => {
  const numericCases: Array<{
    group: "aiProxy" | "retention" | "messaging";
    field: string;
    fallback: number;
  }> = [
    { group: "aiProxy", field: "rateLimitPerMin", fallback: 20 },
    { group: "aiProxy", field: "rateLimitPerDay", fallback: 500 },
    { group: "aiProxy", field: "maxTokensCeiling", fallback: 2048 },
    { group: "retention", field: "mediaDays", fallback: 30 },
    { group: "retention", field: "orphanRenderStaleHours", fallback: 24 },
    { group: "retention", field: "backgroundDays", fallback: 30 },
    { group: "retention", field: "pptxSourceDays", fallback: 30 },
    { group: "messaging", field: "maxRecipients", fallback: 200 },
    { group: "messaging", field: "orgDailyEmailQuota", fallback: 1000 },
  ];

  for (const { group, field, fallback } of numericCases) {
    it(`${group}.${field} falls back to ${fallback} for malformed input (never 0/Infinity)`, async () => {
      for (const bad of [NaN, "abc", -1, Infinity, null]) {
        resetAppConfigCacheForTest();
        const { db } = makeFakeDb(docSnap({ [group]: { [field]: bad } }));
        const result = await getAppConfig(db);
        const resolved = (result[group] as Record<string, unknown>)[field];
        expect(resolved).toBe(fallback);
        expect(resolved).not.toBe(0);
        expect(Number.isFinite(resolved as number)).toBe(true);
      }
    });
  }

  it("deleteCapPerRun given 0/-1/1.5 resolves 500 (positive-int guard)", async () => {
    for (const bad of [0, -1, 1.5]) {
      resetAppConfigCacheForTest();
      const { db } = makeFakeDb(docSnap({ deleteCapPerRun: bad }));
      const result = await getAppConfig(db);
      expect(result.deleteCapPerRun).toBe(500);
    }
  });

  it("deleteCapPerRun honors a valid positive integer", async () => {
    const { db } = makeFakeDb(docSnap({ deleteCapPerRun: 250 }));
    const result = await getAppConfig(db);
    expect(result.deleteCapPerRun).toBe(250);
  });

  it("a genuine 0 is honored for plain numeric knobs (WR-01 zero-vs-falsy)", async () => {
    const { db } = makeFakeDb(docSnap({ aiProxy: { rateLimitPerMin: 0 } }));
    const result = await getAppConfig(db);
    expect(result.aiProxy.rateLimitPerMin).toBe(0);
  });
});
