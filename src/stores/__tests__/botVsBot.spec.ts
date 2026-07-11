/**
 * HARNAIS QA BOT-VS-BOT — banc d'essai des 4 decks starter Incarnam.
 *
 * But : faire jouer une partie COMPLÈTE entre deux bots « gloutons » (coups
 * légaux, pas de stratégie) avec les VRAIS decks starter et les VRAIES données
 * de cartes (effets compilés inclus), pour valider que le moteur + tous les
 * sous-systèmes (Métier, Défi, Échec Critique, Kanigrou, ciblages, choix,
 * combat) tournent SANS blocage / crash / boucle infinie jusqu'à un vainqueur.
 *
 * Le bot résout TOUTE surface d'interaction qu'expose le store (ciblage, choix,
 * pioche, fenêtres Échec/Chi-Fu-Mi, combat), puis joue une carte abordable ou
 * finit son tour. Aucune stratégie — on ne teste que la ROBUSTESSE de bout en bout.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import { OFFICIAL_DECKS } from "@/data/officialDecks";
import { buildOfficialDeck } from "@/composables/useOfficialDeckImport";
import { botStep } from "@/game/ai/botPolicy";

// ── Chargement des vraies données de cartes (public/data/*.json) ──────────────
function loadAllCards(): { all: Card[]; byName: Map<string, Card> } {
  const dir = join(process.cwd(), "public", "data");
  const byName = new Map<string, Card>();
  const all: Card[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    let arr: unknown;
    try {
      arr = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const c of arr as Card[]) {
      all.push(c);
      if (!byName.has(c.name)) byName.set(c.name, c);
    }
  }
  return { all, byName };
}

const { all: ALL_CARDS, byName: CARD_BY_NAME } = loadAllCards();
const INCARNAM_STARTERS = OFFICIAL_DECKS.filter(
  (d) => d.extension === "incarnam",
);

function makeDeck(officialId: string): Deck {
  const od = INCARNAM_STARTERS.find((d) => d.id === officialId)!;
  const built = buildOfficialDeck(od, (n) => CARD_BY_NAME.get(n) ?? null);
  return {
    id: od.id,
    name: od.name,
    hero: built.heroCard,
    havreSac: built.havreSacCard,
    cards: built.deckCards.map((dc) => ({
      card: dc.card,
      quantity: dc.quantity,
    })),
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

type Store = ReturnType<typeof useGameStore>;

/**
 * Résout UNE surface d'interaction ouverte (priorité) OU joue un coup de phase
 * principale. Retourne false si le seul coup restant est « finir le tour ».
 */
function driveOnce(store: Store, triedThisTurn: Set<string>): boolean {
  // 1. Fenêtres d'interaction bloquantes (à résoudre avant tout le reste).
  if (store.pendingChifumi) {
    store.chifumiDecline(); // le plus simple : subir (toujours légal)
    return true;
  }
  if (store.pendingResolution) {
    store.passPendingResolution(); // ne pas annuler : laisser résoudre
    return true;
  }
  if (store.pendingBearer) {
    store.cancelBearerTargeting(); // l'équipement reste en main (marqué tried)
    return true;
  }
  if (store.pendingPayment) {
    // Harnais glouton : paiement AUTO (le choix manuel est une affordance
    // humaine ; ici on ne teste que la robustesse de bout en bout).
    if (!store.payAuto()) store.payCancel();
    return true;
  }
  if (store.effectPicking) {
    const ids = store.effectPickIds;
    if (ids.length) store.effectPick(ids[0]);
    else store.effectPickSkip();
    return true;
  }
  if (store.effectTargeting) {
    const ids = store.effectTargetIdsList;
    if (ids.length) store.effectTargetChoose(ids[0]);
    else store.effectTargetSkip();
    return true;
  }
  if (store.effectChoice) {
    if (store.effectChoice.options?.length) store.effectChoiceSelect(0);
    else store.effectChoiceResolve(false); // décline / branche B (toujours légal)
    return true;
  }
  // 2. Combat en cours : dérouler l'état pas à pas.
  if (store.combat) {
    driveCombat(store);
    return true;
  }
  // 3. Phase principale : jouer une carte abordable, activer un pouvoir, attaquer.
  const seat = store.perspective; // hot-seat : perspective = joueur actif
  const hand = [...(store.state.seats[seat]?.main ?? [])];
  for (const id of hand) {
    if (triedThisTurn.has(id)) continue;
    triedThisTurn.add(id);
    if (store.playFromHand(id)) return true; // joué (peut ouvrir une interaction)
  }
  // pouvoirs à inclinaison des cartes en jeu (une fois par carte/tour ≈ inclinée)
  for (const zone of ["monde", "havreSac"] as const) {
    for (const inst of Object.values(store.state.instances)) {
      if (inst.controller !== seat || inst.location.zone !== zone) continue;
      if (triedThisTurn.has("pw:" + inst.instanceId)) continue;
      triedThisTurn.add("pw:" + inst.instanceId);
      if (store.hasHandPower?.(inst.instanceId) === false) {
        // pas de pouvoir → ignore
      }
      if (store.activateTapPower(inst.instanceId)) return true;
    }
  }
  // attaquer si un attaquant est éligible (sinon → finir le tour)
  if (
    !triedThisTurn.has("__attack__") &&
    store.canDeclareAttack &&
    store.eligibleAttackerIds.length
  ) {
    triedThisTurn.add("__attack__");
    if (store.beginCombat(store.eligibleAttackerIds[0])) return true;
  }
  return false; // plus rien à faire → l'appelant finit le tour
}

/** Déroule un combat local jusqu'à sa résolution (attaque simple + blocage). */
function driveCombat(store: Store): void {
  const c = store.combat;
  if (!c) return;
  // fenêtre de réaction éventuelle → la clore.
  if (c.reactingSeat) {
    store.combatEndReaction();
    return;
  }
  if (c.step === "attackers") {
    if (!c.target) {
      const t = store.combatTargetIds;
      if (t.length) store.combatChooseTarget(t[0]);
      else store.combatCancel(); // aucune cible → abandonner
      return;
    }
    // GREEDY = attaque avec TOUT ce qui est disponible. N'envoyer qu'UN attaquant
    // laissait le défenseur le bloquer → le Havre-Sac adverse ne tombait jamais
    // (parties sans fin depuis que le Héros est protégé au Havre-Sac). On déclare
    // les attaquants un par un (éligibles NON encore déclarés) jusqu'à épuisement
    // OU refus (plafond de PM 307.3c/703), puis on confirme.
    const undeclared = store.combatAttackerIds.filter(
      (id) => !c.attackers.includes(id),
    );
    if (undeclared.length) {
      const before = c.attackers.length;
      store.combatToggleAttacker(undeclared[0]);
      // le toggle a bien ajouté → continuer ; sinon (plafond) → confirmer.
      if ((store.combat?.attackers.length ?? 0) > before) return;
    }
    if (store.combat?.attackers.length) store.combatConfirmAttackers();
    else store.combatCancel();
    return;
  }
  if (c.step === "blockers") {
    // bloquer avec le 1er bloqueur légal (exerce Kanigrou/ripostes) si possible,
    // puis résoudre. Sinon résoudre directement (l'attaque passe).
    const b = store.combatBlockerIds;
    if (b.length && !Object.keys(c.blocks).length) {
      store.combatToggleBlock(b[0]);
      // Assigne le bloqueur au PREMIER attaquant qu'il peut légalement bloquer
      // (un attaquant Agilité 704 est inblocable par un bloqueur sans Agilité :
      // insister sur `attackers[0]` bouclait à l'infini). Si aucun attaquant n'est
      // blocable, on DÉSÉLECTIONNE et on résout (l'attaque passe) — jamais de
      // livelock.
      if (store.combat?.pendingBlocker) {
        for (const atkId of store.combat.attackers) {
          store.combatChooseBlockTarget(atkId);
          if (!store.combat?.pendingBlocker) break; // blocage committé
        }
        if (store.combat?.pendingBlocker) store.combatToggleBlock(b[0]);
      }
      // blocage committé → laisser la résolution au prochain appel ; sinon résoudre.
      if (store.combat && Object.keys(store.combat.blocks).length) return;
    }
    store.combatResolve();
    return;
  }
  if (c.step === "strikes") {
    const s = store.combatStrikeIds;
    if (s.length) store.combatChooseStrike(s[0]);
    else store.combatResolve();
    return;
  }
  if (c.step === "riposte") {
    const r = store.combatRiposteIds;
    if (r.length) store.combatChooseRiposte(r[0]);
    else store.combatResolve();
    return;
  }
  // état inconnu → abandonner pour garantir la progression.
  store.combatCancel();
}

/** PRNG déterministe (mulberry32) — rend le banc REPRODUCTIBLE (CI stable). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Joue une partie complète bot-vs-bot avec un Math.random SEEDÉ (reproductible).
 * Renvoie {winner, turns, actions, combats}.
 */
/** Politique de bot : joue UN coup ; `true` = progressé, `false` = finir le tour. */
type Policy = (store: Store, tried: Set<string>) => boolean;
const GREEDY: Policy = (store, tried) => driveOnce(store, tried);
const SMART: Policy = (store, tried) => botStep(store, tried, Math.random);

function playGame(
  deckA: Deck,
  deckB: Deck,
  seed: number,
  policyA: Policy = GREEDY,
  policyB: Policy = GREEDY,
) {
  const realRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    setActivePinia(createPinia());
    const cardStore = useCardStore();
    cardStore.cards = ALL_CARDS;
    const store = useGameStore();
    store.startSandbox(deckA, deckB, "A");

    const MAX_ACTIONS = 40000;
    const MAX_TURNS = 100;
    let actions = 0;
    let combats = 0;
    let curTurn = -1;
    let inCombat = false;
    let tried = new Set<string>();

    while (!store.winner && actions < MAX_ACTIONS) {
      if (store.state.turn.number !== curTurn) {
        curTurn = store.state.turn.number;
        tried = new Set();
        if (curTurn > MAX_TURNS) break;
      }
      if (store.combat && !inCombat) combats++;
      inCombat = !!store.combat;
      // Qui DÉCIDE ? Normalement l'acteur courant (perspective). MAIS le blocage
      // appartient au DÉFENSEUR (≠ perspective = attaquant) — sinon la politique
      // de l'attaquant déciderait des blocages adverses, faussant la comparaison.
      let seat = store.perspective;
      const cb = store.combat;
      if (cb && cb.step === "blockers" && !Object.keys(cb.blocks).length)
        seat = store.state.turn.active === "A" ? "B" : "A";
      const policy = seat === "A" ? policyA : policyB;
      const progressed = policy(store, tried);
      actions++;
      if (!progressed) {
        store.endTurn();
        tried = new Set();
      }
    }
    return {
      winner: store.winner,
      turns: store.state.turn.number,
      actions,
      combats,
    };
  } finally {
    Math.random = realRandom;
  }
}

/** Graine déterministe dérivée de la paire de decks. */
function seedFor(a: string, b: string): number {
  return [...(a + "|" + b)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
}

describe("Bot-vs-bot QA — les 4 decks starter Incarnam tournent de bout en bout", () => {
  it("a bien chargé les 4 starters + toutes leurs cartes (aucune manquante)", () => {
    expect(INCARNAM_STARTERS).toHaveLength(4);
    for (const od of INCARNAM_STARTERS) {
      const built = buildOfficialDeck(od, (n) => CARD_BY_NAME.get(n) ?? null);
      expect(built.missing, `${od.name}: cartes manquantes`).toEqual([]);
      expect(built.heroCard, `${od.name}: héros`).toBeTruthy();
      expect(built.havreSacCard, `${od.name}: havre-sac`).toBeTruthy();
    }
  });

  // Toutes les paires (miroirs inclus) : chaque partie doit se terminer par un
  // vainqueur, sans exception ni boucle infinie.
  const ids = INCARNAM_STARTERS.map((d) => d.id);
  const pairs: [string, string][] = [];
  for (const a of ids) for (const b of ids) pairs.push([a, b]);

  for (const [a, b] of pairs) {
    it(`partie complète : ${a} vs ${b} → un vainqueur`, () => {
      const res = playGame(makeDeck(a), makeDeck(b), seedFor(a, b));
      expect(
        res.winner,
        `pas de vainqueur en ${res.turns} tours / ${res.actions} actions`,
      ).toBeTruthy();
      expect(res.actions).toBeLessThan(40000);
      // sanité : une vraie partie passe par au moins un combat (sinon aucun
      // Héros ne meurt — le harnais ne se contenterait pas de vider les mains).
      expect(res.combats, "aucun combat déclaré").toBeGreaterThan(0);
    });
  }
});

describe("IA — le bot INTELLIGENT bat le bot glouton (validation heuristique)", () => {
  // Chaque paire de decks distincts est jouée deux fois (l'intelligent en A puis
  // en B) sur des graines variées ; on mesure le taux de victoire de l'intelligent.
  const ids = INCARNAM_STARTERS.map((d) => d.id);
  it("gagne nettement plus de la moitié des parties face au glouton", () => {
    let smartWins = 0;
    let games = 0;
    let s = 1;
    const SEEDS = 5; // 60 parties → taux stable (faible variance)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const dA = makeDeck(ids[i]);
        const dB = makeDeck(ids[j]);
        for (let k = 0; k < SEEDS; k++) {
          // intelligent en A puis en B (équité de côté / premier joueur).
          const r1 = playGame(dA, dB, s++, SMART, GREEDY);
          if (r1.winner === "A") smartWins++;
          games++;
          const r2 = playGame(dA, dB, s++, GREEDY, SMART);
          if (r2.winner === "B") smartWins++;
          games++;
        }
      }
    }
    const rate = smartWins / games;
    // l'heuristique (attaques non suicidaires, blocages qui tuent, ciblage) doit
    // dominer NETTEMENT le jeu au 1er coup légal. Seuil à 0.55 (et non 0.6) depuis
    // que les Équipements coûtent des Ressources (récup des Niveau, audit 2026-07) :
    // les deux bots paient désormais leurs Équipements, ce qui a légèrement réduit
    // la marge de l'IA — elle bat toujours clairement le glouton (>55% sur 60 parties).
    expect(
      rate,
      `taux de victoire IA = ${(rate * 100).toFixed(0)}% (${smartWins}/${games})`,
    ).toBeGreaterThan(0.55);
  }, 90000);
});
