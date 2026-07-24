import { describe, it, expect, beforeEach, vi } from "vitest";

let supabaseStub: any = null;
// `vi.mock` factories are hoisted above regular top-level statements (ESM
// import linking runs before the rest of the module body), so a factory that
// eagerly reads a plain `const` (e.g. `() => ({ refreshRules })`) would hit a
// TDZ ReferenceError. `vi.hoisted` creates these before the hoisted mocks run.
const { refreshRules, refreshErrata } = vi.hoisted(() => ({
  refreshRules: vi.fn().mockResolvedValue([]),
  refreshErrata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ userId: "user-1" }),
}));
vi.mock("@/services/rulesService", () => ({ refreshRules }));
vi.mock("@/services/errataService", () => ({ refreshErrata }));

import {
  upsertRuleOverride,
  deleteRuleOverride,
  createErratum,
  updateErratum,
  deleteErratum,
  setUserRole,
  listAudit,
  listProfiles,
} from "@/services/adminService";

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Stub minimal de `supabase` qui ENREGISTRE ce qu'il reçoit — table passée à
 * `.from()`, chaîne d'appels (`.eq()`, `.order()`...), RPC + params — au lieu
 * de l'ignorer. Un stub aveugle aux arguments (`from: () => ({ upsert: () =>
 * ... })`) laisserait passer une implémentation qui écrirait dans la
 * mauvaise table ou filtrerait sur la mauvaise colonne ; on ne peut le
 * détecter qu'en vérifiant CE QUI a été appelé, pas seulement le résultat.
 *
 * Chaque méthode de chaîne (`select`, `upsert`, `insert`, `update`, `delete`,
 * `eq`, `order`, `limit`) renvoie le même builder (chainable à volonté, comme
 * le vrai client Supabase) et le builder est "thenable" : `await` dessus
 * résout `result`, à n'importe quel point de la chaîne — exactement comme un
 * `PostgrestFilterBuilder` réel.
 */
function makeSupabaseStub(
  result: { data?: unknown; error?: unknown } = { error: null },
) {
  const calls: { from: string[]; chain: StubCall[]; rpc: StubCall[] } = {
    from: [],
    chain: [],
    rpc: [],
  };
  const chainMethods = [
    "select",
    "upsert",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "limit",
  ] as const;
  function makeBuilder() {
    const builder: any = {
      then: (onFulfilled: any, onRejected?: any) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };
    for (const method of chainMethods) {
      builder[method] = (...args: unknown[]) => {
        calls.chain.push({ method, args });
        return builder;
      };
    }
    return builder;
  }
  const stub = {
    from: (table: string) => {
      calls.from.push(table);
      return makeBuilder();
    },
    rpc: (name: string, params: unknown) => {
      calls.rpc.push({ method: name, args: [params] });
      return Promise.resolve(result);
    },
  };
  return { stub, calls };
}

describe("adminService", () => {
  beforeEach(() => {
    supabaseStub = null;
    refreshRules.mockClear();
    refreshErrata.mockClear();
  });

  it("devrait échouer proprement sans backend", async () => {
    const res = await upsertRuleOverride({
      number: "418.5b",
      chapter: 4,
      body: "x",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("devrait remonter le refus de la base sans lever", async () => {
    const { stub, calls } = makeSupabaseStub({
      error: { message: "row-level security" },
    });
    supabaseStub = stub;
    const res = await upsertRuleOverride({
      number: "418.5b",
      chapter: 4,
      body: "x",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("row-level security");
    expect(refreshRules).not.toHaveBeenCalled();
    expect(calls.from).toEqual(["rules_overrides"]);
  });

  it("devrait rafraîchir l'index après une écriture réussie", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    const res = await upsertRuleOverride({
      number: "418.5b",
      chapter: 4,
      body: "x",
    });
    expect(res.ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
    expect(calls.from).toEqual(["rules_overrides"]);
    expect(calls.chain.some((c) => c.method === "upsert")).toBe(true);
  });

  it("devrait rafraîchir après suppression d'un override", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    expect((await deleteRuleOverride("418.5b")).ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
    expect(calls.from).toEqual(["rules_overrides"]);
    const eqCall = calls.chain.find((c) => c.method === "eq");
    expect(eqCall?.args).toEqual(["number", "418.5b"]);
  });

  it("devrait rafraîchir l'index errata après création", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    const res = await createErratum({
      card_id: "opee-tissoin-incarnam",
      summary: "Passe à 6 PA.",
    });
    expect(res.ok).toBe(true);
    expect(refreshErrata).toHaveBeenCalledTimes(1);
    expect(calls.from).toEqual(["card_errata"]);
  });

  it("devrait rafraîchir l'index errata après une mise à jour réussie", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    const res = await updateErratum(42, { summary: "Corrigé." });
    expect(res.ok).toBe(true);
    expect(refreshErrata).toHaveBeenCalledTimes(1);
    expect(calls.from).toEqual(["card_errata"]);
    const eqCall = calls.chain.find((c) => c.method === "eq");
    expect(eqCall?.args).toEqual(["id", 42]);
  });

  it("ne devrait pas rafraîchir l'index errata si la mise à jour est refusée", async () => {
    const { stub } = makeSupabaseStub({
      error: { message: "row-level security" },
    });
    supabaseStub = stub;
    const res = await updateErratum(42, { summary: "Corrigé." });
    expect(res.ok).toBe(false);
    expect(refreshErrata).not.toHaveBeenCalled();
  });

  it("devrait rafraîchir l'index errata après suppression", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    const res = await deleteErratum(42);
    expect(res.ok).toBe(true);
    expect(refreshErrata).toHaveBeenCalledTimes(1);
    expect(calls.from).toEqual(["card_errata"]);
    const eqCall = calls.chain.find((c) => c.method === "eq");
    expect(eqCall?.args).toEqual(["id", 42]);
  });

  it("ne devrait pas rafraîchir l'index errata si la suppression est refusée", async () => {
    const { stub } = makeSupabaseStub({
      error: { message: "row-level security" },
    });
    supabaseStub = stub;
    const res = await deleteErratum(42);
    expect(res.ok).toBe(false);
    expect(refreshErrata).not.toHaveBeenCalled();
  });

  it("devrait remonter le refus de set_user_role (réservé au propriétaire)", async () => {
    const { stub, calls } = makeSupabaseStub({
      error: { message: "Réservé au propriétaire" },
    });
    supabaseStub = stub;
    const res = await setUserRole("user-2", "admin");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("propriétaire");
    expect(calls.rpc).toEqual([
      {
        method: "set_user_role",
        args: [{ p_user_id: "user-2", p_role: "admin" }],
      },
    ]);
  });

  it("devrait renvoyer { ok: true } après une attribution de rôle réussie", async () => {
    const { stub, calls } = makeSupabaseStub({ error: null });
    supabaseStub = stub;
    const res = await setUserRole("user-2", "admin");
    expect(res).toEqual({ ok: true });
    expect(calls.rpc).toEqual([
      {
        method: "set_user_role",
        args: [{ p_user_id: "user-2", p_role: "admin" }],
      },
    ]);
  });

  // Garde de non-régression pour le finding 4 : avant le fix, seules
  // `listAudit`/`listProfiles` avaient un try/catch ; les 6 écritures
  // laissaient une exception synchrone (client mal configuré, contexte
  // sans Pinia, `refreshRules()`/`refreshErrata()` qui lève) rejeter la
  // promesse au lieu de dégrader en `{ ok: false }`, ce qui viole
  // l'invariant du projet « ce service ne lève jamais ».
  it("devrait renvoyer { ok: false } — jamais rejeter — quand le client Supabase lève une exception synchrone, pour les 6 écritures", async () => {
    const throwingStub = {
      from: () => {
        throw new Error("network down");
      },
      rpc: () => {
        throw new Error("network down");
      },
    };
    supabaseStub = throwingStub;

    await expect(
      upsertRuleOverride({ number: "418.5b", chapter: 4, body: "x" }),
    ).resolves.toEqual({ ok: false, error: "network down" });
    await expect(deleteRuleOverride("418.5b")).resolves.toEqual({
      ok: false,
      error: "network down",
    });
    await expect(
      createErratum({ card_id: "opee-tissoin-incarnam", summary: "x" }),
    ).resolves.toEqual({ ok: false, error: "network down" });
    await expect(updateErratum(42, { summary: "x" })).resolves.toEqual({
      ok: false,
      error: "network down",
    });
    await expect(deleteErratum(42)).resolves.toEqual({
      ok: false,
      error: "network down",
    });
    await expect(setUserRole("user-2", "admin")).resolves.toEqual({
      ok: false,
      error: "network down",
    });
  });

  describe("listAudit", () => {
    it("devrait renvoyer [] sans backend", async () => {
      supabaseStub = null;
      expect(await listAudit()).toEqual([]);
    });

    it("devrait renvoyer [] si la requête échoue", async () => {
      const { stub, calls } = makeSupabaseStub({
        data: null,
        error: { message: 'relation "admin_audit" does not exist' },
      });
      supabaseStub = stub;
      expect(await listAudit()).toEqual([]);
      expect(calls.from).toEqual(["admin_audit"]);
    });

    // Garde de non-régression pour le finding 1 : sans try/catch autour de
    // l'appel, une exception synchrone (table cassée, RLS mal configurée,
    // client réseau qui lève) remonterait telle quelle au lieu de dégrader
    // en liste vide.
    it("devrait renvoyer [] si la requête lève une exception", async () => {
      supabaseStub = {
        from: () => {
          throw new Error("network down");
        },
      };
      expect(await listAudit()).toEqual([]);
    });
  });

  describe("listProfiles", () => {
    it("devrait renvoyer [] sans backend", async () => {
      supabaseStub = null;
      expect(await listProfiles()).toEqual([]);
    });

    it("devrait renvoyer [] si la requête échoue", async () => {
      const { stub, calls } = makeSupabaseStub({
        data: null,
        error: { message: 'relation "profiles" does not exist' },
      });
      supabaseStub = stub;
      expect(await listProfiles()).toEqual([]);
      expect(calls.from).toEqual(["profiles"]);
    });

    // Même garde de non-régression que listAudit, pour finding 1.
    it("devrait renvoyer [] si la requête lève une exception", async () => {
      supabaseStub = {
        from: () => {
          throw new Error("network down");
        },
      };
      expect(await listProfiles()).toEqual([]);
    });
  });
});
