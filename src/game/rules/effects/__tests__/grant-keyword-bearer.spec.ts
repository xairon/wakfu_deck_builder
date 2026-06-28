/**
 * « Jusqu'à la fin du tour, l'Équipement de votre choix fait gagner <Mot-clé> à
 * son Porteur » → grantKeywordTarget{requiresAttachment}.
 *
 * On cible directement le PORTEUR (créature ayant ≥1 attachement) : choisir
 * l'équipement ne sert qu'à désigner son Porteur, donc la cible fidèle EST la
 * créature qui le porte. STRICT : seuls les mots-clés CÂBLÉS sont compilés.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import type { RulesCtx } from "../../types";
import { compileTapEffectText } from "../dsl";
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
