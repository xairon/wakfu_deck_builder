/**
 * tutorialStore — « Apprendre en jouant ». Une VRAIE partie contre l'IA locale,
 * en règles ET effets automatisés, avec un GUIDE PASSIF.
 *
 * Plus de séquence d'étapes forcées (spotlight + « fais exactement ça, maintenant »
 * — trop directif, et parfois faux : « finis ton tour » alors qu'on pouvait encore
 * jouer). À la place :
 *  - un écran d'ACCUEIL au démarrage (but + fonctionnement, noir sur blanc) ;
 *  - puis le `RuleAssistant` (encart contextuel « ce que tu peux faire / pourquoi
 *    un coup est refusé »), visible pendant TOUTE la partie.
 *
 * Ce store ne fait donc plus que : lancer la partie vs IA (assist + assistEffects,
 * bot « doux » les premiers tours), piloter l'écran d'accueil, et marquer le mode
 * « déjà appris ».
 */
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { Deck } from "@/types/cards";
import { useGameStore } from "@/stores/gameStore";

const DONE_KEY = "wakfu-tutorial-done";
/** Tour à partir duquel le bot « doux » (aucune attaque, le temps de développer)
 *  redevient un vrai adversaire. Tour 5 ≈ le 2e–3e tour du joueur. */
const SOFT_UNTIL_TURN = 5;

export const useTutorialStore = defineStore("tutorial", () => {
  const game = useGameStore();

  /** Partie guidée en cours (mode « Apprendre en jouant »). */
  const active = ref(false);
  /** Écran d'accueil (but + fonctionnement) affiché au tout début. */
  const welcomeVisible = ref(false);

  /**
   * Démarre « Apprendre en jouant » : partie complète (mulligan inclus) contre
   * l'IA. Deck du joueur = `deckA`, de l'ordinateur = `deckB`. Règles + effets
   * assistés forcés ; bot « doux » les premiers tours (voir SOFT_UNTIL_TURN).
   */
  function startGuidedGame(deckA: Deck, deckB: Deck): void {
    game.assist = true;
    game.assistEffects = true;
    game.botAggressive = false; // doux le temps que le joueur développe
    // Premier joueur TIRÉ AU SORT (comme en ligne) : on n'impose plus
    // l'ordinateur. `first` omis → startMatch fait le pile/face ; le tirage animé
    // (PlayTableView) le révèle. NB : si le joueur est désigné, son 1er tour est
    // le tour 1 → il ne peut poser aucune carte ce tour-là (règle 4943).
    game.startMatch(deckA, deckB, {
      nameA: "Toi",
      nameB: "L'ordinateur",
    });
    game.botSeat = "B"; // l'IA pilote le siège B (useBotOpponent, monté par la vue)
    // La vue reste TOUJOURS côté humain (siège A) : on regarde le bot jouer, sans
    // rideau. startMatch a posé perspective=B/passPending=true (1er joueur = bot) —
    // on rétablit la vue humaine (le driver bascule perspective le temps d'agir).
    game.perspective = "A";
    game.passPending = false;
    active.value = true;
    welcomeVisible.value = true;
  }

  /** Ferme l'écran d'accueil → la partie (mulligan) devient visible. */
  function dismissWelcome(): void {
    welcomeVisible.value = false;
  }

  function stop(markDone: boolean): void {
    active.value = false;
    welcomeVisible.value = false;
    game.botAggressive = true; // fin du mode guidé → vrai adversaire
    if (markDone) {
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* stockage indisponible */
      }
    }
  }

  function isDone(): boolean {
    try {
      return localStorage.getItem(DONE_KEY) === "1";
    } catch {
      return false;
    }
  }

  // Le bot « doux » (aucune attaque pendant l'intro) redevient un vrai adversaire
  // dès que le joueur a eu quelques tours pour développer son plateau.
  watch(
    () => game.turn.number,
    (n) => {
      if (active.value && n >= SOFT_UNTIL_TURN) game.botAggressive = true;
    },
  );

  // Fin de partie / retour lobby pendant le mode guidé → clore proprement.
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
    welcomeVisible,
    startGuidedGame,
    dismissWelcome,
    isDone,
  };
});
