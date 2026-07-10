/**
 * Vague W80 — les 4 Blops (Coco/Griotte/Indigo/Reinette, texte identique) :
 * « Quand le Blop <X> apparaît, vous pouvez révéler les trois premières cartes
 * de votre Pioche. Si un Allié de Niveau 1 est révélé de cette manière, vous
 * pouvez le mettre en jeu gratuitement, incliné. Recyclez les autres cartes. »
 *
 * → onArrive optionnel + UN op `revealTopPutInPlay` (corps MULTI-PHRASES
 * apparié en bloc par compileBody) : révèle le top 3 (public), pick OPTIONNEL
 * parmi les révélées filtré Allié Niveau 1 (entre en jeu gratuitement,
 * incliné), le reste recyclé SOUS la Pioche — y compris si le joueur passe.
 */
import { describe, it, expect } from "vitest";
import { compileEffectText } from "../dsl";

describe("revealTopPutInPlay — DSL (4 Blops)", () => {
  it("compile le corps multi-phrases en un op unique (onArrive optionnel)", () => {
    const c = compileEffectText(
      "Quand le Blop Coco apparaît, vous pouvez révéler les trois premières cartes de votre Pioche. Si un Allié de Niveau 1 est révélé de cette manière, vous pouvez le mettre en jeu gratuitement, incliné. Recyclez les autres cartes.",
      "Blop Coco",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        {
          op: "revealTopPutInPlay",
          n: 3,
          what: "Allié",
          exactLevel: 1,
          tapped: true,
        },
      ],
    });
  });

  it("variante non couverte (Niveau ≤ / autre reste) → manuel", () => {
    expect(
      compileEffectText(
        "Quand le Blop Testeur apparaît, vous pouvez révéler les trois premières cartes de votre Pioche. Si un Allié de Niveau 1 est révélé de cette manière, vous pouvez le mettre en jeu gratuitement, incliné. Remettez les autres cartes dans l'ordre de votre choix.",
        "Blop Testeur",
      ),
    ).toBeNull();
  });
});
