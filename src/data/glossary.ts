// Glossaire officiel (wtcg-return.fr/regles/glossaire). Ne pas éditer à la main.
export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Action",
    definition:
      "Type de carte. Une Action peut aussi être de type Sort, Challenge ou Quête.",
  },
  {
    term: "Adversaire",
    definition:
      "Dans une partie à deux joueurs, l'adversaire est la personne en face de vous. En partie multijoueurs, vous pouvez avoir plusieurs adversaires.",
  },
  {
    term: "Agilité",
    definition:
      "Agilité est un mot-clef représentant un pouvoir continu. Ce pouvoir signifie : « Ce Héros ou cet Allié ne peut pas être bloqué par un Allié ou un Héros qui ne possède pas Agilité ».",
  },
  {
    term: "Agressivité",
    definition:
      "Un Allié possédant Agressivité peut être déclaré comme attaquant le tour où il apparaît dans le Monde ou dans un Havre Sac, sous réserve que son contrôleur puisse déclarer une attaque ce tour ci.",
  },
  {
    term: "Alignement",
    definition: "L'Alignement d'une carte est Bonta, Brâkmar ou Neutre.",
  },
  {
    term: "Allié",
    definition: "Type de carte.",
  },
  {
    term: "Annuler",
    definition:
      "Annuler une carte revient à la mettre dans la Défausse de son propriétaire sans faire son effet. Annuler peut aussi consister à retirer un pouvoir de la File d'Attente.",
  },
  {
    term: "Apparaître",
    definition:
      "Un Allié qui entre dans le Monde ou le Havre Sac depuis toute autre zone apparaît.",
  },
  {
    term: "Archimonstre",
    definition: "Un type de Monstre.",
  },
  {
    term: "Arme",
    definition:
      "Type d'Équipement comportant 10 types : Arc, Baguette, Bâton, Dague, Épée, Hache, Marteau, Pelle, Aiguille, Cartes.",
  },
  {
    term: "Armure",
    definition:
      "Type d'Équipement comportant 4 types : Chapeau, Cape, Ceinture, Bottes.",
  },
  {
    term: "Artisan",
    definition:
      "Un Allié possédant un Métier (Bricoleur, Forgeron, Armurier, Bijoutier).",
  },
  {
    term: "Attaquant",
    definition:
      "Un Héros ou Allié qui attaque dans le Monde pendant le combat.",
  },
  {
    term: "Bannir",
    definition:
      "Une carte bannie est physiquement retirée de la partie et ne peut plus y revenir.",
  },
  {
    term: "Bijou",
    definition: "Type d'Équipement comportant 2 types : Amulettes, Anneaux.",
  },
  {
    term: "Bloqueur",
    definition: "Un Héros ou Allié qui bloque dans le Monde pendant le combat.",
  },
  {
    term: "Bonta",
    definition: "Mot-clef d'Alignement qui peut modifier certains pouvoirs.",
  },
  {
    term: "Brâkmar",
    definition: "Mot-clef d'Alignement qui peut modifier certains pouvoirs.",
  },
  {
    term: "Capture",
    definition:
      "Une Dragodinde transformée en Équipement et montée par un Allié ou un Héros.",
  },
  {
    term: "Challenge",
    definition:
      "Type d'Action jouable par un attaquant, qui rapporte de l'Expérience au vainqueur.",
  },
  {
    term: "Chercher",
    definition:
      "Chercher dans une zone revient à parcourir l'ensemble des cartes présentes dans cette zone.",
  },
  {
    term: "Chi-Fu-Mi",
    definition:
      "Pierre-Feuille-Ciseau : la Pierre bat le Ciseau, la Feuille bat la Pierre, le Ciseau bat la Feuille.",
  },
  {
    term: "Choix",
    definition:
      "Demande au joueur de déterminer les objets affectés par une carte ou un pouvoir.",
  },
  {
    term: "Classe",
    definition:
      "Trait des Héros et des Alliés, comportant 12 classes : Ecaflip, Sadida, Eniripsa, Osamodas, Iop, Enutrof, Crâ, Sram, Féca, Xélor, Sacrieur, Pandawa.",
  },
  {
    term: "Contrôleur",
    definition:
      "Le joueur qui contrôle les cartes jouées, son Héros, son Havre Sac et les objets.",
  },
  {
    term: "Coût",
    definition:
      "Un coût représente tout ce que doit payer le joueur lorsqu'il souhaite jouer une carte ou utiliser un pouvoir.",
  },
  {
    term: "Coût additionnel",
    definition:
      "Un coût additionnel représente tout ce que doit payer le joueur en plus du coût en ressources lorsqu'il souhaite jouer une carte.",
  },
  {
    term: "Crafter",
    definition: "Voir Fabriquer.",
  },
  {
    term: "Défausser",
    definition:
      "Défausser une carte revient à la mettre physiquement depuis la zone ou elle se trouve (généralement la Main) dans la Défausse de son propriétaire.",
  },
  {
    term: "Défense",
    definition:
      "Un Allié jouable durant la Phase d'Actions d'un combat si son contrôleur est le défenseur ; il est placé comme bloqueur.",
  },
  {
    term: "Détruire",
    definition:
      "Détruire une carte revient à la mettre physiquement depuis le Havre Sac ou le Monde dans la Défausse de son propriétaire.",
  },
  {
    term: "Dofus",
    definition:
      "Type de carte porté par un Héros ou un Allié. Un Dofus n'est plus considéré comme un Équipement depuis le 15 janvier 2010.",
  },
  {
    term: "Dommage",
    definition:
      "Infligé à un Héros (perte de PV) ou à un Havre Sac (perte de Points de Résistance).",
  },
  {
    term: "Dommage de combat",
    definition:
      "Dommages infligés durant les Phases de Résolution des Duels et des Dommages à la Cible.",
  },
  {
    term: "Dommage létal",
    definition:
      "Un Dommage supérieur ou égal à la Force d'un Allié, sans tenir compte d'éventuelles réductions futures.",
  },
  {
    term: "Élément",
    definition: "Il existe 5 Éléments : Feu, Air, Terre, Eau, Neutre.",
  },
  {
    term: "Équipement",
    definition:
      "Type de carte comportant 5 types : Arme, Armure, Bijou, Objet, Familier.",
  },
  {
    term: "Expérience",
    definition:
      "L'Expérience est gagnée par le Héros en détruisant des Alliés adverses ou en complétant des Quêtes et des Challenges. 6 points d'Expérience permettent de passer au Niveau 2 ; 18 points d'Expérience permettent de passer au Niveau 3, ce qui correspond à la Victoire.",
  },
  {
    term: "Fabriquer",
    definition:
      "Fabriquer un Équipement ou une Salle revient jouer la carte Équipement ou Salle pour son coût de Recette plutôt que son coût de lancement traditionnel.",
  },
  {
    term: "Familier",
    definition:
      "Type d'Équipement nécessitant d'être nourri en début de tour via le recyclage de cartes.",
  },
  {
    term: "Fantôme",
    definition:
      "Le mot-clef « Fantôme » représente un pouvoir continu qui est actif quand la carte qui le possède est dans une Défausse et qui signifie « Si cette carte est dans votre Défausse, vous pouvez payer un nombre de Ressources (Neutre) égal à son Niveau plus 1 pour la remettre en jeu dans le Monde ».",
  },
  {
    term: "File d'Attente",
    definition:
      "Zone où les cartes et pouvoirs en cours d'utilisation sont placés.",
  },
  {
    term: "Force",
    definition:
      "La Force représente le nombre de Dommages de combat qu'inflige le Héros ou l'Allié.",
  },
  {
    term: "Géant",
    definition:
      "Géant est un mot-clef représentant un pouvoir continu. Ce pouvoir signifie deux choses : « Cet Allié ou Héros attaquant peut répartir ses Dommages de combat entre l'ensemble des Alliés ou Héros qui le bloquent » et « Si tous les Alliés ou Héros qui bloquent cet Allié ou Héros se voient infliger des Dommages létals, les Dommages restant peuvent être infligés à la Cible de l'attaque ».",
  },
  {
    term: "Havre Sac",
    definition:
      "Zone de jeu matérialisée par une carte, offrant une protection contre l'adversaire. Chaque joueur commence la partie avec son Héros dedans.",
  },
  {
    term: "Héros",
    definition:
      "Type de carte. Le joueur commence la partie avec son Héros dans son Havre Sac.",
  },
  {
    term: "Incliner",
    definition: "Incliner une carte revient à la basculer à l'horizontale.",
  },
  {
    term: "Invocation",
    definition:
      "Une invocation est une Action qui est mise en jeu à sa résolution, et non dans la défausse de son propriétaire.",
  },
  {
    term: "Jeton",
    definition:
      "Représentation physique d'un objet dans le Monde ou le Havre Sac, possédant un nom, un Élément et éventuellement une Force.",
  },
  {
    term: "Jouer",
    definition:
      "Jouer une carte revient à la mettre physiquement à la fin de la File d'Attente depuis sa Main.",
  },
  {
    term: "Marqueur",
    definition:
      "Petit objet placé sur une carte matérialisant un effet ; il reste jusqu'à son retrait ou un changement de zone de la carte.",
  },
  {
    term: "Métier",
    definition:
      "Un Allié peut posséder un Métier, parmi 4 types : Armurier, Forgeron, Bricoleur, Bijoutier.",
  },
  {
    term: "Modificateur de remplacement",
    definition:
      "Effet transformant un événement en un autre ; l'événement transformé est considéré comme n'ayant jamais existé.",
  },
  {
    term: "Monde",
    definition:
      "Zone commune aux joueurs où les combats se déroulent. Le Havre Sac de chaque joueur s'y trouve.",
  },
  {
    term: "Monstre",
    definition:
      "Type d'Allié possédant le trait « Monstre ». Un Monstre ne peut pas porter d'Équipement.",
  },
  {
    term: "Mot-clef",
    definition:
      "Associé à un pouvoir, écrit en gras sur les cartes. Chaque mot-clef possède une entrée dans le Glossaire.",
  },
  {
    term: "Mouvement",
    definition:
      "Un Héros ou Allié se déplaçant du Monde vers un Havre Sac ou inversement. Aucun mouvement n'est possible lors du premier tour du premier joueur.",
  },
  {
    term: "Niveau",
    definition:
      "Le Niveau d'une carte représente le coût de lancement de la carte. Pour un Héros, le Niveau est fixe et détermine sa condition de victoire ainsi que ses pouvoirs.",
  },
  {
    term: "Passer",
    definition:
      "Un joueur qui ne réalise aucune action de jeu durant la Phase d'Actions d'un combat passe.",
  },
  {
    term: "Pioche",
    definition:
      "Zone de jeu contenant les cartes non piochées. Les joueurs ne peuvent pas en consulter le contenu.",
  },
  {
    term: "Piocher",
    definition:
      "Piocher une carte revient à la mettre physiquement depuis le dessus de la Pioche dans sa Main.",
  },
  {
    term: "Point d'Action (PA)",
    definition:
      "Caractéristique du joueur liée à son Héros, déterminant le nombre maximum de cartes en Main.",
  },
  {
    term: "Point de Mouvement (PM)",
    definition:
      "Caractéristique du joueur liée à son Héros, déterminant le nombre maximum de Héros et Alliés pouvant être envoyés au combat.",
  },
  {
    term: "Point de Vie (PV)",
    definition:
      "Caractéristique du Héros. Un Héros à 0 PV est détruit, ce qui entraîne la perte de la partie.",
  },
  {
    term: "Porteur",
    definition:
      "Un Héros ou Allié recevant un Équipement. Un Monstre ne peut pas être porteur.",
  },
  {
    term: "Pouvoir",
    definition:
      "Quelque chose qu'une carte en jeu peut faire. Un pouvoir peut être à paiement, continu ou déclenché.",
  },
  {
    term: "Pouvoir à paiement",
    definition:
      "Pouvoir identifié par la syntaxe « Coût : Effet » sur les cartes.",
  },
  {
    term: "Pouvoir à ressource",
    definition: "Un pouvoir à paiement permettant de produire une Ressource.",
  },
  {
    term: "Pouvoir continu",
    definition:
      "Pouvoir qui n'est ni déclenché ni à paiement ; il s'applique en permanence.",
  },
  {
    term: "Pouvoir déclenché",
    definition:
      "Pouvoir qui surveille un événement et prend effet lors de sa survenance.",
  },
  {
    term: "Propriétaire",
    definition:
      "Le joueur propriétaire des cartes avec lesquelles il a commencé la partie dans son paquet. Le propriétaire ne peut pas changer.",
  },
  {
    term: "Protecteur",
    definition: "Type de carte.",
  },
  {
    term: "Quête",
    definition:
      "Type d'Action jouable lors de la survenance d'un événement, à n'importe quel moment de la partie.",
  },
  {
    term: "Rareté",
    definition:
      "Représente la fréquence d'une carte dans les paquets de recharge : Rare (symbole doré), Peu Commune (symbole argenté), Commune (symbole vide).",
  },
  {
    term: "Réaction",
    definition:
      "Réaction est un mot-clef représentant un pouvoir continu. Chaque carte ou pouvoir possédant le mot-clef Réaction surveille un événement. Réaction signifie « Lorsque [Evénement] prend effet, vous pouvez jouez cette carte ou utiliser ce pouvoir, et seulement à cet instant ».",
  },
  {
    term: "Recette",
    definition:
      "La Recette est un coût alternatif pour jouer une carte Équipement. Elle correspond à un nombre de cartes d'un Élément donné à recycler.",
  },
  {
    term: "Recycler",
    definition:
      "Recycler une carte revient à la mettre physiquement depuis la zone où elle se trouve (généralement la Défausse) en dessous de la Pioche de son propriétaire.",
  },
  {
    term: "Redresser",
    definition:
      "Redresser une carte revient à la remettre en position verticale.",
  },
  {
    term: "Renfort",
    definition:
      "Un Allié possédant Renfort peut être joué pendant la phase d'actions d'un combat où son propriétaire est le joueur attaquant, et que son Héros est attaquant dans ce combat.",
  },
  {
    term: "Réserve",
    definition:
      "Certains tournois l'autorisent. Le joueur commence le match avec son paquet et peut échanger des cartes avec sa réserve entre les parties.",
  },
  {
    term: "Résistance",
    definition:
      "Résistance est un mot-clef représentant un pouvoir continu. La syntaxe « Résistance [Élément] [Nombre] » signifie : « Si des Dommages de type [Élément] devaient être infligés à ce Héros ou cet Allié, réduisez ces Dommages de [Nombre] ».",
  },
  {
    term: "Ressource",
    definition:
      "Une ressource est une unité d'énergie magique utilisée par les joueurs pour jouer des cartes ou utiliser des pouvoirs.",
  },
  {
    term: "Révéler",
    definition:
      "Révéler une carte revient à la montrer à son adversaire pour qu'il puisse la voir. La carte redevient cachée par la suite.",
  },
  {
    term: "Rollback",
    definition:
      "En début de partie, un joueur qui n'est pas satisfait de sa Main initiale peut la recycler, mélanger sa pioche et piocher autant de cartes. Ceci s'appelle « effectuer un Rollback ».",
  },
  {
    term: "Salle",
    definition:
      "Type de carte jouable durant son tour dans le Havre Sac de son contrôleur. Les Salles sont généralement fabriquées par un Bricoleur.",
  },
  {
    term: "Sort",
    definition:
      "Type d'Action lancé en contrôlant un Héros ou un Allié de la Classe du Sort.",
  },
  {
    term: "Supplémentaire",
    definition:
      "Cartes ou pouvoirs permettant de réaliser une action « supplémentaire » une fois de plus.",
  },
  {
    term: "Tacle",
    definition:
      "Le mot-clef « Tacle » représente un pouvoir continu qui intervient durant la Phase d'Actions. Ce pouvoir signifie : « Jusqu'à la fin du combat, les Alliés ou Héros qui bloquent ou qui sont bloqués par un Allié ou Héros possédant Tacle ne peuvent pas s'incliner ».",
  },
  {
    term: "Unique",
    definition:
      "Un trait présent sur certaines cartes. Un joueur ne peut pas avoir dans son paquet plus d'une carte Unique avec un nom donné en début de partie.",
  },
  {
    term: "X",
    definition:
      "Variable indéfinie fixée par le joueur lorsqu'il joue la carte ou utilise le pouvoir.",
  },
  {
    term: "Zone",
    definition: "Type de carte jouable durant son tour dans le Monde.",
  },
  {
    term: "Zone de Jeu",
    definition:
      "Endroit où une carte peut se trouver. Il existe 6 zones : Pioche, Défausse, Monde, Havre Sac, Main, File d'Attente.",
  },
];
