/**
 * « gagne Géant jusqu'à la fin du tour » — octroi TURN-scoped du mot-clé Géant.
 *
 * Deux ops :
 *  - grantGeantSelf  : « [self] gagne Géant jusqu'à la fin du tour. » (Ouassingue)
 *    → jeton `geantTurnMod` sur la SOURCE (en jeu), purgé en fin de tour.
 *  - grantGeantTarget : « L'Allié [ou Héros] [bloqué / de votre choix] gagne
 *    Géant jusqu'à la fin du tour. » (Pandaluk = tout Allié ; Rat Klure = Rat
 *    bloqué ; Petit Anneau de Force = Allié ou Héros en sacrifice) → op de
 *    ciblage posant `geantTurnMod` sur la cible choisie.
 *
 * Distinct de combatModSelf (jeton `geantCombatMod`, portée COMBAT). STRICT :
 * seules les formes « jusqu'à la fin du tour » sont compilées ; les variantes
 * BEARER (« Le Porteur de X gagne Géant … »), COMBAT et composites (« perd
 * Agilité et gagne Géant ») restent manuelles (« an approximation of gameplay
 * is worse than a manual effect »).
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

describe("DSL — « gagne Géant jusqu'à la fin du tour »", () => {
  it("« La Ouassingue gagne Géant jusqu'à la fin du tour » → grantGeantSelf (onTap, requiresIncline)", () => {
    const c = compileTapEffectText(
      "La Ouassingue gagne Géant jusqu'à la fin du tour.",
      "Ouassingue",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "grantGeantSelf" }],
    });
  });

  it("« L'Allié de votre choix gagne Géant jusqu'à la fin du tour » → grantGeantTarget (Pandaluk)", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Géant jusqu'à la fin du tour.",
      "Pandaluk Skaïwoker",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantGeantTarget",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« Le Rat bloqué de votre choix gagne Géant … » → grantGeantTarget{sub:rat, combatRole:blocking} (Rat Klure)", () => {
    const c = compileTapEffectText(
      "Le Rat bloqué de votre choix gagne Géant jusqu'à la fin du tour.",
      "Rat Klure",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantGeantTarget",
          sub: "rat",
          combatRole: "blocking",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("variante SACRIFICE « Détruisez le Petit Anneau de Force : L'Allié ou Héros … » → cost:sacrificeSelf + grantGeantTarget{heroes}", () => {
    const c = compileTapEffectText(
      "Détruisez le Petit Anneau de Force : L'Allié ou Héros de votre choix gagne Géant jusqu'à la fin du tour.",
      "Petit Anneau de Force",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "grantGeantTarget",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  // NÉGATIF : « Le Porteur de X gagne Géant jusqu'à la fin du tour » (Anneau du
  // Rat Noir) est un bonus de PORTEUR temporaire (mécanisme différent — bearerBonus
  // est continu-seulement). Doit rester non compilé par compileTapEffectText.
  it("ne devrait PAS compiler « Le Porteur de l'Anneau du Rat Noir gagne Géant … » (bonus de Porteur)", () => {
    expect(
      compileTapEffectText(
        "Le Porteur de l'Anneau du Rat Noir gagne Géant jusqu'à la fin du tour.",
        "Anneau du Rat Noir",
      ),
    ).toBeNull();
  });

  // NÉGATIF : composite « perd Agilité et gagne Géant » (Pandhravan) — nécessite
  // un retrait de mot-clé non modélisé. Reste manuel.
  it("ne devrait PAS compiler « … perd Agilité et gagne Géant … » (composite, retrait de mot-clé)", () => {
    expect(
      compileTapEffectText(
        "Pandhravan perd Agilité et gagne Géant jusqu'à la fin du tour.",
        "Pandhravan",
      ),
    ).toBeNull();
  });

  // NÉGATIF : famille ambiguë (Iop = classe de Héros, hors ALLIED_FAMILIES) — on
  // ne devine pas le type. Reste manuel.
  it("ne devrait PAS compiler « Le Iop de votre choix gagne Géant … » (famille ambiguë)", () => {
    expect(
      compileTapEffectText(
        "Le Iop de votre choix gagne Géant jusqu'à la fin du tour.",
        "Carte X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur (engine isolé) — grantGeantSelf ─────────────────────────

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

describe("moteur — grantGeantSelf (jeton geantTurnMod sur la source)", () => {
  it("pose un jeton geantTurnMod sur la source en jeu", () => {
    const cards = { "card-s": aSrc("s") };
    const state = makeState({ s: inst("s", "card-s") });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Ouassingue",
      sourceId: "s",
      ops: [{ op: "grantGeantSelf" }],
    });
    const tok = tokenOn(dispatch, "s", "geantTurnMod");
    expect(tok, "geantTurnMod sur la source").toBeTruthy();
    expect(tok.payload.value).toBe(1);
    expect(tok.payload.token).toBe(true);
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
      ops: [{ op: "grantGeantSelf" }],
    });
    expect(tokenOn(dispatch, "s", "geantTurnMod")).toBeFalsy();
  });
});

// ── Volet 3 : effectiveKeywords + purge de fin de tour (harness réel) ─────────

describe("rules/effects — geantTurnMod alimente effectiveKeywords (Géant) et se purge", () => {
  it("grantGeantSelf : effectiveKeywords.geant devient true pour la source", () => {
    const f = fixture([makeAlly("ouas", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const id = instId("A", 0);
    // avant : pas de Géant intrinsèque
    expect(effectiveKeywords(ctxOf(f), id).geant).toBe(false);
    // pose le jeton TURN (comme le ferait grantGeantSelf)
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: id,
        counter: "geantTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    expect(effectiveKeywords(ctxOf(f), id).geant).toBe(true);
  });

  it("le jeton geantTurnMod est purgé au passage au tour suivant (effectiveKeywords redevient false)", () => {
    const f = fixture([makeAlly("ouas", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const id = instId("A", 0);
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: id,
        counter: "geantTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    expect(effectiveKeywords(ctxOf(f), id).geant).toBe(true);
    // passage au tour suivant : nextTurnEvents purge les jetons « du tour »
    dispatch(f, ...nextTurnEvents(ctxOf(f).state));
    expect(effectiveKeywords(ctxOf(f), id).geant).toBe(false);
  });

  it("isTurnToken reconnaît geantTurnMod (purgé) mais pas geantCombatMod via ce nom (portée combat couverte par *CombatMod)", () => {
    expect(isTurnToken("geantTurnMod")).toBe(true);
    // geantCombatMod reste purgé par le suffixe *CombatMod (portée combat)
    expect(isTurnToken("geantCombatMod")).toBe(true);
    // un jeton durable n'est pas purgé
    expect(isTurnToken("arrivedTurn")).toBe(false);
  });
});

// ── Volet 4 : ciblage — grantGeantTarget (éligibilité + résolution) ──────────

describe("moteur — grantGeantTarget (ciblage + jeton sur la cible choisie)", () => {
  it("Pandaluk (tout Allié) : pose geantTurnMod sur l'Allié choisi", () => {
    const f = fixture(
      [makeAlly("src", { force: 1 }), makeAlly("cible", { force: 2 })],
      [makeAlly("ennemi", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0), { arrivedTurn: 1 });

    const dispatched: unknown[] = [];
    const engine = createEffectEngine(
      mockDepsFromFixture(f, (drafts) => {
        dispatched.push(...drafts);
        dispatch(f, ...(drafts as never[]));
      }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Pandaluk Skaïwoker",
      sourceId: instId("A", 0),
      ops: [
        { op: "grantGeantTarget", heroes: false, zones: ["monde", "havreSac"] },
      ],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("grantGeantTarget");
    engine.effectTargetChoose(instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).geant).toBe(true);
  });

  it("filtre sub+combatRole (Rat Klure) : seul un Rat BLOQUEUR est éligible", () => {
    // src (A) attaque ; côté B : un Rat qui bloque, un Rat qui NE bloque pas,
    // un non-Rat qui bloque. Seul le Rat bloqueur doit être ciblable.
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

    // Construit un ctx avec un combat en cours : ratBloqueur et autreBloqueur
    // bloquent l'attaquant de A ; ratLibre ne bloque pas.
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
        op: "grantGeantTarget",
        sub: "rat",
        combatRole: "blocking",
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(ids).toEqual([instId("B", 0)]); // uniquement le Rat bloqueur
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
