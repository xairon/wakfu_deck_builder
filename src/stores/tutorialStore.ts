/**
 * tutorialStore — tutoriel interactif « Apprendre à jouer » sur la vraie
 * table. Réf. docs/superpowers/specs/2026-06-10-tutoriel-table-design.md.
 *
 * L'apprenant joue le siège A ; le siège B (premier joueur — son tour 1
 * absorbe la restriction « pas de Monde au premier tour ») est auto-piloté
 * par un watcher. Chaque étape est ancrée sur un élément réel du plateau et
 * la progression est validée par l'état du jeu (`advanceWhen`), sauf pour
 * les étapes purement informatives (`manual`).
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

export const useTutorialStore = defineStore("tutorial", () => {
  const game = useGameStore();
  const cardStore = useCardStore();

  const active = ref(false);
  const stepIndex = ref(0);
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Aides d'état ───────────────────────────────────────────────────────────
  function myAllies(): number {
    const s = game.state;
    return s.monde.filter(
      (id) =>
        s.instances[id]?.controller === "A" &&
        id !== s.seats.A.havreSacInstanceId,
    ).length;
  }

  /** Conseil de mulligan, calculé sur la main RÉELLEMENT tirée (étape 2). */
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

  // ── Parcours ───────────────────────────────────────────────────────────────
  const steps: TutorialStep[] = [
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
      text: "Ta main. Jouer une carte coûte son Niveau en Ressources : tes cartes en jeu s'inclinent pour payer — c'est automatique ici. Ton Héros et ton Havre-Sac produisent déjà chacun une Ressource.",
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

  const step = computed(() =>
    active.value ? (steps[stepIndex.value] ?? null) : null,
  );
  /** Texte résolu de l'étape (certaines étapes calculent leur texte). */
  const stepText = computed(() => {
    const t = step.value?.text;
    return typeof t === "function" ? t() : (t ?? "");
  });
  const total = steps.length;

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

  // ── Cycle ──────────────────────────────────────────────────────────────────
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  /** Rattrapage : traverse toutes les étapes auto déjà satisfaites. */
  function tick(): void {
    let guard = 0;
    while (
      active.value &&
      step.value &&
      !step.value.manual &&
      step.value.advanceWhen?.() &&
      guard++ < total
    ) {
      next();
    }
  }

  function start(): boolean {
    const decks = buildDecks();
    if (!decks) return false;
    game.assist = true;
    // v1 « Cockatrice » : règles gérées, effets de cartes résolus à la main
    // (cohérent avec la table de jeu). Les decks du tutoriel sont sans effets.
    game.assistEffects = false;
    game.startMatch(decks.a, decks.b, {
      nameA: "Toi",
      nameB: "L'adversaire",
      first: "B",
    });
    stepIndex.value = 0;
    active.value = true;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 400);
    return true;
  }

  function next(): void {
    if (stepIndex.value >= total - 1) {
      finish();
      return;
    }
    stepIndex.value += 1;
  }

  function stop(markDone: boolean): void {
    active.value = false;
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
  const finish = (): void => stop(true);
  const skip = (): void => stop(true);

  function isDone(): boolean {
    try {
      return localStorage.getItem(DONE_KEY) === "1";
    } catch {
      return false;
    }
  }

  // ── Adversaire auto-piloté (siège B) ───────────────────────────────────────
  watch(
    () =>
      [
        active.value,
        game.matchPhase,
        game.passPending,
        game.perspective,
        game.mulliganSeat,
        game.turn.active,
      ] as const,
    () => {
      if (!active.value || botTimer) return;
      const itsB =
        game.perspective === "B" &&
        (game.mulliganSeat === "B" || game.turn.active === "B");
      if (!itsB) return;
      botTimer = setTimeout(() => {
        botTimer = null;
        if (!active.value || game.perspective !== "B") return;
        if (game.passPending) {
          game.reveal();
        } else if (game.matchPhase === "mulligan") {
          game.keepHand();
        } else if (game.matchPhase === "playing" && game.turn.active === "B") {
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
    next,
    skip,
    isDone,
  };
});
