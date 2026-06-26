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
interface RawKeyword {
  name?: string;
  value?: number;
  description?: string;
}
interface RawCard {
  id?: string;
  keywords?: RawKeyword[];
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[]; keywords?: RawKeyword[] };
  verso?: { effects?: RawEffect[]; keywords?: RawKeyword[] };
}

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

const PROMOTED = new Set([
  "Géant",
  "Agilité",
  "Agressivité",
  "Tacle",
  "Renfort",
  "Défense",
  "Fantôme",
  "Capture",
  "Éthérée",
]);
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
const TOKEN_NAMES: Record<string, string> = {
  geant: "Géant",
  agilite: "Agilité",
  agressivite: "Agressivité",
  tacle: "Tacle",
  renfort: "Renfort",
  defense: "Défense",
  fantome: "Fantôme",
  capture: "Capture",
  etheree: "Éthérée",
};

function effects(c: RawCard): RawEffect[] {
  return [
    ...(c.effects ?? []),
    ...(c.recto?.effects ?? []),
    ...(c.verso?.effects ?? []),
  ];
}

describe("couche mots-clés", () => {
  it("devrait reclasser tout token mot-clé en coverage=keyword + keywords[]", () => {
    const bad: string[] = [];
    for (const c of cards) {
      for (const e of effects(c)) {
        const t = norm(e.description ?? "");
        const m = t.match(/^([a-zéèêàùûôîç]+)\s*:?\s*(\d+)$/);
        const headValued = m && ["capture", "etheree"].includes(m[1]);
        const name =
          TOKEN_NAMES[t] ?? (headValued ? TOKEN_NAMES[m![1]] : undefined);
        if (!name) continue;
        if (e.coverage !== "keyword")
          bad.push(`${c.id}: '${e.description}' coverage=${e.coverage}`);
        const has = (c.keywords ?? []).some((k) => k.name === name);
        if (!has) bad.push(`${c.id}: '${name}' absent de keywords[]`);
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait porter une value numérique sur Capture/Éthérée promus", () => {
    const valued = cards.flatMap((c) =>
      (c.keywords ?? []).filter(
        (k) => k.name === "Capture" || k.name === "Éthérée",
      ),
    );
    expect(valued.length).toBeGreaterThan(0);
    for (const k of valued) expect(typeof k.value).toBe("number");
  });

  it("ne devrait PAS promouvoir un mot-clé noyé dans une phrase", () => {
    // un effet phrase contenant 'tacle'/'défense' ne doit pas être coverage=keyword
    const sentences = cards
      .flatMap(effects)
      .filter((e) => (e.description ?? "").split(/\s+/).length > 3);
    for (const e of sentences) {
      if (e.coverage === "keyword")
        throw new Error(`fausse promotion: '${e.description}'`);
    }
  });

  it("devrait promouvoir un volume de tokens cohérent (>200)", () => {
    const n = cards
      .flatMap(effects)
      .filter((e) => e.coverage === "keyword").length;
    expect(n).toBeGreaterThan(200);
  });
});
