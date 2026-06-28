/**
 * JETONS — intégration via le gameStore (reducer réel + lecteurs de combat).
 * Vérifie qu'un jeton créé par un effet est un PARTICIPANT DE COMBAT fidèle :
 * Force effective = sa Force, ciblable / endommageable, mort à Dommages ≥ Force
 * (et alors RETIRÉ du jeu, pas en Défausse). Plus les flux Abraknyde (tap) et
 * Vampyro (costRecycleControlled + createToken) bout en bout.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetTokenRegistry, tokenCardId } from "@/game/rules/effects/tokens";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

beforeEach(() => resetTokenRegistry());

/** Trouve l'instanceId du jeton minté (cardId synthétique) dans le Monde. */
function tokenInMonde(store: ReturnType<typeof makeEffectSandbox>["store"]) {
  return store.state.monde.find((id) =>
    store.state.instances[id]?.cardId?.startsWith("__token__:"),
  );
}

describe("jeton — création & combat (intégration)", () => {
  it("createToken minte un Allié 'Monstre' de Force effective N dans le Monde du contrôleur", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Abraknyde",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 1,
          sub: "Arakne",
          element: "Terre",
        },
      ],
    });
    const id = tokenInMonde(store);
    expect(id).toBeDefined();
    const inst = store.state.instances[id!];
    expect(inst.controller).toBe("A");
    expect(inst.location.zone).toBe("monde");
    expect(inst.cardId).toBe(
      tokenCardId({
        name: "Monstre - Arakne",
        force: 1,
        sub: "Arakne",
        element: "Terre",
      }),
    );
    // Force effective lue par le moteur de combat = Force imprimée du jeton.
    expect(store.effectiveForceOf(id!)?.value).toBe(1);
  });

  it("le jeton est ciblable et meurt à Dommages ≥ Force, et est alors RETIRÉ du jeu", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    // Jeton contrôlé par B, ciblé par un effet de A.
    store.enqueueEffect({
      seat: "B",
      cardName: "Abraknyde",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 1,
          sub: "Arakne",
        },
      ],
    });
    const id = tokenInMonde(store)!;
    expect(id).toBeDefined();
    store.enqueueEffect({
      seat: "A",
      cardName: "Sort",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(store.effectTargetIdsList).toContain(id);
    store.effectTargetChoose(id);
    // Dommages 1 ≥ Force 1 → létal : le jeton quitte le jeu et CESSE D'EXISTER.
    expect(store.state.instances[id]).toBeUndefined();
    expect(store.state.monde).not.toContain(id);
    expect(store.state.seats.B.defausse).not.toContain(id);
    expect(store.state.seats.A.defausse).not.toContain(id);
  });

  it("un jeton renvoyé en main (returnToHand) cesse d'exister (pas de carte de deck)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.enqueueEffect({
      seat: "B",
      cardName: "Abraknyde",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 2,
          sub: "Arakne",
        },
      ],
    });
    const id = tokenInMonde(store)!;
    store.enqueueEffect({
      seat: "A",
      cardName: "Renvoi",
      ops: [{ op: "returnToHand", zones: ["monde", "havreSac"] }],
    });
    store.effectTargetChoose(id);
    expect(store.state.instances[id]).toBeUndefined();
    expect(store.state.seats.B.main).not.toContain(id);
  });
});

describe("Abraknyde — pouvoir à inclinaison (intégration)", () => {
  it("activer le pouvoir incline la source et met un jeton Arakne en jeu", () => {
    const abraknyde = createMockAllyCard({
      id: "abrak",
      name: "Abraknyde",
      subTypes: ["Monstre", "Abraknyde"],
      stats: { force: { value: 2, element: "Terre" } },
      effects: [
        {
          description:
            "Mettez en jeu un jeton \"Monstre - Arakne\" de Force 1 Terre. N'utilisez ce pouvoir qu'une seule fois par tour.",
          compiled: {
            trigger: "onTap",
            ops: [
              {
                op: "createToken",
                name: "Monstre - Arakne",
                force: 1,
                sub: "Arakne",
                element: "Terre",
              },
            ],
          },
        },
      ],
    });
    const { store } = makeEffectSandbox({ extraCards: [abraknyde] });
    // Place l'Abraknyde sous contrôle de A dans le Monde par le chemin réel.
    const srcId = placeInZone(store, "A", { zone: "monde" });
    // Force la carte de l'instance vers l'Abraknyde (le mock tire une carte du deck).
    store.state.instances[srcId].cardId = "abrak";
    expect(store.hasTapPower(srcId)).toBe(true);
    expect(store.activateTapPower(srcId)).toBe(true);
    // la source est inclinée (verrou once-per-turn).
    expect(store.state.instances[srcId].orientation).toBe("tapped");
    // un jeton Arakne est entré dans le Monde, Force effective 1.
    const tok = tokenInMonde(store)!;
    expect(tok).toBeDefined();
    expect(store.state.instances[tok].controller).toBe("A");
    expect(store.effectiveForceOf(tok)?.value).toBe(1);
  });
});

describe("Vampyro — costRecycleControlled + createToken (intégration)", () => {
  it("recycler un Monstre que vous contrôlez met en jeu un jeton Vampyre", () => {
    const { store, cardStore } = makeEffectSandbox({
      first: "A",
      allAllies: true,
    });
    // Une de vos créatures "Monstre" en jeu, à recycler.
    const monstre = placeInZone(store, "A", { zone: "monde" });
    const monstreCard = createMockAllyCard({
      id: "mon",
      name: "Bouftou",
      subTypes: ["Monstre"],
      stats: { force: { value: 1, element: "Neutre" } },
    });
    cardStore.cards = [...cardStore.cards, monstreCard];
    store.state.instances[monstre].cardId = "mon";
    store.enqueueEffect({
      seat: "A",
      cardName: "Vampyro",
      sourceId: store.state.seats.A.heroInstanceId,
      ops: [
        {
          op: "costRecycleControlled",
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
        {
          op: "createToken",
          name: "Monstre - Vampyre",
          force: 1,
          sub: "Vampyre",
        },
      ],
    });
    // ciblage du coût : le Monstre contrôlé est éligible.
    expect(store.effectTargetIdsList).toContain(monstre);
    store.effectTargetChoose(monstre);
    // le Monstre recyclé a quitté le Monde (remis sous la Pioche de A).
    expect(store.state.monde).not.toContain(monstre);
    expect(store.state.seats.A.pioche).toContain(monstre);
    // un jeton Vampyre est en jeu.
    const tok = tokenInMonde(store)!;
    expect(tok).toBeDefined();
    expect(store.state.instances[tok].cardId).toBe(
      tokenCardId({ name: "Monstre - Vampyre", force: 1, sub: "Vampyre" }),
    );
    expect(store.effectiveForceOf(tok)?.value).toBe(1);
  });
});

describe("deux jetons du même gabarit — instanceId distincts, même nom", () => {
  it("createToken deux fois → deux instances distinctes partageant nom et cardId", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const op = {
      op: "createToken" as const,
      name: "Monstre - Arakne",
      force: 1,
      sub: "Arakne",
      element: "Terre",
    };
    store.enqueueEffect({ seat: "A", cardName: "Abraknyde", ops: [op] });
    store.enqueueEffect({ seat: "A", cardName: "Abraknyde", ops: [op] });
    const ids = store.state.monde.filter((id) =>
      store.state.instances[id]?.cardId?.startsWith("__token__:"),
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    // même nom (jetons « portant le même nom ») et même cardId synthétique.
    expect(store.state.instances[ids[0]].cardId).toBe(
      store.state.instances[ids[1]].cardId,
    );
  });
});
