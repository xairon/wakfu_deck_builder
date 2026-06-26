/**
 * Tests des ops à cible « inclinaison / redressement / renvoi en main »
 * (tapTarget / untapTarget / returnToHand). Mêmes outils que targeting.spec :
 * une partie réelle via le harnais, puis assertions sur les events EXACTS
 * émis par chaque resolve*, et sur le filtre de contrôleur d'effectTargetIds.
 */
import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import {
  effectTargetIds,
  resolveReturnToHand,
  resolveTapTarget,
  resolveUntapTarget,
} from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

describe("rules/effects — tapTarget / untapTarget / returnToHand", () => {
  it("resolveTapTarget : SET_ORIENTATION tapped sur une carte dressée", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveTapTarget(ctxOf(f), "A", instId("A", 0));
    expect(res.events).toEqual([
      {
        actor: "A",
        type: "SET_ORIENTATION",
        payload: { instanceId: instId("A", 0), orientation: "tapped" },
      },
    ]);
  });

  it("resolveTapTarget : no-op (aucun event) si la cible est déjà inclinée", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    const res = resolveTapTarget(ctxOf(f), "A", instId("A", 0));
    expect(res.events).toEqual([]);
    expect(res.log[0]).toMatch(/déjà incliné/);
  });

  it("resolveUntapTarget : SET_ORIENTATION upright sur une carte inclinée", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    const res = resolveUntapTarget(ctxOf(f), "A", instId("A", 0));
    expect(res.events).toEqual([
      {
        actor: "A",
        type: "SET_ORIENTATION",
        payload: { instanceId: instId("A", 0), orientation: "upright" },
      },
    ]);
  });

  it("resolveUntapTarget : no-op si la cible est déjà dressée", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveUntapTarget(ctxOf(f), "A", instId("A", 0));
    expect(res.events).toEqual([]);
    expect(res.log[0]).toMatch(/déjà dressé/);
  });

  it("resolveReturnToHand : la cible retourne dans la main de SON propriétaire (pas du résolveur)", () => {
    const f = fixture([], [makeAlly("b0")]);
    bringToMonde(f, "B", instId("B", 0));
    // A résout le renvoi d'un Allié contrôlé par B (propriétaire B)
    const res = resolveReturnToHand(ctxOf(f), "A", instId("B", 0));
    expect(res.events).toHaveLength(1);
    const ev = res.events[0];
    expect(ev.type).toBe("MOVE");
    expect(ev.payload).toMatchObject({
      instanceId: instId("B", 0),
      to: { zone: "main", owner: "B" },
    });
    // application réelle : l'instance quitte le Monde pour la main de B
    dispatch(f, ...res.events);
    const s = ctxOf(f).state;
    expect(s.seats.B.main).toContain(instId("B", 0));
    expect(s.instances[instId("B", 0)].location.zone).toBe("main");
  });

  it("effectTargetIds — controller:self ne liste que les cartes du résolveur", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", controller: "self", zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("effectTargetIds — controller:opponent ne liste que les cartes adverses", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", controller: "opponent", zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("B", 0)]);
  });

  it("effectTargetIds — sans contrôleur : toutes les cibles, tous contrôleurs", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "untapTarget", zones: ["monde"] },
      "A",
    );
    expect(ids.sort()).toEqual([instId("A", 0), instId("B", 0)].sort());
  });

  it("effectTargetIds — heroes:false exclut le Héros, heroes:true l'inclut", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    // le Héros A (ci_A_001) est dans le Havre-Sac à la création
    const sansHeros = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", zones: ["monde", "havreSac"] },
      "A",
    );
    expect(sansHeros).toContain(instId("A", 0));
    expect(sansHeros).not.toContain("ci_A_001");
    const avecHeros = effectTargetIds(
      ctxOf(f),
      { op: "tapTarget", heroes: true, zones: ["monde", "havreSac"] },
      "A",
    );
    expect(avecHeros).toContain("ci_A_001");
  });

  it("effectTargetIds — returnToHand cible aussi les Zones/Équipements ? non : Alliés uniquement", () => {
    const zone = { ...makeAlly("z"), mainType: "Zone" } as unknown as Card;
    const f = fixture([makeAlly("a0"), zone]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(
      ctxOf(f),
      { op: "returnToHand", zones: ["monde"] },
      "A",
    );
    expect(ids).toEqual([instId("A", 0)]);
  });
});
