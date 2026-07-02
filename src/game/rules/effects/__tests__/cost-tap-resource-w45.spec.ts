/**
 * Vague W45 (deck-driven, starters Incarnam) — SOUS-SYSTÈME RESSOURCES, incrément
 * 1 : coût « payer une Ressource » (op `costTapResource`) + le Smare.
 *
 * Modèle SANS POOL (fidèle au rulebook 4261, cf. resources.ts) : « produire une
 * Ressource » = avoir une carte contrôlée DRESSÉE (Monde/Havre-Sac, sauf
 * Protecteur) ; « payer une Ressource » = l'INCLINER. `costTapResource` réutilise
 * donc `resourceProducers` verbatim (même éligibilité que le coût de lancement,
 * planCost) — aucune seconde source de vérité, aucune mutation d'état hormis
 * SET_ORIENTATION.
 *
 * Deux volets :
 *  1) DSL — « Quand <self> apparaît, vous pouvez payer pour piocher une carte »
 *     (Smare) → onArrive, optional, ops [costTapResource, draw]. Le « payer pour »
 *     est STRICT : si le corps ne compile pas, l'effet reste manuel.
 *  2) effectTargetIds — éligibilité = producteurs (Héros + Havre-Sac + Alliés
 *     dressés), DÉDUPLIQUÉE (le bonus Havre-Sac tour 2 émet un doublon d'id), et
 *     filtrable par Élément (capacité latente).
 */
import { describe, it, expect } from "vitest";
import { compileEffectText, effectTargetIds } from "@/game/rules";
import {
  HERO_A,
  SAC_A,
  HERO_B,
  SAC_B,
  ctxOf,
  fixture,
  bringToMonde,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — costTapResource (« payer pour … »)", () => {
  it("Smare : « Quand le smare apparaît, vous pouvez payer pour piocher une carte. »", () => {
    const c = compileEffectText(
      "Quand le smare apparaît, vous pouvez payer pour piocher une carte.",
      "Smare",
      "Neutre",
    );
    expect(c?.trigger).toBe("onArrive");
    // « vous pouvez » → optionnel ; le corps = coût payé (costTapResource) + pioche.
    expect(c?.optional).toBe(true);
    expect(c?.ops).toEqual([{ op: "costTapResource" }, { op: "draw", n: 1 }]);
  });

  it("STRICT : « payer pour <corps non mappé> » reste MANUEL (aucun coût encodé seul)", () => {
    // « Ajoutez un Ether … » n'est pas encodable → compileBody renvoie null → tout
    // l'effet reste uncovered (jamais de costTapResource orphelin).
    expect(
      compileEffectText(
        "Quand le smare apparaît, vous pouvez payer pour ajouter un Ether sur le Smare.",
        "Smare",
        "Neutre",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : éligibilité (resourceProducers) ────────────────────────────────
describe("effectTargetIds — costTapResource (producteurs)", () => {
  const RESOURCE_OP = { op: "costTapResource" as const };

  it("éligibles = tous les producteurs dressés contrôlés (Héros + Havre-Sac + Allié)", () => {
    const f = fixture([makeAlly("mien", { element: "Feu" })]);
    bringToMonde(f, "A", instId("A", 0)); // un Allié de A en jeu, dressé
    const eligible = effectTargetIds(ctxOf(f), RESOURCE_OP, "A");
    expect(eligible.sort()).toEqual([HERO_A, SAC_A, instId("A", 0)].sort());
  });

  it("ne rend PAS éligibles les producteurs adverses", () => {
    const f = fixture([]);
    const eligible = effectTargetIds(ctxOf(f), RESOURCE_OP, "A");
    expect(eligible).not.toContain(HERO_B);
    expect(eligible).not.toContain(SAC_B);
  });

  it("DÉDUPLICATION 2342 : au 1er tour du 2ᵉ joueur, le Havre-Sac (doublé) n'apparaît qu'UNE fois", () => {
    const f = fixture([]); // firstPlayer = A
    setTurn(f, "B", 2); // premier tour de B → Havre-Sac de B vaut deux Ressources
    const eligible = effectTargetIds(ctxOf(f), RESOURCE_OP, "B");
    // resourceProducers émet SAC_B en double ; le ciblage ne le propose qu'une fois
    // (on ne peut incliner qu'une carte réelle une seule fois).
    expect(eligible.filter((id) => id === SAC_B)).toHaveLength(1);
    expect(eligible).toContain(HERO_B);
  });

  it("filtre d'Élément : « payer une Ressource [Feu] » n'éligibilise que les producteurs Feu", () => {
    const f = fixture([]); // Héros A = Feu, Havre-Sac A = Neutre
    const feu = effectTargetIds(
      ctxOf(f),
      { op: "costTapResource", element: "Feu" },
      "A",
    );
    expect(feu).toContain(HERO_A); // Feu → éligible
    expect(feu).not.toContain(SAC_A); // Neutre → exclu
  });

  it("une carte inclinée n'est plus un producteur (elle n'est pas proposée)", () => {
    const f = fixture([makeAlly("mien", { element: "Feu" })]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true }); // Allié incliné
    const eligible = effectTargetIds(ctxOf(f), RESOURCE_OP, "A");
    expect(eligible).not.toContain(instId("A", 0));
  });
});
