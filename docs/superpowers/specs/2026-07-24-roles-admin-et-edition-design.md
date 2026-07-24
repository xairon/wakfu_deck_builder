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

| Décision               | Choix retenu                                                                                       | Raison                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Modèle de confiance    | **Écriture directe, sans validation** — `owner` / `admin` / `user`                                 | Colle à la demande : le rôle n'est donné qu'à des gens connus                            |
| Attribution du rôle    | **Page `/admin/comptes` réservée à l'`owner`** ; le rôle `owner` lui-même se pose en SQL, une fois | Résout l'amorçage sans permettre à un admin de révoquer le propriétaire                  |
| Périmètre errata       | **CRUD complet**                                                                                   | Contenu curé, plus aucune source amont depuis la suppression d'`errata.json`             |
| Périmètre règles       | **Corriger le texte + ajouter des règles manquantes**, corpus ancré sur la source officielle       | Répond au « il manque quelques points de règles » sans renoncer au re-scrape             |
| Survie des corrections | **Table d'overrides + vue de fusion**                                                              | Le re-scrape reste une opération anodine ; annuler une correction = supprimer une ligne  |
| Traçabilité            | **Journal append-only** (`admin_audit`) écrit par des **triggers**, consultable et filtrable       | Un journal écrit par le client peut ne pas l'être ; la restauration reste hors périmètre |

## Modèle de données

Migration `supabase/migrations/0013_admin_roles.sql`, idempotente, applicable au SQL Editor.

### Le rôle

```sql
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user','admin','owner'));

-- Lue par TOUTES les policies d'écriture de contenu. `owner` peut tout ce que peut
-- `admin`. `security definer` + search_path figé : idiome déjà utilisé dans le
-- projet (append_event, find_game_by_code).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('admin','owner')
  );
$$;

-- Gestion des comptes : réservée au propriétaire.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'owner'
  );
$$;
```

### Trois niveaux

| Rôle    | Édite règles / errata | Gère les comptes | Comment on l'obtient            |
| ------- | --------------------- | ---------------- | ------------------------------- |
| `user`  | non                   | non              | par défaut                      |
| `admin` | **oui**               | non              | promu par l'`owner` depuis l'UI |
| `owner` | oui                   | **oui**          | **SQL uniquement**, une fois    |

Conséquence voulue : **aucun admin ne peut révoquer le propriétaire ni se promouvoir
`owner`** — le rôle `owner` n'est jamais attribuable via l'API (voir la RPC ci-dessous).

**Amorçage, une seule fois** : `update public.profiles set role='owner' where user_id='…'`
dans le SQL Editor. C'est le seul rôle posé à la main — les `admin` sont ensuite promus
depuis `/admin/comptes`.

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
-- qui contourne les privilèges de colonne) ou via set_user_role(). PostgREST refuse toute
-- requête mentionnant une colonne non accordée : `profiles_update_own` continue de
-- fonctionner pour `username`, et la colonne prend sa valeur par défaut ('user') à
-- l'insertion.
revoke update (role) on public.profiles from anon, authenticated;
revoke insert (role) on public.profiles from anon, authenticated;
```

⚠️ **Les DEUX `revoke` sont nécessaires.** Bloquer seulement l'`UPDATE` laisserait une
seconde voie d'escalade : la policy `profiles_insert_own` (`0004`) autorise un utilisateur
à **créer sa propre ligne de profil**, et `profileService.setUsername()` fait précisément un
`upsert`. Sans `revoke insert (role)`, il suffirait de créer son profil avec
`role: 'admin'` pour devenir administrateur. C'est le même trou que l'auto-promotion par
update, par une porte différente.

L'ordre compte : la colonne est ajoutée **puis** les droits sont retirés, dans la même
migration, pour qu'il n'existe aucune fenêtre où `role` soit écrivable via l'API.

Le point 4 de `scripts/checkAdminRls.mjs` (voir « Vérification ») existe précisément pour
prouver que ce blocage tient en conditions réelles — et non parce qu'on l'a écrit.

### Attribuer un rôle depuis l'UI (réservé à l'`owner`)

Le `revoke` ci-dessus ferme l'écriture directe de `role` **pour tout le monde**. La page de
gestion des comptes passe donc par une RPC contrôlée, seul chemin d'attribution :

```sql
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Réservé au propriétaire';
  end if;
  -- `owner` n'est JAMAIS attribuable via l'API : il se pose en SQL, une fois.
  if p_role not in ('user','admin') then
    raise exception 'Rôle non attribuable : %', p_role;
  end if;
  -- On ne rétrograde pas un owner (y compris soi-même) : sinon le projet peut
  -- se retrouver sans personne pour gérer les comptes.
  if exists (select 1 from public.profiles
             where user_id = p_user_id and role = 'owner') then
    raise exception 'Le propriétaire ne peut pas être modifié depuis l''UI';
  end if;

  update public.profiles set role = p_role where user_id = p_user_id;

  insert into public.admin_audit (actor, action, entity, entity_key, after_data)
  values (auth.uid(), 'update', 'role', p_user_id::text,
          jsonb_build_object('role', p_role));
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
```

Trois garde-fous délibérés : seul l'`owner` l'appelle, `owner` n'est pas attribuable, et un
`owner` ne peut pas être rétrogradé — le projet ne peut donc jamais se retrouver orphelin
de gestion des comptes.

### Journal de modifications

Append-only, **écrit par des triggers en base**, jamais par le client :

```sql
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  actor       uuid references public.profiles (user_id),  -- null = seed / système
  action      text not null check (action in ('create','update','delete')),
  entity      text not null check (entity in ('rule_override','errata','role')),
  entity_key  text not null,   -- rules_overrides.number | card_errata.id | user_id ciblé
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_created_at_idx
  on public.admin_audit (created_at desc);

create or replace function public.log_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
  v_key    text;
begin
  v_key := case when tg_op = 'DELETE' then
              case v_entity when 'rule_override' then old.number::text
                            else old.id::text end
           else
              case v_entity when 'rule_override' then new.number::text
                            else new.id::text end
           end;

  insert into public.admin_audit (actor, action, entity, entity_key, before_data, after_data)
  values (
    auth.uid(),
    lower(case tg_op when 'INSERT' then 'create' else tg_op end),
    v_entity,
    v_key,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;  -- trigger AFTER : la valeur de retour est ignorée
end;
$$;

drop trigger if exists rules_overrides_audit on public.rules_overrides;
create trigger rules_overrides_audit
  after insert or update or delete on public.rules_overrides
  for each row execute function public.log_admin_change('rule_override');

drop trigger if exists card_errata_audit on public.card_errata;
create trigger card_errata_audit
  after insert or update or delete on public.card_errata
  for each row execute function public.log_admin_change('errata');
```

**Pourquoi des triggers et pas le client** : un journal écrit par le front peut simplement
ne pas être écrit — il suffit d'appeler l'API directement. Avec des triggers, toute
écriture qui passe laisse une trace, y compris celles faites hors de l'UI. C'est la
différence entre un journal et une décoration.

`actor` est nullable : un seed (`service_role`) n'a pas d'`auth.uid()`, et une ligne
`actor = null` se lit « système » plutôt que d'être faussement attribuée à quelqu'un.

Le journal est **en lecture pour les admins et l'owner uniquement** (il dit qui a fait quoi)
et **en écriture pour personne** via l'API : seuls les triggers `security definer` y
insèrent.

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

| Table / vue       | Lecture                              | Écriture                                                                                                                   |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `profiles.role`   | publique (déjà)                      | **aucune écriture directe** (`revoke update (role)`) — uniquement via `set_user_role()`, réservée à l'`owner`              |
| `rules`           | anon (déjà)                          | `service_role` seulement (le seed)                                                                                         |
| `rules_overrides` | anon                                 | `is_admin()` (insert / update / delete)                                                                                    |
| `card_errata`     | anon (déjà)                          | `is_admin()` (insert / update / delete)                                                                                    |
| `rules_effective` | hérite des tables (security_invoker) | — (vue)                                                                                                                    |
| `admin_audit`     | `is_admin()` seulement               | **personne** via l'API — seuls les triggers `security definer` insèrent ; aucun `update`/`delete` nulle part (append-only) |

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

`authStore` gagne `role`, `isAdmin` (admin **ou** owner) et `isOwner`, chargés depuis `profiles` à l'initialisation de
session (là où le pseudo est déjà lu).

⚠️ **`isAdmin` côté client ne sert QU'À afficher ou masquer l'UI.** La sécurité réelle est
la RLS : un bouton caché n'a jamais protégé quoi que ce soit. Toute écriture est refusée en
base pour un non-admin, même en forçant la route ou en appelant l'API directement.

### Routes

`/admin` (index), `/admin/errata`, `/admin/regles`, `/admin/journal` —
`meta: { requiresAdmin: true }`, lazy.

`/admin/comptes` — `meta: { requiresOwner: true }` : gestion des rôles, visible et
accessible **uniquement** pour l'`owner`. Un admin qui l'atteint reçoit le même écran
« Accès réservé », et la RPC le refuserait de toute façon.

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

### `/admin/journal`

Le journal, du plus récent au plus ancien : date, auteur (pseudo depuis `profiles`),
action, entité et clé, avec le **avant / après** dépliable. Filtres par **auteur**, par
**date** et par **type d'entité**. Lecture seule — c'est un journal, on n'y touche pas.

Les lignes `actor = null` s'affichent « système » (un seed n'a pas d'utilisateur connecté).

### `/admin/comptes` — réservé à l'`owner`

Liste des profils (pseudo, rôle actuel), avec promotion `user` → `admin` et révocation
`admin` → `user`, chacune derrière le `ConfirmDialog`. Tout passe par `set_user_role()`.

L'`owner` apparaît dans la liste mais **sans action possible** : la RPC refuse de le
modifier, et l'UI le reflète plutôt que de proposer un bouton qui échouera. Le rôle `owner`
n'est jamais proposé à l'attribution — il se pose en SQL, une fois.

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
4. un utilisateur ne peut **pas** se promouvoir admin en écrivant `role` sur son profil —
   **ni par `update`, ni par `insert`/`upsert`** (les deux voies sont testées séparément) ;
5. un **admin** ne peut **pas** appeler `set_user_role()` (réservée à l'`owner`), ni se
   promouvoir `owner`, ni rétrograder l'`owner` ;
6. le **journal est infalsifiable** depuis l'API : une modification faite hors de l'UI
   laisse quand même une ligne, et personne ne peut ni modifier ni supprimer une ligne
   existante d'`admin_audit` ;
7. `admin_audit` n'est **pas lisible** par un anonyme ni par un simple utilisateur.

C'est exactement le contrôle qui a rattrapé la Phase 1 : le seed passait en `service_role`,
qui **contourne** la RLS — sans lecture en anon, on aurait cru la policy bonne alors que
rien ne le prouvait.

Le reste : tests unitaires sur `adminService` (Supabase moqué) et sur le rafraîchissement
de cache ; tests de composants sur les écrans d'admin, le journal, la gestion des comptes
et le marqueur « corrigé » ; E2E limité au comportement des gardes de route (`requiresAdmin`
et `requiresOwner`), la base E2E étant vide comme en Phase 1.

## Hors périmètre de ce lot

- **Restauration** d'une version antérieure (le journal est consultable, pas réversible) —
  pour les règles, « rétablir l'officiel » couvre déjà le cas courant.
- Édition des **cartes** (lot 2).
- Workflow de propositions / modération (écarté : modèle de confiance directe retenu).
- Attribution du rôle `owner` via l'UI (SQL uniquement, par conception).

## Risques

| Risque                                                                                                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-promotion, par DEUX voies** : `profiles_update_own` ET `profiles_insert_own` (0004) n'ont aucune restriction de colonne — et `setUsername()` fait un `upsert` | `revoke update (role)` **ET** `revoke insert (role)` `on public.profiles from anon, authenticated;` **dans la même migration que l'ajout de la colonne** — n'en bloquer qu'une laisse l'autre ouverte. Traité comme une exigence, pas comme un risque résiduel : voir « Blocage obligatoire de l'auto-promotion ». Prouvé en conditions réelles par le point 4 de `checkAdminRls.mjs`. **C'est le point de sécurité le plus important de ce lot.** |
| Un admin dégrade le texte officiel des règles                                                                                                                       | `body_official` conserve l'original, « rétablir l'officiel » est une suppression d'override, et le marqueur « corrigé » informe le lecteur                                                                                                                                                                                                                            |
| Le seed errata détruit le travail admin                                                                                                                             | Garde « refuse si non vide » + `--force` explicite                                                                                                                                                                                                                                                                                                                    |
| `is_admin()` en `security definer` mal cadrée                                                                                                                       | `search_path` figé à `public`, fonction `stable`, ne lit que `profiles`                                                                                                                                                                                                                                                                                               |
| Cache client périmé après écriture                                                                                                                                  | `refresh()` appelé après chaque écriture réussie                                                                                                                                                                                                                                                                                                                      |
| **Un admin se promeut `owner`** ou révoque le propriétaire                                                                                                          | `set_user_role()` n'accepte que `user`/`admin`, exige `is_owner()`, et refuse toute cible déjà `owner`. Le rôle `owner` ne s'obtient qu'en SQL. Vérifié par le point 5 de `checkAdminRls.mjs`                                                                                                                                                                         |
| **Journal contourné** : une modification faite hors de l'UI ne laisserait pas de trace                                                                              | Le journal est écrit par des **triggers en base**, pas par le client — toute écriture qui passe la RLS est tracée. Aucun `update`/`delete` n'est accordé sur `admin_audit` (append-only). Vérifié par le point 6                                                                                                                                                      |
| Projet orphelin de gestion des comptes (plus aucun `owner`)                                                                                                         | La RPC refuse de modifier un `owner`, y compris soi-même ; la rétrogradation ne peut donc pas se faire depuis l'UI                                                                                                                                                                                                                                                    |
| `admin_audit` grossit indéfiniment                                                                                                                                  | Volume attendu très faible (quelques éditions par semaine, poignée d'admins). Aucune purge dans ce lot — à revoir si le rythme change                                                                                                                                                                                                                                 |
