# « Réutiliser cette version » — design

**Date** : 2026-07-25
**Statut** : validé (brainstorming), prêt pour plan d'implémentation
**Phase** : 2, lot 3 (dernier lot)

## Origine

Le journal `admin_audit` conserve déjà chaque version de chaque errata et de chaque
correction de règle (`before_data` / `after_data` en JSONB, écrits par des triggers). Il est
consultable sur `/admin/journal`, mais rien ne permet d'en **reprendre** une valeur : pour
revenir en arrière, un admin doit retaper à la main ce qu'il lit à l'écran.

## Décision de périmètre

La restauration avait été **explicitement écartée** au moment de concevoir le journal (choix
« journal consultable » plutôt que « journal + restauration »). Elle est reprise ici à la
demande, mais sous une forme volontairement plus prudente que la restauration en un clic.

| Option                                                                                     | Retenue | Raison                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **« Réutiliser cette version »** : ouvre l'éditeur pré-rempli, l'admin relit et enregistre | **oui** | Passe par le chemin d'écriture normal (audité, RLS appliquée), aucun bouton destructif à un clic sur des données officielles, aucune sémantique nouvelle à inventer |
| Restauration en un clic (écrit l'instantané directement)                                   | non     | Action destructive immédiate ; exigerait d'inventer un comportement pour les créations (supprimer ?) et les suppressions (ré-insérer avec quel id ?)                |
| Ne rien faire                                                                              | non     | L'admin retaperait ; acceptable mais l'utilisateur a tranché                                                                                                        |

## Principe directeur

**Le journal ne devient pas un éditeur.** Il renvoie vers l'éditeur existant de l'entité en
lui passant l'instantané à reprendre. `/admin/errata` et `/admin/regles` restent les seuls
endroits où l'on modifie.

C'est le point d'architecture qui compte : ce projet a déjà payé deux fois la duplication de
formulaires (les deux rendus d'errata avaient divergé ; `RulesOfficialView` /
`AdminRulesView` avaient été signalés comme le meilleur candidat à la mutualisation). Faire
éditer depuis le journal recréerait exactement ce problème.

## Ce qu'on ajoute

### Service

`adminService.getAuditEntry(id: number): Promise<AuditRow | null>` — une entrée par son id.
Même dégradation que `listAudit` : `null` si pas de backend, si la requête échoue ou si la
RLS refuse ; `console.warn` sur échec de requête ; **jamais d'exception**.

### Journal (`/admin/journal`)

Dans le bloc dépliable qui montre déjà _Avant_ / _Après_, un bouton **« Réutiliser cette
version »** sous **chacun** des deux instantanés.

Deux boutons plutôt qu'un : les deux instantanés sont légitimement réutilisables et les
nommer par leur position supprime toute devinette — _Avant_ = annuler ce changement,
_Après_ = remettre ce que ce changement avait produit.

Le bouton n'apparaît que si :

- l'instantané est **non nul** (une création n'a pas d'`before_data`, une suppression pas
  d'`after_data`) — pas de bouton mort ;
- l'entité possède un éditeur : `errata` et `rule_override` seulement. **Pas pour `role`** :
  le seul chemin d'écriture d'un rôle est la RPC `set_user_role()`, et rejouer un instantané
  de rôle contournerait ses garde-fous.

Cible de navigation :

| Entité          | URL                                                      |
| --------------- | -------------------------------------------------------- |
| `errata`        | `/admin/errata?reuse=<auditId>&side=before` (ou `after`) |
| `rule_override` | `/admin/regles?reuse=<auditId>&side=before` (ou `after`) |

### Les deux éditeurs

Au montage, si `?reuse=` est présent :

1. `getAuditEntry(id)` ;
2. on prend `before_data` ou `after_data` selon `side` ;
3. on **pré-remplit l'éditeur existant** — `form` + `formOpen` pour `AdminErrataView`,
   `editing` + `openEditForm` pour `AdminRulesView` ;
4. on affiche un bandeau : « Version du 24/07/2026 par Tavoshel — relis puis enregistre » ;
5. on **nettoie le paramètre d'URL** (`router.replace`) pour qu'un rafraîchissement ne
   rejoue pas l'opération.

**Rien n'est écrit tant que l'admin n'enregistre pas.** L'enregistrement emprunte le chemin
d'écriture normal, il est donc audité comme une modification ordinaire : le journal reste
append-only et honnête — on y lit « untel a remis telle valeur », jamais une réécriture de
l'histoire.

## Dégradation

| Situation                         | Comportement                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Entrée introuvable, ou RLS refuse | Bandeau d'erreur explicite, éditeur non pré-rempli, jamais de plantage                               |
| Instantané nul                    | Bouton absent côté journal                                                                           |
| L'entité a été supprimée depuis   | Errata → le formulaire s'ouvre en **création** (pas d'`id`) ; règle → `upsertRuleOverride` la recrée |
| `?reuse=` non numérique           | Ignoré silencieusement, écran normal                                                                 |

## Vérification

- **Journal** : bouton présent pour `errata` / `rule_override` avec instantané non nul ;
  **absent** pour `role` et pour un instantané nul ; l'URL cible est assertée **exactement**
  (le `to`, pas seulement la présence du bouton) — une cible fausse enverrait l'admin
  éditer la mauvaise entité.
- **`AdminErrataView`** : `?reuse=` pré-remplit le formulaire depuis l'instantané et
  **n'appelle aucune écriture** (assertion négative explicite sur `createErratum` /
  `updateErratum`).
- **`AdminRulesView`** : idem, éditeur ouvert sur la bonne règle, aucune écriture.
- **Entrée introuvable** → bandeau d'erreur, pas de plantage.
- Le paramètre d'URL est nettoyé après application.

## Hors périmètre

- Restauration en un clic (écriture directe sans relecture).
- Réutilisation d'un instantané de **rôle** (`set_user_role` reste le seul chemin).
- Comparaison visuelle de deux versions (diff) : le journal montre déjà avant/après en JSON.

## Risques

| Risque                                      | Mitigation                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| L'admin croit que cliquer a restauré        | Bandeau explicite « relis puis enregistre » ; rien n'est écrit avant la soumission |
| Rejouer le paramètre au rafraîchissement    | `router.replace` nettoie `?reuse=` dès l'application                               |
| Mauvaise entité ciblée                      | L'URL cible est assertée exactement en test                                        |
| Duplication d'un formulaire dans le journal | Écartée par conception : le journal navigue, il n'édite pas                        |
