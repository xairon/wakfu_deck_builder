# Wakfu Deck Builder

Application locale (web et desktop) de construction de decks et gestion de collection pour Wakfu TCG. Fonctionne 100% en local (pas d'auth, pas de backend distant).

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

## 📦 Installation rapide

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd wakfu_deck_builder
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer en mode développement (Web)**
   ```bash
   npm run dev
   # Ouvre sur http://localhost:3000
   ```

4. **Lancer la version Desktop (Tauri)**
   ```bash
   npm run tauri:dev
   ```

## 🏗 Scripts

- `npm run dev` - Lance le serveur de développement
- `npm run build` - Build pour la production
- `npm run serve` - Prévisualise le build de production
- `npm run test:unit` - Lance les tests unitaires
- `npm run lint` - Vérifie le code avec ESLint
- `npm run type-check` - Vérifie les types TypeScript
- `npm run tauri:dev` - Lance l'appli Desktop en dev
- `npm run tauri:build` - Construit l'exécutable (.exe / .msi)

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

## 💾 Données & Persistance

L'application utilise **localStorage** pour sauvegarder :
- Votre collection de cartes
- Vos decks créés
- Les paramètres de l'application

### Export/Import (collection, decks, paramètres)

Vous pouvez exporter et importer vos données :

```typescript
import { localStorageService } from '@/services/localStorage'

// Exporter vos données
const exportedData = localStorageService.export()

// Importer des données
localStorageService.import(exportedData)
```

## 🎮 Utilisation rapide

### Collection
1. Naviguez vers la page "Collection"
2. Parcourez et filtrez les cartes disponibles
3. Cliquez sur une carte pour l'ajouter à votre collection
4. Ajustez les quantités normale et foil

### Deck Builder
1. Allez dans "Deck Builder"
2. Sélectionnez un héros et des cartes havre-sac
3. Ajoutez des cartes depuis votre collection
4. Respectez les règles du jeu (15-40 cartes, max 3 copies, etc.)
5. Sauvegardez votre deck (stocké en local)

### Import de deck (format)
Dans la page `Decks`, bouton `Importer`.
Format attendu (exemple) dans le placeholder du champ. Tolérant à la casse/accents/espaces.

Règles de validation lors de l'import:
- Max 48 cartes (hors Héros/Havre-sac)
- Max 3 exemplaires par carte
- 1 Héros, 1 Havre-sac
- Erreurs et avertissements détaillés affichés

## 🔧 Configuration

### Thème
L'application supporte plusieurs thèmes DaisyUI. Vous pouvez changer le thème dans les paramètres.

### Cartes
Les données de cartes sont intégrées au projet et chargées automatiquement. Les images sont optimisées au build.

### Desktop (.exe)
Les exécutables signés localement peuvent être détectés par certains antivirus. Solutions:
- Exclure le dossier `src-tauri/target` dans Windows Defender
- Construire depuis vos sources locales
- Pour distribution publique, signature de code recommandée

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

## 📦 Releases (binaries)

Des exécutables Windows sont générés via Tauri:
- `.exe` (NSIS) et `.msi` (Wix) dans `src-tauri/target/release/bundle/`

Si vous publiez sur GitHub, uploadez ces fichiers dans l'onglet Releases pour un téléchargement simple.

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