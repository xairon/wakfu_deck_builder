/**
 * CHOIX EXCLUSIF « A ou B » (op chooseOne).
 *
 * « <Cible> de votre choix gagne <A> ou <B> jusqu'à la fin du tour » : le joueur
 * choisit UNE des deux branches (octroi câblé : mot-clé Géant/Agilité/Agressivité/
 * Tacle ou « +N en Force »), dont les ops s'exécutent ; l'autre est ignorée.
 * Présenté via effectChoices (deux boutons étiquetés). Le RESTE de la frame
 * (« … ou … Piochez une carte ») reprend après résolution.
 *
 * STRICT (« an approximation of gameplay is worse than a manual effect ») : on ne
 * compile un chooseOne QUE si les DEUX tokens sont des octrois fidèlement câblés.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import { compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectiveKeywords } from "../keywords";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

// ── Volet 1 : DSL (parseSentence via compileTapEffectText) ────────────────────

describe("DSL — chooseOne « A ou B »", () => {
  it("« L'Allié ou Héros de votre choix gagne Géant ou Agilité … » → chooseOne (2 grantKeywordTarget, heroes)", () => {
    const c = compileTapEffectText(
      "L'Allié ou Héros de votre choix gagne Géant ou Agilité jusqu'à la fin du tour.",
      "Baguette du Bandit Ensorceleur",
    );
    expect(c?.trigger).toBe("onTap");
    expect(typeof (c?.ops[0] as { prompt?: unknown }).prompt).toBe("string");
    expect(c?.ops[0]).toMatchObject({
      op: "chooseOne",
      options: [
        {
          label: "Géant",
          ops: [
            {
              op: "grantKeywordTarget",
              keyword: "Géant",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
          ],
        },
        {
          label: "Agilité",
          ops: [
            {
              op: "grantKeywordTarget",
              keyword: "Agilité",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
          ],
        },
      ],
    });
  });

  it("« L'Allié de votre choix gagne Géant ou +2 en Force … » → chooseOne (grantKeywordTarget + buffForceTarget, heroes:false)", () => {
    const c = compileTapEffectText(
      "L'Allié de votre choix gagne Géant ou +2 en Force jusqu'à la fin du tour.",
      "La-Haine",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "chooseOne",
      options: [
        {
          label: "Géant",
          ops: [{ op: "grantKeywordTarget", keyword: "Géant", heroes: false }],
        },
        {
          label: "+2 en Force",
          ops: [{ op: "buffForceTarget", n: 2, heroes: false }],
        },
      ],
    });
  });

  it("« Le Monstre de votre choix gagne Géant ou +2 en Force … » → chooseOne avec sub:monstre sur les deux branches", () => {
    const c = compileTapEffectText(
      "Le Monstre de votre choix gagne Géant ou +2 en Force jusqu'à la fin du tour.",
      "Temple Osamodas",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "chooseOne",
      options: [
        {
          ops: [{ op: "grantKeywordTarget", keyword: "Géant", sub: "monstre" }],
        },
        { ops: [{ op: "buffForceTarget", n: 2, sub: "monstre" }] },
      ],
    });
  });

  // NÉGATIF : un token non câblé (Fantôme) → pas de demi-encodage.
  it("ne compile PAS « … gagne Fantôme ou Géant … » (Fantôme inerte → manuel)", () => {
    expect(
      compileTapEffectText(
        "L'Allié de votre choix gagne Fantôme ou Géant jusqu'à la fin du tour.",
        "Carte X",
      ),
    ).toBeNull();
  });

  // NÉGATIF : famille ambiguë (Iop = classe de Héros) → on ne devine pas le type.
  it("ne compile PAS « Le Iop de votre choix gagne Géant ou Agilité … » (famille ambiguë)", () => {
    expect(
      compileTapEffectText(
        "Le Iop de votre choix gagne Géant ou Agilité jusqu'à la fin du tour.",
        "Carte X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur — résolution du choix + application sur la cible ─────────

function mockDepsFromFixture(
  f: ReturnType<typeof fixture>,
  over: Partial<EffectEngineDeps> = {},
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
    dispatch: vi.fn((...drafts: unknown[]) =>
      dispatch(f, ...(drafts as never[])),
    ),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  } as unknown as EffectEngineDeps;
}

const CHOICE_OP = {
  op: "chooseOne" as const,
  prompt: "gagne Géant ou Agilité",
  options: [
    {
      label: "Géant",
      ops: [
        {
          op: "grantKeywordTarget" as const,
          keyword: "Géant" as const,
          heroes: false,
          zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
        },
      ],
    },
    {
      label: "Agilité",
      ops: [
        {
          op: "grantKeywordTarget" as const,
          keyword: "Agilité" as const,
          heroes: false,
          zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
        },
      ],
    },
  ],
};

describe("moteur — chooseOne (présentation + branches)", () => {
  function setup() {
    const f = fixture([
      makeAlly("src", { force: 1 }),
      makeAlly("cible", { force: 2 }),
    ]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    return f;
  }

  it("présente un choix à deux boutons étiquetés (optionLabels), pas de ciblage immédiat", () => {
    const f = setup();
    const engine = createEffectEngine(mockDepsFromFixture(f));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Baguette du Bandit Ensorceleur",
      sourceId: instId("A", 0),
      ops: [CHOICE_OP],
    });
    expect(engine.effectChoice.value).toBeTruthy();
    expect(engine.effectChoice.value?.optionLabels).toEqual([
      "Géant",
      "Agilité",
    ]);
    // tant que le joueur n'a pas choisi, aucun ciblage n'est ouvert
    expect(engine.effectTargeting.value).toBeNull();
  });

  it("brancheA (accept=true) → grantKeywordTarget Géant → la cible choisie gagne Géant", () => {
    const f = setup();
    const engine = createEffectEngine(mockDepsFromFixture(f));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Baguette du Bandit Ensorceleur",
      sourceId: instId("A", 0),
      ops: [CHOICE_OP],
    });
    engine.effectChoiceResolve(true);
    expect(engine.effectTargeting.value?.op).toMatchObject({
      op: "grantKeywordTarget",
      keyword: "Géant",
    });
    engine.effectTargetChoose(instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).geant).toBe(true);
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).agilite).toBe(false);
  });

  it("brancheB (accept=false) → grantKeywordTarget Agilité → la cible choisie gagne Agilité", () => {
    const f = setup();
    const engine = createEffectEngine(mockDepsFromFixture(f));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Baguette du Bandit Ensorceleur",
      sourceId: instId("A", 0),
      ops: [CHOICE_OP],
    });
    engine.effectChoiceResolve(false);
    expect(engine.effectTargeting.value?.op).toMatchObject({
      op: "grantKeywordTarget",
      keyword: "Agilité",
    });
    engine.effectTargetChoose(instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).agilite).toBe(true);
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).geant).toBe(false);
  });

  it("le RESTE de la frame reprend après le choix (« … ou … Piochez une carte »)", () => {
    const f = setup();
    const draw = vi.fn();
    const engine = createEffectEngine(mockDepsFromFixture(f, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Dofus-Arena Max",
      sourceId: instId("A", 0),
      ops: [CHOICE_OP, { op: "draw", n: 1 }],
    });
    engine.effectChoiceResolve(true);
    engine.effectTargetChoose(instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).geant).toBe(true);
    expect(draw).toHaveBeenCalledWith("A", 1);
  });
});
