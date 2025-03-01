# Documentation des Services

## Table des matières
- [CardLoader](#cardloader)
- [DeckService](#deckservice)
- [StorageService](#storageservice)
- [AnalyticsService](#analyticsservice)

## CardLoader

Service responsable du chargement des cartes depuis les fichiers JSON.

### Interface
```typescript
interface CardLoader {
  /** Charge toutes les cartes */
  loadAllCards(): Promise<Card[]>;
  /** Charge les cartes d'une extension spécifique */
  loadExtensionCards(extension: string): Promise<Card[]>;
  /** Vérifie si une carte existe */
  cardExists(cardId: string): Promise<boolean>;
  /** Récupère les métadonnées d'une carte */
  getCardMetadata(cardId: string): Promise<CardMetadata>;
}
```

### Configuration
```typescript
const cardFiles = [
  '/cartes/incarnam_cards.json',
  '/cartes/astrub_cards.json',
  '/cartes/amakna_cards.json',
  // ...
];
```

### Gestion des erreurs
```typescript
try {
  const cards = await loadAllCards();
} catch (error) {
  if (error instanceof NetworkError) {
    // Gérer les erreurs réseau
  } else if (error instanceof ValidationError) {
    // Gérer les erreurs de validation
  }
}
```

## DeckService

Service pour la gestion des decks.

### Interface
```typescript
interface DeckService {
  /** Crée un nouveau deck */
  createDeck(name: string): Promise<Deck>;
  /** Charge un deck */
  loadDeck(id: string): Promise<Deck>;
  /** Sauvegarde un deck */
  saveDeck(deck: Deck): Promise<void>;
  /** Supprime un deck */
  deleteDeck(id: string): Promise<void>;
  /** Valide un deck */
  validateDeck(deck: Deck): ValidationResult;
  /** Exporte un deck */
  exportDeck(deck: Deck, format: ExportFormat): string;
}
```

### Validation
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Exemple de validation
const result = validateDeck(deck);
if (!result.isValid) {
  console.error('Erreurs de validation:', result.errors);
}
```

### Export/Import
```typescript
// Export au format JSON
const jsonData = exportDeck(deck, 'json');

// Export au format texte
const textData = exportDeck(deck, 'text');

// Import depuis JSON
const deck = await importDeck(jsonData);
```

## StorageService

Service pour la gestion du stockage local.

### Interface
```typescript
interface StorageService {
  /** Sauvegarde des données */
  save<T>(key: string, data: T): Promise<void>;
  /** Charge des données */
  load<T>(key: string): Promise<T | null>;
  /** Supprime des données */
  remove(key: string): Promise<void>;
  /** Vérifie si des données existent */
  exists(key: string): Promise<boolean>;
  /** Nettoie le stockage */
  clear(): Promise<void>;
}
```

### Exemple d'utilisation
```typescript
const storage = new StorageService();

// Sauvegarder des préférences
await storage.save('preferences', {
  theme: 'dark',
  language: 'fr'
});

// Charger des préférences
const prefs = await storage.load('preferences');
```

## AnalyticsService

Service pour l'analyse des decks et des statistiques.

### Interface
```typescript
interface AnalyticsService {
  /** Analyse un deck */
  analyzeDeck(deck: Deck): DeckAnalysis;
  /** Compare deux decks */
  compareDecks(deck1: Deck, deck2: Deck): DeckComparison;
  /** Calcule les probabilités */
  calculateProbabilities(deck: Deck): Probabilities;
  /** Génère des suggestions */
  generateSuggestions(deck: Deck): Suggestion[];
}
```

### Métriques
```typescript
interface DeckAnalysis {
  basicStats: {
    totalCards: number;
    uniqueCards: number;
    averageAP: number;
  };
  distributions: {
    types: Record<string, number>;
    elements: Record<string, number>;
    costs: Record<number, number>;
  };
  synergies: Synergy[];
  suggestions: string[];
}
```

### Exemple d'utilisation
```typescript
const analytics = new AnalyticsService();

// Analyser un deck
const analysis = analytics.analyzeDeck(deck);

// Comparer deux decks
const comparison = analytics.compareDecks(deck1, deck2);
```

## Bonnes Pratiques

### Performance
- Mise en cache des résultats coûteux
- Chargement asynchrone des ressources
- Optimisation des calculs
- Batch operations

### Sécurité
- Validation des entrées
- Sanitization des données
- Gestion des erreurs
- Rate limiting

### Maintenance
- Logging des opérations
- Tests unitaires
- Documentation
- Versioning

### Architecture
- Séparation des responsabilités
- Injection de dépendances
- Interface claire
- Gestion des erreurs
``` 