import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou de récupération « re-scrape batch3 ».
 *
 * Le scrape original avait perdu des glyphes d'icônes dans ~126 descriptions
 * d'effets (icônes de coût/élément/Ressource, mots-clés), laissant des
 * artefacts de ponctuation (« est augmenté de . », « gagnent . »,
 * « recyclez … Monstres . », « payer . », « réduit de , jusqu'à un minimum
 * de . »…). Cette passe a re-scrapé wtcg-return.fr et patché 65 effets verbatim.
 *
 * Ce test ré-affirme que les descriptions patchées ne contiennent PLUS ces
 * artefacts d'icône perdue — il échouera si une régression réintroduit le texte
 * cassé (ex. un re-scrape ou une recompilation qui écrase la donnée).
 */

const DATA_DIR = join(process.cwd(), "public", "data");

interface RawEffect {
  description?: string;
}
interface RawCard {
  id?: string;
  effects?: RawEffect[];
}

// (fichier, id de carte, index d'effet) des 65 effets patchés cette passe.
const PATCHED: ReadonlyArray<readonly [string, string, number]> = [
  ["amakna.json", "amakna-le-village-amakna", 0],
  ["astrub.json", "isletate-le-vampyre-astrub", 0],
  ["bonta-brakmar.json", "araknotanker-grouilleux-bonta-brakmar", 1],
  ["bonta-brakmar.json", "arc-hord-eon-bonta-brakmar", 0],
  ["bonta-brakmar.json", "baton-bah-pik-bonta-brakmar", 0],
  ["bonta-brakmar.json", "bottes-dorees-d-hogmeiser-bonta-brakmar", 0],
  ["bonta-brakmar.json", "cape-ceremoniale-bonta-brakmar", 0],
  ["bonta-brakmar.json", "dagues-haih-ri-don-bonta-brakmar", 0],
  ["bonta-brakmar.json", "dopeul-eniripsa-bonta-brakmar", 0],
  ["bonta-brakmar.json", "dopeul-sacrieur-bonta-brakmar", 1],
  ["bonta-brakmar.json", "dopeul-sadida-bonta-brakmar", 1],
  ["bonta-brakmar.json", "dopeul-sram-bonta-brakmar", 1],
  ["bonta-brakmar.json", "enclos-de-dragodindes-bonta-brakmar", 0],
  ["bonta-brakmar.json", "foudroiement-bonta-brakmar", 0],
  ["bonta-brakmar.json", "pelle-rin-bonta-brakmar", 0],
  ["bonta-brakmar.json", "surveillant-vampyre-bonta-brakmar", 0],
  ["chaos-dogrest.json", "ceinture-du-champion-chaos-dogrest", 0],
  ["chaos-dogrest.json", "fantomayte-chaos-dogrest", 2],
  ["chaos-dogrest.json", "grozilla-chaos-dogrest", 1],
  ["chaos-dogrest.json", "kloe-psidre-chaos-dogrest", 0],
  ["chaos-dogrest.json", "l-etendue-de-cra-chaos-dogrest", 1],
  ["dofus-collection.json", "abraknyde-dofus-collection", 0],
  ["dofus-collection.json", "echec-critique-dofus-collection", 1],
  ["ile-des-wabbits.json", "echec-critique-ile-des-wabbits", 1],
  ["incarnam.json", "abraknyde-incarnam", 0],
  ["incarnam.json", "echec-critique-incarnam", 1],
  ["incarnam.json", "erbus-erport-incarnam", 0],
  ["incarnam.json", "espece-en-danger-incarnam", 0],
  ["incarnam.json", "fleche-blizzard-incarnam", 0],
  ["incarnam.json", "la-folle-incarnam", 0],
  ["otomai.json", "anna-jaizik-otomai", 0],
  ["otomai.json", "dopeul-ecaflip-otomai", 0],
  ["otomai.json", "july-vamine-otomai", 0],
  ["otomai.json", "bash-skwal-otomai", 1],
  ["otomai.json", "remington-otomai", 1],
  ["otomai.json", "dopeul-iop-otomai", 0],
  ["otomai.json", "gelee-royale-citron-otomai", 1],
  ["otomai.json", "terry-l-ermite-otomai", 0],
  ["otomai.json", "o-zaune-otomai", 0],
  ["otomai.json", "dopeul-cra-otomai", 0],
  ["otomai.json", "demon-xv-otomai", 1],
  ["otomai.json", "niko-la-flameche-otomai", 0],
  ["otomai.json", "maskemane-otomai", 1],
  ["otomai.json", "dopeul-osamodas-otomai", 0],
  ["otomai.json", "gamine-zoth-otomai", 0],
  ["otomai.json", "minotot-otomai", 1],
  ["otomai.json", "village-des-dopeuls-otomai", 1],
  ["otomai.json", "marteau-mato-otomai", 0],
  ["pandala.json", "boomba-pandala", 0],
  ["pandala.json", "botan-ficus-pandala", 0],
  ["pandala.json", "bracelet-du-chef-crocodaille-pandala", 0],
  ["pandala.json", "chapeau-aerdala-pandala", 0],
  ["pandala.json", "dagues-de-boisaille-pandala", 1],
  ["pandala.json", "dopeul-enutrof-pandala", 0],
  ["pandala.json", "dopeul-feca-pandala", 0],
  ["pandala.json", "dopeul-pandawa-pandala", 1],
  ["pandala.json", "dopeul-xelor-pandala", 0],
  ["pandala.json", "epee-de-boisaille-pandala", 1],
  ["pandala.json", "lotie-pandala", 0],
  ["pandala.json", "ordre-de-mission-pandala", 0],
  ["pandala.json", "ranger-bleu-pandala", 2],
  ["pandala.json", "ranger-rouge-pandala", 1],
  ["pandala.json", "ranger-vert-pandala", 2],
  ["pandala.json", "ranger-violet-pandala", 1],
  ["pandala.json", "touffe-pandala", 0],
];

/**
 * Artefacts d'icône perdue (la ponctuation/le vide laissé après suppression du
 * glyphe). On vise les signatures de corruption, pas le texte français normal :
 *   - « de . » / « de , »            (coût/valeur perdu après « de »)
 *   - « gagne[nt] . » / « gagne et »  (mot-clé perdu après « gagne »)
 *   - « Monstres . » / « Dommage(s) . »/ « payer . » / « Ressource(s) . »
 *   - « Force N . » (élément du jeton perdu)
 *   - « : . » et double espace (vides résiduels)
 */
const ARTIFACTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bde\s+[.,]/, "« de » suivi de ponctuation (valeur/coût perdu)"],
  [/\bgagnent?\s+[.,]/, "« gagne(nt) » suivi de ponctuation (mot-clé perdu)"],
  [/\bgagnent?\s+et\b/, "« gagne(nt) et » (mot-clé perdu)"],
  [/\bMonstres\s+\./, "« Monstres . » (élément perdu)"],
  [/\bDommages?\s+\./, "« Dommage(s) . » (élément perdu)"],
  [/\bpayer\s+\./, "« payer . » (coût perdu)"],
  [/\bRessources?\s+\./, "« Ressource(s) . » (élément perdu)"],
  [/\bForce\s+\d+\s+\./, "« Force N . » (élément du jeton perdu)"],
  [/:\s*\./, "« : . » (vide résiduel)"],
  [/\s{2,}/, "double espace (glyphe supprimé)"],
  [/d['’]être\s+\./, "« d'être . » (mot perdu)"],
];

const cacheByFile = new Map<string, RawCard[]>();
function load(file: string): RawCard[] {
  if (!cacheByFile.has(file)) {
    cacheByFile.set(
      file,
      JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as RawCard[],
    );
  }
  return cacheByFile.get(file)!;
}

describe("re-scrape batch3 : intégrité des descriptions patchées", () => {
  it("devrait retrouver chaque (carte, index d'effet) patché", () => {
    const missing: string[] = [];
    for (const [file, id, idx] of PATCHED) {
      const card = load(file).find((c) => c.id === id);
      if (!card || !card.effects?.[idx]?.description) {
        missing.push(`${file}:${id}#${idx}`);
      }
    }
    expect(missing, missing.join(" | ")).toHaveLength(0);
  });

  it("ne devrait plus contenir d'artefact d'icône perdue", () => {
    const broken: string[] = [];
    for (const [file, id, idx] of PATCHED) {
      const desc = load(file).find((c) => c.id === id)?.effects?.[idx]
        ?.description;
      if (typeof desc !== "string") continue;
      for (const [re, label] of ARTIFACTS) {
        if (re.test(desc)) {
          broken.push(`${id}#${idx} → ${label} :: ${desc}`);
        }
      }
    }
    expect(broken, broken.slice(0, 8).join("\n")).toHaveLength(0);
  });
});
