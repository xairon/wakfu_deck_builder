import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import GameCard from "../GameCard.vue";
import type { RedactedInstance, CardCounters } from "@/game";

// Une instance face visible, possédée par A. `effectiveForceOf` (store) renvoie
// null pour une instance hors-état → le badge Force reste masqué dans ces tests.
function baseInstance(counters: CardCounters = {}): RedactedInstance {
  return {
    instanceId: "ci_A_1",
    cardId: "c1",
    owner: "A",
    controller: "A",
    face: "recto",
    orientation: "upright",
    counters,
    attachments: [],
  };
}

describe("GameCard — badges & interactions", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait afficher les badges Dommages et Niveau", () => {
    const w = mount(GameCard, {
      props: { instance: baseInstance({ damage: 2, level: 3 }), card: null },
    });
    expect(w.find(".game-card__badge--dmg").text()).toBe("2");
    expect(w.find(".game-card__badge--lvl").text()).toBe("N3");
  });

  it("devrait masquer le badge Niveau au niveau 1", () => {
    const w = mount(GameCard, {
      props: { instance: baseInstance({ level: 1 }), card: null },
    });
    expect(w.find(".game-card__badge--lvl").exists()).toBe(false);
  });

  it("devrait afficher les PV même à 0 (et masquer Dommages à 0)", () => {
    const w = mount(GameCard, {
      props: { instance: baseInstance({ hp: 0, damage: 0 }), card: null },
    });
    expect(w.find(".game-card__badge--hp").text()).toBe("0");
    expect(w.find(".game-card__badge--dmg").exists()).toBe(false);
  });

  it("devrait rendre une carte face cachée", () => {
    const w = mount(GameCard, {
      props: { instance: { ...baseInstance(), face: "hidden" }, card: null },
    });
    expect(w.attributes("aria-label")).toBe("Carte face cachée");
    expect(w.find(".game-card__img").attributes("src")).toBe(
      "/images/card-back.webp",
    );
  });

  it("devrait émettre select au clic et zoom au double-clic", async () => {
    const w = mount(GameCard, {
      props: { instance: baseInstance(), card: null },
    });
    await w.trigger("click");
    expect(w.emitted("select")).toBeTruthy();
    await w.trigger("dblclick");
    expect(w.emitted("zoom")).toBeTruthy();
  });
});
