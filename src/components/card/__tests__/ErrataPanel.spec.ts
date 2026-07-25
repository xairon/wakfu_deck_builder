import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ErrataPanel from "@/components/card/ErrataPanel.vue";

let admin = false;
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAdmin: admin }),
}));

const { listErrataAdmin, createErratum, updateErratum } = vi.hoisted(() => ({
  listErrataAdmin: vi.fn(),
  createErratum: vi.fn(),
  updateErratum: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listErrataAdmin,
  createErratum,
  updateErratum,
}));

const { refreshErrata } = vi.hoisted(() => ({ refreshErrata: vi.fn() }));
vi.mock("@/services/errataService", () => ({ refreshErrata }));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

const BASE = {
  date: "2011-10-05",
  source: "Forum officiel Wakfu",
  summary: "Coût en PA ramené à 6.",
  changes: [],
};

describe("ErrataPanel", () => {
  it("ne devrait rien rendre sans errata", () => {
    const w = mount(ErrataPanel, { props: { errata: [] } });
    expect(w.text()).toBe("");
  });

  it("devrait afficher le tableau des changements quand ils sont structurés", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          { ...BASE, changes: [{ label: "PA", before: "7", after: "6" }] },
        ],
      },
    });
    expect(w.find("table").exists()).toBe(true);

    // ORDRE des colonnes, pas seulement leur présence : si « Version imprimée »
    // et « À jouer » s'inversaient, le panneau annoncerait exactement l'inverse
    // de la vérité (« imprimé 6, à jouer 7 ») — et un toContain ne le verrait pas.
    const headers = w.findAll("thead th").map((h) => h.text());
    expect(headers).toEqual(["Champ", "Version imprimée", "À jouer"]);

    // Idem pour les cellules : valeurs distinctes (7 vs 6) pour qu'une inversion
    // change réellement l'assertion.
    const rows = w.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    const cells = rows[0].findAll("td").map((td) => td.text());
    expect(cells).toEqual(["PA", "7", "6"]);
  });

  it("devrait retomber sur la prose quand changes est vide", () => {
    const w = mount(ErrataPanel, {
      props: { errata: [{ ...BASE, before: "7 PA", after: "6 PA" }] },
    });
    expect(w.find("table").exists()).toBe(false);
    expect(w.text()).toContain("Coût en PA ramené à 6.");
    expect(w.text()).toContain("7 PA");
    expect(w.text()).toContain("6 PA");
  });

  it("devrait afficher la date en français et la source", () => {
    const w = mount(ErrataPanel, { props: { errata: [BASE] } });
    expect(w.text()).toContain("05/10/2011");
    expect(w.text()).toContain("Forum officiel Wakfu");
  });

  it("devrait ignorer une ligne de changement mal formée sans casser le reste", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          {
            ...BASE,
            changes: [
              { label: "  ", before: "a", after: "b" },
              { label: "PA", before: "7", after: "6" },
            ] as never,
          },
        ],
      },
    });

    // Une seule ligne rendue : celle au libellé blanc est écartée (une cellule
    // « Champ » vide serait muette). On assert sur les CELLULES et non sur
    // w.text() : un `not.toContain("a")` buterait sur le « a » de « ramené »
    // dans le résumé — assertion fragile qui teste la prose, pas le filtrage.
    const rows = w.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual([
      "PA",
      "7",
      "6",
    ]);
  });
});

describe("ErrataPanel — édition en place", () => {
  const stubs = {
    RouterLink: { props: ["to"], template: "<a><slot /></a>" },
  };

  beforeEach(() => {
    admin = false;
    listErrataAdmin.mockReset().mockResolvedValue([]);
    createErratum.mockReset().mockResolvedValue({ ok: true });
    updateErratum.mockReset().mockResolvedValue({ ok: true });
    refreshErrata.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("ne devrait proposer aucune édition à un non-admin", () => {
    admin = false;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
    });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(false);
  });

  it("devrait proposer l'édition à un admin", () => {
    admin = true;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
      global: { stubs },
    });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(true);
  });

  it("devrait proposer l'AJOUT à un admin sur une carte sans errata", () => {
    admin = true;
    const w = mount(ErrataPanel, {
      props: { errata: [], cardId: "bouftou-incarnam" },
      global: { stubs },
    });
    expect(w.find('[data-testid="edit-errata"]').text()).toContain("Ajouter");
  });

  it("ne devrait rien proposer sans cardId (usage lecture seule)", () => {
    admin = true;
    const w = mount(ErrataPanel, { props: { errata: [BASE] } });
    expect(w.find('[data-testid="edit-errata"]').exists()).toBe(false);
  });

  // Noter le 3ᵉ cas ci-dessus : avec `cardId` et AUCUN errata, le panneau ne
  // rend plus « rien » — il rend l'affordance d'ajout pour un admin.

  it("ne devrait pas afficher le lien historique à un non-admin", () => {
    admin = false;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
      global: { stubs },
    });
    expect(w.find('[data-testid="errata-history"]').exists()).toBe(false);
  });

  it("devrait afficher un lien historique non filtré vers /admin/journal à un admin", () => {
    admin = true;
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
      global: { stubs },
    });
    const link = w.findComponent(stubs.RouterLink);
    expect(link.exists()).toBe(true);
    expect(link.props("to")).toBe("/admin/journal");
  });

  it("devrait pré-remplir le formulaire depuis l'errata existant et appeler updateErratum à la soumission", async () => {
    admin = true;
    listErrataAdmin.mockResolvedValue([
      {
        id: 42,
        card_id: "opee-tissoin-incarnam",
        errata_date: "2011-10-05",
        source: "Forum officiel Wakfu",
        summary: "Coût en PA ramené à 6.",
        before_text: null,
        after_text: null,
        sort_order: 0,
        changes: [],
      },
    ]);
    const w = mount(ErrataPanel, {
      props: { errata: [BASE], cardId: "opee-tissoin-incarnam" },
      global: { stubs },
    });

    await w.find('[data-testid="edit-errata"]').trigger("click");
    await flushPromises();

    expect(listErrataAdmin).toHaveBeenCalled();
    expect(
      (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
    ).toBe("Coût en PA ramené à 6.");

    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();

    expect(updateErratum).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ card_id: "opee-tissoin-incarnam" }),
    );
    expect(createErratum).not.toHaveBeenCalled();
    expect(refreshErrata).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
    expect(w.find('[data-testid="errata-edit-form"]').exists()).toBe(false);
  });

  it("devrait ouvrir un formulaire vide (création) sur une carte sans errata existant et appeler createErratum", async () => {
    admin = true;
    listErrataAdmin.mockResolvedValue([]); // aucune ligne pour cette carte
    const w = mount(ErrataPanel, {
      props: { errata: [], cardId: "bouftou-incarnam" },
      global: { stubs },
    });

    await w.find('[data-testid="edit-errata"]').trigger("click");
    await flushPromises();

    await w.find('[data-testid="f-summary"]').setValue("Nouveau résumé");
    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();

    expect(createErratum).toHaveBeenCalledWith(
      expect.objectContaining({
        card_id: "bouftou-incarnam",
        summary: "Nouveau résumé",
      }),
    );
    expect(updateErratum).not.toHaveBeenCalled();
    expect(refreshErrata).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("devrait garder le formulaire ouvert avec la saisie et afficher un toast d'erreur en cas de refus", async () => {
    admin = true;
    listErrataAdmin.mockResolvedValue([]);
    createErratum.mockResolvedValue({
      ok: false,
      error: "row-level security",
    });
    const w = mount(ErrataPanel, {
      props: { errata: [], cardId: "bouftou-incarnam" },
      global: { stubs },
    });

    await w.find('[data-testid="edit-errata"]').trigger("click");
    await flushPromises();

    await w.find('[data-testid="f-summary"]').setValue("Test refusé");
    await w.find('[data-testid="errata-submit"]').trigger("click");
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith("row-level security");
    expect(w.find('[data-testid="errata-edit-form"]').exists()).toBe(true);
    expect(
      (w.find('[data-testid="f-summary"]').element as HTMLInputElement).value,
    ).toBe("Test refusé");
    expect(refreshErrata).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
