import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import SeatHud from "../SeatHud.vue";

const counters = { hp: 30, pa: 6, pm: 3, xp: 0, level: 1 };

function factory(props: Record<string, unknown> = {}) {
  return mount(SeatHud, {
    props: { name: "Joueur 1", accent: "#f04e22", counters, ...props },
  });
}

describe("SeatHud — affichage du siège", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait afficher les valeurs PV et NIV", () => {
    const stats = factory().findAll(".ghud__stat");
    // ordre des cellules : PV, PA, PM, XP, NIV
    expect(stats[0].find(".ghud__k").text()).toBe("PV");
    expect(stats[0].find(".ghud__v").text()).toBe("30");
    expect(stats[4].find(".ghud__k").text()).toBe("NIV");
    expect(stats[4].find(".ghud__v").text()).toBe("1");
  });

  it("devrait afficher « — » pour un compteur absent", () => {
    const stats = factory({ counters: { hp: 30 } }).findAll(".ghud__stat");
    // PA non défini → tiret cadratin
    expect(stats[1].find(".ghud__v").text()).toBe("—");
  });

  it("devrait marquer le siège actif", () => {
    expect(factory({ active: true }).classes()).toContain("ghud--active");
    expect(
      factory({ active: true }).find(".ghud__active-tag").text(),
    ).toContain("actif");
    expect(factory({ active: false }).find(".ghud__active-tag").exists()).toBe(
      false,
    );
  });

  it("devrait émettre bump (compteur, delta) au clic sur +/− sauf pour NIV", async () => {
    const w = factory();
    // 4 cellules avec boutons (PV, PA, PM, XP) × 2 boutons (+ puis −). NIV n'a pas de boutons.
    const btns = w.findAll(".ghud__btn");
    expect(btns).toHaveLength(8);
    await btns[0].trigger("click");
    await btns[7].trigger("click");
    const bump = w.emitted("bump");
    expect(bump).toBeTruthy();
    expect(bump![0]).toEqual(["hp", 1]);
    expect(bump![1]).toEqual(["xp", -1]);

    const stats = w.findAll(".ghud__stat");
    expect(stats[4].find(".ghud__k").text()).toBe("NIV");
    expect(stats[4].find(".ghud__btn").exists()).toBe(false);
  });

  it("devrait passer le héros niveau 2 à >= 6 XP et niveau 1 en dessous", () => {
    const wLow = factory({ counters: { xp: 0 } });
    expect(wLow.findAll(".ghud__stat")[4].find(".ghud__v").text()).toBe("1");
    expect(wLow.find(".ghud__level-badge").text()).toBe("N1");

    const wThreshold = factory({ counters: { xp: 6 } });
    expect(wThreshold.findAll(".ghud__stat")[4].find(".ghud__v").text()).toBe("2");
    expect(wThreshold.find(".ghud__level-badge").text()).toBe("N2");

    const wBack = factory({ counters: { xp: 5 } });
    expect(wBack.findAll(".ghud__stat")[4].find(".ghud__v").text()).toBe("1");
    expect(wBack.find(".ghud__level-badge").text()).toBe("N1");

    const wHigh = factory({ counters: { xp: 18, level: 3 } });
    expect(wHigh.findAll(".ghud__stat")[4].find(".ghud__v").text()).toBe("3");
    expect(wHigh.find(".ghud__level-badge").text()).toBe("N3");
  });
});
