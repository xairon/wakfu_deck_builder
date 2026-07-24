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
  setUserRole,
} from "@/services/adminService";

describe("adminService", () => {
  beforeEach(() => {
    supabaseStub = null;
    refreshRules.mockClear();
    refreshErrata.mockClear();
  });

  it("devrait échouer proprement sans backend", async () => {
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("devrait remonter le refus de la base sans lever", async () => {
    supabaseStub = {
      from: () => ({
        upsert: () =>
          Promise.resolve({ error: { message: "row-level security" } }),
      }),
    };
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("row-level security");
    expect(refreshRules).not.toHaveBeenCalled();
  });

  it("devrait rafraîchir l'index après une écriture réussie", async () => {
    supabaseStub = {
      from: () => ({ upsert: () => Promise.resolve({ error: null }) }),
    };
    const res = await upsertRuleOverride({ number: "418.5b", body: "x" });
    expect(res.ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
  });

  it("devrait rafraîchir après suppression d'un override", async () => {
    supabaseStub = {
      from: () => ({
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
    expect((await deleteRuleOverride("418.5b")).ok).toBe(true);
    expect(refreshRules).toHaveBeenCalledTimes(1);
  });

  it("devrait rafraîchir l'index errata après création", async () => {
    supabaseStub = {
      from: () => ({ insert: () => Promise.resolve({ error: null }) }),
    };
    const res = await createErratum({
      card_id: "opee-tissoin-incarnam",
      summary: "Passe à 6 PA.",
    });
    expect(res.ok).toBe(true);
    expect(refreshErrata).toHaveBeenCalledTimes(1);
  });

  it("devrait remonter le refus de set_user_role (réservé au propriétaire)", async () => {
    supabaseStub = {
      rpc: () =>
        Promise.resolve({ error: { message: "Réservé au propriétaire" } }),
    };
    const res = await setUserRole("user-2", "admin");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("propriétaire");
  });
});
