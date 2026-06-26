import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardSchema } from "@/schema";

const DATA_DIR = join(process.cwd(), "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

describe("validation du schéma de cartes (public/data)", () => {
  for (const file of EXTENSION_FILES) {
    it(`devrait valider toutes les cartes de ${file}`, () => {
      const raw = readFileSync(join(DATA_DIR, file), "utf8");
      const cards = JSON.parse(raw) as unknown[];
      expect(Array.isArray(cards)).toBe(true);
      const failures: string[] = [];
      for (const card of cards) {
        const res = cardSchema.safeParse(card);
        if (!res.success) {
          const id = (card as { id?: string }).id ?? "?";
          failures.push(`${id}: ${res.error.issues[0]?.message ?? "invalide"}`);
        }
      }
      expect(failures, failures.slice(0, 5).join(" | ")).toHaveLength(0);
    });
  }

  it("devrait rejeter une carte avec une clé inconnue (schéma strict)", () => {
    const validCard = {
      id: "test-1",
      name: "Carte de test",
      mainType: "Action",
      subTypes: [],
      extension: { name: "Astrub" },
      rarity: "Commune",
      artists: [],
      effects: [],
    };
    // La carte minimale est valide telle quelle…
    expect(cardSchema.safeParse(validCard).success).toBe(true);
    // …mais ajouter une clé top-level inconnue doit FAIRE ÉCHOUER le parse.
    expect(cardSchema.safeParse({ ...validCard, __bogus: true }).success).toBe(
      false,
    );
  });
});
