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
  refreshRules,
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
    is_edited: false,
  },
  {
    number: "418",
    kind: "section",
    chapter: 4,
    title: "Ressources",
    body: null,
    sort_order: 2,
    is_edited: false,
  },
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Allié…",
    sort_order: 3,
    is_edited: false,
  },
];

/** Arguments capturés de tous les appels à `.order(...)` du test en cours. */
let orderCalls: unknown[][] = [];

/**
 * Stub Supabase renvoyant `{ data, error }` figés et capturant les arguments
 * passés à `.order(...)` dans `orderCalls`. Reproduit le double tri chaîné du
 * service (`.order("sort_order", …).order("number", …)`), comme le vrai
 * client Postgrest : le builder renvoyé par le premier `.order()` expose
 * lui-même `.order()`, seul le second maillon résout la promesse. Le mock est
 * délibérément agnostique aux arguments (il renvoie toujours `data` tel
 * quel) : c'est `orderCalls` — pas l'ordre du tableau renvoyé — qui prouve
 * que le service demande le bon tri à la requête. Le mock est aussi
 * agnostique à la table interrogée (`from()` ignore son argument) : les
 * tests de repli plus bas définissent leurs propres stubs différenciés par
 * table.
 */
function stubData(data: unknown, error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({
        order: (...args1: unknown[]) => {
          orderCalls.push(args1);
          return {
            order: (...args2: unknown[]) => {
              orderCalls.push(args2);
              return Promise.resolve({ data, error });
            },
          };
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

  it("devrait lire la vue rules_effective (pas la table rules)", async () => {
    let table = "";
    supabaseStub = {
      from: (t: string) => {
        table = t;
        return {
          select: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      },
    };
    await loadRules();
    expect(table).toBe("rules_effective");
  });

  it("devrait exposer is_edited et body_official", async () => {
    stubData([
      {
        number: "418.5b",
        kind: "rule",
        chapter: 4,
        title: null,
        body: "Corrigé.",
        sort_order: 3,
        is_edited: true,
        body_official: "Officiel.",
      },
    ]);
    const rules = await loadRules();
    expect(rules[0].is_edited).toBe(true);
    expect(rules[0].body_official).toBe("Officiel.");
  });

  it("refreshRules devrait forcer une nouvelle requête", async () => {
    let calls = 0;
    supabaseStub = {
      from: () => ({
        select: () => ({
          order: () => {
            calls++;
            return {
              order: () => Promise.resolve({ data: [], error: null }),
            };
          },
        }),
      }),
    };
    await loadRules();
    await loadRules();
    expect(calls).toBe(1);
    await refreshRules();
    expect(calls).toBe(2);
  });

  it("devrait demander le tri par sort_order puis number, tous deux ascendants (arguments de .order)", async () => {
    // Le mock est order-agnostique (voir stubData) : si l'implémentation
    // régressait vers un seul `.order("sort_order")` ou vers un ordre
    // descendant, les données renvoyées seraient identiques et un test qui se
    // contente de vérifier `rules.map(r => r.number)` ne verrait rien. Seule
    // l'assertion sur les arguments réellement transmis (et leur nombre)
    // prouve que le tri demandé est le bon.
    stubData(ROWS);
    await loadRules();
    expect(orderCalls).toEqual([
      ["sort_order", { ascending: true }],
      ["number", { ascending: true }],
    ]);
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
            return {
              order: () => Promise.resolve({ data: ROWS, error: null }),
            };
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
            return {
              order: () => Promise.resolve({ data: ROWS, error: null }),
            };
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

  it("devrait renvoyer une liste vide si la requête renvoie une erreur (et que le repli échoue aussi)", async () => {
    // `data` reste un tableau de lignes valides : seule la présence de
    // `error` doit forcer la dégradation vers [] — ici via le repli sur
    // `rules`, qui échoue également (stubData est agnostique à la table).
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

  describe("repli sur la table `rules` (vue `rules_effective` pas encore migrée)", () => {
    /**
     * Stub différencié PAR TABLE : contrairement à `stubData`, il distingue
     * `rules_effective` de `rules` et enregistre chaque nom de table
     * interrogé dans `tablesQueried`, dans l'ordre. C'est la seule façon de
     * prouver que le repli a (ou n'a pas) réellement tapé la table `rules` —
     * un test qui se contenterait de vérifier le contenu renvoyé ne
     * distinguerait pas « la vue a répondu » de « le repli a répondu à sa
     * place avec des données qui ressemblent ».
     */
    function stubByTable(opts: {
      view: { data: unknown; error: unknown };
      table: { data: unknown; error: unknown };
    }) {
      const tablesQueried: string[] = [];
      supabaseStub = {
        from: (t: string) => {
          tablesQueried.push(t);
          const result = t === "rules_effective" ? opts.view : opts.table;
          return {
            select: () => ({
              order: () => ({
                order: () => Promise.resolve(result),
              }),
            }),
          };
        },
      };
      return tablesQueried;
    }

    it("est utilisé quand la vue échoue : interroge bien `rules` et renvoie is_edited: false", async () => {
      const tablesQueried = stubByTable({
        view: { data: null, error: { message: "relation does not exist" } },
        table: {
          data: [
            {
              number: "418.5b",
              kind: "rule",
              chapter: 4,
              title: null,
              body: "Allié…",
              sort_order: 3,
            },
          ],
          error: null,
        },
      });

      const rules = await loadRules();

      // Preuve que le repli a réellement été déclenché (pas juste que le
      // résultat "ressemble" à celui de la table `rules`) : la table `rules`
      // a effectivement été interrogée, après `rules_effective`.
      expect(tablesQueried).toEqual(["rules_effective", "rules"]);
      expect(rules).toHaveLength(1);
      expect(rules[0].is_edited).toBe(false);
      expect(rules[0].body_official).toBeNull();
    });

    it("n'est PAS utilisé quand la vue répond : `rules` n'est jamais interrogée", async () => {
      const tablesQueried = stubByTable({
        view: {
          data: [
            {
              number: "418.5b",
              kind: "rule",
              chapter: 4,
              title: null,
              body: "Corrigé.",
              sort_order: 3,
              is_edited: true,
              body_official: "Officiel.",
            },
          ],
          error: null,
        },
        // Si le service interrogeait `rules` malgré une vue qui répond, ce
        // stub le révélerait : ces données n'ont pas `is_edited`/
        // `body_official`, donc la ligne serait rejetée par le schéma et le
        // test échouerait sur `rules` ci-dessous — mais la preuve décisive
        // reste `tablesQueried`, pas ce contenu.
        table: { data: [], error: null },
      });

      const rules = await loadRules();

      expect(tablesQueried).toEqual(["rules_effective"]);
      expect(rules).toHaveLength(1);
      expect(rules[0].is_edited).toBe(true);
    });
  });
});
