/**
 * « gagne <Mot-clé> jusqu'à la fin du tour » — octroi TURN-scoped d'un mot-clé
 * de COMBAT câblé (Géant / Agilité / Agressivité), généralisé depuis l'octroi de
 * Géant.
 *
 * Deux ops :
 *  - grantKeywordSelf{keyword}   : « [self] gagne <kw> jusqu'à la fin du tour. »
 *    (Ouassingue : Géant) → jeton `<kw>TurnMod` sur la SOURCE (en jeu), purgé en
 *    fin de tour.
 *  - grantKeywordTarget{keyword} : « L'Allié [ou Héros] [Famille] [bloqué / de
 *    votre choix] gagne <kw> jusqu'à la fin du tour. » → op de ciblage posant
 *    `<kw>TurnMod` sur la cible choisie.
 *
 * Jetons : geantTurnMod / agiliteTurnMod / agressiviteTurnMod, lus par
 * effectiveKeywords (geant/agilite/agressivite) qui alimentent la LÉGALITÉ de
 * combat (Agilité → bloqué uniquement par Agilité ; Agressivité → attaque le tour
 * de son apparition ; Géant → répartition de Force). Distinct de combatModSelf
 * (jeton `geantCombatMod`, portée COMBAT). STRICT : seules les formes « jusqu'à la
 * fin du tour » et les mots-clés FONCTIONNELS sont compilés ; les variantes BEARER
 * (« Le Porteur de X gagne … »), COMBAT, composites (« perd Agilité et gagne
 * Géant ») et les mots-clés inertes (Tacle…) restent manuels (« an approximation
 * of gameplay is worse than a manual effect »).
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { isTurnToken } from "../limits";
import { effectiveKeywords } from "../keywords";
import { effectTargetIds } from "../targeting";
import { nextTurnEvents } from "../../../engine/turn";
import { eligibleAttackers, eligibleBlockers } from "../../legality";
import { HERO_B } from "../../__tests__/harness";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────

describe("DSL — « gagne <Mot-clé> jusqu'à la fin du tour » (Géant — régression)", () => {
  it("« La Ouassingue gagne Géant jusqu'à la fin du tour » → grantKeywordSelf{Géant}", () => {
    const c = compileTapEffectText(
      "La Ouassingue gagne Géant jusqu'à la fin du tour.",
      "Ouassingue",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "grantKeywordSelf", keyword: "Géant" }],
    });
  });

  it("« L'Allié de votre choix gagne Géant jusqu'à la fin du tour » → grantKeywordTarget{Géant} (Pandaluk)", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Géant jusqu'à la fin du tour.",
      "Pandaluk Skaïwoker",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Géant",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« Le Rat bloqué de votre choix gagne Géant … » → grantKeywordTarget{Géant,sub:rat,combatRole:blocking} (Rat Klure)", () => {
    const c = compileTapEffectText(
      "Le Rat bloqué de votre choix gagne Géant jusqu'à la fin du tour.",
      "Rat Klure",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Géant",
          sub: "rat",
          combatRole: "blocking",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("variante SACRIFICE « Détruisez le Petit Anneau de Force : … » → cost:sacrificeSelf + grantKeywordTarget{Géant,heroes}", () => {
    const c = compileTapEffectText(
      "Détruisez le Petit Anneau de Force : L'Allié ou Héros de votre choix gagne Géant jusqu'à la fin du tour.",
      "Petit Anneau de Force",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Géant",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });
});

describe("DSL — Agilité / Agressivité (nouveaux mots-clés octroyables)", () => {
  it("« L'Allié de votre choix gagne Agilité jusqu'à la fin du tour » → grantKeywordTarget{Agilité}", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Agilité jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Agilité",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« L'Allié Gelée de votre choix gagne Agilité … » → grantKeywordTarget{Agilité,sub:gelee} (forme Famille)", () => {
    const c = compileTapEffectText(
      "L'Allié Gelée de votre choix gagne Agilité jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Agilité",
          heroes: false,
          sub: "gelee",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« Le Monstre de votre choix gagne Agressivité … » → grantKeywordTarget{Agressivité,sub:monstre}", () => {
    const c = compileTapEffectText(
      "Le Monstre de votre choix gagne Agressivité jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Agressivité",
          sub: "monstre",
          combatRole: undefined,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("SACRIFICE « Détruisez le Petit Anneau d'Intelligence : … gagne Agressivité » → cost + grantKeywordTarget{Agressivité,heroes}", () => {
    const c = compileTapEffectText(
      "Détruisez le Petit Anneau d'Intelligence : L'Allié ou Héros de votre choix gagne Agressivité jusqu'à la fin du tour.",
      "Petit Anneau d'Intelligence",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Agressivité",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });
});

describe("DSL — Tacle octroyable (verrou d'inclinaison câblé dans resolveCombat)", () => {
  // Tacle a désormais une SÉMANTIQUE DE COMBAT câblée (resolveCombat empêche
  // l'inclinaison des bloqueurs en relation de blocage avec un possesseur de
  // Tacle) → l'octroi « jusqu'à la fin du tour » est compilé comme Géant/Agilité.
  it("« L'Allié ou Héros de votre choix gagne Tacle … » → grantKeywordTarget{Tacle} (Petit Anneau de Chance)", () => {
    expect(
      compileTapEffectText(
        "L'Allié ou Héros de votre choix gagne Tacle jusqu'à la fin du tour.",
        "Petit Anneau de Chance",
      ),
    ).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Tacle",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« [self] gagne Tacle … » → grantKeywordSelf{Tacle}", () => {
    expect(
      compileTapEffectText(
        "Cette carte gagne Tacle jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toEqual({
      trigger: "onTap",
      ops: [{ op: "grantKeywordSelf", keyword: "Tacle" }],
    });
  });
});

describe("DSL — négatifs (fidélité)", () => {
  // NÉGATIF : « Le Porteur de X gagne <kw> … » (Anneau du Rat Noir) — bonus de
  // PORTEUR temporaire (mécanisme différent). Non compilé par compileTapEffectText.
  it("ne devrait PAS compiler « Le Porteur de l'Anneau du Rat Noir gagne Géant … » (bonus de Porteur)", () => {
    expect(
      compileTapEffectText(
        "Le Porteur de l'Anneau du Rat Noir gagne Géant jusqu'à la fin du tour.",
        "Anneau du Rat Noir",
      ),
    ).toBeNull();
  });

  // NÉGATIF : composite « perd Agilité et gagne Géant » (Pandhravan) — retrait de
  // mot-clé non modélisé. Reste manuel.
  it("ne devrait PAS compiler « … perd Agilité et gagne Géant … » (composite)", () => {
    expect(
      compileTapEffectText(
        "Pandhravan perd Agilité et gagne Géant jusqu'à la fin du tour.",
        "Pandhravan",
      ),
    ).toBeNull();
  });

  // NÉGATIF : famille ambiguë (Iop = classe de Héros) — on ne devine pas le type.
  it("ne devrait PAS compiler « Le Iop de votre choix gagne Géant … » (famille ambiguë)", () => {
    expect(
      compileTapEffectText(
        "Le Iop de votre choix gagne Géant jusqu'à la fin du tour.",
        "Carte X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur (engine isolé) — grantKeywordSelf ───────────────────────

function aSrc(id: string): Card {
  return {
    id: `card-${id}`,
    name: "Ouassingue",
    mainType: "Allié",
    subTypes: [],
    stats: { niveau: { value: 1, element: "Feu" } },
    experience: 1,
  } as unknown as Card;
}

function inst(id: string, cardId: string) {
  return {
    instanceId: id,
    cardId,
    owner: "A" as const,
    controller: "A" as const,
    orientation: "upright" as const,
    location: { zone: "monde" as const },
    counters: {},
  };
}

function makeState(instances: Record<string, unknown>): GameState {
  return {
    turn: { active: "A", number: 1 },
    instances,
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
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

/** Cherche le SET_COUNTER d'un token sur une cible parmi les dispatch. */
function tokenOn(
  dispatch: ReturnType<typeof vi.fn>,
  targetId: string,
  counter: string,
) {
  return dispatch.mock.calls
    .flat()
    .find(
      (e) =>
        e &&
        typeof e === "object" &&
        e.type === "SET_COUNTER" &&
        e.payload?.instanceId === targetId &&
        e.payload?.counter === counter,
    );
}

describe("moteur — grantKeywordSelf (jeton <kw>TurnMod sur la source)", () => {
  it("Géant : pose un jeton geantTurnMod sur la source en jeu", () => {
    const cards = { "card-s": aSrc("s") };
    const state = makeState({ s: inst("s", "card-s") });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Ouassingue",
      sourceId: "s",
      ops: [{ op: "grantKeywordSelf", keyword: "Géant" }],
    });
    const tok = tokenOn(dispatch, "s", "geantTurnMod");
    expect(tok, "geantTurnMod sur la source").toBeTruthy();
    expect(tok.payload.value).toBe(1);
    expect(tok.payload.token).toBe(true);
  });

  it("Agilité : agiliteTurnMod ; Agressivité : agressiviteTurnMod ; Tacle : tacleTurnMod", () => {
    for (const [keyword, token] of [
      ["Agilité", "agiliteTurnMod"],
      ["Agressivité", "agressiviteTurnMod"],
      ["Tacle", "tacleTurnMod"],
    ] as const) {
      const cards = { "card-s": aSrc("s") };
      const state = makeState({ s: inst("s", "card-s") });
      const dispatch = vi.fn();
      const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
      engine.enqueueEffect({
        seat: "A",
        cardName: "Carte X",
        sourceId: "s",
        ops: [{ op: "grantKeywordSelf", keyword }],
      });
      expect(tokenOn(dispatch, "s", token), `${keyword}→${token}`).toBeTruthy();
    }
  });

  it("NÉGATIF : source hors jeu (Défausse) → aucun jeton (no-op fidèle)", () => {
    const cards = { "card-s": aSrc("s") };
    const off = inst("s", "card-s");
    off.location = { zone: "defausse" as never } as never;
    const state = makeState({ s: off });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Ouassingue",
      sourceId: "s",
      ops: [{ op: "grantKeywordSelf", keyword: "Géant" }],
    });
    expect(tokenOn(dispatch, "s", "geantTurnMod")).toBeFalsy();
  });
});

// ── Volet 3 : effectiveKeywords + purge de fin de tour (harness réel) ─────────

describe("rules/effects — <kw>TurnMod alimente effectiveKeywords et se purge", () => {
  const cases = [
    ["geantTurnMod", "geant"],
    ["agiliteTurnMod", "agilite"],
    ["agressiviteTurnMod", "agressivite"],
    ["tacleTurnMod", "tacle"],
  ] as const;

  for (const [token, kw] of cases) {
    it(`${token} → effectiveKeywords.${kw} devient true puis se purge en fin de tour`, () => {
      const f = fixture([makeAlly("c", { force: 2 })]);
      setTurn(f, "A", 3);
      bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
      const id = instId("A", 0);
      expect(effectiveKeywords(ctxOf(f), id)[kw]).toBe(false);
      dispatch(f, {
        actor: "A",
        type: "SET_COUNTER",
        payload: { instanceId: id, counter: token, value: 1, token: true },
      } as never);
      expect(effectiveKeywords(ctxOf(f), id)[kw]).toBe(true);
      // passage au tour suivant : nextTurnEvents purge les jetons « du tour »
      dispatch(f, ...nextTurnEvents(ctxOf(f).state));
      expect(effectiveKeywords(ctxOf(f), id)[kw]).toBe(false);
    });
  }

  it("isTurnToken reconnaît les quatre jetons d'octroi (purgés)", () => {
    expect(isTurnToken("geantTurnMod")).toBe(true);
    expect(isTurnToken("agiliteTurnMod")).toBe(true);
    expect(isTurnToken("agressiviteTurnMod")).toBe(true);
    expect(isTurnToken("tacleTurnMod")).toBe(true);
    // geantCombatMod reste purgé par le suffixe *CombatMod (portée combat)
    expect(isTurnToken("geantCombatMod")).toBe(true);
    // un jeton durable n'est pas purgé
    expect(isTurnToken("arrivedTurn")).toBe(false);
  });
});

// ── Volet 4 : ciblage — grantKeywordTarget (éligibilité + résolution) ────────

describe("moteur — grantKeywordTarget (ciblage + jeton sur la cible choisie)", () => {
  it("Pandaluk (Géant, tout Allié) : pose geantTurnMod sur l'Allié choisi", () => {
    const f = fixture(
      [makeAlly("src", { force: 1 }), makeAlly("cible", { force: 2 })],
      [makeAlly("ennemi", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0), { arrivedTurn: 1 });

    const engine = createEffectEngine(
      mockDepsFromFixture(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Pandaluk Skaïwoker",
      sourceId: instId("A", 0),
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Géant",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("grantKeywordTarget");
    engine.effectTargetChoose(instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).geant).toBe(true);
  });

  it("filtre sub+combatRole (Rat Klure) : seul un Rat BLOQUEUR est éligible", () => {
    const ratBloqueur = makeAlly("ratBlk", { force: 2 });
    (ratBloqueur as { subTypes: string[] }).subTypes = ["Monstre", "Rat"];
    const ratLibre = makeAlly("ratFree", { force: 2 });
    (ratLibre as { subTypes: string[] }).subTypes = ["Monstre", "Rat"];
    const autreBloqueur = makeAlly("autre", { force: 2 });
    const f = fixture(
      [makeAlly("src", { force: 3 })],
      [ratBloqueur, ratLibre, autreBloqueur],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 2), { arrivedTurn: 1 });

    const base = ctxOf(f);
    const ctx = {
      ...base,
      state: {
        ...base.state,
        combat: {
          attackerSeat: "A",
          attackers: [instId("A", 0)],
          blocks: {
            [instId("B", 0)]: instId("A", 0), // ratBloqueur bloque
            [instId("B", 2)]: instId("A", 0), // autreBloqueur (non-Rat) bloque
          },
        },
      },
    } as typeof base;

    const ids = effectTargetIds(
      ctx,
      {
        op: "grantKeywordTarget",
        keyword: "Géant",
        sub: "rat",
        combatRole: "blocking",
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(ids).toEqual([instId("B", 0)]); // uniquement le Rat bloqueur
  });
});

// ── Volet 5 : sémantique de combat des mots-clés CONFÉRÉS (légalité) ──────────

describe("rules/effects — Agilité conférée rend la cible imbloquable (eligibleBlockers)", () => {
  it("un attaquant ayant reçu Agilité (jeton) n'est bloquable que par Agilité", () => {
    // A attaque avec `atk` (sans Agilité imprimée) ; B a deux bloqueurs normaux.
    const f = fixture(
      [makeAlly("atk", { force: 2 })],
      [makeAlly("b0", { force: 2 }), makeAlly("b1", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    // avant l'octroi : les deux bloqueurs normaux sont éligibles
    let blockers = eligibleBlockers(
      ctxOf(f),
      "B",
      { kind: "hero", instanceId: HERO_B },
      instId("A", 0),
    );
    expect(blockers).toContain(instId("B", 0));
    // on CONFÈRE Agilité à l'attaquant (jeton agiliteTurnMod, comme grantKeyword)
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: instId("A", 0),
        counter: "agiliteTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    // après : aucun bloqueur normal n'est éligible (attaquant Agilité)
    blockers = eligibleBlockers(
      ctxOf(f),
      "B",
      { kind: "hero", instanceId: HERO_B },
      instId("A", 0),
    );
    expect(blockers).not.toContain(instId("B", 0));
    expect(blockers).not.toContain(instId("B", 1));
  });
});

describe("rules/effects — Agressivité conférée lève le mal d'invocation (eligibleAttackers)", () => {
  it("un Allié arrivé CE tour devient attaquant éligible après octroi d'Agressivité", () => {
    const f = fixture([makeAlly("frais", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 3 }); // arrivé ce tour
    const id = instId("A", 0);
    // avant : mal d'invocation → exclu
    expect(eligibleAttackers(ctxOf(f), "A")).not.toContain(id);
    // on CONFÈRE Agressivité (jeton agressiviteTurnMod)
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: id,
        counter: "agressiviteTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    // après : le mal d'invocation est levé
    expect(eligibleAttackers(ctxOf(f), "A")).toContain(id);
  });
});

function mockDepsFromFixture(
  f: ReturnType<typeof fixture>,
  onDispatch: (drafts: unknown[]) => void,
): EffectEngineDeps {
  return {
    getState: () => ctxOf(f).state,
    rulesCtx: () => ctxOf(f) as never,
    getCard: (id: string | null) => ctxOf(f).getCard(id),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn((...drafts: unknown[]) => onDispatch(drafts)),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  } as unknown as EffectEngineDeps;
}
