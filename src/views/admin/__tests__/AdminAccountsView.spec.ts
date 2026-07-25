import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// Voir AdminErrataView.spec.ts : `vi.hoisted` évite le TDZ des mock factories
// hissées au-dessus du module qui importe `@/services/adminService`.
const { listProfiles, setUserRole } = vi.hoisted(() => ({
  listProfiles: vi.fn(),
  setUserRole: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listProfiles,
  setUserRole,
}));

import AdminAccountsView from "@/views/admin/AdminAccountsView.vue";
import { useToast } from "@/composables/useToast";

const stubs = {
  ConfirmDialog: {
    props: ["open"],
    template:
      '<div v-if="open"><button class="confirm" @click="$emit(\'confirm\')">ok</button></div>',
  },
};

function mountView() {
  return mount(AdminAccountsView, { global: { stubs } });
}

describe("AdminAccountsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setUserRole.mockResolvedValue({ ok: true });
    useToast().clearToasts();
  });

  it("ne propose aucune action pour une ligne owner", async () => {
    listProfiles.mockResolvedValue([
      { user_id: "u-owner", username: "Boss", role: "owner" },
    ]);
    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain("Boss");
    expect(w.find('[data-testid="promote-u-owner"]').exists()).toBe(false);
    expect(w.find('[data-testid="demote-u-owner"]').exists()).toBe(false);
    expect(w.find("button").exists()).toBe(false);
  });

  it("confirmer une promotion appelle setUserRole(id, admin) puis recharge la liste", async () => {
    listProfiles.mockResolvedValue([
      { user_id: "u-1", username: "Alice", role: "user" },
    ]);
    const w = mountView();
    await flushPromises();

    await w.find('[data-testid="promote-u-1"]').trigger("click");
    await w.find(".confirm").trigger("click");
    await flushPromises();

    expect(setUserRole).toHaveBeenCalledWith("u-1", "admin");
    expect(listProfiles).toHaveBeenCalledTimes(2); // montage + après promotion
  });

  it("confirmer une rétrogradation appelle setUserRole(id, user) puis recharge la liste", async () => {
    listProfiles.mockResolvedValue([
      { user_id: "u-2", username: "Carl", role: "admin" },
    ]);
    const w = mountView();
    await flushPromises();

    await w.find('[data-testid="demote-u-2"]').trigger("click");
    await w.find(".confirm").trigger("click");
    await flushPromises();

    expect(setUserRole).toHaveBeenCalledWith("u-2", "user");
    expect(listProfiles).toHaveBeenCalledTimes(2);
  });

  it("un refus de la RPC affiche le message exact et ne recharge pas la liste", async () => {
    listProfiles.mockResolvedValue([
      { user_id: "u-3", username: "Dora", role: "user" },
    ]);
    setUserRole.mockResolvedValue({
      ok: false,
      error: "Réservé au propriétaire",
    });
    const w = mountView();
    await flushPromises();

    await w.find('[data-testid="promote-u-3"]').trigger("click");
    await w.find(".confirm").trigger("click");
    await flushPromises();

    const messages = useToast().toasts.value.map((t) => t.message);
    expect(messages).toContain("Réservé au propriétaire");
    expect(listProfiles).toHaveBeenCalledTimes(1); // pas de rechargement après refus
  });

  it("ne propose jamais le rôle owner comme valeur attribuable", async () => {
    listProfiles.mockResolvedValue([
      { user_id: "u-1", username: "Alice", role: "user" },
      { user_id: "u-2", username: "Carl", role: "admin" },
      { user_id: "u-owner", username: "Boss", role: "owner" },
    ]);
    const w = mountView();
    await flushPromises();

    const html = w.html();
    expect(html).not.toMatch(/setUserRole\([^)]*owner/);
    // aucune option/valeur "owner" n'est jamais soumise : seuls "admin"/"user"
    // apparaissent comme cibles de promotion/rétrogradation possibles.
    expect(w.find('[data-testid="promote-u-owner"]').exists()).toBe(false);
    expect(w.find('[data-testid="demote-u-owner"]').exists()).toBe(false);
  });
});
