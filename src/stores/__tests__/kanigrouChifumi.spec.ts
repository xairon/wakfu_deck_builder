/**
 * Intégration store (W75) — KANIGROU : prévention pré-dégâts interactive via
 * mini-jeu Chi-Fu-Mi. « Quand sur le point de recevoir des Dommages, vous pouvez
 * jouer à Chi-Fu-Mi ; si vous gagnez, réduisez-les à 0, sinon détruisez-le. »
 * Intercepté à la résolution du COMBAT (doResolveCombat, dry-run pur) : le
 * contrôleur du Kanigrou décide de jouer (ou subir), puis pierre-feuille-ciseaux
 * déterministe contre l'adversaire. Borné : sans Kanigrou concerné, 0 changement.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

/** Kanigrou factice (Force 4, Air) avec le pouvoir de prévention Chi-Fu-Mi. */
const KANIGROU: Card = createMockAllyCard({
  id: "kani-test",
  name: "Kanigrou",
  stats: {
    niveau: { value: 2, element: "Air" },
    force: { value: 4, element: "Air" },
  },
  effects: [
    {
      description:
        "Quand sur le point de recevoir des Dommages, jouez à Chi-Fu-Mi…",
      compiled: { trigger: "static", ops: [{ op: "chifumiPrevention" }] },
    },
  ],
});

/** Attaquant Force 3 (< 4) : sans prévention, le Kanigrou SURVIT avec 3 Dommages. */
function attacker(id: string, force = 3): Card {
  return createMockAllyCard({
    id,
    name: id,
    stats: {
      niveau: { value: 2, element: "Feu" },
      force: { value: force, element: "Feu" },
    },
  });
}

/** Bloqueur Force 4 SANS le pouvoir Chi-Fu-Mi (survit à 3 Dommages, aucun mini-jeu). */
const PLAIN: Card = createMockAllyCard({
  id: "plain-test",
  name: "Bloqueur",
  stats: {
    niveau: { value: 2, element: "Air" },
    force: { value: 4, element: "Air" },
  },
});

function setupCombat(kaniCard = "kani-test") {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [KANIGROU, attacker("atk-test"), PLAIN],
  });
  store.state.turn.number = 3;
  const atk = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[atk].cardId = "atk-test";
  const kani = placeInZone(store, "B", { zone: "monde" });
  store.state.instances[kani].cardId = kaniCard;
  const heroB = store.state.seats.B.heroInstanceId!;
  // combat déclaré : atk attaque le Héros B, le Kanigrou (B) bloque atk.
  store.combat = {
    step: "blockers",
    target: { kind: "hero", instanceId: heroB },
    attackers: [atk],
    blocks: { [kani]: atk },
    strikes: {},
    strikeFor: null,
    ripostes: {},
    riposteFrom: null,
    riposteCandidates: [],
    pendingBlocker: null,
    reactingSeat: null,
  };
  return { store, atk, kani };
}

describe("Kanigrou — Chi-Fu-Mi (prévention pré-dégâts en combat)", () => {
  it("ouvre le mini-jeu quand le Kanigrou prendrait des Dommages", () => {
    const { store, kani } = setupCombat();
    store.combatResolve();
    expect(store.pendingChifumi?.kanigrouId).toBe(kani);
    expect(store.pendingChifumi?.phase).toBe("offer");
    expect(store.pendingChifumi?.controller).toBe("B");
  });

  it("GAGNÉ : les Dommages sont réduits à 0, le Kanigrou survit intact", () => {
    const { store, kani } = setupCombat();
    store.combatResolve();
    store.chifumiAccept();
    store.chifumiChoose("pierre"); // adversaire (A) engage
    store.chifumiChoose("feuille"); // contrôleur (B) : feuille bat pierre → gagné
    expect(store.pendingChifumi).toBeNull();
    expect(store.state.instances[kani].location.zone).toBe("monde"); // survit
    expect(store.state.instances[kani].counters.damage ?? 0).toBe(0); // 0 Dommage
    expect(
      store.state.instances[kani].counters.tokens?.chifumiShield ?? 0,
    ).toBe(0);
    expect(store.combat).toBeNull();
  });

  it("PERDU : le Kanigrou est détruit (auto-infligé, sans XP adverse)", () => {
    const { store, kani } = setupCombat();
    const heroA = store.state.seats.A.heroInstanceId!;
    const xpA = store.state.instances[heroA].counters.xp ?? 0;
    store.combatResolve();
    store.chifumiAccept();
    const heroB = store.state.seats.B.heroInstanceId!;
    const hpB = (
      store.state.instances[heroB].counters as Record<string, number>
    ).hp;
    store.chifumiChoose("pierre"); // adversaire (A)
    store.chifumiChoose("ciseaux"); // contrôleur (B) : pierre bat ciseaux → perdu
    expect(store.state.instances[kani].location.zone).toBe("defausse");
    // ruling : destruction auto-infligée → l'adversaire ne gagne PAS d'XP.
    expect(store.state.instances[heroA].counters.xp ?? 0).toBe(xpA);
    // le blocage RESTE valide : l'attaquant n'est PAS redirigé vers le Héros B.
    expect(
      (store.state.instances[heroB].counters as Record<string, number>).hp,
    ).toBe(hpB);
  });

  it("SUBIR (décliné) : le Kanigrou prend les Dommages normalement (survit avec 3)", () => {
    const { store, kani } = setupCombat();
    store.combatResolve();
    store.chifumiDecline();
    expect(store.pendingChifumi).toBeNull();
    expect(store.state.instances[kani].location.zone).toBe("monde");
    expect(store.state.instances[kani].counters.damage).toBe(3);
  });

  it("ÉGALITÉ : on rejoue (nouvel engagement de l'adversaire)", () => {
    const { store } = setupCombat();
    store.combatResolve();
    store.chifumiAccept();
    store.chifumiChoose("pierre"); // adversaire
    store.chifumiChoose("pierre"); // contrôleur : égalité → rejeu
    expect(store.pendingChifumi?.phase).toBe("reveal");
    expect(store.pendingChifumi?.oppChoice ?? null).toBeNull(); // ré-engagement
  });

  it("annuler le combat en plein Chi-Fu-Mi purge l'état (aucun bouclier orphelin)", () => {
    const { store, kani } = setupCombat();
    store.combatResolve();
    store.chifumiAccept(); // en phase reveal
    store.combatCancel();
    expect(store.pendingChifumi).toBeNull();
    expect(store.combat).toBeNull();
    // aucun bouclier ne doit fuir vers un combat futur.
    expect(
      store.state.instances[kani].counters.tokens?.chifumiShield ?? 0,
    ).toBe(0);
    // cliquer encore ne fait rien (fenêtre fermée).
    store.chifumiChoose("pierre");
    expect(
      store.state.instances[kani].counters.tokens?.chifumiShield ?? 0,
    ).toBe(0);
  });

  it("sans pouvoir Chi-Fu-Mi : combat résolu normalement (aucun mini-jeu)", () => {
    const { store, kani } = setupCombat("plain-test"); // bloqueur sans le pouvoir
    store.combatResolve();
    expect(store.pendingChifumi).toBeNull();
    expect(store.combat).toBeNull(); // résolu directement
    expect(store.state.instances[kani].counters.damage).toBe(3);
  });
});
