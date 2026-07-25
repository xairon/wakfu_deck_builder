import { describe, it, expect, beforeEach, vi } from "vitest";

let authState = { isAuthenticated: false, isAdmin: false, isOwner: false };

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    ...authState,
    initialize: () => Promise.resolve(),
  }),
}));

import router from "@/router";

describe("gardes d'administration", () => {
  beforeEach(() => {
    authState = { isAuthenticated: false, isAdmin: false, isOwner: false };
  });

  it("devrait renvoyer un visiteur non connecté vers /auth", async () => {
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("auth");
    expect(router.currentRoute.value.query.redirect).toBe("/admin");
  });

  it("devrait refuser l'accès à un connecté NON admin", async () => {
    authState = { isAuthenticated: true, isAdmin: false, isOwner: false };
    await router.push("/admin");
    expect(router.currentRoute.value.name).toBe("accessDenied");
  });

  it("devrait laisser passer un admin", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: false };
    await router.push("/admin");
    expect(router.currentRoute.value.name).toBe("admin");
  });

  it("devrait refuser /admin/comptes à un admin non owner", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: false };
    await router.push("/admin/comptes");
    expect(router.currentRoute.value.name).toBe("accessDenied");
  });

  it("devrait laisser passer l'owner sur /admin/comptes", async () => {
    authState = { isAuthenticated: true, isAdmin: true, isOwner: true };
    await router.push("/admin/comptes");
    expect(router.currentRoute.value.name).toBe("adminAccounts");
  });
});
