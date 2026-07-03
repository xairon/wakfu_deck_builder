/**
 * Vague W57 (deck-driven, starter Incarnam Charge) — ACTOR-BINDING CONDITIONNEL
 * PAR FAMILLE (+ récupération d'icône droppée).
 *
 * Charge : « L'Allié ou Héros de votre choix gagne +2 en Force jusqu'à la fin du
 * tour. S'il s'agit d'un Iop, il gagne Géant en plus. » (icône « Géant »
 * récupérée du raw — la donnée avait « il gagne en plus »).
 *
 * Briques :
 *  1) DSL — tail « S'il s'agit d'un [Famille], il <corps> » sur une tête
 *     d'actor-binding (buffForceTarget) → conditional{selfIsFamily} + corps lié.
 *  2) condSpec `selfIsFamily` — la créature LIÉE (frame.sourceId réécrit) a-t-elle
 *     la Famille ? Évaluée EXACTEMENT sur ses subTypes.
 *  3) compileActorBoundBody — « gagne <Mot-clé> en plus » → grantKeywordSelf.
 */
import { describe, it, expect, vi } from "vitest";
import { compileActionEffectText } from "@/game/rules";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectiveKeywords } from "../keywords";
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
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  } as unknown as EffectEngineDeps;
}

const CHARGE_OPS = [
  {
    op: "buffForceTarget" as const,
    n: 2,
    heroes: true,
    zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
  },
  {
    op: "conditional" as const,
    cond: { cond: "selfIsFamily" as const, sub: "Iop" },
    ops: [{ op: "grantKeywordSelf" as const, keyword: "Géant" as const }],
  },
];

function withSub(a: ReturnType<typeof makeAlly>, subs: string[]) {
  (a as { subTypes: string[] }).subTypes = subs;
  return a;
}

describe("DSL — Charge (actor-binding conditionnel par Famille)", () => {
  it("texte complet → buffForceTarget + conditional{selfIsFamily Iop → grantKeywordSelf Géant}", () => {
    const c = compileActionEffectText(
      "L'Allié ou Héros de votre choix gagne +2 en Force jusqu'à la fin du tour. S'il s'agit d'un Iop, il gagne Géant en plus.",
      "Charge",
      "Neutre",
    );
    expect(c?.trigger).toBe("onPlay");
    expect(c?.actor).toBe("target");
    expect(c?.ops).toEqual([
      {
        op: "buffForceTarget",
        n: 2,
        heroes: true,
        zones: ["monde", "havreSac"],
      },
      {
        op: "conditional",
        cond: { cond: "selfIsFamily", sub: "Iop" },
        ops: [{ op: "grantKeywordSelf", keyword: "Géant" }],
      },
    ]);
  });

  it("RÉGRESSION : le buff SANS tail conditionnel reste un buffForceTarget simple", () => {
    const c = compileActionEffectText(
      "L'Allié ou Héros de votre choix gagne +2 en Force jusqu'à la fin du tour.",
      "X",
      "Neutre",
    );
    expect(c?.ops).toEqual([
      {
        op: "buffForceTarget",
        n: 2,
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
    expect(c?.actor).toBeUndefined();
  });

  it("STRICT : un mot-clé NON câblé en tail → tout l'effet reste manuel", () => {
    expect(
      compileActionEffectText(
        "L'Allié ou Héros de votre choix gagne +2 en Force jusqu'à la fin du tour. S'il s'agit d'un Iop, il gagne Invisibilité en plus.",
        "X",
        "Neutre",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : moteur — résolution actor-bind + conditional selfIsFamily ───────
describe("moteur — Charge : buff +2 puis Géant SI la cible liée est un Iop", () => {
  function run(targetSubs: string[]) {
    const target = withSub(makeAlly("cible", { force: 3 }), targetSubs);
    const f = fixture([makeAlly("src", { force: 1 }), target]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    const engine = createEffectEngine(
      mockDepsFromFixture(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Charge",
      sourceId: instId("A", 0),
      // le store mappe compiled.actor:"target" → frame.actorBind:"target"
      // (gameStore.ts) ; en test moteur direct on pose le champ de frame.
      actorBind: "target",
      ops: CHARGE_OPS,
    });
    // le buff cible-choix ouvre le ciblage ; on choisit l'Allié « cible »
    expect(engine.effectTargeting.value?.op.op).toBe("buffForceTarget");
    engine.effectTargetChoose(instId("A", 1));
    return { f, targetId: instId("A", 1) };
  }

  it("cible Iop : +2 en Force ET Géant conféré", () => {
    const { f, targetId } = run(["Iop"]);
    expect(effectiveForce(ctxOf(f), targetId)).toBe(5); // 3 + 2
    expect(effectiveKeywords(ctxOf(f), targetId).geant).toBe(true);
  });

  it("cible NON-Iop (Cra) : +2 en Force mais AUCUN Géant (corps conditionnel sauté)", () => {
    const { f, targetId } = run(["Cra"]);
    expect(effectiveForce(ctxOf(f), targetId)).toBe(5); // 3 + 2
    expect(effectiveKeywords(ctxOf(f), targetId).geant).toBe(false);
  });
});
