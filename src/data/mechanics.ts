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
    id: "distribute-damage",
    label: "Dégâts répartis librement",
    category: "dégâts",
    glossary:
      "Répartit X points de Dommages (X = montant payé) entre des cibles de combat au choix (répétables, ≥1 chacune) ; assignation accumulée puis appliquée en bloc.",
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
    id: "inc-turn-counter-self",
    label: "Compteur de tour (soi)",
    category: "autre",
    glossary:
      "Incrémente un compteur temporaire sur la carte source (ex. dépense cumulée, flag d'auto-destruction de fin de tour), purgé en début de tour.",
  },
  {
    id: "inc-hero-turn-token",
    label: "Marqueur de tour (Héros)",
    category: "autre",
    glossary:
      "Pose/incrémente un marqueur temporaire sur votre Héros (ex. Glyphe Incandescent actif jusqu'à la fin de la phase d'action), purgé en début de tour.",
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
    id: "set-metier-self",
    label: "Métier conféré (soi, jusqu'à la fin du tour)",
    category: "tempo",
    glossary:
      "« <self> gagne le Métier de votre choix jusqu'à la fin du tour » : la source acquiert l'un des 4 Métiers (Forgeron, Armurier, Bijoutier, Bricoleur) et devient un Artisan pour le tour. Sert de support aux effets qui référencent la possession d'un Métier (Artisans).",
  },
  {
    id: "duel-challenge",
    label: "Défi (duel avec consentement adverse)",
    category: "dégâts",
    glossary:
      "« Inclinez l'un de vos Alliés ou Héros et proposez un défi à l'Allié ou Héros de votre choix : si l'adversaire accepte, les deux cartes s'infligent simultanément leur Force en Dommages ; s'il refuse, vous gagnez 1 XP. » Le duel exige le CONSENTEMENT de l'adversaire (choix Accepter/Refuser).",
  },
  {
    id: "cancel-last-played",
    label: "Annulation de l'effet joué (contre-sort)",
    category: "contrôle",
    glossary:
      "« Annulez les effets de l'Action, du Sort ou du pouvoir qui vient d'être joué. » Réaction jouée dans la fenêtre d'annulation : les effets EN ATTENTE de la carte tout juste jouée sont annulés (jamais résolus). N'affecte PAS les pouvoirs déclenchés (« Quand … », apparition), qui ne sont pas « joués ».",
  },
  {
    id: "chifumi-prevention",
    label: "Prévention Chi-Fu-Mi (mini-jeu)",
    category: "contrôle",
    glossary:
      "« Quand sur le point de recevoir des Dommages, vous pouvez jouer à Chi-Fu-Mi ; si vous gagnez, réduisez-les à 0, sinon détruisez la carte. » Prévention INTERACTIVE : avant qu'un paquet de Dommages ne l'atteigne, le contrôleur peut jouer un pierre-feuille-ciseaux contre l'adversaire (déterministe). Gagné → le paquet est réduit à 0 ; perdu → la carte est détruite (auto-infligée, sans XP adverse).",
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
    id: "buff-all-turn",
    label: "Buff de masse (Force + mot-clé, tour)",
    category: "tempo",
    glossary:
      "Toutes les créatures correspondant aux filtres gagnent +N en Force et un mot-clé de combat jusqu'à la fin du tour, sans choix du joueur.",
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
    id: "cost-mill-top",
    label: "Coût : défausse du sommet de la Pioche",
    category: "autre",
    glossary:
      "Coût d'un pouvoir : défaussez la (ou les N) première(s) carte(s) du sommet de votre Pioche (mill déterministe, sans choix) pour payer l'effet.",
  },
  {
    id: "cost-pay-x",
    label: "Coût variable X",
    category: "autre",
    glossary:
      "Coût variable « X : … » : le joueur paie X Ressources (X au choix, 0..producteurs disponibles) en inclinant X de ses cartes productrices ; X pilote la magnitude du corps (Dommages/soin/Niveau de la cible…).",
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
    id: "look-top",
    label: "Regard sur la Pioche",
    category: "ressource",
    glossary:
      "Regardez les premières cartes de votre Pioche, prenez-en une en main et recyclez le reste sous la Pioche.",
  },
  {
    id: "team-power-damage-boost",
    label: "Pouvoirs d'Alliés renforcés",
    category: "dégâts",
    glossary:
      "Jusqu'à la fin du tour, les Dommages infligés par les pouvoirs de vos Alliés sont augmentés (appliqué par paquet de Dommages, avant Résistance — les Dommages de combat et les pertes directes de PV ne sont pas concernés).",
  },
  {
    id: "remove-from-combat",
    label: "Retrait du combat",
    category: "contrôle",
    glossary:
      "La cible (attaquant ou bloqueur du combat en cours) cesse de participer au combat et revient inclinée dans le Monde — elle n'inflige ni ne subit les Dommages de la résolution.",
  },
  {
    id: "grant-bonus-block",
    label: "Bloqueur bonus (au-delà des PM)",
    category: "contrôle",
    glossary:
      "Accorde un bloqueur supplémentaire au-delà de la limite de PM pour le combat en cours (Bond) ; le joueur déclare ensuite ce bloqueur via l'interface de blocage habituelle (légalité Agilité conservée).",
  },
  {
    id: "riposte-bearer",
    label: "Riposte du Porteur",
    category: "dégâts",
    glossary:
      "Quand une créature inflige des Dommages au Porteur de cet Équipement, ce dernier lui riposte des Dommages (à la créature qui a frappé). Seuls un Allié ou un Héros déclenchent la riposte — pas une autre riposte (pas de boucle).",
  },
  {
    id: "cost-tap-resource",
    label: "Coût : production d'une Ressource",
    category: "ressource",
    glossary:
      "Coût d'un pouvoir (« payer pour … ») : inclinez une carte contrôlée dressée (Monde ou Havre-Sac, sauf Protecteur) pour produire et dépenser une Ressource (rulebook 4261). Aucune réserve stockée : la Ressource est produite et dépensée dans le même geste.",
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
  distributeDamage: "distribute-damage",
  damageTargetByForce: "damage-target-by-force",
  eachPlayerDraws: "each-player-draws",
  healHeroTarget: "heal-hero-target",
  buffForceTarget: "buff-force-target",
  buffForceMultiTarget: "buff-force-target",
  buffForceSelf: "buff-force-self",
  incTurnCounterSelf: "inc-turn-counter-self",
  incHeroTurnToken: "inc-hero-turn-token",
  recycleFromDiscard: "recycle-from-discard",
  discardFromHand: "discard-from-hand",
  searchDeck: "search-deck",
  putInPlay: "put-in-play",
  putSelfInPlay: "put-in-play",
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
  setMetierSelf: "set-metier-self",
  duelTapDuelist: "duel-challenge",
  duelChooseChallenged: "duel-challenge",
  duelOffer: "duel-challenge",
  resolveDuel: "duel-challenge",
  cancelLastPlayed: "cancel-last-played",
  chifumiPrevention: "chifumi-prevention",
  grantKeywordBearerSelf: "grant-keyword-bearer-self",
  grantKeywordTarget: "grant-keyword-target",
  grantResistanceSelf: "grant-resistance-self",
  grantResistanceTarget: "grant-resistance-target",
  buffForceAlliesMondeTurn: "buff-force-allies-monde",
  globalDamageShield: "global-damage-shield",
  teamCombatDmgReduction: "team-combat-dmg-reduction",
  tapTarget: "tap-target",
  untapTarget: "untap-target",
  damageRiposteSource: "riposte-bearer",
  removeFromCombatTarget: "remove-from-combat",
  grantBonusBlock: "grant-bonus-block",
  buffTeamPowerDamageTurn: "team-power-damage-boost",
  lookTopPick: "look-top",
  tapMultiTarget: "tap-target",
  untapMultiTarget: "untap-target",
  returnToHand: "return-to-hand",
  tapAll: "tap-all",
  buffAllTurn: "buff-all-turn",
  untapAll: "untap-all",
  damageAll: "damage-all",
  destroyAll: "destroy-all",
  costTapControlled: "cost-tap-controlled",
  costDestroyControlled: "cost-destroy-controlled",
  costDiscard: "cost-discard",
  costDiscardSelf: "cost-discard",
  costMillTop: "cost-mill-top",
  costPayX: "cost-pay-x",
  costRecycle: "cost-recycle",
  costRecycleControlled: "cost-recycle-controlled",
  costTapResource: "cost-tap-resource",
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
