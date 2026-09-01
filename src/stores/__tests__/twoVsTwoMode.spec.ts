import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import { useGameStore } from "../gameStore";
import { createMockDeck } from "tests/factories/card";
import { grantXpEvents } from "@/game/rules/progress";
import { eligibleBlockers } from "@/game/rules/legality";

describe("gameStore — Mode 2v2 (Multijoueur en équipe)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("démarre une partie 2v2 avec 4 joueurs répartis en 2 équipes", () => {
    const store = useGameStore();
    const dA1 = createMockDeck({ id: "d-a1", name: "Deck A1" });
    const dB1 = createMockDeck({ id: "d-b1", name: "Deck B1" });
    const dA2 = createMockDeck({ id: "d-a2", name: "Deck A2" });
    const dB2 = createMockDeck({ id: "d-b2", name: "Deck B2" });

    store.startMatch(dA1, dB1, {
      mode: "2v2",
      first: "A1",
      decks: { A1: dA1, B1: dB1, A2: dA2, B2: dB2 },
      names: {
        A1: "J1 (Équipe 1)",
        B1: "J2 (Équipe 2)",
        A2: "J3 (Équipe 1)",
        B2: "J4 (Équipe 2)",
      },
    });

    expect(store.mode).toBe("2v2");
    expect(store.players.A1?.name).toBe("J1 (Équipe 1)");
    expect(store.players.B1?.name).toBe("J2 (Équipe 2)");
    expect(store.players.A2?.name).toBe("J3 (Équipe 1)");
    expect(store.players.B2?.name).toBe("J4 (Équipe 2)");

    expect(store.state.seats.A1).toBeDefined();
    expect(store.state.seats.B1).toBeDefined();
    expect(store.state.seats.A2).toBeDefined();
    expect(store.state.seats.B2).toBeDefined();

    expect(store.teamXp.team1).toBe(0);
    expect(store.teamXp.team2).toBe(0);
  });

  it("gère le cycle de mulligan des 4 joueurs dans l'ordre A1 -> B1 -> A2 -> B2", () => {
    const store = useGameStore();
    const d = createMockDeck();
    store.startMatch(d, d, {
      mode: "2v2",
      first: "A1",
      isSandbox: true,
      decks: { A1: d, B1: d, A2: d, B2: d },
    });

    expect(store.mulliganSeat).toBe("A1");
    store.keepHand();

    expect(store.mulliganSeat).toBe("B1");
    store.keepHand();

    expect(store.mulliganSeat).toBe("A2");
    store.keepHand();

    expect(store.mulliganSeat).toBe("B2");
    store.keepHand();

    expect(store.matchPhase).toBe("playing");
    expect(store.turn.active).toBe("A1");
  });

  it("alterne les tours selon le schéma croisé précis (J1 -> J2 -> J3 -> J4 -> J1)", () => {
    const store = useGameStore();
    const d = createMockDeck();
    store.startMatch(d, d, {
      mode: "2v2",
      first: "A1",
      isSandbox: true,
      decks: { A1: d, B1: d, A2: d, B2: d },
    });

    // Passer les mulligans
    store.keepHand();
    store.keepHand();
    store.keepHand();
    store.keepHand();

    // Tour 1 : A1 (Équipe 1)
    expect(store.turn.active).toBe("A1");
    expect(store.turn.number).toBe(1);
    store.endTurn();

    // Tour 2 : B1 (Équipe 2)
    expect(store.turn.active).toBe("B1");
    expect(store.turn.number).toBe(2);
    store.endTurn();

    // Tour 3 : A2 (Équipe 1 - coéquipier de A1)
    expect(store.turn.active).toBe("A2");
    expect(store.turn.number).toBe(3);
    store.endTurn();

    // Tour 4 : B2 (Équipe 2 - coéquipier de B1)
    expect(store.turn.active).toBe("B2");
    expect(store.turn.number).toBe(4);
    store.endTurn();

    // Tour 5 : Retour à A1 (Équipe 1)
    expect(store.turn.active).toBe("A1");
    expect(store.turn.number).toBe(5);
  });

  it("gère l'XP d'équipe combiné (36 XP requis) et le plafond individuel (18 XP max, Niveau 2 max)", () => {
    const store = useGameStore();
    const d = createMockDeck();
    store.startMatch(d, d, {
      mode: "2v2",
      first: "A1",
      isSandbox: true,
      decks: { A1: d, B1: d, A2: d, B2: d },
    });
    store.keepHand();
    store.keepHand();
    store.keepHand();
    store.keepHand();

    const heroA1Id = store.state.seats.A1!.heroInstanceId as string;
    const heroA2Id = store.state.seats.A2!.heroInstanceId as string;

    // 1. Donner 20 XP à A1 : doit plafonner à 18 XP (niveau 2 max) sans déclencher la victoire solo
    const grantA1 = grantXpEvents(store.rulesCtx(), "A1", 20);
    store.dispatch(...grantA1.events);

    expect(store.state.instances[heroA1Id]?.counters.xp).toBe(18);
    expect(store.state.instances[heroA1Id]?.counters.level).toBe(2); // Pas niveau 3 !
    expect(grantA1.won).toBe(false); // Pas de victoire solo !
    expect(store.winner).toBe(null);

    // 2. Donner 18 XP à A2 : Total équipe 1 = 18 + 18 = 36 XP -> Victoire d'équipe !
    const grantA2 = grantXpEvents(store.rulesCtx(), "A2", 18);
    store.dispatch(...grantA2.events);

    expect(store.state.instances[heroA2Id]?.counters.xp).toBe(18);
    expect(grantA2.won).toBe(true);
  });

  it("permet aux renforts du coéquipier d'être déclarés comme bloqueurs en 2v2", () => {
    const store = useGameStore();
    const d = createMockDeck();
    store.startMatch(d, d, {
      mode: "2v2",
      first: "A1",
      isSandbox: true,
      decks: { A1: d, B1: d, A2: d, B2: d },
    });
    store.keepHand();
    store.keepHand();
    store.keepHand();
    store.keepHand();

    // Déplacer un Allié du défenseur B1 et un Allié du coéquipier B2 dans le Monde (redressés)
    const allyB1 =
      store.state.seats.B1?.main.find((id) => {
        const c = store.resolveInstanceCard(id);
        return c?.mainType === "Allié";
      }) ?? store.state.seats.B1!.main[0];
    const allyB2 =
      store.state.seats.B2?.main.find((id) => {
        const c = store.resolveInstanceCard(id);
        return c?.mainType === "Allié";
      }) ?? store.state.seats.B2!.main[0];

    store.moveTo(allyB1, { zone: "monde" });
    store.moveTo(allyB2, { zone: "monde" });

    const target = {
      kind: "hero" as const,
      instanceId: store.state.seats.B1!.heroInstanceId as string,
    };

    // B1 est attaqué : les bloqueurs éligibles comprennent les alliés de B1 ET les renforts de B2 !
    const blockers = eligibleBlockers(store.rulesCtx(), "B1", target);
    expect(blockers).toContain(allyB1);
    expect(blockers).toContain(allyB2);
  });

  it("élimine un joueur dont le Héros tombe à 0 PV et permet au coéquipier de continuer seul", () => {
    const store = useGameStore();
    const d = createMockDeck();
    store.startMatch(d, d, {
      mode: "2v2",
      first: "A1",
      isSandbox: true,
      decks: { A1: d, B1: d, A2: d, B2: d },
    });
    store.keepHand();
    store.keepHand();
    store.keepHand();
    store.keepHand();

    const heroB1Id = store.state.seats.B1!.heroInstanceId as string;

    // Réduire les PV du Héros B1 à 0
    store.adjustCounter(heroB1Id, "hp", -50);

    // B1 est éliminé
    expect(store.eliminatedSeats).toContain("B1");
    // Mais la partie continue car B2 est encore en vie !
    expect(store.matchPhase).toBe("playing");
    expect(store.winner).toBe(null);

    // Le tour avance en sautant B1 : A1 -> A2 -> B2 -> A1
    store.endTurn(); // Tour de B1 sauté -> passe à A2
    expect(store.turn.active).toBe("A2");

    // Réduire les PV du Héros B2 à 0 -> Équipe 2 entièrement éliminée -> Équipe 1 gagne !
    const heroB2Id = store.state.seats.B2!.heroInstanceId as string;
    store.adjustCounter(heroB2Id, "hp", -50);

    expect(store.eliminatedSeats).toContain("B2");
    expect(store.matchPhase).toBe("finished");
    expect(store.winner).toBe("A1");
  });
});
