/**
 * Vague W48 (deck-driven, starters Incarnam) — RIPOSTE DE PORTEUR (804.3).
 * « Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de <self>,
 * <self> lui inflige N Dommage [X]. » (Cape / Anneau du Prespic).
 *
 * Trois volets :
 *  1) DSL — compileBearerRiposteText → trigger onDamageToBearer + op
 *     damageRiposteSource{n,element}. L'Élément vient de l'icône RÉCUPÉRÉE
 *     (effect.elements), pas de l'Élément imprimé (Neutre).
 *  2) Bus — bearerFrames : un damageDealt d'un Allié/Héros au Porteur émet une
 *     frame de riposte (riposteTargetId = le frappeur). GARDE ANTI-BOUCLE : une
 *     source NON Allié/Héros (une autre riposte d'équipement) n'émet rien. Un
 *     Porteur détruit (hors jeu) n'émet rien.
 *  3) Moteur — le flux complet inflige les Dommages de riposte au frappeur.
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { compileBearerRiposteText } from "../dsl";
import { collectTriggeredEffects } from "../triggers";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import type { RuleEvent } from "../../types";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — riposte de Porteur (compileBearerRiposteText)", () => {
  it("Cape du Prespic → onDamageToBearer + damageRiposteSource (Élément récupéré Feu)", () => {
    const c = compileBearerRiposteText(
      "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de la cape du Prespic, la Cape du Prespic lui inflige 1 Dommage .",
      "Cape du Prespic",
      "Feu", // élément récupéré de effect.elements
    );
    expect(c).toEqual({
      trigger: "onDamageToBearer",
      ops: [{ op: "damageRiposteSource", n: 1, element: "Feu" }],
    });
  });

  it("Anneau du Prespic (article élidé « de l'Anneau ») → même forme", () => {
    const c = compileBearerRiposteText(
      "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de l'Anneau du Prespic, l'Anneau du Prespic lui inflige 1 Dommage .",
      "Anneau du Prespic",
      "Feu",
    );
    expect(c?.ops).toEqual([
      { op: "damageRiposteSource", n: 1, element: "Feu" },
    ]);
  });

  it("STRICT : sujet ≠ soi (Porteur d'une AUTRE carte) → manuel", () => {
    expect(
      compileBearerRiposteText(
        "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de la Cape du Prespic, un Autre Truc lui inflige 1 Dommage .",
        "Cape du Prespic",
        "Feu",
      ),
    ).toBeNull();
  });

  it("STRICT : clause résiduelle (condition) → manuel", () => {
    expect(
      compileBearerRiposteText(
        "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de la Cape, la Cape lui inflige 1 Dommage si elle est attaquante .",
        "Cape",
        "Feu",
      ),
    ).toBeNull();
  });

  it("STRICT : Élément NON récupéré (icône droppée absente de effect.elements) → manuel", () => {
    // Sans Élément explicite, on ne fabrique pas « Neutre » (faux) → l'effet reste
    // manuel (approximation pire qu'un rappel). Garde de fidélité.
    expect(
      compileBearerRiposteText(
        "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de la Cape du Prespic, la Cape du Prespic lui inflige 1 Dommage .",
        "Cape du Prespic",
        undefined,
      ),
    ).toBeNull();
  });
});

// ── Volets 2 & 3 : bus + moteur ──────────────────────────────────────────────

const RIPOSTE_EFFECT = {
  description:
    "Chaque fois qu'un Allié ou Héros inflige des Dommages au Porteur de l'Équip, l'Équip lui inflige 1 Dommage .",
  compiled: {
    trigger: "onDamageToBearer" as const,
    ops: [{ op: "damageRiposteSource" as const, n: 1, element: "Feu" }],
  },
};

const ALLY: Card = {
  id: "cAlly",
  name: "Allié",
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
const EQUIP: Card = {
  id: "cEquip",
  name: "Équip",
  mainType: "Équipement",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  effects: [RIPOSTE_EFFECT],
} as unknown as Card;

/** Attaquant `atk` (à B), Porteur `bearer` (à A) portant `eq` (Équipement riposte). */
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
    monde: ["hero-A", "hero-B", "atk", "bearer", "eq"],
    instances: {
      "hero-A": inst("hero-A", "cHero", "A"),
      "hero-B": inst("hero-B", "cHero", "B"),
      atk: inst("atk", "cAlly", "B"),
      bearer: inst("bearer", "cAlly", "A", { attachments: ["eq"] }),
      eq: inst("eq", "cEquip", "A", {
        location: { zone: "monde" },
        attachedTo: "bearer",
      }),
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

const getCard = (id: string | null): Card | null =>
  id === "cAlly"
    ? ALLY
    : id === "cHero"
      ? HERO
      : id === "cEquip"
        ? EQUIP
        : null;

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

const dmg = (source: string | null, target: string): RuleEvent => ({
  kind: "damageDealt",
  source,
  target,
  amount: 2,
  element: "air",
  combat: true,
});

describe("bus — bearerFrames (riposte de Porteur)", () => {
  it("un Allié frappe le Porteur → 1 frame de riposte visant le frappeur", () => {
    const ctx = mockDeps(makeState()).rulesCtx();
    const frames = collectTriggeredEffects(ctx, [dmg("atk", "bearer")]);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      seat: "A", // contrôleur du Porteur / de l'équipement
      sourceId: "eq",
      cardName: "Équip",
      riposteTargetId: "atk", // la riposte frappe l'attaquant
      ops: [{ op: "damageRiposteSource", n: 1, element: "Feu" }],
    });
  });

  it("GARDE ANTI-BOUCLE : une source NON Allié/Héros (l'équipement) n'émet PAS de riposte", () => {
    const ctx = mockDeps(makeState()).rulesCtx();
    // « eq » (Équipement) frappe le Porteur → pas une riposte de riposte
    expect(collectTriggeredEffects(ctx, [dmg("eq", "bearer")])).toHaveLength(0);
  });

  it("Dommages SANS source (jeton/effet) → aucune riposte", () => {
    const ctx = mockDeps(makeState()).rulesCtx();
    expect(collectTriggeredEffects(ctx, [dmg(null, "bearer")])).toHaveLength(0);
  });

  it("Porteur hors jeu (détruit, en Défausse) → aucune riposte (omission conservatrice)", () => {
    const state = makeState();
    (state.instances.bearer as { location: { zone: string } }).location = {
      zone: "defausse",
    };
    const ctx = mockDeps(state).rulesCtx();
    expect(collectTriggeredEffects(ctx, [dmg("atk", "bearer")])).toHaveLength(
      0,
    );
  });
});

describe("moteur — Glyphe Incandescent n'auto-riposte pas (P2-12)", () => {
  it("un paquet de Glyphe (source == cible) ne déclenche PAS la Cape du Porteur contre lui-même", () => {
    // Le Glyphe (Zone) inflige ses Dommages au Porteur `bearer` : ce n'est pas
    // « un Allié ou Héros » qui frappe → la Cape ne doit pas riposter. Régression :
    // la frame Glyphe attribuait la source à la VICTIME (bearer), et bearerFrames
    // voyait alors un Allié frappant son propre Porteur → riposte sur soi.
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    // Frame Glyphe : sourceId == riposteTargetId == bearer (auto-attribution).
    engine.enqueueTriggered([
      {
        seat: "A",
        sourceId: "bearer",
        cardName: "Glyphe Incandescent",
        text: "Glyphe Incandescent inflige 2 Dommages Feu.",
        ops: [{ op: "damageRiposteSource", n: 2, element: "Feu" }],
        riposteTargetId: "bearer",
      },
    ]);
    // Le Porteur encaisse les 2 du Glyphe UNE fois ; aucune riposte ne le refrappe.
    const bearerHits = dispatch.mock.calls
      .flat()
      .filter(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "bearer" &&
          e.payload?.counter === "damage",
      );
    expect(bearerHits).toHaveLength(1);
    expect(bearerHits[0].payload.delta).toBe(2);
  });
});

describe("moteur — flux complet de riposte", () => {
  it("le frappeur (atk) subit 1 Dommage Feu de riposte", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    const ctx = mockDeps(state).rulesCtx();
    engine.enqueueTriggered(
      collectTriggeredEffects(ctx, [dmg("atk", "bearer")]),
    );
    // resolveDamageTarget → incCounter "damage" +1 sur l'attaquant (atk), Feu, pas de Résistance
    const dmgEvent = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "atk" &&
          e.payload?.counter === "damage",
      );
    expect(dmgEvent, "un event de Dommages sur l'attaquant").toBeTruthy();
    expect(dmgEvent.payload.delta).toBe(1);
  });
});
