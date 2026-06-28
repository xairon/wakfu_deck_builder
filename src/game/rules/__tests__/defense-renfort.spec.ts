/**
 * Moteur de règles — mots-clés de TIMING de jeu Défense / Renfort.
 *
 * Glossaire :
 * - Défense : « Un Allié jouable durant la Phase d'Actions d'un combat si son
 *   contrôleur est le défenseur ; il est placé comme bloqueur. »
 * - Renfort : « Un Allié jouable pendant la phase d'actions d'un combat où son
 *   propriétaire est le joueur attaquant, et que son Héros est attaquant dans ce
 *   combat. »
 *
 * Vérifie que `whyCannotPlay` RELÂCHE la barrière tour/phase UNIQUEMENT pour le
 * bon rôle, sans toucher aux autres contraintes (coût, premier tour, main).
 */
import { describe, expect, it } from "vitest";
import { whyCannotPlay } from "../legality";
import { combatKeywords } from "../effects/keywords";
import {
  HERO_A,
  bringToHand,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  setCombatState,
  setTurn,
} from "./harness";

describe("rules/legality — Défense (timing défenseur)", () => {
  function defenseFixture() {
    // A possède un Allié Défense en main ; c'est le tour de B (B attaque A).
    const f = fixture([
      makeAlly("def", { niveau: 1, element: "Feu", defense: true }),
    ]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "B", 3); // tour de B → A est hors-tour
    return f;
  }

  it("interdit hors combat (hors-tour, pas de fenêtre Défense)", () => {
    const f = defenseFixture();
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBe(
      "Ce n'est pas votre tour.",
    );
  });

  it("autorise le défenseur à jouer un Allié Défense pendant un combat", () => {
    const f = defenseFixture();
    setCombatState(f, "B"); // B attaque → A est le défenseur
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
  });

  it("n'autorise PAS Défense pour l'ATTAQUANT (mauvais rôle, hors-tour)", () => {
    // A est l'ATTAQUANT d'un combat mais on évalue hors de son tour (tour de B) :
    // la fenêtre Défense ne s'ouvre que pour le DÉFENSEUR, donc A reste bloqué.
    const f = fixture([
      makeAlly("def", { niveau: 1, element: "Feu", defense: true }),
    ]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "B", 3); // tour de B → A hors-tour
    setCombatState(f, "A"); // A attaque → A n'est PAS le défenseur
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBe(
      "Ce n'est pas votre tour.",
    );
  });

  it("garde les autres contraintes : coût impayable refusé même en fenêtre Défense", () => {
    // Allié Défense de niveau 5 (coût 5) sans aucune ressource → refus de coût.
    const f = fixture([
      makeAlly("def", { niveau: 5, element: "Feu", defense: true }),
    ]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "B", 3);
    setCombatState(f, "B"); // A est défenseur → fenêtre ouverte
    const reason = whyCannotPlay(ctxOf(f), "A", instId("A", 0));
    expect(reason).not.toBeNull();
    expect(reason).not.toBe("Ce n'est pas votre tour.");
  });
});

describe("rules/legality — Renfort (timing attaquant avec Héros attaquant)", () => {
  it("autorise l'attaquant à jouer un Renfort quand SON Héros attaque", () => {
    const f = fixture([
      makeAlly("renf", { niveau: 1, element: "Feu", renfort: true }),
    ]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "A", 3);
    setCombatState(f, "A", { attackers: [HERO_A] }); // Héros de A attaque
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
  });

  it("n'autorise PAS Renfort hors-tour pour le défenseur", () => {
    const f = fixture(
      [],
      [makeAlly("renf", { niveau: 1, element: "Eau", renfort: true })],
    );
    bringToHand(f, "B", instId("B", 0));
    setTurn(f, "A", 3);
    setCombatState(f, "A", { attackers: [HERO_A] }); // A attaque, B est défenseur
    expect(whyCannotPlay(ctxOf(f), "B", instId("B", 0))).toBe(
      "Ce n'est pas votre tour.",
    );
  });

  it("n'autorise PAS Renfort si le Héros de l'attaquant N'attaque PAS (Allié seul)", () => {
    // A attaque avec un Allié (pas son Héros) → Renfort n'ouvre pas la fenêtre.
    // Ici on teste hors-tour pour isoler la fenêtre : tour de B, A est l'attaquant
    // d'un combat où seul un Allié attaque.
    const ally = makeAlly("atk", { niveau: 1, element: "Feu" });
    const renf = makeAlly("renf", { niveau: 1, element: "Feu", renfort: true });
    const f = fixture([ally, renf]);
    bringToHand(f, "A", instId("A", 1)); // le Renfort
    setTurn(f, "B", 3); // tour de B → A hors-tour
    // combat où A attaque avec un Allié (instId A,0), PAS son Héros.
    setCombatState(f, "A", { attackers: [instId("A", 0)] });
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 1))).toBe(
      "Ce n'est pas votre tour.",
    );
  });

  it("Renfort sans combat ne relâche rien (hors-tour interdit)", () => {
    const f = fixture([
      makeAlly("renf", { niveau: 1, element: "Feu", renfort: true }),
    ]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "B", 3);
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBe(
      "Ce n'est pas votre tour.",
    );
  });
});

describe("rules/legality — régression cartes sans mot-clé de timing", () => {
  it("un Allié ordinaire reste interdit hors-tour même pendant un combat", () => {
    const f = fixture([makeAlly("plain", { niveau: 1, element: "Feu" })]);
    bringToHand(f, "A", instId("A", 0));
    setTurn(f, "B", 3);
    setCombatState(f, "B"); // A est défenseur, mais l'Allié n'a pas Défense
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBe(
      "Ce n'est pas votre tour.",
    );
  });
});

describe("rules/effects/keywords — combatKeywords defense/renfort", () => {
  it("calcule defense=true pour un Allié Défense, false sinon", () => {
    expect(combatKeywords(makeAlly("d", { defense: true })).defense).toBe(true);
    expect(combatKeywords(makeAlly("d", {})).defense).toBe(false);
  });

  it("calcule renfort=true pour un Allié Renfort, false sinon", () => {
    expect(combatKeywords(makeAlly("r", { renfort: true })).renfort).toBe(true);
    expect(combatKeywords(makeAlly("r", {})).renfort).toBe(false);
  });

  it("un Allié ordinaire a defense=false et renfort=false", () => {
    const kw = combatKeywords(makeAlly("p", {}));
    expect(kw.defense).toBe(false);
    expect(kw.renfort).toBe(false);
  });
});
