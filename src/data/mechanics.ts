/**
 * REGISTRE DE MÉCANIQUES — vocabulaire contrôlé des effets (fondation, couche 1).
 * Une mécanique = un concept de jeu nommé, indépendant des cartes. Les tags des
 * effets sont dérivés automatiquement des ops compilées via OP_TO_MECHANIC
 * (cf. scripts/compileEffects.ts). Le graphe `relatesTo` complet et le tagging
 * des effets `uncovered` (sans ops) viendront dans des couches ultérieures.
 */
import type { CompiledEffectOp, Mechanic, MechanicTag } from "@/types/cards";

export const MECHANICS: Mechanic[] = [
  {
    id: "gain-xp",
    label: "Gain d'XP",
    category: "ressource",
    glossary: "Donne de l'expérience au Héros (progression de Niveau).",
  },
  {
    id: "draw",
    label: "Pioche",
    category: "ressource",
    glossary: "Pioche une ou plusieurs cartes.",
  },
  {
    id: "hero-gain-pv",
    label: "Héros regagne des PV",
    category: "soin",
    glossary: "Votre Héros regagne des points de vie.",
  },
  {
    id: "hero-lose-pv",
    label: "Héros perd des PV",
    category: "dégâts",
    glossary: "Votre Héros perd des points de vie (coût d'effet).",
  },
  {
    id: "damage-opp-hero",
    label: "Dégâts au Héros adverse",
    category: "dégâts",
    glossary: "Inflige des Dommages directs au Héros adverse.",
  },
  {
    id: "bag-gain-resistance",
    label: "Havre-Sac gagne en Résistance",
    category: "contrôle",
    glossary: "Augmente la Résistance du Havre-Sac.",
  },
  {
    id: "destroy-target",
    label: "Destruction ciblée",
    category: "contrôle",
    glossary: "Détruit une carte ciblée (Allié, Zone ou Équipement).",
  },
  {
    id: "banish-target",
    label: "Bannissement ciblé",
    category: "contrôle",
    glossary:
      "Bannit une carte ciblée : elle est retirée de la partie (Exil), sans accorder d'XP — distinct de la destruction.",
  },
  {
    id: "banish-from-zone",
    label: "Bannissement depuis la Défausse adverse",
    category: "contrôle",
    glossary:
      "Bannit une carte choisie dans la Défausse d'un adversaire : elle est retirée de la partie (Exil), sans accorder d'XP — distinct de la destruction.",
  },
  {
    id: "damage-target",
    label: "Dégâts ciblés",
    category: "dégâts",
    glossary: "Inflige des Dommages à un Allié ou Héros ciblé.",
  },
  {
    id: "damage-multi-target",
    label: "Dégâts multi-cibles",
    category: "dégâts",
    glossary:
      "Inflige des Dommages à plusieurs cibles choisies (jusqu'à un nombre fixé).",
  },
  {
    id: "damage-target-by-force",
    label: "Dégâts ciblés (Force)",
    category: "dégâts",
    glossary:
      "Inflige à une cible des Dommages égaux à la Force de la carte source.",
  },
  {
    id: "each-player-draws",
    label: "Pioche de tous les joueurs",
    category: "ressource",
    glossary:
      "Chaque joueur pioche un nombre de cartes (joueur actif d'abord).",
  },
  {
    id: "heal-hero-target",
    label: "Soin de Héros ciblé",
    category: "soin",
    glossary: "Un Héros ciblé regagne des points de vie.",
  },
  {
    id: "buff-force-target",
    label: "Bonus de Force ciblé",
    category: "tempo",
    glossary: "Donne un bonus de Force temporaire à une cible.",
  },
  {
    id: "buff-force-self",
    label: "Bonus de Force (soi)",
    category: "tempo",
    glossary: "La carte source gagne un bonus de Force temporaire.",
  },
  {
    id: "recycle-from-discard",
    label: "Recyclage de Défausse",
    category: "ressource",
    glossary: "Remet des cartes de la Défausse sous la Pioche.",
    relatesTo: [
      {
        tag: "discard-from-hand",
        kind: "feeds",
        note: "La défausse alimente le recyclage.",
      },
    ],
  },
  {
    id: "discard-from-hand",
    label: "Défausse de main",
    category: "ressource",
    glossary: "Défausse une ou plusieurs cartes de sa main.",
  },
  {
    id: "search-deck",
    label: "Recherche dans la Pioche",
    category: "ressource",
    glossary: "Cherche une carte filtrée dans la Pioche.",
  },
  {
    id: "put-in-play",
    label: "Mise en jeu depuis la main / Défausse",
    category: "tempo",
    glossary:
      "Met en jeu une carte existante choisie dans la main ou la Défausse ; ses effets d'apparition se déclenchent.",
  },
  {
    id: "create-token",
    label: "Création de jeton",
    category: "tempo",
    glossary:
      "Met en jeu un jeton de créature (« Monstre - X » de Force N) sans carte de deck ; il cesse d'exister en quittant le jeu.",
    relatesTo: [
      {
        tag: "put-in-play",
        kind: "synergizes",
        note: "Mise en jeu d'une créature, mais sans carte de deck (jeton synthétique).",
      },
    ],
  },
  {
    id: "shuffle-deck",
    label: "Mélange de Pioche",
    category: "autre",
    glossary: "Mélange la Pioche.",
  },
  {
    id: "destroy-self",
    label: "Auto-destruction",
    category: "contrôle",
    glossary: "Détruit la carte source de l'effet.",
  },
  {
    id: "lose-stat-turn",
    label: "Perte de PA/PM",
    category: "contrôle",
    glossary: "Réduit temporairement les PA ou PM jusqu'à la fin du tour.",
  },
  {
    id: "opp-lose-stat-turn",
    label: "Adversaire perd des PA/PM",
    category: "contrôle",
    glossary:
      "Réduit les PA ou PM de l'adversaire jusqu'à la fin du tour (cible déterministe).",
  },
  {
    id: "buff-force-hero-self",
    label: "Bonus de Force (Héros)",
    category: "tempo",
    glossary: "Votre Héros gagne un bonus de Force temporaire.",
  },
  {
    id: "untap-hero-self",
    label: "Redressement (votre Héros)",
    category: "tempo",
    glossary: "Redresse votre Héros.",
  },
  {
    id: "tap-self",
    label: "Inclinaison (soi)",
    category: "tempo",
    glossary: "Incline la carte source.",
  },
  {
    id: "untap-self",
    label: "Redressement (soi)",
    category: "tempo",
    glossary: "Redresse la carte source.",
  },
  {
    id: "combat-mod-self",
    label: "Modificateur de combat (soi)",
    category: "tempo",
    glossary: "Bonus de combat (Force/PM/Géant) jusqu'à la fin du combat.",
  },
  {
    id: "grant-keyword-self",
    label: "Mot-clé conféré (soi, jusqu'à la fin du tour)",
    category: "tempo",
    glossary:
      "La carte source gagne un mot-clé de combat (Géant : répartition de Force ; Agilité : ne peut être bloqué que par Agilité ; Agressivité : peut attaquer le tour de son apparition) jusqu'à la fin du tour.",
    relatesTo: [
      {
        tag: "combat-mod-self",
        kind: "synergizes",
        note: "Même mot-clé Géant, mais portée TOUR (combatModSelf est portée COMBAT).",
      },
    ],
  },
  {
    id: "grant-keyword-bearer-self",
    label: "Mot-clé conféré au Porteur de soi (jusqu'à la fin du tour)",
    category: "tempo",
    glossary:
      "« Le Porteur de <self> gagne <mot-clé> jusqu'à la fin du tour » : la source (un Équipement) confère un mot-clé de combat à la créature qui la porte, jusqu'à la fin du tour.",
  },
  {
    id: "grant-keyword-target",
    label: "Mot-clé conféré (cible, jusqu'à la fin du tour)",
    category: "tempo",
    glossary:
      "L'Allié ou Héros ciblé gagne un mot-clé de combat (Géant / Agilité / Agressivité) jusqu'à la fin du tour.",
    relatesTo: [
      {
        tag: "grant-keyword-self",
        kind: "synergizes",
        note: "Variante ciblée de l'octroi de mot-clé.",
      },
    ],
  },
  {
    id: "grant-resistance-self",
    label: "Résistance conférée (soi, jusqu'à la fin du tour)",
    category: "contrôle",
    glossary:
      "La carte source gagne de la Résistance à un ou plusieurs Éléments jusqu'à la fin du tour (prévention de Dommages de cet Élément, 7469).",
    relatesTo: [
      {
        tag: "grant-resistance-target",
        kind: "synergizes",
        note: "Variante ciblée de l'octroi de Résistance.",
      },
    ],
  },
  {
    id: "grant-resistance-target",
    label: "Résistance conférée (cible, jusqu'à la fin du tour)",
    category: "contrôle",
    glossary:
      "L'Allié ou Héros ciblé gagne de la Résistance à un ou plusieurs Éléments jusqu'à la fin du tour (prévention de Dommages, 7469).",
    relatesTo: [
      {
        tag: "grant-resistance-self",
        kind: "synergizes",
        note: "Variante (soi) de l'octroi de Résistance.",
      },
    ],
  },
  {
    id: "buff-force-allies-monde",
    label: "Bonus de Force d'équipe",
    category: "tempo",
    glossary:
      "Bonus de Force à tous vos Alliés du Monde jusqu'à la fin du tour.",
  },
  {
    id: "global-damage-shield",
    label: "Réduction globale des Dommages",
    category: "contrôle",
    glossary: "Réduit tous les Dommages à 0 temporairement.",
  },
  {
    id: "team-combat-dmg-reduction",
    label: "Réduction de Dommages d'équipe (combat)",
    category: "contrôle",
    glossary:
      "Jusqu'à la fin du combat, réduit de N les Dommages infligés à vos Alliés ou Héros attaquants ou bloqueurs.",
  },
  {
    id: "tap-target",
    label: "Inclinaison (cible)",
    category: "tempo",
    glossary: "Incline un Allié (ou Héros) ciblé.",
  },
  {
    id: "untap-target",
    label: "Redressement (cible)",
    category: "tempo",
    glossary: "Redresse un Allié (ou Héros) ciblé.",
  },
  {
    id: "return-to-hand",
    label: "Renvoi en main (cible)",
    category: "contrôle",
    glossary: "Renvoie un Allié ciblé dans la main de son propriétaire.",
  },
  {
    id: "tap-all",
    label: "Inclinaison de masse",
    category: "tempo",
    glossary:
      "Incline tous les Alliés (et Héros) correspondant aux filtres, sans choix du joueur.",
  },
  {
    id: "untap-all",
    label: "Redressement de masse",
    category: "tempo",
    glossary:
      "Redresse tous les Alliés (et Héros) correspondant aux filtres, sans choix du joueur.",
  },
  {
    id: "damage-all",
    label: "Dégâts de masse",
    category: "dégâts",
    glossary:
      "Inflige des Dommages à tous les Alliés (et Héros) correspondant aux filtres, sans choix du joueur.",
  },
  {
    id: "destroy-all",
    label: "Destruction de masse",
    category: "contrôle",
    glossary:
      "Détruit tous les Alliés (et Héros) correspondant aux filtres, sans choix du joueur (board-wipe).",
    relatesTo: [
      {
        tag: "destroy-target",
        kind: "feeds",
        note: "Variante de masse de la destruction ciblée.",
      },
    ],
  },
  {
    id: "cost-tap-controlled",
    label: "Coût : inclinaison d'une de vos créatures",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : inclinez une de vos créatures éligibles (au choix) pour payer l'effet.",
  },
  {
    id: "cost-destroy-controlled",
    label: "Coût : destruction d'une de vos créatures",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : détruisez une de vos créatures éligibles (au choix) pour payer l'effet.",
  },
  {
    id: "cost-discard",
    label: "Coût : défausse",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : défaussez une ou plusieurs cartes de votre main (imposé, ou « jusqu'à N » — le nombre défaussé alimente la magnitude du corps).",
  },
  {
    id: "cost-recycle",
    label: "Coût : recyclage",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : recyclez une carte (Défausse au choix, votre main, ou la carte source depuis le jeu) — remise sous la Pioche — pour payer l'effet.",
  },
  {
    id: "cost-recycle-controlled",
    label: "Coût : recyclage d'une de vos créatures",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : recyclez une de vos créatures en jeu (au choix) — remise sous la Pioche de son propriétaire — pour payer l'effet.",
  },
  {
    id: "player-draw",
    label: "Pioche du joueur choisi",
    category: "ressource",
    glossary:
      "Le joueur de votre choix (vous ou l'adversaire) pioche un nombre de cartes.",
  },
  {
    id: "player-lose-stat-turn",
    label: "Joueur choisi perd PA/PM",
    category: "contrôle",
    glossary:
      "Le joueur de votre choix perd des PA ou PM jusqu'à la fin du tour.",
  },
  {
    id: "player-gain-stat",
    label: "Joueur choisi gagne PA/PM",
    category: "tempo",
    glossary:
      "Le joueur de votre choix gagne des PA ou PM jusqu'à la fin du tour.",
  },
  {
    id: "conditional",
    label: "Effet conditionnel",
    category: "autre",
    glossary:
      "« Si <condition>, … » : un corps d'effet ne s'exécute que si une condition lisible de l'état de jeu est vraie à la résolution.",
  },
  {
    id: "each-player-optional",
    label: "Chaque joueur peut (optionnel)",
    category: "autre",
    glossary:
      "« Chaque joueur peut <action> » : chaque joueur choisit indépendamment d'exécuter (ou non) l'action, de son point de vue.",
  },
  {
    id: "choose-one",
    label: "Choix exclusif « A ou B »",
    category: "autre",
    glossary:
      "« … gagne A ou B » : le joueur choisit UNE des branches proposées, dont l'effet s'exécute ; les autres sont ignorées.",
  },
];

/** op compilée → mécanique (déterministe, 1:1). */
export const OP_TO_MECHANIC: Record<CompiledEffectOp["op"], MechanicTag> = {
  gainXp: "gain-xp",
  draw: "draw",
  drawTargetXp: "draw",
  heroGainPv: "hero-gain-pv",
  heroLosePv: "hero-lose-pv",
  damageOppHero: "damage-opp-hero",
  havreSacGainResistance: "bag-gain-resistance",
  destroyTarget: "destroy-target",
  banishTarget: "banish-target",
  banishFromZone: "banish-from-zone",
  damageTarget: "damage-target",
  damageMultiTarget: "damage-multi-target",
  damageTargetByForce: "damage-target-by-force",
  eachPlayerDraws: "each-player-draws",
  healHeroTarget: "heal-hero-target",
  buffForceTarget: "buff-force-target",
  buffForceSelf: "buff-force-self",
  recycleFromDiscard: "recycle-from-discard",
  discardFromHand: "discard-from-hand",
  searchDeck: "search-deck",
  putInPlay: "put-in-play",
  createToken: "create-token",
  shuffleDeck: "shuffle-deck",
  destroySelf: "destroy-self",
  loseStatTurn: "lose-stat-turn",
  oppLoseStatTurn: "opp-lose-stat-turn",
  buffForceHeroSelf: "buff-force-hero-self",
  untapHeroSelf: "untap-hero-self",
  tapSelf: "tap-self",
  untapSelf: "untap-self",
  combatModSelf: "combat-mod-self",
  grantKeywordSelf: "grant-keyword-self",
  grantKeywordBearerSelf: "grant-keyword-bearer-self",
  grantKeywordTarget: "grant-keyword-target",
  grantResistanceSelf: "grant-resistance-self",
  grantResistanceTarget: "grant-resistance-target",
  buffForceAlliesMondeTurn: "buff-force-allies-monde",
  globalDamageShield: "global-damage-shield",
  teamCombatDmgReduction: "team-combat-dmg-reduction",
  tapTarget: "tap-target",
  untapTarget: "untap-target",
  tapMultiTarget: "tap-target",
  untapMultiTarget: "untap-target",
  returnToHand: "return-to-hand",
  tapAll: "tap-all",
  untapAll: "untap-all",
  damageAll: "damage-all",
  destroyAll: "destroy-all",
  costTapControlled: "cost-tap-controlled",
  costDestroyControlled: "cost-destroy-controlled",
  costDiscard: "cost-discard",
  costRecycle: "cost-recycle",
  costRecycleControlled: "cost-recycle-controlled",
  playerDraw: "player-draw",
  playerLoseStatTurn: "player-lose-stat-turn",
  playerGainStat: "player-gain-stat",
  conditional: "conditional",
  chooseOne: "choose-one",
  eachPlayerOptional: "each-player-optional",
};

/** Tags uniques dérivés d'une liste d'ops, dans l'ordre d'apparition. */
export function mechanicsForOps(
  ops: { op: CompiledEffectOp["op"] }[],
): MechanicTag[] {
  return [...new Set(ops.map((o) => OP_TO_MECHANIC[o.op]))];
}
