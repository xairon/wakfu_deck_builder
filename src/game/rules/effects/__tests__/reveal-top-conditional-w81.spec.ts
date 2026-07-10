/**
 * Vague W81 — RÉVÈLE/DÉFAUSSE LE DESSUS + CONDITIONNEL (op unique
 * `revealTopConditional`, non-interactif) :
 *  - mode "discardDraw" (Alysse [Air] / Chauchane [Eau] / Grine Piz [Feu] /
 *    Alplaïa [Terre] — Éléments RÉCUPÉRÉS des pages brutes, icônes droppées) :
 *    « défausser la carte du dessus de votre Pioche. S'il s'agit d'une carte
 *    [Élém], piochez une carte. »
 *  - mode "takeElse" (Hilary Goll ; Berlanette ×2 depuis le DESSOUS) :
 *    « révéler la carte du dessus/dessous. S'il s'agit d'un <Types>,
 *    prenez-la en main. Sinon, recyclez-la / mettez-la dans votre Défausse. »
 * Corps MULTI-PHRASES à opération unique → compileWholeBodyBlock (W80).
 */
import { describe, it, expect } from "vitest";
import { compileEffectText } from "../dsl";

describe("revealTopConditional — DSL", () => {
  it("Alysse : défausse-top + si [Air] → pioche (discardDraw)", () => {
    const c = compileEffectText(
      "Quand Alysse apparaît, vous pouvez défausser la carte du dessus de votre Pioche. S'il s'agit d'une carte [Air], piochez une carte.",
      "Alysse",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "revealTopConditional", mode: "discardDraw", element: "Air" },
      ],
    });
  });

  it("Alplaïa : variante « Si la carte défaussé est une carte [Terre] » + typo défaussez", () => {
    const c = compileEffectText(
      "Quand Alplaïa Vamos apparaît, vous pouvez défaussez la carte du dessus de votre Pioche. Si la carte défaussé est une carte [Terre], piochez une carte.",
      "Alplaïa Vamos",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "revealTopConditional", mode: "discardDraw", element: "Terre" },
      ],
    });
  });

  it("Hilary Goll : révèle-top + Équipement → main, sinon recycle (takeElse)", () => {
    const c = compileEffectText(
      "Quand Hilary Goll apparaît, vous pouvez révéler la carte du dessus de votre Pioche. S'il s'agit d'un Équipement, prenez cette carte en main. Sinon, recyclez-la.",
      "Hilary Goll",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        {
          op: "revealTopConditional",
          mode: "takeElse",
          whatIn: ["Équipement"],
          otherwise: "recycle",
        },
      ],
    });
  });

  it("Berlanette : DESSOUS + Allié ou Équipement → main, sinon Défausse", () => {
    const c = compileEffectText(
      "Quand Berlanette Chichi apparaît, vous pouvez révéler la carte du dessous de votre Pioche. S'il s'agit d'un Allié ou d'un Équipement, prenez-la en main. Sinon, mettez-la dans votre Défausse.",
      "Berlanette Chichi",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        {
          op: "revealTopConditional",
          from: "bottom",
          mode: "takeElse",
          whatIn: ["Allié", "Équipement"],
          otherwise: "discard",
        },
      ],
    });
  });

  it("conséquence non couverte (« redressez … ») → manuel (Grouilleux)", () => {
    expect(
      compileEffectText(
        "Quand le Grouilleux Testeur apparaît, vous pouvez révéler la carte du dessus de votre Pioche. Si cette carte est un Grouilleux, prenez-la en main et redressez le Grouilleux Testeur. Sinon, recyclez-la.",
        "Grouilleux Testeur",
      ),
    ).toBeNull();
  });
});
