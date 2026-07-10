/**
 * Tranche W32 — restrictions continues « ne peut ni attaquer, ni bloquer » et
 * « ne peut pas porter d'Équipement ». Recharge les données régénérées par
 * `npm run compile-effects` et vérifie qu'un échantillon représentatif des
 * cartes concernées a bien `coverage:"auto"` + la forme `static` attendue.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CardEffect } from "@/types/cards";
import { compileStaticEffectText } from "../dsl";

describe("static craftingRule — « ne peut (pas) être fabriqué(e/s) » (DSL)", () => {
  it("compile la propriété de Fabrication (A19, hors moteur de table) en static déclaratif", () => {
    for (const [text, name] of [
      ["La Cape du Wa Wabbit ne peut pas être fabriquée.", "Cape du Wa Wabbit"],
      ["Le Tourmenteur ne peut être fabriqué.", "Tourmenteur"],
      [
        "Les Têtes à Clic et à Clac ne peuvent pas être fabriquées.",
        "Têtes à Clic et à Clac",
      ],
    ] as const) {
      expect(compileStaticEffectText(text, name), text).toEqual({
        trigger: "static",
        static: { kind: "craftingRule" },
        ops: [],
      });
    }
  });

  it("le sujet doit être la carte ELLE-MÊME (pas une autre)", () => {
    expect(
      compileStaticEffectText(
        "La Cape du Wa Wabbit ne peut pas être fabriquée.",
        "Une Toute Autre Carte",
      ),
    ).toBeNull();
  });
});

const DATA_DIR = join(process.cwd(), "public", "data");

interface RawCard {
  id: string;
  effects?: CardEffect[];
}

function loadCardsById(): Map<string, RawCard> {
  const byId = new Map<string, RawCard>();
  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const card of parsed as RawCard[]) {
      if (card && typeof card.id === "string") byId.set(card.id, card);
    }
  }
  return byId;
}

const cardsById = loadCardsById();

/** Trouve le premier effet d'une carte dont le static compilé est `kind`. */
function staticEffect(id: string, kind: string): CardEffect | undefined {
  const card = cardsById.get(id);
  return card?.effects?.find((e) => e.compiled?.static?.kind === kind);
}

describe("statics W32 (données régénérées)", () => {
  it("cannotAttackOrBlock : Épouvantail (2 éditions) + Allies Élémentaires", () => {
    for (const id of [
      "epouvantail-amakna",
      "epouvantail-dofus-collection",
      "aero-draft",
      "akwa-draft",
      "pyro-draft",
      "terra-draft",
    ]) {
      const e = staticEffect(id, "cannotAttackOrBlock");
      expect(e, `${id} doit avoir un static cannotAttackOrBlock`).toBeDefined();
      expect(e!.coverage).toBe("auto");
      expect(e!.compiled).toEqual({
        trigger: "static",
        static: { kind: "cannotAttackOrBlock" },
        ops: [],
      });
      // un static n'a pas de mechanics (ops vides), comme cannotBlock
      expect(e!.mechanics).toBeUndefined();
    }
  });

  it("cannotCarryEquipment : les quatre Allies Élémentaires (Draft)", () => {
    for (const id of [
      "aero-draft",
      "akwa-draft",
      "pyro-draft",
      "terra-draft",
    ]) {
      const e = staticEffect(id, "cannotCarryEquipment");
      expect(
        e,
        `${id} doit avoir un static cannotCarryEquipment`,
      ).toBeDefined();
      expect(e!.coverage).toBe("auto");
      expect(e!.compiled).toEqual({
        trigger: "static",
        static: { kind: "cannotCarryEquipment" },
        ops: [],
      });
    }
  });
});
