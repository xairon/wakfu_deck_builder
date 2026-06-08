/**
 * Cache local (par compte) pour la collection et les decks.
 * Supabase reste la source de vérité ; ce cache sert à l'affichage immédiat et
 * à la lecture hors-ligne (PWA). Les clés sont namespacées par id utilisateur.
 */

import type { Deck } from "@/types/cards";
import {
  getActiveUser,
  namespacedKey,
  setActiveUser,
} from "@/services/storageNamespace";

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10MB

/** Shape of a card entry in the collection */
export interface CollectionEntry {
  normal: number;
  foil: number;
}

export type CollectionRecord = Record<string, CollectionEntry>;

/**
 * Strip dangerous prototype-polluting keys from an object recursively
 */
function stripDangerousKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripDangerousKeys);
  }
  if (obj && typeof obj === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      clean[key] = stripDangerousKeys(value);
    }
    return clean;
  }
  return obj;
}

/**
 * Sanitize a string by removing HTML tags and dangerous patterns
 */
function sanitizeString(value: string): string {
  return value
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/javascript\s*:/gi, "") // strip javascript: URLs
    .replace(/on\w+\s*=/gi, "") // strip event handlers like onerror=
    .replace(/data\s*:\s*text\/html/gi, ""); // strip data:text/html
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeStrings(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeStrings);
  }
  if (obj && typeof obj === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      clean[key] = sanitizeStrings(value);
    }
    return clean;
  }
  return obj;
}

/**
 * Validate that a collection object has the correct shape
 */
function isValidCollection(
  collection: unknown,
): collection is CollectionRecord {
  if (
    !collection ||
    typeof collection !== "object" ||
    Array.isArray(collection)
  )
    return false;
  return Object.values(collection as Record<string, unknown>).every(
    (v) =>
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      "normal" in v &&
      "foil" in v &&
      typeof (v as CollectionEntry).normal === "number" &&
      typeof (v as CollectionEntry).foil === "number",
  );
}

export const LOCAL_STORAGE_KEYS = {
  COLLECTION: "wakfu-collection",
  DECKS: "wakfu-decks",
  SETTINGS: "wakfu-settings",
} as const;

export interface AppSettings {
  theme: string;
  language: string;
  autoSave: boolean;
  [key: string]: unknown;
}

export interface LocalStorageService {
  // Collection
  saveCollection(collection: CollectionRecord): void;
  loadCollection(): CollectionRecord;

  // Decks
  saveDecks(decks: Deck[]): void;
  loadDecks(): Deck[];

  // Settings
  saveSettings(settings: AppSettings): void;
  loadSettings(): AppSettings;

  // Utilitaires
  clear(): void;
  export(): string;
  import(data: string): boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  language: "fr",
  autoSave: true,
};

class LocalStorageServiceImpl implements LocalStorageService {
  /**
   * Le compte actif est géré par `storageNamespace` (source unique partagée
   * avec le deckStore). En pratique l'app est cloud-only : les clés sont
   * suffixées par l'id utilisateur connecté (cache hors-ligne par compte).
   * `null` (déconnecté) retombe sur les clés de base, sans données persistées.
   */

  /** Définit le compte actif et donc l'espace de stockage (cache) utilisé. */
  setActiveUser(userId: string | null): void {
    setActiveUser(userId);
  }

  /** Compte actif courant (`null` si déconnecté). */
  getActiveUser(): string | null {
    return getActiveUser();
  }

  /** Construit la clé de stockage en tenant compte du compte actif. */
  getNamespacedKey(baseKey: string): string {
    return namespacedKey(baseKey);
  }

  saveCollection(collection: CollectionRecord): void {
    try {
      localStorage.setItem(
        this.getNamespacedKey(LOCAL_STORAGE_KEYS.COLLECTION),
        JSON.stringify(collection),
      );
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la collection:", error);
      throw new Error("Impossible de sauvegarder la collection");
    }
  }

  loadCollection(): CollectionRecord {
    try {
      const data = localStorage.getItem(
        this.getNamespacedKey(LOCAL_STORAGE_KEYS.COLLECTION),
      );
      if (!data) {
        return {};
      }
      const collection: unknown = JSON.parse(data);
      if (!isValidCollection(collection)) {
        return {};
      }
      return collection;
    } catch (error) {
      console.error("Erreur lors du chargement de la collection:", error);
      return {};
    }
  }

  saveDecks(decks: Deck[]): void {
    try {
      localStorage.setItem(
        this.getNamespacedKey(LOCAL_STORAGE_KEYS.DECKS),
        JSON.stringify(decks),
      );
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des decks:", error);
      throw new Error("Impossible de sauvegarder les decks");
    }
  }

  loadDecks(): Deck[] {
    try {
      const data = localStorage.getItem(
        this.getNamespacedKey(LOCAL_STORAGE_KEYS.DECKS),
      );
      if (!data) {
        return [];
      }
      const decks: unknown = JSON.parse(data);
      if (!Array.isArray(decks)) {
        return [];
      }
      return decks as Deck[];
    } catch (error) {
      console.error("Erreur lors du chargement des decks:", error);
      return [];
    }
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.SETTINGS,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des paramètres:", error);
      throw new Error("Impossible de sauvegarder les paramètres");
    }
  }

  loadSettings(): AppSettings {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
      if (!data) {
        this.saveSettings(DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
      }
      return JSON.parse(data) as AppSettings;
    } catch (error) {
      console.error("Erreur lors du chargement des paramètres:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  clear(): void {
    try {
      Object.values(LOCAL_STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(this.getNamespacedKey(key));
      });
    } catch (error) {
      console.error("Erreur lors de la suppression des données:", error);
      throw new Error("Impossible de supprimer les données");
    }
  }

  export(): string {
    try {
      const exportData = {
        collection: this.loadCollection(),
        decks: this.loadDecks(),
        settings: this.loadSettings(),
        exportDate: new Date().toISOString(),
        version: "1.0",
      };
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      throw new Error("Impossible d'exporter les données");
    }
  }

  import(data: string): boolean {
    try {
      if (data.length > MAX_IMPORT_SIZE) {
        throw new Error("Import data exceeds maximum size limit (10MB)");
      }

      const rawData: unknown = JSON.parse(data);

      // Strip dangerous prototype-polluting keys
      const importData = stripDangerousKeys(rawData) as Record<string, unknown>;

      // Sanitize all string values to strip HTML tags
      const sanitizedData = sanitizeStrings(importData) as Record<
        string,
        unknown
      >;

      if (!sanitizedData.collection && !sanitizedData.decks) {
        throw new Error("Format de données invalide");
      }

      if (sanitizedData.collection) {
        if (!isValidCollection(sanitizedData.collection)) {
          throw new Error(
            "Format de collection invalide: chaque carte doit avoir { normal: number, foil: number }",
          );
        }
        this.saveCollection(sanitizedData.collection);
      }

      if (sanitizedData.decks) {
        if (!Array.isArray(sanitizedData.decks)) {
          throw new Error(
            "Format de decks invalide: les decks doivent être un tableau",
          );
        }
        this.saveDecks(sanitizedData.decks as Deck[]);
      }

      if (sanitizedData.settings) {
        this.saveSettings(sanitizedData.settings as AppSettings);
      }

      return true;
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      return false;
    }
  }
}

// Exported for testing
export {
  stripDangerousKeys,
  sanitizeString,
  sanitizeStrings,
  isValidCollection,
};

// Instance singleton
export const localStorageService = new LocalStorageServiceImpl();

export function useLocalStorage() {
  return localStorageService;
}
