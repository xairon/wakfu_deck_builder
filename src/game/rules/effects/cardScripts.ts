/**
 * REGISTRE DE SCRIPTS MANUELS — l'approche « XMage » : les cartes dont le
 * texte dépasse la grammaire stricte du DSL sont scriptées ici À LA MAIN,
 * carte par carte, avec les ops existantes. Le script de compilation
 * (`npm run compile-effects`) applique ces entrées APRÈS l'auto-compilation
 * (l'entrée manuelle gagne), donc elles finissent dans `effects[].compiled`
 * des données comme les autres.
 *
 * Clé : id de carte → index d'effet → forme compilée.
 * Backlog : docs/AUDIT-STARTERS.md (verticale « bêta 2 decks starter »).
 * Règle d'or : ne scripter que ce que les ops expriment FIDÈLEMENT —
 * une approximation de gameplay est pire qu'un effet manuel.
 */
import type { CompiledEffect } from "@/types/cards";

/**
 * Une entrée `{ kind }` ne compile rien : elle classe l'effet comme note de
 * règle / errata du site (exclu du comptage des effets imprimés). À n'utiliser
 * que si l'auto-détection via `notes[]` du pipeline ne suffit pas.
 */
export type CardScriptEntry = CompiledEffect | { kind: "ruling" | "errata" };

export const CARD_SCRIPTS: Record<string, Record<number, CardScriptEntry>> = {
  // « Le Léopardo gagne +3 en Force [.] jusqu'à la fin du tour.
  //   N'utilisez ce pouvoir qu'une seule fois par tour. »
  // → pouvoir activé : l'inclinaison garantit l'unique utilisation par tour.
  "leopardo-incarnam": {
    0: { trigger: "onTap", ops: [{ op: "buffForceSelf", n: 3 }] },
  },
  // « Les Mines d'Astrub apparaissent inclinées. »
  "mines-d-astrub-incarnam": {
    1: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },
  // « [Inclinaison :] Le Monstre de votre choix gagne +2 en Force
  //   jusqu'à la fin du tour. » (requiresIncline dans les données)
  "demi-finame-incarnam": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
  // Errata officiel : « Au début de votre tour, recyclez une carte [Feu]
  // de votre Défausse ou détruisez le Chacha Noir. » — l'icône [Feu] a été
  // perdue au scraping (vérifié sur raw-card-data/pages/incarnam).
  "chacha-noir-incarnam": {
    0: {
      trigger: "onTurnStart",
      orElse: "destroySelf",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Feu" }],
    },
  },
  // « Au début de votre tour, recyclez une carte [Terre] … ou détruisez
  // les Forêts d'Astrub. » + « Les Forêts d'Astrub apparaissent inclinés. »
  "forets-d-astrub-incarnam": {
    0: {
      trigger: "onTurnStart",
      orElse: "destroySelf",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Terre" }],
    },
    1: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },
  // « Au début de votre tour, recyclez une carte [Terre] … ou détruisez le
  // Marcassin. » (« Le Porteur gagne Géant » attend le modèle Porteur, lot F)
  "marcassin-incarnam": {
    0: {
      trigger: "onTurnStart",
      orElse: "destroySelf",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Terre" }],
    },
  },

  // ── Tranche W8 : moisson d'effets imprimés FIDÈLEMENT cartographiables ──

  // « L'Allié de votre choix retourne dans la main de son propriétaire. »
  // → Action (onPlay) ; renvoi en main du propriétaire (502/501.2).
  "repulsion-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "returnToHand", heroes: false, zones: ["monde", "havreSac"] },
      ],
    },
  },

  // « [Inclinaison :] Le Nommon inflige 1 Dommage à l'Allié ou Héros de votre
  //   choix. » — Arme Neutre, élément de la source = Neutre.
  "nomoon-incarnam": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « [Inclinaison :] Le Monstre de votre choix gagne +2 en Force jusqu'à la
  //   fin du tour. » (jumeau de demi-finame-incarnam)
  "demi-finame-dofus-collection": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « [Inclinaison :] Le Bandit de votre choix gagne +3 en Force jusqu'à la
  //   fin du tour. »
  "eratz-le-revendicateur-incarnam": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 3,
          heroes: false,
          sub: "bandit",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « [Inclinaison :] L'Allié Gelée de votre choix gagne +2 en Force jusqu'à la
  //   fin du tour. »
  "gelee-menthe-dofus-collection": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "gelee",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
  "gelee-menthe-incarnam": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "gelee",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « [Inclinaison :] Le Champion de votre choix gagne +2 en Force jusqu'à la
  //   fin du tour. » (Familier — pouvoir d'inclinaison)
  "mini-champion-chaos-dogrest": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "buffForceTarget",
          n: 2,
          heroes: false,
          sub: "champion",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Quand Clara Byne apparaît, elle inflige 1 Dommage à l'Allié ou Héros de
  //   votre choix. » — élément de la source = Feu.
  "clara-byne-bonta-brakmar": {
    0: {
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Quand l'Aiguille gluante arrive en jeu, elle inflige 1 Dommage à l'Allié
  //   ou Héros de votre choix. » — Arme Neutre.
  "aiguille-gluante-incarnam": {
    0: {
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Quand Bworkasse le Dégoûtant apparaît dans le Monde, il inflige 2
  //   Dommages à l'Allié ou Héros de votre choix. » — élément source = Feu ;
  //   « dans le Monde » qualifie son apparition, pas la zone de la cible.
  "bworkasse-le-degoutant-otomai": {
    0: {
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Cherchez une carte Équipement dans votre Pioche, révélez-la et prenez-la
  //   en main, puis mélangez votre Pioche. » — Action.
  "la-derniere-mode-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Équipement", dest: "main" },
        { op: "shuffleDeck" },
      ],
    },
  },

  // « Cherchez une carte Zone dans votre Pioche et mettez-la en jeu, puis
  //   mélangez votre Pioche. » — Action.
  "vacances-sur-l-ile-de-moon-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Zone", dest: "monde" },
        { op: "shuffleDeck" },
      ],
    },
  },

  // ── Tranche W10 : seconde moisson (formulations que le DSL strict rate) ──

  // « Quand les Mégabottes apparaissent, vous pouvez piocher une carte. »
  //   onArrive optionnel — le DSL singulier ne capte pas « apparaissent »
  //   (sujet pluriel) ; corps « vous pouvez piocher » → draw optionnel.
  "megabottes-amakna": {
    0: { trigger: "onArrive", optional: true, ops: [{ op: "draw", n: 1 }] },
  },

  // « Les Calanques d'Astrub apparaissent inclinés. » — jumeau de
  //   forets-d-astrub : entrée en jeu inclinée (tapSelf). Le DSL ne reconnaît
  //   pas la forme « <carte> apparaissent inclinés » (pas un déclencheur
  //   « Quand … »).
  "calanques-d-astrub-incarnam": {
    1: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },
  "champs-d-astrub-incarnam": {
    1: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },

  // « [Inclinaison :] La Pelle Ikan inflige 2 Dommages au Monstre de votre
  //   choix. » — Arme Neutre. « au Monstre » = Allié de Famille Monstre
  //   (heroes:false) ; le DSL ne gère que « à l'Allié … ».
  "pelle-ikan-astrub": {
    0: {
      trigger: "onTap",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Neutre",
          heroes: false,
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Cherchez une carte Arme dans votre Pioche, révélez-la et prenez-la en
  //   main, puis mélangez votre Pioche. » — Action. « carte Arme » = Équipement
  //   de Famille Arme (l'Arme est exclusivement un sous-type d'Équipement) ; le
  //   DSL ne capte que les types racines (« Équipement »), pas « Arme » seul.
  "premieres-armes-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Équipement", sub: "arme", dest: "main" },
        { op: "shuffleDeck" },
      ],
    },
  },

  // « Cherchez une Dragodinde dans votre Pioche, révélez-la et prenez-la en
  //   main, puis mélangez votre Pioche. » — Action. Dragodinde = Famille
  //   d'Allié (exclusivement). L'effet ciblé est l'index 1 (#0 = réduction de
  //   coût conditionnelle, laissée manuelle).
  "certificat-de-monture-pandala": {
    1: {
      trigger: "onPlay",
      ops: [
        { op: "searchDeck", what: "Allié", sub: "dragodinde", dest: "main" },
        { op: "shuffleDeck" },
      ],
    },
  },

  // « [Inclinaison :] Cherchez un Chevalier dans votre Pioche, révélez-le et
  //   prenez-le en main, puis mélangez votre Pioche. » Chevalier = Famille
  //   d'Allié (exclusivement). Le DSL exige « un Allié Chevalier ».
  "galgarion-pandala": {
    0: {
      trigger: "onTap",
      ops: [
        { op: "searchDeck", what: "Allié", sub: "chevalier", dest: "main" },
        { op: "shuffleDeck" },
      ],
    },
  },

  // « Détruisez l'Équipement, la Zone ou le Dofus de votre choix. » — Action ;
  //   destruction multi-type à TROIS types (le DSL n'en gère que deux). Sans
  //   clause « dans un Havre-Sac », la cible est dans le Monde (convention
  //   destroyTarget).
  "apparition-d-ogrest-bonta-brakmar": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "destroyTarget",
          whatAny: ["Équipement", "Zone", "Dofus"],
          zones: ["monde"],
        },
      ],
    },
  },

  // « Détruisez la Zone ou l'Équipement de Niveau inférieur ou égal à 2 de
  //   votre choix. » — Action ; destruction multi-type + filtre de Niveau (la
  //   contrainte ≤ 2 porte sur les deux types ; une carte sans Niveau est
  //   inéligible).
  "faveur-de-la-deesse-pandawa-pandala": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "destroyTarget",
          whatAny: ["Zone", "Équipement"],
          maxLevel: 2,
          zones: ["monde"],
        },
      ],
    },
  },

  // ── Tranche W11 : moisson via filtres orientation/combatRole (sujet pronom) ──

  // « Quand Emy Lijoly apparaît, elle inflige 2 Dommages à l'Allié ou au Héros
  //   incliné de votre choix. » — onArrive ; le DSL ne lie pas le pronom
  //   « elle » au sujet. Élément source = Feu ; filtre orientation tapped.
  "emy-lijoly-chaos-dogrest": {
    0: {
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Feu",
          heroes: true,
          orientation: "tapped",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Quand Qil Bil apparaît, il peut infliger 3 Dommages à l'Allié ou Héros
  //   incliné de votre choix. » — onArrive OPTIONNEL (« peut »), sujet pronom
  //   « il ». Élément source = Feu ; orientation tapped. L'effet ciblé est
  //   l'index 1 (#0 = mot-clé Géant). Deux impressions (Astrub / Collection).
  "qil-bil-astrub": {
    1: {
      trigger: "onArrive",
      optional: true,
      ops: [
        {
          op: "damageTarget",
          n: 3,
          element: "Feu",
          heroes: true,
          orientation: "tapped",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
  "qil-bil-dofus-collection": {
    1: {
      trigger: "onArrive",
      optional: true,
      ops: [
        {
          op: "damageTarget",
          n: 3,
          element: "Feu",
          heroes: true,
          orientation: "tapped",
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
};
