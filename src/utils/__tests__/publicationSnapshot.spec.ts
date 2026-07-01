import { describe, it, expect } from "vitest";
import {
  publicationSnapshotHash,
  type SnapshotInput,
} from "@/utils/publicationSnapshot";

const base: SnapshotInput = {
  name: "Mono Feu",
  heroId: "hero1",
  havreSacId: "hs1",
  cards: [
    { cardId: "c1", quantity: 3 },
    { cardId: "c2", quantity: 1 },
    { cardId: "r1", quantity: 2, isReserve: true },
  ],
};

describe("publicationSnapshotHash", () => {
  it("est stable pour un même deck", () => {
    expect(publicationSnapshotHash(base)).toBe(publicationSnapshotHash(base));
  });

  it("est insensible à l'ordre des cartes", () => {
    const reordered: SnapshotInput = {
      ...base,
      cards: [base.cards[2], base.cards[0], base.cards[1]],
    };
    expect(publicationSnapshotHash(reordered)).toBe(
      publicationSnapshotHash(base),
    );
  });

  it("change si une quantité change", () => {
    const changed: SnapshotInput = {
      ...base,
      cards: [{ ...base.cards[0], quantity: 2 }, base.cards[1], base.cards[2]],
    };
    expect(publicationSnapshotHash(changed)).not.toBe(
      publicationSnapshotHash(base),
    );
  });

  it("distingue une carte de la réserve d'une carte du deck principal", () => {
    const mainOnly: SnapshotInput = {
      ...base,
      cards: [
        base.cards[0],
        base.cards[1],
        { cardId: "r1", quantity: 2 }, // même carte, mais plus en réserve
      ],
    };
    expect(publicationSnapshotHash(mainOnly)).not.toBe(
      publicationSnapshotHash(base),
    );
  });

  it("change si le héros, le havre-sac ou le nom change", () => {
    expect(publicationSnapshotHash({ ...base, heroId: "hero2" })).not.toBe(
      publicationSnapshotHash(base),
    );
    expect(publicationSnapshotHash({ ...base, havreSacId: "hs2" })).not.toBe(
      publicationSnapshotHash(base),
    );
    expect(publicationSnapshotHash({ ...base, name: "Autre" })).not.toBe(
      publicationSnapshotHash(base),
    );
  });

  it("ignore les espaces autour du nom", () => {
    expect(publicationSnapshotHash({ ...base, name: "  Mono Feu  " })).toBe(
      publicationSnapshotHash(base),
    );
  });
});
