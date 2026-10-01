import { describe, it, expect } from "vitest";
import { authorizeDraft, redactEventForSeat } from "@/game/engine/authority";
import { lookCards } from "@/game/engine/verbs";
import { redactStateFor } from "@/game/engine/redact";
import { emptyState } from "@/game/engine/reducer";
import type { GameState, InstanceId } from "@/game";

describe("Regard in 1v1 online context", () => {
  function makeInitialState(): GameState {
    const base = emptyState();
    return {
      ...base,
      turn: {
        number: 1,
        active: "A",
        phase: "principale",
        firstPlayer: "A",
      },
      seats: {
        ...base.seats,
        A: {
          seat: "A",
          pioche: ["inst-pioche-1" as InstanceId, "inst-pioche-2" as InstanceId],
          main: [],
          havreSac: [],
          defausse: [],
          reserve: [],
          exil: [],
          limbo: [],
        },
      },
      instances: {
        ...base.instances,
        "inst-pioche-1": {
          instanceId: "inst-pioche-1" as InstanceId,
          cardId: "card-ogrest-1",
          owner: "A",
          controller: "A",
          location: { zone: "pioche", owner: "A" },
          face: "recto",
          orientation: null,
          counters: {},
          attachments: [],
          revealedTo: [],
        },
        "inst-pioche-2": {
          instanceId: "inst-pioche-2" as InstanceId,
          cardId: "card-ogrest-2",
          owner: "A",
          controller: "A",
          location: { zone: "pioche", owner: "A" },
          face: "recto",
          orientation: null,
          counters: {},
          attachments: [],
          revealedTo: [],
        },
      },
    };
  }

  it("authorizes actor A to LOOK at their own top deck card", () => {
    const state = makeInitialState();
    const draft = lookCards("A", ["inst-pioche-1" as InstanceId], ["A"]);
    expect(() => authorizeDraft(state, draft)).not.toThrow();
  });

  it("rejects actor B attempting to LOOK at actor A's deck card", () => {
    const state = makeInitialState();
    const draft = lookCards("B", ["inst-pioche-1" as InstanceId], ["B"]);
    expect(() => authorizeDraft(state, draft)).toThrow();
  });

  it("redacts revealed card identity for the opponent while revealing it to viewer A", () => {
    const state = makeInitialState();
    const draft = lookCards("A", ["inst-pioche-1" as InstanceId], ["A"]);

    // Simulate applying the look event
    const postState: GameState = {
      ...state,
      instances: {
        ...state.instances,
        "inst-pioche-1": {
          ...state.instances["inst-pioche-1"],
          revealedTo: ["A"],
        },
      },
    };

    // Redacted event for seat A (the viewer)
    const eventForA = redactEventForSeat(
      draft as any,
      "A",
      state,
      postState,
    );
    expect(eventForA.reveals?.["inst-pioche-1"]).toBe("card-ogrest-1");

    // Redacted event for seat B (the opponent)
    const eventForB = redactEventForSeat(
      draft as any,
      "B",
      state,
      postState,
    );
    expect(eventForB.reveals?.["inst-pioche-1"]).toBeUndefined();

    // Redacted postState for B keeps pioche as count-only or cardId hidden
    const stateForB = redactStateFor(postState, "B");
    const piocheB = stateForB.seats.A?.pioche;
    expect(piocheB?.kind).toBe("count");

    // Redacted postState for A shows the pioche fullZone since at least one card is revealed to A
    const stateForA = redactStateFor(postState, "A");
    const piocheA = stateForA.seats.A?.pioche;
    expect(piocheA?.kind).toBe("full");
  });
});
