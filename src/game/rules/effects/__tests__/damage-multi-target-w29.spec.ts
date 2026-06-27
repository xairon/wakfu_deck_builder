/**
 * Tranche W29 — op damageMultiTarget (« Choisissez jusqu'à N Alliés ou Héros
 * [attaquants ou bloqueurs]? [différents]?. [La source] leur inflige X Dommages. »).
 *
 * DOMMAGES MULTI-CIBLES BORNÉS : le joueur choisit JUSQU'À `count` cibles
 * (0..count — « jusqu'à » : il peut s'arrêter avant), chacune subissant X
 * Dommages (resolveDamageTarget : Résistance / létalité / XP). `distinct`
 * (« … différents ») retire les cibles déjà touchées de l'éligibilité.
 *
 * Couvre : le DSL (positifs / négatifs : valeur dynamique, clause résiduelle,
 * 2e phrase absente), le ciblage RÉPÉTÉ du moteur (boucle, distinct, arrêt
 * anticipé, filtre combatRole, létalité) et un échantillon de harvest réel.
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectTargetIds, isTargetingOp } from "../targeting";
import { compileTapEffectText, compileActionEffectText } from "../dsl";

// ───────────────────────────── DSL ─────────────────────────────

describe("DSL — damageMultiTarget (« Choisissez jusqu'à N … leur inflige X Dommages »)", () => {
  it("compile « jusqu'à deux Alliés ou Héros attaquants ou bloqueurs » (pouvoir à inclinaison)", () => {
    const c = compileTapEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros attaquants ou bloqueurs. Le Chêne Mou leur inflige 2 Dommages.",
      "Chêne Mou",
      "Terre",
    );
    expect(c?.ops).toEqual([
      {
        op: "damageMultiTarget",
        n: 2,
        element: "Terre",
        count: 2,
        heroes: true,
        combatRole: "inCombat",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("compile « … différents » → distinct:true (Action)", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros différents. La Pandatak leur inflige 3 Dommages.",
      "Pandatak",
      "Neutre",
    );
    expect(c?.trigger).toBe("onPlay");
    expect(c?.ops).toEqual([
      {
        op: "damageMultiTarget",
        n: 3,
        element: "Neutre",
        count: 2,
        distinct: true,
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("compile « jusqu'à trois » (borne arbitraire)", () => {
    const c = compileTapEffectText(
      "Choisissez jusqu'à trois Alliés ou Héros attaquants ou bloqueurs. L'Arc du Bandit Archer leur inflige 1 Dommage.",
      "Arc du Bandit Archer",
      "Neutre",
    );
    const op = c?.ops[0] as { op: string; count: number; n: number };
    expect(op.op).toBe("damageMultiTarget");
    expect(op.count).toBe(3);
    expect(op.n).toBe(1);
  });

  it("NÉGATIF : « contrôlés par le même joueur » (filtre non compris) → null", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros contrôlés par le même joueur. La Poussière Temporelle leur inflige 1 Dommage.",
      "Poussière Temporelle",
      "Neutre",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : 2e phrase = autre chose que des Dommages → null", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros différents. La Carte les recycle.",
      "Carte",
      "Neutre",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : sujet de « leur inflige » ≠ la carte → null", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros différents. Un autre Allié leur inflige 3 Dommages.",
      "Pandatak",
      "Neutre",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : clause résiduelle après les Dommages (perte de PA) → null", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à deux Alliés ou Héros différents. La Carte leur inflige 1 Dommage et leur contrôleur perd 2 PA.",
      "Carte",
      "Neutre",
    );
    expect(c).toBeNull();
  });

  it("damageMultiTarget est une op de ciblage (isTargetingOp)", () => {
    expect(
      isTargetingOp({
        op: "damageMultiTarget",
        n: 2,
        element: "Neutre",
        count: 2,
        zones: ["monde"],
      } as never),
    ).toBe(true);
  });
});

// ─────────────────────────── moteur ────────────────────────────

type Inst = {
  instanceId: string;
  cardId: string;
  controller: "A" | "B";
  owner: "A" | "B";
  orientation: "upright" | "tapped";
  location: { zone: string; owner?: "A" | "B" };
  counters: { damage?: number };
};

function ally(
  id: string,
  controller: "A" | "B",
  opts: { force?: number } = {},
): { inst: Inst; card: Card } {
  return {
    inst: {
      instanceId: id,
      cardId: `c-${id}`,
      controller,
      owner: controller,
      orientation: "upright",
      location: { zone: "monde" },
      counters: {},
    },
    card: {
      id: `c-${id}`,
      name: id,
      mainType: "Allié",
      subTypes: [],
      experience: 2,
      stats: { force: { value: opts.force ?? 10, element: "Neutre" } },
    } as unknown as Card,
  };
}

function setup(
  units: { inst: Inst; card: Card }[],
  combat: GameState["combat"] | null = null,
) {
  const instances: Record<string, Inst> = {};
  const cards: Record<string, Card> = {};
  for (const u of units) {
    instances[u.inst.instanceId] = u.inst;
    cards[u.card.id] = u.card;
  }
  const state = {
    turn: { active: "A", number: 1 },
    instances,
    monde: units.map((u) => u.inst.instanceId),
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
    combat,
  } as unknown as GameState;

  const dispatch = vi.fn(
    (...drafts: { type?: string; payload?: unknown }[]) => {
      for (const d of drafts) {
        if (d?.type === "INC_COUNTER") {
          const p = d.payload as {
            instanceId: string;
            counter: string;
            delta: number;
          };
          const inst = instances[p.instanceId];
          if (inst && p.counter === "damage")
            inst.counters.damage = (inst.counters.damage ?? 0) + p.delta;
        }
        if (d?.type === "MOVE") {
          const p = d.payload as { instanceId: string; to?: { zone?: string } };
          if (instances[p.instanceId] && p.to?.zone)
            instances[p.instanceId].location = { zone: p.to.zone };
        }
      }
    },
  );
  const getCard = (id: string | null) => (id ? (cards[id] ?? null) : null);
  const deps: EffectEngineDeps = {
    getState: () => state,
    rulesCtx: () => ({ state, getCard }),
    getCard,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch,
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  };
  const engine = createEffectEngine(deps);
  return { engine, instances, dispatch };
}

function damageOn(dispatch: ReturnType<typeof vi.fn>, id: string): number {
  return dispatch.mock.calls
    .flat()
    .filter((d) => {
      const ev = d as {
        type?: string;
        payload?: { instanceId?: string; counter?: string };
      };
      return (
        ev.type === "INC_COUNTER" &&
        ev.payload?.instanceId === id &&
        ev.payload?.counter === "damage"
      );
    })
    .reduce(
      (s, d) => s + (d as { payload: { delta: number } }).payload.delta,
      0,
    );
}

describe("moteur — damageMultiTarget (ciblage répété borné)", () => {
  const op = (over: Record<string, unknown> = {}) =>
    ({
      op: "damageMultiTarget",
      n: 2,
      element: "Neutre",
      count: 2,
      zones: ["monde", "havreSac"],
      heroes: true,
      ...over,
    }) as never;

  it("ouvre un ciblage avec état `multi` (remaining = count)", () => {
    const { engine } = setup([ally("a", "B"), ally("b", "B")]);
    engine.enqueueEffect({ seat: "A", cardName: "X", ops: [op()] });
    expect(engine.effectTargeting.value?.op.op).toBe("damageMultiTarget");
    expect(engine.effectTargeting.value?.multi?.remaining).toBe(2);
  });

  it("inflige X Dommages à CHAQUE cible choisie, puis reprend l'effet (deux clics)", () => {
    const { engine, dispatch } = setup([ally("a", "B"), ally("b", "B")]);
    engine.enqueueEffect({ seat: "A", cardName: "X", ops: [op({ n: 2 })] });
    engine.effectTargetChoose("a");
    // après le 1er clic : encore en ciblage (remaining 1), pas terminé
    expect(engine.effectTargeting.value).not.toBeNull();
    expect(engine.effectTargeting.value?.multi?.remaining).toBe(1);
    engine.effectTargetChoose("b");
    // borne atteinte → ciblage clos, file vidée
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
    expect(damageOn(dispatch, "a")).toBe(2);
    expect(damageOn(dispatch, "b")).toBe(2);
  });

  it("distinct : la cible déjà touchée n'est plus éligible au 2e choix", () => {
    const { engine } = setup([ally("a", "B"), ally("b", "B")]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "X",
      ops: [op({ distinct: true })],
    });
    engine.effectTargetChoose("a");
    expect(engine.effectTargetIdsList.value).toContain("b");
    expect(engine.effectTargetIdsList.value).not.toContain("a");
  });

  it("« jusqu'à » : Passer après un choix s'ARRÊTE sans annuler (corps repris)", () => {
    const { engine, dispatch } = setup([ally("a", "B"), ally("b", "B")]);
    engine.enqueueEffect({ seat: "A", cardName: "X", ops: [op()] });
    engine.effectTargetChoose("a");
    engine.effectTargetSkip(); // s'arrête à 1 cible (sur 2)
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
    expect(damageOn(dispatch, "a")).toBe(2);
    expect(damageOn(dispatch, "b")).toBe(0);
  });

  it("clôt automatiquement quand il ne reste plus de cible distincte", () => {
    // une seule cible éligible : après l'avoir touchée (distinct), la boucle s'arrête
    const { engine, dispatch } = setup([ally("a", "B")]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "X",
      ops: [op({ distinct: true })],
    });
    engine.effectTargetChoose("a");
    expect(engine.effectTargeting.value).toBeNull();
    expect(damageOn(dispatch, "a")).toBe(2);
  });

  it("aucune cible éligible → effet passé (pas de pause)", () => {
    const { engine } = setup([]);
    engine.enqueueEffect({ seat: "A", cardName: "X", ops: [op()] });
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
  });

  it("combatRole inCombat : hors combat, aucune cible éligible (effet passé)", () => {
    const { engine } = setup([ally("a", "B"), ally("b", "B")], null);
    engine.enqueueEffect({
      seat: "A",
      cardName: "X",
      ops: [op({ combatRole: "inCombat" })],
    });
    // combat null → attackers/blockers vides → pas de cible → pas de pause
    expect(engine.effectTargeting.value).toBeNull();
  });

  it("combatRole inCombat : seules les créatures au combat sont éligibles", () => {
    const a = ally("a", "B");
    const b = ally("b", "B");
    const combat = {
      attackers: ["a"],
      blocks: {},
    } as unknown as GameState["combat"];
    const { engine } = setup([a, b], combat);
    engine.enqueueEffect({
      seat: "A",
      cardName: "X",
      ops: [op({ combatRole: "inCombat" })],
    });
    expect(engine.effectTargetIdsList.value).toEqual(["a"]);
  });

  it("létalité : une cible dont les Dommages cumulés ≥ Force est détruite", () => {
    const fragile = ally("fragile", "B", { force: 2 });
    const { engine, dispatch } = setup([fragile]);
    engine.enqueueEffect({
      seat: "A",
      cardName: "X",
      ops: [op({ n: 2, distinct: true })],
    });
    engine.effectTargetChoose("fragile");
    // 2 Dommages ≥ Force 2 → resolveDamageTarget détruit (MOVE vers Défausse)
    const destroyed = dispatch.mock.calls.flat().some((d) => {
      const ev = d as {
        type?: string;
        payload?: { instanceId?: string; to?: { zone?: string } };
      };
      return (
        ev.type === "MOVE" &&
        ev.payload?.instanceId === "fragile" &&
        ev.payload?.to?.zone === "defausse"
      );
    });
    expect(destroyed).toBe(true);
  });

  it("eligibilité : Allié + Héros si `heroes` (effectTargetIds)", () => {
    const a = ally("a", "B");
    const ids = effectTargetIds(setupCtx([a]), op() as never, "A", undefined);
    expect(ids).toContain("a");
  });
});

/** Mini-contexte pour tester effectTargetIds directement. */
function setupCtx(units: { inst: Inst; card: Card }[]) {
  const instances: Record<string, Inst> = {};
  const cards: Record<string, Card> = {};
  for (const u of units) {
    instances[u.inst.instanceId] = u.inst;
    cards[u.card.id] = u.card;
  }
  return {
    state: { instances, combat: null } as unknown as GameState,
    getCard: (id: string | null) => (id ? (cards[id] ?? null) : null),
  } as never;
}
