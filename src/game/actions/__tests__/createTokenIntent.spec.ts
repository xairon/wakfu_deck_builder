/**
 * F4 (Cadre) — intent CREATE_TOKEN : geste manuel « Mettez en jeu un jeton… ».
 * Le serveur dérive le cardId SYNTHÉTIQUE (jamais fourni par le client) et le
 * pair résout la carte par parse auto-réparant du cardId (réseau/resync).
 */
import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";
import type { Seat } from "@/game";
import { createGame, deriveState } from "@/game";
import { resolveIntent } from "@/game/actions/resolveIntent";
import {
  getTokenCard,
  parseTokenCardId,
  resetTokenRegistry,
} from "@/game/rules/effects/tokens";

const DECKS = {
  A: createMockDeck({ hero: createMockHeroCard({ id: "A-h" }) }),
  B: createMockDeck({
    hero: createMockHeroCard({ id: "B-h" }),
    havreSac: createMockHavreSacCard({ id: "B-s" }),
  }),
} as Record<Seat, Deck>;
const getCard = (): Card | null => null;

function setup() {
  const { events } = createGame("tok-t", DECKS, {
    firstPlayer: "A",
    seedA: "a",
    seedB: "b",
  });
  return deriveState(events);
}

describe("CREATE_TOKEN (table manuelle)", () => {
  it("mint un jeton du gabarit sous le contrôle de l'acteur, dans le Monde", () => {
    const state = setup();
    const res = resolveIntent(
      state,
      getCard,
      {
        kind: "CREATE_TOKEN",
        name: "Monstre - Arakne",
        force: 2,
        element: "Terre",
      },
      "A",
      { manual: true },
    );
    if (!("events" in res)) throw new Error(`refusé : ${res.error}`);
    const ev = res.events[0];
    expect(ev.type).toBe("CREATE_TOKEN");
    const p = ev.payload as { instanceId: string; cardId: string };
    expect(p.cardId.startsWith("__token__:")).toBe(true);
    // Le pair (registre vierge) résout la carte par parse du cardId.
    resetTokenRegistry();
    const card = getTokenCard(p.cardId);
    expect(card?.name).toBe("Monstre - Arakne");
    expect(card?.stats?.force?.value).toBe(2);
    expect(parseTokenCardId(p.cardId)?.element).toBe("Terre");
  });

  it("REFUSÉ hors table manuelle (partie assistée : les jetons dérivent des effets)", () => {
    const state = setup();
    const res = resolveIntent(
      state,
      getCard,
      { kind: "CREATE_TOKEN", name: "X", force: 1 },
      "A",
      { manual: false },
    );
    expect("error" in res && res.error).toContain("assistée");
  });

  it("valide nom et Force (bornes)", () => {
    const state = setup();
    const bad = resolveIntent(
      state,
      getCard,
      { kind: "CREATE_TOKEN", name: "  ", force: 3 },
      "A",
      { manual: true },
    );
    expect("error" in bad).toBe(true);
    const bad2 = resolveIntent(
      state,
      getCard,
      { kind: "CREATE_TOKEN", name: "X", force: 120 },
      "A",
      { manual: true },
    );
    expect("error" in bad2).toBe(true);
  });
});
