import { describe, it, expect, vi } from "vitest";

let configured = true;
vi.mock("@/services/supabase", () => ({
  get supabase() {
    return configured ? { auth: {} } : null;
  },
  isSupabaseConfigured: () => configured,
}));

import { getAuthProvider } from "@/services/auth";

describe("auth/index — fournisseur cloud-only", () => {
  it("retourne un fournisseur 'cloud' quand Supabase est configuré", () => {
    configured = true;
    const provider = getAuthProvider();
    expect(provider.mode).toBe("cloud");
  });

  it("lève une erreur explicite quand Supabase n'est pas configuré", () => {
    configured = false;
    expect(() => getAuthProvider()).toThrow(/Supabase/i);
  });
});
