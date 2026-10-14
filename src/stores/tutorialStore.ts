/**
 * tutorialStore — « Apprendre en jouant ». Une partie guidée pas à pas contre l'IA locale,
 * avec un début explicatif, des actions demandées au joueur pour chaque point clé des règles
 * de Wakfu TCG, et un écran de fin didactique récapitulant les connaissances acquises.
 */
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { Deck } from "@/types/cards";
import { useGameStore } from "@/stores/gameStore";

const DONE_KEY = "wakfu-tutorial-done";
/** Tour à partir duquel le bot « doux » (aucune attaque, le temps de développer)
 *  redevient un vrai adversaire. Tour 5 ≈ le 2e–3e tour du joueur. */
const SOFT_UNTIL_TURN = 5;

export interface TutorialStep {
  id: string;
  title: string;
  actionPrompt: string;
  ruleDetail: string;
  isComplete: (game: ReturnType<typeof useGameStore>) => boolean;
}

export const useTutorialStore = defineStore("tutorial", () => {
  const game = useGameStore();

  /** Partie guidée en cours (mode « Apprendre en jouant »). */
  const active = ref(false);
  /** Écran d'accueil (but + fonctionnement) affiché au tout début. */
  const welcomeVisible = ref(false);
  /** Modal de fin didactique récapitulant les règles. */
  const completionModalVisible = ref(false);

  /** Index de l'étape courante */
  const currentStepIndex = ref(0);

  /**
   * Étapes scénarisées du tutoriel expliquant chaque point important des règles
   * du jeu Wakfu TCG au travers d'actions demandées au joueur.
   */
  const steps: TutorialStep[] = [
    {
      id: "mulligan",
      title: "Main de départ & Choix du Mulligan",
      actionPrompt: "Observe tes cartes en main et choisis de « Garder » ou faire un « Mulligan » gratuit pour repiocher.",
      ruleDetail: "Règle 494. Au début d'une partie de Wakfu TCG, chaque joueur pioche 6 cartes. Le premier mulligan est gratuit (re-piocher 6 cartes), puis chaque mulligan suivant donne une carte de moins.",
      isComplete: (g) => g.matchPhase !== "mulligan",
    },
    {
      id: "resources",
      title: "Ressources & Coût en Points d'Action (PA)",
      actionPrompt: "Pour jouer une carte, tu as besoin de PA. Incline une carte redressée (Ressource ou Havre-Sac) pour produire des PA, ou glisse une carte Allié/Équipement en jeu.",
      ruleDetail: "Règle 426.1. Le Niveau d'une carte indique son coût en PA. Dans Wakfu TCG, on incline des cartes en jeu (comme le Havre-Sac ou des Ressources) pour générer des PA et payer les cartes.",
      isComplete: (g) => {
        const mySeat = g.mySeat ?? "A";
        const hasTappedCard = Object.values(g.state.instances).some(
          (c) => c.controller === mySeat && c.orientation === "tapped"
        );
        const myBoard = g.state.seats[mySeat];
        const heroId = myBoard?.heroInstanceId;
        const hasPlacedAlly = (myBoard?.havreSac.some((id) => id !== heroId) ?? false) || g.state.monde.some(
          (id) => g.state.instances[id]?.controller === mySeat && g.state.instances[id]?.cardId && id !== myBoard?.havreSacInstanceId
        );
        return hasTappedCard || hasPlacedAlly;
      },
    },
    {
      id: "summoning_sickness",
      title: "Déploiement & Mal d'Invocation",
      actionPrompt: "Déploie un Allié dans ton Havre-Sac ou le Monde. Remarque qu'il ne peut pas attaquer immédiatement !",
      ruleDetail: "Règle 703.1. Tout Allié arrivé en jeu durant le tour en cours souffre du 'Mal d'invocation'. Il ne pourra attaquer qu'à partir du tour suivant (sauf s'il possède le mot-clé Célérité).",
      isComplete: (g) => {
        const mySeat = g.mySeat ?? "A";
        const myBoard = g.state.seats[mySeat];
        const hasAlly = (myBoard?.havreSac.length ?? 0) > 0 || g.state.monde.some(
          (id) => g.state.instances[id]?.controller === mySeat && g.state.instances[id]?.cardId && id !== myBoard?.havreSacInstanceId
        );
        return hasAlly || g.turn.number > 2;
      },
    },
    {
      id: "hero_movement",
      title: "Déplacement du Héros (Monde & Havre-Sac)",
      actionPrompt: "Fais entrer ou sortir ton Héros du Havre-Sac vers le Monde (bouton 'Sortir / Rentrer' ou glisser).",
      ruleDetail: "Règle 414.1. Durant ta phase principale, ton Héros peut passer librement entre le Havre-Sac et le Monde. Dans le Monde, il peut attaquer mais devient vulnérable ; dans son Havre-Sac, il est protégé des attaques adverses !",
      isComplete: (g) => {
        const mySeat = g.mySeat ?? "A";
        const heroId = g.state.seats[mySeat]?.heroInstanceId;
        if (!heroId) return false;
        const hero = g.state.instances[heroId];
        return hero?.location?.zone === "monde" || g.turn.number >= 3;
      },
    },
    {
      id: "combat_attack",
      title: "Déclaration d'Attaque & Points de Mouvement (PM)",
      actionPrompt: "Déclare une attaque contre l'adversaire : sélectionne tes attaquants redressés (hors mal d'invocation) puis choisis une cible adverse.",
      ruleDetail: "Règles 603 & 703. Tu ne peux déclarer qu'UNE SEULE attaque par tour ! Le nombre maximum d'attaquants que tu peux engager est limité par les PM (Points de Mouvement) disponibles de ton groupe.",
      isComplete: (g) => g.combat !== null || (g.state.lastAttackTurn?.["A"] ?? 0) > 0 || g.turn.number >= 4,
    },
    {
      id: "block_and_damage",
      title: "Blocage, Riposte & Dégâts",
      actionPrompt: "Résous le combat en cours ou termine ton tour pour voir l'adversaire agir.",
      ruleDetail: "Règle 704 & 706. Le défenseur peut incliner ses Alliés redressés pour bloquer les attaquants dans des duels de Force. Les attaquants non bloqués infligent leurs dégâts directement à la cible !",
      isComplete: (g) => (g.turn.number >= 4 && g.combat === null) || g.matchPhase === "finished",
    },
    {
      id: "victory_condition",
      title: "Objectif Ultime : Victoire par K.O. ou par Expérience (18 XP)",
      actionPrompt: "Continue le combat pour terrasser le Héros adverse (0 PV) ou atteindre le Niveau 3 (18 XP) pour remporter la victoire !",
      ruleDetail: "Règle 103.2. Il y a deux façons de gagner à Wakfu TCG : vider les PV du Héros adverse (K.O.), OU accumuler 18 XP (Niveau 3) en détruisant des cartes adverses !",
      isComplete: (g) => g.matchPhase === "finished",
    },
  ];

  const currentStep = computed<TutorialStep | null>(() => {
    if (currentStepIndex.value >= steps.length) return null;
    return steps[currentStepIndex.value] ?? null;
  });

  const totalSteps = computed(() => steps.length);

  /**
   * Vérifie automatiquement si l'étape en cours est validée par les actions du joueur
   */
  function checkProgress(): void {
    if (!active.value) return;
    const step = currentStep.value;
    if (step && step.isComplete(game)) {
      if (currentStepIndex.value < steps.length - 1) {
        currentStepIndex.value++;
      }
    }
  }

  /**
   * Permet au joueur de passer l'étape s'il le souhaite
   */
  function skipCurrentStep(): void {
    if (currentStepIndex.value < steps.length - 1) {
      currentStepIndex.value++;
    }
  }

  /**
   * Démarre « Apprendre en jouant » : partie complète (mulligan inclus) contre
   * l'IA. Deck du joueur = `deckA`, de l'ordinateur = `deckB`. Règles + effets
   * assistés forcés ; bot « doux » les premiers tours (voir SOFT_UNTIL_TURN).
   */
  function startGuidedGame(deckA: Deck, deckB: Deck): void {
    currentStepIndex.value = 0;
    completionModalVisible.value = false;
    game.assist = true;
    game.assistEffects = true;
    game.botAggressive = false; // doux le temps que le joueur développe

    game.startMatch(deckA, deckB, {
      nameA: "Toi",
      nameB: "L'ordinateur",
    });
    game.botSeat = "B"; // l'IA pilote le siège B
    game.perspective = "A";
    game.passPending = false;
    active.value = true;
    welcomeVisible.value = true;
  }

  /** Ferme l'écran d'accueil → la partie (mulligan) devient visible. */
  function dismissWelcome(): void {
    welcomeVisible.value = false;
    checkProgress();
  }

  function closeCompletionModal(): void {
    completionModalVisible.value = false;
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

  // Surveillance active des actions pour faire avancer les étapes
  watch(
    () => [
      game.matchPhase,
      game.turn.number,
      game.combat,
      game.state.monde.length,
      game.state.seats.A?.havreSac.length,
      game.state.instances[game.state.seats.A?.heroInstanceId ?? ""]?.location?.zone,
    ],
    () => {
      checkProgress();
    },
    { deep: true },
  );

  // Le bot « doux » (aucune attaque pendant l'intro) redevient un vrai adversaire
  // dès que le joueur a eu quelques tours pour développer son plateau.
  watch(
    () => game.turn.number,
    (n) => {
      if (active.value && n >= SOFT_UNTIL_TURN) game.botAggressive = true;
    },
  );

  // Fin de partie / retour lobby pendant le mode guidé → déclencher l'écran de fin
  watch(
    () => game.matchPhase,
    (phase) => {
      if (!active.value) return;
      if (phase === "finished") {
        completionModalVisible.value = true;
        stop(true);
      } else if (phase === "lobby") {
        stop(false);
      }
    },
  );

  return {
    active,
    welcomeVisible,
    completionModalVisible,
    currentStepIndex,
    currentStep,
    steps,
    totalSteps,
    startGuidedGame,
    dismissWelcome,
    closeCompletionModal,
    skipCurrentStep,
    checkProgress,
    isDone,
    stop,
  };
});
