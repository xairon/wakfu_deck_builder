# Wakfu Deck Builder

Application locale (web et desktop) de construction de decks et gestion de collection pour Wakfu TCG. Fonctionne 100% en local (pas d'auth, pas de backend distant).

## 🚀 Fonctionnalités

- **📚 Collection de cartes** : Gérez votre collection de cartes Wakfu
- **🃏 Construction de decks** : Créez et modifiez vos decks
- **🔍 Recherche avancée** : Filtrez les cartes par nom, extension, élément, etc.
- **💾 Stockage local** : Toutes vos données sont sauvegardées localement
- **📱 Interface responsive** : Fonctionne sur desktop et mobile
- **🎨 Interface moderne** : Design avec Tailwind CSS et DaisyUI

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

## 📦 Releases (binaries)

Des exécutables Windows sont générés via Tauri:
- `.exe` (NSIS) et `.msi` (Wix) dans `src-tauri/target/release/bundle/`

Si vous publiez sur GitHub, uploadez ces fichiers dans l'onglet Releases pour un téléchargement simple.

### Publication automatique
Un workflow GitHub Actions publie automatiquement une release avec les binaires lors d'un tag `v*`.

1. Mettez à jour la version si besoin.
2. Créez un tag et poussez-le:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. La release sera créée avec les artefacts (.exe/.msi).

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request


## 🙏 Remerciements

- Ankama pour le jeu Wakfu TCG
- L'équipe de https://www.wtcg-return.fr/ pour leurs assets
- La communautée WAkfu TCG Return sur Discord pour leur soutien
