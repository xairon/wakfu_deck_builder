/**
 * Couche « ne peut pas se redresser jusqu'au début de votre prochain tour »
 * (Pandrista, Kolo-Kolko, Boufdégou…) : op `tapTarget{cannotRedress}` + jeton
 * `noUntapUntilTurn` (= tour courant + 2) qui FAIT SAUTER le redressement de
 * début de tour tant qu'il est actif.
 *
 * Trois plans de test :
 *  1. DSL  — compilation STRICTE de la clause résiduelle (positifs/négatifs) ;
 *  2. resolveTapTarget — events EXACTS (inclinaison + pose du jeton), y compris
 *     le ruling Pandrista (jeton posé même sur une cible déjà inclinée) ;
 *  3. nextTurnEvents (FIDÉLITÉ) — la cible affectée NE se redresse PAS au début
 *     du tour de son contrôleur tant que le jeton vit, puis se redresse le tour
 *     d'après (expiration du jeton) ; une cible non affectée se redresse
 *     normalement.
 */
import { describe, expect, it } from "vitest";
import { compileActionEffectText, resolveTapTarget } from "@/game/rules";
import { nextTurnEvents } from "@/game";
import type { DraftEvent } from "@/game";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

const NO_UNTAP = "noUntapUntilTurn";

/** Nombre d'events « redresse l'instance `id` » (SET_ORIENTATION upright). */
function countUntaps(evs: DraftEvent[], id: string): number {
  return evs.filter((e) => {
    if (e.type !== "SET_ORIENTATION") return false;
    const p = e.payload as { instanceId: string; orientation: string };
    return p.instanceId === id && p.orientation === "upright";
  }).length;
}

/** Nombre d'events « purge le jeton noUntapUntilTurn de `id` ». */
function countNoUntapPurges(evs: DraftEvent[], id: string): number {
  return evs.filter((e) => {
    if (e.type !== "SET_COUNTER") return false;
    const p = e.payload as { instanceId: string; counter: string };
    return p.instanceId === id && p.counter === NO_UNTAP;
  }).length;
}

describe("cannotRedress — DSL (clause résiduelle)", () => {
  it("« Inclinez l'Allié de votre choix. Jusqu'au début de votre prochain tour, cet Allié ne peut pas se redresser. » → tapTarget{cannotRedress} (Kolo-Kolko)", () => {
    const c = compileActionEffectText(
      "Inclinez l'Allié de votre choix. Jusqu'au début de votre prochain tour, cet Allié ne peut pas se redresser.",
      "Kolo-Kolko",
    );
    expect(c?.ops).toEqual([
      { op: "tapTarget", zones: ["monde"], cannotRedress: true },
    ]);
  });

  it("« Inclinez l'Allié ou Héros de votre choix. Jusqu'au début de votre prochain tour, cet Allié ou Héros ne peut pas se redresser. » → tapTarget heroes+cannotRedress (Pandrista)", () => {
    const c = compileActionEffectText(
      "Inclinez l'Allié ou Héros de votre choix. Jusqu'au début de votre prochain tour, cet Allié ou Héros ne peut pas se redresser.",
      "Pandrista",
    );
    expect(c?.ops).toEqual([
      { op: "tapTarget", heroes: true, zones: ["monde"], cannotRedress: true },
    ]);
  });

  it("clause en ordre inverse « Cet Allié … ne peut pas se redresser jusqu'au début de votre prochain tour. » → cannotRedress (forme Boufdégou)", () => {
    const c = compileActionEffectText(
      "Inclinez l'Allié de votre choix. Cet Allié ne peut pas se redresser jusqu'au début de votre prochain tour.",
      "X",
    );
    expect(c?.ops).toEqual([
      { op: "tapTarget", zones: ["monde"], cannotRedress: true },
    ]);
  });

  it("NÉGATIF : la clause sans tapTarget précédent ne compile pas (référent ambigu)", () => {
    const c = compileActionEffectText(
      "Jusqu'au début de votre prochain tour, cet Allié ne peut pas se redresser.",
      "X",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : « Inclinez l'Allié de votre choix. » seule reste un tapTarget SANS cannotRedress", () => {
    const c = compileActionEffectText("Inclinez l'Allié de votre choix.", "X");
    expect(c?.ops).toEqual([{ op: "tapTarget", zones: ["monde"] }]);
  });
});

describe("cannotRedress — resolveTapTarget (pose du jeton)", () => {
  it("incline la cible dressée ET pose noUntapUntilTurn = borne fournie", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveTapTarget(ctxOf(f), "A", instId("A", 0), 5);
    expect(res.events).toEqual([
      {
        actor: "A",
        type: "SET_ORIENTATION",
        payload: { instanceId: instId("A", 0), orientation: "tapped" },
      },
      {
        actor: "A",
        type: "SET_COUNTER",
        payload: {
          instanceId: instId("A", 0),
          counter: NO_UNTAP,
          value: 5,
          token: true,
        },
      },
    ]);
  });

  it("ruling Pandrista : cible DÉJÀ inclinée — pas de ré-inclinaison MAIS le jeton est tout de même posé", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true });
    const res = resolveTapTarget(ctxOf(f), "A", instId("A", 0), 5);
    // aucune SET_ORIENTATION (déjà inclinée), mais bien le jeton d'interdiction
    expect(res.events).toEqual([
      {
        actor: "A",
        type: "SET_COUNTER",
        payload: {
          instanceId: instId("A", 0),
          counter: NO_UNTAP,
          value: 5,
          token: true,
        },
      },
    ]);
    expect(res.log.join(" ")).toMatch(/ne peut pas se redresser/);
  });

  it("sans borne (cannotRedressUntil absent) : comportement historique (inclinaison seule, aucun jeton)", () => {
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
});

describe("cannotRedress — redressement (nextTurnEvents, FIDÉLITÉ)", () => {
  // Scénario : au tour 1 (A actif), A incline l'Allié de B et lui interdit de
  // se redresser jusqu'au début de SON prochain tour (tour 3) → jeton = 1 + 2 = 3.
  function setup() {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0), { tapped: true }); // Allié de A, incliné
    bringToMonde(f, "B", instId("B", 0), { tapped: true }); // Allié de B, incliné
    setTurn(f, "A", 1, "principale");
    // A pose l'interdiction sur l'Allié de B (borne = tour 1 + 2 = 3).
    const res = resolveTapTarget(ctxOf(f), "A", instId("B", 0), 3);
    dispatch(f, ...res.events);
    return f;
  }

  it("la cible affectée NE se redresse PAS au début du tour de son contrôleur (tour 2)", () => {
    const f = setup();
    // transition tour 1 (A) → tour 2 (B). nextNumber = 2 ; jeton (3) > 2 → SKIP.
    const evs = nextTurnEvents(ctxOf(f).state);
    expect(countUntaps(evs, instId("B", 0))).toBe(0);
    // le jeton n'est PAS encore purgé au tour 2 (actif tant que 2 < 3)
    expect(countNoUntapPurges(evs, instId("B", 0))).toBe(0);
  });

  it("la cible affectée se redresse au tour SUIVANT de son contrôleur (tour 4), une fois le jeton expiré", () => {
    const f = setup();
    // Avance jusqu'au tour 3 (A) : le jeton (3) expire à l'entrée du tour 3.
    dispatch(f, ...nextTurnEvents(ctxOf(f).state)); // → tour 2 (B)
    dispatch(f, ...nextTurnEvents(ctxOf(f).state)); // → tour 3 (A) : purge du jeton
    // le jeton noUntapUntilTurn doit être tombé à 0 (purgé par isTurnToken).
    const b0 = ctxOf(f).state.instances[instId("B", 0)];
    expect(b0.counters.tokens?.[NO_UNTAP] ?? 0).toBe(0);
    // l'Allié de B est resté incliné jusqu'ici (jamais redressé entre-temps)
    expect(b0.orientation).toBe("tapped");
    // transition tour 3 (A) → tour 4 (B) : plus de jeton → redressement normal.
    const evs = nextTurnEvents(ctxOf(f).state);
    expect(countUntaps(evs, instId("B", 0))).toBe(1);
  });

  it("une cible NON affectée se redresse normalement au début du tour de son contrôleur", () => {
    const f = setup();
    // l'Allié de A (sans jeton) se redresse à l'entrée du tour 3 (A actif).
    dispatch(f, ...nextTurnEvents(ctxOf(f).state)); // → tour 2 (B)
    const evs = nextTurnEvents(ctxOf(f).state); // → tour 3 (A)
    expect(countUntaps(evs, instId("A", 0))).toBe(1);
  });
});
