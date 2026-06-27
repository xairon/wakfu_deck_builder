/**
 * Ciblage — returnToHand MULTI-TYPE (whatAny) : « Renvoyez l'Allié, la Zone ou
 * l'Équipement de votre choix … ». L'éligibilité doit accepter chacun des types
 * listés (et rejeter les autres), là où la forme mono-type ne vise que l'Allié.
 */
import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import { effectTargetIds } from "@/game/rules";
import { bringToMonde, ctxOf, fixture, instId, makeAlly } from "./harness";

function asType(id: string, mainType: string): Card {
  return { ...makeAlly(id), mainType } as unknown as Card;
}

describe("rules/effects — returnToHand multi-type (whatAny)", () => {
  it("whatAny [Allié, Zone, Équipement] : éligible pour chacun, pas le Dofus", () => {
    const allie = makeAlly("a");
    const zone = asType("z", "Zone");
    const equip = asType("e", "Équipement");
    const dofus = asType("d", "Dofus");
    const f = fixture([allie, zone, equip, dofus]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    bringToMonde(f, "A", instId("A", 3));
    const ids = effectTargetIds(ctxOf(f), {
      op: "returnToHand",
      whatAny: ["Allié", "Zone", "Équipement"],
      zones: ["monde", "havreSac"],
    });
    expect(ids.sort()).toEqual(
      [instId("A", 0), instId("A", 1), instId("A", 2)].sort(),
    );
    expect(ids).not.toContain(instId("A", 3)); // Dofus exclu
  });

  it("forme mono-type (sans whatAny) ne vise que l'Allié", () => {
    const allie = makeAlly("a");
    const zone = asType("z", "Zone");
    const f = fixture([allie, zone]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(ctxOf(f), {
      op: "returnToHand",
      zones: ["monde", "havreSac"],
    });
    expect(ids).toEqual([instId("A", 0)]);
  });
});
