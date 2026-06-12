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
};
