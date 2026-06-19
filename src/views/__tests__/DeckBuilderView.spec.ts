/**
 * Tests unitaires pour DeckBuilderView — comportements cœur du pool de cartes.
 *
 * Deux assertions pivots :
 *  1. Cliquer la tuile ([data-testid="pool-tile"]) OUVRE le zoom
 *     ([data-testid="card-zoom"] présent / open) et N'AJOUTE PAS de carte.
 *  2. Cliquer le bouton express ([data-testid="pool-add"]) incrémente
 *     deckStore.cardCount de 1.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { createMockAllyCard } from "tests/factories/card";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import DeckBuilderView from "../DeckBuilderView.vue";

// ── Stubs & mocks globaux ──────────────────────────────────────────────────────

// CardZoomModal : rendu minimaliste avec data-testid conditionnel sur `open`
vi.mock("@/components/card/CardZoomModal.vue", () => ({
  default: {
    name: "CardZoomModal",
    props: ["card", "open"],
    emits: ["close"],
    template: `<div v-if="open" data-testid="card-zoom"><slot name="actions" /></div>`,
  },
}));

// CollectionFilters : stub opaque
vi.mock("@/components/collection/CollectionFilters.vue", () => ({
  default: {
    name: "CollectionFilters",
    props: [
      "extensions",
      "mainTypes",
      "subTypes",
      "rarities",
      "elements",
      "searchQuery",
      "selectedExtension",
      "hideNotOwned",
      "selectedSortField",
      "isDescending",
      "selectedMainType",
      "selectedSubType",
      "selectedRarity",
      "selectedElement",
      "minLevel",
      "maxLevel",
      "minCost",
      "maxCost",
      "minForce",
      "maxForce",
      "effectQuery",
    ],
    template: `<div data-testid="collection-filters" />`,
  },
}));

// useCardFilter : passe-plat réel + pruneFilterCaches no-op
vi.mock("@/composables/useCardFilter", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/composables/useCardFilter")>();
  return { ...real, pruneFilterCaches: vi.fn() };
});

// Services externes
vi.mock("@/services/supabase", () => ({ isSupabaseConfigured: () => false }));
vi.mock("@/services/cloudSync", () => ({}));
vi.mock("@/services/errataService", () => ({ fetchErrata: async () => [] }));
vi.mock("@/utils/effectText", () => ({
  highlightEffectHtml: (t: string) => t,
}));

// cardLoader : no-op (on injecte les cartes directement dans le store)
vi.mock("@/services/cardLoader", () => ({
  loadAllCards: vi.fn().mockResolvedValue([]),
}));

// vue-router : useRoute/useRouter mockés pour éviter le besoin du plugin
const mockRouteParams: { id?: string } = {};
vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({ params: mockRouteParams, query: {} })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// useDebounceFn : synchrone pour simplifier les tests
// useLocalStorage : ref simple pour éviter les accès localStorage en test
vi.mock("@vueuse/core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@vueuse/core")>();
  const { ref } = await import("vue");
  return {
    ...real,
    useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn,
    useLocalStorage: (_key: string, defaultValue: unknown) => ref(defaultValue),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const ally = createMockAllyCard({ id: "ally-test-1", name: "Allié de Test" });

/**
 * Monte DeckBuilderView avec :
 * - un Pinia frais
 * - un cardStore pré-initialisé (évite les appels réseau)
 * - un deckStore avec un deck actif (API réelle createDeck/setCurrentDeck)
 */
async function mountView() {
  // 1. Pré-remplir le cardStore avant le mount
  const cardStore = useCardStore();
  // setCards ne met pas isInitialized=true — il faut les deux pour que le guard
  // de initialize() court-circuite le fetch réseau.
  cardStore.setCards([ally]);
  cardStore.isInitialized = true;

  // 2. Créer un deck actif via l'API réelle du deckStore
  const deckStore = useDeckStore();
  const deckId = deckStore.createDeck("Deck de test");
  deckStore.setCurrentDeck(deckId);

  // Paramètre de route : setupDeck lit route.params.id pour setCurrentDeck
  mockRouteParams.id = deckId;

  const wrapper = mount(DeckBuilderView, {
    global: {
      stubs: {
        RouterLink: { template: `<a><slot /></a>` },
        RouterView: true,
      },
    },
  });

  // Attendre que setupDeck (onMounted async) se termine
  await flushPromises();

  return { wrapper, cardStore, deckStore, deckId };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DeckBuilderView — pool de cartes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn() },
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("cliquer la tuile OUVRE le zoom et N'ajoute PAS de carte", async () => {
    const { wrapper, deckStore } = await mountView();
    const countBefore = deckStore.cardCount;

    // Zoom absent initialement
    expect(wrapper.find('[data-testid="card-zoom"]').exists()).toBe(false);

    // La tuile doit exister (la carte ally est dans le pool)
    const tile = wrapper.find('[data-testid="pool-tile"]');
    expect(tile.exists()).toBe(true);

    await tile.trigger("click");
    await flushPromises();

    // Zoom ouvert
    expect(wrapper.find('[data-testid="card-zoom"]').exists()).toBe(true);

    // Aucune carte ajoutée
    expect(deckStore.cardCount).toBe(countBefore);
  });

  it("cliquer le bouton express (+) ajoute UNE carte au deck", async () => {
    const { wrapper, deckStore } = await mountView();
    const countBefore = deckStore.cardCount;

    const addBtn = wrapper.find('[data-testid="pool-add"]');
    expect(addBtn.exists()).toBe(true);

    await addBtn.trigger("click");
    await flushPromises();

    expect(deckStore.cardCount).toBe(countBefore + 1);
  });
});
