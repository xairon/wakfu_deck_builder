import type { CardKeyword } from "@/types/cards";

/**
 * Glossaire canonique des mots-clés du TCG Wakfu.
 *
 * Chaque entrée associe un mot-clé (issu de l'union `CardKeyword` de
 * `src/types/cards.ts`) à une définition propre et conforme aux règles, rédigée
 * à la main. Les descriptions extraites des cartes étant bruitées, on consigne
 * ici des formulations courtes et exactes.
 */
export interface KeywordEntry {
  name: CardKeyword;
  /** Définition concise (1 à 2 phrases) conforme aux règles. */
  summary: string;
}

export const KEYWORDS: readonly KeywordEntry[] = [
  {
    name: "Inclinaison",
    summary:
      "Action s'effectuant en inclinant la carte sur le côté. Une carte inclinée le reste jusqu'à votre prochaine phase de redressement, où elle se remet droite ; elle ne peut pas s'incliner deux fois sans s'être redressée.",
  },
  {
    name: "Riposte",
    summary:
      "Effet déclenché lorsque la carte est attaquée ou ciblée, infligeant des dégâts en retour à l'attaquant. La riposte se résout au moment de l'attaque, avant ou en réponse à celle-ci.",
  },
  {
    name: "Portée",
    summary:
      "Capacité d'une carte à atteindre des cibles à distance plutôt qu'au seul corps à corps. Une carte avec Portée peut frapper des cibles éloignées sans avoir à s'en approcher.",
  },
  {
    name: "Critique",
    summary:
      "Amplifie l'effet ou les dégâts de la carte lorsqu'une condition de coup critique est remplie. Un coup critique applique la version renforcée de l'effet.",
  },
  {
    name: "Parade",
    summary:
      "Réduit ou annule les dégâts entrants infligés à la carte. La valeur de Parade est retranchée des dégâts subis avant qu'ils ne s'appliquent.",
  },
  {
    name: "Résistance",
    summary:
      "Protège la carte contre un type d'effet ou un élément donné, en réduisant ou en ignorant les dégâts de cette source. La résistance s'applique avant le calcul final des dégâts.",
  },
  {
    name: "Unique",
    summary:
      "Une carte Unique ne peut figurer qu'en un seul exemplaire dans un deck, au lieu de la limite habituelle de 3 copies par carte.",
  },
];
