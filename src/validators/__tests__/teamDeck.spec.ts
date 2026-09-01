import { describe, it, expect } from "vitest";
import { validateTeamDecks, getTeamUniqueCardCopies } from "../teamDeck";
import { createMockDeck, createMockAllyCard } from "tests/factories/card";
import type { Card } from "@/types/cards";

describe("validateTeamDecks — Règle d'unicité d'équipe (2v2)", () => {
  const uniqueCard: Card = createMockAllyCard({
    id: "card-unique-1",
    name: "Goultard le Barbare",
    element: "Feu",
    subTypes: ["Unique"],
    level: 5,
    force: 6,
  });

  const normalCard: Card = createMockAllyCard({
    id: "card-normal-1",
    name: "Bouftou",
    element: "Terre",
    level: 1,
    force: 2,
  });

  it("valide deux decks conformes qui n'ont aucune carte Unique en commun", () => {
    const deck1 = createMockDeck({ id: "d1" });
    const deck2 = createMockDeck({ id: "d2" });

    // Remplacer 3 cartes normales par 1 carte Unique + 2 cartes d'un autre Allié pour faire 48
    deck1.cards[0] = { card: uniqueCard, quantity: 1, isReserve: false };
    deck1.cards.push({ card: createMockAllyCard({ id: "extra-1", name: "Extra 1" }), quantity: 2, isReserve: false });

    const result = validateTeamDecks(deck1, deck2);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("refuse deux decks si une carte Unique est présente dans les deux decks (1 copie chacun)", () => {
    const deck1 = createMockDeck({ id: "d1" });
    const deck2 = createMockDeck({ id: "d2" });

    deck1.cards[0] = { card: uniqueCard, quantity: 1, isReserve: false };
    deck1.cards.push({ card: createMockAllyCard({ id: "extra-1", name: "Extra 1" }), quantity: 2, isReserve: false });

    deck2.cards[0] = { card: uniqueCard, quantity: 1, isReserve: false };
    deck2.cards.push({ card: createMockAllyCard({ id: "extra-2", name: "Extra 2" }), quantity: 2, isReserve: false });

    const result = validateTeamDecks(deck1, deck2);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Goultard le Barbare") && e.includes("Unique"))).toBe(true);
  });

  it("autorise des cartes non-uniques présentes dans les deux decks (ex: Bouftou x3 dans chaque deck)", () => {
    const deck1 = createMockDeck({ id: "d1" });
    const deck2 = createMockDeck({ id: "d2" });

    deck1.cards[0] = { card: normalCard, quantity: 3, isReserve: false };
    deck2.cards[0] = { card: normalCard, quantity: 3, isReserve: false };

    const result = validateTeamDecks(deck1, deck2);
    expect(result.isValid).toBe(true);
  });
});
