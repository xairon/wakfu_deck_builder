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
};
