import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  preloadErrata,
  getErrata,
  fetchErrata,
  hasErrata,
  __resetErrataCache,
} from "@/services/errataService";

/** Stub Supabase : supabase.from("card_errata").select("*") → { data, error }. */
function stubRows(rows: unknown[] | null, error: unknown = null) {
  supabaseStub = {
    from: () => ({ select: () => Promise.resolve({ data: rows, error }) }),
  };
}

const ROW = {
  card_id: "opee-tissoin-incarnam",
  errata_date: "2010-12-01",
  source: "Forum officiel Wakfu",
  summary: "Passe à 6 PA.",
  before_text: "7 PA",
  after_text: "6 PA",
  sort_order: 0,
};

describe("errataService — source Supabase", () => {
  beforeEach(() => {
    supabaseStub = null;
    __resetErrataCache();
  });

  it("devrait indexer les errata par card_id après préchargement", async () => {
    stubRows([ROW]);
    await preloadErrata();
    const list = getErrata("opee-tissoin-incarnam");
    expect(list).toHaveLength(1);
    expect(list[0].summary).toBe("Passe à 6 PA.");
    expect(list[0].before).toBe("7 PA");
    expect(list[0].after).toBe("6 PA");
  });

  it("devrait exposer hasErrata en O(1) sur l'index", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("bouftou-incarnam")).toBe(false);
  });

  it("devrait ne charger qu'UNE fois (index complet, pas de requête par carte)", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => {
          calls++;
          return Promise.resolve({ data: [ROW], error: null });
        },
      }),
    };
    await preloadErrata();
    await fetchErrata("opee-tissoin-incarnam");
    await fetchErrata("bouftou-incarnam");
    expect(calls).toBe(1);
  });

  it("devrait dégrader silencieusement si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(preloadErrata()).resolves.toBeUndefined();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
    expect(hasErrata("opee-tissoin-incarnam")).toBe(false);
  });

  it("devrait dégrader silencieusement si la requête échoue", async () => {
    stubRows(null, { message: "boom" });
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
  });

  it("devrait ignorer une ligne invalide sans casser les autres", async () => {
    stubRows([ROW, { card_id: "x-incarnam" }]); // 2e ligne : summary manquant
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("x-incarnam")).toBe(false);
  });
});
