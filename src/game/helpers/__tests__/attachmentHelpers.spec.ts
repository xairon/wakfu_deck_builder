import { describe, it, expect } from "vitest";
import type { GameState } from "@/game/types/state";
import {
  attachCard,
  detachCard,
  moveHostCard,
  discardCardWithEquipment,
} from "../attachmentHelpers";

function createMockState(): GameState {
  return {
    gameId: "test_g1",
    status: "active",
    rng: { masterSeedHash: "" },
    seq: 0,
    turn: { number: 1, active: "A", phase: "principale", firstPlayer: "A" },
    seats: {
      A: {
        seat: "A",
        heroInstanceId: "hero_A",
        pioche: [],
        main: [],
        havreSac: ["hero_A"],
        defausse: [],
        reserve: [],
        exil: [],
        limbo: [],
      },
      B: {
        seat: "B",
        heroInstanceId: "hero_B",
        pioche: [],
        main: [],
        havreSac: ["hero_B"],
        defausse: [],
        reserve: [],
        exil: [],
        limbo: [],
      },
    },
    monde: ["ally_1", "equip_1"],
    fileAttente: [],
    instances: {
      hero_A: {
        instanceId: "hero_A",
        cardId: "card_hero",
        owner: "A",
        controller: "A",
        face: "recto",
        orientation: "upright",
        counters: {},
        attachments: [],
        location: { zone: "havreSac", owner: "A" },
        revealedTo: ["A", "B"],
      },
      ally_1: {
        instanceId: "ally_1",
        cardId: "card_ally",
        owner: "A",
        controller: "A",
        face: "recto",
        orientation: "upright",
        counters: {},
        attachments: [],
        location: { zone: "monde" },
        revealedTo: ["A", "B"],
      },
      equip_1: {
        instanceId: "equip_1",
        cardId: "card_equip",
        owner: "A",
        controller: "A",
        face: "recto",
        orientation: "upright",
        counters: {},
        attachments: [],
        location: { zone: "monde" },
        revealedTo: ["A", "B"],
      },
    },
  };
}

describe("attachmentHelpers", () => {
  it("attachCard attaches an equipment to a host ally/hero", () => {
    const state = createMockState();
    attachCard(state, "equip_1", "ally_1");

    expect(state.instances.ally_1.attachments).toContain("equip_1");
    expect(state.instances.equip_1.location).toEqual({ zone: "monde" });
  });

  it("detachCard removes equipment from host attachments", () => {
    const state = createMockState();
    attachCard(state, "equip_1", "ally_1");
    detachCard(state, "equip_1", { zone: "monde" });

    expect(state.instances.ally_1.attachments).not.toContain("equip_1");
    expect(state.instances.equip_1.location).toEqual({ zone: "monde" });
  });

  it("moveHostCard moves host card and all attached equipments follow", () => {
    const state = createMockState();
    attachCard(state, "equip_1", "ally_1");
    moveHostCard(state, "ally_1", { zone: "havreSac", owner: "A" });

    expect(state.instances.ally_1.location).toEqual({
      zone: "havreSac",
      owner: "A",
    });
    expect(state.instances.equip_1.location).toEqual({
      zone: "havreSac",
      owner: "A",
    });
  });

  it("discardCardWithEquipment sends host and all attached equipments to discard", () => {
    const state = createMockState();
    attachCard(state, "equip_1", "ally_1");
    discardCardWithEquipment(state, "ally_1");

    expect(state.instances.ally_1.location).toEqual({
      zone: "defausse",
      owner: "A",
    });
    expect(state.instances.equip_1.location).toEqual({
      zone: "defausse",
      owner: "A",
    });
    expect(state.instances.ally_1.attachments).toHaveLength(0);
  });
});
