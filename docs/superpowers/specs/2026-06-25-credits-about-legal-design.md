# Crédits, À propos, Premiers pas & Pages légales — Design

**Date:** 2026-06-25
**Statut:** Design validé (« go fait au mieux » utilisateur)
**Branche:** `feat/home-redesign`

## Problème

L'application ne rend pas explicite **pourquoi** elle existe ni **à qui** elle rend
hommage, et n'expose aucune des pages « institutionnelles » attendues d'un site
public :

- Pas de **crédits** (Ankama, et surtout **Safranil** / wtcg-return.fr dont
  l'app réutilise les illustrations de cartes et les listes de decks).
- Pas de page **« À propos »** expliquant la mission : hommage au Wakfu TCG et au
  travail d'Ankama, complément du travail de Safranil, et ce que l'app ajoute
  (répertoire des decks Dofus Mag, accès au contenu des cartes, gestion de
  collection, partage entre membres du Discord, module de jeu).
- Pas de **mentions légales** ni de **CGU**.
- Pas de lien vers le **Discord** de la communauté.
- Aucun **footer** : `App.vue` n'a qu'un masthead/header, donc aucun endroit
  naturel pour surfacer ces pages.
- « Apprendre à jouer » n'a pas de point d'entrée guidé (un tutoriel jouable
  existe pourtant déjà sur `/play/table`).

## Décisions (validées)

1. **Navigation** : ajouter un **footer de site** global (hub des nouvelles pages).
2. **Pages légales** : rédigées avec des **placeholders** clairs
   (`[VOTRE NOM / PSEUDO]`, `[EMAIL DE CONTACT]`…) que l'utilisateur remplira ;
   hébergeur pré-rempli (Vercel). Texte **original** (non copié de wtcg-return),
   cadré « projet de fan non-commercial », avec avertissement « modèle à faire
   relire, pas un conseil juridique ».
3. **Apprendre à jouer** : page **« Premiers pas »** concise renvoyant au tutoriel
   jouable existant (`/play/table`).
4. **Auteur crédité** : **Safranil** (site « Wakfu TCG Return », wtcg-return.fr).

## Architecture

### Routes (toutes `meta: { guest: true }`)

| Route               | Vue                   | Rôle                                                         |
| ------------------- | --------------------- | ------------------------------------------------------------ |
| `/a-propos`         | `AboutView.vue`       | Mission / hommage / ce que l'app apporte.                    |
| `/credits`          | `CreditsView.vue`     | Ankama · Safranil · communauté Discord · technologies.       |
| `/regles/apprendre` | `FirstStepsView.vue`  | Guide « Premiers pas » → CTA vers le tutoriel `/play/table`. |
| `/mentions-legales` | `LegalNoticeView.vue` | Mentions légales (placeholders).                             |
| `/cgu`              | `TermsView.vue`       | Conditions générales d'utilisation (placeholders).           |

`/regles` (RulesView) est conservé. On y ajoute une **vérification des écarts**
(gap-check) du contenu rules + glossaire face à la version en ligne
(`wtcg-return.fr/regles/completes` et `/glossaire`) et l'ajout des entrées
manifestement manquantes, plus un lien vers « Premiers pas ».

### Fichiers

| Fichier                                        | Rôle                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/layout/SiteFooter.vue` (créer) | Footer global (colonnes de liens + disclaimer + bouton Discord).        |
| `src/App.vue` (éditer)                         | Monter `<SiteFooter>` sous `<main>` (masqué pendant loading/erreur).    |
| `src/config/links.ts` (créer)                  | Liens externes : `DISCORD_INVITE_URL`, `WTCG_RETURN_URL`, `ANKAMA_URL`. |
| `src/router/index.ts` (éditer)                 | Ajouter les 5 routes (+ `/regles/apprendre`).                           |
| `src/views/AboutView.vue` (créer)              | Page « À propos ».                                                      |
| `src/views/CreditsView.vue` (créer)            | Page « Crédits » (consomme `src/data/credits.ts`).                      |
| `src/data/credits.ts` (créer)                  | Données structurées des crédits (testable).                             |
| `src/views/FirstStepsView.vue` (créer)         | Page « Premiers pas » (consomme `src/data/firstSteps.ts`).              |
| `src/data/firstSteps.ts` (créer)               | Étapes structurées du guide débutant (testable).                        |
| `src/views/LegalNoticeView.vue` (créer)        | Mentions légales.                                                       |
| `src/views/TermsView.vue` (créer)              | CGU.                                                                    |

### Footer — structure

Colonnes :

- **Le projet** : À propos · Crédits
- **Le jeu** : Premiers pas · Règles & glossaire · Decks officiels
- **Communauté** : Discord (lien externe ↗) · Decks de la communauté
- **Légal** : Mentions légales · CGU

Ligne de bas de page (disclaimer) :

> Projet de fan **non-officiel**, hommage au Wakfu TCG. Wakfu TCG © Ankama.
> Illustrations et listes de cartes grâce au travail de **Safranil** —
> wtcg-return.fr.

\+ un bouton/lien Discord mis en avant.

Liens externes : `target="_blank"`, `rel="noopener noreferrer"`.

### Contenu « À propos »

Narratif propre et pro :

1. **L'hommage** — projet de fan qui célèbre le Wakfu TCG et le travail d'Ankama ;
   explicitement **non-officiel**.
2. **Dans la continuité de Safranil** — construit sur et en complément du travail
   partagé sur wtcg-return.fr (illustrations des cartes + listes de decks).
3. **Ce que cette app apporte** (cartes de features) :
   - répertorier les decks listés par Ankama dans les **Dofus Mag** (base
     `dofusMagDecks`),
   - rendre **tout le contenu des cartes** accessible (catalogue / collection),
   - **gestion de collection**,
   - **partage de decks** entre membres du Discord,
   - **module de jeu** (table jouable + tutoriel).
4. CTA : rejoindre le Discord + créer un compte.

### Contenu « Crédits » (`src/data/credits.ts`)

Entrées structurées :

- **Ankama** — créateurs de Wakfu et du Wakfu TCG ; univers, cartes et
  illustrations originales (lien ankama.com).
- **Safranil — Wakfu TCG Return** — remerciement appuyé : son site, le partage
  des **illustrations des cartes** et des **listes de decks**, sans lequel cette
  app n'existerait pas (lien wtcg-return.fr).
- **La communauté Discord** — joueurs, testeurs, contributions de listes Dofus Mag.
- **Technologies** — Vue, Pinia, Supabase, Tailwind/DaisyUI, Tauri (bref).

### Contenu « Premiers pas » (`src/data/firstSteps.ts`)

Suite d'étapes courtes (but du jeu, mise en place, déroulé d'un tour, première
attaque, comment gagner), chacune renvoyant aux Règles complètes pour le détail,
et un CTA proéminent vers le **tutoriel jouable** (`/play/table`).

### Pages légales (placeholders)

Texte original, cadre « projet de fan non-commercial », disclaimer IP Ankama fort.

- **Mentions légales** : éditeur (`[VOTRE NOM / PSEUDO]`, `[EMAIL DE CONTACT]`),
  directeur de la publication, hébergeur (Vercel Inc. — pré-rempli), propriété
  intellectuelle (univers/cartes © Ankama ; rien d'affilié/approuvé par Ankama).
- **CGU** : objet, accès au service (gratuit, « tel quel »), comptes & données
  (Supabase), contenu utilisateur (collections/decks), propriété intellectuelle,
  limitation de responsabilité, données personnelles, modification des CGU,
  contact.
- Encart visible : « Modèle à faire relire — ne constitue pas un conseil
  juridique. »

## Flux de données / cas limites

- Footer **statique** : aucune dépendance aux stores ; s'affiche dès que l'app
  n'est ni en chargement ni en erreur (même condition que `<main>`).
- Données crédits/premiers-pas en **modules `as const`** (pas de fetch).
- Liens externes ouverts dans un nouvel onglet avec `rel="noopener noreferrer"`.

## Tests (TDD)

- `tests/components/layout/SiteFooter.spec.ts` — rend les liens Légal/Communauté ;
  `href` Discord correct ; liens externes en `rel="noopener"`.
- `tests/data/credits.spec.ts` — présence de **Safranil** et **Ankama** ; lien
  wtcg-return présent.
- `tests/views/FirstStepsView.spec.ts` — rend les étapes + lien vers `/play/table`.
- Smoke routeur : les 5 nouvelles routes résolvent en `guest`.
- Vérification visuelle en **preview** (clair/sombre, responsive) ; finition via
  skill **frontend-design** si besoin.

## Hors périmètre (YAGNI)

- Pas de guide « apprendre à jouer » illustré multi-étapes complet.
- Pas de restructuration de `/regles` en hub multi-pages.
- Pas de vraies données légales (placeholders uniquement).
- Pas de CMS / contenu éditable.
- Pas de page « FAQ » ou « contact » dédiée (le contact passe par les mentions
  légales + Discord).
