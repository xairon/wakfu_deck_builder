import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

let owner = false;
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAdmin: true, isOwner: owner }),
}));

import AdminHomeView from "@/views/admin/AdminHomeView.vue";

const stubs = { RouterLink: { props: ["to"], template: "<a><slot /></a>" } };

describe("AdminHomeView", () => {
  it("devrait lister errata, règles et journal", () => {
    owner = false;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).toContain("Errata");
    expect(w.text()).toContain("Règles");
    expect(w.text()).toContain("Journal");
  });

  it("ne devrait PAS proposer Comptes à un admin non-owner", () => {
    owner = false;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).not.toContain("Comptes");
  });

  it("devrait proposer Comptes à l'owner", () => {
    owner = true;
    const w = mount(AdminHomeView, { global: { stubs } });
    expect(w.text()).toContain("Comptes");
  });
});
