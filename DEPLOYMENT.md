# Déploiement en production

Wakfu Deck Builder est une **application web cloud** : l'inscription, la
connexion et les données (collection + decks) reposent sur **Supabase**.
Un backend Supabase est donc **requis** (offre gratuite suffisante).

Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, l'application affiche un
écran « Configuration requise ».

---

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project** (plan gratuit).
2. Dans **Project Settings → API**, récupérez :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
     (clé **publique** par conception ; ne jamais utiliser la clé `service_role`
     côté frontend.)

## 2. Créer le schéma + la sécurité (RLS)

Dans **SQL Editor → New query**, exécutez **dans l'ordre** chaque fichier de `supabase/migrations/` :

1. [`0001_init.sql`](supabase/migrations/0001_init.sql) — tables `collections` et `decks` + RLS (requis).
2. [`0002_game.sql`](supabase/migrations/0002_game.sql) — tables du module de jeu en ligne (partie event-sourcée, serveur autoritatif).
3. [`0003_public_decks.sql`](supabase/migrations/0003_public_decks.sql) — galerie de decks publics (`decks.is_public`, lecture publique opt-in).
4. [`0004_profiles.sql`](supabase/migrations/0004_profiles.sql) — pseudos publics (auteur affiché sur les decks publiés).
5. [`0005_deck_publication.sql`](supabase/migrations/0005_deck_publication.sql) — fiche éditoriale d'un deck publié (catégorie, accroche, guide).

Chaque script active la Row Level Security et garantit que chaque utilisateur
n'accède qu'à ses propres données.

> Vérification : **Table Editor** doit lister au minimum `collections` et `decks`.

## 3. Configurer l'authentification

- **Authentication → Providers → Email** : activé.
- **Confirmation d'e-mail** (**Confirm email**) :
  - **Activée** (recommandé en prod) : l'utilisateur reçoit un e-mail de
    confirmation à l'inscription ; l'app affiche « Vérifiez votre e-mail », et la
    connexion se fait après clic sur le lien.
  - **Désactivée** : l'utilisateur est connecté immédiatement après inscription
    (pratique en développement / pour tester).
- **Authentication → URL Configuration** :
  - **Site URL** = l'URL de production (ex. `https://votre-app.vercel.app`).
  - **Redirect URLs** : ajoutez l'URL de prod **et** `http://localhost:4173`
    (preview) / `http://localhost:3000` (dev) pour que les liens de confirmation
    et de réinitialisation reviennent au bon endroit.

## 4. Variables d'environnement

En local, copiez `.env.example` → `.env` :

```dotenv
VITE_SUPABASE_URL=https://votreprojet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # clé "anon public"
```

Sur **Vercel → Settings → Environment Variables**, ajoutez les deux mêmes
variables (Production + Preview), puis **redeploy**.

## 5. Déployer sur Vercel

1. Pousser le dépôt sur GitHub.
2. [vercel.com](https://vercel.com) → **Add New… → Project** → importer le dépôt.
3. Vercel détecte Vite (`vercel.json` fourni) : build `npm run build`, sortie `dist`,
   fallback SPA → `index.html`.
4. **Deploy**.

## 6. Vérifier en production

1. Ouvrez l'app → **Connexion → Inscription** → créez un compte.
   - Si la confirmation e-mail est activée : confirmez via l'e-mail reçu.
2. Connectez-vous, ajoutez des cartes à la collection, créez un deck.
3. Supabase → **Table Editor → collections / decks** : vos lignes apparaissent.
4. Connectez-vous depuis un autre navigateur/appareil : la même collection et les
   mêmes decks apparaissent (synchro cloud).

---

## Modèle de données & synchronisation

- **Source de vérité : Supabase.** À la connexion, la collection et les decks
  sont chargés depuis le cloud ; à chaque modification, ils y sont repoussés
  (best-effort, différé).
- **Cache local (PWA) :** une copie est conservée dans le navigateur (clé par
  utilisateur) pour l'affichage immédiat et un usage hors-ligne en lecture. Le
  cloud reste prioritaire au rechargement (stratégie « dernier écrit gagne » via
  `updated_at`).
- **Conflit hors-ligne :** des modifications faites hors-ligne peuvent être
  écrasées par le cloud au prochain chargement en ligne (limite assumée v1).

## Sécurité

- N'exposez jamais la clé `service_role` côté frontend — uniquement `anon public`.
- La sécurité des données repose sur la **RLS** : ne désactivez pas les policies
  du script SQL.
- En-têtes de sécurité définis dans `vercel.json`.

## Desktop (optionnel, Tauri)

```bash
npm run tauri:build   # installeurs .exe (NSIS) / .msi (Wix)
```

Les variables `VITE_SUPABASE_*` sont injectées au build, comme pour le web.
