/**
 * Invariant de données : l'Élément résolu d'une carte doit être celui IMPRIMÉ
 * sur sa page archivée (`raw-card-data/pages/<ext>/<slug>.html`).
 *
 * Le symbole coloré d'une carte vit à deux endroits selon son type :
 *   - orbe « Élément : [X] »          → Actions, Zones, Salles, une partie des Équipements…
 *   - ligne « Force : ±N [X] »        → Alliés, Héros, et l'AUTRE partie des Équipements
 * Une carte n'a jamais les deux. Faute de lire la seconde source, 129 Équipements
 * tombaient en « Neutre » : introuvables par leur couleur dans les filtres, et
 * producteurs de Ressource Neutre. Ce test verrouille les deux chemins.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Card } from "@/types/cards";
import { cardElement } from "@/utils/cardDisplay";

const RAW_DIR = join(process.cwd(), "raw-card-data", "pages");
const DATA_DIR = join(process.cwd(), "public", "data");

const ORB_RE = /Élément\s*:\s*<img[^>]*?title="([^"]+)"/s;
const FORCE_RE = /Force\s*:\s*[-+]?\d+\s*<img[^>]*?title="([^"]+)"/s;
const VALID = new Set(["Air", "Eau", "Feu", "Terre", "Neutre"]);

/** Symbole coloré imprimé sur la page, ou null (Neutre = pas de couleur). */
function printedElement(html: string): string | null {
  const orb = html.match(ORB_RE);
  const el = orb && VALID.has(orb[1]) ? orb[1] : html.match(FORCE_RE)?.[1];
  return el && VALID.has(el) && el !== "Neutre" ? el : null;
}

const extensions = readdirSync(RAW_DIR).filter((ext) =>
  existsSync(join(DATA_DIR, `${ext}.json`)),
);

describe("Élément imprimé (public/data vs pages archivées)", () => {
  it("devrait résoudre l'Élément de chaque carte à son symbole imprimé", () => {
    const mismatches: string[] = [];
    let checked = 0;

    for (const ext of extensions) {
      const cards = JSON.parse(
        readFileSync(join(DATA_DIR, `${ext}.json`), "utf8"),
      ) as Card[];

      for (const card of cards) {
        // slug = id sans le suffixe « -<ext> » (cf. recoverElementOrb.mjs).
        const suffix = `-${ext}`;
        const slug = card.id.endsWith(suffix)
          ? card.id.slice(0, -suffix.length)
          : card.id;
        const htmlPath = join(RAW_DIR, ext, `${slug}.html`);
        if (!existsSync(htmlPath)) continue;

        const printed = printedElement(readFileSync(htmlPath, "utf8"));
        if (!printed) continue;

        checked++;
        const resolved = cardElement(card);
        if (resolved !== printed.toLowerCase()) {
          mismatches.push(
            `${card.name} [${card.mainType}] attendu ${printed}, obtenu ${resolved}`,
          );
        }
      }
    }

    // Garde-fou : si le corpus archivé disparaissait, le test passerait à vide.
    expect(checked).toBeGreaterThan(1000);
    expect(
      mismatches,
      `${mismatches.length} écart(s) — ${mismatches.slice(0, 5).join(" | ")}`,
    ).toHaveLength(0);
  });
});
