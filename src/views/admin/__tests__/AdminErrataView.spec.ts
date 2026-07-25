import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// vi.mock factories are hoisted above the whole module (including any
// dynamic `await import(...)` this file's own imports get rewritten into),
// so a plain top-level `const x = vi.fn()` referenced by shorthand inside
// the factory hits a TDZ ReferenceError the moment `AdminErrataView.vue`
// (which imports `@/services/adminService`) is loaded. `vi.hoisted` is
// vitest's documented fix: it hoists the declaration itself alongside the
// mock, so the factory can reference it safely.
const { listErrataAdmin, createErratum, deleteErratum } = vi.hoisted(() => ({
  listErrataAdmin: vi.fn(),
  createErratum: vi.fn(),
  deleteErratum: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listErrataAdmin,
  createErratum,
  updateErratum: vi.fn(),
  deleteErratum,
}));

import AdminErrataView from "@/views/admin/AdminErrataView.vue";
import { useCardStore } from "@/stores/cardStore";

const stubs = {
  ConfirmDialog: {
    props: ["open"],
    template:
      '<div v-if="open"><button class="confirm" @click="$emit(\'confirm\')">ok</button></div>',
  },
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
};

function mountView() {
  const store = useCardStore();
  store.cards = [
    {
      id: "opee-tissoin-incarnam",
      name: "Opée Tissoin",
      mainType: "Allié",
      extension: { name: "Incarnam" },
    },
  ] as any;
  return mount(AdminErrataView, { global: { stubs } });
}

describe("AdminErrataView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listErrataAdmin.mockResolvedValue([
      {
        id: 7,
        card_id: "opee-tissoin-incarnam",
        errata_date: "2010-12-01",
        source: "Forum",
        summary: "Passe à 6 PA.",
        before_text: null,
        after_text: null,
        sort_order: 0,
      },
    ]);
    createErratum.mockResolvedValue({ ok: true });
    deleteErratum.mockResolvedValue({ ok: true });
  });

  it("devrait afficher les errata existants avec le nom de carte résolu", async () => {
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain("Opée Tissoin");
    expect(w.text()).toContain("Passe à 6 PA.");
  });

  it("devrait recharger la liste après une suppression confirmée", async () => {
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="delete-7"]').trigger("click"); // ouvre le ConfirmDialog
    await w.find(".confirm").trigger("click");
    await flushPromises();
    expect(deleteErratum).toHaveBeenCalledWith(7);
    expect(listErrataAdmin).toHaveBeenCalledTimes(2); // montage + après suppression
  });

  it("devrait envoyer le payload EXACT à createErratum, changes inclus (pas objectContaining)", async () => {
    // Payload EXACT et non `objectContaining` : au lot précédent, une clé
    // omise (`sort_order`) est passée en production précisément parce
    // qu'`objectContaining` est aveugle à une clé manquante. `changes:
    // form.changes` porte toute la fonctionnalité errata structurée — si
    // cette ligne disparaît de AdminErrataView.vue, ce test doit échouer
    // (vérifié : suppression temporaire de la ligne → RED ; restauration →
    // GREEN).
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="new-errata"]').trigger("click");
    await w.find('[data-testid="f-card"]').setValue("opee-tissoin-incarnam");
    await w.find('[data-testid="f-date"]').setValue("2011-10-05");
    await w.find('[data-testid="f-source"]').setValue("Forum officiel Wakfu");
    await w
      .find('[data-testid="f-summary"]')
      .setValue("Coût en PA ramené à 6.");
    await w.find('[data-testid="f-before"]').setValue("7 PA");
    await w.find('[data-testid="f-after"]').setValue("6 PA");
    await w.find('[data-testid="add-change"]').trigger("click");
    await w.find('[data-testid="change-label-0"]').setValue("PA");
    await w.find('[data-testid="change-before-0"]').setValue("7");
    await w.find('[data-testid="change-after-0"]').setValue("6");
    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();

    expect(createErratum).toHaveBeenCalledWith({
      card_id: "opee-tissoin-incarnam",
      errata_date: "2011-10-05",
      source: "Forum officiel Wakfu",
      summary: "Coût en PA ramené à 6.",
      before_text: "7 PA",
      after_text: "6 PA",
      changes: [{ label: "PA", before: "7", after: "6" }],
    });
  });

  it("devrait afficher l'erreur de la base et conserver la saisie si la création échoue", async () => {
    createErratum.mockResolvedValue({ ok: false, error: "row-level security" });
    const w = mountView();
    await flushPromises();
    await w.find('[data-testid="new-errata"]').trigger("click");
    await w.find('[data-testid="f-summary"]').setValue("Test");
    await w.find('[data-testid="f-card"]').setValue("opee-tissoin-incarnam");
    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();
    expect(w.text()).toContain("row-level security");
    expect(
      (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
    ).toBe("Test");
  });
});
