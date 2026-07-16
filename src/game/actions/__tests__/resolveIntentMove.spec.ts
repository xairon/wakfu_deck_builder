/**
 * Autorité serveur — MOVE_CARD Monde↔Havre-Sac (414.x). Le serveur doit
 * revalider les règles de mouvement (dressé 414.2, sortie 1er tour 506.3, Taille
 * 414.3), pas seulement propriété + zone. Sans ça un client trafiqué remettait
 * un Héros INCLINÉ au sac (esquive après attaque), sortait au 1er tour, etc.
 */
import { describe, it, expect } from "vitest";
import {
  fixture,
  setTurn,
  ctxOf,
  dispatch,
  moveHeroTo,
  HERO_A,
} from "@/game/rules/__tests__/harness";
import { resolveIntent } from "@/game/actions/resolveIntent";
import type { GameIntent } from "@/game";
import type { Seat } from "@/game";

function run(f: ReturnType<typeof fixture>, intent: GameIntent, seat: Seat) {
  const { state, getCard } = ctxOf(f);
  return resolveIntent(state, getCard, intent, seat);
}

describe("resolveIntent — MOVE_CARD 414.x (autorité serveur)", () => {
  it("un Héros INCLINÉ ne peut pas rentrer au Havre-Sac (414.2)", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    moveHeroTo(f, "A", "monde");
    dispatch(f, {
      actor: "A",
      type: "SET_ORIENTATION",
      payload: { instanceId: HERO_A, orientation: "tapped" },
    });
    const r = run(
      f,
      {
        kind: "MOVE_CARD",
        instanceId: HERO_A,
        to: { zone: "havreSac", owner: "A" },
      },
      "A",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("414.2");
  });

  it("aucune sortie dans le Monde au 1er tour (506.3)", () => {
    const f = fixture([]);
    setTurn(f, "A", 1); // premier tour de la partie
    const r = run(
      f,
      { kind: "MOVE_CARD", instanceId: HERO_A, to: { zone: "monde" } },
      "A",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("premier tour");
  });

  it("un Héros dressé sort légalement au Monde (échange autorisé)", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    const r = run(
      f,
      { kind: "MOVE_CARD", instanceId: HERO_A, to: { zone: "monde" } },
      "A",
    );
    expect("events" in r).toBe(true);
  });
});
