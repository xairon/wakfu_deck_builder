# Wakfu Deck Builder

Application web pour créer et gérer des decks de cartes Wakfu TCG.

## 🚀 Fonctionnalités

- 📚 Gestion de collection de cartes (normales et foil)
- 🎴 Construction de decks
- 📊 Statistiques et analyses
- 🔍 Recherche avancée
- 📱 Interface responsive

## 🛠️ Technologies

- Vue.js 3 avec Composition API
- TypeScript
- Vite
- Pinia
- Vue Router
- TailwindCSS
- DaisyUI

## 📁 Structure du projet

```
src/
  ├── assets/         # Images, fonts, etc.
  ├── components/     # Composants Vue réutilisables
  │   ├── card/      # Composants liés aux cartes
  │   ├── deck/      # Composants liés aux decks
  │   └── common/    # Composants communs
  ├── config/        # Configuration de l'application
  ├── composables/   # Hooks Vue réutilisables
  ├── router/        # Configuration des routes
  ├── services/      # Services métier
  ├── stores/        # Stores Pinia
  ├── types/         # Types TypeScript
  ├── utils/         # Utilitaires
  ├── validators/    # Validateurs
  └── views/         # Pages de l'application
```

## 🔧 Installation

1. Cloner le dépôt :
```bash
git clone https://github.com/votre-username/wakfu-deck-builder.git
cd wakfu-deck-builder
```

2. Installer les dépendances :
```bash
npm install
```

3. Copier le fichier d'environnement :
```bash
cp .env.example .env
```

4. Démarrer le serveur de développement :
```bash
npm run dev
```

## 📝 Conventions de code

### Nommage

- **Composants** : PascalCase (ex: `CardComponent.vue`)
- **Fichiers** : kebab-case (ex: `card-types.ts`)
- **Types** : PascalCase (ex: `CardType`)
- **Variables/fonctions** : camelCase (ex: `getCardById`)

### Structure des composants

- Un composant par fichier
- Utilisation de `<script setup>` avec TypeScript
- Props typées avec interfaces/types
- Styles scoped avec Tailwind

### Imports

1. Imports Vue/externes
2. Types
3. Composants
4. Stores/services
5. Utils/constants

## 🧪 Tests

```bash
# Lancer les tests unitaires
npm run test

# Lancer les tests avec couverture
npm run test:coverage
```

## 📦 Build

```bash
# Build pour la production
npm run build

# Preview du build
npm run preview
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'feat: add amazing feature'`)
4. Push la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.