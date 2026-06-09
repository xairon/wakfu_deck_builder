import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandFan from "../HandFan.vue";
import type { HandItem } from "../HandFan.vue";
import type { RedactedInstance } from "@/game";

function inst(id: string): RedactedInstance {
  return {
    instanceId: id,
    cardId: `card-${id}`,
    owner: "A",
    controller: "A",
    face: "recto",
    orientation: "upright",
    counters: {},
    attachments: [],
  };
}

function items(n: number): HandItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    inst: inst(`i${i}`),
  }));
}

const resolveCard = () => null;

describe("HandFan — éventail de main", () => {
  it("rend une carte par item, en éventail (rotations opposées aux extrémités)", () => {
    const wrapper = mount(HandFan, {
      props: { items: items(5), resolveCard, mine: true },
    });
    const cards = wrapper.findAll(".hand-fan__card");
    expect(cards).toHaveLength(5);
    const rot = (i: number) =>
      parseFloat(
        (cards[i].attributes("style") ?? "").match(
          /--rot: (-?[\d.]+)deg/,
        )?.[1] ?? "NaN",
      );
    expect(rot(0)).toBeLessThan(0);
    expect(rot(2)).toBe(0); // carte centrale droite
    expect(rot(4)).toBeGreaterThan(0);
    expect(rot(4)).toBeCloseTo(-rot(0), 5);
  });

  it("affiche des dos de carte pour la main adverse (inst null)", () => {
    const backs: HandItem[] = Array.from({ length: 4 }, (_, i) => ({
      key: `b${i}`,
      inst: null,
    }));
    const wrapper = mount(HandFan, {
      props: { items: backs, resolveCard },
    });
    expect(wrapper.classes()).toContain("hand-fan--opp");
    expect(wrapper.findAll(".hand-fan__back")).toHaveLength(4);
    expect(wrapper.findAll(".game-card")).toHaveLength(0);
  });

  it("émet select avec l'instanceId au clic sur une carte", async () => {
    const wrapper = mount(HandFan, {
      props: { items: items(3), resolveCard, mine: true },
    });
    await wrapper.findAll(".game-card")[1].trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["i1"]);
  });

  it("affiche « Main vide » pour ma main sans carte", () => {
    const wrapper = mount(HandFan, {
      props: { items: [], resolveCard, mine: true },
    });
    expect(wrapper.text()).toContain("Main vide");
  });
});
