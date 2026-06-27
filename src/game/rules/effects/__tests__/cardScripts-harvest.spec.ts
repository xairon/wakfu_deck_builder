/**
 * Garde-fou de la moisson de scripts manuels (tranche W8) : recharge les
 * données régénérées par `npm run compile-effects` et vérifie qu'un échantillon
 * représentatif des cartes scriptées a bien `coverage:"manual"` + les ops
 * attendues. Vérifie aussi que CHAQUE index de CARD_SCRIPTS pointe sur un effet
 * réel (un id/index erroné ne deviendrait jamais "manual").
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CARD_SCRIPTS } from "../cardScripts";
import type { CardEffect } from "@/types/cards";

const DATA_DIR = join(process.cwd(), "public", "data");

interface RawCard {
  id: string;
  effects?: CardEffect[];
}

/** Charge toutes les cartes des données par id. */
function loadCardsById(): Map<string, RawCard> {
  const byId = new Map<string, RawCard>();
  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const card of parsed as RawCard[]) {
      if (card && typeof card.id === "string") byId.set(card.id, card);
    }
  }
  return byId;
}

const cardsById = loadCardsById();

describe("moisson de scripts manuels W8 (données régénérées)", () => {
  // Échantillon représentatif : returnToHand, damageTarget (onTap/onArrive),
  // buffForceTarget avec famille, searchDeck (deux destinations).
  const samples: {
    id: string;
    index: number;
    trigger: string;
    ops: Record<string, unknown>[];
  }[] = [
    {
      id: "repulsion-incarnam",
      index: 0,
      trigger: "onPlay",
      ops: [
        { op: "returnToHand", heroes: false, zones: ["monde", "havreSac"] },
      ],
    },
    {
      id: "nomoon-incarnam",
      index: 0,
      trigger: "onTap",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
    {
      id: "clara-byne-bonta-brakmar",
      index: 0,
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
    {
      id: "eratz-le-revendicateur-incarnam",
      index: 0,
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 3,
          heroes: false,
          sub: "bandit",
          zones: ["monde", "havreSac"],
        },
      ],
    },
    {
      id: "gelee-menthe-incarnam",
      index: 0,
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "gelee",
          zones: ["monde", "havreSac"],
        },
      ],
    },
    {
      id: "la-derniere-mode-incarnam",
      index: 0,
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Équipement", dest: "main" },
        { op: "shuffleDeck" },
      ],
    },
    {
      id: "vacances-sur-l-ile-de-moon-incarnam",
      index: 0,
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Zone", dest: "monde" },
        { op: "shuffleDeck" },
      ],
    },
  ];

  for (const s of samples) {
    it(`${s.id}[${s.index}] est compilé en "manual" avec les ops attendues`, () => {
      const card = cardsById.get(s.id);
      expect(card, `carte ${s.id} introuvable`).toBeDefined();
      const effect = card!.effects?.[s.index];
      expect(effect, `effet ${s.id}[${s.index}] introuvable`).toBeDefined();
      expect(effect!.coverage).toBe("manual");
      expect(effect!.compiled).toBeDefined();
      expect(effect!.compiled!.trigger).toBe(s.trigger);
      expect(effect!.compiled!.ops).toEqual(s.ops);
    });
  }

  it("chaque index de CARD_SCRIPTS pointe sur un effet existant", () => {
    const dangling: string[] = [];
    for (const [id, byIndex] of Object.entries(CARD_SCRIPTS)) {
      const card = cardsById.get(id);
      if (!card) {
        dangling.push(`${id} (carte absente des données)`);
        continue;
      }
      for (const indexKey of Object.keys(byIndex)) {
        const index = Number(indexKey);
        if (!card.effects?.[index]) {
          dangling.push(`${id}[${index}] (effet inexistant)`);
        }
      }
    }
    expect(dangling, dangling.join(" | ")).toHaveLength(0);
  });

  it('toutes les entrées scriptées non-ruling sont coverage:"manual"', () => {
    const notManual: string[] = [];
    for (const [id, byIndex] of Object.entries(CARD_SCRIPTS)) {
      const card = cardsById.get(id);
      if (!card) continue;
      for (const [indexKey, entry] of Object.entries(byIndex)) {
        if ("kind" in entry) continue; // ruling/errata : pas un effet compilé
        const effect = card.effects?.[Number(indexKey)];
        if (effect && effect.coverage !== "manual") {
          notManual.push(`${id}[${indexKey}] = ${effect.coverage}`);
        }
      }
    }
    expect(notManual, notManual.join(" | ")).toHaveLength(0);
  });
});
