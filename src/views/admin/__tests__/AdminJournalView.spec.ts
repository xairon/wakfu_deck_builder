import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// Voir AdminErrataView.spec.ts : `vi.hoisted` évite le TDZ des mock factories
// hissées au-dessus du module qui importe `@/services/adminService`.
const { listAudit, listProfiles } = vi.hoisted(() => ({
  listAudit: vi.fn(),
  listProfiles: vi.fn(),
}));
vi.mock("@/services/adminService", () => ({
  listAudit,
  listProfiles,
}));

import AdminJournalView from "@/views/admin/AdminJournalView.vue";

function mountView() {
  return mount(AdminJournalView);
}

describe("AdminJournalView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("devrait afficher « système » pour une entrée sans acteur", async () => {
    listAudit.mockResolvedValue([
      {
        id: 1,
        actor: null,
        action: "create",
        entity: "rule_override",
        entity_key: "101.4",
        before_data: null,
        after_data: { body: "texte" },
        created_at: "2026-07-20T10:00:00Z",
      },
    ]);
    listProfiles.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain("système");
  });

  it("devrait résoudre l'acteur connu vers son pseudo", async () => {
    listAudit.mockResolvedValue([
      {
        id: 2,
        actor: "user-abc",
        action: "update",
        entity: "errata",
        entity_key: "carte-1",
        before_data: { a: 1 },
        after_data: { a: 2 },
        created_at: "2026-07-21T11:00:00Z",
      },
    ]);
    listProfiles.mockResolvedValue([
      { user_id: "user-abc", username: "Bob", role: "admin" },
    ]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain("Bob");
  });

  it("devrait masquer les entrées des autres entités quand on filtre par entité", async () => {
    listAudit.mockResolvedValue([
      {
        id: 1,
        actor: null,
        action: "create",
        entity: "rule_override",
        entity_key: "101.4",
        before_data: null,
        after_data: { body: "texte" },
        created_at: "2026-07-20T10:00:00Z",
      },
      {
        id: 2,
        actor: "user-abc",
        action: "update",
        entity: "errata",
        entity_key: "carte-1",
        before_data: { a: 1 },
        after_data: { a: 2 },
        created_at: "2026-07-21T11:00:00Z",
      },
    ]);
    listProfiles.mockResolvedValue([
      { user_id: "user-abc", username: "Bob", role: "admin" },
    ]);

    const w = mountView();
    await flushPromises();

    // avant filtrage : les deux entités sont présentes
    expect(w.text()).toContain("101.4");
    expect(w.text()).toContain("carte-1");

    await w.find('[data-testid="filter-entity"]').setValue("errata");
    await flushPromises();

    // après filtrage sur « errata » : l'entrée rule_override a disparu
    expect(w.text()).not.toContain("101.4");
    expect(w.text()).toContain("carte-1");
  });

  it("devrait afficher « Aucune entrée » pour un journal vide, sans erreur", async () => {
    listAudit.mockResolvedValue([]);
    listProfiles.mockResolvedValue([]);

    const w = mountView();
    await flushPromises();

    expect(w.text()).toContain("Aucune entrée");
    expect(w.text().toLowerCase()).not.toContain("erreur");
  });
});

describe("AdminJournalView — réutiliser une version", () => {
  // Sur-stub local : le stub global de `tests/setup.ts` ne rend pas `href`, et
  // ici on veut asserter la CIBLE EXACTE — une mauvaise cible enverrait l'admin
  // éditer la mauvaise entité.
  const stubs = {
    RouterLink: { props: ["to"], template: "<a :href=\"to\"><slot /></a>" },
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    listProfiles.mockResolvedValue([]);
  });

  function entry(over: Record<string, unknown> = {}) {
    return {
      id: 7,
      actor: null,
      action: "update",
      entity: "errata",
      entity_key: "42",
      before_data: { summary: "avant" },
      after_data: { summary: "après" },
      created_at: "2026-07-25T10:00:00Z",
      ...over,
    };
  }

  it("devrait proposer de réutiliser chaque instantané non nul d'un errata", async () => {
    listAudit.mockResolvedValue([entry()]);
    const w = mount(AdminJournalView, { global: { stubs } });
    await flushPromises();
    expect(w.find('[data-testid="reuse-7-before"]').attributes("href")).toBe(
      "/admin/errata?reuse=7&side=before",
    );
    expect(w.find('[data-testid="reuse-7-after"]').attributes("href")).toBe(
      "/admin/errata?reuse=7&side=after",
    );
  });

  it("devrait pointer vers l'écran des règles pour une correction de règle", async () => {
    listAudit.mockResolvedValue([
      entry({ id: 8, entity: "rule_override", entity_key: "418.5b" }),
    ]);
    const w = mount(AdminJournalView, { global: { stubs } });
    await flushPromises();
    expect(w.find('[data-testid="reuse-8-before"]').attributes("href")).toBe(
      "/admin/regles?reuse=8&side=before",
    );
  });

  it("ne devrait pas proposer de réutiliser un instantané nul", async () => {
    // Une création n'a pas d'« avant » : pas de bouton mort.
    listAudit.mockResolvedValue([
      entry({ id: 9, action: "create", before_data: null }),
    ]);
    const w = mount(AdminJournalView, { global: { stubs } });
    await flushPromises();
    expect(w.find('[data-testid="reuse-9-before"]').exists()).toBe(false);
    expect(w.find('[data-testid="reuse-9-after"]').exists()).toBe(true);
  });

  it("ne devrait rien proposer pour un changement de rôle", async () => {
    // `set_user_role()` est le seul chemin d'écriture d'un rôle ; rejouer un
    // instantané contournerait ses garde-fous.
    listAudit.mockResolvedValue([
      entry({ id: 10, entity: "role", entity_key: "user-1", before_data: null }),
    ]);
    const w = mount(AdminJournalView, { global: { stubs } });
    await flushPromises();
    expect(w.find('[data-testid="reuse-10-after"]').exists()).toBe(false);
  });
});
