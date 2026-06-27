/**
 * Tranche W15 — ACTOR-BINDING (le sujet du CORPS est une créature liée, pas la
 * carte qui porte l'effet).
 *
 * Deux frameworks :
 *  A) APPARITION (onOtherAppears) « Quand un Allié … apparaît, il/elle inflige
 *     sa Force / N Dommages … » : l'instance APPARUE est la source du corps
 *     (sourceId), le « de votre choix » reste au contrôleur du veilleur.
 *  B) COÛT PAYÉ (cost:"paidOps") « Inclinez un de vos X : il/elle inflige sa
 *     Force / gagne +N en Force … » : la créature SÉLECTIONNÉE au coût devient
 *     la source du corps (la frame en attente est réécrite au paiement).
 *
 * Strict (« an approximation of gameplay is worse than a manual effect ») :
 * seules les formes mappées (inflige sa Force / inflige N Dommages / gagne +N en
 * Force) sont admises ; tout autre « il/elle … » reste MANUEL.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Card, CardEffect, CompiledEffect } from "@/types/cards";
import type { GameState } from "@/game";
import { compileAppearanceTriggerText, compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────

describe("DSL — actor-binding d'apparition (compileAppearanceTriggerText)", () => {
  it("« …, il inflige sa Force en Dommages à l'Allié ou Héros de votre choix » → actor:appeared + damageTargetByForce", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié apparaît, il inflige sa Force en Dommages à l'Allié ou Héros de votre choix.",
      "Veilleur",
      "Feu",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié" },
      actor: "appeared",
      ops: [
        {
          op: "damageTargetByForce",
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« …, il inflige N Dommages à l'Allié de votre choix » → actor:appeared + damageTarget", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié Bouftou apparaît, il inflige 2 Dommages à l'Allié de votre choix.",
      "Veilleur",
      "Feu",
    );
    expect(c).toMatchObject({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "bouftou" },
      actor: "appeared",
      ops: [{ op: "damageTarget", n: 2, element: "Feu", heroes: false }],
    });
  });

  it("forme générique inchangée (pas d'actor) : « …, piochez une carte »", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié Wabbit apparaît dans le Monde, piochez une carte.",
      "Château",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "wabbit" },
      ops: [{ op: "draw", n: 1 }],
    });
    expect(c?.actor).toBeUndefined();
  });

  it("REJET : « il … » hors des formes mappées (« il pioche une carte »)", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié apparaît, il pioche une carte.",
        "Veilleur",
      ),
    ).toBeNull();
  });

  it("REJET : « il gagne +N en Force » sur une apparition (pas de cible/forme buff appearance)", () => {
    // buffForceSelf n'a de sens que sur un acteur en jeu lié par un coût ;
    // sur une apparition « il gagne +1 en Force » (sans « jusqu'à la fin du
    // tour ») n'est pas une forme mappée → MANUEL.
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié apparaît, il gagne +1 en Force.",
        "Veilleur",
      ),
    ).toBeNull();
  });
});

describe("DSL — actor-binding par coût (compileTapEffectText)", () => {
  it("« Inclinez un de vos Alliés ou Héros : Il inflige sa Force … » → actor:costTarget", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés ou Héros : Il inflige sa Force en Dommages à l'Allié de votre choix.",
      "Agression",
      "Feu",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      actor: "costTarget",
      ops: [
        { op: "costTapControlled", heroes: true, zones: ["monde", "havreSac"] },
        {
          op: "damageTargetByForce",
          element: "Feu",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« Inclinez un de vos Alliés : Il gagne +N en Force … » → actor:costTarget + buffForceSelf", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés : Il gagne +1 en Force jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toMatchObject({
      trigger: "onTap",
      cost: "paidOps",
      actor: "costTarget",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "buffForceSelf", n: 1 },
      ],
    });
  });

  it("REJET : actor-binding sur un coût de DESTRUCTION (créature détruite ne peut agir)", () => {
    expect(
      compileTapEffectText(
        "Détruisez un de vos Alliés : Il inflige sa Force en Dommages à l'Allié de votre choix.",
        "Carte X",
      ),
    ).toBeNull();
  });

  it("REJET : « sa Force » sans sujet explicite (acteur implicite non modélisé)", () => {
    expect(
      compileTapEffectText(
        "Inclinez un de vos Monstres : Gagnez un bonus égal à sa Force.",
        "Carte X",
      ),
    ).toBeNull();
  });

  it("forme non-actor inchangée : « Inclinez un de vos Alliés : Piochez une carte »", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés : Piochez une carte.",
      "Carte X",
    );
    expect(c?.actor).toBeUndefined();
    expect(c?.ops[1]).toEqual({ op: "draw", n: 1 });
  });
});

// ── Volet 2 : moteur (engine isolé) ──────────────────────────────────────────

/** Allié avec Force/Élément paramétrables (pour vérifier la Force lue). */
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

/** Cherche l'event INC_COUNTER damage posé sur une cible dans les dispatch. */
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

describe("moteur — actor-binding d'apparition (sourceId = instance apparue)", () => {
  // Veilleur (Zone de A) : « Quand un Allié apparaît, il inflige sa Force … ».
  const WATCHER: Card = {
    id: "card-watch",
    name: "Veilleur",
    mainType: "Zone",
    effects: [
      {
        description:
          "Quand un Allié apparaît, il inflige sa Force en Dommages à l'Allié ou Héros de votre choix.",
        compiled: {
          trigger: "onOtherAppears",
          watch: { mainType: "Allié" },
          actor: "appeared",
          ops: [
            {
              op: "damageTargetByForce",
              element: "Feu",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
          ],
        },
      },
    ],
  } as unknown as Card;

  function makeState(): GameState {
    return {
      turn: { active: "A", number: 1 },
      monde: ["w1", "tgt"],
      combat: null,
      instances: {
        w1: inst("w1", "card-watch", "A"),
        tgt: inst("tgt", "card-ally-Tgt", "B"), // cible (Allié de B)
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

  it("l'Allié apparu (Force 5) est la SOURCE : damageTargetByForce = sa Force", () => {
    const APPEARED = ally("Apparu", 5);
    const TGT = ally("Tgt", 9); // cible robuste (ne meurt pas de 5)
    const cards = {
      "card-watch": WATCHER,
      "card-Apparu": APPEARED,
      "card-ally-Apparu": APPEARED,
      "card-ally-Tgt": TGT,
      "card-hero": HERO,
    };
    const state = makeState();
    // pose l'apparu en jeu (contrôlé par A) en a-app
    (state.instances as Record<string, unknown>)["a-app"] = inst(
      "a-app",
      "card-ally-Apparu",
      "A",
    );
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    // l'Allié apparu (a-app, Force 5) déclenche la veille de w1
    engine.queueArrivalEffects("A", APPEARED, "a-app");
    // pause sur le ciblage du corps (sourceId doit être a-app)
    expect(engine.effectTargeting.value?.op.op).toBe("damageTargetByForce");
    expect(engine.effectTargeting.value?.sourceId).toBe("a-app");
    expect(engine.effectTargeting.value?.seat).toBe("A"); // « de votre choix » au veilleur
    // le joueur cible l'Allié adverse tgt → 5 Dommages (Force de l'apparu)
    engine.effectTargetChoose("tgt");
    const dmg = damageOn(dispatch, "tgt");
    expect(dmg, "Dommages sur la cible").toBeTruthy();
    expect(dmg.payload.delta).toBe(5);
  });

  it("non-actor-bound : la SOURCE reste le veilleur (sourceId = watcherId)", () => {
    // veille générique (pas d'actor) « …, le Héros adverse perd 2 PV »
    const genericWatcher: Card = {
      id: "card-genwatch",
      name: "Veilleur Générique",
      mainType: "Zone",
      effects: [
        {
          description:
            "Quand un Allié adverse apparaît, le Héros adverse perd 2 PV.",
          compiled: {
            trigger: "onOtherAppears",
            watch: { mainType: "Allié", controller: "opponent" },
            ops: [{ op: "damageOppHero", n: 2 }],
          },
        },
      ],
    } as unknown as Card;
    const state = makeState();
    (state.instances as Record<string, unknown>).w1 = inst(
      "w1",
      "card-genwatch",
      "A",
    );
    const adjustCounter = vi.fn();
    const APPEARED = ally("Apparu", 5);
    const engine = createEffectEngine(
      mockDeps(
        state,
        {
          "card-genwatch": genericWatcher,
          "card-ally-Apparu": APPEARED,
          "card-hero": HERO,
        },
        { adjustCounter },
      ),
    );
    // Allié de B apparaît → veille de A (adverse) déclenche, pas d'actor-binding
    engine.queueArrivalEffects("B", APPEARED, "b-app");
    // résolution directe (pas de cible) : Héros adverse (B) perd 2 PV — la source
    // est le veilleur, le corps tourne tel quel (aucune réécriture de sourceId)
    expect(adjustCounter).toHaveBeenCalledWith("hero-B", "hp", -2);
    expect(engine.effectTargeting.value).toBeNull();
  });
});

describe("moteur — actor-binding par coût (sourceId = créature choisie au coût)", () => {
  function makeState(): GameState {
    return {
      turn: { active: "A", number: 1 },
      monde: ["a1", "a2", "tgt"],
      combat: null,
      instances: {
        a1: inst("a1", "card-ally-A1", "A"), // Force 3
        a2: inst("a2", "card-ally-A2", "A"), // Force 7
        tgt: inst("tgt", "card-ally-Tgt", "B"), // cible robuste Force 20
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
  const cards = {
    "card-ally-A1": ally("A1", 3),
    "card-ally-A2": ally("A2", 7),
    "card-ally-Tgt": ally("Tgt", 20),
    "card-hero": HERO,
  };

  it("damageTargetByForce : la Force est celle de la créature CHOISIE au coût, pas de la source", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    // source du pouvoir = a1 (Force 3) ; le coût choisit a2 (Force 7) → 7 Dommages
    engine.enqueueEffect({
      seat: "A",
      cardName: "Agression",
      sourceId: "a1",
      actorBind: "costTarget",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        {
          op: "damageTargetByForce",
          element: "Feu",
          zones: ["monde", "havreSac"],
        },
      ],
    });
    // pause sur le coût
    expect(engine.effectTargeting.value?.op.op).toBe("costTapControlled");
    // payer le coût en inclinant a2
    engine.effectTargetChoose("a2");
    // maintenant le corps (damageTargetByForce) est en pause, sourceId = a2
    expect(engine.effectTargeting.value?.op.op).toBe("damageTargetByForce");
    expect(engine.effectTargeting.value?.sourceId).toBe("a2");
    // cibler tgt → 7 Dommages (Force de a2, la créature choisie)
    engine.effectTargetChoose("tgt");
    const dmg = damageOn(dispatch, "tgt");
    expect(dmg, "Dommages sur la cible").toBeTruthy();
    expect(dmg.payload.delta).toBe(7);
  });

  it("buffForceSelf : le bonus est posé sur la créature CHOISIE au coût (a2), pas la source (a1)", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "a1",
      actorBind: "costTarget",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "buffForceSelf", n: 2 },
      ],
    });
    engine.effectTargetChoose("a2"); // paie le coût avec a2
    // buffForceSelf a posé un forceMod +2 sur a2 (la créature liée)
    const buff = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "a2" &&
          e.payload?.counter === "forceMod",
      );
    expect(buff, "forceMod sur a2").toBeTruthy();
    expect(buff.payload.delta).toBe(2);
    // et SURTOUT pas sur la source a1
    const onSource = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "a1" &&
          e.payload?.counter === "forceMod",
      );
    expect(onSource).toBeFalsy();
  });

  it("NÉGATIF : sans actorBind, le corps garde la source d'origine (buffForceSelf sur a1)", () => {
    const state = makeState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    // même séquence mais SANS actorBind : le sourceId reste a1 après le coût
    engine.enqueueEffect({
      seat: "A",
      cardName: "Carte X",
      sourceId: "a1",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "buffForceSelf", n: 2 },
      ],
    });
    engine.effectTargetChoose("a2"); // incline a2 mais ne devient PAS la source
    const buffA1 = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "INC_COUNTER" &&
          e.payload?.instanceId === "a1" &&
          e.payload?.counter === "forceMod",
      );
    expect(buffA1, "forceMod sur la source a1").toBeTruthy();
    expect(buffA1.payload.delta).toBe(2);
  });
});

// ── Volet 3 : moisson (données régénérées par compile-effects) ────────────────

describe("moisson W15 (données régénérées) — actor-binding par coût", () => {
  const DATA_DIR = join(process.cwd(), "public", "data");
  function loadCardsById(): Map<
    string,
    { id: string; effects?: CardEffect[] }
  > {
    const byId = new Map<string, { id: string; effects?: CardEffect[] }>();
    for (const file of readdirSync(DATA_DIR)) {
      if (!file.endsWith(".json")) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      for (const card of parsed as { id?: string }[])
        if (card && typeof card.id === "string")
          byId.set(card.id, card as { id: string; effects?: CardEffect[] });
    }
    return byId;
  }
  const cardsById = loadCardsById();

  // « Inclinez (l')un de vos Alliés ou Héros : il inflige sa Force … » — auto-
  // compilé en cost:"paidOps" + actor:"costTarget" (deux variantes « un » / « l'un »).
  for (const id of [
    "agression-chaos-dogrest",
    "agression-dofus-collection",
    "agression-incarnam",
  ]) {
    it(`${id} : compilé auto en actor:costTarget (cost + damageTargetByForce)`, () => {
      const card = cardsById.get(id);
      expect(card, `carte ${id} introuvable`).toBeDefined();
      const eff = card!.effects?.[0];
      expect(eff?.coverage).toBe("auto");
      expect(eff?.compiled).toMatchObject({
        trigger: "onTap",
        cost: "paidOps",
        actor: "costTarget",
        ops: [
          { op: "costTapControlled", heroes: true },
          { op: "damageTargetByForce", heroes: true },
        ],
      });
    });
  }
});
