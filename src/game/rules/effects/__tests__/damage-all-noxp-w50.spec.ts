/**
 * Vague W50 (deck-driven, starter Incarnam Flèche Blizzard) — DOMMAGES DE MASSE
 * SANS XP : « La Flèche Blizzard inflige 2 Dommages Air à tous les Alliés et
 * Héros dans le Monde. Vous ne gagnez pas d'XP. »
 *
 * Trois briques :
 *  1) DSL — forme SUJET-EN-TÊTE (« <self> inflige … ») + MOT D'ÉLÉMENT explicite
 *     (« Dommages Air » — prioritaire sur l'Élément de la carte, Neutre ici) sur
 *     le parse damageAll ; clause résiduelle « Vous ne gagnez pas d'XP » →
 *     flag noXp sur le damageAll précédent (STRICT : sans damageAll → manuel).
 *  2) Moteur — resolveDamageTarget{noXpFor} : les destructions en CASCADE ne
 *     créditent pas d'XP au lanceur (415.1 l'aurait crédité pour un Allié
 *     adverse tué) ; les grants à l'ADVERSAIRE (mes propres Alliés tués par ma
 *     carte) restent accordés (la clause ne parle que de « vous »).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "@/game/rules";
import { resolveDamageTarget } from "../targeting";
import {
  HERO_A,
  HERO_B,
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — damageAll sujet-en-tête + élément explicite + noXp", () => {
  it("Flèche Blizzard : texte complet → damageAll{Air, heroes, monde, noXp}", () => {
    const c = compileActionEffectText(
      "La Flèche Blizzard inflige 2 Dommages Air à tous les Alliés et Héros dans le Monde. Vous ne gagnez pas d'XP.",
      "Flèche Blizzard",
      "Neutre", // Élément de la CARTE (Neutre) — les Dommages sont Air (explicite)
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "damageAll",
          n: 2,
          element: "Air",
          controller: "any",
          heroes: true,
          zones: ["monde"],
          noXp: true,
        },
      ],
    });
  });

  it("STRICT : sujet-en-tête ≠ soi (« Le Machin inflige … ») → manuel", () => {
    expect(
      compileActionEffectText(
        "Le Machin inflige 2 Dommages Air à tous les Alliés et Héros dans le Monde.",
        "Flèche Blizzard",
        "Neutre",
      ),
    ).toBeNull();
  });

  it("STRICT : « Vous ne gagnez pas d'XP » SANS damageAll précédent → manuel", () => {
    expect(
      compileActionEffectText(
        "Piochez une carte. Vous ne gagnez pas d'XP.",
        "X",
      ),
    ).toBeNull();
  });

  it("RÉGRESSION : l'impératif sans élément explicite garde l'Élément de la source", () => {
    const c = compileActionEffectText(
      "Infligez 1 Dommage à tous les Alliés adverses dans le Monde.",
      "X",
      "Feu",
    );
    expect(c?.ops).toEqual([
      {
        op: "damageAll",
        n: 1,
        element: "Feu",
        controller: "opponent",
        zones: ["monde"],
      },
    ]);
  });
});

// ── Volet 2 : moteur — suppression d'XP en cascade ───────────────────────────
describe("resolveDamageTarget — noXpFor (« Vous ne gagnez pas d'XP »)", () => {
  const xpGrantTo = (
    events: { type: string; payload?: Record<string, unknown> }[],
    heroId: string,
  ) =>
    events.some(
      (e) =>
        e.type === "INC_COUNTER" &&
        e.payload?.instanceId === heroId &&
        e.payload?.counter === "xp",
    );

  it("tue un Allié ADVERSE avec noXpFor=lanceur → AUCUN XP au lanceur", () => {
    const f = fixture([], [makeAlly("sien")]); // Allié de B (force 2)
    bringToMonde(f, "B", instId("B", 0));
    const res = resolveDamageTarget(
      ctxOf(f),
      "A",
      instId("B", 0),
      2, // létal (force 2)
      "Air",
      { noXpFor: "A" },
    );
    // détruit, mais SANS grant d'XP au Héros de A (415.1 supprimé pour le lanceur)
    expect(res.log.join(" ")).toContain("détruit");
    expect(xpGrantTo(res.events as never, HERO_A)).toBe(false);
  });

  it("SANS noXpFor : le même kill crédite l'XP au lanceur (régression 415.1)", () => {
    const f = fixture([], [makeAlly("sien")]);
    bringToMonde(f, "B", instId("B", 0));
    const res = resolveDamageTarget(
      ctxOf(f),
      "A",
      instId("B", 0),
      2,
      "Air",
      {},
    );
    expect(xpGrantTo(res.events as never, HERO_A)).toBe(true);
  });

  it("tue son PROPRE Allié avec noXpFor=lanceur → l'ADVERSAIRE gagne quand même l'XP", () => {
    // « Vous ne gagnez pas d'XP » ne parle que du lanceur : mes propres pertes
    // créditent toujours l'adversaire (415.1).
    const f = fixture([makeAlly("mien")]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveDamageTarget(ctxOf(f), "A", instId("A", 0), 2, "Air", {
      noXpFor: "A",
    });
    expect(xpGrantTo(res.events as never, HERO_B)).toBe(true);
  });
});
