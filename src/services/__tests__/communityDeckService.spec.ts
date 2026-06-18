import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SourcedDeck, DeckSource } from "@/services/communityDeckService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SourcedDeck with sensible defaults. */
function makeDeck(overrides: Partial<SourcedDeck> = {}): SourcedDeck {
  return {
    id: "deck-1",
    name: "Deck de test",
    source: "Tournoi" as DeckSource,
    cards: [
      { name: "Bouftou", quantity: 3 },
      { name: "Tofu", quantity: 2 },
    ],
    ...overrides,
  };
}

/**
 * Builds a successful fetch response whose .json() resolves to `body`.
 * Mirrors the fetch-mocking pattern in cardLoader.spec.ts but for a JSON body.
 */
function mockFetchJson(body: unknown) {
  (global.fetch as any) = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  }));
}

/**
 * Loads a FRESH copy of the module so the module-level `cache` is empty.
 * The cache leaks between tests otherwise (it lives at module scope).
 */
async function freshModule() {
  vi.resetModules();
  return import("@/services/communityDeckService");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("communityDeckService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence the console.error the loader emits on failure paths.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // =========================================================================
  // groupBySource
  // =========================================================================

  describe("groupBySource", () => {
    it("devrait regrouper les decks par source dans l'ordre canonique", async () => {
      const { groupBySource } = await freshModule();
      const decks: SourcedDeck[] = [
        makeDeck({ id: "c1", source: "Communauté" }),
        makeDeck({ id: "t1", source: "Tournoi" }),
        makeDeck({ id: "d1", source: "Dofus Mag" }),
        makeDeck({ id: "t2", source: "Tournoi" }),
        makeDeck({ id: "cr1", source: "Créateur" }),
      ];

      const result = groupBySource(decks);

      // Ordre imposé : Tournoi, Dofus Mag, Communauté, Créateur
      expect(result.map((g) => g.source)).toEqual([
        "Tournoi",
        "Dofus Mag",
        "Communauté",
        "Créateur",
      ]);
      // Les deux tournois sont regroupés, ordre d'insertion préservé.
      const tournoi = result.find((g) => g.source === "Tournoi")!;
      expect(tournoi.decks.map((d) => d.id)).toEqual(["t1", "t2"]);
    });

    it("devrait omettre les sources absentes du jeu de données", async () => {
      const { groupBySource } = await freshModule();
      const result = groupBySource([
        makeDeck({ id: "d1", source: "Dofus Mag" }),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("Dofus Mag");
      expect(result[0].decks).toHaveLength(1);
    });

    it("devrait retourner un tableau vide pour une entrée vide", async () => {
      const { groupBySource } = await freshModule();
      expect(groupBySource([])).toEqual([]);
    });
  });

  // =========================================================================
  // deckCardCount
  // =========================================================================

  describe("deckCardCount", () => {
    it("devrait sommer les quantités de toutes les cartes", async () => {
      const { deckCardCount } = await freshModule();
      const deck = makeDeck({
        cards: [
          { name: "A", quantity: 3 },
          { name: "B", quantity: 2 },
          { name: "C", quantity: 1 },
        ],
      });
      expect(deckCardCount(deck)).toBe(6);
    });

    it("devrait retourner 0 pour un deck sans cartes", async () => {
      const { deckCardCount } = await freshModule();
      expect(deckCardCount(makeDeck({ cards: [] }))).toBe(0);
    });
  });

  // =========================================================================
  // communityDeckToText
  // =========================================================================

  describe("communityDeckToText", () => {
    it("devrait produire le texte d'import avec héros, havre-sac et cartes", async () => {
      const { communityDeckToText } = await freshModule();
      const deck = makeDeck({
        name: "Mono Feu",
        hero: "Iop",
        havreSac: "Havre-Sac Iop",
        cards: [
          { name: "Bouftou", quantity: 3, type: "Allié" },
          { name: "Boule de feu", quantity: 2 },
        ],
      });

      const text = communityDeckToText(deck);

      expect(text).toBe(
        [
          "# Mono Feu",
          "1 Iop (Héros)",
          "1 Havre-Sac Iop (Havre-Sac)",
          "3 Bouftou (Allié)",
          "2 Boule de feu",
        ].join("\n"),
      );
    });

    it("devrait omettre les lignes héros / havre-sac quand elles sont absentes", async () => {
      const { communityDeckToText } = await freshModule();
      const deck = makeDeck({
        name: "Sans héros",
        hero: undefined,
        havreSac: undefined,
        cards: [{ name: "Tofu", quantity: 1 }],
      });

      const text = communityDeckToText(deck);
      const lines = text.split("\n");

      expect(lines[0]).toBe("# Sans héros");
      expect(text).not.toContain("(Héros)");
      expect(text).not.toContain("(Havre-Sac)");
      expect(lines).toContain("1 Tofu");
    });

    it("devrait ne contenir que le titre pour un deck vide sans héros", async () => {
      const { communityDeckToText } = await freshModule();
      const deck = makeDeck({
        name: "Vide",
        hero: undefined,
        havreSac: undefined,
        cards: [],
      });
      expect(communityDeckToText(deck)).toBe("# Vide");
    });
  });

  // =========================================================================
  // loadCommunityDecks
  // =========================================================================

  describe("loadCommunityDecks", () => {
    it("devrait charger les decks depuis /data/community-decks.json", async () => {
      const { loadCommunityDecks } = await freshModule();
      const decks = [
        makeDeck({ id: "x1", name: "Premier" }),
        makeDeck({ id: "x2", name: "Second" }),
      ];
      mockFetchJson({ decks });

      const result = await loadCommunityDecks();

      expect(global.fetch).toHaveBeenCalledWith("/data/community-decks.json");
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual(["x1", "x2"]);
      expect(result[0].name).toBe("Premier");
    });

    it("devrait retourner un tableau vide quand data.decks n'est pas un tableau", async () => {
      const { loadCommunityDecks } = await freshModule();
      // Garde défensive : Array.isArray(data?.decks) ? ... : []
      mockFetchJson({ decks: { not: "an array" } });

      const result = await loadCommunityDecks();
      expect(result).toEqual([]);
    });

    it("devrait retourner un tableau vide quand la réponse HTTP n'est pas ok", async () => {
      const { loadCommunityDecks } = await freshModule();
      (global.fetch as any) = vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }));

      const result = await loadCommunityDecks();
      expect(result).toEqual([]);
    });

    it("devrait retourner un tableau vide quand le réseau échoue", async () => {
      const { loadCommunityDecks } = await freshModule();
      (global.fetch as any) = vi.fn(async () => {
        throw new Error("Network down");
      });

      const result = await loadCommunityDecks();
      expect(result).toEqual([]);
    });

    it("devrait mettre en cache et ne pas refetch lors d'un second appel", async () => {
      const { loadCommunityDecks } = await freshModule();
      mockFetchJson({ decks: [makeDeck({ id: "cached" })] });

      const first = await loadCommunityDecks();
      const second = await loadCommunityDecks();

      // Un seul fetch malgré deux appels : le cache module-level a servi le 2e.
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(second[0].id).toBe("cached");
    });

    it("devrait conserver un cache vide après un échec (pas de re-fetch)", async () => {
      const { loadCommunityDecks } = await freshModule();
      (global.fetch as any) = vi.fn(async () => {
        throw new Error("boom");
      });

      const first = await loadCommunityDecks();
      const second = await loadCommunityDecks();

      // L'échec met cache = [] ; le second appel renvoie ce cache sans refetch.
      expect(first).toEqual([]);
      expect(second).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
