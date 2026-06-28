/**
 * « Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner <Mot-clé> à
 * son Porteur » → grantKeywordTarget{requiresAttachment}.
 *
 * On cible directement le PORTEUR (créature ayant ≥1 attachement) : choisir
 * l'équipement ne sert qu'à désigner son Porteur, donc la cible fidèle EST la
 * créature qui le porte. STRICT : seuls les mots-clés CÂBLÉS sont compilés.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import type { Card } from "@/types/cards";
import type { RulesCtx } from "../../types";
import { compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectTargetIds } from "../targeting";

// ── Volet 1 : DSL ─────────────────────────────────────────────────────────────

describe("DSL — l'Équipement de votre choix fait gagner Kw à son Porteur", () => {
  it("« … fait gagner Tacle à son Porteur » → grantKeywordTarget{requiresAttachment,heroes}", () => {
    expect(
      compileTapEffectText(
        "Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner Tacle à son Porteur.",
        "Emma Tenl",
      ),
    ).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "grantKeywordTarget",
          keyword: "Tacle",
          requiresAttachment: true,
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("accepte les quatre mots-clés câblés (Géant/Agilité/Agressivité/Tacle)", () => {
    for (const [word, kw] of [
      ["Géant", "Géant"],
      ["Agilité", "Agilité"],
      ["Agressivité", "Agressivité"],
      ["Tacle", "Tacle"],
    ] as const) {
      const c = compileTapEffectText(
        `Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner ${word} à son Porteur.`,
        "Carte X",
      );
      expect(c?.ops[0]).toMatchObject({
        op: "grantKeywordTarget",
        keyword: kw,
        requiresAttachment: true,
      });
    }
  });

  it("ne compile PAS un mot-clé NON câblé (Soin → inerte → manuel)", () => {
    expect(
      compileTapEffectText(
        "Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner Soin à son Porteur.",
        "Carte X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : éligibilité (requiresAttachment) ───────────────────────────────

function ctxWith(
  instances: Record<string, unknown>,
  cards: Record<string, Card>,
): RulesCtx {
  return {
    state: {
      turn: { active: "A", number: 1 },
      instances,
      combat: null,
    },
    getCard: (id: string | null) => (id ? (cards[id] ?? null) : null),
  } as unknown as RulesCtx;
}

const ALLY: Card = {
  id: "ally",
  name: "Bouftou",
  mainType: "Allié",
  subTypes: [],
} as unknown as Card;

describe("éligibilité — requiresAttachment ne retient que les Porteurs", () => {
  it("seule une créature ayant ≥1 attachement est éligible (les deux contrôleurs)", () => {
    const ctx = ctxWith(
      {
        // A : un porteur (1 attachement) + une créature nue
        porteurA: {
          instanceId: "porteurA",
          cardId: "ally",
          owner: "A",
          controller: "A",
          location: { zone: "monde" },
          attachments: ["eq1"],
        },
        nueA: {
          instanceId: "nueA",
          cardId: "ally",
          owner: "A",
          controller: "A",
          location: { zone: "monde" },
          attachments: [],
        },
        // B : un porteur aussi (aucun filtre de contrôleur → éligible également)
        porteurB: {
          instanceId: "porteurB",
          cardId: "ally",
          owner: "B",
          controller: "B",
          location: { zone: "monde" },
          attachments: ["eq2"],
        },
      },
      { ally: ALLY },
    );
    const ids = effectTargetIds(
      ctx,
      {
        op: "grantKeywordTarget",
        keyword: "Tacle",
        requiresAttachment: true,
        heroes: true,
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(ids.sort()).toEqual(["porteurA", "porteurB"]);
  });

  it("aucune cible si personne ne porte d'équipement", () => {
    const ctx = ctxWith(
      {
        nue: {
          instanceId: "nue",
          cardId: "ally",
          owner: "A",
          controller: "A",
          location: { zone: "monde" },
          attachments: [],
        },
      },
      { ally: ALLY },
    );
    expect(
      effectTargetIds(
        ctx,
        {
          op: "grantKeywordTarget",
          keyword: "Tacle",
          requiresAttachment: true,
          heroes: true,
          zones: ["monde", "havreSac"],
        },
        "A",
      ),
    ).toEqual([]);
  });
});

// ── Volet 3 : Scarature Blanche — chooseOne de grantKeywordBearerSelf ─────────

describe("DSL — « le Porteur de <self> gagne A ou B » (Scarature Blanche)", () => {
  it("→ chooseOne de deux grantKeywordBearerSelf (Agilité / Tacle)", () => {
    const c = compileTapEffectText(
      "Jusqu'à la fin du tour, le Porteur de la Scarature Blanche gagne Agilité ou Tacle.",
      "Scarature Blanche",
    );
    expect(c?.ops[0]).toMatchObject({
      op: "chooseOne",
      options: [
        {
          label: "Agilité",
          ops: [{ op: "grantKeywordBearerSelf", keyword: "Agilité" }],
        },
        {
          label: "Tacle",
          ops: [{ op: "grantKeywordBearerSelf", keyword: "Tacle" }],
        },
      ],
    });
  });

  it("ne compile PAS la forme STATIQUE (sans « jusqu'à la fin du tour ») ici", () => {
    // « Le Porteur de X gagne Tacle. » = bonus de Porteur statique (autre voie) —
    // la grammaire « gagne A ou B » exige le préfixe de durée du tour.
    expect(
      compileTapEffectText(
        "Le Porteur de la Scarature Blanche gagne Agilité ou Tacle.",
        "Scarature Blanche",
      ),
    ).toBeNull();
  });
});

const EQUIP: Card = {
  id: "equip",
  name: "Scarature Blanche",
  mainType: "Équipement",
  subTypes: [],
} as unknown as Card;

function engineDeps(
  state: GameState,
  cards: Record<string, Card>,
  dispatch: ReturnType<typeof vi.fn>,
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
    dispatch,
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  } as unknown as EffectEngineDeps;
}

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

describe("moteur — grantKeywordBearerSelf (jeton sur le Porteur de la source)", () => {
  function state(bearerAttached: boolean): GameState {
    return {
      turn: { active: "A", number: 1 },
      instances: {
        bearer: {
          instanceId: "bearer",
          cardId: "ally",
          owner: "A",
          controller: "A",
          location: { zone: "monde" },
          attachments: bearerAttached ? ["eq"] : [],
        },
        eq: {
          instanceId: "eq",
          cardId: "equip",
          owner: "A",
          controller: "A",
          location: { zone: "monde" },
          attachments: [],
        },
      },
      seats: {
        A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
        B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
      },
    } as unknown as GameState;
  }

  it("pose agiliteTurnMod sur le PORTEUR (pas sur l'équipement)", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      engineDeps(state(true), { ally: ALLY, equip: EQUIP }, dispatch),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Scarature Blanche",
      sourceId: "eq",
      ops: [{ op: "grantKeywordBearerSelf", keyword: "Agilité" }],
    });
    expect(tokenOn(dispatch, "bearer", "agiliteTurnMod")).toBeTruthy();
    expect(tokenOn(dispatch, "eq", "agiliteTurnMod")).toBeFalsy();
  });

  it("NÉGATIF : source non portée (aucun Porteur) → aucun jeton (no-op fidèle)", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      engineDeps(state(false), { ally: ALLY, equip: EQUIP }, dispatch),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Scarature Blanche",
      sourceId: "eq",
      ops: [{ op: "grantKeywordBearerSelf", keyword: "Agilité" }],
    });
    expect(tokenOn(dispatch, "bearer", "agiliteTurnMod")).toBeFalsy();
  });
});
