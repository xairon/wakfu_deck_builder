/**
 * « gagne Résistance N (Élément)[(Élément)…] jusqu'à la fin du tour » — octroi
 * TURN-scoped de Résistance, sur le modèle de l'octroi de mot-clé (grant-geant).
 *
 * Deux ops :
 *  - grantResistanceSelf{resist}   : « [self] gagne Résistance N (Élément)… jusqu'à
 *    la fin du tour. » → jeton(s) `resMod_<el>` (+N par Élément) sur la SOURCE (en
 *    jeu), purgé(s) en fin de tour (préfixe resMod_).
 *  - grantResistanceTarget{resist} : « L'Allié [ou Héros] [Famille] [bloqué / de
 *    votre choix] gagne Résistance N (Élément)… jusqu'à la fin du tour. » → op de
 *    ciblage posant `resMod_<el>` sur la cible choisie.
 *
 * Les jetons `resMod_<el>` sont lus par effectiveKeywords (CombatKeywords.resistances)
 * qui alimente la PRÉVENTION de Dommages (7469, preventDamage). STRICT : seules les
 * formes « jusqu'à la fin du tour » avec Éléments EXPLICITES sont compilées ; les
 * variantes BEARER (« Le Porteur de X gagne … »), DYNAMIQUES (« N par carte
 * recyclée », « dans l'élément des Dommages / de votre choix ») et composites
 * restent manuelles (« an approximation of gameplay is worse than a manual effect »).
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { isTurnToken } from "../limits";
import { effectiveKeywords, preventDamage } from "../keywords";
import { effectTargetIds, resolveGrantResistanceTarget } from "../targeting";
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

describe("DSL — « gagne Résistance N (Élément)… jusqu'à la fin du tour »", () => {
  it("« Cette carte gagne Résistance 1 (feu) jusqu'à la fin du tour » → grantResistanceSelf", () => {
    const c = compileTapEffectText(
      "Cette carte gagne Résistance 1 (feu) jusqu'à la fin du tour.",
      "Cette carte",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "grantResistanceSelf", resist: [{ element: "feu", n: 1 }] }],
    });
  });

  it("multi-éléments « … gagne Résistance 1 (air)(eau)(terre)(feu) … » → un (élément,n) par Élément", () => {
    const c = compileTapEffectText(
      "Cette carte gagne Résistance 1 (air)(eau)(terre)(feu) jusqu'à la fin du tour.",
      "Cette carte",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantResistanceSelf",
          resist: [
            { element: "air", n: 1 },
            { element: "eau", n: 1 },
            { element: "terre", n: 1 },
            { element: "feu", n: 1 },
          ],
        },
      ],
    });
  });

  it("« L'Allié de votre choix gagne Résistance 2 (eau) … » → grantResistanceTarget", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Résistance 2 (eau) jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantResistanceTarget",
          resist: [{ element: "eau", n: 2 }],
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« L'Allié ou Héros de votre choix gagne Résistance 1 (terre) … » → grantResistanceTarget{heroes}", () => {
    const c = compileTapEffectText(
      "L'Allié ou Héros de votre choix gagne Résistance 1 (terre) jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantResistanceTarget",
          resist: [{ element: "terre", n: 1 }],
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("forme Famille « Le Bouftou de votre choix gagne Résistance 1 (air) … » → grantResistanceTarget{sub}", () => {
    const c = compileTapEffectText(
      "Le Bouftou de votre choix gagne Résistance 1 (air) jusqu'à la fin du tour.",
      "Carte X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantResistanceTarget",
          resist: [{ element: "air", n: 1 }],
          sub: "bouftou",
          combatRole: undefined,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("variante SACRIFICE « Détruisez [cette carte] : L'Allié ou Héros … gagne Résistance 1 (feu) … »", () => {
    const c = compileTapEffectText(
      "Détruisez l'Anneau X : L'Allié ou Héros de votre choix gagne Résistance 1 (feu) jusqu'à la fin du tour.",
      "Anneau X",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "grantResistanceTarget",
          resist: [{ element: "feu", n: 1 }],
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });
});

describe("DSL — négatifs (fidélité)", () => {
  // BEARER : « Le Porteur de X gagne Résistance … » (Anneau Rigami) — bonus de
  // PORTEUR temporaire, mécanisme distinct (bearerBonus). Reste manuel.
  it("ne devrait PAS compiler « Le Porteur de l'Anneau Rigami gagne Résistance 1 (air)(terre)(feu)(eau) … » (bearer)", () => {
    expect(
      compileTapEffectText(
        "Le Porteur de l'Anneau Rigami gagne Résistance 1 (air)(terre)(feu)(eau) jusqu'à la fin du tour.",
        "Anneau Rigami",
      ),
    ).toBeNull();
  });

  // DYNAMIQUE : Élément choisi à la résolution (« dans l'élément de votre choix »)
  // — non modélisé (l'Élément n'est pas figeable). Reste manuel.
  it("ne devrait PAS compiler « … gagne Résistance 1 dans l'élément de votre choix … » (Élément dynamique)", () => {
    expect(
      compileTapEffectText(
        "Cette carte gagne Résistance 1 dans l'élément de votre choix jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toBeNull();
  });

  // DYNAMIQUE : « dans l'élément des Dommages qu'il a subis » (Tynril) — Élément
  // résolu à l'exécution. Reste manuel.
  it("ne devrait PAS compiler « … gagne Résistance 2 dans l'élément des Dommages … » (Élément dynamique)", () => {
    expect(
      compileTapEffectText(
        "Cette carte gagne Résistance 2 dans l'élément des Dommages qu'il a subis jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toBeNull();
  });

  // COMPOSITE : « perd toutes ses Résistances puis gagne Résistance … » — le
  // retrait n'est pas modélisé. Reste manuel.
  it("ne devrait PAS compiler une forme composite « perd … puis gagne Résistance 2 (feu) … »", () => {
    expect(
      compileTapEffectText(
        "Cette carte perd ses Résistances puis gagne Résistance 2 (feu) jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toBeNull();
  });

  // Élément inconnu entre parenthèses → parseResistClause rejette (pas de devinette).
  it("ne devrait PAS compiler « … gagne Résistance 1 (lumiere) … » (Élément non reconnu)", () => {
    expect(
      compileTapEffectText(
        "Cette carte gagne Résistance 1 (lumiere) jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toBeNull();
  });

  // SANS Élément explicite (« Résistance 2 » seul) → non capté (manuel).
  it("ne devrait PAS compiler « … gagne Résistance 2 jusqu'à la fin du tour » (sans Élément)", () => {
    expect(
      compileTapEffectText(
        "Cette carte gagne Résistance 2 jusqu'à la fin du tour.",
        "Cette carte",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur (engine isolé) — grantResistanceSelf ────────────────────

function aSrc(id: string): Card {
  return {
    id: `card-${id}`,
    name: "Source",
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

/** Cherche l'INC_COUNTER d'un token sur une cible parmi les dispatch. */
function incOn(
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
        e.type === "INC_COUNTER" &&
        e.payload?.instanceId === targetId &&
        e.payload?.counter === counter,
    );
}

describe("moteur — grantResistanceSelf (jetons resMod_<el> sur la source)", () => {
  it("pose un jeton resMod_feu +1 sur la source en jeu", () => {
    const cards = { "card-s": aSrc("s") };
    const state = makeState({ s: inst("s", "card-s") });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Source",
      sourceId: "s",
      ops: [{ op: "grantResistanceSelf", resist: [{ element: "feu", n: 1 }] }],
    });
    const tok = incOn(dispatch, "s", "resMod_feu");
    expect(tok, "resMod_feu sur la source").toBeTruthy();
    expect(tok.payload.delta).toBe(1);
    expect(tok.payload.token).toBe(true);
  });

  it("multi-éléments : un jeton resMod_<el> par Élément", () => {
    const cards = { "card-s": aSrc("s") };
    const state = makeState({ s: inst("s", "card-s") });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, cards, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Source",
      sourceId: "s",
      ops: [
        {
          op: "grantResistanceSelf",
          resist: [
            { element: "air", n: 1 },
            { element: "eau", n: 1 },
            { element: "terre", n: 1 },
            { element: "feu", n: 1 },
          ],
        },
      ],
    });
    for (const el of ["air", "eau", "terre", "feu"])
      expect(incOn(dispatch, "s", `resMod_${el}`), el).toBeTruthy();
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
      cardName: "Source",
      sourceId: "s",
      ops: [{ op: "grantResistanceSelf", resist: [{ element: "feu", n: 2 }] }],
    });
    expect(incOn(dispatch, "s", "resMod_feu")).toBeFalsy();
  });
});

describe("moteur — resolveGrantResistanceTarget (pur)", () => {
  it("émet un INC_COUNTER resMod_<el> par Élément sur la cible", () => {
    const cards: Record<string, Card> = { "card-t": aSrc("t") };
    const state = makeState({ t: inst("t", "card-t") });
    const res = resolveGrantResistanceTarget(
      {
        state,
        getCard: (id: string | null) => (id ? cards[id] : null),
      } as never,
      "A",
      "t",
      [
        { element: "air", n: 1 },
        { element: "feu", n: 2 },
      ],
    );
    expect(res.events).toHaveLength(2);
    expect(res.events[0]).toMatchObject({
      type: "INC_COUNTER",
      payload: {
        instanceId: "t",
        counter: "resMod_air",
        delta: 1,
        token: true,
      },
    });
    expect(res.events[1]).toMatchObject({
      type: "INC_COUNTER",
      payload: {
        instanceId: "t",
        counter: "resMod_feu",
        delta: 2,
        token: true,
      },
    });
  });
});

// ── Volet 3 : effectiveKeywords + prévention + purge (harness réel) ──────────

describe("rules/effects — resMod_<el> alimente la Résistance effective et se purge", () => {
  it("resMod_feu réduit les Dommages de feu de la cible pour le tour, puis se purge", () => {
    const f = fixture([makeAlly("c", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const id = instId("A", 0);
    // Avant : aucune Résistance → 5 Dommages de feu passent en entier.
    expect(effectiveKeywords(ctxOf(f), id).resistances.feu ?? 0).toBe(0);
    expect(preventDamage(effectiveKeywords(ctxOf(f), id), 5, "feu")).toBe(5);
    // Octroi TURN-scoped : +2 Résistance feu.
    dispatch(f, {
      actor: "A",
      type: "INC_COUNTER",
      payload: { instanceId: id, counter: "resMod_feu", delta: 2, token: true },
    } as never);
    expect(effectiveKeywords(ctxOf(f), id).resistances.feu).toBe(2);
    // 5 Dommages de feu → réduits à 3 (7469). L'eau n'est pas affectée.
    expect(preventDamage(effectiveKeywords(ctxOf(f), id), 5, "feu")).toBe(3);
    expect(preventDamage(effectiveKeywords(ctxOf(f), id), 5, "eau")).toBe(5);
    // Fin de tour : nextTurnEvents purge les jetons « du tour » (préfixe resMod_).
    dispatch(f, ...nextTurnEvents(ctxOf(f).state));
    expect(effectiveKeywords(ctxOf(f), id).resistances.feu ?? 0).toBe(0);
    expect(preventDamage(effectiveKeywords(ctxOf(f), id), 5, "feu")).toBe(5);
  });

  it("multi-éléments : chaque Élément octroyé réduit les Dommages correspondants", () => {
    const f = fixture([makeAlly("c", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const id = instId("A", 0);
    for (const el of ["air", "eau", "terre", "feu"])
      dispatch(f, {
        actor: "A",
        type: "INC_COUNTER",
        payload: {
          instanceId: id,
          counter: `resMod_${el}`,
          delta: 1,
          token: true,
        },
      } as never);
    const kw = effectiveKeywords(ctxOf(f), id);
    for (const el of ["air", "eau", "terre", "feu"])
      expect(preventDamage(kw, 3, el), el).toBe(2);
  });

  it("isTurnToken reconnaît resMod_<el> (purgé en fin de tour)", () => {
    expect(isTurnToken("resMod_feu")).toBe(true);
    expect(isTurnToken("resMod_air")).toBe(true);
  });
});

// ── Volet 4 : ciblage (éligibilité) ──────────────────────────────────────────

describe("targeting — grantResistanceTarget éligibilité", () => {
  it("filtre heroes/sub/controller comme les autres ops à cible", () => {
    const cards: Record<string, Card> = {
      "card-a": aSrc("a"),
      "card-b": { ...aSrc("b"), subTypes: ["Bouftou"] } as Card,
    };
    const ally = inst("a", "card-a");
    const bouftou = inst("b", "card-b");
    const state = makeState({ a: ally, b: bouftou });
    // sans filtre : les deux Alliés sont éligibles.
    expect(
      effectTargetIds(
        {
          state,
          getCard: (id: string | null) => (id ? cards[id] : null),
        } as never,
        {
          op: "grantResistanceTarget",
          resist: [{ element: "feu", n: 1 }],
          zones: ["monde", "havreSac"],
        },
        "A",
      ).sort(),
    ).toEqual(["a", "b"]);
    // sub:bouftou → seul le Bouftou.
    expect(
      effectTargetIds(
        {
          state,
          getCard: (id: string | null) => (id ? cards[id] : null),
        } as never,
        {
          op: "grantResistanceTarget",
          resist: [{ element: "feu", n: 1 }],
          sub: "bouftou",
          zones: ["monde", "havreSac"],
        },
        "A",
      ),
    ).toEqual(["b"]);
  });
});
