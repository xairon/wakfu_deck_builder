import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DeckPreviewModal from "../DeckPreviewModal.vue";
import type { Deck } from "@/types/cards";

vi.mock("@/stores/cardStore", () => ({
  useCardStore: () => ({
    cards: [
      { id: "hero-1", name: "Iop Héros", mainType: "Héros", element: "Feu" },
      { id: "hs-1", name: "Havre Sac", mainType: "Havre-Sac", element: "Neutre" },
      { id: "card-1", name: "Épée Céleste", mainType: "Action", element: "Air" },
    ],
    getCardById: (id: string) => {
      const all = [
        { id: "hero-1", name: "Iop Héros", mainType: "Héros", element: "Feu" },
        { id: "hs-1", name: "Havre Sac", mainType: "Havre-Sac", element: "Neutre" },
        { id: "card-1", name: "Épée Céleste", mainType: "Action", element: "Air" },
      ];
      return all.find((c) => c.id === id);
    },
  }),
}));

describe("DeckPreviewModal.vue", () => {
  const mockDeck: Deck = {
    id: "deck-preview-1",
    name: "Deck Test Preview",
    hero: { id: "hero-1", name: "Iop Héros", mainType: "Héros" } as any,
    havreSac: { id: "hs-1", name: "Havre Sac", mainType: "Havre-Sac" } as any,
    cards: [
      { card: { id: "card-1", name: "Épée Céleste", mainType: "Action" } as any, quantity: 2 },
    ],
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  };

  it("génère des URLs d'illustration et vignettes valides au lieu du dos de carte", () => {
    const wrapper = mount(DeckPreviewModal, {
      props: {
        isOpen: true,
        deck: mockDeck,
        isImported: false,
      },
      global: {
        stubs: {
          Teleport: true,
          CardZoomModal: true,
        },
      },
    });

    const imgs = wrapper.findAll("img");
    expect(imgs.length).toBeGreaterThan(0);

    for (const img of imgs) {
      const src = img.attributes("src") || "";
      expect(src).not.toBe("/images/card-back.webp");
      expect(src).toMatch(/\/images\/(cards\/thumbs|illustrations)\//);
    }
  });

  it("transmet correctement :open lors du clic zoom sur une carte", async () => {
    const wrapper = mount(DeckPreviewModal, {
      props: {
        isOpen: true,
        deck: mockDeck,
        isImported: false,
      },
      global: {
        stubs: {
          Teleport: true,
          CardZoomModal: {
            props: ["card", "open"],
            template: `<div class="stubbed-card-zoom" :data-open="open" />`,
          },
        },
      },
    });

    expect(wrapper.find(".stubbed-card-zoom").exists()).toBe(false);

    // Clic sur la carte
    const cardEl = wrapper.find(".cursor-pointer");
    expect(cardEl.exists()).toBe(true);
    await cardEl.trigger("click");

    const zoom = wrapper.find(".stubbed-card-zoom");
    expect(zoom.exists()).toBe(true);
    expect(zoom.attributes("data-open")).toBe("true");
  });
});
