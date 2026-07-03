/**
 * Vague W58 (deck-driven, starter Incarnam Crapaud Mufle) — COÛT DE MILL.
 *
 * Crapaud Mufle : « Défaussez la première carte de votre Pioche : le Crapaud
 * Mufle gagne +2 en Force jusqu'à la fin du tour. N'utilisez ce pouvoir qu'une
 * seule fois par tour. »
 *
 * Briques :
 *  1) DSL — « Défaussez la première carte de votre Pioche : CORPS » → cost
 *     paidOps [costMillTop{n:1}, ...body] + flag oncePerTurn (verrou, la source
 *     n'incline pas). CORPS FIXE via compileBody.
 *  2) Moteur — costMillTop : mill DÉTERMINISTE du sommet (pioche[0]) vers la
 *     Défausse, aucun choix ; impayable (Pioche < n) → corps non exécuté.
 */
import { describe, it, expect, vi } from "vitest";
import { compileTapEffectText } from "@/game/rules";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectiveForce } from "../../stats";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — coût de mill (Crapaud Mufle)", () => {
  it("texte complet → cost paidOps [costMillTop{1}, buffForceSelf{2}] + oncePerTurn", () => {
    const c = compileTapEffectText(
      "Défaussez la première carte de votre Pioche : le Crapaud Mufle gagne +2 en Force jusqu'à la fin du tour. N'utilisez ce pouvoir qu'une seule fois par tour.",
      "Crapaud Mufle",
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "paidOps",
      oncePerTurn: true,
      ops: [
        { op: "costMillTop", n: 1 },
        { op: "buffForceSelf", n: 2 },
      ],
    });
  });

  it("STRICT : corps non compilable → tout l'effet reste manuel", () => {
    expect(
      compileTapEffectText(
        "Défaussez la première carte de votre Pioche : blabla incompréhensible.",
        "X",
      ),
    ).toBeNull();
  });

  it("STRICT : variante multi-cartes (« les deux premières ») non captée → manuel", () => {
    expect(
      compileTapEffectText(
        "Défaussez les deux premières cartes de votre Pioche : piochez une carte.",
        "X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur — costMillTop ───────────────────────────────────────────
function mockDepsFromFixture(
  f: ReturnType<typeof fixture>,
  onDispatch: (drafts: unknown[]) => void,
): EffectEngineDeps {
  return {
    getState: () => ctxOf(f).state,
    rulesCtx: () => ctxOf(f) as never,
    getCard: (id: string | null) => ctxOf(f).getCard(id),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn((...drafts: unknown[]) => onDispatch(drafts)),
    moveTo: vi.fn(
      (instanceId: string, to: { zone: string; owner?: string }) => {
        // déplacement minimal : retire de la Pioche, pousse en Défausse (mutation
        // du state réel de la fixture, comme le vrai moveTo du store).
        const st = ctxOf(f).state as unknown as {
          seats: Record<string, { pioche: string[]; defausse: string[] }>;
          instances: Record<string, { location: { zone: string } }>;
        };
        const owner = to.owner ?? "A";
        for (const s of Object.values(st.seats)) {
          const idx = s.pioche.indexOf(instanceId);
          if (idx >= 0) s.pioche.splice(idx, 1);
        }
        st.seats[owner].defausse.push(instanceId);
        if (st.instances[instanceId])
          st.instances[instanceId].location = { zone: to.zone };
      },
    ),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  } as unknown as EffectEngineDeps;
}

/** Ajoute des cartes fantômes au sommet de la Pioche du siège. */
function seedPioche(
  f: ReturnType<typeof fixture>,
  seat: string,
  ids: string[],
) {
  const st = ctxOf(f).state as unknown as {
    seats: Record<string, { pioche: string[] }>;
    instances: Record<string, unknown>;
  };
  for (const id of ids) {
    st.instances[id] = {
      instanceId: id,
      cardId: "ghost",
      owner: seat,
      controller: seat,
      orientation: "upright",
      location: { zone: "pioche" },
      counters: {},
    };
  }
  st.seats[seat].pioche = [...ids, ...st.seats[seat].pioche];
}

describe("moteur — costMillTop (Crapaud Mufle)", () => {
  const OPS = [
    { op: "costMillTop" as const, n: 1 },
    { op: "buffForceSelf" as const, n: 2 },
  ];

  it("paie le coût : la première carte de la Pioche part en Défausse, puis +2 Force", () => {
    const f = fixture([makeAlly("crapaud", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    seedPioche(f, "A", ["top1", "top2"]);
    const engine = createEffectEngine(
      mockDepsFromFixture(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Crapaud Mufle",
      sourceId: instId("A", 0),
      ops: OPS,
    });
    const st = ctxOf(f).state as unknown as {
      seats: Record<string, { pioche: string[]; defausse: string[] }>;
    };
    expect(st.seats.A.pioche[0]).toBe("top2"); // top1 millé
    expect(st.seats.A.defausse).toContain("top1");
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(5); // 3 + 2
  });

  it("coût impayable (Pioche vide) : AUCUN buff (corps non exécuté)", () => {
    const f = fixture([makeAlly("crapaud", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    // Pioche laissée vide.
    const st0 = ctxOf(f).state as unknown as {
      seats: Record<string, { pioche: string[] }>;
    };
    st0.seats.A.pioche = [];
    const engine = createEffectEngine(
      mockDepsFromFixture(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Crapaud Mufle",
      sourceId: instId("A", 0),
      ops: OPS,
    });
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(3); // inchangé
  });
});
