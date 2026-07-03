/**
 * Intégration store (W55) — Bonne Affaire ! : « Regardez les deux premières
 * cartes de votre Pioche. Prenez l'une de ces cartes en main, puis recyclez
 * l'autre. » Op lookTopPick : pick à CANDIDATS EXPLICITES (les 2 du dessus,
 * révélés au joueur), choix IMPOSÉ, le reste recyclé SOUS la Pioche.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox } from "./effectPipeline.harness";

const LOOK_OPS = [
  {
    op: "lookTopPick" as const,
    n: 2,
    dest: "main" as const,
    rest: "recycle" as const,
  },
];

describe("lookTopPick — Bonne Affaire !", () => {
  it("propose les 2 cartes du DESSUS (choix imposé) ; prise en main + reste recyclé dessous", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const [top0, top1] = store.state.seats.A.pioche;
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Bonne Affaire !",
      ops: LOOK_OPS,
    });

    // pick ouvert : exactement les 2 du dessus, choix imposé (pas de « Passer »)
    expect(store.effectPicking?.action).toBe("toHand");
    expect(store.effectPicking?.mandatory).toBe(true);
    expect([...store.effectPickIds]).toEqual([top0, top1]);

    store.effectPick(top1); // prend la SECONDE (choix libre parmi les deux)

    // top1 en main ; top0 recyclée SOUS la Pioche (dernier élément)
    expect(store.state.seats.A.main).toContain(top1);
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
    const pioche = store.state.seats.A.pioche;
    expect(pioche[pioche.length - 1]).toBe(top0);
    expect(store.effectPicking).toBeNull();
  });

  it("Pioche à UNE carte : le joueur la voit et la prend, rien à recycler", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    // vide la Pioche sauf une carte (déplace le reste en Défausse)
    const keep = store.state.seats.A.pioche[0];
    for (const id of [...store.state.seats.A.pioche].slice(1))
      store.moveTo(id, { zone: "defausse", owner: "A" });
    expect(store.state.seats.A.pioche).toEqual([keep]);

    store.enqueueEffect({
      seat: "A",
      cardName: "Bonne Affaire !",
      ops: LOOK_OPS,
    });
    expect([...store.effectPickIds]).toEqual([keep]);
    store.effectPick(keep);
    expect(store.state.seats.A.main).toContain(keep);
    expect(store.state.seats.A.pioche).toEqual([]);
  });

  it("Pioche VIDE : effet passé (pas de pick)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    for (const id of [...store.state.seats.A.pioche])
      store.moveTo(id, { zone: "defausse", owner: "A" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Bonne Affaire !",
      ops: LOOK_OPS,
    });
    expect(store.effectPicking).toBeNull();
  });
});
