/**
 * Intégration store (W72) — système de MÉTIER / Amar Casto « gagne le Métier de
 * votre choix jusqu'à la fin du tour ». Le chooseOne à 4 branches pose, sur la
 * branche choisie, un jeton TURN-scoped `metier_<métier>` (setMetierSelf) sur la
 * SOURCE, qui devient Artisan (metierOf / condSpec selfIsArtisan). Le jeton est
 * purgé en fin de tour (préfixe metier_).
 */
import { describe, it, expect } from "vitest";
import { metierOf, metierToken } from "@/game/rules/effects/keywords";
import { isTurnToken } from "@/game/rules/effects/limits";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const METIER_CHOICE = [
  {
    op: "chooseOne" as const,
    prompt: "Amar Casto gagne le Métier de votre choix.",
    options: (["Forgeron", "Armurier", "Bijoutier", "Bricoleur"] as const).map(
      (metier) => ({
        label: metier,
        ops: [{ op: "setMetierSelf" as const, metier }],
      }),
    ),
  },
];

describe("Amar Casto — octroi de Métier (Artisan)", () => {
  it("l'overlay expose les 4 Métiers ; la sélection pose le jeton et rend la source Artisan", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const src = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Amar Casto",
      sourceId: src,
      ops: METIER_CHOICE,
    });
    expect(store.effectChoice?.options?.map((o) => o.label)).toEqual([
      "Forgeron",
      "Armurier",
      "Bijoutier",
      "Bricoleur",
    ]);

    store.effectChoiceSelect(2); // Bijoutier
    expect(store.effectChoice).toBeNull();

    const inst = store.state.instances[src];
    expect(inst.counters.tokens?.[metierToken("Bijoutier")]).toBe(1);
    // possession lue par metierOf → Artisan.
    expect(metierOf(inst, { subTypes: [] })).toEqual(["Bijoutier"]);
  });

  it("le jeton de Métier est TURN-scoped (purgé en fin de tour)", () => {
    expect(isTurnToken(metierToken("Forgeron"))).toBe(true);
  });

  it("sans octroi ni subType Métier : la source n'est pas Artisan", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const src = placeInZone(store, "A", { zone: "monde" });
    const inst = store.state.instances[src];
    expect(metierOf(inst, { subTypes: [] })).toEqual([]);
  });

  it("un Métier inné (subType) rend Artisan sans octroi", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const src = placeInZone(store, "A", { zone: "monde" });
    const inst = store.state.instances[src];
    expect(metierOf(inst, { subTypes: ["Forgeron"] })).toEqual(["Forgeron"]);
  });

  it("subType Métier à la casse variable (données scrapées) est reconnu et canonisé", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const src = placeInZone(store, "A", { zone: "monde" });
    const inst = store.state.instances[src];
    // « forgeron » minuscule (scrape) → détecté, stocké sous la forme canonique.
    expect(metierOf(inst, { subTypes: ["forgeron"] })).toEqual(["Forgeron"]);
  });
});
