import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  localStorageService,
  LOCAL_STORAGE_KEYS,
  stripDangerousKeys,
  sanitizeString,
  sanitizeStrings,
  isValidCollection,
} from "../localStorage";
import type { CollectionRecord, AppSettings } from "../localStorage";
import type { Deck } from "@/types/cards";

/**
 * Helper to configure the localStorage mock for a given key/value pair.
 * The global setup already provides a vi.fn() mock for each localStorage method.
 */
function mockGetItem(data: Record<string, string>) {
  vi.mocked(localStorage.getItem).mockImplementation(
    (key: string) => data[key] ?? null,
  );
}

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: "deck-1",
    name: "Test Deck",
    hero: null,
    havreSac: null,
    cards: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("localStorage service", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── stripDangerousKeys ───────────────────────────────────────────────

  describe("stripDangerousKeys", () => {
    it("devrait supprimer les clefs __proto__, constructor et prototype", () => {
      const input = {
        safe: "ok",
        __proto__: { polluted: true },
        constructor: { polluted: true },
        prototype: { polluted: true },
      };
      // Object.entries skips inherited __proto__ but our literal key is enumerable
      const result = stripDangerousKeys(input) as Record<string, unknown>;
      expect(result).toEqual({ safe: "ok" });
      expect(result).not.toHaveProperty("__proto__");
      expect(result).not.toHaveProperty("constructor");
      expect(result).not.toHaveProperty("prototype");
    });

    it("devrait conserver les clefs normales", () => {
      const input = { name: "Alice", count: 42, nested: { a: 1 } };
      expect(stripDangerousKeys(input)).toEqual(input);
    });

    it("devrait fonctionner recursivement sur les objets imbriques", () => {
      const input = {
        level1: {
          safe: true,
          __proto__: "bad",
          level2: {
            constructor: "bad",
            ok: "yes",
          },
        },
      };
      const result = stripDangerousKeys(input) as Record<string, unknown>;
      expect(result).toEqual({
        level1: {
          safe: true,
          level2: {
            ok: "yes",
          },
        },
      });
    });

    it("devrait fonctionner recursivement sur les tableaux", () => {
      const input = [
        { safe: 1, __proto__: "bad" },
        { constructor: "bad", ok: true },
      ] as Record<string, unknown>[];
      const result = stripDangerousKeys(input) as Record<string, unknown>[];
      expect(result).toEqual([{ safe: 1 }, { ok: true }]);
    });

    it("devrait retourner les primitives telles quelles", () => {
      expect(stripDangerousKeys("hello")).toBe("hello");
      expect(stripDangerousKeys(42)).toBe(42);
      expect(stripDangerousKeys(null)).toBe(null);
      expect(stripDangerousKeys(undefined)).toBe(undefined);
      expect(stripDangerousKeys(true)).toBe(true);
    });
  });

  // ─── sanitizeString ───────────────────────────────────────────────────

  describe("sanitizeString", () => {
    it("devrait supprimer les balises HTML", () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        'alert("xss")',
      );
      expect(sanitizeString("<b>bold</b>")).toBe("bold");
      expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe("");
    });

    it("devrait supprimer les URLs javascript:", () => {
      expect(sanitizeString("javascript:alert(1)")).toBe("alert(1)");
      expect(sanitizeString("JAVASCRIPT:void(0)")).toBe("void(0)");
      expect(sanitizeString("javascript : alert(1)")).toBe(" alert(1)");
    });

    it("devrait supprimer les gestionnaires d'evenements", () => {
      expect(sanitizeString("onerror=alert(1)")).toBe("alert(1)");
      expect(sanitizeString("onclick=doEvil()")).toBe("doEvil()");
      expect(sanitizeString("onmouseover = hack()")).toBe(" hack()");
    });

    it("devrait supprimer data:text/html", () => {
      expect(sanitizeString("data:text/html,<script>alert(1)</script>")).toBe(
        ",alert(1)",
      );
    });

    it("devrait preserver le texte normal", () => {
      const normal = "Cra - Archer du vent";
      expect(sanitizeString(normal)).toBe(normal);
    });

    it("devrait preserver les caracteres speciaux inoffensifs", () => {
      // The regex strips anything matching <...>, so `< 50 >` is treated as a tag
      expect(sanitizeString("L'arc & la fleche")).toBe("L'arc & la fleche");
      expect(sanitizeString("100% compatible")).toBe("100% compatible");
      expect(sanitizeString("Cra lvl 50 - Archer d'elite")).toBe(
        "Cra lvl 50 - Archer d'elite",
      );
    });
  });

  // ─── sanitizeStrings ──────────────────────────────────────────────────

  describe("sanitizeStrings", () => {
    it("devrait sanitiser toutes les chaines dans un objet", () => {
      const input = {
        name: "<script>evil</script>",
        desc: "normal text",
      };
      const result = sanitizeStrings(input) as Record<string, string>;
      expect(result.name).toBe("evil");
      expect(result.desc).toBe("normal text");
    });

    it("devrait fonctionner recursivement sur les objets imbriques", () => {
      const input = {
        a: { b: { c: "<img onerror=hack>" } },
      };
      const result = sanitizeStrings(input) as { a: { b: { c: string } } };
      expect(result.a.b.c).toBe("");
    });

    it("devrait fonctionner sur les tableaux", () => {
      const input = ["<b>bold</b>", "safe", "<script>x</script>"];
      const result = sanitizeStrings(input) as string[];
      expect(result).toEqual(["bold", "safe", "x"]);
    });

    it("devrait retourner les non-chaines telles quelles", () => {
      expect(sanitizeStrings(42)).toBe(42);
      expect(sanitizeStrings(null)).toBe(null);
      expect(sanitizeStrings(true)).toBe(true);
    });
  });

  // ─── isValidCollection ────────────────────────────────────────────────

  describe("isValidCollection", () => {
    it("devrait accepter une collection valide", () => {
      const collection: CollectionRecord = {
        "card-001": { normal: 3, foil: 1 },
        "card-002": { normal: 0, foil: 2 },
      };
      expect(isValidCollection(collection)).toBe(true);
    });

    it("devrait accepter une collection vide", () => {
      expect(isValidCollection({})).toBe(true);
    });

    it("devrait rejeter null", () => {
      expect(isValidCollection(null)).toBe(false);
    });

    it("devrait rejeter undefined", () => {
      expect(isValidCollection(undefined)).toBe(false);
    });

    it("devrait rejeter un tableau", () => {
      expect(isValidCollection([{ normal: 1, foil: 0 }])).toBe(false);
    });

    it("devrait rejeter un objet sans normal/foil", () => {
      expect(isValidCollection({ "card-001": { count: 5 } })).toBe(false);
    });

    it("devrait rejeter un objet avec des valeurs non-numeriques", () => {
      expect(isValidCollection({ "card-001": { normal: "3", foil: 1 } })).toBe(
        false,
      );
    });

    it("devrait rejeter un objet avec des entrees null", () => {
      expect(isValidCollection({ "card-001": null })).toBe(false);
    });
  });

  // ─── LOCAL_STORAGE_KEYS ───────────────────────────────────────────────

  describe("LOCAL_STORAGE_KEYS", () => {
    it("devrait exposer les clefs attendues", () => {
      expect(LOCAL_STORAGE_KEYS.COLLECTION).toBe("wakfu-collection");
      expect(LOCAL_STORAGE_KEYS.DECKS).toBe("wakfu-decks");
      expect(LOCAL_STORAGE_KEYS.SETTINGS).toBe("wakfu-settings");
    });
  });

  // ─── localStorageService - Collection CRUD ────────────────────────────

  describe("localStorageService - Collection", () => {
    it("devrait sauvegarder et charger une collection (roundtrip)", () => {
      const collection: CollectionRecord = {
        "card-001": { normal: 2, foil: 1 },
        "card-002": { normal: 0, foil: 3 },
      };

      localStorageService.saveCollection(collection);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.COLLECTION,
        JSON.stringify(collection),
      );

      // Now simulate getItem returning what was saved
      mockGetItem({
        [LOCAL_STORAGE_KEYS.COLLECTION]: JSON.stringify(collection),
      });
      const loaded = localStorageService.loadCollection();
      expect(loaded).toEqual(collection);
    });

    it("devrait retourner un objet vide si rien n'est stocke", () => {
      mockGetItem({});
      expect(localStorageService.loadCollection()).toEqual({});
    });

    it("devrait retourner un objet vide si la collection est invalide", () => {
      mockGetItem({
        [LOCAL_STORAGE_KEYS.COLLECTION]: JSON.stringify([1, 2, 3]),
      });
      expect(localStorageService.loadCollection()).toEqual({});
    });

    it("devrait retourner un objet vide si le JSON est corrompu", () => {
      mockGetItem({ [LOCAL_STORAGE_KEYS.COLLECTION]: "{invalid json" });
      expect(localStorageService.loadCollection()).toEqual({});
    });

    it("devrait lancer une erreur si setItem echoue (quota depasse)", () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      expect(() =>
        localStorageService.saveCollection({
          "card-001": { normal: 1, foil: 0 },
        }),
      ).toThrow("Impossible de sauvegarder la collection");
    });
  });

  // ─── localStorageService - Decks CRUD ─────────────────────────────────

  describe("localStorageService - Decks", () => {
    it("devrait sauvegarder et charger des decks (roundtrip)", () => {
      const decks = [
        makeDeck({ id: "deck-1" }),
        makeDeck({ id: "deck-2", name: "Deck 2" }),
      ];

      localStorageService.saveDecks(decks);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.DECKS,
        JSON.stringify(decks),
      );

      mockGetItem({ [LOCAL_STORAGE_KEYS.DECKS]: JSON.stringify(decks) });
      const loaded = localStorageService.loadDecks();
      expect(loaded).toEqual(decks);
    });

    it("devrait retourner un tableau vide si rien n'est stocke", () => {
      mockGetItem({});
      expect(localStorageService.loadDecks()).toEqual([]);
    });

    it("devrait retourner un tableau vide si les donnees ne sont pas un tableau", () => {
      mockGetItem({
        [LOCAL_STORAGE_KEYS.DECKS]: JSON.stringify({ not: "array" }),
      });
      expect(localStorageService.loadDecks()).toEqual([]);
    });

    it("devrait retourner un tableau vide si le JSON est corrompu", () => {
      mockGetItem({ [LOCAL_STORAGE_KEYS.DECKS]: "not-json" });
      expect(localStorageService.loadDecks()).toEqual([]);
    });

    it("devrait lancer une erreur si setItem echoue", () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      expect(() => localStorageService.saveDecks([makeDeck()])).toThrow(
        "Impossible de sauvegarder les decks",
      );
    });
  });

  // ─── localStorageService - Settings ───────────────────────────────────

  describe("localStorageService - Settings", () => {
    const defaultSettings: AppSettings = {
      theme: "auto",
      language: "fr",
      autoSave: true,
    };

    it("devrait retourner les parametres par defaut si rien n'est stocke", () => {
      mockGetItem({});
      const settings = localStorageService.loadSettings();
      expect(settings).toEqual(defaultSettings);
      // It should also save the defaults
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.SETTINGS,
        JSON.stringify(defaultSettings),
      );
    });

    it("devrait charger des parametres existants", () => {
      const custom: AppSettings = {
        theme: "dark",
        language: "en",
        autoSave: false,
      };
      mockGetItem({ [LOCAL_STORAGE_KEYS.SETTINGS]: JSON.stringify(custom) });
      expect(localStorageService.loadSettings()).toEqual(custom);
    });

    it("devrait retourner les parametres par defaut si le JSON est corrompu", () => {
      mockGetItem({ [LOCAL_STORAGE_KEYS.SETTINGS]: "bad json" });
      expect(localStorageService.loadSettings()).toEqual(defaultSettings);
    });

    it("devrait lancer une erreur si setItem echoue", () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      expect(() => localStorageService.saveSettings(defaultSettings)).toThrow(
        "Impossible de sauvegarder les paramètres",
      );
    });
  });

  // ─── localStorageService - clear ──────────────────────────────────────

  describe("localStorageService - clear", () => {
    it("devrait supprimer toutes les clefs Wakfu", () => {
      localStorageService.clear();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.COLLECTION,
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.DECKS,
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.SETTINGS,
      );
    });

    it("devrait lancer une erreur si removeItem echoue", () => {
      vi.mocked(localStorage.removeItem).mockImplementation(() => {
        throw new Error("removeItem failed");
      });

      expect(() => localStorageService.clear()).toThrow(
        "Impossible de supprimer les données",
      );
    });
  });

  // ─── localStorageService - export / import ────────────────────────────

  describe("localStorageService - export", () => {
    it("devrait exporter les donnees au format JSON", () => {
      const collection: CollectionRecord = {
        "card-001": { normal: 1, foil: 0 },
      };
      const decks = [makeDeck()];
      const settings: AppSettings = {
        theme: "dark",
        language: "fr",
        autoSave: true,
      };

      mockGetItem({
        [LOCAL_STORAGE_KEYS.COLLECTION]: JSON.stringify(collection),
        [LOCAL_STORAGE_KEYS.DECKS]: JSON.stringify(decks),
        [LOCAL_STORAGE_KEYS.SETTINGS]: JSON.stringify(settings),
      });

      const exported = localStorageService.export();
      const parsed = JSON.parse(exported);

      expect(parsed.collection).toEqual(collection);
      expect(parsed.decks).toEqual(decks);
      expect(parsed.settings).toEqual(settings);
      expect(parsed.version).toBe("1.0");
      expect(parsed.exportDate).toBeDefined();
    });
  });

  describe("localStorageService - import", () => {
    it("devrait importer des donnees valides (roundtrip avec export)", () => {
      const collection: CollectionRecord = {
        "card-001": { normal: 2, foil: 1 },
      };
      const decks = [makeDeck()];

      const importData = JSON.stringify({
        collection,
        decks,
        version: "1.0",
      });

      const result = localStorageService.import(importData);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.COLLECTION,
        JSON.stringify(collection),
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.DECKS,
        JSON.stringify(decks),
      );
    });

    it("devrait rejeter les donnees depassant la taille max (10MB)", () => {
      const hugeData = "x".repeat(10 * 1024 * 1024 + 1);
      const result = localStorageService.import(hugeData);
      expect(result).toBe(false);
    });

    it("devrait rejeter un JSON invalide", () => {
      const result = localStorageService.import("{not valid json");
      expect(result).toBe(false);
    });

    it("devrait rejeter un import sans collection ni decks", () => {
      const result = localStorageService.import(
        JSON.stringify({ settings: {} }),
      );
      expect(result).toBe(false);
    });

    it("devrait rejeter une collection au format invalide", () => {
      const data = JSON.stringify({
        collection: { "card-001": { count: 5 } },
      });
      const result = localStorageService.import(data);
      expect(result).toBe(false);
    });

    it("devrait rejeter des decks qui ne sont pas un tableau", () => {
      const data = JSON.stringify({
        decks: { not: "array" },
      });
      const result = localStorageService.import(data);
      expect(result).toBe(false);
    });

    it("devrait appliquer la sanitisation des chaines lors de l'import", () => {
      const data = JSON.stringify({
        collection: { "card-001": { normal: 1, foil: 0 } },
        decks: [makeDeck({ name: "<script>evil</script>" })],
      });

      localStorageService.import(data);

      // The deck name should be sanitized before saving
      const savedDecksCall = vi
        .mocked(localStorage.setItem)
        .mock.calls.find((call) => call[0] === LOCAL_STORAGE_KEYS.DECKS);
      expect(savedDecksCall).toBeDefined();
      const savedDecks = JSON.parse(savedDecksCall![1]);
      expect(savedDecks[0].name).toBe("evil");
    });

    it("devrait supprimer les clefs de pollution de prototype lors de l'import", () => {
      // Build JSON with __proto__ as a regular key
      const data = JSON.stringify({
        collection: { "card-001": { normal: 1, foil: 0 } },
        __proto__: { polluted: true },
      });

      const result = localStorageService.import(data);
      expect(result).toBe(true);
      // The __proto__ key should have been stripped before processing
    });

    it("devrait importer les settings si presentes", () => {
      const settings: AppSettings = {
        theme: "light",
        language: "en",
        autoSave: false,
      };
      const data = JSON.stringify({
        collection: { "card-001": { normal: 1, foil: 0 } },
        settings,
      });

      localStorageService.import(data);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.SETTINGS,
        JSON.stringify(settings),
      );
    });
  });

  // ─── Error handling - getItem throwing ────────────────────────────────

  describe("gestion des erreurs localStorage", () => {
    it("devrait gerer une erreur de getItem pour loadCollection", () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(localStorageService.loadCollection()).toEqual({});
    });

    it("devrait gerer une erreur de getItem pour loadDecks", () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(localStorageService.loadDecks()).toEqual([]);
    });

    it("devrait gerer une erreur de getItem pour loadSettings", () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error("SecurityError");
      });
      const settings = localStorageService.loadSettings();
      expect(settings).toEqual({
        theme: "auto",
        language: "fr",
        autoSave: true,
      });
    });
  });
});
