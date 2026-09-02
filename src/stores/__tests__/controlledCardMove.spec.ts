import { describe, it, expect } from "vitest";
import {
  fixture,
  setTurn,
  ctxOf,
  dispatch,
  instId,
} from "@/game/rules/__tests__/harness";
import { resolveIntent } from "@/game/actions/resolveIntent";
import { createMockAllyCard } from "tests/factories/card";
import type { GameIntent } from "@/game";

describe("Mouvement de carte sous contrôle adverse (Monde <-> Havre-Sac)", () => {
  it("autorise le contrôleur d'une carte adverse à la déplacer vers son Havre-Sac en table libre (manual: true)", () => {
    const allyB = createMockAllyCard({ id: "allyB" });
    const f = fixture([], [allyB]);
    setTurn(f, "B", 2); // Tour de l'adversaire B

    const allyInstId = instId("B", 0);

    // B met l'allié en jeu dans le Monde
    dispatch(f, {
      actor: "B",
      type: "MOVE",
      payload: {
        instanceId: allyInstId,
        from: { zone: "pioche", owner: "B" },
        to: { zone: "monde" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
      },
    });

    // B transfère le contrôle à A
    dispatch(f, {
      actor: "B",
      type: "SET_CONTROLLER",
      payload: { instanceId: allyInstId, controller: "A" },
    });

    const { state, getCard } = ctxOf(f);
    expect(state.instances[allyInstId].controller).toBe("A");

    // A déplace cette carte dans son propre Havre-Sac (owner: "A")
    const intent: GameIntent = {
      kind: "MOVE_CARD",
      instanceId: allyInstId,
      to: { zone: "havreSac", owner: "A" },
    };

    const res = resolveIntent(state, getCard, intent, "A", { manual: true });
    expect("error" in res).toBe(false);
    if ("events" in res) {
      expect(res.events).toBeDefined();
      expect(res.events!.length).toBeGreaterThan(0);
      const moveEv = res.events![0];
      expect(moveEv.type).toBe("MOVE");
      expect(moveEv.payload.to).toEqual({ zone: "havreSac", owner: "A" });
    }
  });

  it("autorise le contrôleur à déplacer la carte depuis son Havre-Sac vers le Monde", () => {
    const allyB = createMockAllyCard({ id: "allyB" });
    const f = fixture([], [allyB]);
    setTurn(f, "B", 2);

    const allyInstId = instId("B", 0);

    // Déplacer dans le Havre-Sac de A et mettre A en contrôleur
    dispatch(f, {
      actor: "B",
      type: "MOVE",
      payload: {
        instanceId: allyInstId,
        from: { zone: "pioche", owner: "B" },
        to: { zone: "havreSac", owner: "A" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
      },
    });
    dispatch(f, {
      actor: "B",
      type: "SET_CONTROLLER",
      payload: { instanceId: allyInstId, controller: "A" },
    });

    const { state, getCard } = ctxOf(f);
    const intent: GameIntent = {
      kind: "MOVE_CARD",
      instanceId: allyInstId,
      to: { zone: "monde" },
    };

    const res = resolveIntent(state, getCard, intent, "A", { manual: true });
    expect("error" in res).toBe(false);
    if ("events" in res) {
      expect(res.events).toBeDefined();
      const moveEv = res.events![0];
      expect(moveEv.type).toBe("MOVE");
      expect(moveEv.payload.to).toEqual({ zone: "monde" });
    }
  });
});

