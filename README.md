# Wakfu Deck Builder - Mode Local

Une application de deck builder pour le jeu de cartes Wakfu TCG, fonctionnant entièrement en local sans authentification.

## 🚀 Fonctionnalités

- **📚 Collection de cartes** : Gérez votre collection de cartes Wakfu
- **🃏 Construction de decks** : Créez et modifiez vos decks
- **🔍 Recherche avancée** : Filtrez les cartes par nom, extension, élément, etc.
- **💾 Stockage local** : Toutes vos données sont sauvegardées localement
- **📱 Interface responsive** : Fonctionne sur desktop et mobile
- **🎨 Interface moderne** : Design avec Tailwind CSS et DaisyUI

## 🛠 Technologies Utilisées

- **Vue 3** avec Composition API
- **TypeScript** pour la sécurité des types
- **Pinia** pour la gestion d'état
- **Vue Router** pour la navigation
- **Tailwind CSS** + **DaisyUI** pour l'interface
- **Vite** pour le build et le développement
- **Vitest** pour les tests

## 📦 Installation

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd wakfu_deck_builder
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer en mode développement**
   ```bash
   npm run dev
   ```

4. **Accéder à l'application**
   Ouvrez votre navigateur sur `http://localhost:5173`

## 🏗 Scripts Disponibles

- `npm run dev` - Lance le serveur de développement
- `npm run build` - Build pour la production
- `npm run preview` - Prévisualise le build de production
- `npm run test:unit` - Lance les tests unitaires
- `npm run lint` - Vérifie le code avec ESLint
- `npm run type-check` - Vérifie les types TypeScript

## 📁 Structure du Projet

```
src/
├── components/           # Composants Vue réutilisables
│   ├── card/            # Composants liés aux cartes
│   ├── collection/      # Composants de la collection
│   ├── common/          # Composants communs
│   ├── deck/            # Composants des decks
│   └── elements/        # Composants d'éléments
├── composables/         # Hooks Vue personnalisés
├── services/            # Services de données
│   ├── cardLoader.ts    # Chargement des cartes
│   └── localStorage.ts  # Stockage local
├── stores/              # Stores Pinia
│   ├── cardStore.ts     # Gestion des cartes et collection
│   └── deckStore.ts     # Gestion des decks
├── types/               # Définitions TypeScript
├── utils/               # Utilitaires
├── views/               # Pages de l'application
└── router/              # Configuration du routeur
```

## 💾 Stockage des Données

L'application utilise **localStorage** pour sauvegarder :
- Votre collection de cartes
- Vos decks créés
- Les paramètres de l'application

### Export/Import

Vous pouvez exporter et importer vos données :

```typescript
import { localStorageService } from '@/services/localStorage'

// Exporter vos données
const exportedData = localStorageService.export()

// Importer des données
localStorageService.import(exportedData)
```

## 🎮 Utilisation

### Collection
1. Naviguez vers la page "Collection"
2. Parcourez et filtrez les cartes disponibles
3. Cliquez sur une carte pour l'ajouter à votre collection
4. Ajustez les quantités normale et foil

### Construction de Deck
1. Allez dans "Deck Builder"
2. Sélectionnez un héros et des cartes havre-sac
3. Ajoutez des cartes depuis votre collection
4. Respectez les règles du jeu (15-40 cartes, max 3 copies, etc.)
5. Sauvegardez votre deck

## 🔧 Configuration

### Thème
L'application supporte plusieurs thèmes DaisyUI. Vous pouvez changer le thème dans les paramètres.

### Cartes
Les données des cartes sont chargées automatiquement depuis le dossier `data/`. 
Pour ajouter de nouvelles cartes, placez les fichiers JSON dans la structure appropriée.

## 🧪 Tests

### Lancer les tests
```bash
npm run test:unit
```

### Coverage
```bash
npm run coverage
```

Les tests couvrent :
- Validation des decks
- Gestion d'erreurs
- Stores Pinia
- Utilitaires

## 🐛 Dépannage

### Données perdues
Si vos données sont perdues, vérifiez :
1. Que localStorage n'est pas désactivé
2. Qu'il reste de l'espace de stockage disponible
3. Que vous n'êtes pas en mode navigation privée

### Performance
Pour améliorer les performances :
1. Videz le cache du navigateur
2. Redémarrez l'application
3. Vérifiez la taille de votre collection

## 📝 TODO

- [ ] Ajout de nouvelles extensions de cartes
- [ ] Mode tournoi
- [ ] Statistiques de deck
- [ ] Import/export en formats standards
- [ ] Mode hors ligne complet

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- Équipe Ankama pour le jeu Wakfu TCG
- Communauté Vue.js
- Contributeurs DaisyUI et Tailwind CSS