/**
 * Câblage combat de deux mots-clés du glossaire jusqu'ici inertes :
 *  - Agressivité (Allié) : peut attaquer le tour où il apparaît (lève le mal
 *    d'invocation, 1821, à l'attaque uniquement).
 *  - Agilité (Allié/Héros) : un attaquant possédant Agilité ne peut être bloqué
 *    que par un bloqueur possédant lui aussi Agilité.
 * Fidélité : on n'altère QUE ces deux légalités ; toutes les autres contraintes
 * (contrôle, zone, orientation, cible, « ne peut pas bloquer »…) restent actives.
 */
import { describe, expect, it } from "vitest";
import type { AllyCard, CardKeyword, CardKeywordInfo } from "@/types/cards";
import { combatKeywords } from "@/game/rules";
import { eligibleAttackers, eligibleBlockers } from "../legality";
import {
  HERO_A,
  HERO_B,
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  makeHero,
  setTurn,
} from "./harness";

/** Allié muni d'un mot-clé structuré du glossaire (Agilité / Agressivité). */
function withKeyword(id: string, name: CardKeyword, force = 2): AllyCard {
  const a = makeAlly(id, { force });
  a.keywords = [{ name, description: "" }];
  return a;
}

describe("keyword-combat-wiring — combatKeywords expose agilite/agressivite", () => {
  it("lit Agilité et Agressivité sur un Allié (mots-clés structurés)", () => {
    expect(combatKeywords(withKeyword("a", "Agilité")).agilite).toBe(true);
    expect(combatKeywords(withKeyword("a", "Agilité")).agressivite).toBe(false);
    expect(combatKeywords(withKeyword("b", "Agressivité")).agressivite).toBe(
      true,
    );
    expect(combatKeywords(withKeyword("b", "Agressivité")).agilite).toBe(false);
    // une carte sans mot-clé → tout à false
    expect(combatKeywords(makeAlly("plain")).agilite).toBe(false);
    expect(combatKeywords(makeAlly("plain")).agressivite).toBe(false);
  });

  it("lit Agilité/Agressivité sur la face active d'un Héros", () => {
    const hero = makeHero("h");
    const agi: CardKeywordInfo = { name: "Agilité", description: "" };
    const agr: CardKeywordInfo = { name: "Agressivité", description: "" };
    hero.recto.keywords = [agi];
    hero.verso!.keywords = [agr];
    expect(combatKeywords(hero, "recto").agilite).toBe(true);
    expect(combatKeywords(hero, "recto").agressivite).toBe(false);
    expect(combatKeywords(hero, "verso").agressivite).toBe(true);
    expect(combatKeywords(hero, "verso").agilite).toBe(false);
  });
});

describe("keyword-combat-wiring — Agressivité (mal d'invocation)", () => {
  it("un Allié arrivé CE tour avec Agressivité est attaquant éligible", () => {
    const f = fixture([
      withKeyword("agr", "Agressivité"),
      makeAlly("frais"), // témoin sans mot-clé
    ]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 3 }); // arrivé ce tour
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 3 });
    const attackers = eligibleAttackers(ctxOf(f), "A");
    expect(attackers).toContain(instId("A", 0)); // Agressivité → bypass
    expect(attackers).not.toContain(instId("A", 1)); // témoin → mal d'invocation
  });

  it("Agressivité ne lève QUE le mal d'invocation (autres contraintes actives)", () => {
    const f = fixture([withKeyword("agr", "Agressivité")]);
    setTurn(f, "A", 3);
    // incliné : reste exclu malgré Agressivité (orientation, 703)
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 3, tapped: true });
    expect(eligibleAttackers(ctxOf(f), "A")).not.toContain(instId("A", 0));
  });

  it("sans Agressivité, le mal d'invocation reste appliqué (régression)", () => {
    const f = fixture([makeAlly("vieux"), makeAlly("frais")]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 2 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 3 });
    const attackers = eligibleAttackers(ctxOf(f), "A");
    expect(attackers).toContain(instId("A", 0));
    expect(attackers).not.toContain(instId("A", 1));
  });
});

describe("keyword-combat-wiring — Agilité (légalité de blocage)", () => {
  function blockFixture(attacker: AllyCard) {
    // défenseur B : un bloqueur SANS Agilité + un bloqueur AVEC Agilité
    const f = fixture(
      [attacker],
      [makeAlly("normal", { force: 2 }), withKeyword("agile", "Agilité", 2)],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0)); // bloqueur sans Agilité
    bringToMonde(f, "B", instId("B", 1)); // bloqueur avec Agilité
    return f;
  }

  it("attaquant Agilité → seuls les bloqueurs Agilité sont éligibles", () => {
    const f = blockFixture(withKeyword("atk", "Agilité", 2));
    const blockers = eligibleBlockers(
      ctxOf(f),
      "B",
      { kind: "hero", instanceId: HERO_B },
      instId("A", 0),
    );
    expect(blockers).not.toContain(instId("B", 0)); // sans Agilité → exclu
    expect(blockers).toContain(instId("B", 1)); // avec Agilité → inclus
  });

  it("attaquant SANS Agilité → tous les bloqueurs normaux sont éligibles", () => {
    const f = blockFixture(makeAlly("atk", { force: 2 }));
    const blockers = eligibleBlockers(
      ctxOf(f),
      "B",
      { kind: "hero", instanceId: HERO_B },
      instId("A", 0),
    );
    expect(blockers).toContain(instId("B", 0));
    expect(blockers).toContain(instId("B", 1));
  });

  it("attaquant non précisé (null) → pas de filtre Agilité (rétro-compat)", () => {
    const f = blockFixture(withKeyword("atk", "Agilité", 2));
    const blockers = eligibleBlockers(ctxOf(f), "B", {
      kind: "hero",
      instanceId: HERO_B,
    });
    expect(blockers).toContain(instId("B", 0));
    expect(blockers).toContain(instId("B", 1));
  });

  it("un Héros attaquant possédant Agilité filtre aussi les bloqueurs", () => {
    // Héros A (recto) avec Agilité attaque ; B a un bloqueur sans / avec Agilité
    const heroA = makeHero("hAg");
    const agi: CardKeywordInfo = { name: "Agilité", description: "" };
    heroA.recto.keywords = [agi];
    const f = fixture(
      [],
      [makeAlly("normal", { force: 2 }), withKeyword("agile", "Agilité", 2)],
      { heroA },
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    const blockers = eligibleBlockers(
      ctxOf(f),
      "B",
      { kind: "hero", instanceId: HERO_B },
      HERO_A,
    );
    expect(blockers).not.toContain(instId("B", 0));
    expect(blockers).toContain(instId("B", 1));
  });
});
