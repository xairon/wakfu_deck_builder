/**
 * Moteur de règles — sous-système ÉQUIPEMENT / PORTEUR (305.x, lot F).
 *
 * Couvre :
 *  - le DSL `compileBearerBonusText` (« Le Porteur de X gagne +N en Force /
 *    Résistance N (Élément) », valeurs négatives, rejets infidèles) ;
 *  - l'application des bonus portés : `effectiveForce` (+Force) et
 *    `effectiveKeywords` (+Résistance) lisent l'équipement attaché via
 *    `bearer.attachments` ; bonus présent SSI porté et en jeu, disparu après
 *    DETACH / destruction du Porteur ;
 *  - l'éligibilité du Porteur (un Monstre ne peut pas être Porteur).
 */
import { describe, expect, it } from "vitest";
import { compileBearerBonusText } from "@/game/rules/effects/dsl";
import { effectiveForce } from "@/game/rules/stats";
import { effectiveKeywords, stateBasedDestroyEvents } from "@/game/rules";
import { canBearEquipment } from "@/game/rules/bearer";
import { attach, detach, incCounter } from "@/game";
import type { AllyCard, Card } from "@/types/cards";
import {
  createMockAllyCard,
  createMockEquipmentCard,
} from "tests/factories/card";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "./harness";

/** Monture (Allié) « Le Porteur de X gagne +N en Force ». */
function mountForce(id: string, n: number): AllyCard {
  const name = `Monture ${id}`;
  return createMockAllyCard({
    id,
    name,
    subTypes: ["Monstre", "Monture"],
    stats: { niveau: { value: 1, element: "Feu" } },
    effects: [{ description: `Le Porteur de ${name} gagne +${n} en Force.` }],
  });
}

describe("rules/bearer — DSL compileBearerBonusText", () => {
  it("compile « Le Porteur de X gagne +N en Force » en bearerBonus static", () => {
    const c = compileBearerBonusText(
      "Le Porteur du Dragouf gagne +2 en Force.",
      "Dragouf",
    );
    expect(c).toEqual({
      trigger: "static",
      static: { kind: "bearerBonus", force: 2 },
      ops: [],
    });
  });

  it("compile un MALUS de Force (« gagne -1 en Force »)", () => {
    const c = compileBearerBonusText(
      "Le Porteur de la Loque gagne -1 en Force.",
      "Loque",
    );
    expect(c?.static).toEqual({ kind: "bearerBonus", force: -1 });
  });

  it("compile « gagne Résistance N (Élément) » en bearerBonus.resistance", () => {
    const c = compileBearerBonusText(
      "Le Porteur du Bouclier gagne Résistance 1 (feu).",
      "Bouclier",
    );
    expect(c?.static).toEqual({
      kind: "bearerBonus",
      resistance: { element: "Feu", n: 1 },
    });
  });

  it("REJETTE un bonus temporaire (« jusqu'à la fin du tour » ≠ continu)", () => {
    expect(
      compileBearerBonusText(
        "Le Porteur de la Razielle gagne +1 en Force jusqu'à la fin du tour.",
        "Razielle",
      ),
    ).toBeNull();
  });

  it("REJETTE l'icône perdue au scrape (« gagne . ») et les bonus composés", () => {
    expect(compileBearerBonusText("Le Porteur du X gagne .", "X")).toBeNull();
    expect(
      compileBearerBonusText(
        "Le Porteur du X gagne +1 en Force et Tacle.",
        "X",
      ),
    ).toBeNull();
  });

  it("REJETTE un sujet qui n'est pas la carte elle-même", () => {
    expect(
      compileBearerBonusText(
        "Le Porteur du Dragouf gagne +2 en Force.",
        "Bouftou",
      ),
    ).toBeNull();
  });
});

describe("rules/bearer — éligibilité du Porteur (305.x)", () => {
  it("un Allié non-Monstre peut être Porteur ; un Héros aussi", () => {
    expect(
      canBearEquipment(createMockAllyCard({ subTypes: ["Bouftou"] })),
    ).toBe(true);
  });

  it("un Monstre NE PEUT PAS être Porteur (glossaire Porteur/Monstre)", () => {
    expect(
      canBearEquipment(createMockAllyCard({ subTypes: ["Monstre", "Tofu"] })),
    ).toBe(false);
  });

  it("un Équipement / une Zone ne sont pas des Porteurs valides", () => {
    expect(canBearEquipment(createMockEquipmentCard())).toBe(false);
  });
});

describe("rules/bearer — application des bonus portés", () => {
  it("effectiveForce ajoute la Force de l'équipement PORTÉ (+N)", () => {
    const bearer = makeAlly("bearer", { force: 2 });
    const mount = mountForce("mount", 2);
    const f = fixture([bearer, mount]);
    const bearerId = instId("A", 0);
    const mountId = instId("A", 1);
    bringToMonde(f, "A", bearerId);
    bringToMonde(f, "A", mountId);
    // Avant attachement : Force imprimée seule.
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(2);
    dispatch(f, attach("A", mountId, bearerId));
    // Après attachement : +2.
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(4);
  });

  it("le bonus DISPARAÎT après DETACH (équipement renvoyé en main)", () => {
    const bearer = makeAlly("bearer", { force: 2 });
    const mount = mountForce("mount", 2);
    const f = fixture([bearer, mount]);
    const bearerId = instId("A", 0);
    const mountId = instId("A", 1);
    bringToMonde(f, "A", bearerId);
    bringToMonde(f, "A", mountId);
    dispatch(f, attach("A", mountId, bearerId));
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(4);
    dispatch(f, detach("A", mountId, { zone: "main", owner: "A" }));
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(2);
  });

  it("effectiveKeywords ajoute la Résistance conférée au Porteur", () => {
    const bearer = makeAlly("bearer", { force: 3 });
    const shield = createMockAllyCard({
      id: "shield",
      name: "Bouclier Test",
      subTypes: ["Monstre", "Monture"],
      stats: { niveau: { value: 1, element: "Feu" } },
      effects: [
        {
          description: "Le Porteur du Bouclier Test gagne Résistance 2 (feu).",
        },
      ],
    });
    const f = fixture([bearer, shield]);
    const bearerId = instId("A", 0);
    const shieldId = instId("A", 1);
    bringToMonde(f, "A", bearerId);
    bringToMonde(f, "A", shieldId);
    expect(effectiveKeywords(ctxOf(f), bearerId).resistances.feu ?? 0).toBe(0);
    dispatch(f, attach("A", shieldId, bearerId));
    expect(effectiveKeywords(ctxOf(f), bearerId).resistances.feu).toBe(2);
  });

  it("un équipement SANS bearerBonus reconnu ne modifie rien une fois attaché", () => {
    const bearer = makeAlly("bearer", { force: 2 });
    const plain: Card = createMockAllyCard({
      id: "plain",
      name: "Truc",
      subTypes: ["Monstre", "Monture"],
      effects: [{ description: "Le Porteur du Truc gagne ." }], // icône perdue
    });
    const f = fixture([bearer, plain]);
    const bearerId = instId("A", 0);
    const plainId = instId("A", 1);
    bringToMonde(f, "A", bearerId);
    bringToMonde(f, "A", plainId);
    dispatch(f, attach("A", plainId, bearerId));
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(2);
  });
});

describe("rules/bearer — destruction du Porteur (305.x)", () => {
  it("l'équipement porté est défaussé quand son Porteur est détruit", () => {
    // Porteur de Force 2, Monture +2 portée → Force effective 4 ; on lui pose
    // 4 Dommages → létal (3019). La destruction d'état doit défausser la Monture.
    const bearer = makeAlly("bearer", { force: 2 });
    const mount = createMockAllyCard({
      id: "mount",
      name: "Monture mount",
      subTypes: ["Monstre", "Monture"],
      // Pas de Force imprimée → la Monture elle-même n'est jamais détruite d'office
      // (garde « Force inconnue »), on isole la destruction du Porteur.
      stats: { niveau: { value: 1, element: "Feu" } },
      effects: [
        { description: "Le Porteur de Monture mount gagne +2 en Force." },
      ],
    });
    const f = fixture([bearer, mount]);
    const bearerId = instId("A", 0);
    const mountId = instId("A", 1);
    bringToMonde(f, "A", bearerId);
    bringToMonde(f, "A", mountId);
    dispatch(f, attach("A", mountId, bearerId));
    expect(effectiveForce(ctxOf(f), bearerId)).toBe(4);
    // 4 Dommages sur le Porteur (Force effective 4) → létal.
    dispatch(f, incCounter("A", bearerId, "damage", 4));
    const sbd = stateBasedDestroyEvents(ctxOf(f));
    expect(sbd.destroyed).toContain(bearerId);
    expect(sbd.destroyed).toContain(mountId);
    dispatch(f, ...sbd.events);
    const st = ctxOf(f).state;
    expect(st.instances[bearerId].location.zone).toBe("defausse");
    expect(st.instances[mountId].location.zone).toBe("defausse");
    // Plus aucun attachment résiduel.
    expect(st.instances[bearerId].attachments).not.toContain(mountId);
  });
});
