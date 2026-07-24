# Rôles de compte & édition des règles / errata — design

**Date** : 2026-07-24
**Statut** : validé (brainstorming), prêt pour plan d'implémentation
**Phase** : 2, **lot 1 sur 3** (voir « Découpage » ci-dessous)

## Origine

Demande produit, à la suite du retour de Tavoshel/BLOP :

> « Est-ce que l'on pourrait pas tout simplement filer des comptes "admin" à des mecs
> avec la capacité de modifier des trucs, genre éditer des cartes, les règles etc ?
> faudrait pour ça ajouter un système de droits de compte et des fonctionnalités de
> modification »

## Découpage

La demande couvre plusieurs sous-systèmes indépendants. Elle est découpée ; **ce spec ne
couvre que le lot 1**.

| Lot   | Contenu                                                                           | Difficulté | Statut      |
| ----- | --------------------------------------------------------------------------------- | ---------- | ----------- |
| **1** | **Rôles de compte + édition des règles et errata**                                | faible     | **ce spec** |
| 2     | Édition des **cartes** (1585 cartes en JSON statique compilé → couche d'override) | élevée     | spec à part |
| 3     | Historique / versions / revert                                                    | moyenne    | spec à part |

**Pourquoi le lot 2 est séparé** : les cartes vivent en JSON statique, passent par
`compile-effects`, un gate Zod et un cache `CACHE_KEY`. Les y éditer à la main demande une
architecture propre (override + fusion + invalidation du cache compilé) sans rapport avec
la simple pose d'un rôle. À noter par ailleurs que **les deux vrais problèmes de données
rencontrés jusqu'ici** (257 cartes à orbe stockées Neutre, errata invisibles) **ont été
corrigés par des scripts, pas à la main** : l'édition carte-par-carte pourrait résoudre un
problème qui ne se pose pas. À réexaminer au moment du lot 2.

## Décisions structurantes

| Décision               | Choix retenu                                                                                 | Raison                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Modèle de confiance    | **Un seul rôle `admin`**, écriture directe, sans validation                                  | Colle à la demande : le rôle n'est donné qu'à des gens connus                           |
| Attribution du rôle    | **En SQL par le propriétaire**, pas d'UI                                                     | Évite le problème d'amorçage (il faut un admin pour créer un admin) ; coût réel ≈ 30 s  |
| Périmètre errata       | **CRUD complet**                                                                             | Contenu curé, plus aucune source amont depuis la suppression d'`errata.json`            |
| Périmètre règles       | **Corriger le texte + ajouter des règles manquantes**, corpus ancré sur la source officielle | Répond au « il manque quelques points de règles » sans renoncer au re-scrape            |
| Survie des corrections | **Table d'overrides + vue de fusion**                                                        | Le re-scrape reste une opération anodine ; annuler une correction = supprimer une ligne |
| Traçabilité            | **Attribution simple** (`updated_by` / `updated_at`)                                         | Quasi gratuit ; l'historique complet est le lot 3                                       |

## Modèle de données

Migration `supabase/migrations/0013_admin_roles.sql`, idempotente, applicable au SQL Editor.

### Le rôle

```sql
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user','admin'));

-- Lue par TOUTES les policies d'écriture. `security definer` + search_path figé :
-- idiome déjà utilisé dans le projet (append_event, find_game_by_code).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
```

Attribution : `update public.profiles set role='admin' where user_id='…'`, exécuté par le
propriétaire dans le SQL Editor.

#### ⛔ Blocage obligatoire de l'auto-promotion — la partie critique de ce lot

La policy **existante** `profiles_update_own` (migration `0004`) est :

```sql
for update using (auth.uid() = user_id) with check (auth.uid() = user_id)
```

Elle n'impose **aucune restriction de colonne**. Ajouter `role` à cette table sans rien
faire d'autre signifie donc littéralement que **n'importe quel utilisateur connecté peut se
promouvoir administrateur** en mettant à jour son propre profil. C'est une élévation de
privilège complète, et c'est la conséquence la plus dangereuse de ce lot.

La migration **doit** donc, dans le même fichier que l'ajout de la colonne, retirer le
droit d'écriture sur cette seule colonne :

```sql
-- `role` n'est modifiable QUE par le propriétaire du projet (SQL Editor / service_role,
-- qui contourne les privilèges de colonne). PostgREST refuse tout UPDATE mentionnant une
-- colonne non accordée : `profiles_update_own` continue de fonctionner pour `username`.
revoke update (role) on public.profiles from anon, authenticated;
```

L'ordre compte : la colonne est ajoutée **puis** le droit est retiré, dans la même
migration, pour qu'il n'existe aucune fenêtre où `role` soit modifiable via l'API.

Le point 4 de `scripts/checkAdminRls.mjs` (voir « Vérification ») existe précisément pour
prouver que ce blocage tient en conditions réelles — et non parce qu'on l'a écrit.

### Corrections et ajouts de règles

```sql
create table if not exists public.rules_overrides (
  number     text primary key,   -- même clé que rules.number, ou une NOUVELLE règle
  kind       text check (kind in ('chapter','section','rule')),
  chapter    int,
  title      text,
  body       text,
  sort_order int,
  updated_by uuid references public.profiles (user_id),
  updated_at timestamptz not null default now()
);
```

`kind` / `chapter` / `sort_order` ne sont renseignés que pour une **règle ajoutée** (aucune
ligne importée en face). Pour une simple correction ils restent nuls et la vue reprend
ceux de l'import.

```sql
create or replace view public.rules_effective with (security_invoker = on) as
select
  coalesce(r.number, o.number)         as number,
  coalesce(o.kind, r.kind)             as kind,
  coalesce(o.chapter, r.chapter)       as chapter,
  coalesce(o.title, r.title)           as title,
  coalesce(o.body, r.body)             as body,
  coalesce(o.sort_order, r.sort_order) as sort_order,
  (o.number is not null)               as is_edited,
  r.body                               as body_official,  -- null si règle ajoutée
  o.updated_by,
  o.updated_at
from public.rules r
full outer join public.rules_overrides o using (number);
```

Le `full outer join` couvre les deux cas : correction (les deux lignes présentes) et ajout
(override seul). `security_invoker = on` fait s'appliquer la RLS des tables sous-jacentes
plutôt que les droits du propriétaire de la vue.

**Le gain concret** : `seedRules.mjs` peut conserver son `delete from rules` — il ne touche
jamais `rules_overrides`. Re-scraper le site officiel reste sans risque pour les
corrections, ce qui était la contrainte posée.

### Errata

`card_errata` gagne `updated_by uuid references public.profiles (user_id)`.

### Policies

| Table / vue       | Lecture                              | Écriture                                |
| ----------------- | ------------------------------------ | --------------------------------------- |
| `profiles.role`   | publique (déjà)                      | **aucune** via l'API — SQL uniquement   |
| `rules`           | anon (déjà)                          | `service_role` seulement (le seed)      |
| `rules_overrides` | anon                                 | `is_admin()` (insert / update / delete) |
| `card_errata`     | anon (déjà)                          | `is_admin()` (insert / update / delete) |
| `rules_effective` | hérite des tables (security_invoker) | — (vue)                                 |

## Neutralisation d'un piège créé en Phase 1

`scripts/seedErrata.mjs` (et `scripts/setupErrataRules.mjs` qui l'appelle) exécute
`delete from public.card_errata` avant d'insérer. C'était sans danger tant que le contenu
venait d'un fichier ; **dès que les admins créent des errata, ce script détruit leur
travail**.

Correctif inclus dans ce lot : **le seed refuse de tourner si `card_errata` n'est pas
vide**, sauf `--force` explicite. Même garde dans l'orchestrateur.

`seedRules.mjs` reste destructif sur `rules` — et c'est correct : les corrections vivent
dans `rules_overrides`, qu'il ne touche pas.

## Client

### Authentification

`authStore` gagne `role` et `isAdmin`, chargés depuis `profiles` à l'initialisation de
session (là où le pseudo est déjà lu).

⚠️ **`isAdmin` côté client ne sert QU'À afficher ou masquer l'UI.** La sécurité réelle est
la RLS : un bouton caché n'a jamais protégé quoi que ce soit. Toute écriture est refusée en
base pour un non-admin, même en forçant la route ou en appelant l'API directement.

### Routes

`/admin` (index), `/admin/errata`, `/admin/regles` — `meta: { requiresAdmin: true }`, lazy.

Le garde `beforeEach` s'étend d'une branche : non connecté → `/auth?redirect=`
(comportement existant) ; connecté **non admin** → écran **« Accès réservé »** explicite,
pas une redirection muette (une redirection silencieuse rend le diagnostic pénible, et
masquer la page n'apporte aucune sécurité).

### Lecture

`rulesService` lit désormais la vue `rules_effective` au lieu de la table `rules`, et
expose les champs supplémentaires `is_edited`, `body_official`, `updated_by`, `updated_at`.
Le tri devient **`(sort_order, number)`** — voir « Placement d'une règle ajoutée ».

`errataService` est inchangé (il lit toujours `card_errata`).

### Écriture

Nouveau `src/services/adminService.ts` : `upsertRuleOverride`, `deleteRuleOverride`,
`createErratum`, `updateErratum`, `deleteErratum`. Les écritures passent par le client
Supabase avec le JWT de l'utilisateur — **c'est la RLS qui tranche**, jamais le front.

### Fraîcheur du cache

`errataService` et `rulesService` chargent leur index **une seule fois** et le gardent en
mémoire ; après une écriture admin, l'app afficherait encore l'ancien contenu. Les deux
services exposent donc un **vrai `refresh()`** (aujourd'hui la remise à zéro est marquée
« tests uniquement »), appelé après chaque écriture réussie.

## Interface

### `/admin/errata`

CRUD complet : liste cherchable (réutilise l'index déjà chargé), **ajout** avec sélection
de carte par autocomplétion sur `cardStore`, **édition** en place, **suppression** derrière
le `ConfirmDialog` existant. Champs : date, source, résumé, avant, après.

### `/admin/regles`

Réutilise la liste et la recherche de `/regles/officielles`. Sur une règle :

- **corriger le texte** → écrit dans `rules_overrides`, avec le **texte officiel affiché en
  regard** ;
- **rétablir l'officiel** → supprime l'override (annuler est une suppression, pas une
  restauration devinée) ;
- **ajouter une règle manquante** → numéro, chapitre, titre / corps.

#### Placement d'une règle ajoutée

`sort_order` est un entier et on ne renumérote pas 532 lignes à chaque insertion. Une règle
ajoutée **reprend le `sort_order` de la règle qui la précède**, et la lecture trie par
**`(sort_order, number)`** : `418.5c` se range donc après `418.5b` sans toucher au reste.

### Côté lecteur (non-admin)

Rien ne change, **sauf** un point d'honnêteté : une règle dont le texte officiel a été
corrigé porte un **marqueur discret « corrigé »**, avec le texte officiel d'origine
consultable (`body_official` est dans la vue). Publier du texte modifié comme s'il était
l'officiel serait trompeur, sur une page intitulée « Règles officielles ».

## Dégradation

| Situation                           | Comportement                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Écriture refusée (RLS, réseau)      | Erreur **explicite**, la saisie est **conservée**. Jamais d'échec silencieux, jamais de formulaire vidé |
| Non-admin atteignant un écran admin | La base refuse ; l'UI affiche le refus plutôt que de simuler un succès                                  |
| Vue / tables injoignables           | Comportement déjà en place : index vide + état d'erreur explicite sur les pages publiques               |

## Vérification

Les tests unitaires **ne peuvent pas** prouver la RLS : ils moquent Supabase, donc ils
valident le code applicatif, pas la sécurité réelle.

**Livrable explicite : `scripts/checkAdminRls.mjs`**, exécuté contre la vraie base, qui
vérifie que :

1. un **anonyme** peut lire `rules_effective` et `card_errata` ;
2. un **anonyme** ne peut **pas** écrire dans `rules_overrides` ni `card_errata` ;
3. un **connecté non-admin** ne peut **pas** écrire non plus ;
4. un utilisateur ne peut **pas** se promouvoir admin en modifiant son propre profil.

C'est exactement le contrôle qui a rattrapé la Phase 1 : le seed passait en `service_role`,
qui **contourne** la RLS — sans lecture en anon, on aurait cru la policy bonne alors que
rien ne le prouvait.

Le reste : tests unitaires sur `adminService` (Supabase moqué) et sur le rafraîchissement
de cache ; tests de composants sur les écrans d'admin et sur le marqueur « corrigé » ; E2E
limité au comportement du garde de route (la base E2E est vide, comme en Phase 1).

## Hors périmètre de ce lot

- UI de gestion des comptes (attribution du rôle en SQL).
- Historique, versions, revert (lot 3).
- Édition des **cartes** (lot 2).
- Workflow de propositions / modération (écarté : modèle de confiance directe retenu).

## Risques

| Risque                                                                                                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-promotion** : la policy `profiles_update_own` (0004) n'a aucune restriction de colonne — ajouter `role` sans plus laisserait tout utilisateur se faire admin | `revoke update (role) on public.profiles from anon, authenticated;` **dans la même migration que l'ajout de la colonne**. Traité comme une exigence, pas comme un risque résiduel : voir « Blocage obligatoire de l'auto-promotion ». Prouvé en conditions réelles par le point 4 de `checkAdminRls.mjs`. **C'est le point de sécurité le plus important de ce lot.** |
| Un admin dégrade le texte officiel des règles                                                                                                                       | `body_official` conserve l'original, « rétablir l'officiel » est une suppression d'override, et le marqueur « corrigé » informe le lecteur                                                                                                                                                                                                                            |
| Le seed errata détruit le travail admin                                                                                                                             | Garde « refuse si non vide » + `--force` explicite                                                                                                                                                                                                                                                                                                                    |
| `is_admin()` en `security definer` mal cadrée                                                                                                                       | `search_path` figé à `public`, fonction `stable`, ne lit que `profiles`                                                                                                                                                                                                                                                                                               |
| Cache client périmé après écriture                                                                                                                                  | `refresh()` appelé après chaque écriture réussie                                                                                                                                                                                                                                                                                                                      |
