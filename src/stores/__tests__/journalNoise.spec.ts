/**
 * UX du journal (audit table 2026-07) — la comptabilité INTERNE du moteur
 * (jetons de récence recentPlayX et recentQuestParch, verrous oncePlayed_ et
 * powerUses, marqueurs justAppeared/justInclined/arrivedTurn, sacBonusUsed)
 * ne doit JAMAIS apparaître dans le journal : jouer une carte écrit ces
 * jetons à chaque fois (« ajuste « recentPlayAllie » » ×5 par carte = bruit).
 * Les ajustements MANUELS de compteurs des joueurs restent visibles.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

describe("journal — pas de comptabilité interne", () => {
  it("jouer une carte n'émet AUCUNE ligne « ajuste » de jeton interne", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    // Passer le 1er tour (506.3 force le Havre-Sac mais reste jouable).
    store.endTurn();
    store.endTurn();
    const id = placeInZone(store, "A", { zone: "main", owner: "A" });
    expect(store.playFromHand(id)).toBe(true);

    const noise = store.log
      .map((l) => l.text)
      .filter((t) =>
        /recentPlay|recentQuestParch|oncePlayed_|powerUses|arrivedTurn|justAppeared|justInclined|sacBonusUsed/.test(
          t,
        ),
      );
    expect(noise).toEqual([]);
  });

  it("un ajustement MANUEL de compteur reste visible dans le journal", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.adjustCounter(id, "pv", -2);
    const lines = store.log.map((l) => l.text);
    expect(lines.some((t) => /pv|compteur|ajuste/i.test(t))).toBe(true);
  });
});
