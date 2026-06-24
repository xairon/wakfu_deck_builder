import { describe, it, expect } from "vitest";
import { DOFUS_MAG_DECKS } from "@/data/dofusMagDecks";

describe("DOFUS_MAG_DECKS — intégrité & invariant 48", () => {
  it("a des ids uniques", () => {
    const ids = DOFUS_MAG_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque deck a héros, havre-sac, ≥1 carte et extension dofus-mag", () => {
    for (const d of DOFUS_MAG_DECKS) {
      expect(d.hero, `${d.id}: hero`).toBeTruthy();
      expect(d.havreSac, `${d.id}: havreSac`).toBeTruthy();
      expect(d.cards.length, `${d.id}: cards`).toBeGreaterThan(0);
      expect(d.extension, `${d.id}: extension`).toBe("dofus-mag");
    }
  });

  it("chaque carte a une quantité >= 1", () => {
    for (const d of DOFUS_MAG_DECKS) {
      for (const c of d.cards) {
        expect(c.quantity, `${d.id}/${c.name}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("INVARIANT: somme des quantités === 48 (50 avec héros + havre-sac)", () => {
    for (const d of DOFUS_MAG_DECKS) {
      const total = d.cards.reduce((s, c) => s + c.quantity, 0);
      expect(total, `${d.id}: attendu 48, obtenu ${total}`).toBe(48);
    }
  });
});
