// Généré depuis les règles officielles (wtcg-return.fr/regles). Ne pas éditer à la main.
export interface RuleSection {
  title: string;
  content: string;
}

export const RULES_INTRO =
  "Ces règles synthétisent le fonctionnement officiel du Wakfu TCG (édition Return), d'après les règles d'apprentissage et les règles complètes. Le jeu oppose deux joueurs incarnant chacun un Héros, qui s'affrontent pour réduire le Héros adverse à 0 PV ou pour faire progresser leur propre Héros jusqu'au Niveau 3 grâce à l'Expérience.";

export const RULES_SECTIONS: RuleSection[] = [
  {
    title: "But du jeu et conditions de victoire",
    content:
      "Il existe deux chemins vers la victoire, et un joueur gagne dès que son adversaire remplit une condition de défaite.\n\n- Victoire au combat : réduire les Points de Vie (PV) du Héros adverse à 0. Un joueur perd la partie si son Héros est détruit (règle 103.2a).\n- Victoire à l'Expérience : faire atteindre le Niveau 3 à son propre Héros (règle 103.2b). Un Héros atteint le Niveau 3 en gagnant son 18e Point d'Expérience (règle 307.5).\n- Un joueur perd aussi la partie si son Héros quitte le jeu (règle 103.2c).\n\nCas d'égalité simultanée : si les deux Héros perdent leur dernier point de vie en même temps, les deux Héros restent en jeu avec 1 PV (règle 103.3). La partie se poursuit alors normalement.",
  },
  {
    title: "Mise en place",
    content:
      "Chaque joueur prépare son jeu avec son propre paquet de 50 cartes (mode Construit).\n\n- Chaque joueur place son Havre-Sac dans le Monde et son Héros dans son Havre-Sac, tous deux dressés (règles 102.1, 306.1, 307.1).\n- Les 48 cartes restantes du paquet sont mélangées pour former la Pioche.\n- On détermine le premier joueur par tirage au sort (Chi-Fu-Mi / pierre-feuille-ciseaux).\n- Chaque joueur pioche un nombre de cartes égal à ses Points d'Action (PA) pour constituer sa main de départ (règle 102.3). Au Niveau 1, cela correspond généralement à 6 cartes.\n- Rollback (facultatif) : chaque joueur peut recycler entièrement sa main, remélanger sa Pioche et repiocher un nombre de cartes égal à ses PA. Il peut répéter ce processus autant de fois qu'il le souhaite, mais en piochant une carte de moins à chaque nouvelle répétition, jusqu'à atteindre zéro carte (règle 102.4).",
  },
  {
    title: "Les zones de jeu",
    content:
      "Le jeu se répartit sur plusieurs zones, certaines personnelles, d'autres communes.\n\n- Havre-Sac : zone publique non ordonnée, personnelle et protégée (règle 504.2). Le Héros y commence ; elle peut accueillir des Alliés et des Salles dans la limite de sa Taille (capacité). Les cartes du Havre-Sac ne peuvent pas être attaquées directement par l'adversaire.\n- Monde : zone commune aux deux joueurs (règle 506.1). C'est là que se déroulent les combats ; elle contient le Havre-Sac, les Alliés engagés, les Zones, les Protecteurs et les Équipements.\n- Pioche : zone non publique et ordonnée (règle 507.2) ; le paquet de cartes face cachée dans lequel on pioche.\n- Main : zone non publique, non ordonnée et privée (règle 505.2). Sa capacité maximale est égale aux PA du joueur.\n- Défausse : zone publique non ordonnée (règle 502.2) contenant les cartes détruites et les Actions résolues.\n- File d'Attente : zone commune publique et ordonnée (règle 503.2) contenant les cartes et pouvoirs en cours de résolution.\n\nIl existe exactement six zones de jeu (règle 501.1). La Réserve n'en fait pas partie : c'est un mécanisme de tournoi optionnel, traité dans la construction de deck.",
  },
  {
    title: "Structure d'un tour : les 4 phases",
    content:
      "Chaque tour de joueur se déroule dans l'ordre fixe suivant.\n\n1. Phase de Redressement (602) : le joueur redresse toutes les cartes inclinées qu'il contrôle dans le Monde et dans son Havre-Sac, puis résout les pouvoirs déclenchés Au début de votre tour.\n2. Phase Principale (603) : le joueur peut, dans l'ordre de son choix et autant de fois qu'il le souhaite, jouer des Alliés, Actions, Équipements, Zones et Salles, utiliser des pouvoirs, effectuer des déplacements et déclarer une attaque (une seule attaque par tour). Aucun joueur ne peut déclarer d'attaque durant son premier tour (règle 603.2).\n3. Phase de Pioche (604) : le joueur pioche autant de cartes que nécessaire pour compléter sa main à hauteur de ses PA.\n4. Phase de Fin de Tour (605) : les effets de fin de tour se résolvent, les effets jusqu'à la fin du tour cessent, et tous les Dommages portés par les Alliés (dans le Monde ou dans un Havre-Sac) sont retirés (règle 410.8).",
  },
  {
    title: "Les Points : PA, PM, PV, Niveau, Force, Expérience",
    content:
      "Les valeurs clés sont portées par le Héros (et par les Alliés pour la Force).\n\n- Points d'Action (PA) : nombre maximal de cartes que le joueur peut avoir en main (règle 307.3b). En fin de tour, le joueur pioche jusqu'à atteindre ce nombre. Valeurs typiques : 6 au Niveau 1, 7 au Niveau 2.\n- Points de Mouvement (PM) : nombre maximal de Héros ou d'Alliés que le joueur peut envoyer au combat (règle 307.3c). Exemple : 3 PM aux deux niveaux.\n- Points de Vie (PV) : nombre de Points de Vie maximal du Héros (règle 307.3d) ; à 0 PV, le Héros est détruit. Les valeurs varient selon le Héros (ex. Tirlangue : 16 PV au Niveau 1, 20 PV au Niveau 2).\n- Niveau (d'une carte à jouer) : nombre de Ressources à produire pour la jouer, dont au moins une de l'élément affiché.\n- Force : nombre de Dommages qu'un Allié ou un Héros inflige en combat, et aussi le nombre de Dommages qu'il peut subir avant d'être détruit (règle 204.4). Indiquée dans le symbole d'Élément.\n- Points d'Expérience (XP) : gagnés en détruisant des Alliés adverses (voir montée de niveau).",
  },
  {
    title: "Montée de niveau du Héros (recto vers verso) et Expérience",
    content:
      "Le Héros est une carte recto-verso qui progresse au fil de la partie.\n\n- Le Héros commence au Niveau 1 (recto).\n- On gagne des Points d'Expérience en détruisant des Alliés adverses : le Héros gagne autant d'XP que la valeur d'Expérience de l'Allié détruit (règle 415.1). Cette valeur figure en bas à droite de la boîte de texte de l'Allié (généralement entre 0 et 2).\n- Quand le Héros gagne son 6e Point d'Expérience, il est retourné sur sa face verso, montrant le Niveau 2 (règle 307.4). Ses pouvoirs et valeurs (PA, PM, PV, Force) sont améliorés.\n- Quand le Héros gagne son 18e Point d'Expérience, il atteint le Niveau 3 : c'est la Victoire à l'Expérience (règles 307.5 et 103.2b).",
  },
  {
    title: "L'Inclinaison (incliner / redresser)",
    content:
      "L'inclinaison est le mécanisme d'engagement des cartes.\n\n- Les cartes entrent dressées dans le Monde ou le Havre-Sac et le restent jusqu'à ce qu'elles s'inclinent. Incliner une carte dressée revient à la mettre en position horizontale (règle 106.1).\n- Incliner sert généralement à produire une Ressource ou à activer un pouvoir.\n- On ne peut pas incliner une carte déjà inclinée : elle doit d'abord être redressée.\n- Une carte ne se redresse que si elle passe physiquement de l'état incliné à l'état redressé (règle 106.2). Le redressement a lieu lors de la Phase de Redressement, en début de tour.",
  },
  {
    title: "Le combat et les dégâts élémentaires",
    content:
      "Une attaque (une seule par tour) se déroule en une suite de phases ordonnées.\n\n1. Déclaration de la Cible (702) : l'attaquant choisit une seule cible parmi les cartes adverses — le Héros adverse dans le Monde, un Allié adverse dans le Monde, ou le Havre-Sac adverse (règle 702.2). Les Équipements, Zones, Dofus, Protecteurs et les cartes situées dans un Havre-Sac ne sont pas des cibles légales (règle 702.3).\n2. Déclaration des Attaquants (703) : l'attaquant désigne les Alliés/Héros attaquants ; le nombre maximal envoyé est égal à ses PM, et seules les cartes redressées peuvent attaquer.\n3. Déclaration des Bloqueurs (704) : le défenseur déclare ses bloqueurs (maximum égal à ses PM). La cible et les cartes du Havre-Sac ne peuvent pas bloquer.\n4. Phase d'Actions (705) : attaquant puis défenseur jouent alternativement des Réactions ou passent ; si les deux passent consécutivement, la phase s'arrête.\n5. Résolution des Duels (706) : les cartes en duel s'infligent simultanément leur Force en Dommages.\n6. Résolution des Dommages sur la Cible (707) : les attaquants non bloqués infligent leurs Dommages à la cible.\n7. Phase de Fin de Combat (708) : les cartes engagées reviennent (inclinées) dans le Monde / Havre-Sac.\n\nDégâts élémentaires : il existe cinq éléments — Air, Eau, Feu, Terre, Neutre. Sauf mention contraire, chaque objet inflige des Dommages du même type que son Élément (règle 410.1). Si la cible possède une Résistance dans le bon élément, les Dommages sont réduits du montant de cette Résistance. Un Allié qui reçoit un nombre de Dommages supérieur ou égal à sa Force subit des Dommages létaux et est détruit (règle 204.6). Les Dommages non létaux restent sur l'Allié jusqu'à la fin du tour, puis sont retirés (règle 410.8).",
  },
  {
    title: "Les types de cartes",
    content:
      "Le jeu comprend plusieurs types de cartes, identifiables par leur couleur et leur cadre.\n\n- Héros : carte recto-verso représentant le joueur (règle 307.1). Commence dressé dans le Havre-Sac ; porte les valeurs PA, PM, PV, Force et une Classe. Sa destruction (0 PV) fait perdre la partie.\n- Havre-Sac : carte commençant dressée dans le Monde (règle 306.1). Caractéristiques : Taille (capacité d'accueil) et Résistance (points de résistance).\n- Allié : carte jouée en Phase Principale (règle 303.1). Possède une Force, une valeur d'Expérience et une Classe/Famille ; peut attaquer, bloquer, être détruite, et rapporte de l'XP à l'adversaire quand elle est détruite. Les Monstres portent le trait Monstre.\n- Allié Élémentaire : Alliés spéciaux (Terra, Aero, Pyro, Akwa) de Niveau 1 et Force 1, qui ne peuvent ni attaquer, ni bloquer, ni porter d'Équipement (règle 303.6). Servent surtout de Ressources.\n- Action : carte jouée en Phase Principale ou en Phase d'Actions (règle 302.1), qui part en défausse après résolution. Sous-types : Sort (lié à une classe), Quête (Réaction avec déclencheur), Challenge (lié à la déclaration de cible).\n- Équipement : carte jouée en Phase Principale (règle 305.1), équipée sur un Héros ou un Allié. Sous-types : Arme, Armure, Bijou, Bouclier, Monture, Objet, Familier. Peut parfois être fabriquée via une Recette.\n- Dofus : carte jouée en Phase Principale (règle 304.1). Les Dofus ne sont pas considérés comme des Équipements (règle 304.5).\n- Salle : carte jouée durant le tour (règle 309.1), placée obligatoirement dans le Havre-Sac.\n- Zone : carte jouée durant le tour (règle 310.1), placée dans le Monde ; ne peut pas attaquer mais possède des pouvoirs.\n- Protecteur : carte jouée en Phase Principale (règle 308.1). Un seul Protecteur par paquet (règle 308.3) ; carte particulière, généralement impossible à détruire.",
  },
  {
    title: "Construction de deck",
    content:
      "Les règles de construction dépendent du format de jeu.\n\n- Paquet Construit : exactement 50 cartes (règle 101.1), comprenant une et une seule carte de type Héros et une et une seule carte de type Havre-Sac (règle 101.3), plus 48 autres cartes (Alliés, Actions, Équipements, Zones, Salles, Dofus...).\n- Paquet Scellé / Draft : exactement 30 cartes (règle 101.2), avec la même obligation d'un Héros et d'un Havre-Sac (règle 101.3).\n- Limite de copies : chaque carte ne peut être présente en plus de 3 exemplaires (règle 101.5).\n- Cartes Unique : les cartes portant le trait Unique font exception et ne peuvent être présentes qu'en 1 seul exemplaire (règle 101.5).\n- Réserve : en Construit, elle compte exactement 0 ou 12 cartes (règle 101.4). En Scellé, elle contient toutes les cartes non incluses dans le deck, sans limite de copies (règles 101.4 et 101.6).\n- Alliés Élémentaires en Draft : chaque joueur peut ajouter jusqu'à 4 Alliés Élémentaires, obligatoirement de l'élément du Héros ou du Havre-Sac du joueur (règle 101.7).",
  },
];
