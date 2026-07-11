/**
 * VERROU STRUCTUREL (bug Amar Casto 2026-07-10) : un script de carte au
 * trigger "onPlay" n'est consommé QUE pour les ACTIONS (playEffects) ; pour
 * un permanent (Allié, Équipement, Zone…), l'arrivée en jeu ne lit que
 * "onArrive" (arrivalEffects) — un script onPlay y serait MUET (Amar Casto ne
 * proposait jamais son choix de Métier). Ce test croise CHAQUE script avec le
 * mainType réel de sa carte dans les données.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_SCRIPTS } from "../cardScripts";
import type { Card } from "@/types/cards";

function loadTypes(): Map<string, string> {
  const dir = join(process.cwd(), "public", "data");
  const byId = new Map<string, string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    let arr: unknown;
    try {
      arr = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const c of arr as Card[]) byId.set(c.id, c.mainType);
  }
  return byId;
}

describe("CARD_SCRIPTS — cohérence trigger × type de carte", () => {
  it("aucun script onPlay sur un PERMANENT (il serait muet à l'arrivée)", () => {
    const types = loadTypes();
    const offenders: string[] = [];
    for (const [cardId, atoms] of Object.entries(CARD_SCRIPTS)) {
      const mainType = types.get(cardId);
      if (!mainType) continue; // id de test / carte hors données
      if (mainType === "Action") continue;
      for (const atom of Object.values(atoms)) {
        // Les entrées ruling/errata (kind) ne portent pas de trigger.
        if ("trigger" in atom && atom.trigger === "onPlay")
          offenders.push(`${cardId} (${mainType})`);
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});
