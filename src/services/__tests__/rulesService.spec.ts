import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  loadRules,
  getRules,
  __resetRulesCache,
} from "@/services/rulesService";

const ROWS = [
  {
    number: "4",
    kind: "chapter",
    chapter: 4,
    title: "Concepts",
    body: null,
    sort_order: 1,
  },
  {
    number: "418",
    kind: "section",
    chapter: 4,
    title: "Ressources",
    body: null,
    sort_order: 2,
  },
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Allié…",
    sort_order: 3,
  },
];

/** Arguments capturés de tous les appels à `.order(...)` du test en cours. */
let orderCalls: unknown[][] = [];

/**
 * Stub Supabase renvoyant `{ data, error }` figés et capturant les arguments
 * passés à `.order(...)` dans `orderCalls`. Le mock est délibérément
 * agnostique à ces arguments (il renvoie toujours `data` tel quel) : c'est
 * `orderCalls` — pas l'ordre du tableau renvoyé — qui prouve que le service
 * demande le bon tri à la requête.
 */
function stubData(data: unknown, error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({
        order: (...args: unknown[]) => {
          orderCalls.push(args);
          return Promise.resolve({ data, error });
        },
      }),
    }),
  };
}

describe("rulesService", () => {
  beforeEach(() => {
    supabaseStub = null;
    orderCalls = [];
    __resetRulesCache();
  });

  it("devrait demander le tri par sort_order ascendant à Supabase (arguments de .order)", async () => {
    // Le mock est order-agnostique (voir stubData) : si l'implémentation
    // régressait vers `.order("number")` ou `.order("sort_order", { ascending: false })`,
    // les données renvoyées seraient identiques et un test qui se contente de
    // vérifier `rules.map(r => r.number)` ne verrait rien. Seule l'assertion
    // sur les arguments réellement transmis prouve que le tri demandé est le bon.
    stubData(ROWS);
    await loadRules();
    expect(orderCalls).toEqual([["sort_order", { ascending: true }]]);
  });

  it("ne trie pas côté client : l'ordre renvoyé par loadRules suit tel quel celui de la requête (pas de re-tri)", async () => {
    // Lignes délibérément renvoyées dans un ordre qui NE correspond PAS à
    // leur sort_order croissant. Ce test ne peut pas, à lui seul, prouver que
    // le bon argument est passé à .order() (le mock l'ignore) : il prouve
    // seulement que le service fait confiance à l'ordre de la requête plutôt
    // que de re-trier côté client — complémentaire du test précédent, qui
    // reste la seule preuve sur le tri demandé.
    const shuffled = [ROWS[2], ROWS[0], ROWS[1]];
    stubData(shuffled);
    const rules = await loadRules();
    expect(rules.map((r) => r.number)).toEqual(["418.5b", "4", "418"]);
  });

  it("devrait exposer getRules de façon synchrone après chargement", async () => {
    stubData(ROWS);
    await loadRules();
    expect(getRules()).toHaveLength(3);
  });

  it("devrait court-circuiter sur le cache déjà résolu pour un 2e appel séquentiel", async () => {
    // Ici `await` sépare les deux appels : le premier résout entièrement (cache
    // rempli) avant que le second ne démarre, donc c'est la garde `if (cache)
    // return cache;` qui est exercée — PAS `loading ??= load()`. Voir le test
    // suivant pour la garde anti-concurrence.
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: ROWS, error: null });
          },
        }),
      }),
    };
    await loadRules();
    await loadRules();
    expect(calls).toBe(1);
  });

  it("devrait ne déclencher qu'UNE requête pour des appels concurrents en vol (garde loading ??=)", async () => {
    // Les 3 appels démarrent avant que la première requête ne soit résolue
    // (aucun `await` entre eux) : seule `loading ??= load()` peut empêcher
    // les 2e/3e appels de relancer `load()`. Un `if (cache) return cache;`
    // seul ne suffit pas ici, car `cache` est encore `null` pour tous les
    // appelants tant que la première requête n'a pas résolu.
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return Promise.resolve({ data: ROWS, error: null });
          },
        }),
      }),
    };
    const [a, b, c] = await Promise.all([
      loadRules(),
      loadRules(),
      loadRules(),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("devrait renvoyer une liste vide si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait renvoyer une liste vide si la requête renvoie une erreur", async () => {
    // `data` reste un tableau de lignes valides : seule la présence de
    // `error` doit forcer la dégradation vers [].
    stubData(ROWS, { message: "boom" });
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait renvoyer une liste vide si data n'est pas un tableau (ex. null)", async () => {
    stubData(null, null);
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait renvoyer une liste vide si la chaîne de requête lève une exception", async () => {
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            throw new Error("boom");
          },
        }),
      }),
    };
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait logger un avertissement (console.warn) quand la requête échoue", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubData(ROWS, { message: "boom" });
    await loadRules();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ne devrait PAS logger d'avertissement pour une simple ligne invalide (dégradation attendue)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubData([
      ...ROWS,
      { number: "9.9", kind: "rule", chapter: 99, sort_order: 4 },
    ]);
    await loadRules();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("devrait ignorer une ligne invalide", async () => {
    stubData([
      ...ROWS,
      { number: "9.9", kind: "rule", chapter: 99, sort_order: 4 },
    ]);
    const rules = await loadRules();
    expect(rules).toHaveLength(3);
  });
});
