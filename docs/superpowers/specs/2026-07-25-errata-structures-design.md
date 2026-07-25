# Errata structurés & édition en place — design

**Date** : 2026-07-25
**Statut** : validé (brainstorming), prêt pour plan d'implémentation

## Origine

Demande produit :

> « Faudrait qu'un admin puisse modifier des éléments directement où ils sont, donc dans la
> collection par exemple modifier une carte, et il faudrait qu'on ai toujours les
> différentes versions, genre dans la collection un errata devrait être une option pour
> jouer ou imprimer la carte par exemple, donc le texte de base et les erratas »

## Ce que l'exploration a établi (et qui a redéfini la demande)

Trois constats factuels, vérifiés avant toute conception :

1. **Les données affichées sont DÉJÀ la version erratée.** Le scrape vient du site officiel,
   qui publie l'état à jour. Vérifié : Opée Tissoin a `stats.pa = 6` (l'errata dit « 7 → 6 ») ;
   Trêve porte `Unique` dans ses `subTypes` ; Kwakoiffe porte `Armure` ; Incarnam dit
   « Bannissez » (et non « Détruisez »).
2. **Les images aussi.** Le scan d'Opée Tissoin affiche **PA 6**, la valeur d'après errata,
   alors que la carte porte « © 2009 Ankama ». Il n'existe donc **aucune image** de la
   version imprimée d'origine.
3. **La version d'origine n'existe nulle part en donnée structurée** — uniquement en prose,
   dans `card_errata.before_text`.

**Conséquence** : « jouer ou imprimer avec la version de base » n'était pas réalisable tel
quel — il aurait fallu un générateur de rendu de carte (proxy) pour produire une image
inexistante. Après clarification, le besoin réel est **la référence** : montrer précisément
l'écart entre la carte physique que le joueur a en main et la version à jouer.

Constat annexe : **les errata ne touchent pas tous le même champ** — tantôt une stat
(`stats.pa`), tantôt la ligne de type (`subTypes`), tantôt le texte d'un effet. Un errata
n'est donc pas « un texte » mais « tel champ passe de X à Y », parfois plusieurs à la fois.

## Décisions structurantes

| Décision                   | Choix retenu                           | Raison                                                                                       |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Nature des versions        | **Référence, pas version jouable**     | Le besoin est de comprendre l'écart ; la version d'origine n'existe ni en donnée ni en image |
| Structuration              | **Champ par champ**, additive          | Un errata devient « quel champ, de quoi à quoi » — affichable précisément                    |
| Migration des 66 existants | **Progressive**, pas bloquante         | `changes` vide → affichage prose actuel ; on structure au fil de l'eau                       |
| Édition en place           | **L'errata de la carte**, pas la carte | Éditer les cartes exigerait une couche d'override + casserait l'automatisation des effets    |
| Historique                 | **Déjà acquis** (`admin_audit`)        | Chaque écriture stocke `before_data`/`after_data` — les versions sont conservées             |

### Pourquoi PAS l'édition des données de carte

Écartée délibérément. Les 1585 cartes vivent en JSON statique, compilé par
`scripts/compileEffects.ts` (`effects[].compiled`) puis caché (`CACHE_KEY`). Un texte
d'effet édité au runtime **n'a pas de forme compilée** : le moteur retombe sur le mode
manuel (dégradation propre — la table n'est jamais bloquée — mais l'automatisation de la
carte est perdue ; 473 effets sont automatisés aujourd'hui).

À noter aussi : les deux vrais problèmes de données rencontrés sur ce projet (257 cartes à
orbe stockées Neutre, errata invisibles) ont été corrigés **par script**, pas à la main.
Une UI d'édition carte-par-carte n'aurait pas aidé.

## Modèle de données

Migration `supabase/migrations/0014_errata_changes.sql`, idempotente.

```sql
alter table public.card_errata
  add column if not exists changes jsonb not null default '[]'::jsonb;
```

Forme d'un élément de `changes` :

```json
{ "label": "PA", "before": "7", "after": "6" }
```

- `label` : nom du champ tel qu'il est montré au joueur (« PA », « Sous-types », « Effet »).
  Libre, pas une énumération — les errata touchent des champs variés et le libellé officiel
  prime sur une taxonomie interne.
- `before` / `after` : **chaînes**, telles qu'affichées. Pas de typage par champ : on affiche,
  on ne recalcule rien (aucune version alternative n'est reconstituée).

Un errata peut porter **plusieurs** changements (Incarnam : un effet **et** l'ajout de _Unique_).

`summary`, `before_text`, `after_text` sont **conservés** : `changes` est additif. Un errata
dont `changes` est vide reste parfaitement affichable — c'est l'état des 66 existants au
départ.

### Schéma Zod

`errataChangeSchema` = `{ label: string (min 1), before: string, after: string }`,
`changes: z.array(errataChangeSchema).default([])` ajouté à `errataRowSchema`
(`src/schema/rules.ts`). Le type public `ErrataEntry` (`src/services/errataService.ts`)
gagne `changes: ErrataChange[]`.

### RLS

Inchangée : lecture anon, écriture `is_admin()`. La colonne suit la table.

## Affichage

### Composant partagé `ErrataPanel`

Les errata sont aujourd'hui rendus par **deux chemins distincts** :

- `src/components/card/CardZoomInner.vue` — bloc « Errata » (les données lui arrivent en
  prop depuis `CardZoomModal.vue`, qui appelle `fetchErrata`) ;
- `src/views/CollectionView.vue` — son propre panneau, avec son propre appel.

C'est un piège connu du projet (cf. la note « dual effect render paths ») et la revue du
lot précédent a justement pointé la duplication `RulesOfficialView` / `AdminRulesView`
comme le meilleur candidat à la mutualisation.

**On n'écrit donc la logique qu'une fois** : `src/components/card/ErrataPanel.vue`, qui
remplace le bloc dans `CardZoomInner.vue` **et** le panneau dans `CollectionView.vue`.

### Ce qu'il rend

Quand `changes` est renseigné :

> **Carte corrigée officiellement** — 05/10/2011
>
> | Champ | Version imprimée | À jouer |
> | ----- | ---------------- | ------- |
> | PA    | 7                | **6**   |
>
> _Source : Forum officiel Wakfu_

La colonne s'appelle **« Version imprimée »** et non « Sur ta carte » : l'image affichée
juste à côté montre **déjà la valeur corrigée** (constat 2 ci-dessus). Dire « sur ta carte »
contredirait visuellement l'image et induirait le lecteur en erreur ; « version imprimée »
désigne les exemplaires physiques anciens, ce qui est exact.

Quand `changes` est vide : repli sur l'affichage actuel (résumé + avant/après en prose).
Aucun errata ne devient invisible pendant la structuration progressive.

## Édition en place

Sur la fiche d'une carte, si `authStore.isAdmin` : une affordance discrète
**« Éditer l'errata »** — ou **« Ajouter un errata »** si la carte n'en a pas — ouvre le
formulaire sans quitter la collection.

**Le formulaire est extrait de `AdminErrataView` en composant partagé** (`ErrataForm.vue`),
avec deux points d'entrée : l'écran `/admin/errata` et la fiche de carte. Une seule
implémentation, donc pas de divergence possible entre les deux.

Le formulaire gagne l'édition de `changes` : ajouter / retirer une ligne
(libellé, avant, après).

Après écriture réussie : `refreshErrata()`, le panneau se met à jour sur place, toast de
succès. En cas de refus : message d'erreur explicite, saisie conservée (règle déjà en
vigueur sur tous les écrans d'admin).

⚠️ L'affordance dépend de `isAdmin` **pour l'affichage uniquement**. La RLS reste la seule
barrière réelle : un non-admin qui forcerait l'appel serait refusé par la base.

## Historique

**Rien à construire.** `admin_audit` (migration `0013`) stocke `before_data` et `after_data`
en JSONB à chaque écriture sur `card_errata`, via trigger. Chaque version successive d'un
errata est donc déjà conservée, et infalsifiable depuis l'API.

Le panneau, côté admin, porte un lien **« historique »** vers `/admin/journal` filtré sur
cette entité.

## Dégradation

| Situation                                | Comportement                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `changes` vide                           | Affichage prose (résumé + avant/après) — l'état de départ des 66 errata             |
| `changes` mal formé (parse Zod en échec) | La ligne fautive est ignorée ; le reste s'affiche. Jamais d'exception               |
| Écriture refusée (RLS, réseau)           | Erreur explicite, saisie conservée                                                  |
| Index errata indisponible                | Comportement actuel : pas de panneau, pas de badge ; la collection n'est pas cassée |

## Vérification

- **Composant `ErrataPanel`** : rend le tableau quand `changes` est renseigné ; retombe sur
  la prose quand il est vide (les deux cas testés, y compris l'absence du tableau).
- **Édition en place** : un non-admin ne voit **aucune** affordance (test d'absence) ; un
  admin la voit et l'écriture appelle bien le service.
- **Les deux chemins de rendu** (`CardZoomModal`, `CollectionView`) affichent le panneau —
  garanti par construction (même composant), plus un test sur chacun.
- **Schéma** : `changes` par défaut `[]`, une ligne invalide n'invalide pas l'errata entier.
- E2E : hors périmètre utile ici (la base E2E est vide, aucun admin — les gardes de route
  sont déjà couvertes par le lot précédent).

## Hors périmètre

- **Version jouable / imprimable d'origine** — écartée sur constat factuel (ni donnée ni
  image d'origine ; exigerait un générateur de rendu de carte).
- **Édition des données de carte** — écartée (override + perte d'automatisation des effets).
- **Restauration d'une version antérieure** depuis le journal (le journal reste consultable).
- Structuration de masse des 66 errata existants : progressive, au fil de l'eau.

## Risques

| Risque                                                            | Mitigation                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| « Version imprimée » contredit l'image affichée                   | Libellé choisi précisément pour ça ; l'image montre la version à jour, la colonne parle des exemplaires physiques anciens                     |
| Duplication entre les deux chemins de rendu                       | Un seul composant partagé, consommé par les deux — la duplication est structurellement impossible                                             |
| Divergence entre le formulaire admin et celui de la fiche         | Un seul composant `ErrataForm`, deux points d'entrée                                                                                          |
| `changes` saisi à la main → incohérent avec la donnée de la carte | Accepté : `changes` est **déclaratif** (référence), il ne pilote aucun calcul ni rendu de carte. Une incohérence est visible, pas silencieuse |
