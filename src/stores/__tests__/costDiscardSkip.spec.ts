/**
 * COÛT DE DÉFAUSSE IMPOSÉ (E1) — « Défaussez une carte : CORPS ». Décliner le
 * coût (« Passer » sur le picker de défausse) doit ANNULER le pouvoir : le corps
 * ne s'exécute pas. Régression : le picker n'était pas marqué `cost`, donc
 * effectPickSkip laissait le corps tourner GRATIS (Bwork Mage infligeait sans
 * défausser ; Amulette Akwadala piochait sans défausser).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { makeEffectSandbox } from "./effectPipeline.harness";

describe("coût de défausse imposé — « Passer » annule le pouvoir (E1)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("décliner la défausse n'exécute pas le corps (pas de soin gratuit)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const heroA = store.state.seats.A.heroInstanceId!;
    store.draw("A", 2); // une carte à défausser dans la main
    // Blesse le Héros pour rendre un éventuel soin observable.
    store.adjustCounter(heroA, "hp", -3);
    const hpBefore = store.state.instances[heroA].counters.hp ?? 0;
    expect(store.state.seats.A.main.length).toBeGreaterThan(0); // main non vide

    store.enqueueEffect({
      seat: "A",
      cardName: "Amulette Akwadala (test)",
      ops: [
        { op: "costDiscard", n: 1 },
        { op: "heroGainPv", n: 2 },
      ],
    });
    // Le picker de défausse est ouvert (coût interactif).
    expect(store.effectPicking).not.toBeNull();
    expect(store.effectPicking?.action).toBe("discard");
    const handBefore = store.state.seats.A.main.length;

    // « Passer » : le coût N'EST PAS payé → le pouvoir est annulé.
    store.effectPickSkip();

    // Ni défausse, ni corps : PV inchangé, main inchangée, plus de picker.
    expect(store.state.instances[heroA].counters.hp ?? 0).toBe(hpBefore);
    expect(store.state.seats.A.main.length).toBe(handBefore);
    expect(store.effectPicking).toBeNull();
  });
});
