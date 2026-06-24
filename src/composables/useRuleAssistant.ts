/**
 * Assistant de règles CONTEXTUEL — un « coach » qui explique, à tout instant de
 * la partie, ce qu'on peut faire et POURQUOI un coup vient d'être refusé.
 *
 * Il dérive un indice (`hint`) de l'état du `gameStore` (phase de match, combat,
 * tour, dernier `ruleError`) et le mappe vers un texte clair + une référence de
 * règle dépliable. Les refus (`ruleError`) sont capturés et conservés un court
 * instant (au lieu du toast éphémère) pour laisser le temps de lire. Réutilisable
 * partout — pas seulement en combat.
 */
import { computed, onUnmounted, ref, watch } from "vue";
import { useGameStore } from "@/stores/gameStore";

export type AssistantTone = "info" | "action" | "warn";
export interface AssistantRule {
  ref: string;
  detail: string;
}
export interface AssistantHint {
  tone: AssistantTone;
  text: string;
  rule?: AssistantRule;
}

/** Combien de temps un refus de coup reste affiché (ms). */
const REJECTION_TTL = 7000;

/** Mappe une raison de refus (texte FR du serveur/moteur) → règle + explication. */
function ruleForRejection(msg: string): AssistantRule | undefined {
  const m = msg.toLowerCase();
  if (m.includes("premier tour"))
    return {
      ref: "603.2",
      detail:
        "Au tout premier tour, aucune carte n'entre dans le Monde et on ne peut pas attaquer.",
    };
  if (m.includes("attaque par tour"))
    return { ref: "603", detail: "Une seule attaque par tour." };
  if (m.includes("blocages"))
    return {
      ref: "706",
      detail: "Le défenseur doit d'abord déclarer ses blocages.",
    };
  if (m.includes("défenseur"))
    return {
      ref: "704",
      detail:
        "Seul le défenseur déclare les blocages, pendant l'attaque adverse.",
    };
  if (m.includes("bloqueur") || m.includes("bloquer"))
    return {
      ref: "704",
      detail:
        "Bloqueurs : Alliés redressés du défenseur, hors cible de l'attaque.",
    };
  if (m.includes("attaquant"))
    return {
      ref: "703",
      detail:
        "Attaquants : Alliés/Héros redressés, hors mal d'invocation ; nombre limité par les PM.",
    };
  if (m.includes("ressource") || m.includes("pa "))
    return {
      ref: "4261",
      detail:
        "Incline des cartes en jeu redressées pour produire des Ressources et payer le Niveau de la carte.",
    };
  if (m.includes("havre-sac est plein"))
    return {
      ref: "2626",
      detail: "Le Havre-Sac a atteint sa Taille : plus de Salle/Allié dedans.",
    };
  if (m.includes("main pleine"))
    return {
      ref: "4873",
      detail: "Défausse jusqu'à PA cartes en main avant de finir le tour.",
    };
  if (m.includes("votre tour") || m.includes("ton tour"))
    return {
      ref: "Tour",
      detail:
        "Seul le joueur actif agit pendant son tour (excepté bloquer en réaction).",
    };
  return undefined;
}

export function useRuleAssistant() {
  const store = useGameStore();

  // Dernier refus capturé (copie : insensible au clear du store/toast).
  const rejection = ref<{ text: string; rule?: AssistantRule } | null>(null);
  let rejectTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => store.ruleError,
    (err) => {
      if (!err) return;
      rejection.value = { text: err, rule: ruleForRejection(err) };
      if (rejectTimer) clearTimeout(rejectTimer);
      rejectTimer = setTimeout(() => (rejection.value = null), REJECTION_TTL);
    },
  );
  // Un changement de phase de match « périme » un refus devenu hors-contexte.
  watch(
    () => store.matchPhase,
    () => {
      rejection.value = null;
      if (rejectTimer) clearTimeout(rejectTimer);
    },
  );
  onUnmounted(() => {
    if (rejectTimer) clearTimeout(rejectTimer);
  });

  const hint = computed<AssistantHint | null>(() => {
    // 1) Un refus récent prime (le plus utile : « pourquoi ça n'a pas marché »).
    if (rejection.value)
      return {
        tone: "warn",
        text: rejection.value.text,
        rule: rejection.value.rule,
      };

    if (store.matchPhase === "mulligan")
      return {
        tone: "info",
        text: "Garde ta main de départ, ou refais-la (une carte de moins à chaque fois). Le premier joueur est tiré au sort ensuite.",
      };

    // 2) En combat : guider l'étape courante (selon le rôle en ligne).
    if (store.combat) {
      if (store.combatCanConfirmBlocks)
        return {
          tone: "action",
          text: "À toi de bloquer : clique tes Alliés redressés pour les opposer aux attaquants, puis « Confirmer les blocages » (ou confirme à vide pour laisser passer).",
          rule: {
            ref: "704",
            detail:
              "Bloquer est une réaction : tu agis hors de ton tour. Tes bloqueurs s'inclinent à la fin du combat.",
          },
        };
      if (store.combatWaitingForBlocks)
        return {
          tone: "info",
          text: "En attente des blocages de l'adversaire…",
        };
      if (store.combatCanResolve)
        return {
          tone: "action",
          text: "Les blocages sont déclarés — clique « Résoudre le combat » pour appliquer les dégâts.",
          rule: {
            ref: "706",
            detail:
              "Duels : attaquant et bloqueur s'infligent mutuellement leur Force ; les attaquants libres frappent la cible.",
          },
        };
      const step = store.combat.step;
      if (step === "attackers")
        return {
          tone: "action",
          text: "Choisis tes attaquants (Alliés/Héros redressés) puis une cible adverse, puis « Confirmer l'attaque ».",
          rule: {
            ref: "703",
            detail:
              "Le nombre d'attaquants est limité par tes PM ; une carte arrivée ce tour ne peut pas attaquer (mal d'invocation).",
          },
        };
      if (step === "strikes")
        return {
          tone: "action",
          text: "Duel multi-bloqueurs : clique le bloqueur qui encaisse la Force de l'attaquant surligné.",
          rule: {
            ref: "6105",
            detail:
              "Quand plusieurs bloqueurs affrontent un attaquant, l'attaquant choisit lequel reçoit sa Force.",
          },
        };
      if (step === "riposte")
        return {
          tone: "action",
          text: "Riposte : clique l'attaquant que ta Cible frappe en retour.",
          rule: {
            ref: "707.1",
            detail:
              "Une Cible (Allié/Héros) non engagée en duel riposte sa Force à un attaquant qui l'a frappée.",
          },
        };
      return {
        tone: "action",
        text: "Déclare les blocages, puis résous le combat.",
        rule: {
          ref: "704",
          detail: "Le défenseur oppose ses Alliés redressés.",
        },
      };
    }

    // 3) Hors combat, en jeu : selon à qui c'est de jouer.
    if (store.matchPhase === "playing") {
      if (store.online && store.turn.active !== store.mySeat)
        return {
          tone: "info",
          text: "Au tour de l'adversaire — observe (tu pourras bloquer s'il attaque).",
        };
      return {
        tone: "action",
        text: "À toi de jouer : pose une carte, déclare une attaque (⚔), ou finis ton tour.",
      };
    }
    return null;
  });

  /** Efface manuellement un refus affiché. */
  function dismiss(): void {
    rejection.value = null;
    if (rejectTimer) clearTimeout(rejectTimer);
  }

  return { hint, dismiss };
}
