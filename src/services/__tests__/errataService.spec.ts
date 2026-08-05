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
  getAllErrata,
  refreshErrata,
  __resetErrataCache,
} from "@/services/errataService";

/** Arguments capturés de tous les appels à `.order(...)` du test en cours. */
let orderCalls: unknown[][] = [];

/**
 * Stub Supabase : supabase.from("card_errata").select("*").order(...) →
 * { data, error }. Chaîne `.order()` comme le vrai client (voir
 * rulesService.spec.ts) : un stub qui s'arrêterait à `.select()` casserait
 * dès que le service demande un tri.
 */
function stubRows(rows: unknown[] | null, error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({
        order: (...args: unknown[]) => {
          orderCalls.push(args);
          return Promise.resolve({ data: rows, error });
        },
      }),
    }),
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
    orderCalls = [];
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
    // Déjà ISO côté Postgres : passe tel quel.
    expect(list[0].date).toBe("2010-12-01");
  });

  it("devrait exposer hasErrata en O(1) sur l'index", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("bouftou-incarnam")).toBe(false);
  });

  it("devrait demander le tri par sort_order ascendant à Supabase (arguments de .order)", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(orderCalls).toEqual([["sort_order", { ascending: true }]]);
  });

  it("devrait ne charger qu'UNE fois (index complet, pas de requête par carte)", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: [ROW], error: null });
          },
        }),
      }),
    };
    await preloadErrata();
    await fetchErrata("opee-tissoin-incarnam");
    await fetchErrata("bouftou-incarnam");
    expect(calls).toBe(1);
  });

  it("devrait ne déclencher qu'UNE requête pour des appels concurrents en vol (garde loading ??=)", async () => {
    // Les 3 appels démarrent avant que la première requête ne soit résolue
    // (aucun `await` entre eux) : seule `loading ??= load()` peut empêcher
    // les 2e/3e appels de relancer `load()`. C'est le chemin chaud en
    // production : une page de collection monte de nombreux ErrataBadge qui
    // appellent tous preloadErrata() dans le même tick.
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: [ROW], error: null });
          },
        }),
      }),
    };
    await Promise.all([preloadErrata(), preloadErrata(), preloadErrata()]);
    expect(calls).toBe(1);
  });

  it("devrait exposer la date ISO renvoyée par Postgres", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")[0].date).toBe("2010-12-01");
  });

  it("devrait rendre une date vide (pas null) quand errata_date est absente", async () => {
    stubRows([{ ...ROW, errata_date: null }]);
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")[0].date).toBe("");
  });

  it("devrait dégrader vers un index vide si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(preloadErrata()).resolves.toBeUndefined();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
    expect(hasErrata("opee-tissoin-incarnam")).toBe(false);
  });

  it("devrait dégrader vers un index vide si la requête échoue", async () => {
    stubRows(null, { message: "boom" });
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
  });

  it("devrait dégrader vers un index vide si `data` n'est pas un tableau", async () => {
    stubRows(null);
    await preloadErrata();
    expect(getAllErrata()).toEqual({});
  });

  it("devrait dégrader vers un index vide si la requête renvoie zéro ligne", async () => {
    stubRows([]);
    await preloadErrata();
    expect(getAllErrata()).toEqual({});
  });

  it("devrait dégrader sans lever si la requête jette une exception", async () => {
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            throw new Error("réseau");
          },
        }),
      }),
    };
    await expect(preloadErrata()).resolves.toBeUndefined();
    expect(getAllErrata()).toEqual({});
  });

  it("devrait ignorer une ligne invalide sans casser les autres", async () => {
    stubRows([ROW, { card_id: "x-incarnam" }]); // 2e ligne : summary manquant
    await preloadErrata();
    expect(hasErrata("opee-tissoin-incarnam")).toBe(true);
    expect(hasErrata("x-incarnam")).toBe(false);
  });

  it("devrait logger un avertissement (console.warn) quand la requête échoue", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubRows(null, { message: "boom" });
    await preloadErrata();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ne devrait PAS logger d'avertissement pour une simple ligne invalide (dégradation attendue)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubRows([ROW, { card_id: "x-incarnam" }]);
    await preloadErrata();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("getAllErrata devrait exposer l'index complet", async () => {
    stubRows([ROW]);
    await preloadErrata();
    expect(Object.keys(getAllErrata())).toEqual(["opee-tissoin-incarnam"]);
  });

  it("refreshErrata devrait forcer une nouvelle requête", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: [ROW], error: null });
          },
        }),
      }),
    };
    await preloadErrata();
    await preloadErrata();
    expect(calls).toBe(1);
    await refreshErrata();
    expect(calls).toBe(2);
  });

  it("devrait exposer les changements structurés sur l'entrée", async () => {
    stubRows([{ ...ROW, changes: [{ label: "PA", before: "7", after: "6" }] }]);
    await preloadErrata();
    const e = getErrata("opee-tissoin-incarnam")[0];
    expect(e.changes).toEqual([{ label: "PA", before: "7", after: "6" }]);
  });

  it("devrait exposer un tableau vide quand la colonne changes est absente", async () => {
    stubRows([ROW]); // ROW n'a pas de `changes`
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")[0].changes).toEqual([]);
  });
});
