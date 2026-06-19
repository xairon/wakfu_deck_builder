import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import CardZoomModal from "../CardZoomModal.vue";
import { createMockHeroCard, createMockAllyCard } from "tests/factories/card";

// Stub fetchErrata so no real fetch is made
vi.mock("@/services/errataService", () => ({
  fetchErrata: async () => [],
}));

// Stub highlightEffectHtml to return the description as-is (easier assertion)
vi.mock("@/utils/effectText", () => ({
  highlightEffectHtml: (s: string) => s,
}));

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
