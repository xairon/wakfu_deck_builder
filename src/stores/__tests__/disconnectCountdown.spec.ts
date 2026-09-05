import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";

describe("gameStore — déconnexion et minuteur de 30 secondes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("arme le compte à rebours de 30s quand l'adversaire disparaît en pleine partie", () => {
    const store = useGameStore();
    store.matchPhase = "playing";

    // Simuler que la présence adverse a été vue au moins une fois
    (store as any).onOpponentPresence(true);
    expect(store.opponentPresent).toBe(true);
    expect(store.disconnectCountdown).toBeNull();
    expect(store.canClaimVictory).toBe(false);

    // L'adversaire perd sa connexion
    (store as any).onOpponentPresence(false);
    expect(store.opponentPresent).toBe(false);
    expect(store.disconnectCountdown).toBe(30);

    // Avancer de 10 secondes
    vi.advanceTimersByTime(10000);
    expect(store.disconnectCountdown).toBe(20);
    expect(store.canClaimVictory).toBe(false);

    // Avancer jusqu'au terme des 30 secondes
    vi.advanceTimersByTime(20000);
    expect(store.disconnectCountdown).toBe(0);
    expect(store.canClaimVictory).toBe(true);

    // L'adversaire revient
    (store as any).onOpponentPresence(true);
    expect(store.opponentPresent).toBe(true);
    expect(store.disconnectCountdown).toBeNull();
    expect(store.canClaimVictory).toBe(false);
  });
});
