/**
 * RÉGRESSION — boucle infinie de pompe ré-entrante (804.7).
 *
 * Un effet de Dommages (ici `damageAll`) qui frappe un Porteur de Cape du Prespic
 * (riposte `onDamageToBearer`) déclenchait une frame de riposte PENDANT la
 * résolution de la frame de Dommages. `enqueueEffect` relançait alors une pompe
 * IMBRIQUÉE qui ré-exécutait `effectQueue[0]` — la frame de Dommages encore en
 * tête, pas encore consommée — depuis son premier op : elle ré-infligeait ses
 * Dommages, re-déclenchait la Cape, et ainsi de suite jusqu'au dépassement de
 * pile (le Héros frappé n'ayant jamais quitté le Monde à 0 PV, la boucle ne
 * convergeait pas). Correctif : un `enqueueEffect` déclenché en cours de pompe se
 * contente d'ENFILER ; la pompe active draine la frame ajoutée APRÈS avoir
 * consommé la frame courante (déclenché résolu APRÈS l'événement — fidèle 804.7).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import type { TriggeredFrame } from "../triggers";

const CAPE: Card = {
  id: "cCape",
  name: "Cape du Prespic",
  mainType: "Équipement",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  effects: [
    {
      description:
        "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de la Cape du Prespic, la Cape du Prespic lui inflige 1 Dommage .",
      compiled: {
        trigger: "onDamageToBearer" as const,
        ops: [{ op: "damageRiposteSource" as const, n: 1, element: "Feu" }],
      },
    },
  ],
} as unknown as Card;
const ALLY: Card = {
  id: "cAlly",
  name: "Bombardier",
  mainType: "Allié",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  stats: {
    niveau: { value: 1, element: "Air" },
    force: { value: 3, element: "Air" },
  },
} as unknown as Card;
const HERO: Card = {
  id: "cHero",
  name: "Héros",
  mainType: "Héros",
  extension: "T",
  rarity: "Commune",
} as unknown as Card;

const getCard = (id: string | null): Card | null =>
  id === "cCape" ? CAPE : id === "cAlly" ? ALLY : id === "cHero" ? HERO : null;

/** Héros A (dans le Monde) porte une Cape du Prespic ; Allié B va frapper en masse. */
function makeState(): GameState {
  const inst = (
    id: string,
    cardId: string,
    controller: "A" | "B",
    extra: Record<string, unknown> = {},
  ) => ({
    instanceId: id,
    cardId,
    owner: controller,
    controller,
    orientation: "upright",
    location: { zone: "monde" as const },
    counters: { hp: 20 },
    ...extra,
  });
  return {
    turn: { active: "B", number: 3, firstPlayer: "A" },
    monde: ["hero-A", "hero-B", "atk", "cape"],
    instances: {
      "hero-A": inst("hero-A", "cHero", "A", { attachments: ["cape"] }),
      "hero-B": inst("hero-B", "cHero", "B"),
      atk: inst("atk", "cAlly", "B", { counters: {} }),
      cape: inst("cape", "cCape", "A", { attachedTo: "hero-A", counters: {} }),
    },
    seats: {
      A: {
        main: [],
        pioche: [],
        defausse: [],
        heroInstanceId: "hero-A",
        havreSacInstanceId: "sac-A",
      },
      B: {
        main: [],
        pioche: [],
        defausse: [],
        heroInstanceId: "hero-B",
        havreSacInstanceId: "sac-B",
      },
    },
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: (id) => getCard(id) }),
    getCard: (id) => getCard(id),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "J",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

// Une Action d'Allié B qui inflige 2 Dommages Feu à tous les Héros/Alliés du
// Monde. sourceId = l'Allié `atk` (un Allié) → le Porteur (Héros A) subit des
// Dommages d'un Allié → sa Cape RIPOSTE (onDamageToBearer).
const MASS_FRAME: TriggeredFrame = {
  seat: "B",
  sourceId: "atk",
  cardName: "Flèche Blizzard",
  ops: [
    {
      op: "damageAll",
      n: 2,
      element: "Feu",
      controller: "any",
      zones: ["monde"],
      heroes: true,
    },
  ],
} as unknown as TriggeredFrame;

describe("moteur — pas de pompe ré-entrante (anti-boucle Cape du Prespic)", () => {
  it("un damageAll qui frappe un Porteur de Cape se résout SANS dépassement de pile", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    // AVANT correctif : ré-exécution infinie de la frame damageAll → RangeError.
    expect(() => engine.enqueueTriggered([MASS_FRAME])).not.toThrow();
  });

  it("le Porteur (Héros A) n'est frappé QU'UNE fois par le damageAll (pas de ré-exécution)", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    engine.enqueueTriggered([MASS_FRAME]);
    const heroHits = dispatch.mock.calls
      .flat()
      .filter(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "hero-A" &&
          e.payload?.counter === "hp",
      );
    expect(heroHits).toHaveLength(1);
  });
});
