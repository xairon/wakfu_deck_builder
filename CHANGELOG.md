# Journal des modifications — L'Almanach des Douze

## v1.1.0 — 9 juin 2026

Grosse mise à jour suite aux premiers retours de la bêta, accompagnée d'un audit
complet de l'application (51 bugs identifiés, 47 corrigés) et d'une refonte des
images des cartes.

> **Vos comptes et vos données (collections, decks, parties) sont conservés** :
> ils sont stockés côté serveur (Supabase) et n'ont pas été touchés par la mise
> à jour.

### 🐛 Bugs signalés par la communauté

- **Simulateur de pioche** : la main de départ est de **6 cartes** (au lieu de 7).
- **Recherche de cartes insensible aux accents** : « xelor » trouve « Xélor »,
  « feca » → « Féca », « brakmar » → « Brâkmar »…
- **Atelier de deck** : mise en page des emplacements **Héros / Havre-Sac**
  corrigée (le « colspan » signalé) + bascule en 2 colonnes plus tardive pour ne
  plus écraser le vivier de cartes sur écrans moyens.
- **« email rate limit exceeded » à l'inscription** : corrigé côté configuration
  serveur (confirmation e-mail désactivée → inscription = connexion immédiate).

### ⚖️ Règles du jeu

- Règle **« carte Unique = 1 seul exemplaire »** désormais réellement appliquée
  (dans le builder, la validation, l'import et le partage).
- « Au moins une Action ou un Allié » ne tient plus compte des cartes de réserve.
- Statistiques de deck (éléments, types, courbe de PA) calculées sur le **deck
  principal** uniquement (réserve exclue).
- Import / partage de deck : plafonds respectés (3 copies, 1 pour les Unique, 48
  cartes max) et **la réserve est conservée**.

### 🎴 Cartes & images

- **Filigrane « wtcg-return » retiré** de toutes les cartes.
- Images **agrandies ×2** (plus nettes) et converties en WebP (≈ 3× plus légères).
- **Vignettes ~256px** dans les grilles → affichage environ **6× plus léger**
  (gros gain sur mobile) ; la pleine résolution est conservée sur la fiche carte.
- Les **illustrations des héros s'affichent** enfin dans la collection (elles
  pointaient vers un fichier inexistant).
- Vrai **dos de carte** « grimoire » pour les cartes sans visuel.
- **Mots-clés nettoyés** (fini les « Le », « , », « : » parasites) et **symboles
  d'éléments** corrects partout.

### ⚡ Performance & navigation

- **Collection paginée** (60 cartes par page) : on parcourt l'intégralité de la
  collection sans ralentissement, navigation par pages.
- Recherche du vivier de cartes **débouncée** (plus de saccade en tapant).
- Les cartes hors écran ne sont plus rendues par le navigateur (fluidité).

### ☁️ Synchronisation & fiabilité

- La **réserve (sideboard) ne bascule plus dans le deck principal** après une
  synchronisation cloud.
- **Cartes et decks supprimés** qui ne réapparaissent plus au rechargement.
- Badge **« Non synchronisé »** affiché si une sauvegarde cloud échoue (fini les
  erreurs avalées silencieusement).
- Protections anti-écrasement de données : coupure réseau, changement de compte,
  déconnexion pendant une sauvegarde en cours.
- Déconnexion plus fiable (l'état local est toujours nettoyé).

### 🎨 Interface

- Affichage **responsive** revu (mobile, tablette, large) — plus de débordements.
- Fenêtres d'import / export fermables avec la touche **Échap**.
- Messages d'erreur de connexion **en français** et plus explicites
  (e-mail déjà utilisé, identifiants incorrects, trop de tentatives…).

### 🔒 Sous le capot

- **Audit complet** multi-passes : 51 bugs confirmés, 47 corrigés (les restants
  sont des optimisations ou des choix de design, documentés).
- **Sécurité des données vérifiée** : chaque compte n'accède qu'à ses propres
  données (RLS active sur toutes les tables).
- ~**440 tests automatisés** au vert ; nettoyage de code mort ; fuites mémoire
  corrigées.

### 🔜 À venir

- Import / export de collection (CSV / Excel).
- Listes de decks des Dofus Mag et contenu « officiel ».
- Recensement des cartes promo manquantes.
