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

function stubRows(rows: unknown[], error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: rows, error }) }),
    }),
  };
}

describe("rulesService", () => {
  beforeEach(() => {
    supabaseStub = null;
    __resetRulesCache();
  });

  it("devrait charger les règles triées par sort_order", async () => {
    stubRows(ROWS);
    const rules = await loadRules();
    expect(rules.map((r) => r.number)).toEqual(["4", "418", "418.5b"]);
  });

  it("devrait exposer getRules de façon synchrone après chargement", async () => {
    stubRows(ROWS);
    await loadRules();
    expect(getRules()).toHaveLength(3);
  });

  it("devrait ne charger qu'une seule fois", async () => {
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

  it("devrait renvoyer une liste vide si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(loadRules()).resolves.toEqual([]);
  });

  it("devrait ignorer une ligne invalide", async () => {
    stubRows([
      ...ROWS,
      { number: "9.9", kind: "rule", chapter: 99, sort_order: 4 },
    ]);
    const rules = await loadRules();
    expect(rules).toHaveLength(3);
  });
});
