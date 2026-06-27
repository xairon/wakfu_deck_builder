/**
 * Re-scrape du cluster « gagne <bonus> jusqu'à la fin du tour » (icônes perdues).
 *
 * Au scrape, l'icône de bonus de ces ~32 pouvoirs avait été perdue, laissant des
 * « … gagne . » / « … gagne jusqu'à la fin du tour ». Le texte a été récupéré
 * VERBATIM depuis la source (wtcg-return.fr) et patché dans public/data.
 *
 * Constat de fidélité : AUCUN de ces bonus n'est un buff de Force. Tous confèrent
 * un MOT-CLÉ (Géant / Agilité / Agressivité / Tacle / Fantôme) ou « Résistance N »
 * à une cible CHOISIE / au Porteur / à VOTRE Héros — il n'existe pas d'op fidèle
 * pour « conférer un mot-clé à une cible jusqu'à la fin du tour ». Conformément à
 * « an approximation of gameplay is worse than a manual effect », ces effets sont
 * patchés mais restent NON couverts (uncovered). Ce spec verrouille donc :
 *  1. l'intégrité des données patchées (plus d'icône perdue, mot-clé présent) ;
 *  2. l'absence de MIS-ENCODAGE (ces effets ne compilent PAS en buffForce*) ;
 *  3. des positifs DSL de régression sur les grammaires buffForceTarget /
 *     buffForceHeroSelf (qui restent réservées aux VRAIS buffs de Force) ;
 *  4. un négatif DSL : une cible recevant un mot-clé ne compile PAS en Force.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileActionEffectText } from "@/game/rules/effects/dsl";

const DATA_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "public",
  "data",
);

type RawEffect = {
  description?: string;
  coverage?: string;
  compiled?: unknown;
};
type RawCard = { id?: string; name?: string; effects?: RawEffect[] };

const cache = new Map<string, RawCard[]>();
function loadExt(ext: string): RawCard[] {
  if (!cache.has(ext))
    cache.set(
      ext,
      JSON.parse(readFileSync(join(DATA_DIR, `${ext}.json`), "utf8")),
    );
  return cache.get(ext)!;
}
function effOf(ext: string, id: string, idx: number): RawEffect {
  const card = loadExt(ext).find((c) => c.id === id);
  if (!card) throw new Error(`carte introuvable: ${ext}/${id}`);
  const e = card.effects?.[idx];
  if (!e) throw new Error(`effet introuvable: ${ext}/${id}[${idx}]`);
  return e;
}

/** Échantillon représentatif du cluster patché : ext, id, idx, fragment attendu. */
const PATCHED: ReadonlyArray<readonly [string, string, number, string]> = [
  ["astrub", "batofu-astrub", 1, "gagne Agilité jusqu'à la fin du tour"],
  [
    "chaos-dogrest",
    "anny-koleta-chaos-dogrest",
    0,
    "gagne Agilité jusqu'à la fin du tour",
  ],
  [
    "chaos-dogrest",
    "ocehan-zileveun-chaos-dogrest",
    0,
    "gagne Tacle jusqu'à la fin du tour",
  ],
  [
    "chaos-dogrest",
    "pandaluk-skaiwoker-chaos-dogrest",
    0,
    "gagne Géant jusqu'à la fin du tour",
  ],
  [
    "chaos-dogrest",
    "soda-moza-chaos-dogrest",
    0,
    "gagne Agressivité jusqu'à la fin du tour",
  ],
  [
    "amakna",
    "piqure-motivante-amakna",
    0,
    "Le Monstre de votre choix gagne Agressivité jusqu'à la fin du tour.",
  ],
  [
    "bonta-brakmar",
    "rat-klure-bonta-brakmar",
    0,
    "Le Rat bloqué de votre choix gagne Géant jusqu'à la fin du tour.",
  ],
  [
    "bonta-brakmar",
    "zack-apus-bonta-brakmar",
    0,
    "que vous contrôlez gagne Agressivité jusqu'à la fin du tour",
  ],
  [
    "bonta-brakmar",
    "petit-anneau-de-force-bonta-brakmar",
    1,
    "Détruisez le Petit Anneau de Force : L'Allié ou Héros de votre choix gagne Géant jusqu'à la fin du tour.",
  ],
  [
    "bonta-brakmar",
    "petit-anneau-de-chance-bonta-brakmar",
    1,
    "gagne Tacle jusqu'à la fin du tour",
  ],
  [
    "chaos-dogrest",
    "chaussures-du-tetounik-chaos-dogrest",
    0,
    "de la Classe de votre Héros gagne Agressivité jusqu'à la fin du tour",
  ],
  [
    "dofus-collection",
    "dofus-turquoise-dofus-collection",
    2,
    "Votre Héros gagne Géant.",
  ],
  ["incarnam", "dofus-turquoise-incarnam", 2, "Votre Héros gagne Géant."],
  [
    "otomai",
    "ultime-demeure-otomai",
    0,
    "gagne Fantôme jusqu'à la fin du tour",
  ],
  [
    "astrub",
    "anneau-rigami-astrub",
    0,
    "gagne Résistance 1 (air)(terre)(feu)(eau) jusqu'à la fin du tour",
  ],
  [
    "chaos-dogrest",
    "monsa-von-chaos-dogrest",
    0,
    "gagne Résistance 1 (air)(terre)(eau)(feu)(neutre) jusqu'à la fin du tour",
  ],
];

describe("re-scrape — cluster « gagne <bonus> jusqu'à la fin du tour »", () => {
  describe("intégrité des données patchées", () => {
    for (const [ext, id, idx, fragment] of PATCHED) {
      it(`${id}[${idx}] : icône récupérée, plus de « gagne . »/« gagne jusqu'à »`, () => {
        const desc = effOf(ext, id, idx).description ?? "";
        expect(desc).toContain(fragment);
        // L'icône perdue laissait « gagne . » (point collé) ou « gagne jusqu'à »
        // (bonus manquant juste avant la durée). Aucun des deux ne doit subsister.
        expect(desc).not.toMatch(/gagne\s*\./);
        expect(desc).not.toMatch(/gagne jusqu['’]a/i);
      });
    }
  });

  describe("fidélité : aucun mis-encodage en buff de Force", () => {
    for (const [ext, id, idx] of PATCHED) {
      it(`${id}[${idx}] reste uncovered (mot-clé/Résistance, pas de Force)`, () => {
        const e = effOf(ext, id, idx);
        expect(e.coverage).toBe("uncovered");
        expect(e.compiled).toBeUndefined();
      });
    }
  });

  describe("régression DSL — grammaires buffForce* réservées aux vrais buffs de Force", () => {
    it("« L'Allié de votre choix gagne +1 en Force jusqu'à la fin du tour » → buffForceTarget", () => {
      const c = compileActionEffectText(
        "L'Allié de votre choix gagne +1 en Force jusqu'à la fin du tour.",
        "Carte",
      );
      expect(c?.ops).toEqual([
        {
          op: "buffForceTarget",
          n: 1,
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ]);
    });

    it("« L'Allié ou Héros de votre choix gagne +2 en Force … » → buffForceTarget heroes:true", () => {
      const c = compileActionEffectText(
        "L'Allié ou Héros de votre choix gagne +2 en Force jusqu'à la fin du tour.",
        "Carte",
      );
      expect(c?.ops[0]).toMatchObject({
        op: "buffForceTarget",
        n: 2,
        heroes: true,
      });
    });

    it("« Votre Héros gagne +1 en Force jusqu'à la fin du tour » → buffForceHeroSelf", () => {
      const c = compileActionEffectText(
        "Votre Héros gagne +1 en Force jusqu'à la fin du tour.",
        "Carte",
      );
      expect(c?.ops).toEqual([{ op: "buffForceHeroSelf", n: 1 }]);
    });

    it("négatif : « L'Allié de votre choix gagne Agilité jusqu'à la fin du tour » NE compile PAS (mot-clé, pas Force)", () => {
      const c = compileActionEffectText(
        "L'Allié de votre choix gagne Agilité jusqu'à la fin du tour.",
        "Carte",
      );
      expect(c).toBeNull();
    });

    it("négatif : « Votre Héros gagne Géant. » NE compile PAS en buffForceHeroSelf", () => {
      const c = compileActionEffectText("Votre Héros gagne Géant.", "Carte");
      // Soit null, soit une compilation ne contenant aucun op de Force.
      const ops = c?.ops ?? [];
      expect(ops.some((o) => o.op === "buffForceHeroSelf")).toBe(false);
    });
  });
});
