import { ref } from "vue";
import type { Card } from "@/types/cards";
import type { OfficialDeck } from "@/data/officialDecks";
import { EXTENSION_NAME_BY_SLUG } from "@/data/allOfficialDecks";
import { useDeckStore } from "@/stores/deckStore";
import { useToast } from "@/composables/useToast";

export interface BuiltOfficialDeck {
  heroCard: Card | null;
  havreSacCard: Card | null;
  deckCards: { card: Card; quantity: number }[];
  missing: string[];
  heroMissing: boolean;
  havreMissing: boolean;
}

/**
 * Construit (sans effet de bord) les cartes résolues d'un deck officiel.
 * `resolve` est injecté → testable sans store.
 */
export function buildOfficialDeck(
  deck: OfficialDeck,
  resolve: (name: string) => Card | null,
): BuiltOfficialDeck {
  const heroCard = resolve(deck.hero);
  const havreSacCard = resolve(deck.havreSac);
  const deckCards: { card: Card; quantity: number }[] = [];
  const missing: string[] = [];
  for (const c of deck.cards) {
    const card = resolve(c.name);
    if (card) deckCards.push({ card, quantity: c.quantity });
    else missing.push(c.name);
  }
  return {
    heroCard,
    havreSacCard,
    deckCards,
    missing,
    heroMissing: !heroCard,
    havreMissing: !havreSacCard,
  };
}

/** Import d'un deck officiel dans les decks utilisateur (stores + toasts). */
export function useOfficialDeckImport() {
  const deckStore = useDeckStore();
  const toast = useToast();
  const importingId = ref<string | null>(null);

  function isDeckImported(officialDeck: OfficialDeck): boolean {
    return deckStore.decks.some(
      (d) =>
        d.name === officialDeck.name ||
        (!!(d as { isOfficial?: boolean }).isOfficial &&
          !!d.id &&
          d.id.includes(officialDeck.id)),
    );
  }

  function resolverFor(deck: OfficialDeck) {
    const ext = EXTENSION_NAME_BY_SLUG[deck.extension];
    return (name: string) => deckStore.findCardByName(name, undefined, ext);
  }

  async function importDeck(officialDeck: OfficialDeck): Promise<void> {
    if (importingId.value) return;
    importingId.value = officialDeck.id;
    try {
      // Remplace toute version officielle existante du même nom (réimport).
      const existing = deckStore.decks.filter(
        (d) =>
          (d as { isOfficial?: boolean }).isOfficial &&
          d.name === officialDeck.name,
      );
      for (const d of existing) if (d.id) deckStore.deleteDeck(d.id);

      const built = buildOfficialDeck(officialDeck, resolverFor(officialDeck));
      const newDeck = {
        id: `official-${officialDeck.id}-${Date.now()}`,
        name: officialDeck.name,
        description: officialDeck.description,
        hero: built.heroCard || null,
        havreSac: built.havreSacCard || null,
        cards: built.deckCards,
        reserve: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOfficial: true,
        extension: officialDeck.extension,
      };
      deckStore.decks.push(newDeck as never);
      deckStore.saveDecks();

      if (built.missing.length === 0) {
        toast.success(
          `Deck « ${officialDeck.name} » importé ! ${built.deckCards.length} cartes.`,
          { title: "Import réussi", duration: 4000 },
        );
      } else {
        toast.warning(
          `Deck « ${officialDeck.name} » importé avec ${built.missing.length} carte(s) manquante(s) : ${built.missing.slice(0, 5).join(", ")}${built.missing.length > 5 ? "…" : ""}`,
          { title: "Import partiel", duration: 6000 },
        );
      }
    } catch (err) {
      toast.error(`Erreur d'import : ${err}`, {
        title: "Erreur",
        duration: 6000,
      });
    } finally {
      importingId.value = null;
    }
  }

  return { importDeck, isDeckImported, importingId };
}
