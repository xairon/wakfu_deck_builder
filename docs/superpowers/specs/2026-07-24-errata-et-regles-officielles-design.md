# Errata consultables & Règles officielles complètes — design

**Date** : 2026-07-24
**Statut** : validé (brainstorming), prêt pour plan d'implémentation
**Phase** : 1 / 2 (la Phase 2 « rôles de compte + édition en ligne » fera l'objet de son propre spec)

## Origine

Retour joueur (Tavoshel / BLOP, 22/07/2026) :

> « Il manque quelques points de règles, en tout cas sur le site. […] Et aussi pour
> les joueurs qui reviennent et ont un peu connu, on pourrait mettre la liste des
> errata : J'ai failli corriger Opée Tissoin et Aeron Zeklox, avant de remarquer
> que les deux avaient subi des errata, les descendant à 6 PA »

Deux manques distincts, confirmés par l'exploration du code :

1. **Les errata existent mais sont introuvables.** `public/data/errata.json` couvre déjà
   **66 cartes** — dont `opee-tissoin-incarnam` et `aeron-zeklox-incarnam`, exactement les
   deux citées. Ils ne sont affichés qu'à l'**ouverture** d'une carte (zoom / survol /
   panneau collection). Aucune page de liste, aucun repère visuel : rien ne signale
   qu'une carte a changé tant qu'on ne l'ouvre pas. D'où le « j'ai failli corriger ».
2. **La page Règles est une synthèse, pas une référence.** `src/data/rules.ts` contient
   **10 sections** rédigées à la main, là où les règles officielles
   (`wtcg-return.fr/regles/completes`) comptent **8 chapitres / 79 sections numérotées**.
   Manquent notamment : chapitre 8 entier (Réactions, File d'Attente, pouvoirs déclenchés
   et continus, modificateurs de remplacement), une grande partie du chapitre 4 (Panoplies,
   Métiers, Marqueurs, Redirections, Unicité, Simultanéités), les phases détaillées du
   combat (701-708) et les Règles de Portée (508).

## Objectif

Rendre les errata **découvrables** (liste globale + repère sur les cartes) et donner accès
aux **règles officielles complètes**, sans sacrifier la porte d'entrée pédagogique
existante.

## Décisions structurantes

| Décision                 | Choix retenu                                                           | Raison                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Portée des règles        | **Hybride** : on garde la synthèse ET on importe la référence complète | Couvre débutants et joueurs qui reviennent                                                                            |
| Stockage règles + errata | **Supabase** (pas de fichier statique)                                 | La Phase 2 rendra ce contenu éditable en ligne ; un snapshot git deviendrait un menteur dès la première édition admin |
| Cartes (1585)            | **Restent en JSON statique**                                           | Dataset importé en masse, jamais édité à la main, dépend de `compile-effects` + gate Zod + `CACHE_KEY`                |
| Attribution              | Mention visible + lien canonique par section                           | Cohérent avec ce qui est déjà fait pour cartes/images (Crédits, Mentions légales)                                     |

**Ligne de partage assumée** : contenu curé et éditable par des humains → base ;
dataset importé et compilé → statique. En Phase 2, « éditer une carte » passera
vraisemblablement par une couche d'**override** en base par-dessus le JSON, pas par un
déversement des 1585 cartes en base — mais c'est la Phase 2 qui tranchera.

## Modèle de données

Migration `supabase/migrations/0012_rules_errata.sql`, idempotente et applicable au
SQL Editor (convention du projet).

```sql
create table if not exists public.rules (
  number     text primary key,      -- "4" | "418" | "418.5b"  (= ancre de deep-link)
  kind       text not null check (kind in ('chapter','section','rule')),
  chapter    int  not null,
  title      text,                  -- renseigné pour chapter / section
  body       text,                  -- renseigné pour rule
  sort_order int  not null,         -- ordre de lecture global
  updated_at timestamptz not null default now()
);

create table if not exists public.card_errata (
  id          bigint generated always as identity primary key,
  card_id     text not null,        -- "opee-tissoin-incarnam"
  errata_date date,
  source      text,
  summary     text not null,
  before_text text,
  after_text  text,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists card_errata_card_id_idx on public.card_errata (card_id);
```

`number` est la clé primaire parce que c'est **l'ancre de deep-link** et la clé de
jointure conceptuelle avec le moteur, qui cite déjà ces numéros (`103.2a`, `418.5b`,
`508.x`, `706.5`).

`before_text` / `after_text` plutôt que `before` / `after` : mots réservés en SQL.

### RLS

Différence importante avec la table `cards` existante (`0008_cards.sql`), qui est en
`for select to authenticated` : **la page Règles et les badges doivent fonctionner sans
compte**. Donc, pour les deux tables :

- lecture : `for select using (true)` — anon inclus (même patron que `profiles_select_public`) ;
- écriture : réservée au `service_role` (le seed contourne RLS).

La policy d'écriture « admin » de la Phase 2 s'ajoutera **sans toucher au schéma**.

## Pipeline d'import

```
https://www.wtcg-return.fr/regles/completes
   └─ scripts/scrapeRules.ts
        ├─→ raw-card-data/pages/regles/completes.html   (INTRANT brut, versionné)
        └─→ seed table `rules` (service_role, gate Zod au seed)

public/data/errata.json
   └─ scripts/seedErrata.mjs ─→ table `card_errata` (migration one-shot)
        puis SUPPRESSION de public/data/errata.json
```

Le HTML brut reste en git : c'est l'**intrant** du scrape, jamais édité par un admin,
exactement comme `raw-card-data/pages` l'est déjà pour les cartes. Aucun risque de
divergence avec la base.

`errata.json` est consommé **puis retiré** : une seule source de vérité après migration.

Granularité confirmée sur la source : chaque sous-règle est un paragraphe distinct et
numéroté (`418.1`, `418.5`, `418.5a`, `418.5b`…), ce qui permet une ligne par règle.

## Lecture au runtime

Deux services symétriques, `src/services/rulesService.ts` et la réécriture de
`src/services/errataService.ts`.

**État réel de l'existant** (vérifié dans `src/services/errataService.ts`) : le service
charge **déjà** le fichier entier une seule fois (`ensureLoaded`), le met en cache mémoire,
et expose `getErrata(cardId)` de façon **synchrone** plus un `preloadErrata()`. Il ne fait
donc **pas** de requête par carte. Le chantier est par conséquent bien plus petit que
« réécriture » : seule la **source** change.

**Surface d'API d'`errataService`** :

- `fetchErrata(cardId)` et `getErrata(cardId)` : **conservées à l'identique** (mêmes
  signatures, même type `ErrataEntry[]`, `getErrata` reste synchrone). Les 4 consommateurs
  actuels ne changent pas d'une ligne.
- `preloadErrata()` : conservée, sert de point de chargement.
- `hasErrata(cardId): boolean` (**seul ajout**) : le prédicat du badge, O(1) sur l'index
  déjà en mémoire.
- Interne : `ensureLoaded()` remplace `fetch("/data/errata.json")` par une requête Supabase
  sur `card_errata`, regroupée par `card_id`.

Caractéristiques communes aux deux services :

- **un seul chargement de l'index complet**, pas de requête par entité ;
- cache mémoire + `localStorage` (`wakfu-rules-cache-v1`, `wakfu-errata-cache-v1`), patron
  déjà utilisé par `cardLoader` ;
- stratégie _stale-while-revalidate_.

### Pourquoi l'index complet (et pas une requête par carte)

Afficher un badge sur la grille imposerait sinon d'interroger les 1585 cartes une par une —
intenable. L'index entier (66 entrées, quelques Ko) chargé une seule fois sert **le badge,
le zoom, le survol et la page liste**. C'est déjà le comportement actuel avec le JSON
statique : on le préserve en changeant simplement la source.

### Régression assumée

Hors-ligne, un visiteur qui n'a **jamais** chargé la page n'aura ni règles ni errata (le
cache ne peut pas préchauffer). Le projet n'annonce pas l'offline (PWA = installable +
cache d'assets), donc c'est acceptable.

**Décision produit explicite (2026-07-24) : cette régression est acceptée et le sujet est
clos.** Aucun préchargement au build ne sera mis en place. Ne pas rouvrir ce point sans
nouvelle demande — le coût (préchargement + double source) ne vaut pas le bénéfice ici.

## Interface

### `/regles` (existant, inchangé)

Reste la **synthèse pédagogique** : les 10 sections rédigées + le glossaire. Porte
d'entrée des nouveaux joueurs. Ajout d'un lien visible vers la référence complète.

### `/regles/officielles` (nouveau)

Référence complète :

- sommaire par chapitre (8 chapitres) ;
- recherche plein-texte, en réutilisant `matchesSearch` (`src/utils/text.ts`) ;
- **chaque règle ancrée par son numéro** → `/regles/officielles#418.5b` est un lien
  partageable ;
- attribution visible + lien canonique vers la source.

Route séparée (et non un onglet) pour le deep-link et le lazy-load — le routeur est déjà
lazy.

Bénéfice différé : le moteur cite déjà ces numéros dans ses messages ; ils pourront
devenir cliquables plus tard sans rien re-concevoir.

### `/errata` (nouveau)

- les 66 cartes erratées (1 errata par carte) ;
- recherche par nom de carte — le chemin rapide pour « cette carte a-t-elle changé ? » ;
- **groupé par extension par défaut**, alphabétique à l'intérieur de chaque groupe ;
- tri par date décroissante disponible en option (lecture chronologique) ;
- par entrée : vignette, date, source, résumé, et le **avant / après** ;
- lien vers la carte.

**Pourquoi pas la date par défaut** (décidé sur la donnée, pas à l'intuition) : les 66
errata se répartissent sur **15 dates très déséquilibrées** — `01/12/2010` (18),
`13/10/2009` (14), `10/11/2010` (7), soit 59 % sur trois dates — et tout est daté
2009-2011. Un tri chronologique produit donc des paquets bancals sans valeur de
navigation : pour un joueur qui revient, _tout_ est également ancien. Le regroupement par
extension (Incarnam 32, Dofus Collection 13, Amakna 7, Bonta-Brakmar 6, Astrub 4,
Pandala 4) donne 6 groupes équilibrés et reprend l'axe d'organisation déjà utilisé
partout ailleurs dans l'app.

### Badge « Erraté »

Sur la vignette en collection et sur les lignes du deck builder (`DeckCardRow`,
`ReserveRow`, `CardPool`). C'est ce qui règle le piège décrit : voir qu'une carte a changé
**sans avoir à l'ouvrir**. Coût nul en requêtes (index déjà chargé).

## Dégradation

| Situation                       | Comportement                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base injoignable, cache présent | On sert le cache ; l'utilisateur ne voit rien                                                                                                    |
| Base injoignable, aucun cache   | État d'erreur **explicite** sur `/regles/officielles` et `/errata` (« Règles indisponibles — vérifiez votre connexion »). Jamais de page blanche |
| Index errata en échec           | Les badges ne s'affichent pas ; le zoom se comporte comme pour une carte sans errata                                                             |

Principe : **une panne d'errata ne doit jamais casser la collection ni le deck builder.**
La dégradation y est silencieuse ; elle n'est explicite que sur les pages dont c'est le
sujet.

## Tests

- **Unitaires** — `rulesService` / `errataService` : cache hit/miss, repli, indexation par
  `card_id`, prédicat du badge, parsing des numéros de règle.
- **Composants** — `ErrataView` (rendu des entrées, avant/après), `RulesOfficialView`
  (sommaire, ancres, filtre de recherche), badge présent sur carte erratée / absent sinon.
- **E2E Playwright** — `/errata` : recherche d'une carte ; `/regles/officielles#418.5b` :
  le deep-link défile jusqu'à la règle.
- **Seeds** — gate Zod **au moment du seed** : on échoue bruyamment plutôt que de peupler
  la base avec du contenu mal parsé. Les schémas vivent dans `src/schema/` (convention du
  projet : Zod = source unique de vérité, cf. `src/schema/cards.ts`), et sont réutilisés
  par les services au runtime pour valider ce qui sort de la base.

## Périmètre de modification

Dans `errataService`, seul le **corps d'`ensureLoaded()`** change (source JSON → Supabase),
plus l'ajout de `hasErrata()`. Les signatures publiques étant préservées, ses 4
consommateurs — `CardZoomInner.vue`, `CardZoomModal.vue`, `CardHoverPreview.vue`,
`CollectionView.vue` — **ne sont pas modifiés**. Leurs tests existants doivent continuer à
passer tels quels ; ils servent de filet de régression (seul le mock de source change).

Fichiers réellement touchés : nouvelle migration `0012_rules_errata.sql`, deux scripts
(`scrapeRules.ts`, `seedErrata.mjs`), nouveau `rulesService.ts`, `errataService.ts`
(source + `hasErrata`), deux nouvelles vues + deux routes, badge dans les composants de
liste, suppression de `public/data/errata.json` et de son JSON Schema.

## Hors périmètre (Phase 2)

- Rôles de compte (`profiles.role`) et garde de route admin.
- Écrans d'édition en ligne (règles, errata, cartes) et modération.
- Décision sur l'édition des **cartes** (couche d'override en base vs autre mécanisme).

## Risques

| Risque                                               | Mitigation                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Le parsing du scrape rate des sous-règles            | Gate Zod au seed + contrôle du nombre de sections (8 chapitres / 79 sections attendus)                                          |
| Reproduction du texte officiel                       | Attribution visible + lien canonique par section ; cohérent avec l'usage déjà en place pour cartes/images                       |
| Régression sur les 4 consommateurs d'`errataService` | Tests existants conservés et adaptés ; l'API du service reste `fetchErrata(cardId)` en surface, seule son implémentation change |
