import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Voir AdminErrataView.spec.ts : vi.mock est hoisté au-dessus de TOUT le
// module (imports compris), donc un `const x = vi.fn()` référencé par
// raccourci dans la factory serait en TDZ dès que AdminRulesView.vue (qui
// importe @/services/adminService) est chargé. `vi.hoisted` évite ça.
const { loadRules, upsertRuleOverride, deleteRuleOverride } = vi.hoisted(
  () => ({
    loadRules: vi.fn(),
    upsertRuleOverride: vi.fn(),
    deleteRuleOverride: vi.fn(),
  }),
);

const ROWS = [
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Texte officiel.",
    sort_order: 3,
    is_edited: false,
    body_official: "Texte officiel.",
  },
];

vi.mock("@/services/rulesService", () => ({
  loadRules,
  getRules: () => ROWS,
}));
vi.mock("@/services/adminService", () => ({
  upsertRuleOverride,
  deleteRuleOverride,
}));

import AdminRulesView from "@/views/admin/AdminRulesView.vue";

const stubs = {
  ConfirmDialog: {
    props: ["open"],
    template:
      '<div v-if="open"><button class="confirm" @click="$emit(\'confirm\')">ok</button></div>',
  },
};

describe("AdminRulesView", () => {
  beforeEach(() => {
    loadRules.mockReset().mockResolvedValue(ROWS);
    upsertRuleOverride.mockReset().mockResolvedValue({ ok: true });
    deleteRuleOverride.mockReset().mockResolvedValue({ ok: true });
  });

  it("devrait enregistrer une correction et recharger", async () => {
    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();
    await w.find('[data-testid="edit-418.5b"]').trigger("click");
    await w.find('[data-testid="body-418.5b"]').setValue("Texte corrigé.");
    await w.find('[data-testid="save-418.5b"]').trigger("click");
    await flushPromises();
    // toHaveBeenCalledWith (payload EXACT, pas objectContaining) : un
    // objectContaining ne peut pas détecter une clé MANQUANTE — c'est
    // exactement ce qui a laissé passer l'omission de `sort_order`
    // (régression : la première correction d'une règle la renvoyait en tête
    // de la page publique, `rules_overrides.sort_order` valant 0 par défaut).
    expect(upsertRuleOverride).toHaveBeenCalledWith({
      number: "418.5b",
      chapter: 4,
      kind: "rule",
      body: "Texte corrigé.",
      sort_order: 3,
    });
    expect(loadRules).toHaveBeenCalledTimes(2);
  });

  it("devrait refuser une correction au texte vide ou uniquement blanc", async () => {
    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();
    await w.find('[data-testid="edit-418.5b"]').trigger("click");
    await w.find('[data-testid="body-418.5b"]').setValue("   ");
    await w.find('[data-testid="save-418.5b"]').trigger("click");
    await flushPromises();
    expect(upsertRuleOverride).not.toHaveBeenCalled();
    expect(w.find('[data-testid="save-418.5b"]').exists()).toBe(true); // formulaire toujours ouvert
    expect(w.text()).toContain("Le texte ne peut pas être vide.");
  });

  it("devrait dériver le sort_order de la règle qui précède lors de l'ajout", async () => {
    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();
    await w.find('[data-testid="new-rule"]').trigger("click");
    await w.find('[data-testid="f-number"]').setValue("418.5c");
    await w.find('[data-testid="f-chapter"]').setValue(4);
    await w
      .find('[data-testid="f-body"]')
      .setValue("Texte de la nouvelle règle.");
    await w.find('[data-testid="add-rule-submit"]').trigger("click");
    await flushPromises();
    // 418.5c doit reprendre le sort_order de 418.5b (qui la précède) : le
    // tri secondaire par `number` la range juste après elle, sans renuméroter
    // le reste — cf. spec "une règle ajoutée reprend le sort_order de la
    // règle qui la précède".
    expect(upsertRuleOverride).toHaveBeenCalledWith({
      number: "418.5c",
      chapter: 4,
      body: "Texte de la nouvelle règle.",
      sort_order: 3,
    });
  });

  it("devrait étiqueter « Ajoutée » une règle sans texte officiel, et « Corrigée » sinon", async () => {
    const mixedRows = [
      {
        number: "418.5b",
        kind: "rule",
        chapter: 4,
        title: null,
        body: "Texte corrigé.",
        sort_order: 3,
        is_edited: true,
        body_official: "Texte officiel.",
      },
      {
        number: "418.5c",
        kind: "rule",
        chapter: 4,
        title: null,
        body: "Règle ajoutée.",
        sort_order: 3,
        is_edited: true,
        body_official: null,
      },
    ];
    loadRules.mockResolvedValue(mixedRows);

    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();

    const correctedRow = w.find('[id="418.5b"]');
    expect(correctedRow.text()).toContain("Corrigée");
    expect(correctedRow.text()).not.toContain("Ajoutée");

    const addedRow = w.find('[id="418.5c"]');
    expect(addedRow.text()).toContain("Ajoutée");
    expect(addedRow.text()).not.toContain("Corrigée");
  });

  it("devrait rétablir le texte officiel après confirmation", async () => {
    const editedRows = [
      {
        number: "418.5b",
        kind: "rule",
        chapter: 4,
        title: null,
        body: "Texte corrigé.",
        sort_order: 3,
        is_edited: true,
        body_official: "Texte officiel.",
      },
    ];
    loadRules.mockResolvedValue(editedRows);

    const w = mount(AdminRulesView, { global: { stubs } });
    await flushPromises();

    // Le bouton "Rétablir l'officiel" n'apparaît que si is_edited + body_official.
    const restoreBtn = w.find('[data-testid="restore-418.5b"]');
    expect(restoreBtn.exists()).toBe(true);
    await restoreBtn.trigger("click"); // ouvre le ConfirmDialog
    await w.find(".confirm").trigger("click");
    await flushPromises();

    expect(deleteRuleOverride).toHaveBeenCalledWith("418.5b");
    expect(loadRules).toHaveBeenCalledTimes(2); // montage + après rétablissement
  });
});
