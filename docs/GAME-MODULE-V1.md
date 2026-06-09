# « La Table des Douze » — Conception V1 du Module de Jeu

> Document de conception unifié — Architecte en chef. Synthèse des contributions _zones-visibilité_, _event-engine_, _gamestate-redaction_, _server-transport_, _ui-table_, _roadmap-scope_. Ancré sur le code réel (`src/types/cards.ts`, `src/data/rules.ts`, `supabase/migrations/0001_init.sql`, `_incoming/rules-reference.txt`) et le stack réel (Vue 3 + Pinia + Supabase + Vercel, **sans backend stateful**).

## 1. Résumé exécutif

On construit une **table virtuelle libre de règles** pour Wakfu TCG, en **1v1 entre amis** (+ spectateurs), où les joueurs s'auto-arbitrent : aucun enforcement d'effet en V1, seulement les mécaniques de base (piocher, mélanger, déplacer, incliner, compteurs). La fondation est **event-sourcée de bout en bout** — le `GameState` dérive d'un journal d'events ordonné — ce qui offre _gratuitement_ undo, replay, spectateur, reconnexion et redaction par joueur. **Recommandation réseau tranchée : 100 % Supabase, zéro infra ajoutée.** L'autorité (ordre des events, RNG du mélange, redaction) vit dans Postgres + Edge Functions Deno ; Realtime sert de transport. Migration vers un serveur stateful (Colyseus) restera possible plus tard _sans casser le journal_, mais n'est ni nécessaire ni justifiée pour le public visé.

## 2. Décision d'architecture clé

Trois piliers, et pourquoi ils s'imposent vu le stack.

**(A) Table libre de règles.** V1 ne valide aucune légalité d'effet (coût, cible, capacité du Havre-Sac, phase). L'UI autorise tout `move` ; les joueurs arbitrent (modèle Cockatrice). Cela divise par dix la surface V1 _tout en_ posant les crochets data (`counters`, `tapped`, `attachments`, `faceDown`) pour l'automatisation carte-par-carte ultérieure.

**(B) Event-sourcing dès le départ.** `state = events.reduce(applyEvent, initialState)`. Ce n'est pas un luxe : **les règles officielles raisonnent déjà en events** (507.4 : une pioche multiple est « plusieurs événements distincts faisant chacun piocher une et une seule carte »). Le reducer est **pur, déterministe, total** (aucun `Date.now()`, aucun `Math.random()` — tout non-déterminisme est capturé _dans_ l'event). Conséquence directe : deux clients qui rejouent la même séquence dérivent un état identique → sync, undo, replay, spectateur et reconnexion deviennent des corollaires, pas des features à coder.

**(C) Serveur autoritatif = Postgres + Edge Functions, pas un game-loop.** Vercel n'héberge pas de process long. Mais le besoin réel d'un TCG tour-par-tour n'est pas un game-loop 60 Hz : c'est **un journal ordonné, atomique, redacté, diffusé en quasi temps réel**. Postgres (autorité d'ordre via contrainte SQL `(game_id, seq)`), Edge Functions Deno (RNG + redaction + validation d'autorisation), Realtime (transport) couvrent exactement ce besoin. **Le RNG du mélange est strictement serveur** (le client ne connaît jamais l'ordre de la Pioche → triche impossible).

**Tableau comparatif réseau (divergence tranchée — unanimité des contributeurs) :**

| Critère                      | **A — 100 % Supabase ✅**               | B — Colyseus            | C — WS custom     |
| ---------------------------- | --------------------------------------- | ----------------------- | ----------------- |
| Autorité                     | Postgres + Edge Function                | Process Node (room RAM) | Process Node      |
| Event-sourcing / persistance | **Natif** (table = journal)             | À recâbler              | À recâbler        |
| RNG serveur                  | `crypto`/`gen_random_bytes` en Edge/RPC | Code room               | Code serveur      |
| Reconnexion / spectateur     | **Gratuit** (re-`SELECT` + replay)      | Intégré                 | À coder           |
| Infra ajoutée                | **Aucune**                              | +1 service stateful     | +1 service + tout |
| Adéquation 1v1 amical        | **Excellente**                          | Surdimensionné          | Surdimensionné    |

> Réévaluer B _uniquement si_ un jour : tournois à chrono serveur strict, anti-triche par simulation complète des effets, ou fort volume de coups/s. Rien de tout ça en V1.

**Sous-décision tranchée — où vit l'écriture autoritative ?** Les contributions proposaient soit une **RPC Postgres `SECURITY DEFINER`** (`play_move`), soit une **Edge Function Deno** (`submit_event` / `game-act`). **Décision : une Edge Function Deno `submit_event` est l'unique chemin d'écriture**, car (1) le RNG cryptographique (`crypto.getRandomValues` + HMAC) y est plus naturel et auditable qu'en pgcrypto, (2) la logique de redaction (calcul des `payload_private` par siège) est du TypeScript partagé avec le client (même `reducer`/`redact`), évitant une double implémentation SQL+TS, (3) elle reste _sans état_ (compatible Vercel/Supabase). Postgres garde **l'autorité d'ordre** via une fonction SQL `append_event(game_id, expected_last_seq, …)` appelée _par_ l'Edge Function dans une transaction (lock `FOR UPDATE` sur `games`), qui rejette tout `expected_last_seq` périmé (concurrence optimiste). Ainsi : **TS pour la logique de jeu/redaction/RNG, SQL pour l'atomicité et l'ordre total.**

## 3. Modèle de zones & visibilité

### 3.1 Zones (vérifiées sur `rules.ts` §"Les zones de jeu" — exactement six, 501.1)

Six zones officielles + Réserve (hors-jeu de tournoi, 101.4) + zones techniques. **Nommage unifié** (les contributions divergeaient entre `havenBag`/`havre_sac`/`havreSac`) : **identifiants TS en `camelCase` anglais**, colonnes SQL en `snake_case`, libellés UI en français.

```ts
// src/game/types/zones.ts
export type Seat = "A" | "B";
export type Viewer = Seat | "spectator";

export const ZONE = {
  Pioche: "pioche",
  Main: "main",
  Monde: "monde", // commune (506.1)
  HavreSac: "havreSac",
  Defausse: "defausse",
  FileAttente: "fileAttente", // commune (503.2)
} as const;
export type GameZone = (typeof ZONE)[keyof typeof ZONE];

// Hors des six : Réserve (tournoi 101.4), Exil (banni), Limbo (transit technique).
export const META_ZONE = {
  Reserve: "reserve",
  Exil: "exil",
  Limbo: "limbo",
} as const;
export type MetaZone = (typeof META_ZONE)[keyof typeof META_ZONE];
export type AnyZone = GameZone | MetaZone;
```

**Pas de zone Écus/jetons de score** (vérifié : il n'existe que six zones ; XP/PV/Dommages sont des _compteurs portés par les cartes_, pas des zones).

### 3.2 Deux axes de visibilité **indépendants** : contenu vs ordre

Distinction structurante (issue de _zones-visibilité_, confirmée par _gamestate-redaction_) : **le contenu** (« quelles cartes ») et **l'ordre** (« dans quelle séquence ») se redactent séparément. La Pioche en est la preuve : son ordre est secret **pour tout le monde, propriétaire inclus** — c'est le fondement même du RNG serveur (le client ne peut pas connaître sa prochaine carte).

```ts
export interface ZoneSpec {
  scope: "shared" | "per-player"; // 501.2 : monde/fileAttente communes
  ordered: boolean; // 501.3
  public: boolean; // 501.4
  tracksOrientation: boolean; // 106.3 : seuls Monde & Havre-Sac portent l'inclinaison
  defaultFace: "up" | "down";
}

export const ZONE_SPECS: Record<AnyZone, ZoneSpec> = {
  pioche: {
    scope: "per-player",
    ordered: true,
    public: false,
    tracksOrientation: false,
    defaultFace: "down",
  },
  main: {
    scope: "per-player",
    ordered: false,
    public: false,
    tracksOrientation: false,
    defaultFace: "up",
  },
  monde: {
    scope: "shared",
    ordered: false,
    public: true,
    tracksOrientation: true,
    defaultFace: "up",
  },
  havreSac: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: true,
    defaultFace: "up",
  },
  defausse: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: false,
    defaultFace: "up",
  },
  fileAttente: {
    scope: "shared",
    ordered: true,
    public: true,
    tracksOrientation: false,
    defaultFace: "up",
  },
  reserve: {
    scope: "per-player",
    ordered: false,
    public: false,
    tracksOrientation: false,
    defaultFace: "up",
  },
  exil: {
    scope: "per-player",
    ordered: false,
    public: true,
    tracksOrientation: false,
    defaultFace: "up",
  },
  limbo: {
    scope: "per-player",
    ordered: true,
    public: false,
    tracksOrientation: false,
    defaultFace: "down",
  },
};
```

### 3.3 Matrice de visibilité (zone × observateur)

**C = contenu** (identité `cardId` connue) ; **O = ordre** (séquence exacte connue). `self` = propriétaire/contrôleur, `opp` = adversaire, `spec` = spectateur. Numéros de règle vérifiés dans `rules.ts`.

| Zone (règle)               | Scope      |  Ord.   |  Pub.   |  C:self  | C:opp  | C:spec | O (qui connaît l'ordre)    |
| -------------------------- | ---------- | :-----: | :-----: | :------: | :----: | :----: | -------------------------- |
| **Pioche** (507.2)         | per-player |   oui   |   non   |  count   | count  | count  | **personne** (RNG serveur) |
| **Main** (505.2)           | per-player |   non   |   non   | **full** | count  | count  | self seul                  |
| **Havre-Sac** (504.2)      | per-player |   non   | **oui** |   full   |  full  |  full  | n/a                        |
| **Monde** (506.1)          | shared     |   non   | **oui** |   full   |  full  |  full  | n/a                        |
| **Défausse** (502.2)       | per-player |   non   | **oui** |   full   |  full  |  full  | tous                       |
| **File d'Attente** (503.2) | shared     | **oui** | **oui** |   full   |  full  |  full  | **tous** (LIFO public)     |
| **Réserve** (101.4)        | per-player |   non   |   non   |   full   | hidden | hidden | self                       |
| **Exil** (banni)           | per-player |   non   |   oui   |   full   |  full  |  full  | tous                       |
| **Limbo** (technique)      | per-player |   oui   |   non   |  hidden  | hidden | hidden | personne                   |

Valeurs de redaction : **full** = `CardInstance` complète (le client peut afficher l'image réelle) ; **count** = `{ count:N, faceDown:true }`, _aucun_ `cardId` transmis (507.2/505.2 : seul le nombre est public) ; **hidden** = la zone n'apparaît pas dans la vue.

**Règle d'or de redaction (la plus restrictive l'emporte) :** la visibilité effective d'une carte = `min(visibilité de la zone, face de la carte, révélations explicites)`. Une carte `faceDown` posée dans une zone publique (ex. Allié joué face cachée) est redactée en `{ instanceId, faceDown:true, location }` pour les non-autorisés — on révèle _présence_ et _position_, jamais l'identité. Le champ `revealedTo: Seat[]` sur l'instance gère les révélations ciblées (look privé, recherche).

## 4. Moteur d'events

### 4.1 La primitive reine `MOVE`

Tous les verbes de déplacement dérivent d'un seul event. **`shuffle` est délibérément hors de `MOVE`** (seul point où l'ordre est régénéré, autoritativement serveur). Les mutations d'état (incliner, compteurs, flip, attach) sont des events non-positionnels distincts.

```ts
// src/game/types/events.ts
export type InstanceId = string; // ex. "ci_7f3a" — stable toute la partie, ≠ cardId
export type Position =
  | { at: "top" }
  | { at: "bottom" }
  | { at: "index"; index: number }
  | { at: "any" }
  | { at: "free"; x: number; y: number }; // 'free' = placement libre dans le Monde

export interface FaceDirective {
  faceDown: boolean;
  visibleTo: Seat[] | "all" | "none";
}

export interface MovePayload {
  instanceId: InstanceId;
  from: ZoneRef;
  to: ZoneRef;
  position: Position;
  visibility: FaceDirective;
  /** 501.5 : true UNIQUEMENT pour Monde↔Havre-Sac → conserve counters/markers.
   *  Sinon le reducer purge les modificateurs au changement de zone. */
  preservesIdentity: boolean;
  orientationOnArrival?: "upright" | "tapped" | null; // null hors monde/havreSac (106.3)
}

export type ZoneRef =
  | { zone: "monde" | "fileAttente" } // commune : pas d'owner
  | { zone: Exclude<AnyZone, "monde" | "fileAttente">; owner: Seat }; // personnelle
```

**Verbes dérivés (sucre au-dessus de `MOVE` + events d'état) :**

| Verbe                 | Dérivation                                              | Règle                     |
| --------------------- | ------------------------------------------------------- | ------------------------- |
| `draw`                | `MOVE pioche[top] → main`, `visibleTo:[self]`           | 507.4 (1 carte = 1 event) |
| `play`                | `MOVE main → fileAttente \| monde \| havreSac`          | 503.2                     |
| `discard` / `destroy` | `MOVE * → defausse`, `visibleTo:'all'`                  | 502.1                     |
| `banish`              | `MOVE * → exil`                                         | —                         |
| `mill` / `tuck`       | `MOVE * → pioche`, `position: top\|bottom`              | 507.3                     |
| `worldHavenSwap`      | `MOVE monde ↔ havreSac`, **`preservesIdentity:true`**  | 501.5                     |
| `tap` / `untap`       | event d'état `SET_ORIENTATION` (si `tracksOrientation`) | 106.1/106.2               |
| `flipLevel`           | event `SET_LEVEL` : face recto↔verso + `level`/`xp`    | 307.4                     |
| `setCounter`          | event `SET_COUNTER` : hp/resistance/damage/xp/tokens    | 410.x / 307.x             |
| `attach` / `detach`   | `ATTACH`/`DETACH` (porteur ↔ `attachments[]`)          | 305.3                     |
| `shuffle`             | event **`SHUFFLE`** : permutation RNG serveur           | RNG autoritatif           |

### 4.2 Taxonomie complète + enveloppe persistée

```ts
export type EventType =
  | "GAME_CREATED"
  | "DECK_LOADED"
  | "GAME_STARTED" // cycle de partie
  | "MOVE" // primitive reine
  | "SHUFFLE" // RNG serveur (seed jamais client)
  | "SET_ORIENTATION"
  | "SET_LEVEL" // incliner/redresser ; recto/verso
  | "SET_COUNTER"
  | "INC_COUNTER" // pv/resistance/damage/xp/tokens
  | "ATTACH"
  | "DETACH" // équipements/Dofus (305.3)
  | "LOOK"
  | "REVEAL" // regard privé ; révélation ciblée
  | "SET_RESOURCE"
  | "SET_PHASE" // PA/PM joueur ; phase (light V1)
  | "SAID" // chat/log libre
  | "UNDONE" // marqueur d'undo (cf. §4.5)
  | "CHECKPOINT"; // snapshot de compaction

export interface PersistedEvent<P = unknown> {
  gameId: string;
  seq: number; // AUTORITATIF (séquence Postgres), monotone, jamais client
  parentSeq: number; // seq attendu du parent (concurrence optimiste)
  actor: Seat | "system";
  type: EventType;
  payload: P; // payload PUBLIC (safe à diffuser)
  payloadPrivate?: Partial<Record<Seat, Partial<P>>>; // fragments par siège (secrets)
  ts: number; // timestamp SERVEUR (source unique de temps)
}
```

> **Décision tranchée — un seul format de secret.** Les contributions mélangeaient `redactedPayload`/`payload_private`/champs masqués inline. **Retenu : un event a un `payload` public + une map `payloadPrivate[seat]`.** Un `draw` porte dans `payload` le fait public (« A pioche 1, sa Pioche passe à 47 ») et dans `payloadPrivate.A` le `cardId`/`instanceId` réel. B ne reçoit jamais `payloadPrivate.A`. C'est l'unique mécanisme de secret, appliqué uniformément à `SHUFFLE` (ordre), `LOOK` (résultat), `MOVE` vers main/pioche.

### 4.3 Le reducer (pur, déterministe)

```ts
// src/game/engine/reducer.ts
export function applyEvent(state: GameState, ev: PersistedEvent): GameState {
  if (ev.parentSeq !== state.seq)
    throw new EngineError("OUT_OF_ORDER", {
      expected: state.seq,
      got: ev.parentSeq,
    });
  const next = structuredClone(state); // immer/Map persistant en prod si besoin perf
  switch (ev.type) {
    case "MOVE":
      applyMove(next, ev.payload as MovePayload);
      break;
    case "SHUFFLE":
      applyShuffle(next, ev.payload as ShufflePayload);
      break; // applique, ne génère pas
    case "SET_ORIENTATION":
      applyOrientation(next, ev.payload);
      break;
    case "INC_COUNTER":
      incCounter(next, ev.payload);
      break;
    // … un cas par EventType
  }
  next.seq = ev.seq;
  return next;
}

function applyMove(s: GameState, p: MovePayload): void {
  const inst = s.instances[p.instanceId];
  removeFromZone(s, inst);
  const isWorldHavenSwap =
    (p.from.zone === "monde" && p.to.zone === "havreSac") ||
    (p.from.zone === "havreSac" && p.to.zone === "monde");
  if (!(p.preservesIdentity && isWorldHavenSwap)) {
    // 501.5
    inst.counters = {};
    inst.modifiers = []; // purge à la frontière de zone
  }
  const arrivesInPlay = p.to.zone === "monde" || p.to.zone === "havreSac";
  inst.orientation = arrivesInPlay
    ? (p.orientationOnArrival ?? "upright")
    : null; // 106.3
  inst.faceDown = p.visibility.faceDown;
  insertIntoZone(s, inst, p.to, p.position);
}
```

**Déterminisme garanti** : chaque event contient _déjà son résultat_ (la `permutation` pour `SHUFFLE`, la valeur absolue pour `SET_COUNTER`). Rejouer N events depuis `initialState` produit toujours le même `GameState`, sur n'importe quel client → replay/spectateur/resync corrects par construction.

### 4.4 RNG autoritatif (`SHUFFLE`) — commit-reveal

**Le client ne mélange jamais.** Calcul dans l'Edge Function `submit_event` :

1. À `GAME_CREATED`, l'autorité tire une `masterSeed` (256 bits, `crypto.getRandomValues`), la garde secrète, publie seulement son **hash** (`masterSeedHash`) dans le state — engagement vérifiable.
2. Chaque `SHUFFLE` dérive `seed = HMAC-SHA256(masterSeed, gameId | seq | zoneKey)`, initialise un PRNG déterministe (`sfc32`/xoshiro256**), applique **Fisher-Yates\*\* → `permutation`.
3. La `permutation` est inscrite dans `payloadPrivate` (rédigée comme `instanceId` opaques pour la Pioche — l'adversaire sait _que_ ça a mélangé, jamais l'ordre ; le propriétaire non plus).
4. **Anti-triche** : en fin de partie, l'autorité révèle `masterSeed` ; chaque joueur recalcule toutes les permutations et vérifie que le serveur n'a pas triché.

Le reducer **applique** la permutation, ne la génère jamais → il reste pur.

### 4.5 Undo (divergence tranchée)

Trois mécanismes étaient proposés : replay-jusqu'à-N (troncature), event `UNDONE` ignoré au fold, event inverse (compensating). **Décision : `UNDONE { targetSeq }` append-only comme défaut canonique.**

- On **n'efface jamais** d'event (journal immuable → audit/replay/spectateur préservés). `undo` = append d'un event `UNDONE { targetSeq }`. Le reducer, au fold, **ignore l'event ciblé et ses dépendants**.
- **Pourquoi pas la troncature** : casserait l'append-only et la numérotation `seq` monotone (compliquerait la concurrence optimiste et la reconnexion par pull).
- **Pourquoi pas l'event inverse comme défaut** : un `SHUFFLE` n'est pas inversible côté client (ordre secret). `UNDONE` traite ce cas uniformément. L'event inverse reste utilisable _en option locale_ pour un undo optimiste instantané, mais converge vers le même résultat après confirmation serveur.
- En 1v1 amical, `undo` est **collaboratif** (pas de rollback contesté à arbitrer en V1).

## 5. GameState & redaction

### 5.1 Identité : `Card` (définition) vs `CardInstance` (occurrence)

Séparation stricte, fondement de toute la redaction. Une `Card` (`src/types/cards.ts`, ~1585, immuable, partagée) est référencée par `cardId: string` ; une `CardInstance` est une occurrence avec `instanceId` propre. **On ne transporte jamais l'objet `Card` sur le réseau, seulement le `cardId`** (string) → deltas minuscules, redaction triviale (omettre une string). La résolution `cardId → Card` (stats/images/effets) reste 100 % client via le `cardStore`/`cardLoader` existants.

```ts
// src/game/types/state.ts
export interface CardInstance {
  instanceId: InstanceId;
  cardId: string | null; // null pour token pur ; → Card.id de la base
  owner: Seat; // propriétaire (immuable, 501.2)
  controller: Seat; // contrôleur courant (peut différer dans le Monde)
  location: ZoneRef;
  position: number; // index dans zone ordonnée ; 0 = sommet Pioche
  face: "hidden" | "recto" | "verso";
  orientation: "upright" | "tapped" | null; // null hors monde/havreSac (106.3)
  counters: CardCounters;
  attachments: AttachedInstance[]; // équipements/Dofus (role distinct, 304.5/305.3)
  revealedTo: Seat[]; // révélations ciblées (look/recherche)
  modifiers: ReadonlyArray<unknown>; // vide en V1 ; crochet automatisation (purgé via 501.5)
}

export interface CardCounters {
  hp?: number; // PV courant — Héros (410.2)
  resistance?: number; // Résistance — Havre-Sac (306.3)
  damage?: number; // Dommages cumulés, purgés fin de tour (410.8)
  level?: number; // 1→2→3 (307.4/307.5)
  xp?: number; // 6→N2, 18→N3 (307.4/307.5)
  tokens?: Record<string, number>; // jetons génériques nommés
}

export interface PlayerBoard {
  seat: Seat;
  pioche: InstanceId[];
  main: InstanceId[];
  havreSac: InstanceId[];
  defausse: InstanceId[];
  reserve: InstanceId[];
  exil: InstanceId[];
  limbo: InstanceId[];
  heroInstanceId?: InstanceId;
  havreSacInstanceId?: InstanceId;
  derived: { pa: number; pm: number }; // recopiés du Héros pour l'UI
}

export interface GameState {
  gameId: string;
  status: "lobby" | "active" | "finished";
  seats: Record<Seat, PlayerBoard>;
  monde: InstanceId[]; // commune — contient les 2 Havre-Sac
  fileAttente: InstanceId[]; // commune, ordonnée LIFO (503.3)
  instances: Record<InstanceId, CardInstance>; // registre central omniscient (serveur)
  turn: { active: Seat; number: number; phase: TurnPhase; firstPlayer: Seat };
  rng: { masterSeedHash: string }; // jamais la seed brute côté client
  seq: number; // dernier event appliqué
}
```

### 5.2 Redaction : `redactStateFor(state, viewer)`

**La visibilité est une projection, pas un champ.** Le `GameState` serveur est omniscient ; chaque client reçoit une **vue redactée** dont l'information cachée est _absente_ (jamais juste masquée cosmétiquement → rien à inspecter dans les devtools pour tricher).

```ts
// src/game/engine/redact.ts
export type RedactedZone =
  | { kind: "full"; instances: CardInstance[] }
  | { kind: "count"; count: number; faceDown: true };

export function redactStateFor(
  state: GameState,
  viewer: Viewer,
): RedactedGameState;

/** Le viewer connaît-il le cardId de cette instance ? */
export function canSeeCardId(inst: CardInstance, viewer: Seat): boolean {
  if (inst.revealedTo.includes(viewer)) return true;
  const spec = ZONE_SPECS[inst.location.zone];
  if (inst.location.zone === "main")
    return "owner" in inst.location && inst.location.owner === viewer;
  if (inst.location.zone === "pioche" || inst.location.zone === "reserve")
    return false;
  if (spec.public) return inst.face !== "hidden"; // publique sauf face cachée
  return inst.owner === viewer;
}
```

- **Pioche** : `instanceId` exposés mais `cardId` jamais ; ordre brouillé **même pour le propriétaire** → impossible de connaître la prochaine carte (le serveur seul le sait via la `masterSeed`).
- **Main adverse** : `kind:'count'`, `cardId` masqués, `instanceId` stables (permet l'animation « il joue _cette_ carte »).
- **Défausse / File / Monde / Havre-Sac** : `kind:'full'` (sauf cartes `faceDown` non révélées).
- **`instanceId` jamais masqué** : identifiant opaque sans info catalogue → autorise deltas et animations sans rien fuiter.

### 5.3 Sync client (reconstruction + réconciliation)

Le client maintient un `RedactedGameState` local et applique `applyDelta(view, redactedEvent)` :

1. **Garde de version** : si `event.seq !== view.seq + 1` → désync → resync complet (`pull_events` depuis `lastSeq`).
2. Applique la mutation redactée. Un `MOVE` d'une carte qui _devient visible_ à l'arrivée (main→monde) porte le `cardId` révélé dans le delta (le serveur l'inclut car il devient légal de le voir).
3. `view.seq = event.seq`.

## 6. Couche serveur (Postgres + Edge + Realtime + RLS)

Aligné sur le moule de `0001_init.sql` (RLS owner-scoped, trigger `set_updated_at`, `id text` client, `user_id uuid → auth.users`).

### 6.1 Schéma `supabase/migrations/0002_game.sql`

```sql
create type public.game_status as enum ('lobby','active','finished','aborted');
create type public.player_seat as enum ('A','B');

-- une partie
create table public.games (
  id          text primary key,                 -- uuid interne
  code        text unique not null,             -- code de table à 6 car. (WAKF42)
  status      public.game_status not null default 'lobby',
  ruleset     text not null default 'free-v1',
  current_seat public.player_seat,
  turn_number int not null default 0,
  public_state jsonb not null default '{}'::jsonb, -- snapshot REDACTÉ-NEUTRE (public)
  master_seed_hash text,                        -- engagement RNG (audit)
  master_seed text,                             -- SECRET ; révélé en fin de partie
  last_seq    bigint not null default 0,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- sièges (2 lignes/partie) + spectateurs via flag séparé
create table public.game_players (
  game_id text not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat    public.player_seat not null,
  deck_id text,
  primary key (game_id, seat),
  unique (game_id, user_id)
);

-- LE JOURNAL : source de vérité, append-only, ordre total via PK (game_id, seq)
create table public.game_events (
  game_id text not null references public.games(id) on delete cascade,
  seq     bigint not null,
  actor   text not null,                        -- 'A' | 'B' | 'system'
  type    text not null,
  payload jsonb not null default '{}'::jsonb,   -- PUBLIC (safe à diffuser)
  payload_private jsonb not null default '{}'::jsonb, -- { "A": {...}, "B": {...} } secrets/siège
  parent_seq bigint not null,                   -- concurrence optimiste
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);
create index game_events_game_idx on public.game_events(game_id, seq);

-- état SECRET par joueur (facultatif si tout passe par payload_private + replay)
create table public.game_player_state (
  game_id text not null references public.games(id) on delete cascade,
  seat    public.player_seat not null,
  private_state jsonb not null default '{}'::jsonb,
  primary key (game_id, seat)
);
```

### 6.2 RLS (le cœur de la défense en profondeur)

```sql
alter table public.games             enable row level security;
alter table public.game_players      enable row level security;
alter table public.game_events       enable row level security;
alter table public.game_player_state enable row level security;

create function public.is_player(p_game text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_players
                 where game_id = p_game and user_id = auth.uid());
$$;

-- lecture réservée aux 2 joueurs (spectateurs : policy publique ajoutée plus tard)
create policy games_select  on public.games        for select using (public.is_player(id));
create policy gp_select     on public.game_players  for select using (public.is_player(game_id));
create policy ge_select     on public.game_events   for select using (public.is_player(game_id));
-- un joueur ne lit QUE sa propre ligne secrète :
create policy gps_select    on public.game_player_state for select
  using (exists (select 1 from public.game_players gp
                 where gp.game_id = game_player_state.game_id
                   and gp.seat = game_player_state.seat
                   and gp.user_id = auth.uid()));

-- AUCUN write direct : tout passe par l'Edge Function (service_role).
revoke insert, update, delete on public.game_events from authenticated, anon;
```

**Vue de redaction** — le client ne lit jamais `game_events` brut ; il lit une vue qui ne ressort que le fragment de **son** siège :

```sql
create view public.my_game_events with (security_invoker = true) as  -- OBLIGATOIRE (sinon fuite)
select e.game_id, e.seq, e.actor, e.type, e.payload, e.parent_seq, e.created_at,
       e.payload_private -> (
         select gp.seat::text from public.game_players gp
         where gp.game_id = e.game_id and gp.user_id = auth.uid()
       ) as payload_self
from public.game_events e
where public.is_player(e.game_id);
```

### 6.3 Edge Function `submit_event` (unique chemin d'écriture)

Séquence atomique (TypeScript Deno, sans état) :

1. **Auth** : `actor === auth.uid()` (siège de l'appelant).
2. **Autorisation** : partie `active`, bon tour pour les coups de tour, liste blanche des coups hors-tour (blocage 704, Réaction 705, mulligan).
3. **RNG** si `SHUFFLE`/`draw` (HMAC sur `masterSeed`, §4.4).
4. **Redaction** : calcule `payload` + `payloadPrivate[seat]` (réutilise le `redact.ts` partagé client/serveur).
5. **Append atomique** : appelle `append_event(game_id, expected_last_seq := parentSeq, …)` — fonction SQL qui `SELECT … FOR UPDATE` sur `games`, vérifie `last_seq === parentSeq` (sinon rejet → le client pull/rebase/resoumet), attribue `seq = last_seq + 1`, insère l'event **et** met à jour `public_state`/`last_seq` dans **la même transaction**.
6. **Diffusion** (cf. §6.4).

### 6.4 Realtime (divergence tranchée)

Deux approches proposées : (X) broadcast direct d'un event déjà redacté par siège ; (Y) broadcast d'un **signal léger `{ seq }`** + chaque client re-`SELECT my_game_events`. **Décision : (Y) signal `seq` + pull RLS.**

- **Pourquoi** : Postgres Changes / broadcast ne passent pas par la vue `my_game_events` → broadcaster un payload complet risque de fuiter `payload_private`. La règle d'or « le fil ne transporte que du public ou un signal ; le secret ne sort que par `SELECT` RLS » élimine _par construction_ toute fuite par le canal de diffusion. Le coût (un aller-retour `select … where seq > lastSeq`) est négligeable en tour-par-tour.
- **Mécanisme** : canal `game:{id}`, l'Edge Function émet `broadcast { seq }` ; chaque client fait `select * from my_game_events where game_id=:id and seq > :lastSeq order by seq` → events **déjà redactés par RLS**, applique via `applyDelta`. Un event Realtime manqué est rattrapé au prochain pull (resync par trou de séquence).
- **Presence** : canal `presence` → « adversaire connecté/déconnecté ».
- **Reconnexion (gratuite)** : à la reprise, `select * from my_game_events order by seq` → replay du journal → état exact reconstruit. **Spectateur** = même `SELECT` sans `payload_self` (zones publiques uniquement), via une policy de lecture publique ajoutée au lot dédié.

## 7. UI table (Vue 3)

### 7.1 Principe : la table ne possède rien

Le `GameState` dérive des events ; les composants lisent une **vue redactée** (`viewFor(mySeat)`) et **n'écrivent jamais l'état** — ils émettent des intentions. Esthétique GRIMOIRE existante (papier + filets, cinabre `#F04E22`, pas de glass/glow). **Sur le plateau : vignettes uniquement** (`/images/cards/thumbs/<id>.webp`, ~30-50 sprites) ; zoom = image pleine via `CardZoomModal.vue` réutilisé tel quel.

### 7.2 Layout 1v1 point-symétrique

Plateau en grille CSS 7 rangées (cartes adverses _pas_ tête-bêche pour la lisibilité, seul l'ordre vertical s'inverse). Le **Monde est une bande unique commune** (506.1) divisée par un filet médian ; « engager au combat » = `MOVE` visuel vers la médiane. Havre-Sac à gauche, Pioche/Défausse empilées à droite. Liseré gauche `--spine` coloré par élément (via `src/config/elementColors.ts` à extraire du doublon dans `CardZoomModal.vue` : Air `#5FB22A`, Eau `#1F9CEC`, Feu `#F04E22`, Terre `#F0A62B`, Neutre `#98A1AF`).

### 7.3 Composants (`src/components/game/`)

```
GameBoard.vue        — orchestrateur ; lit gameStore.viewFor(mySeat)
 ├─ PlayerSide.vue    — demi-plateau (perspective 'self'|'opponent')
 │   ├─ GameZone.vue  — une zone (cible de drop) ; layout row|fan|pile|bag
 │   │   ├─ GameCard.vue   — carte (vignette, rotation, dommages, équipements)
 │   │   ├─ DeckPile.vue   — pile face cachée (compteur + clic)
 │   │   └─ HandFan.vue    — main (self=recto, opponent=dos comptés)
 │   └─ PlayerStatusBar.vue — PV/PA/PM/XP cliquables, Héros recto/verso
 ├─ QueueStrip.vue    — File d'Attente (bande commune ordonnée)
 ├─ CardContextMenu.vue — menu (Headless UI) : déplacer/incliner/retourner/chercher…
 ├─ DeckSearchModal.vue — regarder/chercher (révèle au seul demandeur)
 ├─ ActionLog.vue     — journal lisible + bouton Undo (aria-live)
 └─ TableToolbar.vue  — Piocher / Mélanger / Dé / Passer tour / Concéder
```

### 7.4 Optimistic update + réconciliation

- **Moves déterministes** (glisser une carte connue Monde→Défausse, incliner, compteur) : appliqués **immédiatement** en local (`pending[]`), puis réconciliés sur l'event serveur. `:key="instanceId"` stable + `<TransitionGroup>` (FLIP) → la carte s'anime, qu'il s'agisse d'un optimiste confirmé ou d'une **correction serveur**. Un drop rejeté = la carte glisse en douceur à son origine (pas de saut).
- **Events non déterministes** (`SHUFFLE`, `draw` depuis Pioche secrète) : l'UI **n'invente jamais** le résultat → état transitoire (« pioche… ») jusqu'à l'event serveur.
- **Main adverse** : `HandFan` mode `opponent` rend `Array(handCount)` de dos ; quand l'adversaire joue, l'event hand→world révèle l'identité _à ce moment_.

```ts
// src/stores/gameStore.ts (setup-store, fonctionnel — convention CLAUDE.md)
export const useGameStore = defineStore("game", () => {
  const events = ref<PersistedEvent[]>([]); // séquence autoritative
  const pending = ref<PendingIntent[]>([]); // optimistes en vol
  const mySeat = ref<Seat>("A");
  const instances = computed(() => deriveState(events.value)); // fold pur
  const board = computed(() =>
    reduceWithPending(instances.value, pending.value),
  );
  const viewFor = (v: Viewer) => redactStateFor(board.value, v); // ce que l'UI lit
  function move(p: MovePayload): void {
    dispatch({ type: "MOVE", ...p });
  } // primitive reine
  function draw(n = 1): void {
    dispatch({ type: "DRAW", count: n });
  }
  function tap(id: InstanceId): void {
    /* SET_ORIENTATION */
  }
  function setCounter(id: InstanceId, k: CounterKind, delta: number): void {}
  function shuffle(z: ZoneRef): void {
    dispatch({ type: "SHUFFLE", zone: z });
  }
  function undo(): void {
    dispatch({ type: "UNDONE" });
  }
  function applyEvent(e: PersistedEvent): void {
    /* réconcilie pending */
  }
  return {
    mySeat,
    viewFor,
    move,
    draw,
    tap,
    setCounter,
    shuffle,
    undo,
    applyEvent /*…*/,
  };
});
```

Le transport (Realtime + Edge) est encapsulé dans `src/services/gameSync.ts` (jumeau de `cloudSync.ts`), pas dans le store. `gameStore` lit `cardStore.getCard(cardId)` pour hydrater images/stats au rendu, et un `Deck` existant au démarrage pour construire la séquence d'events initiale.

### 7.5 Accessibilité & mobile

- **Desktop ≥1024px** : plateau complet, drag-and-drop, menu contextuel.
- **Mobile <768px** : mode **tap-to-act** (sélectionner carte → taper zone-cible), plateau en accordéon vertical, main en bande scrollable, compteurs/menu en bottom-sheet.
- **A11y** : `GameZone` = `role="group"` + `aria-label` ; `GameCard` = `role="button"` + label (« Allié Bouftou, incliné, 1 dommage »/« carte face cachée »), `tabindex="0"`, tout faisable au clavier (même chemin que tap mobile). `ActionLog` = `aria-live="polite"`. Inclinaison doublée d'un état ARIA. `prefers-reduced-motion` coupe les transitions FLIP.
- **Repli** : la vue `/play` **garde son mode compagnon actuel** (PV/dé/chrono, 100 % tactile/hors-ligne) en fallback. On ne casse jamais l'existant ; on extrait `useWakeLock()` de `GameView.vue` pour le réutiliser.

### 7.6 Routes

```ts
{ path: '/play',            name: 'play',      component: GameView,      meta:{ requiresAuth:true } }, // hub existant
{ path: '/play/table/:code?', name: 'gameTable', component: GameTableView, meta:{ requiresAuth:true } },
```

`GameTableView.vue` = écran plein, lobby + invitation par code (URL partageable comme le partage de deck base64 existant).

## 8. Périmètre V1 + roadmap par lots + chemin vers l'automatisation

### 8.1 Ce qui SHIP en V1 (liste fermée)

- **Cycle de partie** : créer/rejoindre par **code à 6 caractères**, 2 sièges + spectateurs (lecture seule), sélection de deck depuis `deckStore` (verrouillé au démarrage), placement initial conforme (Havre-Sac→Monde dressé 306.1, Héros→Havre-Sac dressé 307.1, 48 cartes→Pioche mélangée serveur, main de départ = PA). Mulligan **manuel** (102.4).
- **6 zones + Réserve + Exil**.
- **Verbes de table** (tous dérivés de `MOVE`) : `draw`, `move`, `shuffle` (serveur), `tap`/`untap`, `flip`/`flipLevel`, `setCounter` (PV/XP/Dommages/niveau/tokens), `spawnToken`, `reveal`/`peek`, `attach`/`detach`.
- **Robustesse** : undo (`UNDONE`), log lisible, reconnexion (pull+replay), presence.

### 8.2 Hors V1 (à écrire noir sur blanc dans les tickets)

❌ Aucun enforcement (coût/niveau/élément/phase/capacité Havre-Sac/cibles légales/combat auto). ❌ Pas de DSL d'effets ni moteur de timing. ❌ Pas de matchmaking/classement/tournoi/timer. ❌ Pas de 2v2. ❌ Mobile utilisable mais non optimisé.

### 8.3 Lots livrables (PR par PR)

| Lot    | Titre                 | Contenu                                                                                                                                                                   | Dépend |   Testable hors-réseau   | Effort |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | :----------------------: | ------ |
| **L0** | Types & events        | `src/game/types/{zones,events,state}.ts` ; `ZONE_SPECS` ; figer le contrat                                                                                                | —      |            ✅            | XS     |
| **L1** | Reducer + verbes purs | `applyEvent`, `deriveState`, verbes, log dérivé, undo, **redaction `redactStateFor`**                                                                                     | L0     | ✅ **Vitest exhaustif**  | M      |
| **L2** | Schéma + Edge + RNG   | `0002_game.sql` (RLS, vue `my_game_events`), Edge `submit_event`/`append_event`/`pull_events`/`create_game`/`join`, RNG serveur, **tests de redaction (dont spectateur)** | L1     | partiel (Supabase local) | L      |
| **L3** | Sync Realtime + reco  | `gameStore` + `gameSync.ts` : broadcast signal `seq`, pull+replay, presence, conflit optimiste `parentSeq`, reconnexion                                                   | L2     |        2 onglets         | L      |
| **L4** | UI Table              | `/play/table/:code`, plateau drag-and-drop, zoom, compteurs, mains redactées, lobby                                                                                       | L3     |      E2E Playwright      | L      |
| **L5** | Polish                | undo/redo UI, log, indicateurs presence, replay viewer minimal                                                                                                            | L4     |           E2E            | M      |

**Pourquoi cet ordre** : L0→L1 livre un **moteur complet testé à 100 % en unitaires, sans réseau** — jalon de dérisquage majeur (toute la logique de jeu _et la redaction_ prouvées avant la moindre ligne réseau). L2 ajoute l'autorité (ordre/RNG/redaction serveur), L3 le transport, L4 le visible, L5 le confort. Chaque lot est mergeable et démo-able.

### 8.4 Chemin vers l'automatisation (post-V1, incrémental)

Trajectoire Cockatrice→XMage, exploitant l'ensemble **fini (~1585 cartes)** et les effets **déjà structurés en data** (`CardEffect`, `CardKeywordInfo`, `linkedTokens`, `isOncePerTurn`, `requiresIncline` existent dans `cards.ts`). **Levier décisif : un effet automatisé = du code qui émet les mêmes events qu'un joueur. Zéro nouveau type d'event, zéro refonte** — on ajoute un _producteur_ d'events (`RuleEngine`) au-dessus du journal et du reducer inchangés.

- **Étape A — Aides passives (zéro DSL)** : surbrillance des cibles légales (702.2/702.3), compteur de capacité du Havre-Sac, rappel « 1 attaque/tour », auto-retrait des Dommages en fin de tour (410.8). Pur dérivé du state, risque nul.
- **Étape B — Structure de tour assistée** : boutons de phase émettant des macro-events (« redresser tout » = rafale de `SET_ORIENTATION`).
- **Étape C — DSL déclaratif carte-par-carte** adossé aux `CardEffect` (`EffectAtom { trigger, cost, oncePerTurn, do: GameOp[] }`). Couverture **mesurable** (« X/1585 scriptées »), en commençant par les keywords génériques (`Riposte`/`Portée`/`Critique`/`Résistance`) qui couvrent des centaines de cartes. Carte non scriptée → **retombe sur le mode manuel V1** (jeu toujours jouable).
- **Étape D — Moteur de timing** (le morceau dur, justifié seulement quand C est mûr). La **File d'Attente est déjà une pile LIFO publique** (503.3 : « résolus dans l'ordre inverse ») → exactement une stack à la Magic. Le moteur collecte les triggers, les empile dans `fileAttente` (zone existante !), ouvre des fenêtres de priorité pour les Réactions (705), résout en LIFO en ré-émettant des events. La **redaction par siège construite en V1 paie double** : « on ne peut pas réagir à un événement dans un Havre-Sac adverse » (5134) mappe directement dessus.

## 9. Risques & parades

| Risque                                                  | Impact   | Parade                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Désync d'état** (events désordonnés, broadcast perdu) | Critique | `seq` Postgres = ordre autoritatif unique ; Realtime = simple signal ; conflit optimiste `parentSeq` ; réconciliation systématique par **pull-and-replay**. Tests : injecter désordre/perte.                                                                            |
| **Fuite d'info** (deviner main/pioche adverse)          | Élevé    | Redaction **server-side** (Edge), jamais client ; secret uniquement dans `payload_private`/`payload_self` via vue RLS `security_invoker` ; **le fil ne transporte jamais de secret** ; suite de tests dédiée « B ne reçoit jamais un `cardId` de la main de A » dès L2. |
| **RNG triché / mélange devinable**                      | Élevé    | Seed serveur cryptographique non diffusé ; ordre Pioche `hidden` pour tous ; commit-reveal (hash publié, seed révélé en fin de partie). Jamais de random côté client dans un event persisté.                                                                            |
| **`security_invoker` oublié sur la vue**                | Élevé    | La vue `my_game_events` **doit** être `security_invoker = true` (sinon elle s'exécute avec les droits du créateur et contourne le RLS → fuite massive). Test d'intégration dédié.                                                                                       |
| **Latence Edge** (round-trip par append/shuffle)        | Moyen    | UI optimiste pour les moves déterministes ; events compacts ; Edge seulement pour append/shuffle/pull, pas pour chaque micro-interaction.                                                                                                                               |
| **Quotas Realtime/Edge (plan free)**                    | Moyen    | 1v1 = volume faible ; broadcast d'un **signal `seq`** pas de l'event ; archivage des `game_events` des parties finies.                                                                                                                                                  |
| **Sur-ingénierie du moteur de règles trop tôt**         | Moyen    | V1 **strictement** libre (périmètre §8.2 verrouillé) ; automatisation post-V1 incrémentale ; ne jamais bloquer la table sur une carte non scriptée.                                                                                                                     |
| **Couplage au schéma `Card`**                           | Faible   | Le module ne référence que `cardId` + `instanceId` ; ne duplique aucune stat. `cards.ts` reste source unique.                                                                                                                                                           |
| **Undo traversant un `SHUFFLE`**                        | Faible   | `UNDONE` append-only ignoré au fold (jamais d'event inverse de mélange côté client, ordre secret) ; refusé si de l'info d'ordre a déjà fuité.                                                                                                                           |

## 10. Premier pas concret recommandé — **Lot 1 (L0+L1)**

**Implémenter le moteur pur, testé à 100 % en unitaires, sans aucune dépendance réseau.** C'est le jalon qui dérisque tout le projet : si le reducer et la redaction sont prouvés en isolation, le reste n'est que transport.

Fichiers à créer :

- `src/game/types/zones.ts` — `Seat`, `Viewer`, `ZONE`/`META_ZONE`, `ZoneRef`, `ZoneSpec`, `ZONE_SPECS`.
- `src/game/types/events.ts` — `PersistedEvent`, `EventType`, `MovePayload`, `Position`, `FaceDirective`, payloads.
- `src/game/types/state.ts` — `CardInstance`, `CardCounters`, `PlayerBoard`, `GameState`, `RedactedGameState`, `RedactedZone`.
- `src/game/engine/reducer.ts` — `applyEvent` (pur), `deriveState` (fold), helpers `applyMove`/`applyShuffle`/etc.
- `src/game/engine/redact.ts` — `redactStateFor`, `canSeeCardId`, `canSeeOrder`.
- `src/game/engine/verbs.ts` — `drawCard()`, `playToWorld()`, `discard()`, `shuffle()`… → construisent des `MOVE`/events.
- `src/game/engine/setup.ts` — `initialEventsFromDeck(deck, seat)` : Havre-Sac→Monde, Héros→Havre-Sac, 48→Pioche.

Critères de DONE du lot 1 (`npx vitest run` vert) :

1. `deriveState([...])` reconstruit un état déterministe ; rejouer la même séquence deux fois donne un état strictement égal.
2. Le placement initial respecte les invariants : `pioche.length === 48`, Héros dans le Havre-Sac dressé, 2 Havre-Sac dans le Monde, mains vides.
3. **Test de redaction (le plus important)** : `redactStateFor(state, 'B')` ne contient **jamais** un `cardId` de la main ou de la Pioche de A ; l'ordre de la Pioche de A n'est dérivable d'aucune sortie.
4. `MOVE` Monde↔Havre-Sac conserve les `counters` (501.5) ; tout autre changement de zone les purge.
5. `undo` (`UNDONE { targetSeq }`) ré-fold sans l'event ciblé et produit l'état attendu.

Ce lot utilise les factories Vitest existantes (`tests/factories/card.ts`) et ne touche ni Supabase ni l'UI — il est mergeable seul et constitue la fondation prouvée sur laquelle tout le reste se branche.

---

Fichiers de référence (ancrage vérifié) : `E:\wakfu_deck_builder\src\types\cards.ts` (définitions immuables, `HeroCard.recto/verso`, `CardKeyword`, `DeckCard.quantity`), `E:\wakfu_deck_builder\src\data\rules.ts` (6 zones 501.1, phases, combat, 410.8), `E:\wakfu_deck_builder\supabase\migrations\0001_init.sql` (moule RLS owner-scoped + trigger `set_updated_at` à réutiliser), `E:\wakfu_deck_builder\_incoming\rules-reference.txt` (File d'Attente LIFO, Réactions, visibilité Havre-Sac, 501.5). Nouveaux fichiers proposés sous `E:\wakfu_deck_builder\src\game\`, `E:\wakfu_deck_builder\src\stores\gameStore.ts`, `E:\wakfu_deck_builder\src\services\gameSync.ts`, `E:\wakfu_deck_builder\supabase\migrations\0002_game.sql`, `E:\wakfu_deck_builder\supabase\functions\submit_event\`.

---

# Annexe — Revue adversariale (critique)

I have everything I need. The grounding confirms my critique points, and importantly reveals that rule 4596 says cards go to the **owner's instance** of personal zones — which the design's `ZoneRef.owner: Seat` handles, but combined with the controller-can-change-mid-combat rule (6065) creates a real modeling gap the design's `MOVE` doesn't address. Let me write the adversarial critique.

---

# Critique adversariale — « La Table des Douze » V1

> Revue d'architecte critique. J'ai relu le code réel (`src/types/cards.ts`, `src/data/rules.ts`, `supabase/migrations/0001_init.sql`), le texte officiel intégral (`_incoming/rules-reference.txt`, 11 221 lignes), et vérifié l'absence de `src/game/` et `supabase/functions/`. Le document est solide sur les fondations (event-sourcing, redaction server-side, 100 % Supabase) — ces choix sont les bons et je ne les rouvre pas. Mais il sous-estime gravement le coût de la V1 et contient **trois erreurs factuelles de règles** qui contaminent le modèle de données. Verdict détaillé en fin.

---

## A. Trous fonctionnels (cas Wakfu mal couverts)

### A1. 🔴 ERREUR DE RÈGLE — La File d'Attente n'est PAS une pile LIFO

Le document répète quatre fois que `fileAttente` est « LIFO public », une « pile LIFO (503.3) », « exactement une stack à la Magic ». **C'est faux et c'est vérifiable dans le texte officiel :**

- Ligne 4715 : « Quand une carte est jouée […] il _entre dans la File d'Attente_ **derrière** les cartes et les pouvoirs qui s'y trouvent déjà. » → insertion **en queue (FIFO)**.
- Ligne 4728 : « tous les cartes et les pouvoirs dans la File d'Attente sont **résolus dans l'ordre inverse** de leur mise dans la File. »

C'est une **file d'insertion FIFO résolue en LIFO** — sémantiquement une pile _seulement à la résolution_, mais l'ordre d'affichage et d'insertion est FIFO. Pire, le pilier « Étape D » de la roadmap d'automatisation s'appuie explicitement sur l'assertion « la File d'Attente est déjà une pile LIFO publique → exactement une stack à la Magic ». **Ce n'est pas une stack Magic** : à la Magic, on empile et on dépile par le sommet (pure LIFO des deux côtés). Ici on enfile par la queue et on dépile par la queue. Le modèle de timing post-V1 conçu sur cette fausse prémisse sera à refaire.

**Impact** : moyen en V1 (table libre, l'ordre est manuel), mais le document vend cette zone comme « fondation pour l'automatisation » — fondation bâtie sur une lecture erronée. **Parade** : corriger `ZONE_SPECS.fileAttente` en documentant `ordered:true` + sémantique « append-tail / resolve-tail » ; renommer le commentaire `// LIFO public` en `// FIFO d'insertion, résolution en ordre inverse (4715/4728)` ; retirer l'analogie « stack à la Magic » du §8.4-D.

### A2. 🔴 Le modèle owner/controller est déclaré mais jamais branché sur `MOVE` ni sur la redaction

`CardInstance` a bien `owner` ET `controller`. Mais :

1. **`ZoneRef` n'encode que `owner`** : `{ zone; owner: Seat }`. Or la règle 4596 (vérifiée) impose que toute carte mise dans une zone personnelle (Pioche/Défausse/Main/Havre-Sac) aille dans **l'instance du propriétaire**, pas du contrôleur. Le `applyMove` du document fait `removeFromZone`/`insertIntoZone` sans jamais consulter `owner` vs `controller` — un Allié volé (rule 6065, « prendre le contrôle d'un Allié adverse ») puis détruit doit aller dans **la défausse de son owner**, pas du joueur qui le contrôlait. Le `MOVE` tel qu'écrit enverra la carte dans la mauvaise défausse.
2. **`canSeeCardId` utilise `inst.owner === viewer`** pour les zones publiques non-`main`. Mais un Havre-Sac est `public:true` → OK ; en revanche la redaction d'un Allié **contrôlé par l'adversaire mais possédé par moi** (présent dans le Monde) n'est pas un problème (Monde public). Le vrai piège : `prendre le contrôle` en plein combat (6065) change `controller` _sans MOVE_ — il faut un event `SET_CONTROLLER`, **absent de la taxonomie `EventType`**.

**Impact** : élevé dès qu'on veut automatiser, faible en V1 pur-manuel — MAIS le document prétend « poser de bonnes fondations ». Une fondation qui n'a pas d'event pour changer de contrôleur n'en est pas une. **Parade** : ajouter `SET_CONTROLLER` à `EventType` dès L0 ; faire que `applyMove`, pour les zones personnelles, route vers `owner` et non vers le `to.owner` fourni par le client (sinon un client malveillant met une carte dans la pioche adverse). Le `to.owner` doit être **dérivé serveur** = `instance.owner` pour les zones personnelles, ignoré pour Monde/File.

### A3. 🟠 Équipements/Dofus attachés : `attachments[]` existe, mais aucun event ne gère leur destruction en cascade

Le document a `ATTACH`/`DETACH` et `attachments: AttachedInstance[]`. Mais le texte officiel impose des cascades que la V1 « libre » prétend ignorer — sauf qu'**en pratique le joueur devra les faire à la main et l'UI doit les rendre faisables** :

- Ligne 2237 : « Lorsqu'un Allié quitte le jeu, les Équipements qu'il porte sont détruits. » Quand un joueur `MOVE` un Allié porteur Monde→Défausse, **ses 2 équipements attachés doivent suivre**. Le `applyMove` du document déplace une seule `instanceId` et ne touche pas `attachments`. Résultat : équipements orphelins flottant dans le Monde, pointant vers un `instanceId` qui n'est plus là.
- Le `MovePayload` ne porte **qu'un seul** `instanceId`. Déplacer un porteur + ses attachements = soit un `MOVE` qui cascade (mais alors il n'est plus « atomique = une carte »), soit N events séparés (mais alors l'undo d'un seul casse l'invariant).

**Impact** : élevé — c'est le cas le plus fréquent du jeu réel (tout Héros porte de l'équipement dès le tour 2). **Parade** : décider explicitement que `attachments` voyagent **avec** leur porteur dans `applyMove` (lire `inst.attachments`, les déplacer en bloc, purger si la destination n'est pas une zone de jeu) — et le tester en L1. Documenter que `detach` est un event distinct quand le joueur veut séparer. Sans ça, l'UI montrera des cartes fantômes.

### A4. 🟠 Héros recto/verso : `SET_LEVEL` existe mais le modèle de face est incohérent

`CardInstance.face: 'hidden' | 'recto' | 'verso'` mélange **deux concepts orthogonaux** : la visibilité (cachée/révélée) et l'orientation recto/verso du Héros. Un Héros peut être :

- Niveau 1 = recto, **face visible** ;
- Niveau 2 = verso, **face visible** ;
- jamais « hidden » (le Héros n'est jamais face cachée).

Mais un Allié joué face cachée est `hidden` et a aussi un recto. En fusionnant les deux axes dans un seul champ `face`, on ne peut pas représenter « Allié face cachée dont l'identité réelle est sa face recto » ni « Héros niveau 2 actuellement non révélé » (cas théorique de certains effets). Le document a déjà séparé contenu/ordre pour les zones (§3.2, bonne idée) mais **régresse** en fusionnant visibilité/face sur l'instance.

**Impact** : moyen. **Parade** : deux champs — `faceDown: boolean` (visibilité, déjà présent dans `MovePayload.FaceDirective` mais pas reporté sur l'instance de façon cohérente) **et** `side: 'recto' | 'verso'` (état recto/verso, n'a de sens que pour les Héros). Le `SET_LEVEL` bascule `side` + `counters.level/xp`. Les deux ne doivent jamais être le même champ.

### A5. 🟠 Mulligan/Rollback (102.4) : modélisé comme « manuel » mais c'est un `SHUFFLE` + `draw` récursif côté serveur

Le §8.1 dit « Mulligan **manuel** (102.4) ». Or le rollback officiel (vérifié rules.ts ligne 19 + ref 5419) est : recycler **toute la main** dans la Pioche, **remélanger**, repiocher `PA - n` cartes. Le mélange est **autoritatif serveur**. « Manuel » est donc faux : le client ne peut pas mélanger. Si « manuel » signifie « le joueur clique un bouton qui déclenche un `SHUFFLE` serveur + `draw` », alors c'est OK — mais ce n'est pas dit, et le décompte dégressif (`PA-1`, `PA-2`…) est une règle métier que « libre de règles » prétend ne pas connaître. Le joueur devra compter lui-même → frictions et triche triviale (repiocher 6 indéfiniment).

**Impact** : moyen (c'est le tout premier moment de chaque partie — mauvaise première impression si bancal). **Parade** : traiter le mulligan comme une macro serveur dédiée `MULLIGAN`, pas comme « manuel ». C'est peu de code et ça évite le contournement.

### A6. 🟡 Le premier tour interdit les mouvements vers le Monde (ref 4943, 5362) — non géré

« Aucun joueur ne peut jouer de carte dans le Monde […] durant le premier tour du premier joueur » (4943). En table 100 % libre, l'UI autorisera ce coup illégal. Acceptable pour une V1 « auto-arbitrée », mais le document liste « placement initial conforme » comme un livrable V1 — or le placement initial **est** un mouvement vers le Monde au tour 0. Il faut au moins ne pas s'auto-contredire : le setup pose les Havre-Sac dans le Monde _avant_ le tour 1 via events `system`, pas via un coup joueur. C'est implicite mais pas spécifié, et c'est exactement le genre de détail qui fait dérailler L1.

---

## B. Risques techniques

### B1. 🔴 Atomicité « Edge Function → append_event » : le chemin heureux est décrit, le chemin d'échec ne l'est pas

Le §6.3 décrit `submit_event` qui (4) calcule la redaction puis (5) appelle `append_event(... expected_last_seq ...)` avec `FOR UPDATE` et rejet si `last_seq !== parentSeq`. **Le problème : les étapes 3-4 (RNG + redaction) se passent AVANT le lock, donc sur un `last_seq` potentiellement périmé.** Scénario concret :

1. Edge lit `last_seq = 10`, calcule un `SHUFFLE` avec `seed = HMAC(masterSeed, gameId | 11 | zoneKey)`.
2. Pendant ce temps, un autre coup passe → `last_seq = 11`.
3. `append_event(expected=10)` est rejeté. L'Edge doit **re-pull, re-dériver le seed pour seq=12, re-mélanger**, et resoumettre. Le document dit « le client pull/rebase/resoumet » — mais c'est l'**Edge** qui a fait le RNG, pas le client. Renvoyer l'échec au client pour qu'il resoumette signifie **re-tirer le RNG** → soit la `permutation` change (incohérent avec un éventuel optimistic), soit il faut une boucle de retry _dans_ l'Edge. Non spécifié.

**Impact** : critique — c'est la jointure exacte entre les deux autorités (TS et SQL) que le document présente comme son innovation. **Parade** : déplacer **tout** le travail dépendant de `seq` (donc le RNG dérivé de `seq`, §4.4-2) **à l'intérieur** de la transaction SQL, ou dériver le seed d'un identifiant **non lié à seq** (ex. un `nonce` aléatoire stocké dans l'event lui-même, engagé par hash). Sinon, boucle de retry bornée (3 essais) dans l'Edge avec re-dérivation. À trancher et écrire noir sur blanc — c'est le cœur de la correction.

### B2. 🟠 Le RNG dérivé `HMAC(masterSeed, gameId | seq | zoneKey)` est rejouable et prévisible une fois la seed connue — mais aussi _avant_, partiellement

Le commit-reveal est correct sur le principe. Deux failles :

- **Le `zoneKey` est public et `seq` est public.** Un joueur qui obtient `masterSeed` par n'importe quel biais (log Edge, variable d'env mal protégée, fin de partie) peut recalculer **tout l'historique ET le futur** des mélanges. C'est intrinsèque au commit-reveal, mais ça veut dire que `masterSeed` ne doit **jamais** transiter ni être loggué avant la fin — le document stocke `master_seed text` en clair dans `games` (§6.1). Un `SELECT` mal redacté ou une policy oubliée = triche totale. La colonne `master_seed` est lisible par `service_role` seulement, mais **rien dans le schéma ne l'empêche d'être incluse dans `public_state` par erreur**.
- **Fisher-Yates + PRNG 32 bits (`sfc32`)** : un état de 32 bits ne peut pas représenter les 48! permutations d'un deck (48! ≈ 2^213). Ce n'est pas une faille de triche (la seed reste secrète) mais le biais statistique d'un PRNG sous-dimensionné est réel. Mineur, mais à mentionner.

**Impact** : élevé (la seule colonne `master_seed` est un point de fuite catastrophique). **Parade** : stocker `master_seed` dans une table séparée `game_secrets` avec **zéro policy de select** (accès `service_role` uniquement, jamais exposée à PostgREST), `revoke all` explicite. Test d'intégration : « un joueur authentifié ne peut jamais `SELECT master_seed ». Utiliser un PRNG à état ≥128 bits (xoshiro256\*\*, déjà cité comme alternative — le préférer à sfc32).

### B3. 🟠 Realtime « signal seq + pull RLS » : le coût caché est un round-trip DB par event pour CHAQUE client

La décision (Y) est juste pour la sécurité (pas de secret sur le fil). Mais le document minimise : « le coût (un aller-retour `select`) est négligeable en tour-par-tour ». En réalité :

- Chaque event → **broadcast** → **2 clients font chacun un `SELECT` sur la vue `my_game_events`** (qui contient une sous-requête corrélée `payload_private -> (select seat ...)` exécutée **par ligne**). Un combat Wakfu génère facilement 15-30 events en rafale (déclaration, attaquants, bloqueurs, réactions, duels, dommages). 30 events × 2 clients × (sous-requête corrélée) = charge non négligeable, et surtout **latence perçue** : chaque carte qui bouge attend broadcast→select→render.
- Le `my_game_events` view avec `payload_private -> (subquery)` **par ligne** est un anti-pattern de perf (la sous-requête `select gp.seat from game_players` se ré-exécute pour chaque event au lieu d'être jointe une fois).

**Impact** : moyen (1v1 amical tolère la latence, mais l'expérience « rafale de combat » sera saccadée). **Parade** : (1) batcher — le broadcast `{ seq }` déclenche **un seul** `select … where seq > lastSeq` qui ramène tous les events manqués d'un coup (déjà à moitié prévu, à rendre explicite et à débattre côté throttle). (2) Remplacer la sous-requête corrélée par un **JOIN** sur `game_players` filtré par `auth.uid()`. (3) Mesurer la latence end-to-end en L3 avant de valider le pattern — c'est un critère de DONE manquant.

### B4. 🟠 `parentSeq` (concurrence optimiste) en 1v1 tour-par-tour est probablement de la complexité prématurée — sauf pour les Réactions

En 1v1 strict tour-par-tour, un seul joueur agit à la fois → pas de concurrence d'écriture → `parentSeq` ne sert presque jamais. **Sauf** que Wakfu a des **Réactions hors-tour** (705, vérifié) : le joueur non-actif peut écrire pendant le tour adverse (bloqueurs, réactions). Là, la concurrence est réelle. Le document mentionne `parentSeq` partout mais ne traite jamais le cas « les deux joueurs soumettent en même temps pendant une fenêtre de priorité ». Le `reducer` rejette `OUT_OF_ORDER` → l'un des deux est rejeté et doit resoumettre, mais **son intention (jouer telle Réaction) peut être devenue illégale** entre-temps. En table libre c'est tolérable (re-tenter), mais ça crée des courses UX désagréables (« ta réaction a été refusée, recommence »).

**Impact** : faible-moyen. **Parade** : garder `parentSeq` (c'est correct), mais documenter la politique de retry client (re-pull, re-base l'intention, re-soumettre une fois, sinon notifier). Surtout : ne PAS vendre `parentSeq` comme « gratuit » — c'est la source n°1 de bugs UX subtils.

### B5. 🟡 `structuredClone(state)` à chaque event ne passe pas à l'échelle du replay/reconnexion

`applyEvent` fait `structuredClone(state)` par event (le commentaire dit « immer/Map persistant si besoin perf »). Une partie de 200+ events reconnectée fait 200 `structuredClone` profonds d'un état avec ~100 instances. C'est O(events × taille_état). Pour une reconnexion ou un spectateur qui rejoint en fin de partie, le fold complet peut prendre des centaines de ms. Le `CHECKPOINT` est listé dans `EventType` mais **aucune mécanique de compaction n'est décrite** — c'est un type d'event orphelin.

**Impact** : faible en V1 (parties courtes), mais le replay viewer (L5) et la reconnexion tardive le sentiront. **Parade** : soit immer/structural sharing dès L1 (recommandé, peu de surcoût), soit implémenter réellement `CHECKPOINT` (snapshot tous les N events, fold depuis le dernier). Ne pas laisser `CHECKPOINT` comme type mort.

---

## C. Redaction qui fuit (sécurité)

### C1. 🔴 `instanceId` stable + jamais masqué = canal d'inférence sur la main et la pioche adverses

Le document insiste : « `instanceId` jamais masqué : identifiant opaque sans info catalogue ». **Faux raisonnement.** L'`instanceId` est stable toute la partie (§4.1). Donc :

- Quand l'adversaire pioche, je vois apparaître `ci_7f3a` dans sa main (en `count`, mais l'event `MOVE pioche→main` porte un `instanceId` que je peux observer dans le delta public si la position/présence est révélée). Quand plus tard il joue `ci_7f3a` dans le Monde (révélé), **je peux rétroactivement corréler** : « la carte qu'il a piochée au tour 3 était ce Xélor ». Pire, je peux **compter et suivre** des instances spécifiques dans sa main → savoir _combien_ de cartes piochées récemment vs gardées, déduire des patterns.
- Pour la **Pioche**, le document expose les `instanceId` (« `instanceId` exposés mais `cardId` jamais ») **avec un ordre brouillé**. Mais si les `instanceId` sont exposés _et_ stables, et que l'ordre est une permutation, alors observer quels `instanceId` sortent dans quel ordre au fil des pioches **révèle progressivement la permutation** — exactement ce que le RNG serveur veut empêcher. Le seul rempart est que le `cardId` reste caché, mais connaître la **structure d'ordre** des instances est déjà une fuite (ex. « il a remis cette carte au-dessus avec un tuck, je sais que c'est la prochaine »).

**Impact** : élevé — c'est une fuite par canal auxiliaire que le document **affirme explicitement comme sûre**. La phrase « `instanceId` opaque sans info catalogue → autorise deltas et animations sans rien fuiter » est le genre d'assertion fausse qui se transforme en CVE. **Parade** : pour les zones secrètes (main/pioche adverses), ne **jamais** exposer d'`instanceId` réels au non-propriétaire — utiliser des **`instanceId` éphémères par-viewer** (des handles d'animation alloués au moment où une carte devient visible, pas avant). Le mapping `instanceId réel ↔ handle public` reste serveur. La main adverse est `Array(count)` de slots anonymes ; quand une carte est jouée, le serveur alloue _à ce moment_ le lien révélé. Test L2 dédié : « deux pioches successives de A ne permettent à B de corréler aucune paire d'instanceId ».

### C2. 🟠 La vue `my_game_events` ne redacte que `payload_private`, pas `payload` — qui peut contenir des fuites par construction

La vue expose `e.payload` (public) tel quel + `payload_self`. Tout repose sur la discipline de l'Edge à ne mettre QUE du public dans `payload`. Mais le document met dans `payload` d'un `draw` : « A pioche 1, sa Pioche passe à 47 » — OK. Le risque : un `MOVE main→monde` qui **révèle** une carte doit mettre le `cardId` dans `payload` (devenu public) ; un `MOVE pioche→main` ne doit PAS. **C'est la même primitive `MOVE` avec deux politiques de redaction opposées, décidées par l'Edge au cas par cas.** Une seule erreur de branche = fuite permanente et invisible (rien ne plante). Le document n'a **aucun test de propriété** garantissant « pour tout MOVE vers une zone secrète, `payload` ne contient pas `cardId` ».

**Impact** : élevé (fuite silencieuse). **Parade** : ne pas laisser l'Edge décider à la main. Dériver la redaction **mécaniquement** de `ZONE_SPECS[to].public` + `faceDown` dans une fonction pure `splitPayload(move) → { public, private }` partagée et **fuzzée** en L1 (property test : aucun `cardId` ne traverse vers une zone non-publique pour aucun viewer). C'est la garantie que C1 et C2 exigent.

### C3. 🟡 `LOOK`/`peek` (regarder X cartes du dessus de sa pioche) crée un état de connaissance asymétrique non modélisé

Quand A « regarde les 3 cartes du dessus » (effet courant), A connaît désormais leur `cardId` et leur ordre, mais B non, et **la Pioche reste `kind:'count'` pour tous**. Le `revealedTo: Seat[]` gère « qui voit le cardId » mais pas « qui connaît l'ordre des N premières ». Le document a séparé contenu/ordre pour les _zones_ mais pas pour ce **savoir privé temporaire**. Après un `LOOK`, si A « remet dans l'ordre » ou « met une en-dessous », l'ordre que A connaît doit rester cohérent côté serveur sans le révéler à B — et un undo qui traverse un `LOOK` puis un `SHUFFLE` doit invalider le savoir de A (sinon A garde une info qu'il ne devrait plus avoir).

**Impact** : moyen (effet fréquent). **Parade** : modéliser le savoir privé comme un overlay `knownOrder: Partial<Record<Seat, InstanceId[]>>` sur la zone, redacté par siège, invalidé par tout `SHUFFLE` postérieur. À spécifier en L1, pas découvert en L4.

---

## D. Pièges produit / UX

### D1. 🟠 Table sur mobile : le « tap-to-act » est sous-spécifié pour un plateau à ~7 zones × 2 joueurs

Le projet est un PWA mobile-first (CLAUDE.md). Le document relègue mobile à « utilisable mais non optimisé » (§8.2) tout en promettant tap-to-act + accordéon + bottom-sheet (§7.5). **Ces deux promesses se contredisent** : un accordéon vertical qui masque les zones casse la lisibilité du Monde commun (le cœur du jeu — voir qui attaque qui). Sur un écran de téléphone, afficher _les deux_ Havre-Sac + _les deux_ mains + le Monde + la File + défausses + pioches est physiquement impossible sans scroll permanent. Le public cible (« 1v1 entre amis ») jouera **majoritairement sur mobile** (amis = canapé, pas LAN party). Donc le cas le plus probable est le moins bien traité.

**Impact** : élevé pour l'adoption réelle. **Parade** : décider en amont si mobile est un _vrai_ support V1 ou un _fallback_. Si fallback : assumer que la V1 desktop-only et garder la `/play` compagnon actuelle sur mobile (cohérent avec §7.5 « repli »). Si support : prototyper le layout mobile **avant** L4, car il contraint le modèle de zones (ex. fusionner visuellement les pioches/défausses). Ne pas découvrir ça en E2E.

### D2. 🟠 Abandon de partie / déconnexion : aucune politique. C'est le cas n°1 du jeu entre amis

Aucune des sections ne traite : que se passe-t-il quand un joueur ferme l'onglet à mi-partie ? La `presence` détecte la déconnexion, mais ensuite ? La partie reste `active` à jamais ? Un joueur peut-il « concéder » (le bouton `Concéder` existe en §7.4 mais aucun event/transition `aborted` n'est relié) ? Le statut `aborted` existe dans l'enum SQL mais **rien ne le déclenche**. En jeu amical, l'abandon est ultra-fréquent (interruption, lassitude). Sans timeout ni reprise claire, les tables zombies s'accumulent (et consomment le quota Realtime, §9).

**Impact** : moyen-élevé (UX + coût). **Parade** : event `CONCEDE`/`ABORT` explicite → `status='finished'/'aborted'` ; politique de reconnexion avec fenêtre (ex. 5 min de grâce, sinon la partie passe `aborted`) ; job de nettoyage des parties `lobby`/`active` inactives > N heures. À ajouter au périmètre V1 (c'est ~1 jour, pas un lot).

### D3. 🟡 Triche en table libre : le document la traite uniquement côté RNG, jamais côté moves

La V1 n'enforce aucune règle. Donc un joueur peut : se piocher 10 cartes, mettre l'Allié adverse dans sa propre défausse, se donner 50 PV. Le document protège la Pioche (RNG serveur) mais **un `setCounter(hp, 999)` est un event parfaitement valide** que le serveur accepte. En jeu entre amis confiants c'est OK (modèle Cockatrice assumé), mais il faut que ce soit un **choix explicite et visible**, pas un trou. L'`ActionLog` (§7.4) est la seule défense — il doit donc être **exhaustif et inviolable** (tout event y apparaît, y compris `setCounter` arbitraire), pour que l'adversaire puisse repérer la triche. Or rien ne garantit que `setCounter` ou `MOVE` arbitraires soient lisibles dans le log.

**Impact** : faible (assumé), mais à cadrer. **Parade** : faire de l'`ActionLog` un dérivé **complet** du journal (chaque event → une ligne lisible, jamais filtré), avec mise en évidence des coups « inhabituels » (compteur modifié manuellement, carte déplacée vers une zone adverse). C'est la contrepartie sociale de l'absence d'enforcement.

### D4. 🟡 `code à 6 caractères` pour rejoindre : collisions et squat

`code text unique not null` (6 car.) = ~2 milliards de combinaisons si alphanumérique, mais le document génère « WAKF42 » (préfixe fixe → espace réduit). Avec un préfixe `WAKF`, il reste 2 caractères → ~1300 codes. Collision quasi-certaine. Et rien n'expire les codes des parties `lobby` jamais démarrées.

**Impact** : faible. **Parade** : code aléatoire 6 car. sans préfixe sémantique (base32 sans ambigus = 32^6 ≈ 1 milliard), `unique` géré par retry à l'insert, expiration des lobbies non rejoints.

---

## E. Ce que le document fait BIEN (à préserver, ne pas « corriger »)

- **Event-sourcing + reducer pur** : excellent, c'est la bonne fondation, et l'argument 507.4 (« 1 pioche = 1 event ») est juste et bien trouvé.
- **Redaction comme projection serveur, secret jamais sur le fil** : principe correct (l'implémentation fuit, cf. C1/C2, mais le _principe_ est bon).
- **100 % Supabase, pas de Colyseus** : tranché correctement pour le public visé.
- **L0+L1 testable sans réseau** comme premier jalon : la bonne stratégie de dérisquage. Le critère de DONE n°3 (test de redaction) est le bon réflexe — il faut juste qu'il couvre **l'inférence par instanceId** (C1), pas seulement l'absence directe de `cardId`.
- **`UNDONE` append-only** plutôt que troncature : correct, bien argumenté.

---

## Verdict

**La V1 proposée n'est PAS livrable telle quelle**, mais elle est **récupérable sans refonte** — les fondations (event-sourcing, redaction server-side, Supabase) sont saines. Les problèmes sont des **trous de spécification et trois erreurs de règles**, pas des erreurs d'architecture. Le document sous-estime l'effort réel : les lots L2/L3 sont étiquetés « L » mais portent les deux risques critiques non résolus (B1 atomicité RNG/seq, C1 fuite par instanceId) qui peuvent à eux seuls doubler leur durée. Le périmètre « libre de règles » est honnête, mais plusieurs cas (équipements attachés A3, mulligan A5, owner/controller A2) ne sont **pas optionnels** même en table libre : sans eux, l'UI affiche un état incohérent (cartes fantômes, mauvaises défausses) que les joueurs ne peuvent pas réparer à la main.

### Les 3 ajustements prioritaires (à faire AVANT d'écrire L1)

1. **Sceller la redaction par construction, pas par discipline (C1 + C2).** Remplacer les `instanceId` stables exposés par des **handles éphémères par-viewer** pour les zones secrètes adverses, et dériver `{payload public, payloadPrivate}` mécaniquement de `ZONE_SPECS` via une fonction pure `splitPayload` **property-testée** en L1 (« aucun `cardId` ne traverse vers une zone non-publique pour aucun viewer, et aucune paire de pioches n'est corrélable par instanceId »). C'est le risque qui transforme un bug en faille de sécurité silencieuse.

2. **Résoudre l'atomicité RNG↔seq (B1) et isoler `master_seed` (B2).** Faire dériver le seed de mélange d'un **nonce intra-event** (et non de `seq`), pour que le RNG soit calculable _avant_ le lock sans devenir invalide si `parentSeq` est périmé ; stocker `master_seed` dans une table `game_secrets` à **zéro policy select** avec test d'intégration « un joueur ne peut jamais le lire ». C'est la jointure des deux autorités, présentée comme l'innovation du doc mais laissée au milieu du gué.

3. **Corriger le modèle de données sur les trois cas Wakfu structurants, dès L0 :** (a) `attachments[]` voyagent **avec** leur porteur dans `applyMove` (équipements/Dofus — A3) ; (b) ajouter l'event `SET_CONTROLLER` et router les zones personnelles vers `owner` et non vers le `to.owner` client (A2) ; (c) séparer `faceDown` (visibilité) de `side: recto/verso` (Héros — A4). Et corriger partout l'assertion fausse « File d'Attente = pile LIFO/stack Magic » → **FIFO d'insertion, résolution en ordre inverse** (A1), car la roadmap d'automatisation post-V1 en dépend.

Bonus non-bloquants mais à cadrer avant le ship : politique d'**abandon/déconnexion** (D2, statut `aborted` orphelin) et décision ferme **mobile = support ou fallback** (D1), sous peine d'un module injouable sur l'écran où les amis joueront réellement.
