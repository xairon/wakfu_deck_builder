/**
 * tutorialStore — leçons interactives sur la vraie table. Registre de leçons :
 *  - `decouverte` = « Apprendre à jouer » (la boucle de base) ;
 *  - `combat` = leçon de combat complète (attaque + blocage + résolution).
 * Machinerie partagée : pilotage du `TutorialCoach` (spotlight), étapes ancrées
 * + `advanceWhen`, adversaire auto-piloté (bot), `tick` de rattrapage.
 * Réf. docs/superpowers/specs/2026-06-16-tutoriels-par-mecanique-design.md.
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Card, Deck, HeroCard } from "@/types/cards";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";

const DONE_KEY = "wakfu-tutorial-done";

export interface TutorialStep {
  /** Sélecteur CSS de l'élément à mettre en lumière (spotlight). */
  anchor: string;
  /** Texte fixe, ou calculé à l'affichage (ex. conseil de mulligan). */
  text: string | (() => string);
  /** Étape informative : avance via le bouton « Suivant ». */
  manual?: boolean;
  /** Étape validée par l'état du jeu. */
  advanceWhen?: () => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** Une ligne pour le sélecteur du lobby. */
  summary: string;
  /** Arrange le plateau (decks + placement + tour). `false` si impossible. */
  setup: () => boolean;
  steps: TutorialStep[];
  /** Comportement du bot adverse propre à la leçon. */
  botPolicy?: { blocks?: boolean };
}

export const useTutorialStore = defineStore("tutorial", () => {
  const game = useGameStore();
  const cardStore = useCardStore();

  const active = ref(false);
  const stepIndex = ref(0);
  const activeLesson = ref<Lesson | null>(null);
  let botTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  // ── Aides d'état ───────────────────────────────────────────────────────────
  function myAllies(): number {
    const s = game.state;
    return s.monde.filter(
      (id) =>
        s.instances[id]?.controller === "A" &&
        id !== s.seats.A.havreSacInstanceId,
    ).length;
  }

  /** Conseil de mulligan, calculé sur la main RÉELLEMENT tirée. */
  function evaluateMulligan(): string {
    const zone = game.view.seats.A.main;
    const insts = zone.kind === "full" ? zone.instances : [];
    const base =
      "Une bonne main permet d'AGIR TÔT : 1–2 Alliés bon marché (Niveau 1–2) et de quoi produire des Ressources, sans trop de cartes chères injouables d'entrée.";
    let cheap = 0;
    for (const inst of insts) {
      const card = cardStore.cards.find((c) => c.id === inst.cardId);
      const lvl = card?.stats?.niveau?.value ?? 0;
      if (card?.mainType === "Allié" && lvl > 0 && lvl <= 2) cheap++;
    }
    const verdict = !insts.length
      ? ""
      : cheap >= 2
        ? ` Ici : ${cheap} Alliés jouables tôt — bonne main, garde-la.`
        : cheap === 1
          ? " Ici : 1 seul Allié jouable tôt — gardable, mais juste."
          : " Ici : aucun Allié jouable tôt — sur un vrai deck, tu la referais.";
    return `${base}${verdict} Tu peux cliquer « Mulligan » pour refaire ta main (une carte de moins), ou « Garder » pour la conserver.`;
  }

  // ── Decks du tutoriel (cartes réelles, simples, sans effets compilés) ──────
  function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
  }
  function buildDecks(): { a: Deck; b: Deck } | null {
    const all = cardStore.cards;
    const heroes = all.filter((c): c is HeroCard => c.mainType === "Héros");
    const sacs = all.filter((c) => c.mainType === "Havre-Sac");
    if (!heroes.length || !sacs.length) return null;
    for (const el of ["Feu", "Eau", "Terre", "Air"]) {
      const hero = heroes.find(
        (h) =>
          (h.recto?.stats?.force?.element ??
            h.recto?.stats?.niveau?.element) === el,
      );
      const pool = all.filter(
        (c) =>
          c.mainType === "Allié" &&
          c.stats?.niveau?.value === 1 &&
          c.stats?.niveau?.element === el &&
          (c.stats?.force?.value ?? 0) >= 1 &&
          (c.effects ?? []).every((e) => !e.compiled) &&
          !(c.subTypes ?? []).includes("Unique"),
      );
      if (!hero || pool.length < 8) continue;
      const mk = (id: string, h: Card, s: Card): Deck => ({
        id,
        name: id,
        hero: clone(h) as Deck["hero"],
        havreSac: clone(s) as Deck["havreSac"],
        cards: pool.slice(0, 16).map((card) => ({
          card: clone(card),
          quantity: 3,
          isReserve: false,
        })),
        createdAt: "",
        updatedAt: "",
      });
      return {
        a: mk("tutoriel-toi", hero, sacs[0]),
        b: mk("tutoriel-adversaire", hero, sacs[1] ?? sacs[0]),
      };
    }
    return null;
  }

  // ── Setups de leçon ────────────────────────────────────────────────────────
  /** « Apprendre à jouer » : partie complète depuis le mulligan, B commence. */
  function setupDecouverte(): boolean {
    const decks = buildDecks();
    if (!decks) return false;
    game.assist = true;
    // v1 « Cockatrice » : règles gérées, effets de cartes résolus à la main.
    game.assistEffects = false;
    game.startMatch(decks.a, decks.b, {
      nameA: "Toi",
      nameB: "L'adversaire",
      first: "B",
    });
    // L'adversaire (B, 1er joueur) résout son pré-jeu INSTANTANÉMENT : sinon
    // l'écran clignote entre passation et mulligan adverses au lancement.
    game.reveal();
    game.keepHand();
    return true;
  }

  /** Sommet de la Pioche d'un siège = un Allié (les decks tuto n'ont que ça). */
  function firstAlly(seat: "A" | "B"): string | undefined {
    return game.state.seats[seat].pioche[0];
  }

  /** Decks de la leçon combat : ton attaquant (Force max, sans Résistance, qui
   * survivra) et un bloqueur adverse (Force 1 qui rapporte de l'XP en tombant). */
  function buildCombatLessonDecks(): { a: Deck; b: Deck } | null {
    const all = cardStore.cards;
    const hero = all.find((c): c is HeroCard => c.mainType === "Héros");
    const sac = all.find((c) => c.mainType === "Havre-Sac");
    const hasRes = (c: Card) =>
      (c.keywords ?? []).some((k) => k.name === "Résistance");
    const lvl1 = all.filter(
      (c) =>
        c.mainType === "Allié" &&
        c.stats?.niveau?.value === 1 &&
        (c.stats?.force?.value ?? 0) >= 1 &&
        (c.effects ?? []).every((e) => !e.compiled) &&
        !(c.subTypes ?? []).includes("Unique"),
    );
    const attacker = [...lvl1]
      .filter((c) => !hasRes(c))
      .sort(
        (a, b) => (b.stats?.force?.value ?? 0) - (a.stats?.force?.value ?? 0),
      )[0];
    const blocker = lvl1.find(
      (c) =>
        c !== attacker &&
        (c.stats?.force?.value ?? 0) === 1 &&
        (c.experience ?? 0) >= 1 &&
        !hasRes(c),
    );
    if (!hero || !sac || !attacker || !blocker) return null;
    const mk = (id: string, ally: Card): Deck => ({
      id,
      name: id,
      hero: clone(hero) as Deck["hero"],
      havreSac: clone(sac) as Deck["havreSac"],
      cards: [{ card: clone(ally), quantity: 3, isReserve: false }],
      createdAt: "",
      updatedAt: "",
    });
    return { a: mk("lecon-toi", attacker), b: mk("lecon-adv", blocker) };
  }

  /** Leçon « Combat » : plateau pré-arrangé, ton attaquant prêt, un bloqueur adverse. */
  function setupCombat(): boolean {
    const decks = buildCombatLessonDecks();
    if (!decks) return false;
    game.assist = true;
    game.assistEffects = false;
    game.startSandbox(decks.a, decks.b, "A");
    const aAlly = firstAlly("A");
    const bAlly = firstAlly("B");
    if (!aAlly || !bAlly) return false;
    game.moveTo(aAlly, { zone: "monde" }); // arrivé tour 1 → attaque légale ensuite
    game.nextTurn(); // tour 2 (B)
    game.nextTurn(); // tour 3 (A) — l'attaque devient légale
    // un Allié adverse fraîchement arrivé PEUT bloquer (le mal d'invocation ne
    // concerne que l'ATTAQUE), donc on le pose maintenant.
    game.moveTo(bAlly, { zone: "monde" });
    game.attackedOnTurn = null;
    return true;
  }

  /** Texte du résultat du duel, calculé sur l'état réel (XP gagné, survie). */
  function combatResultText(): string {
    const heroA = game.state.seats.A.heroInstanceId;
    const xp = heroA ? (game.state.instances[heroA]?.counters.xp ?? 0) : 0;
    const sacA = game.state.seats.A.havreSacInstanceId;
    const aAlive = game.state.monde.some(
      (id) => game.state.instances[id]?.controller === "A" && id !== sacA,
    );
    const base =
      "Duel résolu ! Chaque Allié inflige sa Force à l'autre, simultanément. Un Allié est DÉTRUIT quand les dégâts reçus ≥ sa Force (sa Résistance en retire d'abord). ";
    const parts: string[] = [];
    if (xp > 0)
      parts.push(
        `tu as détruit l'Allié adverse → +${xp} XP pour ton Héros (6 XP = Niveau 2, 18 XP = victoire)`,
      );
    parts.push(
      aAlive
        ? "ton attaquant a encaissé sans tomber, il survit"
        : "ton attaquant est tombé aussi — un échange",
    );
    return `${base}${parts.join(", ")}. Le détail est dans le journal. Tu sais te battre !`;
  }

  // ── Étapes ─────────────────────────────────────────────────────────────────
  const decouverteSteps: TutorialStep[] = [
    {
      anchor: ".overlay .btn-primary",
      text: "Bienvenue dans le Wakfu TCG ! Le but : réduire les PV du Héros adverse à 0, ou monter ton Héros au Niveau 3 (18 XP). Ici tu joues « Toi » — l'adversaire est piloté automatiquement. Clique « Je suis prêt ».",
      // conditions MONOTONES : restent vraies une fois atteintes, le tick de
      // rattrapage peut donc traverser plusieurs étapes si une fenêtre a été
      // manquée (les étapes auto n'ont pas de bouton, seul l'état avance).
      advanceWhen: () =>
        !game.passPending &&
        (game.mulliganSeat === "A" || game.matchPhase === "playing"),
    },
    {
      anchor: ".overlay--mulligan",
      text: evaluateMulligan,
      advanceWhen: () => game.matchPhase === "playing",
    },
    {
      anchor: ".overlay .btn-primary",
      text: "L'adversaire a joué son premier tour. À toi ! En partie locale, l'écran de passation cache la main de celui qui ne joue pas. Clique « Je suis prêt ».",
      advanceWhen: () =>
        !game.passPending &&
        game.matchPhase === "playing" &&
        game.turn.active === "A",
    },
    {
      anchor: ".gseat:not(.gseat--opp) .ghud",
      manual: true,
      text: "Ton Héros : PV (à 0, c'est la défaite), PA (taille de ta main), PM (nombre maximal d'attaquants ou de bloqueurs), XP et Niveau (6 XP → Niveau 2 et face verso, 18 XP → victoire).",
    },
    {
      anchor: ".gseat__handzone:not(.gseat__handzone--opp)",
      manual: true,
      text: "Ta main. Jouer une carte coûte son Niveau en Ressources : tes cartes en jeu s'inclinent pour payer — c'est automatique ici.",
    },
    {
      anchor: ".gseat:not(.gseat--opp) .ghud__mana",
      manual: true,
      text: "Tes Ressources (« mana ») par Élément : tes cartes en jeu (Héros, Havre-Sac, Alliés…) les produisent en s'inclinant. L'adversaire ayant commencé, tu joues en SECOND — à ton premier tour, ton Havre-Sac vaut 2 Ressources (badge « +1 » doré). C'est pour ça que tu as 3 mana et lui seulement 2.",
    },
    {
      anchor: ".gzone--play",
      text: "À toi de jouer : GLISSE un Allié de ta main sur ton champ de bataille. Son coût sera payé automatiquement (regarde tes cartes s'incliner).",
      advanceWhen: () => myAllies() >= 1,
    },
    {
      anchor: ".gendturn",
      text: "Bien joué ! Ton Allié vient d'arriver : il ne pourra attaquer qu'à ton PROCHAIN tour (mal d'invocation). Clique « Fin du tour » — tu piocheras automatiquement jusqu'à tes PA.",
      advanceWhen: () => game.turn.number >= 3,
    },
    {
      anchor: ".overlay .btn-primary",
      text: "L'adversaire a fini son tour. Re-clique « Je suis prêt ».",
      advanceWhen: () => !game.passPending && game.turn.number >= 4,
    },
    {
      anchor: ".gzone--play",
      text: "Ton Allié est redressé et prêt au combat. CLIQUE-le, puis « ⚔ Attaquer » ; désigne le HÉROS adverse comme cible (en haut), « Confirmer l'attaque », puis « Résoudre le combat ».",
      advanceWhen: () => game.attackedOnTurn !== null,
    },
    {
      anchor: ".glayout__journal",
      manual: true,
      text: "Touché ! Tout est tracé dans le journal. Les RÈGLES sont gérées pour toi (combat, coûts, PV, XP) ; les EFFETS des cartes, eux, se résolvent à la main — comme sur une vraie table. La table ne bloque jamais.",
    },
    {
      anchor: ".gendturn",
      manual: true,
      text: "Tu sais jouer ! Inflige des dégâts pour faire tomber les PV adverses, détruis des Alliés pour gagner de l'XP. Continue cette partie librement, ou quitte via « Quitter ». Bon jeu !",
    },
  ];

  const combatSteps: TutorialStep[] = [
    {
      anchor: ".gzone--play",
      text: "Leçon de combat. Ton Allié (en bas) est redressé et prêt. CLIQUE-le, puis « ⚔ Attaquer ».",
      advanceWhen: () => game.combat?.step === "attackers",
    },
    {
      anchor: ".gseat--opp",
      text: "Choisis ta CIBLE : le Héros adverse, en haut (il s'encadre quand il est ciblable).",
      advanceWhen: () => game.combat?.target != null,
    },
    {
      anchor: ".gcombat",
      text: "Valide avec « Confirmer l'attaque ».",
      advanceWhen: () => game.combat?.step === "blockers",
    },
    {
      anchor: ".gcombat",
      text: "L'adversaire BLOQUE avec son Allié : il intercepte ton attaquant. Le Héros est épargné — le duel se fera entre les deux Alliés.",
      advanceWhen: () => Object.keys(game.combat?.blocks ?? {}).length > 0,
    },
    {
      anchor: ".gcombat",
      text: "Clique « Résoudre le combat » pour lancer le duel.",
      advanceWhen: () => game.attackedOnTurn !== null,
    },
    {
      anchor: ".glayout__journal",
      manual: true,
      text: combatResultText,
    },
  ];

  // ── Registre des leçons ────────────────────────────────────────────────────
  const LESSONS: Record<string, Lesson> = {
    decouverte: {
      id: "decouverte",
      title: "Apprendre à jouer",
      summary: "La partie de A à Z : mulligan, jouer un Allié, attaquer.",
      setup: setupDecouverte,
      steps: decouverteSteps,
      botPolicy: { blocks: false },
    },
    combat: {
      id: "combat",
      title: "Le combat",
      summary: "Attaquer, se faire bloquer, résoudre un duel (létalité, XP).",
      setup: setupCombat,
      steps: combatSteps,
      botPolicy: { blocks: true },
    },
  };

  // ── Coach (dérive de la leçon active) ──────────────────────────────────────
  const step = computed(() =>
    active.value && activeLesson.value
      ? (activeLesson.value.steps[stepIndex.value] ?? null)
      : null,
  );
  const stepText = computed(() => {
    const t = step.value?.text;
    return typeof t === "function" ? t() : (t ?? "");
  });
  const total = computed(() => activeLesson.value?.steps.length ?? 0);

  /** Liste des leçons de mécanique (hors « Apprendre à jouer ») pour le lobby. */
  const mechanicLessons = computed(() =>
    Object.values(LESSONS)
      .filter((l) => l.id !== "decouverte")
      .map((l) => ({ id: l.id, title: l.title, summary: l.summary })),
  );

  // ── Cycle ──────────────────────────────────────────────────────────────────
  /** Rattrapage : traverse toutes les étapes auto déjà satisfaites. */
  function tick(): void {
    let guard = 0;
    while (
      active.value &&
      step.value &&
      !step.value.manual &&
      step.value.advanceWhen?.() &&
      guard++ < total.value
    ) {
      next();
    }
  }

  function next(): void {
    if (stepIndex.value >= total.value - 1) {
      finish();
      return;
    }
    stepIndex.value += 1;
  }

  /** Lance une leçon par son id (`decouverte`, `combat`, …). */
  function startLesson(id: string): boolean {
    const lesson = LESSONS[id];
    if (!lesson || !lesson.setup()) return false;
    activeLesson.value = lesson;
    stepIndex.value = 0;
    active.value = true;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 400);
    return true;
  }
  /** Compat : le bouton « Apprendre à jouer » / `?tutorial=1` lancent la découverte. */
  function start(): boolean {
    return startLesson("decouverte");
  }

  function stop(markDone: boolean): void {
    active.value = false;
    activeLesson.value = null;
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (markDone) {
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* stockage indisponible */
      }
    }
  }
  // Seule « Apprendre à jouer » marque le tutoriel de base comme vu.
  const finish = (): void => stop(activeLesson.value?.id === "decouverte");
  const skip = (): void => stop(activeLesson.value?.id === "decouverte");

  function isDone(): boolean {
    try {
      return localStorage.getItem(DONE_KEY) === "1";
    } catch {
      return false;
    }
  }

  // ── Adversaire auto-piloté ─────────────────────────────────────────────────
  watch(
    () =>
      [
        active.value,
        game.matchPhase,
        game.passPending,
        game.perspective,
        game.mulliganSeat,
        game.turn.active,
        game.combat?.step,
      ] as const,
    () => {
      if (!active.value || botTimer) return;
      const c = game.combat;
      // (1) Blocage du bot (leçon combat) : pendant TON attaque, l'adversaire
      // déclare un bloqueur. Pas conditionné à perspective === 'B'.
      if (
        activeLesson.value?.botPolicy?.blocks &&
        c?.step === "blockers" &&
        Object.keys(c.blocks).length === 0
      ) {
        botTimer = setTimeout(() => {
          botTimer = null;
          if (!active.value) return;
          const blocker = game.combatBlockerIds[0];
          if (blocker) game.combatToggleBlock(blocker);
        }, 650);
        return;
      }
      // (2) Tour de l'adversaire (siège B) : mulligan de sécurité / fin de tour.
      const itsB =
        game.perspective === "B" &&
        (game.mulliganSeat === "B" || game.turn.active === "B");
      if (!itsB) return;
      botTimer = setTimeout(() => {
        botTimer = null;
        if (!active.value || game.perspective !== "B") return;
        if (game.matchPhase === "mulligan") {
          if (game.passPending) game.reveal();
          else game.keepHand();
        } else if (game.matchPhase === "playing" && game.turn.active === "B") {
          // Finit son tour SANS révéler son plateau (pas de game.reveal()).
          game.endTurn();
        }
      }, 650);
    },
  );

  // ── Avance automatique des étapes validées par l'état ──────────────────────
  watch(
    () => [
      active.value,
      stepIndex.value,
      game.matchPhase,
      game.passPending,
      game.mulliganSeat,
      game.turn.number,
      game.turn.active,
      game.perspective,
      game.attackedOnTurn,
      game.combat?.step,
      game.state.seq,
    ],
    () => {
      const s = step.value;
      if (!s || s.manual) return;
      if (s.advanceWhen?.()) next();
    },
  );

  // quitter le match coupe le tutoriel (sans le marquer terminé)
  watch(
    () => game.matchPhase,
    (phase) => {
      if (active.value && phase === "lobby") stop(false);
    },
  );

  return {
    active,
    stepIndex,
    total,
    step,
    stepText,
    start,
    startLesson,
    mechanicLessons,
    next,
    skip,
    isDone,
  };
});
