/**
 * Vague W47 (deck-driven, starter Incarnam Dollarawan) — CONDITIONNEL OPTIONNEL
 * « Au début de votre tour, si <cond>, vous POUVEZ <corps> ». La condition GARDE
 * l'offre : quand elle est vraie, le corps est PROPOSÉ (effectChoices Oui/Non),
 * pas exécuté d'office ; quand elle est fausse, aucune proposition (pas de prompt
 * inutile). Flag `optional` sur l'op `conditional`. STRICT : optionnel
 * multi-phrases (« … Si vous le faites, … ») reste manuel.
 */
import { describe, it, expect } from "vitest";
import { compileTurnStartEffectText } from "@/game/rules";

describe("DSL — conditional optionnel (compileTurnStartEffectText)", () => {
  it("Dollarawan : « … si <self> dans votre Havre Sac, vous pouvez piocher une carte »", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si Dollarawan le Banquier se trouve dans votre Havre Sac, vous pouvez piocher une carte.",
      "Dollarawan le Banquier",
    );
    expect(c).toEqual({
      trigger: "onTurnStart",
      ops: [
        {
          op: "conditional",
          cond: { cond: "selfInZone", zone: "havreSac" },
          optional: true,
          ops: [{ op: "draw", n: 1 }],
        },
      ],
    });
  });

  it("RÉGRESSION : conditionnel NON optionnel (« … si <self> dans le Monde, Piochez … ») inchangé", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si le Machin est dans le Monde, piochez une carte.",
      "Machin",
    );
    expect(c?.ops).toEqual([
      {
        op: "conditional",
        cond: { cond: "selfInZone", zone: "monde" },
        ops: [{ op: "draw", n: 1 }],
      },
    ]);
    // pas de flag optional quand « vous pouvez » est absent
    expect((c?.ops[0] as { optional?: boolean }).optional).toBeUndefined();
  });

  it("STRICT : optionnel MULTI-PHRASES sous condition reste manuel (null)", () => {
    // « … vous pouvez X. Si vous le faites, Y » — le nested « si vous le faites »
    // n'est pas modélisé → manuel.
    expect(
      compileTurnStartEffectText(
        "Au début de votre tour, si le Truc est dans le Monde, vous pouvez piocher une carte. Si vous le faites, votre Héros perd 1 PV.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("STRICT : condition « dans votre Défausse » reste manuelle (onTurnStart ne scanne pas la Défausse)", () => {
    expect(
      compileTurnStartEffectText(
        "Au début de votre tour, si le Bidule se trouve dans votre Défausse, vous pouvez piocher une carte.",
        "Bidule",
      ),
    ).toBeNull();
  });
});
