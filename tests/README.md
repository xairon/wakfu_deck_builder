# Documentation des Tests

## Table des matières
- [Structure](#structure)
- [Tests Unitaires](#tests-unitaires)
- [Tests d'Intégration](#tests-dintégration)
- [Tests E2E](#tests-e2e)
- [Mocks et Fixtures](#mocks-et-fixtures)
- [Bonnes Pratiques](#bonnes-pratiques)

## Structure

```
tests/
├── unit/                 # Tests unitaires
│   ├── components/       # Tests des composants
│   ├── stores/          # Tests des stores
│   ├── composables/     # Tests des composables
│   └── utils/           # Tests des utilitaires
├── integration/         # Tests d'intégration
│   ├── api/            # Tests des appels API
│   └── flows/          # Tests des flux utilisateur
├── e2e/                # Tests end-to-end
│   └── specs/          # Spécifications E2E
└── fixtures/           # Données de test
    ├── cards.json      # Cartes de test
    └── decks.json      # Decks de test
```

## Tests Unitaires

### Composants

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CardComponent from '@/components/CardComponent.vue';

describe('CardComponent', () => {
  let wrapper;
  const mockCard = {
    id: '1',
    name: 'Test Card',
    type: 'Allié'
  };

  beforeEach(() => {
    wrapper = mount(CardComponent, {
      props: {
        card: mockCard
      }
    });
  });

  it('affiche le nom de la carte', () => {
    expect(wrapper.text()).toContain('Test Card');
  });

  it('émet un événement au clic', async () => {
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });
});
```

### Stores

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCardStore } from '@/stores/cardStore';

describe('CardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initialise avec un état vide', () => {
    const store = useCardStore();
    expect(store.cards).toHaveLength(0);
  });

  it('ajoute une carte à la collection', async () => {
    const store = useCardStore();
    await store.addToCollection(mockCard, 1);
    expect(store.collection).toHaveLength(1);
  });
});
```

### Composables

```typescript
import { describe, it, expect } from 'vitest';
import { useToast } from '@/composables/useToast';
import { nextTick } from 'vue';

describe('useToast', () => {
  it('ajoute un toast', async () => {
    const { toasts, success } = useToast();
    success('Test message');
    await nextTick();
    expect(toasts.value).toHaveLength(1);
  });

  it('supprime un toast après la durée spécifiée', async () => {
    const { toasts, success } = useToast();
    success('Test message', { duration: 100 });
    await new Promise(r => setTimeout(r, 150));
    expect(toasts.value).toHaveLength(0);
  });
});
```

## Tests d'Intégration

### API

```typescript
import { describe, it, expect } from 'vitest';
import { loadAllCards } from '@/services/cardLoader';

describe('CardLoader', () => {
  it('charge toutes les cartes', async () => {
    const cards = await loadAllCards();
    expect(cards).toHaveLength(100);
    expect(cards[0]).toHaveProperty('name');
  });

  it('gère les erreurs de chargement', async () => {
    // Simuler une erreur réseau
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(loadAllCards()).rejects.toThrow('Network error');
  });
});
```

### Flux Utilisateur

```typescript
import { describe, it, expect } from 'vitest';
import { createDeck, addCard, saveDeck } from '@/services/deckService';

describe('Flux de création de deck', () => {
  it('crée et sauvegarde un deck complet', async () => {
    // Créer un deck
    const deck = await createDeck('Test Deck');
    expect(deck.id).toBeDefined();

    // Ajouter des cartes
    await addCard(deck.id, mockCard, 3);
    expect(deck.cards).toHaveLength(1);

    // Sauvegarder
    const saved = await saveDeck(deck);
    expect(saved).toBeTruthy();
  });
});
```

## Tests E2E

### Configuration Cypress

```javascript
// cypress.config.js
export default {
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false
  }
};
```

### Spécifications

```typescript
describe('Création de deck', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.login(); // Commande personnalisée
  });

  it('crée un nouveau deck', () => {
    cy.get('[data-test="new-deck"]').click();
    cy.get('[data-test="deck-name"]').type('Mon Deck');
    cy.get('[data-test="save"]').click();
    cy.url().should('include', '/deck/');
  });
});
```

## Mocks et Fixtures

### Données de Test

```typescript
// fixtures/cards.json
{
  "cards": [
    {
      "id": "1",
      "name": "Test Card",
      "type": "Allié",
      "stats": {
        "ap": 2,
        "hp": 10
      }
    }
  ]
}
```

### Mocks

```typescript
import { vi } from 'vitest';

// Mock du store
vi.mock('@/stores/cardStore', () => ({
  useCardStore: () => ({
    cards: [],
    addToCollection: vi.fn(),
    removeFromCollection: vi.fn()
  })
}));

// Mock des composables
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));
```

## Bonnes Pratiques

### Organisation
- Un fichier de test par composant/module
- Groupement logique des tests
- Nommage clair et descriptif
- Isolation des tests

### Performance
- Mocks appropriés
- Cleanup après chaque test
- Réutilisation des fixtures
- Tests parallèles quand possible

### Maintenance
- Tests atomiques
- Assertions claires
- Documentation des cas complexes
- Gestion des effets de bord

### Couverture
- Tests des cas nominaux
- Tests des cas d'erreur
- Tests des limites
- Tests de performance

### Commandes de Test

```bash
# Lancer tous les tests
npm run test

# Tests unitaires uniquement
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e

# Couverture
npm run test:coverage

# Mode watch
npm run test:watch
``` 