# Jeu en ligne 1v1 — état réel & runbook de mise en service

> Objectif (Discord) : un module type **Cockatrice/Duelingbook** — deux joueurs
> à distance, **règles résolues à la main** (l'assistance n'est jamais
> bloquante). Ce document fait l'inventaire honnête de ce qui existe, ce qui
> manque, et comment allumer le jeu en ligne.

## 1. Ce qui existe déjà (écrit + testé, **non déployé**)

| Brique                                                               | Fichier                             | État                          |
| -------------------------------------------------------------------- | ----------------------------------- | ----------------------------- |
| Moteur event-sourcé déterministe                                     | `src/game/engine/reducer.ts`        | ✅ testé                      |
| Autorité serveur + redaction par siège                               | `src/game/engine/authority.ts`      | ✅ testé                      |
| Edge Function `create_game` (salon, siège A, seed secrète)           | `supabase/functions/create_game/`   | ✅ écrit                      |
| Edge Function `join_game` (siège B + mise en place GAME_STARTED)     | `supabase/functions/join_game/`     | ✅ écrit                      |
| Edge Function `submit_event` (unique chemin d'écriture, RNG serveur) | `supabase/functions/submit_event/`  | ✅ écrit                      |
| Schéma BDD + `append_event` + RLS                                    | `supabase/migrations/0002_game.sql` | ✅ écrit                      |
| Client réseau (invoke + Realtime redacté)                            | `src/services/gameClient.ts`        | ✅ écrit (+ `findGameByCode`) |

Le modèle est solide : commit-reveal sur la `master_seed`, acteur imposé par le
siège authentifié, redaction prouvée par les tests (aucun cardId/ordre adverse
ne fuit).

## 2. Ce qui manque pour jouer en ligne (4 chantiers)

1. **Déploiement** _(toi — étape manuelle, voir §3)_. Tant que les fonctions +
   la migration ne sont pas appliquées sur le projet Supabase, **rien ne tourne
   en ligne**. C'est le blocage n°1.
2. **Résolution autoritative du tirage** _(moteur)_. L'ordre de la Pioche est
   **secret pour tous** (la permutation du SHUFFLE est redactée même pour le
   propriétaire). Un client ne peut donc pas calculer son propre tirage —
   `resolveDraft` doit piocher côté serveur (top autoritatif) et redacter le
   cardId au seul tireur. Aujourd'hui `resolveDraft` ne gère que SHUFFLE et la
   cohérence d'un MOVE : **le tirage en ligne n'est pas encore résolu** (donc
   pas de fin de tour jouable). Tutors (chercher une carte précise) = chantier
   séparé (révélation privée).
3. **Câblage client** _(UI)_ : un **lobby** (créer / rejoindre par code) + un
   **mode en ligne** dans `gameStore` (soumettre les intentions via
   `submitEvent`, appliquer les echos redactés reçus en Realtime, assistance
   OFF = résolution manuelle). Aujourd'hui `gameClient` n'est importé par
   **aucune vue** : `PlayTableView` joue en **local** (`startMatch`).
4. **Reconnexion / arrivée tardive** _(serveur)_ : `pull_events` redacté pour
   rejouer le journal à la connexion (sinon on rate les events diffusés avant
   l'abonnement). Noté « lot L3 » dans `supabase/functions/README.md`.

## 3. Runbook de déploiement (prérequis n°1)

Nécessite la CLI Supabase authentifiée sur le projet (`VITE_SUPABASE_URL`).

```bash
# 1. Appliquer la migration des tables de jeu
supabase db push                # ou coller 0002_game.sql dans le SQL Editor

# 2. Déployer les trois Edge Functions
supabase functions deploy create_game
supabase functions deploy join_game
supabase functions deploy submit_event

# 3. Vérifier que Realtime "broadcast" est activé sur le projet (Dashboard →
#    Realtime). Les clients s'abonnent au canal game:<id>:<siège>.
```

Notes :

- Les fonctions importent le moteur via chemin relatif vers `src/game/` ; le
  bundler Deno suit ces imports et élide les `import type` (cf. README des
  fonctions). En cas de souci de build, copier les modules Deno-safe sous
  `functions/_shared/engine/`.
- Secrets `SUPABASE_*` fournis automatiquement aux fonctions.

## 4. Plan par incréments déployables (proposé)

- **L-deploy** : toi → §3. Donne une cible vivante.
- **L-draw** _(moteur, testable hors-ligne)_ : tirage autoritatif dans
  `resolveDraft` + tests `authority.spec.ts`. Débloque la fin de tour.
- **L-lobby** _(client)_ : vue lobby (créer/rejoindre/code) branchée sur
  `gameClient`, + `connectOnline`/`disconnectOnline` dans `gameStore` (transport
  injecté, assistance OFF), echo → journal local → vue redactée.
- **L-actions** _(client)_ : rendre les coups composites sûrs en ligne (fin de
  tour, combat) — soumission d'intentions, pas d'application optimiste.
- **L-reco** _(serveur)_ : `pull_events` redacté (reconnexion / spectateur).

## 5. Vérification — limite importante

Je peux écrire et **tester unitairement** le moteur (tirage autoritatif) et la
logique du mode en ligne (transport mocké), et vérifier le build. Je **ne peux
pas** tester le bout-en-bout (2 clients authentifiés sur un backend déployé) :
ça nécessite le déploiement (§3) puis un test à deux navigateurs. Le plan ci-
dessus est donc fait pour qu'on itère ensemble contre le backend déployé.
