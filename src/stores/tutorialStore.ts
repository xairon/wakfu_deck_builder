/**
 * tutorialStore — « Apprendre en jouant ». UNE vraie partie contre l'IA
 * intelligente (pilotée par `gameStore.botSeat` via useBotOpponent), GUIDÉE pas à
 * pas au début (mulligan → jouer un Allié → attaquer → défendre → niveau), puis
 * LIBRE dès que les étapes sont terminées : le coach se retire et `RuleAssistant`
 * prend le relais. Le deck est CHOISI par le joueur → les étapes restent
 * GÉNÉRIQUES (aucune carte nommée). Règles assistées FORCÉES.
 *
 * Ne contient plus de bot maison : l'adversaire est l'IA heuristique
 * (`useBotOpponent`, montée par PlayTableView, active dès `botSeat` renseigné).
 * Pendant la phase guidée, le bot est « doux » (ne déclare pas d'attaque —
 * `game.botAggressive=false`) pour ne pas parasiter les explications ; il devient
 * un vrai adversaire une fois le tutoriel terminé.
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Deck } from "@/types/cards";
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
  /** Étape validée par l'état du jeu (conditions MONOTONES de préférence). */
  advanceWhen?: () => boolean;
}

export const useTutorialStore = defineStore("tutorial", () => {
  const game = useGameStore();
  const cardStore = useCardStore();

  const active = ref(false);
  const stepIndex = ref(0);
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
    return `${base}${verdict} Clique « Mulligan » pour refaire ta main (une carte de moins), ou « Garder ».`;
  }

  // ── Séquence guidée (générique, tolérante à l'IA) ──────────────────────────
  // L'ORDINATEUR commence (first="B") : son tour 1 ne peut poser aucune carte
  // (règle 4943), il le passe ; le 1er tour du JOUEUR est le tour 2, où poser une
  // carte est autorisé. C'est pourquoi le joueur ne rencontre jamais le blocage
  // « aucune carte ne peut entrer au premier tour ».
  const guidedSteps: TutorialStep[] = [
    {
      anchor: ".gseat:not(.gseat--opp)",
      manual: true,
      text: "Bienvenue dans le Wakfu TCG ! But : réduire les PV du Héros adverse à 0, OU monter ton Héros au Niveau 3 (18 XP). Tu joues en bas, contre l'ordinateur (qui commence). Clique « Suivant ».",
    },
    {
      anchor: ".overlay--mulligan",
      text: evaluateMulligan,
      advanceWhen: () =>
        game.mulliganSeat !== "A" || game.matchPhase === "playing",
    },
    {
      anchor: ".gseat:not(.gseat--opp) .ghud",
      manual: true,
      text: "Ton Héros : PV (à 0 = défaite), PA (ta taille de main MAX : en fin de tour tu repioches jusqu'à ce nombre), PM (nombre max d'attaquants/bloqueurs), XP et Niveau (6 XP → Niveau 2 et face verso, 18 XP → victoire).",
    },
    {
      anchor: ".gseat__handzone:not(.gseat__handzone--opp)",
      manual: true,
      text: "Ta main. Jouer une carte coûte son Niveau en Ressources : tes cartes en jeu s'inclinent pour payer — c'est automatique. Les cartes JOUABLES maintenant s'illuminent (liseré doré) ; les grisées sont trop chères ou interdites dans la phase/tour courant.",
    },
    {
      anchor: ".gzone--play",
      text: "L'ordinateur a passé le 1er tour (règle : aucune carte ne peut entrer au tout premier tour de la partie). À TOI, ton 1er tour : GLISSE un Allié illuminé de ta main sur ton champ de bataille.",
      advanceWhen: () => myAllies() >= 1,
    },
    {
      anchor: ".gendturn",
      text: "Bien joué ! Ton Allié vient d'arriver : il ne pourra attaquer qu'à ton PROCHAIN tour (mal d'invocation). Clique « Fin du tour » — tu piocheras jusqu'à tes PA, puis l'ordinateur jouera.",
      advanceWhen: () => game.turn.number >= 3,
    },
    {
      anchor: ".gseat--opp",
      text: "À l'ordinateur de jouer : REGARDE-le agir sur le plateau (il pose ses Alliés, active ses pouvoirs, attaque). Sa main reste cachée, mais tout ce qu'il fait est visible. La main te revient juste après.",
      advanceWhen: () =>
        game.turn.active === "A" && game.turn.number >= 4 && !game.passPending,
    },
    {
      anchor: ".gzone--play",
      text: "À ton tour, ton Allié est redressé et prêt. CLIQUE-le, puis « ⚔ Attaquer » ; désigne une CIBLE adverse (le Héros en haut), « Confirmer l'attaque », puis « Résoudre le combat ». Attaquer le Héros entame d'abord son Havre-Sac (bouclier).",
      advanceWhen: () => game.attackedOnTurn !== null,
    },
    {
      anchor: ".gcombat",
      manual: true,
      text: "Défense : quand l'ORDINATEUR attaque, tu peux BLOQUER — pendant la phase de blocage, clique un de tes Alliés dressés pour intercepter un attaquant (le duel se fait entre les deux Alliés, ton Héros est épargné), ou laisse passer. Puis « Résoudre le combat ».",
    },
    {
      anchor: ".gseat:not(.gseat--opp) .ghud",
      manual: true,
      text: "XP & Niveau : DÉTRUIS des Alliés adverses (dégâts ≥ leur Force) pour gagner de l'XP. 6 XP → Niveau 2 (ton Héros se retourne, stats améliorées) ; 18 XP → victoire directe. Réduire les PV du Héros adverse à 0 gagne aussi.",
    },
    {
      anchor: ".glayout__journal",
      manual: true,
      text: "Tout est tracé dans le journal, et les RÈGLES sont gérées pour toi (combat, coûts, PV, XP). Les EFFETS des cartes, eux, se résolvent à la main — l'assistant de règles (à droite) te guide. Tu sais jouer : continue cette partie LIBREMENT contre l'ordinateur. Bon jeu !",
    },
  ];

  // ── Coach ──────────────────────────────────────────────────────────────────
  const step = computed(() =>
    active.value ? (guidedSteps[stepIndex.value] ?? null) : null,
  );
  const stepText = computed(() => {
    const t = step.value?.text;
    return typeof t === "function" ? t() : (t ?? "");
  });
  const total = computed(() => guidedSteps.length);

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

  /**
   * Démarre « Apprendre en jouant » : partie complète (mulligan inclus) contre
   * l'IA, deck du joueur = `deckA`, deck de l'ordinateur = `deckB`. Règles
   * assistées forcées ; bot « doux » pendant la phase guidée.
   */
  function startGuidedGame(deckA: Deck, deckB: Deck): void {
    game.assist = true;
    game.assistEffects = true;
    game.botAggressive = false; // doux pendant l'intro guidée
    game.startMatch(deckA, deckB, {
      nameA: "Toi",
      nameB: "L'ordinateur",
      first: "B", // l'ordinateur commence → le 1er tour du joueur (tour 2) autorise
      // de poser une carte (règle 4943 : rien au tout premier tour de la partie).
    });
    game.botSeat = "B"; // l'IA pilote le siège B (useBotOpponent, monté par la vue)
    // La vue reste TOUJOURS côté humain (siège A) : on regarde le bot jouer, sans
    // rideau. startMatch a posé perspective=B/passPending=true (1er joueur = bot) —
    // on rétablit la vue humaine (le driver bascule perspective le temps d'agir).
    game.perspective = "A";
    game.passPending = false;
    stepIndex.value = 0;
    active.value = true;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 400);
  }

  function stop(markDone: boolean): void {
    active.value = false;
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    // Fin de la phase guidée → le bot devient un vrai adversaire (attaque).
    game.botAggressive = true;
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

  // ── Avance auto des étapes validées par l'état ─────────────────────────────
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

  // Fin de partie / retour lobby pendant le tuto → clore la phase guidée.
  watch(
    () => game.matchPhase,
    (phase) => {
      if (!active.value) return;
      if (phase === "finished") stop(true);
      else if (phase === "lobby") stop(false);
    },
  );

  return {
    active,
    stepIndex,
    total,
    step,
    stepText,
    startGuidedGame,
    next,
    skip,
    isDone,
  };
});
