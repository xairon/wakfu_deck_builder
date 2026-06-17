import type {
  Card,
  AllyCard,
  HeroCard,
  ActionCard,
  HavenBagCard,
  EquipmentCard,
  Deck,
  DeckCard,
  CardElement,
  CardRarity,
  ExtensionInfo,
  BaseStats,
} from "@/types/cards";

const defaultExtension: ExtensionInfo = {
  name: "Incarnam",
  id: "incarnam",
  number: "1",
  shortUrl: "incarnam",
};

const defaultStats: BaseStats = {
  niveau: { value: 1, element: "Neutre" as CardElement },
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMockAllyCard(overrides?: Partial<AllyCard>): AllyCard {
  return {
    id: uid("ally"),
    name: "Mock Ally",
    mainType: "Allié",
    subTypes: [],
    extension: { ...defaultExtension },
    rarity: "Commune" as CardRarity,
    stats: { ...defaultStats },
    effects: [],
    keywords: [],
    artists: [],
    notes: [],
    imageUrl: "/images/cards/mock-ally.png",
    ...overrides,
  } as AllyCard;
}

export function createMockActionCard(
  overrides?: Partial<ActionCard>,
): ActionCard {
  return {
    id: uid("action"),
    name: "Mock Action",
    mainType: "Action",
    subTypes: [],
    extension: { ...defaultExtension },
    rarity: "Commune" as CardRarity,
    stats: { niveau: { value: 0, element: "Neutre" as CardElement } },
    effects: [{ description: "Inflige 2 dégâts" }],
    keywords: [],
    artists: [],
    notes: [],
    imageUrl: "/images/cards/mock-action.png",
    ...overrides,
  } as ActionCard;
}

export function createMockHeroCard(overrides?: Partial<HeroCard>): HeroCard {
  return {
    id: uid("hero"),
    name: "Mock Hero",
    mainType: "Héros",
    class: "Iop",
    subTypes: [],
    extension: { ...defaultExtension },
    rarity: "Commune" as CardRarity,
    recto: {
      stats: { pv: 20, pa: 6, pm: 3 },
      effects: [],
      keywords: [],
    },
    verso: {
      stats: { pv: 20, pa: 6, pm: 3 },
      effects: [],
      keywords: [],
    },
    artists: [],
    notes: [],
    imageUrl: "/images/cards/mock-hero.png",
    ...overrides,
  } as HeroCard;
}

export function createMockHavreSacCard(
  overrides?: Partial<HavenBagCard>,
): HavenBagCard {
  return {
    id: uid("havresac"),
    name: "Mock Havre-Sac",
    mainType: "Havre-Sac",
    subTypes: [],
    extension: { ...defaultExtension },
    rarity: "Commune" as CardRarity,
    effects: [{ description: "Effet Havre-Sac" }],
    keywords: [],
    artists: [],
    notes: [],
    imageUrl: "/images/cards/mock-havresac.png",
    ...overrides,
  } as HavenBagCard;
}

export function createMockEquipmentCard(
  overrides?: Partial<EquipmentCard>,
): EquipmentCard {
  return {
    id: uid("equip"),
    name: "Mock Équipement",
    mainType: "Équipement",
    subTypes: [],
    extension: { ...defaultExtension },
    rarity: "Commune" as CardRarity,
    stats: { ...defaultStats },
    effects: [],
    keywords: [],
    artists: [],
    notes: [],
    equipmentType: "Arme",
    imageUrl: "/images/cards/mock-equip.png",
    ...overrides,
  } as EquipmentCard;
}

/**
 * Crée un deck valide avec 48 cartes (16 uniques x 3 copies),
 * un héros et un havre-sac.
 */
export function createMockDeck(overrides?: Partial<Deck>): Deck {
  const hero = createMockHeroCard();
  const havreSac = createMockHavreSacCard();
  const cards: DeckCard[] = [];

  // Génère 48 cartes : 16 cartes uniques x 3 exemplaires
  for (let i = 0; i < 16; i++) {
    const card =
      i < 12
        ? createMockAllyCard({ id: `ally-${i}`, name: `Allié ${i}` })
        : createMockActionCard({ id: `action-${i}`, name: `Action ${i}` });
    cards.push({ card, quantity: 3 });
  }

  return {
    id: uid("deck"),
    name: "Mock Deck",
    hero,
    havreSac,
    cards,
    reserve: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Crée un deck incomplet (sans héros, sans havre-sac, 0 cartes)
 */
export function createEmptyDeck(overrides?: Partial<Deck>): Deck {
  return {
    id: uid("deck"),
    name: "Empty Deck",
    hero: null,
    havreSac: null,
    cards: [],
    reserve: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Crée un ensemble de cartes de test pour peupler un cardStore.
 */
export function createMockCardSet(count = 20): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) {
      cards.push(createMockHeroCard({ id: `card-${i}`, name: `Héros ${i}` }));
    } else if (i % 7 === 0) {
      cards.push(
        createMockHavreSacCard({ id: `card-${i}`, name: `Havre-Sac ${i}` }),
      );
    } else if (i % 3 === 0) {
      cards.push(
        createMockActionCard({ id: `card-${i}`, name: `Action ${i}` }),
      );
    } else {
      cards.push(createMockAllyCard({ id: `card-${i}`, name: `Allié ${i}` }));
    }
  }
  return cards;
}
