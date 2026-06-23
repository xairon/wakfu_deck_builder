import { describe, it, expect } from "vitest";
import {
  fixture,
  setTurn,
  bringToMonde,
  ctxOf,
  dispatch,
  instId,
  HERO_B,
  makeAlly,
  type Fixture,
} from "@/game/rules/__tests__/harness";
import { resolveIntent } from "@/game/actions/resolveIntent";
import type { GameIntent } from "@/game";
import type { Seat } from "@/game";

/** Partie au tour 3 de A (attaque légale) : un Allié de A et un de B au Monde. */
function combatReady(): { f: Fixture; A0: string; B0: string } {
  const f = fixture(
    [makeAlly("a1", { force: 2 })],
    [makeAlly("b1", { force: 1 })],
  );
  setTurn(f, "A", 3);
  const A0 = instId("A", 0);
  const B0 = instId("B", 0);
  bringToMonde(f, "A", A0, { arrivedTurn: 0 });
  bringToMonde(f, "B", B0, { arrivedTurn: 0 });
  return { f, A0, B0 };
}

function run(f: Fixture, intent: GameIntent, seat: Seat) {
  const { state, getCard } = ctxOf(f);
  return resolveIntent(state, getCard, intent, seat);
}

/** Résout l'intention et applique ses events au fixture (échoue si erreur). */
function apply(f: Fixture, intent: GameIntent, seat: Seat) {
  const r = run(f, intent, seat);
  if (!("events" in r))
    throw new Error(("error" in r && r.error) || "no events");
  dispatch(f, ...r.events);
  return r;
}

describe("resolveIntent — combat (autorité serveur, P3)", () => {
  it("DECLARE_ATTACK hors tour → erreur", () => {
    const { f, A0 } = combatReady();
    const r = run(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "B",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("tour");
  });

  it("DECLARE_ATTACK par l'attaquant → incline les attaquants + ouvre SET_COMBAT (blockers)", () => {
    const { f, A0 } = combatReady();
    const r = run(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );
    if (!("events" in r)) throw new Error("attendu events");
    const tap = r.events.find(
      (e) =>
        e.type === "SET_ORIENTATION" &&
        (e.payload as { instanceId: string }).instanceId === A0 &&
        (e.payload as { orientation: string }).orientation === "tapped",
    );
    expect(tap).toBeDefined();
    const setC = r.events.find((e) => e.type === "SET_COMBAT");
    expect(setC).toBeDefined();
    const c = (setC!.payload as { combat: Record<string, unknown> }).combat;
    expect(c.step).toBe("blockers");
    expect(c.attackers).toEqual([A0]);
    expect(c.reactingSeat).toBe("B");
    expect((c.target as { instanceId: string }).instanceId).toBe(HERO_B);
  });

  it("DECLARE_BLOCK : refusée pour l'attaquant, acceptée pour le défenseur", () => {
    const { f, A0, B0 } = combatReady();
    apply(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );

    // L'attaquant ne peut pas bloquer.
    const bad = run(f, { kind: "DECLARE_BLOCK", blocks: { [B0]: A0 } }, "A");
    expect("error" in bad).toBe(true);
    expect("error" in bad && bad.error).toContain("défenseur");

    // Le défenseur bloque légalement.
    const ok = run(f, { kind: "DECLARE_BLOCK", blocks: { [B0]: A0 } }, "B");
    if (!("events" in ok)) throw new Error("attendu events");
    const c = (
      ok.events[0].payload as { combat: { blocks: Record<string, string> } }
    ).combat;
    expect(c.blocks[B0]).toBe(A0);
  });

  it("RESOLVE_COMBAT : refusée pour le défenseur ; l'attaquant résout → dégâts + clôture + attaque enregistrée", () => {
    const { f, A0 } = combatReady();
    apply(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );

    const hpBefore = ctxOf(f).state.instances[HERO_B].counters.hp ?? 0;

    // Avant que le défenseur ait déclaré ses blocages, l'attaquant ne peut PAS
    // résoudre (fenêtre de blocage, step "blockers").
    const tooEarly = run(f, { kind: "RESOLVE_COMBAT" }, "A");
    expect("error" in tooEarly).toBe(true);
    expect("error" in tooEarly && tooEarly.error).toContain("blocages");

    // Le défenseur déclare 0 blocage (laisse passer) → step "resolve".
    apply(f, { kind: "DECLARE_BLOCK", blocks: {} }, "B");

    // Le défenseur ne résout pas.
    const bad = run(f, { kind: "RESOLVE_COMBAT" }, "B");
    expect("error" in bad).toBe(true);
    expect("error" in bad && bad.error).toContain("attaquant");

    // L'attaquant résout : Allié force 2, non bloqué → -2 PV au Héros B.
    apply(f, { kind: "RESOLVE_COMBAT" }, "A");
    const after = ctxOf(f).state;
    expect(after.combat ?? null).toBeNull();
    expect(after.lastAttackTurn?.A).toBe(3);
    expect(after.instances[HERO_B].counters.hp).toBe(hpBefore - 2);
  });

  it("une seule attaque par tour : DECLARE_ATTACK rejetée après une résolution le même tour", () => {
    const { f, A0 } = combatReady();
    apply(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );
    apply(f, { kind: "DECLARE_BLOCK", blocks: {} }, "B");
    apply(f, { kind: "RESOLVE_COMBAT" }, "A");
    // Même tour, on retente : la garde 603 (lastAttackTurn) doit refuser.
    const r = run(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("attaque par tour");
  });

  it("DECLARE_BLOCK rejette une riposte illégale (cible inattendue / non-attaquant)", () => {
    const { f, A0 } = combatReady();
    apply(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );
    // riposte qui vise un non-attaquant → refusée (autorité serveur, pas de
    // correction silencieuse).
    const r = run(
      f,
      { kind: "DECLARE_BLOCK", blocks: {}, ripostes: { [HERO_B]: "ci_B_999" } },
      "B",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("Riposte");
  });

  it("RESOLVE_COMBAT rejette une frappe illégale (bloqueur qui ne bloque pas l'attaquant)", () => {
    const { f, A0, B0 } = combatReady();
    apply(
      f,
      {
        kind: "DECLARE_ATTACK",
        attackers: [A0],
        target: { kind: "hero", instanceId: HERO_B },
      },
      "A",
    );
    apply(f, { kind: "DECLARE_BLOCK", blocks: {} }, "B"); // 0 blocage
    // frappe désignant B0 qui ne bloque pas A0 → refusée.
    const r = run(f, { kind: "RESOLVE_COMBAT", strikes: { [A0]: B0 } }, "A");
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("Frappe");
  });
});
