/**
 * Tranche W16 — DÉCLENCHÉ DE COMBAT « Quand [self] attaque, CORPS » généralisé.
 *
 * `compileCombatTriggerText` ne reconnaissait que la forme FIXE « +N en Force,
 * +N PM [et Géant] jusqu'à la fin du COMBAT » (Bruss Ouilis → `combatModSelf`).
 * Elle accepte désormais aussi un CORPS ACTOR-BOUND « il/elle BODY » où BODY se
 * compile via `compileActorBoundBody` (SELF = acteur fourni par le bus :
 * `attackerFrames` enfile la frame avec `sourceId = attaquant`).
 *
 * DURÉE — distinction critique :
 *  - « +N en Force jusqu'à la fin du COMBAT » reste `combatModSelf` (durée combat) ;
 *  - « …jusqu'à la fin du TOUR » → `buffForceSelf` (durée tour).
 * Un bonus de Force de durée ambiguë/absente n'est PAS compilé (manuel). Les
 * corps conditionnels / dynamiques restent manuels.
 */
import { describe, it, expect, vi } from "vitest";
import type { Card, CompiledEffect } from "@/types/cards";
import type { GameState } from "@/game";
import { compileCombatTriggerText, selfAttackEffects } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────

describe("DSL — combat trigger généralisé (compileCombatTriggerText)", () => {
  it("« …, elle inflige N Dommages à l'Allié de votre choix » → onSelfAttacks + damageTarget (Klara Vane)", () => {
    const c = compileCombatTriggerText(
      "Quand Klara Vane attaque, elle inflige 1 Dommage à l'Allié de votre choix.",
      "Klara Vane",
      "Feu",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onSelfAttacks",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« …, il inflige sa Force en Dommages à l'Allié ou Héros de votre choix » → damageTargetByForce", () => {
    const c = compileCombatTriggerText(
      "Quand Bourreau attaque, il inflige sa Force en Dommages à l'Allié ou Héros de votre choix.",
      "Bourreau",
      "Terre",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onSelfAttacks",
      ops: [
        {
          op: "damageTargetByForce",
          element: "Terre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("DURÉE COMBAT : « +N en Force, +N PM [et Géant] jusqu'à la fin du combat » reste combatModSelf (Bruss Ouilis)", () => {
    const c = compileCombatTriggerText(
      "Quand Bruss Ouilis attaque, il gagne +1 en Force et +1 PM jusqu'à la fin du combat.",
      "Bruss Ouilis",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onSelfAttacks",
      ops: [{ op: "combatModSelf", force: 1, pm: 1 }],
    });
  });

  it("DURÉE COMBAT + Géant : combatModSelf geant:true", () => {
    const c = compileCombatTriggerText(
      "Quand X attaque, il gagne +2 en Force et +1 PM et Géant jusqu'à la fin du combat.",
      "X",
    );
    expect(c).toMatchObject({
      trigger: "onSelfAttacks",
      ops: [{ op: "combatModSelf", force: 2, pm: 1, geant: true }],
    });
  });

  it("DURÉE TOUR : « il gagne +N en Force jusqu'à la fin du tour » → buffForceSelf (Barak Oktel)", () => {
    const c = compileCombatTriggerText(
      "Quand Barak Oktel attaque, il gagne +2 en Force jusqu'à la fin du tour.",
      "Barak Oktel",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onSelfAttacks",
      ops: [{ op: "buffForceSelf", n: 2 }],
    });
  });

  it("NÉGATIF : bonus de Force SANS durée → non compilé (manuel)", () => {
    expect(
      compileCombatTriggerText("Quand X attaque, il gagne +2 en Force.", "X"),
    ).toBeNull();
  });

  it("NÉGATIF : ne mé-encode PAS une durée combat (sans PM) en buffForceSelf", () => {
    // « +N en Force jusqu'à la fin du combat » seul (pas de PM) : ni la forme
    // fixe combatModSelf (qui exige le PM) ni compileActorBoundBody (qui exige
    // « tour ») ne le captent → manuel, JAMAIS routé vers buffForceSelf (durée
    // tour) qui serait infidèle à la durée combat.
    const c = compileCombatTriggerText(
      "Quand X attaque, il gagne +2 en Force jusqu'à la fin du combat.",
      "X",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : corps conditionnel (« si … ») non compilé", () => {
    expect(
      compileCombatTriggerText(
        "Quand Grozilla attaque, vous pouvez payer X. Si vous le faites, Grozilla inflige X Dommages à l'Allié de votre choix.",
        "Grozilla",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : valeur dynamique (« égal au nombre de … ») non compilée (Fallanster)", () => {
    expect(
      compileCombatTriggerText(
        "Quand Fallanster attaque, il inflige un nombre de Dommages égal au nombre d'autres Chevaliers attaquants à l'Allié ou Héros de votre choix.",
        "Fallanster",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : sujet du déclencheur ≠ self (« votre Héros ») non compilé", () => {
    expect(
      compileCombatTriggerText(
        "Quand votre Héros attaque, il gagne +2 en Force jusqu'à la fin du tour.",
        "Arène des Démons des Heures",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur (engine isolé) — self = source du corps ──────────────────

function ally(name: string, force: number, element = "Feu"): Card {
  return {
    id: `card-${name}`,
    name,
    mainType: "Allié",
    subTypes: [],
    stats: {
      niveau: { value: 1, element },
      force: { value: force, element },
    },
    experience: 1,
  } as unknown as Card;
}

const HERO: Card = {
  id: "card-hero",
  name: "Héros",
  mainType: "Héros",
} as unknown as Card;

function inst(
  id: string,
  cardId: string,
  controller: "A" | "B",
  orientation: "upright" | "tapped" = "upright",
) {
  return {
    instanceId: id,
    cardId,
    owner: controller,
    controller,
    orientation,
    location: { zone: "monde" as const },
    counters: {},
  };
}

function mockDeps(
  state: GameState,
  cards: Record<string, Card>,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  const getCard = (id: string | null) => (id ? (cards[id] ?? null) : null);
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard }) as never,
    getCard,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
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

function damageOn(dispatch: ReturnType<typeof vi.fn>, targetId: string) {
  return dispatch.mock.calls
    .flat()
    .find(
      (e) =>
        e &&
        typeof e === "object" &&
        e.type === "INC_COUNTER" &&
        e.payload?.instanceId === targetId &&
        e.payload?.counter === "damage",
    );
}

describe("moteur — combat trigger : self (l'attaquant) est la source du corps", () => {
  function makeState(): GameState {
    return {
      turn: { active: "A", number: 1 },
      monde: ["att", "tgt"],
      combat: null,
      instances: {
        att: inst("att", "card-ally-Att", "A"),
        tgt: inst("tgt", "card-ally-Tgt", "B"),
        "hero-A": inst("hero-A", "card-hero", "A"),
        "hero-B": inst("hero-B", "card-hero", "B"),
      },
      seats: {
        A: {
          main: [],
          pioche: [],
          defausse: [],
          havreSac: [],
          heroInstanceId: "hero-A",
        },
        B: {
          main: [],
          pioche: [],
          defausse: [],
          havreSac: [],
          heroInstanceId: "hero-B",
        },
      },
    } as unknown as GameState;
  }

  it("damageTarget : à la déclaration, la frame se résout avec self comme source", () => {
    const ATT = ally("Att", 4);
    const TGT = ally("Tgt", 9); // robuste
    const cards = {
      "card-ally-Att": ATT,
      "card-ally-Tgt": TGT,
      "card-hero": HERO,
    };
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    // frame telle que le bus l'enfile : sourceId = attaquant, seat = contrôleur
    engine.enqueueEffect({
      seat: "A",
      cardName: "Klara Vane",
      sourceId: "att",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("damageTarget");
    expect(engine.effectTargeting.value?.sourceId).toBe("att");
    engine.effectTargetChoose("tgt");
    const dmg = damageOn(dispatch, "tgt");
    expect(dmg, "Dommages sur la cible").toBeTruthy();
    expect(dmg.payload.delta).toBe(1);
  });

  it("damageTargetByForce : les Dommages = la Force de SELF (l'attaquant)", () => {
    const ATT = ally("Att", 6);
    const TGT = ally("Tgt", 20);
    const cards = {
      "card-ally-Att": ATT,
      "card-ally-Tgt": TGT,
      "card-hero": HERO,
    };
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Bourreau",
      sourceId: "att",
      ops: [
        {
          op: "damageTargetByForce",
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("damageTargetByForce");
    expect(engine.effectTargeting.value?.sourceId).toBe("att");
    engine.effectTargetChoose("tgt");
    const dmg = damageOn(dispatch, "tgt");
    expect(dmg, "Dommages sur la cible").toBeTruthy();
    expect(dmg.payload.delta).toBe(6); // Force de l'attaquant
  });

  it("buffForceSelf : le bonus de Force (durée tour) est posé sur SELF", () => {
    const ATT = ally("Att", 3);
    const cards = { "card-ally-Att": ATT, "card-hero": HERO };
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Barak Oktel",
      sourceId: "att",
      ops: [{ op: "buffForceSelf", n: 2 }],
    });
    const buff = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "att" &&
          e.payload?.counter === "forceMod",
      );
    expect(buff, "forceMod sur l'attaquant").toBeTruthy();
    expect(buff.payload.delta).toBe(2);
  });
});

// ── Volet 3 : repli runtime (selfAttackEffects re-parse) ──────────────────────

describe("selfAttackEffects — repli re-parse du texte (données non migrées)", () => {
  it("compile à la volée un corps généralisé non migré (Klara Vane)", () => {
    const card = ally("Klara Vane", 2);
    (card as { effects?: unknown[] }).effects = [
      {
        description:
          "Quand Klara Vane attaque, elle inflige 1 Dommage à l'Allié de votre choix.",
      },
    ];
    const atoms = selfAttackEffects(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops).toEqual([
      {
        op: "damageTarget",
        n: 1,
        element: "Feu", // effectSourceElement(card)
        heroes: false,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("la forme fixe combatModSelf reste compilée au repli (Bruss Ouilis)", () => {
    const card = ally("Bruss Ouilis", 2);
    (card as { effects?: unknown[] }).effects = [
      {
        description:
          "Quand Bruss Ouilis attaque, il gagne +1 en Force et +1 PM jusqu'à la fin du combat.",
      },
    ];
    const atoms = selfAttackEffects(card);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].ops).toEqual([{ op: "combatModSelf", force: 1, pm: 1 }]);
  });
});
