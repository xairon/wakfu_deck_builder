import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  encodeDeck,
  decodeDeck,
  generateShareUrl,
  parseShareUrl,
} from "../deckSharing";
import type { Deck, DeckCard, Card } from "@/types/cards";

// --- Helpers pour construire des mocks ---

function createMockCard(
  overrides: Partial<Card> & { id: string; name: string },
): Card {
  return {
    mainType: "Allié",
    subTypes: [],
    extension: { name: "Amakna", id: "amakna" },
    rarity: "Commune",
    artists: [],
    ...overrides,
  } as Card;
}

function createMockDeckCard(
  cardId: string,
  cardName: string,
  quantity: number,
): DeckCard {
  return {
    card: createMockCard({ id: cardId, name: cardName }),
    quantity,
  };
}

function createMockDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: "deck-1",
    name: "Mon Deck",
    hero: createMockCard({ id: "hero-1", name: "Iop", mainType: "Héros" }),
    havreSac: createMockCard({
      id: "hs-1",
      name: "Havre-Sac Iop",
      mainType: "Havre-Sac",
    }),
    cards: [
      createMockDeckCard("card-1", "Coup de Poing", 3),
      createMockDeckCard("card-2", "Bouclier", 2),
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deckSharing", () => {
  describe("encodeDeck", () => {
    it("devrait produire une chaîne base64 valide", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
      // A valid base64 string should not throw when decoded
      expect(() => atob(encoded)).not.toThrow();
    });

    it("devrait encoder tous les champs du deck", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);
      const jsonStr = decodeURIComponent(escape(atob(encoded)));
      const payload = JSON.parse(jsonStr);

      expect(payload.n).toBe("Mon Deck");
      expect(payload.h).toBe("hero-1");
      expect(payload.s).toBe("hs-1");
      expect(payload.c).toEqual([
        ["card-1", 3],
        ["card-2", 2],
      ]);
    });

    it("devrait encoder null pour hero et havreSac absents", () => {
      const deck = createMockDeck({ hero: null, havreSac: null });
      const encoded = encodeDeck(deck);
      const jsonStr = decodeURIComponent(escape(atob(encoded)));
      const payload = JSON.parse(jsonStr);

      expect(payload.h).toBeNull();
      expect(payload.s).toBeNull();
    });

    it("devrait encoder un deck avec un tableau de cartes vide", () => {
      const deck = createMockDeck({ cards: [] });
      const encoded = encodeDeck(deck);
      const jsonStr = decodeURIComponent(escape(atob(encoded)));
      const payload = JSON.parse(jsonStr);

      expect(payload.c).toEqual([]);
    });
  });

  describe("decodeDeck", () => {
    it("devrait décoder correctement une chaîne encodée valide", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);
      const result = decodeDeck(encoded);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Mon Deck");
      expect(result!.heroId).toBe("hero-1");
      expect(result!.havreSacId).toBe("hs-1");
      expect(result!.cards).toEqual([
        { cardId: "card-1", quantity: 3 },
        { cardId: "card-2", quantity: 2 },
      ]);
    });

    it("devrait retourner null pour une chaîne base64 invalide", () => {
      const result = decodeDeck("not-valid-base64!!!");
      expect(result).toBeNull();
    });

    it("devrait retourner null pour du JSON invalide", () => {
      const encoded = btoa("this is not json");
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait retourner null si le champ name est manquant", () => {
      const payload = { h: "hero-1", s: "hs-1", c: [] };
      const encoded = btoa(JSON.stringify(payload));
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait retourner null si le champ name n'est pas une chaîne", () => {
      const payload = { n: 42, h: "hero-1", s: "hs-1", c: [] };
      const encoded = btoa(JSON.stringify(payload));
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait retourner null si le champ cards n'est pas un tableau", () => {
      const payload = { n: "Deck", h: "hero-1", s: "hs-1", c: "not-array" };
      const encoded = btoa(JSON.stringify(payload));
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait filtrer les entrées de cartes invalides", () => {
      const payload = {
        n: "Deck",
        h: null,
        s: null,
        c: [
          ["card-1", 3], // valide
          ["card-2"], // manque la quantité
          [42, 2], // cardId n'est pas une string
          ["card-3", "two"], // quantity n'est pas un nombre
          "not-an-array", // pas un tableau
          ["card-4", 1, "extra"], // trop d'éléments (length !== 2)
          ["card-5", 2], // valide
        ],
      };
      const encoded = btoa(JSON.stringify(payload));
      const result = decodeDeck(encoded);

      expect(result).not.toBeNull();
      expect(result!.cards).toEqual([
        { cardId: "card-1", quantity: 3 },
        { cardId: "card-5", quantity: 2 },
      ]);
    });

    it("devrait retourner null pour une chaîne vide", () => {
      const result = decodeDeck("");
      expect(result).toBeNull();
    });
  });

  describe("Aller-retour (roundtrip)", () => {
    it("devrait préserver la distinction réserve/principal", () => {
      const deck = createMockDeck();
      // Marque la première carte comme étant en réserve.
      deck.cards[0].isReserve = true;
      const reserveId = deck.cards[0].card.id;
      const decoded = decodeDeck(encodeDeck(deck));

      expect(decoded).not.toBeNull();
      const reserveEntry = decoded!.cards.find((c) => c.cardId === reserveId);
      const mainEntry = decoded!.cards.find((c) => c.cardId !== reserveId);
      expect(reserveEntry?.isReserve).toBe(true);
      expect(mainEntry?.isReserve).toBeUndefined();
    });

    it("devrait préserver toutes les données après encodage/décodage", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe(deck.name);
      expect(decoded!.heroId).toBe(deck.hero!.id);
      expect(decoded!.havreSacId).toBe(deck.havreSac!.id);
      expect(decoded!.cards).toHaveLength(deck.cards.length);
      deck.cards.forEach((dc, i) => {
        expect(decoded!.cards[i].cardId).toBe(dc.card.id);
        expect(decoded!.cards[i].quantity).toBe(dc.quantity);
      });
    });

    it("devrait préserver un deck avec hero et havreSac null", () => {
      const deck = createMockDeck({ hero: null, havreSac: null });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.heroId).toBeNull();
      expect(decoded!.havreSacId).toBeNull();
    });

    it("devrait préserver un deck avec un nom vide", () => {
      const deck = createMockDeck({ name: "" });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe("");
    });

    it("devrait préserver un deck avec un tableau de cartes vide", () => {
      const deck = createMockDeck({ cards: [] });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.cards).toEqual([]);
    });
  });

  describe("UTF-8 (caractères français)", () => {
    it("devrait gérer les accents dans le nom du deck", () => {
      const deck = createMockDeck({
        name: "Décès élémentaire à Bônta-Brâkmar",
      });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe("Décès élémentaire à Bônta-Brâkmar");
    });

    it("devrait gérer les caractères spéciaux français (é, è, ê, ô, ù, ç, ï, ë)", () => {
      const deck = createMockDeck({
        name: "Héros île forêt côté où français Noël naïf",
      });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe("Héros île forêt côté où français Noël naïf");
    });

    it("devrait gérer les IDs de cartes avec accents via le roundtrip", () => {
      const deck = createMockDeck({
        cards: [
          createMockDeckCard("équipement-1", "Épée légère", 2),
          createMockDeckCard(
            "allié-élémentaire-3",
            "Protecteur élémentaire",
            1,
          ),
        ],
      });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.cards[0].cardId).toBe("équipement-1");
      expect(decoded!.cards[1].cardId).toBe("allié-élémentaire-3");
    });
  });

  describe("generateShareUrl", () => {
    beforeEach(() => {
      // jsdom fournit window.location.origin = 'http://localhost'
      // On peut le redéfinir pour le test
      Object.defineProperty(window, "location", {
        value: { origin: "https://wakfu-deck.vercel.app" },
        writable: true,
      });
    });

    it("devrait produire une URL valide avec le paramètre deck", () => {
      const deck = createMockDeck();
      const url = generateShareUrl(deck);

      expect(url).toContain("https://wakfu-deck.vercel.app/deck/share?deck=");
      // Le paramètre deck doit être encodé en URI
      const urlObj = new URL(url);
      expect(urlObj.pathname).toBe("/deck/share");
      expect(urlObj.searchParams.has("deck")).toBe(true);
    });

    it("devrait produire une URL dont le paramètre deck est décodable", () => {
      const deck = createMockDeck();
      const url = generateShareUrl(deck);

      const urlObj = new URL(url);
      const deckParam = urlObj.searchParams.get("deck");
      expect(deckParam).not.toBeNull();

      const decoded = decodeDeck(deckParam!);
      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe("Mon Deck");
    });
  });

  describe("parseShareUrl", () => {
    it("devrait extraire les données du deck depuis une URL complète", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);
      const url = `https://wakfu-deck.vercel.app/deck/share?deck=${encodeURIComponent(encoded)}`;

      const result = parseShareUrl(url);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Mon Deck");
      expect(result!.heroId).toBe("hero-1");
      expect(result!.havreSacId).toBe("hs-1");
      expect(result!.cards).toHaveLength(2);
    });

    it("devrait retourner null pour une URL sans paramètre deck", () => {
      const result = parseShareUrl("https://wakfu-deck.vercel.app/deck/share");
      expect(result).toBeNull();
    });

    it("devrait retourner null pour une URL avec un paramètre deck invalide", () => {
      const result = parseShareUrl(
        "https://wakfu-deck.vercel.app/deck/share?deck=garbage!!!",
      );
      expect(result).toBeNull();
    });

    it("devrait retourner null pour une chaîne complètement vide", () => {
      const result = parseShareUrl("");
      expect(result).toBeNull();
    });

    it("devrait gérer le fallback avec une URL partielle (sans protocole)", () => {
      const deck = createMockDeck();
      const encoded = encodeDeck(deck);
      // Pas de protocole => new URL() échoue, fallback vers URLSearchParams
      const partial = `/deck/share?deck=${encodeURIComponent(encoded)}`;

      const result = parseShareUrl(partial);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Mon Deck");
    });

    it("devrait retourner null pour une chaîne sans query string via le fallback", () => {
      const result = parseShareUrl("/deck/share");
      expect(result).toBeNull();
    });
  });

  describe("Cas limites", () => {
    it("devrait gérer un deck avec beaucoup de cartes", () => {
      const manyCards: DeckCard[] = Array.from({ length: 48 }, (_, i) =>
        createMockDeckCard(`card-${i}`, `Carte ${i}`, 1),
      );
      const deck = createMockDeck({ cards: manyCards });
      const encoded = encodeDeck(deck);
      const decoded = decodeDeck(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.cards).toHaveLength(48);
      decoded!.cards.forEach((c, i) => {
        expect(c.cardId).toBe(`card-${i}`);
        expect(c.quantity).toBe(1);
      });
    });

    it("devrait retourner null si le payload décodé est null", () => {
      const encoded = btoa(JSON.stringify(null));
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait retourner null si le payload décodé est un nombre", () => {
      const encoded = btoa(JSON.stringify(42));
      const result = decodeDeck(encoded);
      expect(result).toBeNull();
    });

    it("devrait gérer h et s manquants en les convertissant en null", () => {
      const payload = { n: "Deck", c: [["card-1", 2]] };
      const encoded = btoa(JSON.stringify(payload));
      const result = decodeDeck(encoded);

      expect(result).not.toBeNull();
      expect(result!.heroId).toBeNull();
      expect(result!.havreSacId).toBeNull();
    });
  });
});
