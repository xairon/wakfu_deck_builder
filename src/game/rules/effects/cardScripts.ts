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
  // « Placez l'un de vos Alliés ou Héros en bloqueur devant l'Allié ou Héros
  //   attaquant de votre choix. » (Bond, Action jouée par le défenseur en fenêtre
  //   de réaction) → accorde 1 bloqueur BONUS au-delà des PM (grantBonusBlock) ;
  //   le joueur déclare ensuite ce bloqueur via l'UI de blocage (légalité Agilité
  //   704 conservée par eligibleBlockers). Le DSL ne gère pas la manipulation de
  //   combat → script direct.
  "bond-incarnam": {
    0: { trigger: "onPlay", ops: [{ op: "grantBonusBlock", n: 1 }] },
  },
  // « Réaction. La Flèche d'Immolation inflige 2 Dommages [Feu] à l'Allié ou Héros
  //   qui vient de s'incliner. » — Action de RÉACTION (jouée par le défenseur en
  //   fenêtre de réaction, juste après la déclaration d'attaque). Cible restreinte
  //   aux créatures portant `justInclined` (attaquants s'inclinant à la
  //   déclaration) via le filtre `recentlyInclined`. Élément EXPLICITE (Feu).
  "fleche-d-immolation-incarnam": {
    0: {
      trigger: "onPlay",
      reactionOnly: true,
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Feu",
          explicitElement: true,
          recentlyInclined: true,
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
  // « Jusqu'à la fin de la phase d'action, chaque fois qu'un Allié ou Héros
  //   attaquant ou bloqueur s'incline dans ce combat, le Glyphe Incandescent lui
  //   inflige 2 Dommages [Feu]. » — Action posant un MARQUEUR FLOTTANT
  //   `glypheDamage` sur le Héros (jeton turn-scoped = « fin de la phase d'action »).
  //   glypheFrames (bus attackerDeclared) inflige 2 Feu à chaque attaquant qui
  //   s'incline (déclaration). Le DSL ne gère pas les effets flottants → script.
  "glyphe-incandescent-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [{ op: "incHeroTurnToken", token: "glypheDamage", n: 1 }],
    },
  },
  // « [Terre] : Katsou Mee gagne +1 en Force jusqu'à la fin du tour. Si vous
  //   dépensez plus de [Terre][Terre][Terre] de cette façon, détruisez Katsou Mee
  //   à la fin du tour. » — pouvoir RÉPÉTABLE : payer 1 Terre → +1 Force, +1 au
  //   compteur de dépense `katsouSpend`. À la 4e utilisation (spend ≥ 4 = « plus
  //   de 3 »), pose le flag `destroyAtTurnEnd` → un balayage de fin de tour
  //   (turnEndDestroyEvents) détruit fidèlement Katsou (Défausse + XP). Le DSL ne
  //   gère ni le compteur ni le seuil → script direct.
  "katsou-mee-incarnam": {
    0: {
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Terre" },
        { op: "buffForceSelf", n: 1 },
        { op: "incTurnCounterSelf", counter: "katsouSpend" },
        {
          op: "conditional",
          cond: { cond: "selfCounterAtLeast", counter: "katsouSpend", n: 4 },
          ops: [{ op: "incTurnCounterSelf", counter: "destroyAtTurnEnd" }],
        },
      ],
    },
  },
  // « Réaction. [Incliner] : Gagnez 1 XP. Ne jouez ce pouvoir que lorsque vous
  //   venez de jouer une carte Quête ou Parchemin. » (Fécaline la Sage) —
  //   pouvoir-tap gagnant 1 XP, GATÉ par une restriction de RÉCENCE de jeu
  //   (playCondition recentlyPlayedQuestParch, jugée à l'activation par
  //   powerConditionReason ; jeton posé par playFromHand). Le DSL ne gère pas la
  //   récence de jeu → script direct.
  "fecaline-la-sage-incarnam": {
    0: {
      trigger: "onTap",
      playCondition: { cond: "recentlyPlayedQuestParch" },
      ops: [{ op: "gainXp", n: 1 }],
    },
  },
  // « Détruisez un de vos Tofus : Mettez en jeu le Polter Tofu gratuitement de
  //   votre main. Il apparaît incliné. » — pouvoir ACTIVÉ DEPUIS LA MAIN
  //   (onHandActivate) : coût = détruire un de vos Tofus (costDestroyControlled,
  //   sub Tofu, hors la source qui est en main) ; effet = putSelfInPlay incliné.
  //   Le DSL ne gère pas l'activation-en-main → script direct. « Vous pouvez
  //   utiliser ce pouvoir à chaque moment où vous pourriez jouer une Action »
  //   (ruling [1]) → gate tour/réaction dans activateTapPower.
  "polter-tofu-incarnam": {
    0: {
      trigger: "onHandActivate",
      cost: "paidOps",
      ops: [
        {
          op: "costDestroyControlled",
          sub: "tofu",
          excludeSource: true,
          zones: ["monde", "havreSac"],
        },
        { op: "putSelfInPlay", tapped: true },
      ],
    },
  },
  // « Réaction. Quand un de vos Tofus est détruit, vous pouvez payer [Air][Air]
  //   pour mettre en jeu le Tofu Céleste de votre main. Il apparaît incliné. »
  //   (icône [Air][Air] récupérée du raw) — DÉCLENCHÉ DEPUIS LA MAIN
  //   (onControlledDestroyedFromHand, watchSub tofu) : quand un Tofu contrôlé est
  //   détruit, offre OPTIONNELLE (« vous pouvez ») de payer 2 Air (costTapResource
  //   ×2, W64) puis putSelfInPlay incliné (W66). effect[0] = Géant (keyword).
  "tofu-celeste-incarnam": {
    1: {
      trigger: "onControlledDestroyedFromHand",
      watchSub: "tofu",
      optional: true,
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Air" },
        { op: "costTapResource", element: "Air" },
        { op: "putSelfInPlay", tapped: true },
      ],
    },
  },
  // Léopardo : script SUPPRIMÉ (2026-07-10) — écrit sur un texte au <strong>
  // perdu, devenu INFIDÈLE après récupération (« [Neutre][Neutre] : Le
  // Léopardo gagne +3 en Force et Géant … une seule fois par tour ») : coût de
  // 2 Ressources non facturé, Géant absent, inclinaison supposée à tort. La
  // grammaire DSL (coûts-icônes nus + alsoKeyword + oncePerTurn) compile
  // désormais le texte réparé fidèlement.
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
  // « Quand le Grand Shushu Craquelé apparaît, il inflige 2 Dommages à l'Allié de
  //   votre choix. » — déclenché d'apparition de SOI (« il » = la carte). Sujet
  //   = la source (onArrive fournit déjà sourceId = l'instance qui apparaît) ;
  //   « à l'Allié » (pas « ou Héros ») → heroes:false. Élément Feu (Force/Niveau).
  "grand-shushu-craquele-bonta-brakmar": {
    1: {
      trigger: "onArrive",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Feu",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // ── Tranche W20 : moisson via recherche-Défausse d'un sous-type d'Équipement ──

  // « Cherchez une carte Familier dans votre Défausse et prenez-la main. » —
  //   Action. « Familier » est EXCLUSIVEMENT un sous-type d'Équipement (comme
  //   « Arme » pour premieres-armes) ; le DSL ne capte que les types racines via
  //   pickType, donc « Familier » seul reste manuel → script. La Défausse n'est
  //   pas mélangée (pas de shuffleDeck). « prenez-la main » (typo de scrape, sans
  //   « en ») = prise en main.
  "poudre-d-eniripsa-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "searchDeck",
          what: "Équipement",
          sub: "familier",
          from: "defausse",
          dest: "main",
        },
      ],
    },
  },

  // ── Tranche « harvest-final » : créatures-jetons « Mettez [self] en jeu comme
  //   un Monstre … de Force N [Élément] » (Action → onPlay createToken) ──
  //   L'icône d'Élément de la créature a été PERDUE au scraping (la description
  //   se termine par « de Force N . ») — RÉCUPÉRÉE verbatim depuis raw-card-data
  //   (jamais devinée). Le jeton est une carte SYNTHÉTIQUE : participant de combat
  //   à part entière, sans effet d'apparition (fidèle — createToken). Le `name`
  //   conserve la forme imprimée « Monstre - <Nom> » (jetons portant le même nom).
  //   Les AUTRES effets de ces cartes (réactions/statiques sur le jeton) restent
  //   des index distincts non couverts (le jeton ne les porte pas — limite connue).

  // « … comme un « Monstre — Aiguille Chercheuse » de Force 1 [Feu]. »
  "aiguille-chercheuse-amakna": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Aiguille Chercheuse",
          force: 1,
          element: "Feu",
          sub: "Aiguille Chercheuse",
        },
      ],
    },
  },
  // « … dans le Monde comme un « Monstre — Coffre » de Force 1 [Eau]. »
  "coffre-anime-amakna": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Coffre",
          force: 1,
          element: "Eau",
          sub: "Coffre",
        },
      ],
    },
  },
  // « … comme un « Monstre — Épée » de Force 1 [Air]. »
  "epee-volante-amakna": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Épée",
          force: 1,
          element: "Air",
          sub: "Épée",
        },
      ],
    },
  },
  // « … dans le Monde comme un « Monstre — Chaton » de Force 2 [Air]. »
  "griffe-invocatrice-amakna": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Chaton",
          force: 2,
          element: "Air",
          sub: "Chaton",
        },
      ],
    },
  },
  // « … dans le Monde comme un « Monstre — Lapin » de Force 1 [Feu]. »
  "mot-d-amitie-amakna": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Lapin",
          force: 1,
          element: "Feu",
          sub: "Lapin",
        },
      ],
    },
  },
  // « … dans le Monde comme un Monstre de Force 4 [Terre]. » (sans Famille → name
  //   « Monstre », pas de sub)
  "la-bloqueuse-astrub": {
    0: {
      trigger: "onPlay",
      ops: [{ op: "createToken", name: "Monstre", force: 4, element: "Terre" }],
    },
  },
  // « … comme un « Monstre — Balise » de Force 1 [Feu]. »
  "balise-ardente-bonta-brakmar": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Balise",
          force: 1,
          element: "Feu",
          sub: "Balise",
        },
      ],
    },
  },
  // « … comme un "Monstre - Dragonnet" de Force 5 [Feu]. »
  "invocation-de-dragonnet-otomai": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Dragonnet",
          force: 5,
          element: "Feu",
          sub: "Dragonnet",
        },
      ],
    },
  },

  // « Goultard le Barbare apparaît incliné dans le Monde. » — entrée en jeu
  //   inclinée (onArrive → tapSelf), jumeau de mines-d-astrub / forets-d-astrub
  //   (« apparaissent inclinés »). Le DSL ne reconnaît pas cette forme (le sujet
  //   est la carte, sans déclencheur « Quand … »).
  "goultard-le-barbare-incarnam": {
    0: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },

  // ── Prototype « authoring par lot » (2026-07-01) : reliquat 100 %-sûr du
  //   patron « <self> apparaît/apparaissent incliné(e/s) » → onArrive tapSelf
  //   (jumeaux de goultard/mines/forets). Mesure : ce patron sûr est désormais
  //   quasi épuisé (3 restants) ; le reste des uncovered exige du vocabulaire
  //   moteur manquant, pas de l'authoring — cf. doc SOTA (accélérateur LLM utile
  //   surtout pour la queue « phrasé raté » + le backlog de mécaniques manquantes).
  "industrie-magique-chaos-dogrest": {
    0: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },
  "goultard-le-barbare-dofus-collection": {
    0: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },
  "ile-des-wabbits-ile-des-wabbits": {
    0: { trigger: "onArrive", ops: [{ op: "tapSelf" }] },
  },

  // ── Deck-driven (starters Incarnam) ──
  // « Quand le Tofu Mutant est détruit, il inflige 1 Dommage à l'Allié ou Héros
  //   de votre choix. » — onSelfDestroyed ; « il » = la source détruite (sourceId
  //   fourni par le bus), Dommages de l'Élément de la source (Air). Le DSL ne lie
  //   pas le pronom « il » au sujet → script direct.
  "tofu-mutant-incarnam": {
    0: {
      trigger: "onSelfDestroyed",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Air",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « [Incliner], [Air] : Guy Yomtella inflige 1 Dommage [Air] à l'Allié de
  //   votre choix. » — coûts RÉCUPÉRÉS verbatim du raw (W52 : le scrape avait
  //   perdu « , [Air] » et le compilé auto SOUS-FACTURAIT → démouvu). Pouvoir à
  //   COÛT COMPOSÉ : inclinaison de soi (requiresIncline → flag tapsSource sur
  //   le chemin paidOps, comme Amulette Akwadala) + paiement d'1 Ressource AIR
  //   (costTapResource{element:"Air"} — le filtre d'Élément W45, 1ʳᵉ utilisation).
  //   Guy, inclinée par l'activation, ne peut pas payer l'Air elle-même (déjà
  //   inclinée → hors resourceProducers) : le payeur naturel est un producteur
  //   Air (ex. Piou Jaune, production colorée W46). La garde coût-ressource-
  //   impayable d'activateTapPower refuse AVANT de consommer l'inclinaison si
  //   aucun producteur Air n'est disponible. L'effet [1] (« [Air][Air] :
  //   Redressez Guy Yomtella. », 2ᵉ pouvoir SANS incliner) reste manuel : le
  //   pipeline n'a pas de voie d'activation payée sans inclinaison.
  // pwr0 « [Incliner], [Air] : … inflige 1 Dommage [Air] … » (tapsSource + coût
  //   Air). pwr1 « [Air][Air] : Redressez Guy Yomtella. » = SECOND pouvoir onTap,
  //   coût 2 Air SANS inclinaison (n'incline pas la source → activable une fois
  //   Guy incliné, redresse-soi). activateTapPower choisit pwr1 quand Guy est
  //   incliné (pwr0 exige d'être dressé). Coût 2 Air = deux costTapResource en
  //   tête (garde de payabilité par séquence dans activateTapPower).
  "guy-yomtella-incarnam": {
    0: {
      trigger: "onTap",
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costTapResource", element: "Air" },
        {
          op: "damageTarget",
          n: 1,
          element: "Air",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    },
    1: {
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Air" },
        { op: "costTapResource", element: "Air" },
        { op: "untapSelf" },
      ],
    },
  },
  "guy-yomtella-dofus-collection": {
    0: {
      trigger: "onTap",
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costTapResource", element: "Air" },
        {
          op: "damageTarget",
          n: 1,
          element: "Air",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    },
    1: {
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Air" },
        { op: "costTapResource", element: "Air" },
        { op: "untapSelf" },
      ],
    },
  },

  // « [Incliner], X[Neutre] : Détruisez l'Équipement de Niveau X de votre choix. »
  //   — coûts RÉCUPÉRÉS verbatim du raw (W60 : le scrape avait perdu « [Incliner], »
  //   et « [Neutre] », l'incarnam ne gardait que « X : … » et dofus-collection rien
  //   du coût). Pouvoir à COÛT COMPOSÉ : inclinaison de soi (tapsSource, comme
  //   Yomtella) + coût VARIABLE X (costPayX — le joueur incline X producteurs, X =
  //   boundCount). Le corps détruit un Équipement de Niveau EXACTEMENT X
  //   (destroyTarget{exactLevelFromCount} — exactLevel figé au boundCount à
  //   l'ouverture du ciblage). X=0 est légal (aucun Équipement de Niveau 0 →
  //   no-op). Merelyne, inclinée par l'activation, est hors resourceProducers →
  //   ne peut pas se payer elle-même. Effet [1] (index 0 = trait « Forgeron »).
  "merelyne-manro-incarnam": {
    1: {
      trigger: "onTap",
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costPayX" },
        {
          op: "destroyTarget",
          what: "Équipement",
          exactLevelFromCount: true,
          zones: ["monde"],
        },
      ],
    },
  },
  "merelyne-manro-dofus-collection": {
    1: {
      trigger: "onTap",
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costPayX" },
        {
          op: "destroyTarget",
          what: "Équipement",
          exactLevelFromCount: true,
          zones: ["monde"],
        },
      ],
    },
  },

  // « L'Assassin Grouilleux inflige un nombre de Dommages égal au Niveau d'un
  //   autre Allié Grouilleux qui vient d'apparaître à l'Allié ou Héros de votre
  //   choix. » — pouvoir à inclinaison (W79). DOUBLE RÉFÉRENT : magnitude =
  //   Niveau du Grouilleux marqué justAppeared (≠ la source, « un AUTRE » —
  //   appearedLevelMagnitude, évaluée à la résolution), cible = choix du
  //   joueur. GATE d'activation playCondition allyJustAppeared{sub, other}
  //   (l'inclinaison n'est pas brûlée sans référent). Élément Air (liveSource
  //   le recalcule sur la source vivante, fidèle 410.1).
  "assassin-grouilleux-bonta-brakmar": {
    0: {
      trigger: "onTap",
      playCondition: {
        cond: "allyJustAppeared",
        sub: "grouilleux",
        other: true,
      },
      ops: [
        {
          op: "damageTarget",
          n: 0,
          appearedLevel: { sub: "grouilleux" },
          element: "Air",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « Gagnez un nombre d'XP égal à la valeur d'XP de l'Allié qui vient
  //   d'apparaître depuis votre Défausse. » + « Ne jouez Échappé des Glaces que
  //   lorsqu'un de vos Alliés vient d'apparaître depuis votre Défausse. » —
  //   Action (W78). PROVENANCE d'apparition : le marqueur justAppeared (W74)
  //   est doublé de justAppearedFromDefausse quand l'entrée en jeu vient de la
  //   Défausse. Effet [0] = gainXpOfAppeared{fromDiscard} (non-interactif : XP
  //   = valeur d'XP du référent) ; effet [1] = la RESTRICTION seule
  //   (playCondition allyJustAppearedFromDiscard, gate whyCannotPlay, ops
  //   vides). Scripté : le DSL ne modélise ni la provenance ni la restriction
  //   à double jeton.
  "echappe-des-glaces-bonta-brakmar": {
    0: {
      trigger: "onPlay",
      ops: [{ op: "gainXpOfAppeared", fromDiscard: true }],
    },
    1: {
      trigger: "onPlay",
      playCondition: { cond: "allyJustAppearedFromDiscard" },
      ops: [],
    },
  },

  // « Votre Héros regagne X PV. Ne jouez cette carte que si votre Héros se
  //   trouve dans son Havre-Sac. » — Action à COÛT VARIABLE X (« Niveau : X »
  //   au raw). Le X payé (costPayX — incliner X producteurs) est soigné en PV au
  //   Héros (heroGainPv{fromCount} = boundCount). RESTRICTION DE JEU : la carte
  //   n'est jouable que si votre Héros est dans son Havre-Sac (playCondition
  //   heroInZone, évaluée au play-time par whyCannotPlay). Le DSL ne gère ni le X
  //   payé à la mise en jeu ni la restriction → script direct.
  "repos-incarnam": {
    0: {
      trigger: "onPlay",
      playCondition: { cond: "heroInZone", zone: "havreSac" },
      ops: [{ op: "costPayX" }, { op: "heroGainPv", n: 0, fromCount: true }],
    },
  },

  // « La Force de l'Allié ou Héros de votre choix est doublée jusqu'à la fin du
  //   tour. Vous ne pouvez jouer qu'un seul Coup critique sur le même Allié ou
  //   Héros par tour. » — Action. Le DOUBLEMENT = buffForceTarget{doubleForce}
  //   (magnitude = Force effective de la cible À LA RÉSOLUTION → +Force → total
  //   ×2). La restriction « un seul … sur le même … par tour » = markTurnToken
  //   "coupCritique" (jeton turn-scoped posé sur la cible ; l'éligibilité exclut
  //   ensuite cette cible ce tour). Scriptée (la restriction se réfère à la carte
  //   par son nom + le doublement dynamique dépasse le DSL). 2 éditions.
  "coup-critique-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "buffForceTarget",
          n: 0,
          doubleForce: true,
          markTurnToken: "coupCritique",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },
  "coup-critique-dofus-collection": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "buffForceTarget",
          n: 0,
          doubleForce: true,
          markTurnToken: "coupCritique",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    },
  },

  // « La colère de Iop inflige X Dommages répartis librement entre les Alliés ou
  //   Héros attaquants ou bloqueurs de votre choix. » — Action à coût variable
  //   « Niveau : X ». Le X payé (costPayX — incliner X producteurs) est ensuite
  //   RÉPARTI librement (distributeDamage) entre les cibles de combat (≥1
  //   chacune, répétables, appliqué en bloc). Élément imprimé = Terre. X=0 →
  //   no-op (jouable hors combat, ruling). Le DSL ne gère ni le X ni la
  //   répartition → script direct.
  "colere-de-iop-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "costPayX" },
        {
          op: "distributeDamage",
          element: "Terre",
          heroes: true,
          combatRole: "inCombat",
          zones: ["monde", "havreSac"],
          fromCount: true,
        },
      ],
    },
  },

  // ── Amar Casto (W72) — « gagne le Métier de votre choix jusqu'à la fin du tour »
  // À l'apparition (onPlay), le joueur choisit l'un des 4 Métiers (chooseOne à 4
  // branches, W56) ; la branche pose setMetierSelf → jeton metier_<métier> sur Amar
  // Casto, qui devient Artisan pour le tour (metierOf / selfIsArtisan). Deux éditions
  // (le texte dofus-collection a perdu le mot « Métier » au scrape — même intention).
  "amar-casto-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "chooseOne",
          prompt: "Amar Casto gagne le Métier de votre choix.",
          options: [
            {
              label: "Forgeron",
              ops: [{ op: "setMetierSelf", metier: "Forgeron" }],
            },
            {
              label: "Armurier",
              ops: [{ op: "setMetierSelf", metier: "Armurier" }],
            },
            {
              label: "Bijoutier",
              ops: [{ op: "setMetierSelf", metier: "Bijoutier" }],
            },
            {
              label: "Bricoleur",
              ops: [{ op: "setMetierSelf", metier: "Bricoleur" }],
            },
          ],
        },
      ],
    },
  },
  "amar-casto-dofus-collection": {
    0: {
      trigger: "onPlay",
      ops: [
        {
          op: "chooseOne",
          prompt: "Amar Casto gagne le Métier de votre choix.",
          options: [
            {
              label: "Forgeron",
              ops: [{ op: "setMetierSelf", metier: "Forgeron" }],
            },
            {
              label: "Armurier",
              ops: [{ op: "setMetierSelf", metier: "Armurier" }],
            },
            {
              label: "Bijoutier",
              ops: [{ op: "setMetierSelf", metier: "Bijoutier" }],
            },
            {
              label: "Bricoleur",
              ops: [{ op: "setMetierSelf", metier: "Bricoleur" }],
            },
          ],
        },
      ],
    },
  },

  // ── Défi (W73) — duel avec consentement adverse (Action). Séquence : incliner un
  // duelliste (coût), désigner un défié adverse, l'adversaire accepte (dégâts mutuels
  // de Force) ou refuse (le lanceur gagne 1 XP). Voir les ops duel* dans engine.ts.
  "defi-incarnam": {
    0: {
      trigger: "onPlay",
      ops: [
        { op: "duelTapDuelist" },
        { op: "duelChooseChallenged" },
        { op: "duelOffer" },
      ],
    },
  },

  // ── Échec Critique (W74) — « Annulez les effets de l'Action/Sort/pouvoir qui vient
  // d'être joué. » RÉACTION (reactionOnly) : jouable UNIQUEMENT dans la fenêtre
  // d'annulation ouverte par le store (pendingResolution) quand l'adversaire vient de
  // jouer une carte à effets et que ce joueur tient Échec Critique. L'op marqueur
  // cancelLastPlayed déclenche l'annulation côté store (les effets en attente ne sont
  // jamais enfilés). L'effet[1] est un ruling (déclenchés « Quand … » non annulables).
  "echec-critique-incarnam": {
    0: {
      trigger: "onPlay",
      reactionOnly: true,
      ops: [{ op: "cancelLastPlayed" }],
    },
    1: { kind: "ruling" },
  },

  // ── Kanigrou (W75) — « Quand sur le point de recevoir des Dommages, vous pouvez
  // jouer à Chi-Fu-Mi ; si vous gagnez, réduisez-les à 0, sinon détruisez-le. »
  // Pouvoir PASSIF de prévention interactive : trigger "static" (jamais enfilé) +
  // op marqueur chifumiPrevention (détecté par le store : hasChifumiPower → mini-jeu
  // Chi-Fu-Mi à la résolution du combat). Effets [1..3] = rulings du site. Les 2
  // éditions (incarnam + dofus-collection).
  "kanigrou-incarnam": {
    0: { trigger: "static", ops: [{ op: "chifumiPrevention" }] },
    1: { kind: "ruling" },
    2: { kind: "ruling" },
    3: { kind: "ruling" },
  },
  "kanigrou-dofus-collection": {
    0: { trigger: "static", ops: [{ op: "chifumiPrevention" }] },
    1: { kind: "ruling" },
    2: { kind: "ruling" },
    3: { kind: "ruling" },
  },
};
