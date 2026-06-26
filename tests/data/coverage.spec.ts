import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mechanicsForOps } from "@/data/mechanics";
import type { CompiledEffectOp } from "@/types/cards";

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
  mechanics?: string[];
  compiled?: { ops?: { op: CompiledEffectOp["op"] }[] };
}
interface RawCard {
  id?: string;
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

function allEffects(card: RawCard): RawEffect[] {
  return [
    ...(card.effects ?? []),
    ...(card.recto?.effects ?? []),
    ...(card.verso?.effects ?? []),
  ];
}

const COVERAGE = new Set(["auto", "manual", "uncovered", "ruling"]);

const cards: RawCard[] = EXTENSION_FILES.flatMap(
  (f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[],
);

describe("invariant de couverture des effets", () => {
  it("devrait poser un coverage valide sur chaque effet", () => {
    const bad: string[] = [];
    for (const card of cards) {
      for (const e of allEffects(card)) {
        if (!e.coverage || !COVERAGE.has(e.coverage)) {
          bad.push(`${card.id}: coverage=${e.coverage}`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait dériver mechanics depuis les ops (point fixe, idempotent)", () => {
    const bad: string[] = [];
    for (const card of cards) {
      for (const e of allEffects(card)) {
        const ops = e.compiled?.ops;
        if (ops && ops.length) {
          const expected = mechanicsForOps(ops);
          if (JSON.stringify(e.mechanics) !== JSON.stringify(expected)) {
            bad.push(`${card.id}: ${JSON.stringify(e.mechanics)}`);
          }
        } else if (e.mechanics !== undefined) {
          bad.push(`${card.id}: mechanics inattendues`);
        }
      }
    }
    expect(bad, bad.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("devrait classer auto/manual/uncovered de façon cohérente avec compiled", () => {
    for (const card of cards) {
      for (const e of allEffects(card)) {
        if (e.coverage === "auto" || e.coverage === "manual") {
          expect(e.compiled, `${card.id}`).toBeTruthy();
        }
        if (e.coverage === "uncovered") {
          expect(e.compiled, `${card.id}`).toBeFalsy();
        }
      }
    }
  });
});
