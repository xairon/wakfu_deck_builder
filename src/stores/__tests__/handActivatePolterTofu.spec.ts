/**
 * Vague W66 (deck-driven, starter Incarnam Polter Tofu) — POUVOIR ACTIVÉ DEPUIS
 * LA MAIN + mise-en-jeu-de-soi.
 *
 * Polter Tofu : « Détruisez un de vos Tofus : Mettez en jeu le Polter Tofu
 * gratuitement de votre main. Il apparaît incliné. » (pouvoir onHandActivate).
 * Op `putSelfInPlay{tapped}` : la source, EN MAIN, se met elle-même en jeu
 * (Monde), inclinée. activateTapPower route les cartes EN MAIN portant un
 * pouvoir onHandActivate.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const POLTER: Card = createMockAllyCard({
  id: "polter-test",
  name: "Polter Tofu",
  subTypes: ["Monstre", "Polter", "Tofu"],
  effects: [
    {
      description:
        "Détruisez un de vos Tofus : Mettez en jeu le Polter Tofu gratuitement de votre main. Il apparaît incliné.",
      compiled: {
        trigger: "onHandActivate",
        cost: "paidOps",
        ops: [
          {
            op: "costDestroyControlled",
            sub: "tofu",
            excludeSource: true,
            zones: ["monde", "havreSac"],
          },
          { op: "putSelfInPlay", tapped: true },
        ],
      },
    },
  ],
});

const TOFU: Card = createMockAllyCard({
  id: "tofu-test",
  name: "Tofu",
  subTypes: ["Monstre", "Tofu"],
});

function setup(withTofu: boolean) {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [POLTER, TOFU],
  });
  // Polter Tofu EN MAIN.
  const polterId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[polterId].cardId = "polter-test";
  let tofuId: string | null = null;
  if (withTofu) {
    tofuId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[tofuId].cardId = "tofu-test";
  }
  return { store, polterId, tofuId };
}

describe("Polter Tofu — activation depuis la main", () => {
  it("détruit un Tofu → Polter entre en jeu incliné (depuis la main)", () => {
    const { store, polterId, tofuId } = setup(true);
    expect(store.hasHandPower(polterId)).toBe(true);
    expect(store.activateTapPower(polterId)).toBe(true);
    // le coût cible le Tofu à détruire (picker, ou auto-résolu si cible unique).
    if (store.effectTargeting) {
      expect(store.effectTargeting.op.op).toBe("costDestroyControlled");
      store.effectTargetChoose(tofuId!);
    }
    // Tofu détruit (→ Défausse), Polter en jeu incliné.
    expect(store.state.instances[tofuId!].location.zone).toBe("defausse");
    expect(store.state.instances[polterId].location.zone).toBe("monde");
    expect(store.state.instances[polterId].orientation).toBe("tapped");
  });

  it("aucun Tofu à détruire : coût impayable → Polter reste en main", () => {
    const { store, polterId } = setup(false);
    expect(store.activateTapPower(polterId)).toBe(true); // enfilé, mais…
    // …aucune cible pour le coût → effet abandonné, Polter reste en main.
    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[polterId].location.zone).toBe("main");
  });
});
