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
    expect(upsertRuleOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        number: "418.5b",
        chapter: 4,
        body: "Texte corrigé.",
      }),
    );
    expect(loadRules).toHaveBeenCalledTimes(2);
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
