/**
 * Vague W77 — Tainéla, le Berceau (astrub, Zone) : « Réaction. [Incliner] :
 * L'Allié Bouftou qui vient d'apparaître dans le Monde gagne +1 en Force et
 * Agressivité jusqu'à la fin du tour. » (pouvoir à inclinaison).
 *
 * (1) Préfixe « Réaction. » sur un POUVOIR à inclinaison : la permission
 *     « utilisable en réaction » est DÉJÀ accordée par le moteur (fenêtre
 *     706.5 dans activateTapPower, chemins paidOps et défaut) → préfixe
 *     strippé, AUCUN flag (≠ Actions : reactionOnly restreint le JEU).
 * (2) Corps sans « de votre choix » : « L'Allié <Famille> qui vient
 *     d'apparaître [dans le Monde] gagne +N en Force [et <Mot-clé>] … » →
 *     buffForceTarget + sub + recentlyAppeared (jeton justAppeared, W74).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";

describe("Tainéla — préfixe Réaction. + buff de l'apparu (DSL)", () => {
  it("compile le pouvoir entier (préfixe strippé, [Incliner] absorbé)", () => {
    const c = compileTapEffectText(
      "Réaction. [Incliner] : L'Allié Bouftou qui vient d'apparaître dans le Monde gagne +1 en Force et Agressivité jusqu'à la fin du tour.",
      "Tainéla, le Berceau",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 1,
          heroes: false,
          sub: "bouftou",
          recentlyAppeared: true,
          alsoKeyword: "Agressivité",
          zones: ["monde"],
        },
      ],
    });
  });

  it("famille hors allowlist / mot-clé non câblé → manuel", () => {
    expect(
      compileTapEffectText(
        "Réaction. [Incliner] : L'Allié Machin qui vient d'apparaître dans le Monde gagne +1 en Force et Agressivité jusqu'à la fin du tour.",
        "X de Test",
        undefined,
        false,
        true,
      ),
    ).toBeNull();
    expect(
      compileTapEffectText(
        "Réaction. [Incliner] : L'Allié Bouftou qui vient d'apparaître dans le Monde gagne +1 en Force et Fantôme jusqu'à la fin du tour.",
        "X de Test",
        undefined,
        false,
        true,
      ),
    ).toBeNull();
  });

  it("le préfixe « Réaction. » n'est PAS strippé sur une Action (reste manuel ici)", () => {
    // Sur une Action, « Réaction » = restriction de jeu (reactionOnly, gérée
    // par CARD_SCRIPTS au cas par cas — Flèche, Échec Critique) : le strip
    // W77 est réservé aux pouvoirs à inclinaison (requiresIncline).
    expect(
      compileTapEffectText(
        "Réaction. Piochez une carte.",
        "X de Test",
        undefined,
        true,
        false,
      ),
    ).toBeNull();
  });
});
