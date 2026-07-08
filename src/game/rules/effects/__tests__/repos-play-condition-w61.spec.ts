/**
 * Vague W61 (deck-driven, starter Incarnam Repos) — RESTRICTION DE JEU +
 * réutilisation du COÛT VARIABLE X (W60).
 *
 * Repos : « Votre Héros regagne X PV. Ne jouez cette carte que si votre Héros se
 * trouve dans son Havre-Sac. » (Action à « Niveau : X » — scriptée CARD_SCRIPTS :
 * costPayX + heroGainPv{fromCount} + playCondition heroInZone).
 *
 * Deux volets :
 *  1) playCondition (heroInZone) — restriction de JEU évaluée au play-time
 *     (whyCannotPlay) : la carte n'est jouable que si le Héros est dans la zone.
 *  2) costPayX + heroGainPv{fromCount} — payer X (incliner X producteurs) soigne
 *     X PV au Héros.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard } from "tests/factories/card";
import { whyCannotPlay } from "@/game/rules/legality";
import {
  bringToHand,
  ctxOf,
  fixture,
  instId,
  setTurn,
} from "../../__tests__/harness";
import {
  makeEffectSandbox,
  placeInZone,
} from "@/stores/__tests__/effectPipeline.harness";

// ── Volet 1 : playCondition (heroInZone) au play-time ────────────────────────
function actionWithCondition(id: string, zone: "monde" | "havreSac"): Card {
  return createMockActionCard({
    id,
    name: `Action ${id}`,
    effects: [
      {
        description: "…",
        compiled: {
          trigger: "onPlay",
          playCondition: { cond: "heroInZone", zone },
          ops: [{ op: "draw", n: 1 }],
        },
      },
    ],
  }) as Card;
}

describe("playCondition heroInZone — restriction de jeu (whyCannotPlay)", () => {
  it("Héros dans son Havre-Sac (défaut) : condition heroInZone:havreSac REMPLIE → pas bloquée", () => {
    const f = fixture([actionWithCondition("cond-sac", "havreSac")]);
    setTurn(f, "A", 3);
    bringToHand(f, "A", instId("A", 0));
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBeNull();
  });

  it("condition heroInZone:monde NON remplie (Héros en Havre-Sac) → jeu refusé", () => {
    const f = fixture([actionWithCondition("cond-monde", "monde")]);
    setTurn(f, "A", 3);
    bringToHand(f, "A", instId("A", 0));
    expect(whyCannotPlay(ctxOf(f), "A", instId("A", 0))).toBe(
      "Votre Héros doit être dans le Monde pour jouer cette carte.",
    );
  });
});

// ── Volet 2 : costPayX + heroGainPv{fromCount} (le soin en X) ─────────────────
describe("costPayX + heroGainPv{fromCount} — Repos soigne X PV", () => {
  it("payer X=2 → le Héros regagne 2 PV (compteur hp)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    // deux producteurs dressés + une source
    const p1 = placeInZone(store, "A", { zone: "monde" });
    const p2 = placeInZone(store, "A", { zone: "monde" });
    const src = placeInZone(store, "A", { zone: "monde" });
    const heroId = store.state.seats.A.heroInstanceId!;
    // Le soin est PLAFONNÉ au PV max : on blesse d'abord le Héros, sinon (au max)
    // il ne regagne rien et le gain de X PV ne serait pas observable.
    store.enqueueEffect({
      seat: "A",
      cardName: "blessure",
      ops: [{ op: "heroLosePv", n: 6 }],
    });
    const hp0 = store.state.instances[heroId].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "Repos",
      sourceId: src,
      ops: [{ op: "costPayX" }, { op: "heroGainPv", n: 0, fromCount: true }],
    });
    // coût variable X : incline deux producteurs puis s'arrête (X=2)
    expect(store.effectTargeting?.op.op).toBe("costPayX");
    store.effectTargetChoose(p1);
    store.effectTargetChoose(p2);
    store.effectTargetSkip();
    expect((store.state.instances[heroId].counters.hp ?? 0) - hp0).toBe(2);
  });

  it("payer X=0 (s'arrêter d'emblée) → aucun soin (no-op fidèle)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const src = placeInZone(store, "A", { zone: "monde" });
    const heroId = store.state.seats.A.heroInstanceId!;
    const hp0 = store.state.instances[heroId].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "Repos",
      sourceId: src,
      ops: [{ op: "costPayX" }, { op: "heroGainPv", n: 0, fromCount: true }],
    });
    store.effectTargetSkip(); // X=0
    expect((store.state.instances[heroId].counters.hp ?? 0) - hp0).toBe(0);
  });
});
