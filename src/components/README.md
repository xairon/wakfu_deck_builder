# Documentation des composants

## Table des matières
- [DeckBuilder](#deckbuilder)
- [DeckDrawSimulator](#deckdrawsimulator)
- [DeckComparison](#deckcomparison)
- [DeckStats](#deckstats)
- [CardComponent](#cardcomponent)

## DeckBuilder

Composant principal pour la création et l'édition de decks.

### Props
```typescript
interface Props {
  initialDeck?: Deck;
  mode?: 'create' | 'edit';
}
```

### Events
```typescript
interface Emits {
  save: (deck: Deck) => void;
  cancel: () => void;
}
```

### Fonctionnalités
- Gestion des limites de cartes (48 + 12)
- Interface drag & drop
- Filtres de recherche
- Validation en temps réel
- Suggestions automatiques

### Exemple d'utilisation
```vue
<template>
  <DeckBuilder
    :initial-deck="myDeck"
    mode="edit"
    @save="handleSave"
    @cancel="handleCancel"
  />
</template>
```

## DeckDrawSimulator

Simulateur de tirage de main avec analyse statistique.

### Props
```typescript
interface Props {
  deck: Deck;
  initialHand?: Card[];
}
```

### Events
```typescript
interface Emits {
  draw: (hand: Card[]) => void;
  mulligan: (replaced: Card[], drawn: Card[]) => void;
}
```

### Fonctionnalités
- Tirage de 6 cartes
- Système de mulligan
- Calcul des probabilités
- Historique des tirages
- Analyse des mains

### Métriques calculées
- Distribution des PA
- Distribution des types
- Distribution des éléments
- Synergies détectées
- Probabilités de combos

### Exemple d'utilisation
```vue
<template>
  <DeckDrawSimulator
    :deck="currentDeck"
    @draw="handleNewHand"
    @mulligan="handleMulligan"
  />
</template>
```

## DeckComparison

Outil de comparaison avancée entre deux decks.

### Props
```typescript
interface Props {
  deck1: Deck;
  deck2: Deck;
}
```

### Métriques comparées
- Statistiques de base
  - Total de cartes
  - Cartes uniques
  - Moyennes (PA, HP, MP)
- Distributions
  - Types
  - Éléments
  - Courbe de PA
- Métriques avancées
  - Diversité
  - Efficacité
  - Équilibre
- Synergies et combos
- Compatibilité

### Fonctionnalités
- Analyse comparative détaillée
- Visualisation des différences
- Suggestions d'amélioration
- Export de rapport

### Exemple d'utilisation
```vue
<template>
  <DeckComparison
    :deck1="myDeck1"
    :deck2="myDeck2"
  />
</template>
```

## DeckStats

Analyse détaillée d'un deck.

### Props
```typescript
interface Props {
  deck: Deck;
  showDetails?: boolean;
}
```

### Métriques
- Statistiques générales
  - Nombre total de cartes
  - Cartes uniques
  - Moyennes
- Distribution des coûts
  - Courbe de PA
  - Répartition
  - Efficacité
- Analyse des synergies
  - Types
  - Éléments
  - Combos
- Potentiel
  - Early game
  - Mid game
  - Late game

### Exemple d'utilisation
```vue
<template>
  <DeckStats
    :deck="currentDeck"
    :show-details="true"
  />
</template>
```

## CardComponent

Composant de rendu d'une carte.

### Props
```typescript
interface Props {
  card: Card;
  selected?: boolean;
  interactive?: boolean;
  showQuantity?: boolean;
  quantity?: number;
}
```

### Events
```typescript
interface Emits {
  click: (card: Card) => void;
  select: (card: Card) => void;
  quantityChange: (card: Card, quantity: number) => void;
}
```

### Fonctionnalités
- Affichage des informations
- Gestion de la sélection
- Contrôle de la quantité
- Animations et effets
- Mode interactif

### Exemple d'utilisation
```vue
<template>
  <CardComponent
    :card="myCard"
    :selected="isSelected"
    :interactive="true"
    :show-quantity="true"
    :quantity="2"
    @click="handleClick"
    @select="handleSelect"
    @quantity-change="handleQuantityChange"
  />
</template>
```

## Bonnes pratiques

### Performance
- Utilisation de `v-show` plutôt que `v-if` pour les toggles fréquents
- Computed properties pour les calculs coûteux
- Debouncing des événements fréquents
- Lazy loading des composants lourds

### Réutilisabilité
- Props typées et validées
- Events typés
- Slots pour la personnalisation
- Composants atomiques

### Maintenance
- Documentation JSDoc
- Tests unitaires
- Logging des actions importantes
- Gestion des erreurs

### Accessibilité
- ARIA labels
- Contrôles clavier
- Messages d'erreur clairs
- Support des lecteurs d'écran 