/**
 * BANNISSEMENT (« Bannir » = retirer de la partie, zone Exil) — sous-système
 * banishTarget + cost:banishSelf / banishSelfFromDiscard.
 *
 * FIDÉLITÉ CARDINALE : bannir N'EST PAS détruire. Une carte bannie va en EXIL
 * (de son propriétaire), n'accorde AUCUN XP (contrairement à 415.1), n'émet
 * AUCUN événement de destruction et ne passe JAMAIS par la Défausse. Un jeton
 * banni quitte le jeu vers une zone hors-jeu → il CESSE D'EXISTER.
 *
 * Quatre volets :
 *  1) RÈGLES PURES — resolveBanishTarget (exil, sans XP) + effectTargetIds
 *     (éligibilité type/sub/maxLevel/controller).
 *  2) DSL — compilation des formes « Bannissez … » (cost + cibles) ; positifs
 *     (Geôles d'Astrub, Têtes à Clic et à Clac, Carte du Grav'Mar'Av') et
 *     négatifs (Arbre de Vie : pas d'op bouclier ; Bibliothèque : recherche
 *     multi-type ; bannissement depuis la Défausse adverse).
 *  3) REDUCER — un jeton banni (MOVE vers Exil) cesse d'exister.
 *  4) STORE — cost:banishSelf bannit la SOURCE (→ Exil) puis le corps tourne.
 */
import { describe, it, expect } from "vitest";
import type { Card, CompiledEffect } from "@/types/cards";
import type { GameState, PersistedEvent } from "@/game";
import { applyEvent, emptyState } from "@/game";
import {
  effectTargetIds,
  resolveBanishTarget,
  resolveDestroyTarget,
} from "@/game/rules";
import {
  compileActionEffectText,
  compileTapEffectText,
  isBanishCostText,
} from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { ensureTokenCard, resetTokenRegistry, tokenCardId } from "../tokens";
import {
  HERO_A,
  HERO_B,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

// ── Volet 1 : RÈGLES PURES ───────────────────────────────────────────────────
describe("banish — règles pures (resolveBanishTarget / éligibilité)", () => {
  it("bannit un Allié adverse : EXIL du propriétaire, PAS la Défausse, AUCUN XP", () => {
    const f = fixture([], [makeAlly("b0", { xp: 2 })]);
    bringToMonde(f, "B", instId("B", 0));
    const res = resolveBanishTarget(ctxOf(f), "A", instId("B", 0));
    dispatch(f, ...res.events);
    const s = ctxOf(f).state;
    // EXIL du propriétaire (B), jamais la Défausse.
    expect(s.seats.B.exil).toContain(instId("B", 0));
    expect(s.seats.B.defausse).not.toContain(instId("B", 0));
    expect(s.monde).not.toContain(instId("B", 0));
    // AUCUN XP accordé au Héros de A (contraste direct avec la destruction).
    expect(s.instances[HERO_A].counters.xp ?? 0).toBe(0);
  });

  it("CONTRASTE : la destruction du même Allié accorde l'XP (415.1) ; le bannissement non", () => {
    // destruction → XP
    const fDestroy = fixture([], [makeAlly("b0", { xp: 3 })]);
    bringToMonde(fDestroy, "B", instId("B", 0));
    dispatch(
      fDestroy,
      ...resolveDestroyTarget(ctxOf(fDestroy), "A", instId("B", 0)).events,
    );
    expect(ctxOf(fDestroy).state.instances[HERO_A].counters.xp).toBe(3);
    // bannissement → pas d'XP
    const fBanish = fixture([], [makeAlly("b0", { xp: 3 })]);
    bringToMonde(fBanish, "B", instId("B", 0));
    dispatch(
      fBanish,
      ...resolveBanishTarget(ctxOf(fBanish), "A", instId("B", 0)).events,
    );
    expect(ctxOf(fBanish).state.instances[HERO_A].counters.xp ?? 0).toBe(0);
  });

  it("ne route PAS via resolveDestroyTarget : aucun event vers la Défausse", () => {
    const f = fixture([], [makeAlly("b0", { xp: 5 })]);
    bringToMonde(f, "B", instId("B", 0));
    const res = resolveBanishTarget(ctxOf(f), "A", instId("B", 0));
    // un unique MOVE, destination Exil (jamais defausse).
    const moves = res.events.filter((e) => e.type === "MOVE");
    expect(moves).toHaveLength(1);
    expect((moves[0].payload as { to: { zone: string } }).to.zone).toBe("exil");
    // aucun event d'XP (INC_COUNTER xp) n'a été produit.
    expect(
      res.events.some(
        (e) =>
          e.type === "INC_COUNTER" &&
          (e.payload as { counter?: string }).counter === "xp",
      ),
    ).toBe(false);
  });

  it("éligibilité banishTarget : type / Famille / Niveau max / contrôleur", () => {
    const f = fixture(
      [makeAlly("a-demon", { niveau: 5 })],
      [makeAlly("b-demon", { niveau: 2 }), makeAlly("b-autre", { niveau: 1 })],
    );
    // marque les Familles sur les cartes
    (f.cards.get("a-demon") as { subTypes?: string[] }).subTypes = ["Démon"];
    (f.cards.get("b-demon") as { subTypes?: string[] }).subTypes = ["Démon"];
    (f.cards.get("b-autre") as { subTypes?: string[] }).subTypes = ["Tofu"];
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    // tous les Alliés (mono-type Allié)
    expect(
      effectTargetIds(ctxOf(f), {
        op: "banishTarget",
        what: "Allié",
        zones: ["monde"],
      }).sort(),
    ).toEqual([instId("A", 0), instId("B", 0), instId("B", 1)].sort());
    // seulement les Démons
    expect(
      effectTargetIds(ctxOf(f), {
        op: "banishTarget",
        sub: "demon",
        zones: ["monde"],
      }).sort(),
    ).toEqual([instId("A", 0), instId("B", 0)].sort());
    // Démon de Niveau ≤ 3 : seul b-demon (niveau 2)
    expect(
      effectTargetIds(ctxOf(f), {
        op: "banishTarget",
        sub: "demon",
        maxLevel: 3,
        zones: ["monde"],
      }),
    ).toEqual([instId("B", 0)]);
    // « … adverse » (controller opponent) vu de A : uniquement les Alliés de B
    expect(
      effectTargetIds(
        ctxOf(f),
        {
          op: "banishTarget",
          what: "Allié",
          controller: "opponent",
          zones: ["monde"],
        },
        "A",
      ).sort(),
    ).toEqual([instId("B", 0), instId("B", 1)].sort());
  });
});

// ── Volet 2 : DSL ────────────────────────────────────────────────────────────
describe("banish — DSL (positifs)", () => {
  it("Geôles d'Astrub → cost:banishSelf + banishTarget Allié (Monde)", () => {
    const text =
      "Bannissez les Geôles d'Astrub : Bannissez l'Allié de votre choix dans le Monde.";
    expect(isBanishCostText(text)).toBe(true);
    expect(
      compileTapEffectText(text, "Les Geôles d'Astrub"),
    ).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "banishSelf",
      ops: [{ op: "banishTarget", what: "Allié", zones: ["monde"] }],
    });
  });

  it("Têtes à Clic et à Clac → cost:banishSelf + banishTarget Démon", () => {
    const text =
      "Bannissez les Têtes à Clic et à Clac : Bannissez le Démon de votre choix.";
    expect(
      compileTapEffectText(text, "Les Têtes à Clic et à Clac"),
    ).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "banishSelf",
      ops: [
        { op: "banishTarget", what: "Allié", sub: "demon", zones: ["monde"] },
      ],
    });
  });

  it("Carte du Grav'Mar'Av' → cost:banishSelf + searchDeck Zone + shuffleDeck", () => {
    const text =
      "Bannissez la Carte du Grav'Mar'Av' : Cherchez une carte Zone dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche.";
    expect(
      compileTapEffectText(text, "La Carte du Grav'Mar'Av'"),
    ).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "banishSelf",
      ops: [
        { op: "searchDeck", what: "Zone", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("cible autonome (Action) « Bannissez l'Allié … » → banishTarget (filtres sub/maxLevel)", () => {
    expect(
      compileActionEffectText(
        "Bannissez l'Allié de votre choix de Niveau inférieur ou égal à 3.",
        "X",
      )?.ops[0],
    ).toEqual({
      op: "banishTarget",
      what: "Allié",
      maxLevel: 3,
      zones: ["monde"],
    });
    expect(
      compileActionEffectText("Bannissez le Démon de votre choix.", "X")
        ?.ops[0],
    ).toEqual({
      op: "banishTarget",
      what: "Allié",
      sub: "demon",
      zones: ["monde"],
    });
  });
});

describe("banish — DSL (négatifs : skip fidèle, jamais d'approximation)", () => {
  it("Arbre de Vie : « Réduisez à 0 les Dommages … » sans op bouclier → manuel (null)", () => {
    const text =
      "Bannissez l'Arbre de Vie : Réduisez à 0 les Dommages sur le point d'être infligés à votre Héros.";
    expect(isBanishCostText(text)).toBe(true); // routé…
    expect(compileTapEffectText(text, "L'Arbre de Vie")).toBeNull(); // …mais corps non mappé
  });

  it("Bibliothèque de Barbok : recherche multi-type « Équipement ou Zone » → manuel (null)", () => {
    const text =
      "Bannissez la Bibliothèque de Barbok depuis votre Défausse : Cherchez une carte Équipement ou Zone dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche.";
    expect(compileTapEffectText(text, "La Bibliothèque de Barbok")).toBeNull();
  });

  it("bannissement depuis la Défausse ADVERSE → banishFromZone (pas banishTarget)", () => {
    // ciblage de PILE (Défausse adverse), pas une créature en jeu : op dédiée
    // banishFromZone (controller opponent), pas banishTarget.
    expect(
      compileActionEffectText(
        "Bannissez l'Allié de votre choix dans la Défausse d'un adversaire.",
        "X",
      )?.ops[0],
    ).toEqual({
      op: "banishFromZone",
      from: "defausse",
      controller: "opponent",
      what: "Allié",
    });
  });
});

// ── Volet 5 : DSL + moteur — banishFromZone (Snouffle, Poubelles d'Astrub) ───
describe("banishFromZone — Défausse adverse (Snouffle / Poubelles d'Astrub)", () => {
  it("Snouffle → banishFromZone Équipement (Défausse adverse) + draw", () => {
    expect(
      compileActionEffectText(
        "Bannissez l'Équipement de votre choix dans la Défausse d'un adversaire, puis piochez une carte.",
        "Snouffle",
      ),
    ).toEqual<CompiledEffect>({
      trigger: "onPlay",
      ops: [
        {
          op: "banishFromZone",
          from: "defausse",
          controller: "opponent",
          what: "Équipement",
        },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("Poubelles d'Astrub → banishFromZone sans filtre (« la carte ») + draw", () => {
    expect(
      compileActionEffectText(
        "Bannissez la carte de votre choix de la Défausse d'un adversaire. Piochez une carte.",
        "Poubelles d'Astrub",
      ),
    ).toEqual<CompiledEffect>({
      trigger: "onPlay",
      ops: [
        { op: "banishFromZone", from: "defausse", controller: "opponent" },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("MOTEUR (isolé) : choix dans la Défausse ADVERSE → la carte choisie part en Exil de son propriétaire", () => {
    // B a deux cartes en Défausse (un Équipement, un Allié) ; A bannit
    // l'Équipement → seul l'Équipement est éligible, et il est déplacé vers
    // l'Exil de B (owner = adversaire), pas la Défausse de A.
    const EQ: Card = {
      id: "b-eq",
      name: "Équipement B",
      mainType: "Équipement",
      extension: "Test",
      rarity: "Commune",
    } as unknown as Card;
    const ALLY: Card = {
      id: "b-ally",
      name: "Allié B",
      mainType: "Allié",
      extension: "Test",
      rarity: "Commune",
    } as unknown as Card;
    const inst = (id: string, cardId: string) => ({
      instanceId: id,
      cardId,
      owner: "B" as const,
      controller: "B" as const,
      orientation: "upright" as const,
      location: { zone: "defausse" as const, owner: "B" as const },
      counters: {},
      attachments: [],
      revealedTo: ["A", "B"],
    });
    const state = {
      turn: { active: "A", number: 1 },
      monde: [],
      instances: {
        eq1: inst("eq1", "b-eq"),
        al1: inst("al1", "b-ally"),
      },
      seats: {
        A: { main: [], pioche: [], defausse: [], havreSac: [], exil: [] },
        B: {
          main: [],
          pioche: [],
          defausse: ["eq1", "al1"],
          havreSac: [],
          exil: [],
        },
      },
    } as unknown as GameState;
    const getCard = (id: string | null) =>
      id === "b-eq" ? EQ : id === "b-ally" ? ALLY : null;
    const moves: { id: string; to: unknown }[] = [];
    const engine = createEffectEngine({
      getState: () => state,
      rulesCtx: () => ({ state, getCard }),
      getCard,
      isAssist: () => true,
      isAssistEffects: () => true,
      getMatchPhase: () => "playing",
      playerName: () => "Joueur",
      paOf: () => 6,
      dispatch: () => {},
      moveTo: (id: string, to: unknown) => moves.push({ id, to }),
      shufflePioche: () => {},
      checkVictory: () => {},
      draw: () => {},
      adjustCounter: () => {},
      onMatchWon: () => {},
    } as unknown as EffectEngineDeps);
    engine.enqueueEffect({
      seat: "A",
      cardName: "Snouffle",
      sourceId: "ci_A_001",
      ops: [
        {
          op: "banishFromZone",
          from: "defausse",
          controller: "opponent",
          what: "Équipement",
        },
      ],
    });
    // seul l'Équipement de la Défausse de B est éligible.
    expect(engine.effectPickIds.value).toEqual(["eq1"]);
    engine.effectPick("eq1");
    // la carte choisie est déplacée vers l'Exil de son propriétaire (B).
    expect(moves).toEqual([{ id: "eq1", to: { zone: "exil", owner: "B" } }]);
    expect(engine.effectPicking.value).toBeNull();
  });
});

// ── Volet 3 : REDUCER (jeton banni cesse d'exister) ──────────────────────────
function ev(
  type: PersistedEvent["type"],
  payload: unknown,
  seq: number,
): PersistedEvent {
  return {
    gameId: "g",
    seq,
    parentSeq: seq - 1,
    actor: "A",
    type,
    payload,
    ts: seq,
  };
}

describe("banish — reducer (jeton banni → Exil → cesse d'exister)", () => {
  it("un jeton banni (MOVE vers Exil) est retiré des instances", () => {
    resetTokenRegistry();
    const spec = { name: "Monstre - Arakne", force: 1, sub: "Arakne" };
    const cardId = tokenCardId(spec);
    ensureTokenCard(spec);
    let s: GameState = emptyState();
    s.status = "active";
    s = applyEvent(
      s,
      ev("CREATE_TOKEN", { instanceId: "tok_A_1", cardId, controller: "A" }, 1),
    );
    s = applyEvent(
      s,
      ev(
        "MOVE",
        {
          instanceId: "tok_A_1",
          from: { zone: "monde" },
          to: { zone: "exil", owner: "A" },
          position: { at: "top" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
        },
        2,
      ),
    );
    // banni hors-jeu : ni en Exil, ni dans les instances → a cessé d'exister.
    expect(s.instances["tok_A_1"]).toBeUndefined();
    expect(s.seats.A.exil).not.toContain("tok_A_1");
    expect(s.monde).not.toContain("tok_A_1");
  });
});
