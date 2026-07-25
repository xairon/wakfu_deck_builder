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
const {
  listErrataAdmin,
  createErratum,
  updateErratum,
  deleteErratum,
  getAuditEntry,
  listProfiles,
} = vi.hoisted(() => ({
  listErrataAdmin: vi.fn(),
  createErratum: vi.fn(),
  updateErratum: vi.fn(),
  deleteErratum: vi.fn(),
  getAuditEntry: vi.fn(),
  listProfiles: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listErrataAdmin,
  createErratum,
  updateErratum,
  deleteErratum,
  getAuditEntry,
  listProfiles,
}));

// Le composable de reprise lit `?reuse=` et nettoie l'URL : sans routeur monté,
// on stubbe les deux hooks et on observe `replace`.
const { routeQuery, routerReplace } = vi.hoisted(() => ({
  routeQuery: { value: {} as Record<string, unknown> },
  routerReplace: vi.fn(),
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({
    get query() {
      return routeQuery.value;
    },
  }),
  useRouter: () => ({ replace: routerReplace }),
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

describe("AdminErrataView — reprise d'une version du journal", () => {
  const SNAPSHOT = {
    id: 7,
    card_id: "opee-tissoin-incarnam",
    errata_date: "2010-12-01",
    source: "Forum officiel",
    summary: "Passe à 6 PA.",
    before_text: "7 PA",
    after_text: "6 PA",
    changes: [{ label: "PA", before: "7", after: "6" }],
  };

  function auditEntry(over: Record<string, unknown> = {}) {
    return {
      id: 12,
      actor: "u-1",
      action: "update",
      entity: "errata",
      entity_key: "7",
      before_data: { ...SNAPSHOT, summary: "Ancien résumé." },
      after_data: SNAPSHOT,
      created_at: "2026-07-24T09:00:00Z",
      ...over,
    };
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routeQuery.value = {};
    listProfiles.mockResolvedValue([
      { user_id: "u-1", username: "Tavoshel", role: "admin" },
    ]);
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
        changes: [],
      },
    ]);
  });

  it("devrait pré-remplir le formulaire depuis l'instantané « après »", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    const w = mountView();
    await flushPromises();

    expect(getAuditEntry).toHaveBeenCalledWith(12);
    const field = (id: string) =>
      (w.find(`[data-testid="${id}"]`).element as HTMLInputElement).value;
    expect(field("f-summary")).toBe("Passe à 6 PA.");
    expect(field("f-before")).toBe("7 PA");
    expect(field("f-after")).toBe("6 PA");
    expect(field("change-label-0")).toBe("PA");
  });

  it("devrait prendre l'instantané « avant » quand side=before", async () => {
    routeQuery.value = { reuse: "12", side: "before" };
    getAuditEntry.mockResolvedValue(auditEntry());
    const w = mountView();
    await flushPromises();
    expect(
      (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
    ).toBe("Ancien résumé.");
  });

  it("ne devrait RIEN écrire : la reprise ouvre l'éditeur, elle n'enregistre pas", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    mountView();
    await flushPromises();
    expect(createErratum).not.toHaveBeenCalled();
    expect(updateErratum).not.toHaveBeenCalled();
  });

  it("devrait afficher un bandeau nommant la version et son auteur", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    const w = mountView();
    await flushPromises();
    const banner = w.find('[data-testid="reuse-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Tavoshel");
    expect(banner.text()).toContain("relis puis enregistre");
  });

  it("devrait nettoyer ?reuse= de l'URL pour qu'un rafraîchissement ne rejoue rien", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    mountView();
    await flushPromises();
    expect(routerReplace).toHaveBeenCalledWith({ query: {} });
  });

  it("devrait rester en MODIFICATION quand l'errata existe encore", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain("Modifier l'errata");
  });

  it("devrait basculer en CRÉATION si l'errata a été supprimé depuis", async () => {
    // Un update sur un id disparu ne toucherait AUCUNE ligne, sans erreur :
    // l'admin croirait avoir restauré quelque chose.
    listErrataAdmin.mockResolvedValue([]);
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry());
    const w = mountView();
    await flushPromises();
    expect(w.text()).toContain("Nouvel errata");
  });

  it("devrait afficher une erreur si la version est introuvable, sans planter", async () => {
    routeQuery.value = { reuse: "999", side: "after" };
    getAuditEntry.mockResolvedValue(null);
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reuse-error"]').text()).toContain(
      "introuvable",
    );
    expect(w.find('[data-testid="f-summary"]').exists()).toBe(false);
  });

  it("devrait refuser un instantané d'une AUTRE entité", async () => {
    routeQuery.value = { reuse: "12", side: "after" };
    getAuditEntry.mockResolvedValue(auditEntry({ entity: "rule_override" }));
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reuse-error"]').exists()).toBe(true);
    expect(w.find('[data-testid="f-summary"]').exists()).toBe(false);
  });

  it("devrait ignorer silencieusement un ?reuse= non numérique", async () => {
    routeQuery.value = { reuse: "abc" };
    const w = mountView();
    await flushPromises();
    expect(getAuditEntry).not.toHaveBeenCalled();
    expect(w.find('[data-testid="reuse-error"]').exists()).toBe(false);
    expect(w.find('[data-testid="reuse-banner"]').exists()).toBe(false);
  });
});

describe("AdminErrataView — le bandeau de reprise ne survit pas au formulaire", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routeQuery.value = { reuse: "12", side: "after" };
    listProfiles.mockResolvedValue([]);
    listErrataAdmin.mockResolvedValue([]);
    getAuditEntry.mockResolvedValue({
      id: 12,
      actor: null,
      action: "update",
      entity: "errata",
      entity_key: "7",
      before_data: null,
      after_data: { id: 7, card_id: "x", summary: "S" },
      created_at: "2026-07-24T09:00:00Z",
    });
  });

  it("devrait retirer le bandeau quand on ouvre un nouvel errata", async () => {
    const w = mountView();
    await flushPromises();
    expect(w.find('[data-testid="reuse-banner"]').exists()).toBe(true);
    await w.find('[data-testid="new-errata"]').trigger("click");
    expect(w.find('[data-testid="reuse-banner"]').exists()).toBe(false);
  });
});
