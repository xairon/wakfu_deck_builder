import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { createMockDeck } from "tests/factories/card";

describe("gameStore — resetTableAndDeck & Victory Notifications", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("resetTableAndDeck renvoie main, monde, havre-sac, défausse au deck et réinitialise le Héros", () => {
    const store = useGameStore();
    const deckA = createMockDeck();
    const deckB = createMockDeck();
    store.startSandbox(deckA, deckB, "A");

    const heroId = store.state.seats.A.heroInstanceId!;
    const havreSacId = store.state.seats.A.havreSacInstanceId!;

    // Déplacer le héros et quelques cartes vers le Monde, la Main et la Défausse
    store.moveTo(heroId, { zone: "monde" });
    const card1 = store.state.seats.A.pioche[0];
    const card2 = store.state.seats.A.pioche[1];
    store.moveTo(card1, { zone: "monde" });
    store.moveTo(card2, { zone: "defausse", owner: "A" });

    // Infliger des dégâts et modifier l'XP du héros
    store.adjustCounter(heroId, "hp", -15);
    store.adjustCounter(heroId, "xp", 6);

    expect(store.state.instances[heroId].counters.hp).toBe(5);
    expect(store.state.instances[heroId].counters.xp).toBe(6);

    // Déclencher le reset
    store.resetTableAndDeck("A");

    // Le Héros est réinitialisé dans le Havre-Sac avec Niv 1, XP 0
    const resetHero = store.state.instances[heroId];
    expect(resetHero.location.zone).toBe("havreSac");
    expect(resetHero.counters.xp).toBe(0);
    expect(resetHero.counters.hp).toBeGreaterThan(0);

    // Le Havre-Sac est réinitialisé dans la zone Havre-Sac
    const resetHS = store.state.instances[havreSacId];
    expect(resetHS.location.zone).toBe("havreSac");

    // Les cartes sont revenues dans la pioche
    expect(store.state.instances[card1].location.zone).toBe("pioche");
    expect(store.state.instances[card2].location.zone).toBe("pioche");

    // Message au journal
    const lastMsg = store.events.filter((e) => e.type === "SAID").pop();
    expect((lastMsg?.payload as { text: string })?.text).toContain("réinitialisé sa table et son deck");
  });
});
