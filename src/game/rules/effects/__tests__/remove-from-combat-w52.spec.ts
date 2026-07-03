/**
 * Vague W52 (deck-driven, starters Incarnam) — RETRAIT DU COMBAT (Exclusion) et
 * CONDITION D'ACTIVATION Porteur-en-combat (Dora).
 *
 * Volets :
 *  1) DSL — « L'Allié ou Héros attaquant ou bloqueur de votre choix retourne
 *     incliné dans le Monde » → removeFromCombatTarget (ruling in-data : la
 *     cible CESSE de participer au combat, aucun déplacement de zone).
 *  2) DSL — clause « N'utilisez ce pouvoir que si le Porteur de <self> est
 *     attaquant ou bloqueur » (Dora, requiresIncline) → flag
 *     requiresBearerInCombat ; autres conditions → manuel.
 *  3) Éligibilité — participants du combat DÉCLARÉ uniquement (harness
 *     setCombatState → SET_COMBAT journalisé, comme en ligne).
 *  4) Moteur — la résolution appelle deps.removeFromCombat PUIS incline la
 *     cible (SET_ORIENTATION journalisé).
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import {
  compileActionEffectText,
  compileTapEffectText,
  effectTargetIds,
} from "@/game/rules";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import {
  HERO_A,
  HERO_B,
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  setCombatState,
} from "../../__tests__/harness";

const EXCLUSION_OP = {
  op: "removeFromCombatTarget" as const,
  heroes: true,
  combatRole: "inCombat" as const,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

// ── Volet 1 : DSL Exclusion ──────────────────────────────────────────────────
describe("DSL — removeFromCombatTarget (Exclusion)", () => {
  it("« L'Allié ou Héros attaquant ou bloqueur … retourne incliné dans le Monde »", () => {
    const c = compileActionEffectText(
      "L'Allié ou Héros attaquant ou bloqueur de votre choix retourne incliné dans le Monde.",
      "Exclusion",
    );
    expect(c).toEqual({ trigger: "onPlay", ops: [EXCLUSION_OP] });
  });

  it("STRICT : une 2ᵉ phrase non compilable fait tout rester manuel", () => {
    expect(
      compileActionEffectText(
        "L'Allié ou Héros attaquant ou bloqueur de votre choix retourne incliné dans le Monde. Le contrôleur de cet Allié se défausse d'une carte.",
        "X",
      ),
    ).toBeNull();
  });

  it("STRICT : « Cet Allié … retourne incliné » (référent externe) ne matche pas", () => {
    expect(
      compileActionEffectText(
        "Cet Allié ou Héros retourne incliné dans le Monde.",
        "X",
      ),
    ).toBeNull();
  });
});

// ── Volet 2 : DSL Dora ───────────────────────────────────────────────────────
describe("DSL — requiresBearerInCombat (Dora)", () => {
  it("Dora : clause strippée → flag + corps draw", () => {
    const c = compileTapEffectText(
      "Piochez une carte. N'utilisez ce pouvoir que si le Porteur de la Dora est attaquant ou bloqueur.",
      "Dora",
      "Neutre",
      false,
      true, // requiresIncline (donnée réelle)
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "draw", n: 1 }],
      requiresBearerInCombat: true,
    });
  });

  it("STRICT : SANS requiresIncline, la clause n'est pas strippée → manuel", () => {
    expect(
      compileTapEffectText(
        "Piochez une carte. N'utilisez ce pouvoir que si le Porteur de la Dora est attaquant ou bloqueur.",
        "Dora",
        "Neutre",
        false,
        false,
      ),
    ).toBeNull();
  });

  it("STRICT : sujet ≠ soi (Porteur d'une autre carte) → manuel", () => {
    expect(
      compileTapEffectText(
        "Piochez une carte. N'utilisez ce pouvoir que si le Porteur du Bâton des Rois est attaquant ou bloqueur.",
        "Dora",
        "Neutre",
        false,
        true,
      ),
    ).toBeNull();
  });

  it("STRICT : une AUTRE condition (« est dans le Monde ») → manuel", () => {
    expect(
      compileTapEffectText(
        "Piochez une carte. N'utilisez ce pouvoir que si le Porteur de la Dora est dans le Monde.",
        "Dora",
        "Neutre",
        false,
        true,
      ),
    ).toBeNull();
  });
});

// ── Volet 3 : éligibilité (combat déclaré uniquement) ────────────────────────
describe("effectTargetIds — removeFromCombatTarget", () => {
  it("HORS combat : aucune cible (effet passé)", () => {
    const f = fixture([makeAlly("a")], [makeAlly("b")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    expect(effectTargetIds(ctxOf(f), EXCLUSION_OP, "A")).toEqual([]);
  });

  it("EN combat : seuls les participants (attaquants + bloqueurs) sont éligibles", () => {
    const f = fixture([makeAlly("atk")], [makeAlly("blk"), makeAlly("idle")]);
    bringToMonde(f, "A", instId("A", 0)); // attaquant
    bringToMonde(f, "B", instId("B", 0)); // bloqueur
    bringToMonde(f, "B", instId("B", 1)); // spectateur
    setCombatState(f, "A", { attackers: [instId("A", 0)] });
    // pose un blocage : B0 bloque A0
    const ctx = ctxOf(f);
    ctx.state.combat!.blocks = { [instId("B", 0)]: instId("A", 0) };
    const ids = effectTargetIds(ctx, EXCLUSION_OP, "A");
    expect([...ids].sort()).toEqual([instId("A", 0), instId("B", 0)].sort());
    expect(ids).not.toContain(instId("B", 1)); // hors combat → inéligible
    expect(ids).not.toContain(HERO_A); // Héros non participant → inéligible
    void HERO_B;
  });
});

// ── Volet 4 : moteur — retrait + inclinaison ─────────────────────────────────
function makeCombatState(): GameState {
  const inst = (
    id: string,
    cardId: string,
    controller: "A" | "B",
    extra: Record<string, unknown> = {},
  ) => ({
    instanceId: id,
    cardId,
    owner: controller,
    controller,
    orientation: "upright",
    location: { zone: "monde" as const },
    counters: {},
    ...extra,
  });
  return {
    turn: { active: "A", number: 3, firstPlayer: "A" },
    monde: ["atk", "blk"],
    combat: {
      attackerSeat: "A",
      step: "blockers",
      target: { kind: "ally", instanceId: "blk" },
      attackers: ["atk"],
      blocks: {},
      reactingSeat: "B",
    },
    instances: {
      atk: inst("atk", "cAlly", "A"),
      blk: inst("blk", "cAlly", "B"),
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: null },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: null },
    },
  } as unknown as GameState;
}

const ALLY: Card = {
  id: "cAlly",
  name: "Allié",
  mainType: "Allié",
  extension: "T",
  rarity: "Commune",
  subTypes: [],
  stats: {
    niveau: { value: 1, element: "Feu" },
    force: { value: 2, element: "Feu" },
  },
} as unknown as Card;

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({
      state,
      getCard: (id) => (id === "cAlly" ? ALLY : null),
    }),
    getCard: (id) => (id === "cAlly" ? ALLY : null),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "J",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

describe("moteur — résolution removeFromCombatTarget", () => {
  it("choisir l'attaquant : deps.removeFromCombat(atk) PUIS inclinaison journalisée", () => {
    const state = makeCombatState();
    const dispatch = vi.fn();
    const removeFromCombat = vi.fn();
    const engine = createEffectEngine(
      mockDeps(state, { dispatch, removeFromCombat }),
    );
    engine.enqueueEffect({
      seat: "B",
      cardName: "Exclusion",
      ops: [EXCLUSION_OP],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("removeFromCombatTarget");
    expect([...engine.effectTargetIdsList.value]).toEqual(["atk"]);
    engine.effectTargetChoose("atk");
    expect(removeFromCombat).toHaveBeenCalledWith("atk");
    const tapped = dispatch.mock.calls
      .flat()
      .find(
        (e) =>
          e &&
          typeof e === "object" &&
          e.type === "SET_ORIENTATION" &&
          e.payload?.instanceId === "atk" &&
          e.payload?.orientation === "tapped",
      );
    expect(tapped, "SET_ORIENTATION tapped sur la cible").toBeTruthy();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("dep removeFromCombat ABSENTE : pas d'exception, l'inclinaison reste émise", () => {
    const state = makeCombatState();
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    engine.enqueueEffect({
      seat: "B",
      cardName: "Exclusion",
      ops: [EXCLUSION_OP],
    });
    expect(() => engine.effectTargetChoose("atk")).not.toThrow();
  });
});
