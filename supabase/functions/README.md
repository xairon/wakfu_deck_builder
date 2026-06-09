# Edge Functions — Module de jeu « La Table des Douze » (lot L2)

Couche serveur **autoritative** du jeu 1v1 en ligne. Le moteur (déterministe,
event-sourcé, redacté) vit dans `src/game/` et est **réutilisé** ici — les
fonctions ne font que la glu Supabase (auth, base, diffusion).

> ⚠️ **Statut : authoring.** Le code est écrit et la logique métier (`src/game`)
> est testée (33 tests verts). Le **déploiement** des fonctions + l'application
> de la migration nécessitent la CLI Supabase (étape manuelle, ci-dessous) et
> n'ont pas encore été exécutés en production.

## Fonctions

| Fonction       | Rôle                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_game`  | Crée un salon (siège A) + deck figé + masterSeed secrète → renvoie le **code** de salon.                                                                                     |
| `join_game`    | Rejoint par code (siège B), tire le premier joueur, joue la **mise en place** (GAME_STARTED + mélanges autoritatifs), passe la partie en `active`.                           |
| `submit_event` | **Unique chemin d'écriture** : dérive l'état, calcule le coup autoritatif (RNG serveur, redaction), append atomique (`append_event`), diffuse l'event **redacté** par siège. |

## Prérequis

1. Appliquer la migration `supabase/migrations/0002_game.sql` :
   ```bash
   supabase db push        # ou coller le SQL dans le SQL Editor du dashboard
   ```
2. Secrets disponibles pour les fonctions (fournis automatiquement par Supabase) :
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Déploiement

```bash
supabase functions deploy create_game
supabase functions deploy join_game
supabase functions deploy submit_event
```

### Code partagé (`src/game`)

Les fonctions importent le moteur via un chemin relatif vers `src/game/` (hors
du dossier `supabase/`). Le bundler Deno de Supabase suit ces imports relatifs
et **élide les `import type`** (dont `@/types/cards` dans `setup.ts`), qui ne
sont jamais résolus à l'exécution. Si un import devait poser problème au build,
l'alternative est de copier les modules Deno-safe sous `functions/_shared/engine/`
(tous sauf `setup.ts` sont sans alias).

## Temps réel

Les clients **ne lisent pas** `game_events` (RLS sans policy). Ils s'abonnent au
canal Realtime `game:<id>:<siège>` et reçoivent des events **redactés**
(`subscribeToGame` dans `src/services/gameClient.ts`). La reconnexion se fera via
un `pull_events` redacté (lot L3).

## Sécurité (rappel)

- `master_seed` n'est **jamais** exposée : seul son hash (`master_seed_hash`) est
  public (commit-reveal). Le RNG du mélange en dérive côté serveur uniquement.
- L'**acteur** d'un coup est imposé par le siège authentifié, jamais lu du client.
- La redaction garantit qu'aucun `cardId` de main/pioche adverse, ni aucun ordre
  de pioche, ne quitte le serveur (prouvé par les tests du moteur).
