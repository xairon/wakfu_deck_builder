import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ userId: "user-1" }),
}));

import { getMyRole } from "@/services/profileService";

function stubRole(role: unknown, error: unknown = null) {
  supabaseStub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: role, error }),
        }),
      }),
    }),
  };
}

describe("profileService.getMyRole", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    supabaseStub = null;
  });

  it("devrait renvoyer le rôle stocké", async () => {
    stubRole({ role: "admin" });
    await expect(getMyRole()).resolves.toBe("admin");
  });

  it("devrait renvoyer 'user' si Supabase n'est pas configuré", async () => {
    supabaseStub = null;
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si la requête échoue", async () => {
    stubRole(null, { message: "boom" });
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si le rôle stocké est invalide", async () => {
    stubRole({ role: "superadmin" });
    await expect(getMyRole()).resolves.toBe("user");
  });

  it("devrait renvoyer 'user' si aucun profil n'existe", async () => {
    stubRole(null);
    await expect(getMyRole()).resolves.toBe("user");
  });
});
