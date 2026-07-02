import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  loadAllCards,
  loadCardById,
  testJsonLoading,
} from "@/services/cardLoader";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Doit suivre le CACHE_KEY de src/services/cardLoader.ts (bumpé à chaque
// changement de forme/normalisation des données compilées).
const CACHE_KEY = "wakfu-cards-cache-v53";
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24h - mirrors the source constant

/**
 * Build a minimal raw card object the way it appears in the JSON files,
 * before normalisation by cardLoader.
 */
function makeRawCard(overrides: Record<string, any> = {}) {
  return {
    id: "card-1",
    name: "Bouftou",
    mainType: "Allié",
    subTypes: [],
    extension: { name: "Incarnam", id: "incarnam" },
    rarity: "Commune",
    stats: {},
    effects: [],
    keywords: [],
    artists: ["ArtistX"],
    imageUrl: "/images/cards/bouftou.png",
    ...overrides,
  };
}

/**
 * Sets up a successful fetch mock that returns `cards` as JSON for every call.
 * Optionally accepts a map of URL patterns to card arrays.
 */
function mockFetchSuccess(cardsByUrl?: Record<string, any[]>) {
  (global.fetch as Mock).mockImplementation(async (url: string) => {
    const cards = cardsByUrl
      ? (Object.entries(cardsByUrl).find(([pattern]) =>
          url.includes(pattern),
        )?.[1] ?? [])
      : [makeRawCard()];
    const text = JSON.stringify(cards);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => cards,
      text: async () => text,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cardLoader", () => {
  beforeEach(() => {
    // The global setup in tests/setup.ts already creates mocks for
    // localStorage (getItem, setItem, removeItem, clear) and fetch.
    // We just reset them here for a clean slate.
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // =========================================================================
  // 1. Cache logic (tested through loadAllCards)
  // =========================================================================

  describe("Cache - isValidCache / loadFromCache / saveToCache", () => {
    it("should return cached cards when cache is valid (< 24h)", async () => {
      const cachedCards = [
        makeRawCard({ id: "cached-1", name: "Cached Card" }),
      ];
      const cacheData = {
        timestamp: Date.now() - 1000, // 1 second ago
        cards: cachedCards,
      };
      (localStorage.getItem as Mock).mockReturnValue(JSON.stringify(cacheData));

      const result = await loadAllCards();

      expect(result).toEqual(cachedCards);
      // fetch should NOT have been called since cache was used
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should ignore expired cache (> 24h) and load from network", async () => {
      const expiredCacheData = {
        timestamp: Date.now() - CACHE_EXPIRATION - 1000,
        cards: [makeRawCard({ id: "old" })],
      };
      (localStorage.getItem as Mock).mockReturnValue(
        JSON.stringify(expiredCacheData),
      );
      mockFetchSuccess();

      const result = await loadAllCards();

      // Should have removed the expired cache
      expect(localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
      // Should have loaded from network (11 extensions)
      expect(global.fetch).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle corrupt cache JSON gracefully", async () => {
      (localStorage.getItem as Mock).mockReturnValue("not valid json {{{");
      mockFetchSuccess();

      const result = await loadAllCards();

      // Should have cleaned up bad cache
      expect(localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
      // Should still return cards from network
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle missing cache key (null)", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess();

      const result = await loadAllCards();

      expect(global.fetch).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should save cards to cache after successful network load", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess();

      await loadAllCards();

      expect(localStorage.setItem).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.any(String),
      );

      // Verify the saved data structure
      const savedJson = (localStorage.setItem as Mock).mock.calls[0][1];
      const savedData = JSON.parse(savedJson);
      expect(savedData).toHaveProperty("timestamp");
      expect(savedData).toHaveProperty("cards");
      expect(Array.isArray(savedData.cards)).toBe(true);
    });

    it("should handle localStorage.setItem throwing (quota exceeded) gracefully", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (localStorage.setItem as Mock).mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      mockFetchSuccess();

      // Should not throw even if setItem fails
      const result = await loadAllCards();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle cache at exactly 24h boundary as expired", async () => {
      const borderlineCacheData = {
        timestamp: Date.now() - CACHE_EXPIRATION, // exactly at the limit
        cards: [makeRawCard({ id: "boundary" })],
      };
      (localStorage.getItem as Mock).mockReturnValue(
        JSON.stringify(borderlineCacheData),
      );
      mockFetchSuccess();

      await loadAllCards();

      // At exactly CACHE_EXPIRATION, now - timestamp === CACHE_EXPIRATION,
      // which is NOT < CACHE_EXPIRATION, so it should be expired
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. normalizeCardType (tested through loaded cards)
  // =========================================================================

  describe("normalizeCardType", () => {
    it('should normalize "Havre Sac" to "Havre-Sac"', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "hs-1", mainType: "Havre Sac" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "hs-1");
      expect(card?.mainType).toBe("Havre-Sac");
    });

    it('should normalize "Havre-sac" (lowercase s) to "Havre-Sac"', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "hs-2", mainType: "Havre-sac" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "hs-2");
      expect(card?.mainType).toBe("Havre-Sac");
    });

    it('should keep "Havre-Sac" unchanged when already correct', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "hs-3", mainType: "Havre-Sac" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "hs-3");
      expect(card?.mainType).toBe("Havre-Sac");
    });

    it('should normalize "héros" (lowercase) to "Héros"', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "h-1", mainType: "héros" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "h-1");
      expect(card?.mainType).toBe("Héros");
    });

    it('should normalize "Heros" (no accent) to "Héros"', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "h-2", mainType: "Heros" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "h-2");
      expect(card?.mainType).toBe("Héros");
    });

    it("should pass through unknown card types unchanged", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "u-1", mainType: "Allié" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "u-1");
      expect(card?.mainType).toBe("Allié");
    });

    it('should pass through "Action" type unchanged', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "a-1", mainType: "Action" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "a-1");
      expect(card?.mainType).toBe("Action");
    });
  });

  // =========================================================================
  // 3. fixSpecialCharacters (tested through loaded card names/types)
  // =========================================================================

  describe("fixSpecialCharacters", () => {
    it('should fix "Alli??" to "Allié" in card name', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-1", name: "Alli?? de combat" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-1");
      expect(card?.name).toBe("Allié de combat");
    });

    it('should fix "H??ros" to "Héros" in card name', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-2", name: "H??ros du temps" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-2");
      expect(card?.name).toBe("Héros du temps");
    });

    it('should fix "??quipement" to "Équipement" in card mainType', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-3", mainType: "??quipement" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-3");
      expect(card?.mainType).toBe("Équipement");
    });

    it("should fix broken encoding in subTypes", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-4", subTypes: ["Alli??", "H??ros"] })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-4");
      expect(card?.subTypes).toEqual(["Allié", "Héros"]);
    });

    it('should fix "d??g??ts" to "dégâts" in card name', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-5", name: "Inflige 3 d??g??ts" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-5");
      expect(card?.name).toBe("Inflige 3 dégâts");
    });

    it('should handle fallback "??" to "é" replacement', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "fix-6", name: "L??gende" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "fix-6");
      expect(card?.name).toBe("Légende");
    });
  });

  // =========================================================================
  // 4. normalizeCardElements / capitalizeElement (tested through loaded cards)
  // =========================================================================

  describe("normalizeCardElements / capitalizeElement", () => {
    it("should capitalize element in stats.niveau.element", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({
            id: "elem-1",
            stats: { niveau: { value: 3, element: "feu" } },
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "elem-1");
      expect(card?.stats?.niveau?.element).toBe("Feu");
    });

    it("should capitalize element in stats.force.element", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({
            id: "elem-2",
            stats: { force: { value: 5, element: "eau" } },
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "elem-2");
      expect(card?.stats?.force?.element).toBe("Eau");
    });

    it('should capitalize "TERRE" to "Terre"', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({
            id: "elem-3",
            stats: { niveau: { value: 2, element: "TERRE" } },
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "elem-3");
      expect(card?.stats?.niveau?.element).toBe("Terre");
    });

    it("should leave already-capitalized elements unchanged", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({
            id: "elem-4",
            stats: { niveau: { value: 1, element: "Air" } },
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "elem-4");
      expect(card?.stats?.niveau?.element).toBe("Air");
    });

    it("should handle cards without stats gracefully", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({
            id: "elem-5",
            stats: undefined,
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "elem-5");
      // Should not throw, card should exist
      expect(card).toBeDefined();
    });
  });

  // =========================================================================
  // 5. loadAllCards (integration)
  // =========================================================================

  describe("loadAllCards - integration", () => {
    it("should load all 11 extensions in parallel via fetch", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess();

      await loadAllCards();

      // 11 extensions should cause 11 fetch calls
      expect(global.fetch).toHaveBeenCalledTimes(11);
    });

    it("should fetch from correct paths for each extension", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess();

      await loadAllCards();

      const expectedExtensions = [
        "amakna",
        "ankama-convention-5",
        "astrub",
        "bonta-brakmar",
        "chaos-dogrest",
        "dofus-collection",
        "ile-des-wabbits",
        "incarnam",
        "otomai",
        "pandala",
        "draft",
      ];
      for (const ext of expectedExtensions) {
        expect(global.fetch).toHaveBeenCalledWith(`/data/${ext}.json`);
      }
    });

    it("should return combined card array from all extensions", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "amk-1" }), makeRawCard({ id: "amk-2" })],
        astrub: [makeRawCard({ id: "ast-1" })],
      });

      const result = await loadAllCards();

      // amakna: 2, astrub: 1, other 9 extensions: 0 each
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.id)).toContain("amk-1");
      expect(result.map((c) => c.id)).toContain("amk-2");
      expect(result.map((c) => c.id)).toContain("ast-1");
    });

    it("should filter out cards without id", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({ id: "valid-1" }),
          makeRawCard({ id: "", name: "No ID card" }),
          makeRawCard({ id: null, name: "Null ID card" }),
        ],
      });

      const result = await loadAllCards();
      const amaknaCards = result.filter(
        (c) => c.name?.includes("ID card") || c.id === "valid-1",
      );

      // Only the card with a valid id should be present
      expect(amaknaCards).toHaveLength(1);
      expect(amaknaCards[0].id).toBe("valid-1");
    });

    it("should filter out cards without name", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [
          makeRawCard({ id: "named-1", name: "Valid Name" }),
          makeRawCard({ id: "noname-1", name: "" }),
          makeRawCard({ id: "noname-2", name: null }),
        ],
      });

      const result = await loadAllCards();
      const amaknaCards = result.filter(
        (c) => c.id?.startsWith("named") || c.id?.startsWith("noname"),
      );

      expect(amaknaCards).toHaveLength(1);
      expect(amaknaCards[0].id).toBe("named-1");
    });

    it("should filter out null/non-object entries from the JSON array", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      const cardsArray = [
        makeRawCard({ id: "ok-1" }),
        null,
        42,
        "string-entry",
        undefined,
        makeRawCard({ id: "ok-2" }),
      ];
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        const data = url.includes("amakna") ? cardsArray : [];
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(data),
        };
      });

      const result = await loadAllCards();
      expect(result).toHaveLength(2);
    });

    it("should handle fetch failure for one extension gracefully", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        if (url.includes("amakna")) {
          return { ok: false, status: 500, statusText: "Server Error" };
        }
        const cards = url.includes("astrub")
          ? [makeRawCard({ id: "ast-1" })]
          : [];
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(cards),
        };
      });

      const result = await loadAllCards();

      // Should still have cards from other extensions
      expect(result.find((c) => c.id === "ast-1")).toBeDefined();
      // amakna failure should not break the entire load
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty JSON array for an extension", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        const cards = url.includes("amakna")
          ? []
          : [makeRawCard({ id: `card-${url.split("/").pop()}` })];
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(cards),
        };
      });

      const result = await loadAllCards();
      // amakna returns empty, but other 10 extensions each return 1 card
      expect(result.length).toBe(10);
    });

    it('should handle response text "[]" as empty extension', async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (_url: string) => ({
        ok: true,
        status: 200,
        text: async () => "[]",
      }));

      const result = await loadAllCards();
      expect(result).toEqual([]);
    });

    it("should handle non-array JSON response gracefully", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ not: "an array" }),
      }));

      const result = await loadAllCards();
      expect(result).toEqual([]);
    });

    it("should provide default extension info when card has none", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "noext-1", extension: null })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "noext-1");
      expect(card?.extension).toEqual({
        name: "Amakna",
        id: "amakna",
      });
    });

    it("should provide default extension name when extension object has no name", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        "bonta-brakmar": [
          makeRawCard({
            id: "noextname-1",
            extension: { id: "bb" },
          }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "noextname-1");
      expect(card?.extension.name).toBe("Bonta brakmar");
    });

    it("should provide default rarity when card has none", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "norarity-1", rarity: undefined })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "norarity-1");
      expect(card?.rarity).toBe("Commune");
    });

    it("should provide default empty subTypes when card has none", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "nosub-1", subTypes: "not-array" as any })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "nosub-1");
      expect(card?.subTypes).toEqual([]);
    });
  });

  // =========================================================================
  // 6. loadCardById
  // =========================================================================

  describe("loadCardById", () => {
    it("should return the correct card when found", async () => {
      (global.fetch as Mock).mockImplementation(async (_url: string) => {
        const cards = [
          makeRawCard({ id: "target-1", name: "Target Card" }),
          makeRawCard({ id: "other-1", name: "Other Card" }),
        ];
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(cards),
        };
      });

      const result = await loadCardById("amakna", "target-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("target-1");
      expect(result!.name).toBe("Target Card");
    });

    it("should return null for a non-existent card id", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([makeRawCard({ id: "exists-1" })]),
      }));

      const result = await loadCardById("amakna", "does-not-exist");

      expect(result).toBeNull();
    });

    it("should return null on fetch error", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }));

      const result = await loadCardById("amakna", "any-id");

      expect(result).toBeNull();
    });

    it("should fetch from the correct extension path", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      }));

      await loadCardById("chaos-dogrest", "card-1");

      expect(global.fetch).toHaveBeenCalledWith("/data/chaos-dogrest.json");
    });

    it("should apply normalizeCardType to returned card", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([makeRawCard({ id: "hero-raw", mainType: "Heros" })]),
      }));

      const result = await loadCardById("amakna", "hero-raw");

      expect(result).not.toBeNull();
      expect(result!.mainType).toBe("Héros");
    });

    it("should return null when network throws", async () => {
      (global.fetch as Mock).mockImplementation(async () => {
        throw new Error("Network failure");
      });

      const result = await loadCardById("amakna", "any-id");

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 7. testJsonLoading
  // =========================================================================

  describe("testJsonLoading", () => {
    it("should return success with item count for valid JSON array", async () => {
      const cards = [
        makeRawCard({ id: "test-1" }),
        makeRawCard({ id: "test-2" }),
        makeRawCard({ id: "test-3" }),
        makeRawCard({ id: "test-4" }),
        makeRawCard({ id: "test-5" }),
      ];
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(cards),
      }));

      const result = await testJsonLoading("amakna");

      expect(result.success).toBe(true);
      expect(result.items).toBe(5);
      expect(result.sample).toHaveLength(3); // first 3 items
    });

    it("should return failure info for HTTP error", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }));

      const result = await testJsonLoading("nonexistent");

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.statusText).toBe("Not Found");
    });

    it("should return failure for invalid JSON", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => "this is not json {{{",
      }));

      const result = await testJsonLoading("broken");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.textSample).toBeDefined();
    });

    it("should return failure for non-array JSON response", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ key: "value" }),
      }));

      const result = await testJsonLoading("object-response");

      expect(result.success).toBe(false);
      expect(result.type).toBe("object");
    });

    it("should return failure for network errors", async () => {
      (global.fetch as Mock).mockImplementation(async () => {
        throw new Error("DNS resolution failed");
      });

      const result = await testJsonLoading("unreachable");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DNS resolution failed");
    });

    it("should fetch from the correct data path", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => "[]",
      }));

      await testJsonLoading("pandala");

      expect(global.fetch).toHaveBeenCalledWith("/data/pandala.json");
    });

    it("should return success with 0 items for empty array", async () => {
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => "[]",
      }));

      const result = await testJsonLoading("empty");

      expect(result.success).toBe(true);
      expect(result.items).toBe(0);
    });
  });

  // =========================================================================
  // 8. Error handling
  // =========================================================================

  describe("Error handling", () => {
    it("should not throw when all extensions fail individually (returns empty)", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      // loadExtensionCards catches errors and returns [] for each extension
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: "Server Error",
      }));

      const result = await loadAllCards();

      // All extensions fail gracefully, returning empty arrays
      expect(result).toEqual([]);
    });

    it("should handle invalid JSON parse errors gracefully per extension", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        if (url.includes("amakna")) {
          return {
            ok: true,
            status: 200,
            text: async () => "{invalid json}}}",
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([makeRawCard({ id: "ok-card" })]),
        };
      });

      const result = await loadAllCards();

      // amakna fails with parse error, other extensions succeed
      expect(result.find((c) => c.id === "ok-card")).toBeDefined();
    });

    it("should handle network errors per extension without breaking others", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        if (url.includes("draft")) {
          throw new Error("Connection refused");
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([
              makeRawCard({
                id: `from-${url.split("/").pop()?.replace(".json", "")}`,
              }),
            ]),
        };
      });

      const result = await loadAllCards();

      // 10 extensions succeed, 1 fails - should have 10 cards
      expect(result.length).toBe(10);
    });

    it("should log console.error when fetch fails for an extension", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: "Server Error",
      }));

      await loadAllCards();

      expect(console.error).toHaveBeenCalled();
    });

    it("should handle response with empty text body", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => "",
      }));

      const result = await loadAllCards();
      expect(result).toEqual([]);
    });

    it("should handle response with whitespace-only text body", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async () => ({
        ok: true,
        status: 200,
        text: async () => "   \n  ",
      }));

      const result = await loadAllCards();
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // 9. Edge cases / Additional coverage
  // =========================================================================

  describe("Edge cases", () => {
    it("should handle card with missing mainType by assigning default", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "notype-1", mainType: undefined })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "notype-1");
      expect(card?.mainType).toBe("Type inconnu");
    });

    it("should handle multiple cards across multiple extensions", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      (global.fetch as Mock).mockImplementation(async (url: string) => {
        let cards: any[] = [];
        if (url.includes("amakna")) {
          cards = [
            makeRawCard({ id: "amk-1", name: "Bouftou" }),
            makeRawCard({ id: "amk-2", name: "Tofu" }),
          ];
        } else if (url.includes("incarnam")) {
          cards = [makeRawCard({ id: "inc-1", name: "Piwi" })];
        } else if (url.includes("pandala")) {
          cards = [
            makeRawCard({ id: "pan-1", name: "Pandawa" }),
            makeRawCard({ id: "pan-2", name: "Pandawushu" }),
            makeRawCard({ id: "pan-3", name: "Pandulfu" }),
          ];
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(cards),
        };
      });

      const result = await loadAllCards();

      expect(result).toHaveLength(6); // 2 + 1 + 3
      expect(result.map((c) => c.id)).toEqual(
        expect.arrayContaining([
          "amk-1",
          "amk-2",
          "inc-1",
          "pan-1",
          "pan-2",
          "pan-3",
        ]),
      );
    });

    it("should apply fixSpecialCharacters combined with normalizeCardType", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      // "H??ros" -> fixSpecialCharacters -> "Héros" -> normalizeCardType -> "Héros"
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "combo-1", mainType: "H??ros" })],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "combo-1");
      expect(card?.mainType).toBe("Héros");
    });

    it("should handle card with extension as a non-object string", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      mockFetchSuccess({
        otomai: [
          makeRawCard({ id: "strext-1", extension: "bad-string" as any }),
        ],
      });

      const result = await loadAllCards();
      const card = result.find((c) => c.id === "strext-1");
      // Should get a default extension object
      expect(card?.extension).toEqual({
        name: "Otomai",
        id: "otomai",
      });
    });

    it("should not duplicate cards when cache is saved and then loaded", async () => {
      (localStorage.getItem as Mock).mockReturnValue(null);
      const savedData: string[] = [];
      (localStorage.setItem as Mock).mockImplementation(
        (_key: string, value: string) => {
          savedData.push(value);
        },
      );
      mockFetchSuccess({
        amakna: [makeRawCard({ id: "cache-test-1" })],
        astrub: [makeRawCard({ id: "cache-test-2" })],
      });

      const firstLoad = await loadAllCards();

      // Simulate reading back the cached data
      expect(savedData.length).toBe(1);
      const cached = JSON.parse(savedData[0]);
      expect(cached.cards).toHaveLength(firstLoad.length);
      expect(cached.cards.map((c: any) => c.id)).toEqual(
        firstLoad.map((c) => c.id),
      );
    });
  });
});
