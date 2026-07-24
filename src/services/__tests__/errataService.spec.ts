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

/** Stub `fetch("/data/errata.json")` — le repli local. */
function stubJsonFallback(errata: Record<string, unknown[]> | null, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve({ errata: errata ?? {} }),
  }) as unknown as typeof fetch;
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

  it("devrait dégrader vers le JSON local si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    stubJsonFallback({
      "x-incarnam": [{ date: "13/10/2009", summary: "Depuis le JSON." }],
    });
    await preloadErrata();
    expect(getErrata("x-incarnam")).toEqual([
      {
        date: "2009-10-13",
        summary: "Depuis le JSON.",
        source: undefined,
        before: undefined,
        after: undefined,
        url: undefined,
      },
    ]);
  });

  it("devrait replier sur le JSON local si la requête Supabase échoue", async () => {
    stubRows(null, { message: "boom" });
    stubJsonFallback({
      "x-incarnam": [{ date: "13/10/2009", summary: "Depuis le JSON." }],
    });
    await preloadErrata();
    expect(hasErrata("x-incarnam")).toBe(true);
    expect(getErrata("x-incarnam")[0].summary).toBe("Depuis le JSON.");
  });

  it("devrait replier sur le JSON local si la requête renvoie zéro ligne", async () => {
    stubRows([]); // aucune erreur, mais index vide
    stubJsonFallback({
      "x-incarnam": [{ date: "13/10/2009", summary: "Depuis le JSON." }],
    });
    await preloadErrata();
    expect(hasErrata("x-incarnam")).toBe(true);
  });

  it("devrait préférer les données Supabase quand elles sont présentes (pas de repli JSON)", async () => {
    stubRows([ROW]);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await preloadErrata();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getErrata("opee-tissoin-incarnam")[0].summary).toBe("Passe à 6 PA.");
  });

  it("devrait convertir les dates du JSON (JJ/MM/AAAA) en ISO (AAAA-MM-JJ)", async () => {
    supabaseStub = null;
    stubJsonFallback({
      "x-incarnam": [{ date: "05/01/2011", summary: "Test date." }],
    });
    await preloadErrata();
    expect(getErrata("x-incarnam")[0].date).toBe("2011-01-05");
  });

  it("devrait dégrader silencieusement si Supabase n'est pas configuré et que le JSON est aussi indisponible", async () => {
    supabaseStub = null;
    await expect(preloadErrata()).resolves.toBeUndefined();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
    expect(hasErrata("opee-tissoin-incarnam")).toBe(false);
  });

  it("devrait dégrader silencieusement si la requête échoue et que le JSON est aussi indisponible", async () => {
    stubRows(null, { message: "boom" });
    // fetch non stubbé → dégrade vers {} (voir tests/setup.ts : global.fetch = vi.fn()).
    await preloadErrata();
    expect(getErrata("opee-tissoin-incarnam")).toEqual([]);
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
    stubJsonFallback({});
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
});
