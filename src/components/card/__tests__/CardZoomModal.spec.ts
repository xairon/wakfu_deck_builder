import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import CardZoomModal from "../CardZoomModal.vue";
import { createMockHeroCard, createMockAllyCard } from "tests/factories/card";

// Stub fetchErrata so no real fetch is made
vi.mock("@/services/errataService", () => ({
  fetchErrata: async () => [],
}));

// Stub highlightEffectHtml to return the description as-is (easier assertion),
// mais conserve les vrais helpers (isEffectAnnotation, EFFECT_KIND_LABELS).
vi.mock("@/utils/effectText", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/effectText")>();
  return { ...actual, highlightEffectHtml: (s: string) => s };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CardZoomModal — effets des Héros", () => {
  it("devrait afficher les effets du recto du Héros", async () => {
    const hero = createMockHeroCard({ id: "hero-1" });
    hero.recto = {
      stats: hero.recto.stats,
      keywords: hero.recto.keywords,
      effects: [{ description: "Trêve sacrée" }],
    };
    hero.verso = {
      stats: hero.verso!.stats,
      keywords: hero.verso!.keywords,
      effects: [{ description: "Coup de grâce" }],
    };

    const wrapper = mount(CardZoomModal, {
      props: { card: hero, open: true },
    });

    // Wait for the errata watcher to resolve
    await wrapper.vm.$nextTick();

    const html = wrapper.html();
    expect(html).toContain("Trêve sacrée");
    expect(html).toContain("Coup de grâce");
  });

  it("devrait afficher un <li> d'effet pour chaque effet recto+verso", async () => {
    const hero = createMockHeroCard({ id: "hero-2" });
    hero.recto = {
      stats: hero.recto.stats,
      keywords: hero.recto.keywords,
      effects: [{ description: "Premier effet" }],
    };
    hero.verso = {
      stats: hero.verso!.stats,
      keywords: hero.verso!.keywords,
      effects: [{ description: "Deuxième effet" }],
    };

    const wrapper = mount(CardZoomModal, {
      props: { card: hero, open: true },
    });

    await wrapper.vm.$nextTick();

    const items = wrapper.findAll("li");
    const effectItems = items.filter(
      (li) =>
        li.text().includes("Premier effet") ||
        li.text().includes("Deuxième effet"),
    );
    expect(effectItems).toHaveLength(2);
  });

  it("devrait afficher la section Effets pour une carte Allié normale", async () => {
    const ally = createMockAllyCard({
      id: "ally-1",
      effects: [{ description: "Piochez une carte" }],
    });

    const wrapper = mount(CardZoomModal, {
      props: { card: ally, open: true },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain("Piochez une carte");
  });

  it("devrait masquer la section Effets pour un Héros sans effets recto/verso", async () => {
    const hero = createMockHeroCard({ id: "hero-3" });
    // recto.effects and verso.effects are [] by default in factory

    const wrapper = mount(CardZoomModal, {
      props: { card: hero, open: true },
    });

    await wrapper.vm.$nextTick();

    // The "Effets" heading should not appear
    expect(wrapper.html()).not.toContain(">Effets<");
  });
});

describe("CardZoomModal — variant panel", () => {
  it("devrait rendre le contenu inline sans <dialog> ni .modal-backdrop", async () => {
    const ally = createMockAllyCard({
      id: "ally-panel-1",
      effects: [{ description: "Effet de test panneau" }],
    });

    const wrapper = mount(CardZoomModal, {
      props: { card: ally, open: true, variant: "panel" },
    });

    await wrapper.vm.$nextTick();

    // Pas de dialog DaisyUI
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.find(".modal-backdrop").exists()).toBe(false);

    // Contenu de la fiche visible
    expect(wrapper.html()).toContain("Effet de test panneau");
    expect(wrapper.html()).toContain(ally.name);
  });

  it("devrait afficher le slot #actions dans le variant panel", async () => {
    const ally = createMockAllyCard({ id: "ally-panel-2" });

    const wrapper = mount(CardZoomModal, {
      props: { card: ally, open: true, variant: "panel" },
      slots: {
        actions: '<button data-testid="action-btn">+ Ajouter</button>',
      },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="action-btn"]').exists()).toBe(true);
  });

  it("devrait afficher un placeholder quand card est null (variant panel)", async () => {
    const wrapper = mount(CardZoomModal, {
      props: { card: null, open: true, variant: "panel" },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain("Choisissez une carte à lire");
    expect(wrapper.find("dialog").exists()).toBe(false);
  });

  it("devrait afficher les effets d'un Héros dans le variant panel", async () => {
    const hero = createMockHeroCard({ id: "hero-panel-1" });
    hero.recto = {
      stats: hero.recto.stats,
      keywords: hero.recto.keywords,
      effects: [{ description: "Effet recto panneau" }],
    };
    hero.verso = {
      stats: hero.verso!.stats,
      keywords: hero.verso!.keywords,
      effects: [{ description: "Effet verso panneau" }],
    };

    const wrapper = mount(CardZoomModal, {
      props: { card: hero, open: true, variant: "panel" },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain("Effet recto panneau");
    expect(wrapper.html()).toContain("Effet verso panneau");
    expect(wrapper.find("dialog").exists()).toBe(false);
  });
});

describe("CardZoomModal — variant modal (défaut)", () => {
  it("devrait rendre un <dialog> dans le variant modal", async () => {
    const ally = createMockAllyCard({ id: "ally-modal-1" });

    const wrapper = mount(CardZoomModal, {
      props: { card: ally, open: true },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find("dialog").exists()).toBe(true);
    expect(wrapper.html()).toContain(ally.name);
  });

  it("devrait afficher le slot #actions dans le variant modal", async () => {
    const ally = createMockAllyCard({ id: "ally-modal-2" });

    const wrapper = mount(CardZoomModal, {
      props: { card: ally, open: true, variant: "modal" },
      slots: {
        actions: '<button data-testid="modal-action-btn">+ Ajouter</button>',
      },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="modal-action-btn"]').exists()).toBe(
      true,
    );
  });
});
