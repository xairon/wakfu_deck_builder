export interface FirstStep {
  title: string;
  body: string;
}

export const FIRST_STEPS: FirstStep[] = [
  {
    title: "Le but du jeu",
    body: "Deux joueuses ou joueurs incarnent chacun un Héros. On gagne soit en réduisant les Points de Vie du Héros adverse à 0, soit en faisant monter son propre Héros jusqu'au Niveau 3 grâce à l'Expérience.",
  },
  {
    title: "Préparer son deck",
    body: "Un deck se construit autour d'exactement 1 Héros et 1 Havre-Sac, plus 48 autres cartes — 50 au total. Au maximum 3 exemplaires d'une même carte (1 seul pour les cartes Unique).",
  },
  {
    title: "La mise en place",
    body: "Posez votre Havre-Sac dans le Monde et votre Héros dans le Havre-Sac. Mélangez les 48 cartes restantes pour former votre Pioche, puis piochez votre main de départ (autant de cartes que vos Points d'Action).",
  },
  {
    title: "Le déroulé d'un tour",
    body: "Chaque tour suit 4 phases : Redressement (on redresse ses cartes inclinées), Principale (on joue des cartes, utilise des pouvoirs et déclare une attaque), Pioche (on complète sa main), puis Fin de tour.",
  },
  {
    title: "Attaquer et se défendre",
    body: "Une seule attaque par tour. On choisit une cible (le Héros, un Allié ou le Havre-Sac adverse), on déclare ses attaquants, l'adversaire déclare ses bloqueurs, puis les Forces s'infligent en Dommages. Les éléments (Air, Eau, Feu, Terre, Neutre) et la Résistance entrent en jeu.",
  },
  {
    title: "Gagner la partie",
    body: "Détruisez des Alliés adverses pour gagner de l'Expérience : 6 points font passer votre Héros au Niveau 2, 18 points au Niveau 3 — la victoire. Ou réduisez simplement le Héros adverse à 0 PV.",
  },
];
