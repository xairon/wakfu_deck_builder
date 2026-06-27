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
    id: "damage-target",
    label: "Dégâts ciblés",
    category: "dégâts",
    glossary: "Inflige des Dommages à un Allié ou Héros ciblé.",
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
    id: "tap-self",
    label: "Inclinaison (soi)",
    category: "tempo",
    glossary: "Incline la carte source.",
  },
  {
    id: "combat-mod-self",
    label: "Modificateur de combat (soi)",
    category: "tempo",
    glossary: "Bonus de combat (Force/PM/Géant) jusqu'à la fin du combat.",
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
];

/** op compilée → mécanique (déterministe, 1:1). */
export const OP_TO_MECHANIC: Record<CompiledEffectOp["op"], MechanicTag> = {
  gainXp: "gain-xp",
  draw: "draw",
  heroGainPv: "hero-gain-pv",
  heroLosePv: "hero-lose-pv",
  damageOppHero: "damage-opp-hero",
  havreSacGainResistance: "bag-gain-resistance",
  destroyTarget: "destroy-target",
  damageTarget: "damage-target",
  damageTargetByForce: "damage-target-by-force",
  eachPlayerDraws: "each-player-draws",
  healHeroTarget: "heal-hero-target",
  buffForceTarget: "buff-force-target",
  buffForceSelf: "buff-force-self",
  recycleFromDiscard: "recycle-from-discard",
  discardFromHand: "discard-from-hand",
  searchDeck: "search-deck",
  shuffleDeck: "shuffle-deck",
  destroySelf: "destroy-self",
  loseStatTurn: "lose-stat-turn",
  tapSelf: "tap-self",
  combatModSelf: "combat-mod-self",
  buffForceAlliesMondeTurn: "buff-force-allies-monde",
  globalDamageShield: "global-damage-shield",
  tapTarget: "tap-target",
  untapTarget: "untap-target",
  returnToHand: "return-to-hand",
};

/** Tags uniques dérivés d'une liste d'ops, dans l'ordre d'apparition. */
export function mechanicsForOps(
  ops: { op: CompiledEffectOp["op"] }[],
): MechanicTag[] {
  return [...new Set(ops.map((o) => OP_TO_MECHANIC[o.op]))];
}
