/**
 * Tranche W19 — vague de progrès fidèle :
 *
 *  1. searchDiscardToHand : `searchDeck` avec `from:"defausse"` + `dest:"main"`
 *     (« Cherchez une carte X dans votre Défausse et prenez-la en main ») —
 *     même machinerie de pick que la recherche-Pioche, pile = Défausse. Empty
 *     Défausse → no-op (effet passé, pas de picker).
 *  2. Cible Héros-seule sur damageTarget (`targetHeroOnly`) : « inflige N
 *     Dommages au Héros de votre choix » — un Allié n'est PAS éligible.
 *  3. Routage du coût de SACRIFICE « Détruisez [cette carte] : … »
 *     (isSacrificeCostText) vers compileTapEffectText, même sans
 *     requiresIncline — récolte de cartes dont le corps mappe entièrement.
 *  4. Échantillon de moisson sur données régénérées + négatifs (pas de
 *     sur-capture).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CardEffect } from "@/types/cards";
import { effectTargetIds } from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";
import {
  compileActionEffectText,
  compileTapEffectText,
  isSacrificeCostText,
} from "../dsl.ts";
import { makeEffectSandbox } from "@/stores/__tests__/effectPipeline.harness";

function action(text: string, name = "Test") {
  return compileActionEffectText(text, name)?.ops ?? null;
}

// ───────────────────── 1. DSL searchDeck depuis la Défausse ─────────────────

describe("W19 — DSL : recherche Défausse → main (searchDeck from defausse)", () => {
  it("« Cherchez une carte Monstre dans votre Défausse et prenez-la en main »", () => {
    expect(
      action(
        "Cherchez une carte Monstre dans votre Défausse et prenez-la en main.",
      ),
    ).toEqual([
      {
        op: "searchDeck",
        what: "Allié",
        from: "defausse",
        sub: "monstre",
        dest: "main",
      },
    ]);
  });

  it("type racine + « révélez-la » + Niveau EXACT (« de Niveau 1 »)", () => {
    expect(
      action(
        "Cherchez une carte Équipement de Niveau 1 dans votre Défausse et prenez-la en main.",
      ),
    ).toEqual([
      {
        op: "searchDeck",
        what: "Équipement",
        from: "defausse",
        exactLevel: 1,
        dest: "main",
      },
    ]);
  });

  it("« révélez-la et prenez-la en main » (clause de révélation tolérée)", () => {
    expect(
      action(
        "Cherchez une carte Zone dans votre Défausse, révélez-la et prenez-la en main.",
      ),
    ).toEqual([
      { op: "searchDeck", what: "Zone", from: "defausse", dest: "main" },
    ]);
  });

  it("Famille d'Allié + « prenez-le en main » (genre masculin)", () => {
    expect(
      action(
        "Cherchez un Allié Wabbit dans votre Défausse et prenez-le en main.",
      ),
    ).toEqual([
      {
        op: "searchDeck",
        what: "Allié",
        from: "defausse",
        sub: "wabbit",
        dest: "main",
      },
    ]);
  });

  it("avec « , puis mélangez » → searchDeck(defausse) + shuffleDeck", () => {
    expect(
      action(
        "Cherchez une carte Monstre dans votre Défausse et prenez-la en main, puis mélangez votre Pioche.",
      ),
    ).toEqual([
      {
        op: "searchDeck",
        what: "Allié",
        from: "defausse",
        sub: "monstre",
        dest: "main",
      },
      { op: "shuffleDeck" },
    ]);
  });

  it("la recherche-Pioche reste from absent (comportement historique intact)", () => {
    expect(
      action(
        "Cherchez une carte Équipement dans votre Pioche, révélez-la et prenez-la en main.",
      ),
    ).toEqual([{ op: "searchDeck", what: "Équipement", dest: "main" }]);
  });

  it("négatif : « mettez-la en jeu » depuis la Défausse → putInPlay (pas searchDeck)", () => {
    expect(
      action(
        "Cherchez une carte Zone dans votre Défausse et mettez-la en jeu.",
      ),
    ).toEqual([{ op: "putInPlay", from: "defausse", what: "Zone" }]);
  });
});

// ───────────── 2. DSL + eligibility : Dommages au Héros seul ────────────────

describe("W19 — DSL : « inflige N Dommages au Héros de votre choix »", () => {
  it("impératif → damageTarget targetHeroOnly", () => {
    expect(action("Infligez 2 Dommages au Héros de votre choix.")).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Neutre",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("sujet self (« X inflige N Dommages au Héros … ») → élément source", () => {
    const ops = compileTapEffectText(
      "Détruisez le Poolay : Le Poolay inflige 2 Dommages au Héros de votre choix.",
      "Le Poolay",
      "Feu",
    )?.ops;
    expect(ops).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("négatif : sujet self qui ne correspond pas au nom → non compilé", () => {
    expect(
      compileActionEffectText(
        "Le Bidule inflige 2 Dommages au Héros de votre choix.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("W27 : « au Héros du joueur de votre choix » → damageTarget heroes-only (identique à « de votre choix »)", () => {
    // Depuis W27, « du joueur de votre choix » (choix d'un JOUEUR via son Héros)
    // est traité comme « de votre choix » : éligibilité = tous les Héros en jeu.
    expect(
      action("Infligez 1 Dommage au Héros du joueur de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 1,
        element: "Neutre",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });
});

describe("W19 — eligibility targetHeroOnly (effectTargetIds)", () => {
  it("ne liste que les Héros (un Allié n'est PAS ciblable)", () => {
    // Héros A en Monde + un Allié en Monde : seule l'instance Héros est éligible.
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    // Le Héros A vit dans son Havre-Sac (zone havreSac), l'Allié dans le Monde.
    expect(ids).not.toContain(instId("A", 0));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const inst = ctxOf(f).state.instances[id];
      const card = ctxOf(f).getCard(inst.cardId);
      expect(card?.mainType).toBe("Héros");
    }
  });

  it("sans targetHeroOnly, l'Allié redevient éligible (heroes:true)", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(ids).toContain(instId("A", 0));
  });
});

// ───────────── 3. routage coût de sacrifice (isSacrificeCostText) ───────────

describe("W19 — routage coût de SACRIFICE « Détruisez [cette carte] : … »", () => {
  it("isSacrificeCostText reconnaît « Détruisez <self> : … »", () => {
    expect(isSacrificeCostText("Détruisez le Poolay : ...")).toBe(true);
  });

  it("isSacrificeCostText EXCLUT le coût payé « Détruisez un de vos … »", () => {
    expect(
      isSacrificeCostText("Détruisez un de vos Alliés : Piochez une carte."),
    ).toBe(false);
  });

  it("isSacrificeCostText EXCLUT « Détruisez un X que vous contrôlez : … »", () => {
    expect(
      isSacrificeCostText(
        "Détruisez un Équipement que vous contrôlez : Détruisez le Shushu.",
      ),
    ).toBe(false);
  });

  it("compile « Détruisez <self> : Le Héros de votre choix regagne N PV » (healHeroTarget)", () => {
    const c = compileTapEffectText(
      "Détruisez l'Auberge d'Astrub : Le Héros de votre choix regagne 2 PV.",
      "L'Auberge d'Astrub",
      "Neutre",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "healHeroTarget", n: 2 }],
    });
  });

  it("compile « Détruisez <self> : Votre Héros regagne N PV » (heroGainPv)", () => {
    const c = compileTapEffectText(
      "Détruisez la Chauve-Souris Vampyre : Votre Héros regagne 3 PV.",
      "La Chauve-Souris Vampyre",
      "Neutre",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "heroGainPv", n: 3 }],
    });
  });

  it("compile « Détruisez <self> : Détruisez l'Allié de votre choix » (destroyTarget)", () => {
    const c = compileTapEffectText(
      "Détruisez le Venin de Scorbute : Détruisez l'Allié de votre choix.",
      "Le Venin de Scorbute",
      "Neutre",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
  });

  it("négatif : corps non mappé (actor-bound « il/elle … ») reste non compilé", () => {
    // « Détruisez Arty : Il inflige sa Force … » — le corps actor-bound n'est
    // pas géré par le chemin sacrifice (compileBody) → manuel.
    expect(
      compileTapEffectText(
        "Détruisez Arty : Il inflige sa Force en Dommages à l'Allié de votre choix.",
        "Arty",
        "Feu",
      ),
    ).toBeNull();
  });
});

// ───────────── 4. engine : pick depuis la Défausse → main ───────────────────

describe("W19 — moteur : searchDeck from defausse, dest main", () => {
  it("ouvre un picker DANS la Défausse et le clic prend la carte en main", () => {
    // Toutes les cartes du deck = Allié (déterministe) : une carte de la Pioche
    // descend vers la Défausse par le chemin réel, puis searchDeck(defausse) la
    // récupère.
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.draw("A", 1);
    const drawn = store.state.seats.A.main[store.state.seats.A.main.length - 1];
    store.moveTo(drawn, { zone: "defausse", owner: "A" });
    const handBefore = store.state.seats.A.main.length;
    const defausseBefore = store.state.seats.A.defausse.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        { op: "searchDeck", what: "Allié", from: "defausse", dest: "main" },
      ],
    });
    expect(store.effectPicking?.zone).toBe("defausse");
    const pick = store.effectPickIds[0];
    expect(store.state.seats.A.defausse).toContain(pick);
    store.effectPick(pick);
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
    expect(store.state.seats.A.defausse.length).toBe(defausseBefore - 1);
    expect(store.state.seats.A.main).toContain(pick);
    expect(store.effectPicking).toBeNull();
  });

  it("Défausse vide (aucun match) : effet passé, pas de picker", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    expect(store.state.seats.A.defausse.length).toBe(0);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        { op: "searchDeck", what: "Allié", from: "defausse", dest: "main" },
      ],
    });
    expect(store.effectPicking).toBeNull();
  });
});

// ───────────── 5. harvest : données régénérées (compile-effects) ────────────

const DATA_DIR = join(process.cwd(), "public", "data");

interface RawCard {
  id: string;
  effects?: CardEffect[];
}

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
    for (const card of parsed as RawCard[])
      if (card && typeof card.id === "string") byId.set(card.id, card);
  }
  return byId;
}

const cardsById = loadCardsById();

describe("W19 — moisson sur données régénérées", () => {
  const samples: {
    id: string;
    index: number;
    trigger: string;
    cost?: string;
    ops: Record<string, unknown>[];
  }[] = [
    {
      id: "reviens-incarnam",
      index: 0,
      trigger: "onPlay",
      ops: [
        {
          op: "searchDeck",
          what: "Allié",
          from: "defausse",
          sub: "monstre",
          dest: "main",
        },
      ],
    },
    {
      id: "phorreur-immature-astrub",
      index: 0,
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "searchDeck",
          what: "Équipement",
          from: "defausse",
          exactLevel: 1,
          dest: "main",
        },
      ],
    },
    {
      id: "poolay-otomai",
      index: 0,
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Feu",
          heroes: true,
          targetHeroOnly: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
    {
      id: "auberge-d-astrub-astrub",
      index: 0,
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "healHeroTarget", n: 2 }],
    },
    {
      id: "venin-de-scorbute-bonta-brakmar",
      index: 0,
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    },
  ];

  for (const s of samples) {
    it(`${s.id} #${s.index} → auto ${s.trigger}`, () => {
      const card = cardsById.get(s.id);
      expect(card, `carte ${s.id} introuvable`).toBeTruthy();
      const eff = card!.effects?.[s.index];
      expect(eff, `effet #${s.index} introuvable`).toBeTruthy();
      expect(eff!.coverage).toBe("auto");
      expect(eff!.compiled?.trigger).toBe(s.trigger);
      if (s.cost) expect(eff!.compiled?.cost).toBe(s.cost);
      expect(eff!.compiled?.ops).toEqual(s.ops);
    });
  }
});
