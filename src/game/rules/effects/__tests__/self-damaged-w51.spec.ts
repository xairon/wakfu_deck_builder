/**
 * Vague W51 (deck-driven, starter Incarnam Wa Wabbit) — DÉCLENCHÉ DE DOMMAGES
 * SUBIS PAR SOI : « Chaque fois que <self> subit des Dommages, [vous pouvez]
 * <corps> » → trigger onDamageToSelf, émis par le bus damageDealt (804.7, toute
 * provenance — combat, pouvoir, riposte : le texte ne restreint pas la source).
 *
 * Deux volets :
 *  1) DSL — compileDamagedSelfText (sujet self strict, « vous pouvez » →
 *     optional, corps via compileBody ; Porteur / clauses résiduelles → manuel).
 *  2) Bus — selfDamagedFrames : un damageDealt dont la CIBLE porte l'effet émet
 *     une frame optionnelle ; cible détruite (hors jeu) → rien (omission
 *     conservatrice, cohérente avec bearerFrames).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { compileDamagedSelfText } from "../dsl";
import { collectTriggeredEffects } from "../triggers";
import type { RuleEvent } from "../../types";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — onDamageToSelf (compileDamagedSelfText)", () => {
  it("Wa Wabbit : « Chaque fois que le Wa Wabbit subit des Dommages vous pouvez piocher une carte. »", () => {
    const c = compileDamagedSelfText(
      "Chaque fois que le Wa Wabbit subit des Dommages vous pouvez piocher une carte.",
      "Wa Wabbit",
    );
    expect(c).toEqual({
      trigger: "onDamageToSelf",
      optional: true,
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("corps OBLIGATOIRE (sans « vous pouvez ») → pas de flag optional", () => {
    const c = compileDamagedSelfText(
      "Chaque fois que le Machin subit des Dommages, piochez une carte.",
      "Machin",
    );
    expect(c).toEqual({
      trigger: "onDamageToSelf",
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("STRICT : sujet ≠ soi (veille d'autrui) → manuel", () => {
    expect(
      compileDamagedSelfText(
        "Chaque fois qu'un de vos Alliés subit des Dommages, piochez une carte.",
        "Wa Wabbit",
      ),
    ).toBeNull();
  });

  it("STRICT : sujet Porteur → manuel (c'est la riposte de Porteur, autre voie)", () => {
    expect(
      compileDamagedSelfText(
        "Chaque fois que le Porteur de la Cape subit des Dommages, piochez une carte.",
        "Cape",
      ),
    ).toBeNull();
  });

  it("STRICT : corps non compilable (« il inflige le même nombre… ») → manuel", () => {
    // Prespic Royal : magnitude miroir non modélisée → manuel.
    expect(
      compileDamagedSelfText(
        "Chaque fois que le Prespic Royal subit des Dommages, il inflige le même nombre de Dommages à l'Allié de votre choix.",
        "Prespic Royal",
      ),
    ).toBeNull();
  });

  it("GARDE ANTI-BOUCLE : un corps DOMMAGEANT (compilable par ailleurs) → manuel", () => {
    // « Infligez 1 Dommage à l'Allié de votre choix » compile normalement (op
    // damageTarget) — mais sur onDamageToSelf, un corps dommageant pourrait
    // s'auto-cibler et re-déclencher (boucle) → jamais compilé sur ce trigger.
    expect(
      compileDamagedSelfText(
        "Chaque fois que le Machin subit des Dommages, infligez 1 Dommage à l'Allié de votre choix.",
        "Machin",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : bus ────────────────────────────────────────────────────────────

const WABBIT_EFFECT = {
  description:
    "Chaque fois que le Wa Wabbit subit des Dommages vous pouvez piocher une carte.",
  compiled: {
    trigger: "onDamageToSelf" as const,
    optional: true,
    ops: [{ op: "draw" as const, n: 1 }],
  },
};

const WABBIT: Card = {
  id: "cWabbit",
  name: "Wa Wabbit",
  mainType: "Allié",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  effects: [WABBIT_EFFECT],
  stats: {
    niveau: { value: 4, element: "Terre" },
    force: { value: 4, element: "Terre" },
  },
} as unknown as Card;
const VANILLA: Card = {
  id: "cVanilla",
  name: "Vanille",
  mainType: "Allié",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  effects: [],
} as unknown as Card;

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
    counters: {},
    ...extra,
  });
  return {
    turn: { active: "A", number: 1, firstPlayer: "A" },
    monde: ["wabbit", "van"],
    instances: {
      wabbit: inst("wabbit", "cWabbit", "A"),
      van: inst("van", "cVanilla", "B"),
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: null },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: null },
    },
  } as unknown as GameState;
}

const getCard = (id: string | null): Card | null =>
  id === "cWabbit" ? WABBIT : id === "cVanilla" ? VANILLA : null;

function ctxOf(state: GameState) {
  return { state, getCard: (id: string | null) => getCard(id) };
}

const dmg = (source: string | null, target: string): RuleEvent => ({
  kind: "damageDealt",
  source,
  target,
  amount: 1,
  element: "feu",
  combat: true,
});

describe("bus — selfDamagedFrames (onDamageToSelf)", () => {
  it("des Dommages SUR le Wa Wabbit → 1 frame OPTIONNELLE pour son contrôleur", () => {
    const frames = collectTriggeredEffects(ctxOf(makeState()), [
      dmg("van", "wabbit"),
    ]);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      seat: "A",
      sourceId: "wabbit",
      cardName: "Wa Wabbit",
      optional: true,
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("TOUTE provenance : des Dommages SANS source (effet) déclenchent aussi", () => {
    // Contrairement à la riposte de Porteur (damager Allié/Héros exigé par le
    // texte), « subit des Dommages » ne restreint pas la source.
    const frames = collectTriggeredEffects(ctxOf(makeState()), [
      dmg(null, "wabbit"),
    ]);
    expect(frames).toHaveLength(1);
  });

  it("des Dommages sur une AUTRE cible → aucune frame", () => {
    expect(
      collectTriggeredEffects(ctxOf(makeState()), [dmg("wabbit", "van")]),
    ).toHaveLength(0);
  });

  it("cible DÉTRUITE par ces Dommages (en Défausse à la collecte) → aucune frame", () => {
    const state = makeState();
    (state.instances.wabbit as { location: { zone: string } }).location = {
      zone: "defausse",
    };
    expect(
      collectTriggeredEffects(ctxOf(state), [dmg("van", "wabbit")]),
    ).toHaveLength(0);
  });
});
