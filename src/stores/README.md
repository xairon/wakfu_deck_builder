# Documentation des Stores

## Table des matières
- [CardStore](#cardstore)
- [DeckStore](#deckstore)
- [UIStore](#uistore)

## CardStore

Store principal pour la gestion des cartes et de la collection.

### État
```typescript
interface State {
  /** Liste de toutes les cartes du jeu */
  cards: Card[];
  /** Collection de l'utilisateur */
  collection: CollectionCard[];
  /** Decks de l'utilisateur */
  decks: Deck[];
  /** État de chargement */
  loading: boolean;
  /** Message d'erreur éventuel */
  error: string | null;
}
```

### Actions
```typescript
interface Actions {
  /** Initialise la base de données des cartes */
  initializeDatabase(): Promise<void>;
  /** Charge toutes les cartes */
  loadCards(): Promise<void>;
  /** Ajoute une carte à la collection */
  addToCollection(card: Card, quantity: number): Promise<void>;
  /** Retire une carte de la collection */
  removeFromCollection(card: Card, quantity: number): Promise<void>;
  /** Crée un nouveau deck */
  createDeck(name: string): Promise<void>;
  /** Ajoute une carte à un deck */
  addCardToDeck(deckId: string, card: Card, quantity: number): Promise<void>;
  /** Retire une carte d'un deck */
  removeCardFromDeck(deckId: string, card: Card, quantity: number): Promise<void>;
  /** Supprime un deck */
  deleteDeck(deckId: string): Promise<void>;
}
```

### Getters
```typescript
interface Getters {
  /** Nombre total de cartes */
  totalCards: number;
  /** Nombre total de cartes en collection */
  totalCollection: number;
  /** Progression de la collection */
  collectionProgress: string;
  /** Cartes groupées par type */
  cardsByType: Record<string, Card[]>;
  /** Cartes groupées par extension */
  cardsByExtension: Record<string, Card[]>;
  /** Quantité d'une carte dans la collection */
  getCardQuantity: (cardId: string) => number;
}
```

### Exemple d'utilisation
```typescript
import { useCardStore } from '@/stores/cardStore';

const cardStore = useCardStore();

// Initialisation
await cardStore.initializeDatabase();

// Ajout à la collection
await cardStore.addToCollection(card, 1);

// Création d'un deck
await cardStore.createDeck('Mon Deck');
```

## DeckStore

Store pour la gestion avancée des decks.

### État
```typescript
interface State {
  /** Deck actif en édition */
  activeDeck: Deck | null;
  /** Historique des modifications */
  history: DeckHistory[];
  /** État de sauvegarde */
  saved: boolean;
}
```

### Actions
```typescript
interface Actions {
  /** Charge un deck */
  loadDeck(id: string): Promise<void>;
  /** Sauvegarde les modifications */
  saveDeck(): Promise<void>;
  /** Annule la dernière modification */
  undo(): void;
  /** Rétablit la dernière modification annulée */
  redo(): void;
  /** Exporte le deck */
  exportDeck(format: 'json' | 'text'): string;
  /** Importe un deck */
  importDeck(data: string): Promise<void>;
}
```

### Exemple d'utilisation
```typescript
import { useDeckStore } from '@/stores/deckStore';

const deckStore = useDeckStore();

// Chargement d'un deck
await deckStore.loadDeck('deck-123');

// Sauvegarde
await deckStore.saveDeck();

// Export
const deckData = deckStore.exportDeck('json');
```

## UIStore

Store pour la gestion de l'interface utilisateur.

### État
```typescript
interface State {
  /** Thème actif */
  theme: 'light' | 'dark';
  /** Préférences utilisateur */
  preferences: UserPreferences;
  /** État des modales */
  modals: Record<string, boolean>;
  /** Messages de toast */
  toasts: Toast[];
}
```

### Actions
```typescript
interface Actions {
  /** Change le thème */
  setTheme(theme: 'light' | 'dark'): void;
  /** Met à jour les préférences */
  updatePreferences(prefs: Partial<UserPreferences>): void;
  /** Affiche une modale */
  showModal(id: string): void;
  /** Cache une modale */
  hideModal(id: string): void;
  /** Affiche un toast */
  showToast(toast: Toast): void;
}
```

### Exemple d'utilisation
```typescript
import { useUIStore } from '@/stores/uiStore';

const uiStore = useUIStore();

// Changement de thème
uiStore.setTheme('dark');

// Affichage d'un toast
uiStore.showToast({
  type: 'success',
  message: 'Deck sauvegardé'
});
```

## Bonnes pratiques

### Performance
- Utilisation de `shallowRef` pour les grands objets
- Getters memoizés pour les calculs coûteux
- Actions asynchrones optimisées
- Batch updates pour les modifications multiples

### Persistance
- Sauvegarde automatique des données importantes
- Gestion du cache
- Migration des données
- Validation des données

### Réactivité
- Computed properties pour les dérivations
- Watchers pour les effets de bord
- Actions pour les mutations complexes
- Getters pour l'accès aux données

### Maintenance
- Types stricts
- Tests unitaires
- Logging des actions
- Documentation JSDoc 