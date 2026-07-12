/**
 * STALL détecté au playtest instrumenté (2026-07-11) : pendant le combat du
 * BOT, la vue reste côté HUMAIN (solo mono-écran, useBotOpponent) — or
 * combatToggleAttacker/combatChooseTarget jugeaient l'éligibilité par
 * `perspective` au lieu du joueur ACTIF (703/702.2). Le bot déclarait un
 * attaquant (via beginCombat, perspective encore bot) puis ne pouvait JAMAIS
 * viser ni compléter : partie figée au milieu de son tour.
 * Verrou : la séquence EXACTE du driver (perspective humaine pendant la
 * déclaration du bot) doit aboutir à un combat confirmable.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

describe("déclaration de combat du bot — vue humaine (mono-écran)", () => {
  it("cible + attaquants jugés pour le joueur ACTIF, pas la perspective", () => {
    const { store } = makeEffectSandbox({ first: "B", allAllies: true });
    store.botSeat = "B";
    store.state.turn.number = 3; // hors interdiction d'attaque du 1er tour
    // Deux attaquants du bot en jeu, dressés, hors mal d'invocation.
    const a1 = placeInZone(store, "B", { zone: "monde" });
    const a2 = placeInZone(store, "B", { zone: "monde" });
    for (const id of [a1, a2])
      store.state.instances[id].counters.tokens = { arrivedTurn: 0 };
    // Séquence du driver : beginCombat en perspective BOT…
    store.perspective = "B";
    expect(store.beginCombat(a1)).toBe(true);
    // …puis la vue est RENDUE à l'humain (mono-écran) pour toute la suite.
    store.perspective = "A";

    // Le bot ajoute un 2e attaquant (jugé pour le siège ACTIF = B).
    store.combatToggleAttacker(a2);
    expect(store.combat?.attackers).toContain(a2);

    // Le bot vise (702.2 — cible du joueur actif) : ne doit PLUS être refusé.
    const tids = store.combatTargetIds;
    expect(tids.length).toBeGreaterThan(0);
    store.combatChooseTarget(tids[0]);
    expect(store.combat?.target?.instanceId).toBe(tids[0]);

    // La déclaration se confirme : plus de stall possible à cette étape.
    expect(store.combatConfirmAttackers()).toBe(true);
    expect(store.combat?.step).toBe("blockers");
  });
});
