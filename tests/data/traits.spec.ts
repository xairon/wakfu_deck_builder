import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

interface RawEffect {
  description?: string;
  coverage?: string;
}
interface RawCard {
  id?: string;
  mainType?: string;
  metier?: string[];
  producesElement?: string;
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

const METIERS = new Set(["Bricoleur", "Forgeron", "Bijoutier", "Armurier"]);
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

function effects(c: RawCard): RawEffect[] {
  return [
    ...(c.effects ?? []),
    ...(c.recto?.effects ?? []),
    ...(c.verso?.effects ?? []),
  ];
}

describe("couche traits", () => {
  it("devrait extraire le métier et reclasser son token en coverage=trait", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        const t = norm(e.description ?? "");
        const m = {
          bricoleur: "Bricoleur",
          forgeron: "Forgeron",
          bijoutier: "Bijoutier",
          armurier: "Armurier",
        }[t];
        if (!m) continue;
        if (!(c.metier ?? []).includes(m))
          bad.push(
            `${c.id}: metier=${JSON.stringify(c.metier)} doit inclure ${m}`,
          );
        if (e.coverage !== "trait")
          bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait reclasser « Héros : X » en coverage=trait", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        if (/^heros\s*:\s*.+$/.test(norm(e.description ?? ""))) {
          if (e.coverage !== "trait")
            bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("ne devrait promouvoir que des valeurs de métier valides", () => {
    for (const c of cards) {
      for (const m of c.metier ?? []) expect(METIERS.has(m)).toBe(true);
    }
  });

  it("devrait reclasser le producteur coloré « Produisez une Ressource [X] » en trait + producesElement", () => {
    // W46 : les Pious (Allié, un seul Élément coloré) → coverage:trait +
    // card.producesElement (color-fixing modélisé par resourceElement).
    const bad: string[] = [];
    for (const c of cards) {
      if (c.mainType !== "Allié") continue;
      for (const e of c.effects ?? []) {
        if (!/^produisez une ressource\b/.test(norm(e.description ?? "")))
          continue;
        // n'exige la promotion QUE pour les mono-Élément (l'invariant complet est
        // dans compileEffects ; ici on vérifie la cohérence trait ⇔ producesElement)
        if (e.coverage === "trait" && !c.producesElement)
          bad.push(`${c.id}: trait sans producesElement`);
        if (c.producesElement && e.coverage !== "trait")
          bad.push(`${c.id}: producesElement mais coverage=${e.coverage}`);
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
    // au moins les 8 Pious (incarnam + chaos-dogrest) sont promus
    expect(
      cards.filter((c) => c.producesElement).length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("ne devrait PAS reclasser un trait noyé dans une phrase", () => {
    for (const c of cards) {
      for (const e of effects(c)) {
        if (e.coverage !== "trait") continue;
        const t = norm(e.description ?? "");
        const isToken =
          ["bricoleur", "forgeron", "bijoutier", "armurier"].includes(t) ||
          /^heros\s*:\s*.+$/.test(t) ||
          // trait de PRODUCTEUR coloré (« Produisez une Ressource [X] ») — promu
          // en card.producesElement, lu par resourceElement.
          (/^produisez une ressource\b/.test(t) && !!c.producesElement);
        if (!isToken)
          throw new Error(`fausse promotion trait: '${e.description}'`);
      }
    }
  });
});
