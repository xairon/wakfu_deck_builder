/**
 * Decks « idées de deck » WAKFU TCG extraits du magazine Dofus Mag.
 * Source de vérité : photos dans `dofus_mag_decks/` (hors git).
 * INVARIANT : chaque deck = exactement 48 cartes (hors héros + havre-sac).
 * Voir le rapport de matching : `docs/dofus-mag-matching-report.md`.
 */
import type { OfficialDeck } from "./officialDecks";

export const DOFUS_MAG_DECKS: OfficialDeck[] = [
  // ───────────────────────────────────────────────────────────────────────────
  // Deck Gelées Royales — Trantmy Londami (Neutre)
  // Alliés 32 + Actions 5 + Zone 4 + Équipement 6 + Protecteur 1 = 48
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "dofus-mag-gelees-royales",
    name: "Deck Gelées Royales — Trantmy Londami",
    description:
      "Deck Gelées Neutre construit autour des Gelées Royales et de Trantmy Londami (Dofus Mag).",
    extension: "dofus-mag",
    source: "dofus-mag",
    hero: "Trantmy Londami",
    havreSac: "Havre Sac du Tofu",
    alignment: "Neutre",
    lore: "Cela faisait longtemps que les Gelées s'ennuyaient sur leur péninsule, abandonnées de tous… Mais un jour, Trantmy Londami revint d'un voyage lointain dans la Gelaxième Dimension, et leur rapporta une petite surprise. Et quelle surprise ! Il s'agissait ni plus ni moins que des quatre Gelées Royales que les Gelées admiraient par dessus tout ! Elles les aideraient à venir plus vite sur les champs de bataille, les renforceraient, leur donneraient force, puissance et grandeur ! Les Gelées étaient ravivées, et avec leurs nouvelles copines, elles étaient bien décidées à revenir dans le Monde des Douze, plus fortes et plus nombreuses !",
    keyCards: ["Roi Gelax", "Gelaxième Dimension", "les Gelées"],
    protector: "Jiva, Protectrice de Javian",
    illustrator: "Roxnin",
    cards: [
      // Alliés : 32
      { name: "Serpentin", quantity: 3, type: "card", section: "Alliés" },
      { name: "Choub Nigourak", quantity: 3, type: "card", section: "Alliés" },
      { name: "Ash Tur", quantity: 3, type: "card", section: "Alliés" },
      { name: "Moskitorsh", quantity: 2, type: "card", section: "Alliés" },
      {
        name: "Chauve-Souris Vampyre",
        quantity: 2,
        type: "card",
        section: "Alliés",
      },
      {
        name: "Piou de Baradaize",
        quantity: 2,
        type: "card",
        section: "Alliés",
      },
      { name: "Gelée Verte", quantity: 3, type: "card", section: "Alliés" },
      { name: "Gelée Bleue", quantity: 3, type: "card", section: "Alliés" },
      { name: "Gelée Citron", quantity: 3, type: "card", section: "Alliés" },
      { name: "Gelée Fraise", quantity: 3, type: "card", section: "Alliés" },
      {
        name: "Gelée Royale Menthe",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      {
        name: "Gelée Royale Citron",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      {
        name: "Gelée Royale Bleue",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      {
        name: "Gelée Royale Fraise",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      { name: "Roi Gelax", quantity: 1, type: "card", section: "Alliés" },
      // Actions : 5
      {
        name: "Filouteries au Zaap d'Astrub",
        quantity: 2,
        type: "card",
        section: "Actions",
      },
      { name: "Agression", quantity: 2, type: "card", section: "Actions" },
      {
        name: "La Dernière Rasade",
        quantity: 1,
        type: "card",
        section: "Actions",
      },
      // Zone : 4
      { name: "Zaap", quantity: 1, type: "card", section: "Zone" },
      { name: "Île de Moon", quantity: 1, type: "card", section: "Zone" },
      {
        name: "Gelaxième Dimension",
        quantity: 2,
        type: "card",
        section: "Zone",
      },
      // Équipement : 6
      {
        name: "Venin de Scorbute",
        quantity: 2,
        type: "card",
        section: "Équipement",
      },
      {
        name: "Aiguille à Tricoter",
        quantity: 2,
        type: "card",
        section: "Équipement",
      },
      {
        name: "Amulette du Bandit",
        quantity: 2,
        type: "card",
        section: "Équipement",
      },
      // Protecteur : 1
      {
        name: "Jiva, Protectrice de Javian",
        quantity: 1,
        type: "card",
        section: "Protecteur",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Deck Ecaflip — Karey Dass (Dofus Mag 124)
  // Alliés 25 + Sorts 6 + Actions 9 + Équipements 5 + Zones 3 = 48
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "dofus-mag-ecaflip-karey-dass",
    name: "Deck Ecaflip — Karey Dass",
    description:
      "Deck Ecaflip acrobatique autour du Chi-Fu-Mi et de Karey Dass (Dofus Mag).",
    extension: "dofus-mag",
    source: "dofus-mag",
    hero: "Karey Dass",
    havreSac: "Havre Sac du Tofu",
    magIssue: "Dofus Mag 124",
    lore: "Chi… Fu… BIM ! S'il n'exploite pas à fond les effets du Chi-Fu-Mi permettant de booster son Héros Karey Dass, malgré un Kanigrou, trois Gambit et le puissant Odorat, ce deck assez acrobatique reste tout de même très Ecaflip dans l'âme ! Rapide à mettre en place, avec de nombreuses cartes capables de déstabiliser le jeu de l'adversaire, il demandera un peu de maîtrise pour contenir les attaques grâce aux capacités de ses Guy Yomtella, Kriss la Krass et autres Tofu Mutant, le temps de sortir un Moon qui fera la différence…",
    howToPlay:
      "Gambit et Odorat prendront toute leur saveur s'ils sont combinés pour booster Karey Dass en vue d'une grosse attaque à 5 ou 6 PM, dont la cible sera évidemment le Havre Sac adverse. Quant aux Réflexes, pourquoi ne pas les tester pour redresser un Moon ou un Guy Yomtella ? Ces deux cartes devraient faire des ravages, surtout si elles bénéficient en prime d'un Parchemin d'Agilité ou d'un Tiwabbit !",
    cards: [
      // Alliés : 25
      { name: "Smare", quantity: 3, type: "card", section: "Alliés" },
      { name: "Merelyne Manro", quantity: 3, type: "card", section: "Alliés" },
      { name: "Kristie Endor", quantity: 2, type: "card", section: "Alliés" },
      { name: "Ekraz Lenoub", quantity: 2, type: "card", section: "Alliés" },
      { name: "Akoua Flesh", quantity: 2, type: "card", section: "Alliés" },
      { name: "Kriss la Krass", quantity: 2, type: "card", section: "Alliés" },
      { name: "Guy Yomtella", quantity: 2, type: "card", section: "Alliés" },
      { name: "Tofu Mutant", quantity: 2, type: "card", section: "Alliés" },
      {
        name: "Chauve-Souris Vampyre",
        quantity: 2,
        type: "card",
        section: "Alliés",
      },
      {
        name: "Le Bourreau des Brumes",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      { name: "Gros Smare", quantity: 1, type: "card", section: "Alliés" },
      { name: "Piou Jaune", quantity: 1, type: "card", section: "Alliés" },
      { name: "Kanigrou", quantity: 1, type: "card", section: "Alliés" },
      { name: "Moon", quantity: 1, type: "card", section: "Alliés" },
      // Sorts : 6
      { name: "Gambit", quantity: 3, type: "card", section: "Sorts" },
      { name: "Réflexes", quantity: 2, type: "card", section: "Sorts" },
      { name: "Odorat", quantity: 1, type: "card", section: "Sorts" },
      // Actions : 9
      { name: "Boon Attitude", quantity: 2, type: "card", section: "Actions" },
      { name: "Pandrista", quantity: 2, type: "card", section: "Actions" },
      {
        name: "Parchemin d'Agilité",
        quantity: 1,
        type: "card",
        section: "Actions",
      },
      { name: "Banni !", quantity: 1, type: "card", section: "Actions" },
      { name: "Brisé !", quantity: 1, type: "card", section: "Actions" },
      { name: "Répulsion", quantity: 1, type: "card", section: "Actions" },
      {
        name: "Jeunesse d'Ogrest",
        quantity: 1,
        type: "card",
        section: "Actions",
      },
      // Équipements : 5
      { name: "Tiwabbit", quantity: 1, type: "card", section: "Équipements" },
      {
        name: "Scaracoiffe Blanche",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      {
        name: "Scaracape Blanche",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      {
        name: "Scaranneau Blanc",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      {
        name: "Queues de Chatons",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      // Zones : 3
      { name: "Champs d'Astrub", quantity: 3, type: "card", section: "Zones" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Deck Sadida — Klore Ofil (Dofus Mag 124)
  // Alliés 25 + Sorts 6 + Actions 9 + Équipements 5 + Zones 3 = 48
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "dofus-mag-sadida-klore-ofil",
    name: "Deck Sadida — Klore Ofil",
    description:
      "Deck Sadida Terre/PM autour de Klore Ofil et Sylvine Folherbe (Dofus Mag).",
    extension: "dofus-mag",
    source: "dofus-mag",
    hero: "Klore Ofil",
    havreSac: "Havre Sac du Bouftou",
    magIssue: "Dofus Mag 124",
    lore: "Promenons-nous dans les bois, pendant que le Milimulou n'y est pas ! Doté d'Alliés Terre particulièrement agressifs (Jicé Aouaire, Gelée Menthe, Milimulou, Katsou Mee) et d'Équipements tout en finesse (Panoplie Mulou, Razielle, Marcassin), ce deck Sadida gagne à exploiter à fond l'avantage de PM conféré par la capacité de son Héros Klore Ofil et de ses Sylvine Folherbe, qui se feront un plaisir de réduire les PM de l'adversaire pour l'empêcher de se défendre ou de trop vous chatouiller…",
    howToPlay:
      "Gardez Sylvine Folherbe dans votre Havre Sac et utilisez-la pour réduire les PM de l'adversaire en attaque, le temps de préparer une bonne ligne d'Alliés, si possible équipés en Mulou, puis combinez le pouvoir d'une ou deux Sylvine à celui de Klore Ofil pour lancer une attaque à défense très réduite sur le Havre Sac. Face à un seul Allié, une Exclusion suffit pour vous ouvrir la voie et pulvériser le Sac !",
    cards: [
      // Alliés : 25
      { name: "Boufton Blanc", quantity: 3, type: "card", section: "Alliés" },
      { name: "Shika Ingalsse", quantity: 2, type: "card", section: "Alliés" },
      {
        name: "Sylvine Folherbe",
        quantity: 2,
        type: "card",
        section: "Alliés",
      },
      { name: "Tomla Klass", quantity: 2, type: "card", section: "Alliés" },
      { name: "Jicé Aouaire", quantity: 2, type: "card", section: "Alliés" },
      { name: "Larve Verte", quantity: 2, type: "card", section: "Alliés" },
      { name: "Gelée Menthe", quantity: 2, type: "card", section: "Alliés" },
      { name: "Goule", quantity: 2, type: "card", section: "Alliés" },
      { name: "Milimulou", quantity: 2, type: "card", section: "Alliés" },
      { name: "Lâme Ourduvis", quantity: 1, type: "card", section: "Alliés" },
      { name: "Katsou Mee", quantity: 1, type: "card", section: "Alliés" },
      { name: "Selk Ator", quantity: 1, type: "card", section: "Alliés" },
      { name: "Piou Vert", quantity: 1, type: "card", section: "Alliés" },
      { name: "Abraknyde", quantity: 1, type: "card", section: "Alliés" },
      {
        name: "Eratz Le Revendicateur",
        quantity: 1,
        type: "card",
        section: "Alliés",
      },
      // Sorts : 6
      { name: "Ronce", quantity: 3, type: "card", section: "Sorts" },
      { name: "La Folle", quantity: 2, type: "card", section: "Sorts" },
      { name: "La Sacrifiée", quantity: 1, type: "card", section: "Sorts" },
      // Actions : 9
      { name: "Pandrista", quantity: 2, type: "card", section: "Actions" },
      { name: "Exclusion", quantity: 2, type: "card", section: "Actions" },
      {
        name: "Parchemin de Force",
        quantity: 1,
        type: "card",
        section: "Actions",
      },
      { name: "Coup Critique", quantity: 1, type: "card", section: "Actions" },
      { name: "Banni !", quantity: 1, type: "card", section: "Actions" },
      { name: "Brisé !", quantity: 1, type: "card", section: "Actions" },
      {
        name: "Bonne Affaire !",
        quantity: 1,
        type: "card",
        section: "Actions",
      },
      // Équipements : 5
      { name: "Marcassin", quantity: 1, type: "card", section: "Équipements" },
      {
        name: "Cape du Mulou",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      {
        name: "Hache du Mulou",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      {
        name: "String du Mulou",
        quantity: 1,
        type: "card",
        section: "Équipements",
      },
      { name: "Razielle", quantity: 1, type: "card", section: "Équipements" },
      // Zones : 3
      { name: "Forêts d'Astrub", quantity: 3, type: "card", section: "Zones" },
    ],
  },
];
