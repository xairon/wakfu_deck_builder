# Multiplayer P0 Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 3 critical online holes — broadcast per-seat **redacted** events on **private** channels (with reveal-delivery so cards stay visible when drawn/played), and authorize moves **server-side** — without breaking the "free table" model.

**Architecture:** Two new pure engine functions (`authorizeDraft`, `redactEventForSeat`) are unit-tested, then wired into `submit_event`/`join_game` (Deno Edge Functions) which broadcast on `game:<id>:A` / `:B`; a migration adds Realtime Authorization; the client subscribes to its own seat's private channel and merges a `reveals` patch into derived state.

**Tech Stack:** TypeScript, Vitest, Vue 3/Pinia, Supabase (Edge Functions/Deno, Postgres RLS, Realtime), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-21-multiplayer-p0-security-design.md`

**Branch:** `feat/mp-p0-security` (already created; spec committed).

---

### Task 1: `authorizeDraft` — server-side move authorization (engine, pure)

**Files:**

- Modify: `src/game/engine/authority.ts`
- Modify: `src/game/engine/redact.ts:22` (Deno import fix)
- Test: `src/game/engine/__tests__/authority.spec.ts`

- [ ] **Step 1: Fix `redact.ts` value import for Deno** — it will enter the Edge Function graph via `authority.ts`. Change line 22:

```ts
// src/game/engine/redact.ts:22  (BEFORE)
import { ZONE_SPECS } from "../types/zones";
// AFTER
import { ZONE_SPECS } from "../types/zones.ts";
```

- [ ] **Step 2: Write the failing tests** — append to `src/game/engine/__tests__/authority.spec.ts`:

```ts
import { authorizeDraft } from "../authority.ts";
import { createGame } from "../setup.ts";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import { EngineError } from "../reducer.ts";

function twoSeatState() {
  const deck = (n: string) => ({
    hero: createMockHeroCard({ id: `hero-${n}` }),
    havreSac: createMockHavreSacCard({ id: `hs-${n}` }),
    cards: [
      {
        card: createMockAllyCard({ id: `c-${n}` }),
        quantity: 4,
        isReserve: false,
      },
    ],
    reserve: [],
  });
  // @ts-expect-error minimal deck shape for the engine
  return createGame("g1", { A: deck("a"), B: deck("b") }, { firstPlayer: "A" })
    .state;
}

describe("authorizeDraft", () => {
  it("rejette un type d'event inconnu", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, { actor: "A", type: "HACK" as never, payload: {} }),
    ).toThrow(EngineError);
  });

  it("rejette une action visant une instance dans la zone privée adverse (main/pioche/réserve de B)", () => {
    const s = twoSeatState();
    const bPioche = s.seats.B.pioche[0]; // carte privée de B
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_COUNTER",
        payload: { instanceId: bPioche, counter: "hp", value: 0 },
      }),
    ).toThrow(EngineError);
  });

  it("rejette un MOVE qui sort une carte de la main adverse", () => {
    const s = twoSeatState();
    const bPioche = s.seats.B.pioche[0];
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "MOVE",
        payload: {
          instanceId: bPioche,
          from: { zone: "pioche", owner: "B" },
          to: { zone: "monde" },
          position: { at: "any" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
        },
      }),
    ).toThrow(EngineError);
  });

  it("autorise une action sur ses propres cartes et sur une zone publique", () => {
    const s = twoSeatState();
    const aReserveOrPioche = s.seats.A.pioche[0];
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_ORIENTATION",
        payload: {
          instanceId: s.seats.A.heroInstanceId!,
          orientation: "tapped",
        },
      }),
    ).not.toThrow();
    // sa propre pioche : c'est SA zone privée → autorisé (l'auth ne bloque que l'adverse)
    expect(() =>
      authorizeDraft(s, {
        actor: "A",
        type: "SET_COUNTER",
        payload: { instanceId: aReserveOrPioche, counter: "x", value: 1 },
      }),
    ).not.toThrow();
  });

  it("laisse passer les events système (setup)", () => {
    const s = twoSeatState();
    expect(() =>
      authorizeDraft(s, {
        actor: "system",
        type: "SHUFFLE",
        payload: {} as never,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/game/engine/__tests__/authority.spec.ts -t authorizeDraft`
Expected: FAIL — `authorizeDraft is not a function`.

- [ ] **Step 4: Implement `authorizeDraft`** — in `src/game/engine/authority.ts`, add the imports and the function. Update the import lines at the top:

```ts
// add to the existing imports in authority.ts
import type {
  DraftEvent,
  PersistedEvent,
  ShufflePayload,
  MovePayload,
  InstanceId,
  EventType,
  AttachPayload,
  DetachPayload,
  LookRevealPayload,
} from "../types/events";
import type { GameState, CardInstance } from "../types/state";
import type { Seat, Viewer } from "../types/zones";
import { ZONE_SPECS } from "../types/zones.ts"; // value import → .ts for Deno
import { canSeeCardId } from "./redact.ts"; // value import → .ts for Deno
```

Append the function:

```ts
const ALLOWED_TYPES = new Set<EventType>([
  "GAME_STARTED",
  "MOVE",
  "SHUFFLE",
  "SET_ORIENTATION",
  "SET_LEVEL",
  "SET_COUNTER",
  "INC_COUNTER",
  "ATTACH",
  "DETACH",
  "LOOK",
  "REVEAL",
  "SET_PHASE",
  "SAID",
  "UNDONE",
]);

/** Instances ciblées par un brouillon (pour les vérifs de propriété). */
function targetedIds(draft: DraftEvent): InstanceId[] {
  const p = draft.payload as Record<string, unknown>;
  switch (draft.type) {
    case "MOVE":
    case "SET_ORIENTATION":
    case "SET_LEVEL":
    case "SET_COUNTER":
    case "INC_COUNTER":
      return p.instanceId ? [p.instanceId as InstanceId] : [];
    case "ATTACH":
      return [(p as AttachPayload).equipmentId, (p as AttachPayload).bearerId];
    case "DETACH":
      return [(p as DetachPayload).equipmentId];
    case "LOOK":
    case "REVEAL":
      return (p as LookRevealPayload).instanceIds ?? [];
    default:
      return [];
  }
}

/** Une instance est-elle dans une zone PRIVÉE de l'ADVERSAIRE de `actor` ? */
function inOpponentPrivateZone(inst: CardInstance, actor: Seat): boolean {
  const spec = ZONE_SPECS[inst.location.zone];
  const owner = "owner" in inst.location ? inst.location.owner : null;
  return !spec.public && owner !== null && owner !== actor;
}

/** Sièges à qui un brouillon prétend révéler l'identité. */
function revealTargets(draft: DraftEvent): Seat[] {
  if (draft.type === "MOVE") {
    const v = (draft.payload as MovePayload).visibility.visibleTo;
    return v === "all" ? ["A", "B"] : Array.isArray(v) ? v : [];
  }
  if (draft.type === "LOOK" || draft.type === "REVEAL") {
    return (draft.payload as LookRevealPayload).to ?? [];
  }
  return [];
}

/**
 * Autorise (ou rejette) une INTENTION côté serveur. Table libre : on NE valide
 * PAS la légalité d'effet — seulement qu'un siège (1) n'émet pas un type inconnu,
 * (2) ne touche pas une zone PRIVÉE adverse (main/pioche/réserve), (3) ne se
 * révèle pas une carte qu'il ne possède pas et ne voit pas déjà.
 */
export function authorizeDraft(state: GameState, draft: DraftEvent): void {
  assertActor(draft);
  if (draft.actor === "system") return; // events serveur (setup)
  const actor = draft.actor as Seat;

  if (!ALLOWED_TYPES.has(draft.type)) {
    throw new EngineError("BAD_EVENT_TYPE", { type: draft.type });
  }

  const ids = targetedIds(draft);
  for (const id of ids) {
    const inst = state.instances[id];
    if (inst && inOpponentPrivateZone(inst, actor)) {
      throw new EngineError("FORBIDDEN", { id, zone: inst.location.zone });
    }
  }

  if (revealTargets(draft).includes(actor)) {
    for (const id of ids) {
      const inst = state.instances[id];
      if (
        inst &&
        inst.owner !== actor &&
        !canSeeCardId(inst, actor as Viewer)
      ) {
        throw new EngineError("FORBIDDEN", { id, reason: "peek" });
      }
    }
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/game/engine/__tests__/authority.spec.ts -t authorizeDraft`
Expected: PASS (all 5).

- [ ] **Step 6: Type-check + commit**

```bash
npm run type-check
git add src/game/engine/authority.ts src/game/engine/redact.ts src/game/engine/__tests__/authority.spec.ts
git commit -m "feat(game): server-side authorizeDraft (no reaching into opponent private zones)"
```

---

### Task 2: `redactEventForSeat` — per-seat redaction + reveal delivery (engine, pure)

**Files:**

- Modify: `src/game/types/events.ts` (RedactedEvent type)
- Modify: `src/game/engine/authority.ts` (function)
- Modify: `src/game/index.ts` (barrel export)
- Test: `src/game/engine/__tests__/authority.spec.ts`

- [ ] **Step 1: Add the `RedactedEvent` type** — append to `src/game/types/events.ts`:

```ts
/** Event diffusé à un client : event persisté redacté + identités nouvellement
 *  visibles pour CE siège (cardId d'une carte qu'on pioche/qu'on joue). */
export type RedactedEvent = PersistedEvent & {
  reveals?: Record<InstanceId, string>;
};
```

- [ ] **Step 2: Write the failing tests** — append to `authority.spec.ts`:

```ts
import { redactEventForSeat } from "../authority.ts";
import { deriveState, emptyState } from "../reducer.ts";
import { drawTop, playToWorld, sequence } from "../verbs.ts";

describe("redactEventForSeat", () => {
  it("GAME_STARTED redacté pour A : aucun cardId de la pioche/main/réserve de B", () => {
    const { events } = createGame(
      "g2",
      {
        A: {
          hero: createMockHeroCard({ id: "hA" }),
          havreSac: createMockHavreSacCard({ id: "sA" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cA" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
        B: {
          hero: createMockHeroCard({ id: "hB" }),
          havreSac: createMockHavreSacCard({ id: "sB" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cB" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
      },
      { firstPlayer: "A" },
    );
    const started = events.find((e) => e.type === "GAME_STARTED")!;
    const pre = emptyState();
    const post = deriveState([started]);
    const red = redactEventForSeat(started, "A", pre, post);
    const state = (
      red.payload as {
        state: { instances: Record<string, { cardId: string; owner: string }> };
      }
    ).state;
    // Toutes les cartes de B doivent avoir cardId "" SAUF héros/havre-sac (publics)
    for (const inst of Object.values(state.instances)) {
      if (inst.owner === "B" && inst.cardId !== "") {
        expect(["hB", "sB"]).toContain(inst.cardId); // seuls héros/HS de B visibles
      }
    }
  });

  it("piocher : reveals contient le cardId pour le pioucheur, pas pour l'adversaire", () => {
    const setup = createGame(
      "g3",
      {
        A: {
          hero: createMockHeroCard({ id: "hA" }),
          havreSac: createMockHavreSacCard({ id: "sA" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cA" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
        B: {
          hero: createMockHeroCard({ id: "hB" }),
          havreSac: createMockHavreSacCard({ id: "sB" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cB" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
      },
      { firstPlayer: "A" },
    );
    const pre = setup.state;
    const draw = sequence([drawTop(pre, "A")], "g3", pre.seq + 1)[0];
    const post = deriveState([...setup.events, draw]);
    const drawnId = (draw.payload as { instanceId: string }).instanceId;
    const forA = redactEventForSeat(draw, "A", pre, post);
    const forB = redactEventForSeat(draw, "B", pre, post);
    expect(forA.reveals?.[drawnId]).toBe("cA"); // A voit ce qu'il pioche
    expect(forB.reveals?.[drawnId]).toBeUndefined(); // B ne le voit pas
  });

  it("jouer au Monde : reveals délivre le cardId aux DEUX sièges", () => {
    const setup = createGame(
      "g4",
      {
        A: {
          hero: createMockHeroCard({ id: "hA" }),
          havreSac: createMockHavreSacCard({ id: "sA" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cA" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
        B: {
          hero: createMockHeroCard({ id: "hB" }),
          havreSac: createMockHavreSacCard({ id: "sB" }),
          cards: [
            {
              card: createMockAllyCard({ id: "cB" }),
              quantity: 4,
              isReserve: false,
            },
          ],
          reserve: [],
        },
      },
      { firstPlayer: "A" },
    );
    const draw = sequence(
      [drawTop(setup.state, "A")],
      "g4",
      setup.state.seq + 1,
    )[0];
    const afterDraw = deriveState([...setup.events, draw]);
    const drawnId = (draw.payload as { instanceId: string }).instanceId;
    const play = sequence(
      [playToWorld("A", drawnId)],
      "g4",
      afterDraw.seq + 1,
    )[0];
    const post = deriveState([...setup.events, draw, play]);
    const forB = redactEventForSeat(play, "B", afterDraw, post);
    expect(forB.reveals?.[drawnId]).toBe("cA"); // B voit la carte jouée
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/game/engine/__tests__/authority.spec.ts -t redactEventForSeat`
Expected: FAIL — `redactEventForSeat is not a function`.

- [ ] **Step 4: Implement `redactEventForSeat`** — in `authority.ts`, ensure `RedactedEvent` is imported, then append:

```ts
// add RedactedEvent to the events import in authority.ts
import type { /* …existing…, */ RedactedEvent } from "../types/events";

/**
 * Redacte un event POUR UN SIÈGE avant diffusion + joint les `reveals` :
 * les cardId des instances qui deviennent visibles à ce siège du fait de cet
 * event (carte piochée / jouée). `pre`/`post` = état avant/après l'event.
 */
export function redactEventForSeat(
  event: PersistedEvent,
  viewer: Seat,
  pre: GameState,
  post: GameState,
): RedactedEvent {
  const base = redactEventForBroadcast(event, viewer);
  const reveals: Record<string, string> = {};
  for (const [id, inst] of Object.entries(post.instances)) {
    if (!inst.cardId) continue;
    const wasVisible =
      !!pre.instances[id] && canSeeCardId(pre.instances[id], viewer);
    if (!wasVisible && canSeeCardId(inst, viewer)) reveals[id] = inst.cardId;
  }
  return Object.keys(reveals).length ? { ...base, reveals } : base;
}
```

- [ ] **Step 5: Export from barrel** — add to `src/game/index.ts` alongside the existing `redactEventForBroadcast` export:

```ts
export { authorizeDraft, redactEventForSeat } from "./engine/authority";
```

- [ ] **Step 6: Run to verify it passes + full engine suite**

Run: `npx vitest run src/game/engine/__tests__/authority.spec.ts`
Expected: PASS (all).

- [ ] **Step 7: Type-check + commit**

```bash
npm run type-check
git add src/game/types/events.ts src/game/engine/authority.ts src/game/index.ts src/game/engine/__tests__/authority.spec.ts
git commit -m "feat(game): redactEventForSeat with reveal-delivery (draw/play)"
```

---

### Task 3: Wire authorization + per-seat redacted broadcast into `submit_event`

**Files:**

- Modify: `supabase/functions/submit_event/index.ts`

- [ ] **Step 1: Update imports** (top of file):

```ts
import { deriveState } from "../../../src/game/engine/reducer.ts";
import {
  resolveDraft,
  authorizeDraft,
  redactEventForSeat,
} from "../../../src/game/engine/authority.ts";
import type { PersistedEvent } from "../../../src/game/types/events.ts";
```

- [ ] **Step 2: Authorize before resolving** — after `const state = deriveState(...)` (currently line 62), insert:

```ts
// Autorisation serveur (table libre : on bloque seulement l'accès aux zones
// privées adverses + le peeking). L'acteur est imposé par le serveur.
try {
  authorizeDraft(state, { ...draft, actor: me.seat });
} catch (e) {
  return json({ error: (e as Error).message || "FORBIDDEN" }, 403);
}
```

- [ ] **Step 3: Replace the broadcast** — replace the existing `await db.channel(...).send(...)` block (lines 86-92) with per-seat redacted sends:

```ts
// Diffusion REDACTÉE par siège, sur des canaux privés distincts.
const post = deriveState([...(rows ?? []).map(rowToEvent), ev]);
for (const seat of ["A", "B"] as const) {
  await db.channel(`game:${gameId}:${seat}`).send({
    type: "broadcast",
    event: "game_event",
    payload: redactEventForSeat(ev, seat, state, post),
  });
}
```

- [ ] **Step 4: Type-check (Deno import sanity via vue-tsc on shared code)**

Run: `npm run type-check`
Expected: PASS (the engine code the function imports type-checks; the Edge runtime is validated in Task 8's integration test).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit_event/index.ts
git commit -m "feat(play): submit_event authorizes moves + broadcasts per-seat redacted events"
```

---

### Task 4: Per-seat redacted broadcast in `join_game` setup

**Files:**

- Modify: `supabase/functions/join_game/index.ts`

- [ ] **Step 1: Update imports** — add `redactEventForSeat`:

```ts
import { setupEvents } from "../../../src/game/engine/setup.ts";
import { sequence } from "../../../src/game/engine/verbs.ts";
import {
  resolveDraft,
  redactEventForSeat,
} from "../../../src/game/engine/authority.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
```

- [ ] **Step 2: Replace the per-event broadcast inside the setup loop** — the loop currently does `await db.channel(`game:${game.id}`).send({ ... payload: ev })`. Replace that single send with per-seat redacted sends. The loop already has `state` (pre) before resolve and pushes `ev` into `stateEvents`; broadcast using pre = `state`, post = `deriveState(stateEvents)` (after the push):

```ts
stateEvents = [...stateEvents, ev];
parent = ev.seq;
const post = deriveState(stateEvents);
for (const seat of ["A", "B"] as const) {
  await db.channel(`game:${game.id}:${seat}`).send({
    type: "broadcast",
    event: "game_event",
    payload: redactEventForSeat(ev, seat, state, post),
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/join_game/index.ts
git commit -m "feat(play): join_game broadcasts setup events per-seat redacted"
```

---

### Task 5: Migration — Realtime Authorization (private per-seat channels)

**Files:**

- Create: `supabase/migrations/0006_realtime_authorization.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0006_realtime_authorization.sql
-- Canaux Realtime PRIVÉS par siège : un utilisateur ne peut recevoir le topic
-- game:<id>:<seat> que s'il est le joueur de ce siège. Le service_role (Edge
-- Functions) contourne la RLS, donc la diffusion serveur reste autorisée.
alter table realtime.messages enable row level security; -- idempotent (géré par Supabase)

create policy "game_seat_recv"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.game_players gp
      where gp.user_id = auth.uid()
        and ('game:' || gp.game_id::text || ':' || gp.seat) = realtime.topic()
    )
  );
```

- [ ] **Step 2: Commit (deploy happens in Task 8)**

```bash
git add supabase/migrations/0006_realtime_authorization.sql
git commit -m "feat(play): RLS on realtime.messages — private per-seat game channels"
```

---

### Task 6: Client — subscribe to the private per-seat channel

**Files:**

- Modify: `src/services/gameClient.ts`
- Modify: `src/stores/gameStore.ts` (`OnlineTransport` type + `connectOnline` call)

- [ ] **Step 1: Update `subscribeToGame`** in `src/services/gameClient.ts`:

```ts
import type { DraftEvent, PersistedEvent, RedactedEvent } from "@/game";
import type { Seat } from "@/game";

/**
 * S'abonne au flux REDACTÉ du siège `seat` sur un canal PRIVÉ game:<id>:<seat>.
 * Renvoie une fonction de désabonnement.
 */
export function subscribeToGame(
  gameId: string,
  seat: Seat,
  onEvent: (event: RedactedEvent) => void,
): () => void {
  const channel = client()
    .channel(`game:${gameId}:${seat}`, { config: { private: true } })
    .on("broadcast", { event: "game_event" }, (msg) => {
      onEvent(msg.payload as RedactedEvent);
    })
    .subscribe();
  return () => {
    void client().removeChannel(channel);
  };
}
```

- [ ] **Step 2: Update the `OnlineTransport` type + `connectOnline`** in `src/stores/gameStore.ts`. Find the `OnlineTransport` interface (grep `OnlineTransport`) and change `subscribe`:

```ts
// BEFORE: subscribe: (id: string, cb: (ev: PersistedEvent) => void) => () => void;
subscribe: (id: string, seat: Seat, cb: (ev: RedactedEvent) => void) => () => void;
```

In `connectOnline` (line ~350) pass the seat:

```ts
onlineUnsub = transport.subscribe(id, seat, applyServerEvent);
```

Ensure `RedactedEvent` is imported in `gameStore.ts` (from `@/game`).

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS (PlayTableView's `onlineTransport = { submit: submitEvent, subscribe: subscribeToGame }` now matches the 3-arg signature by reference).

- [ ] **Step 4: Commit**

```bash
git add src/services/gameClient.ts src/stores/gameStore.ts
git commit -m "feat(play): subscribe to private per-seat channel game:<id>:<seat>"
```

---

### Task 7: Client — merge the `reveals` patch into derived state

**Files:**

- Modify: `src/stores/gameStore.ts` (`revealed` ref, `state` computed, `applyServerEvent`, connect/disconnect reset)
- Test: `src/stores/__tests__/gameStore.spec.ts`

- [ ] **Step 1: Write the failing test** — add to `src/stores/__tests__/gameStore.spec.ts`:

```ts
it("applyServerEvent applique le patch reveals au state dérivé", () => {
  const store = useGameStore();
  // démarre une partie en ligne minimale via le journal redacté
  // (on injecte directement un GAME_STARTED redacté + un MOVE avec reveals)
  // … construire un GAME_STARTED minimal avec une instance ci_X cardId:"" …
  // puis :
  store.applyServerEvent({
    gameId: "g",
    seq: 99,
    parentSeq: 98,
    actor: "A",
    type: "SAID",
    payload: { text: "x" },
    ts: 0,
    reveals: { ci_X: "real-card" },
  } as never);
  // l'identité révélée est mémorisée et patchée si l'instance existe
  expect(store.revealedCardId("ci_X")).toBe("real-card");
});
```

> Note: expose a tiny test helper `revealedCardId(id)` returning `revealed.value[id] ?? null` from the store return object, OR assert via `store.state.instances` once a GAME_STARTED is present. Keep whichever fits the existing test style; the behavior under test is "reveals are accumulated and applied".

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts -t reveals`
Expected: FAIL.

- [ ] **Step 3: Implement** in `src/stores/gameStore.ts`:

Add the ref near `events`:

```ts
// Identités révélées progressivement (pioche/jeu) — monotone, survit à la
// re-dérivation pure du journal redacté.
const revealed = ref<Record<string, string>>({});
```

Replace the `state` computed (line ~132) — **do not mutate `deriveState`'s memoized output**:

```ts
const state = computed<GameState>(() => {
  const base = deriveState(events.value);
  const ids = Object.keys(revealed.value);
  if (!ids.length) return base;
  const instances = { ...base.instances };
  for (const id of ids) {
    const inst = instances[id];
    if (inst && inst.cardId !== revealed.value[id]) {
      instances[id] = { ...inst, cardId: revealed.value[id] };
    }
  }
  return { ...base, instances };
});
```

Update `applyServerEvent` (line ~329):

```ts
function applyServerEvent(ev: RedactedEvent): void {
  if (events.value.some((e) => e.seq === ev.seq)) return; // dédoublonnage
  if (ev.reveals) revealed.value = { ...revealed.value, ...ev.reveals };
  events.value = [...events.value, ev];
}
```

Reset `revealed` in `connectOnline` (after `events.value = []`) and `disconnectOnline` (after `events.value = []`):

```ts
revealed.value = {};
```

Expose a helper in the store's returned object for the test:

```ts
    revealedCardId: (id: string) => revealed.value[id] ?? null,
```

- [ ] **Step 4: Run to verify it passes + full store suite**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts`
Expected: PASS.

- [ ] **Step 5: Type-check + commit**

```bash
npm run type-check
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.spec.ts
git commit -m "feat(play): merge per-seat reveals patch into derived game state"
```

---

### Task 8: Deploy + real 2-account integration test + browser verify

**Files:** none (ops + verification). Uses the user's `sbp_` access token and the harness from the prior end-to-end test.

- [ ] **Step 1: Full gate** — `npm run type-check`, `npx vitest run`, `npm run build`. All green.

- [ ] **Step 2: Verify the access token still works** (PowerShell, Management API ping): `GET https://api.supabase.com/v1/projects/ehqalhzvmgkepgbaxbzu` with `Authorization: Bearer <token>`. If 401, ask the user for a fresh token before deploying.

- [ ] **Step 3: Apply the migration** via Management API `POST /v1/projects/<ref>/database/query` with the contents of `0006_realtime_authorization.sql`. Verify the policy exists (`select polname from pg_policies where tablename='messages' and schemaname='realtime'`).

- [ ] **Step 4: Deploy Edge Functions** — PowerShell: `npm i -g supabase`; authenticate with the token (`$env:SUPABASE_ACCESS_TOKEN`); `supabase link --project-ref ehqalhzvmgkepgbaxbzu`; `supabase functions deploy join_game`; `supabase functions deploy submit_event`. From repo root (engine relative imports).

- [ ] **Step 5: Deploy frontend** — merge `feat/mp-p0-security` to `master` (`--no-ff`), `npm run type-check`, push → Vercel.

- [ ] **Step 6: Real 2-account integration test** (signup 2 throwaway accounts → password-grant JWTs → reuse a valid deck snapshot). Assert, via a real subscriber on `game:<id>:A`:

  - seat A's received `GAME_STARTED` payload contains **no** `cardId` for any B-owned pioche/main/reserve instance, and **no** `SHUFFLE` permutation.
  - a **3rd** account's `subscribe('game:<id>:A', {config:{private:true}})` never reaches `SUBSCRIBED` (authorization denied).
  - a crafted `submit_event` (B's JWT) targeting an A-owned pioche instance returns **HTTP 403**.
  - the happy path still works: create → join (200) → A receives `GAME_STARTED` + reveals for its own cards.

- [ ] **Step 7: Browser verify** (preview against prod): sign in as a test account, drive a draw + play, confirm the board renders (own drawn card visible, opponent = card backs/counts), no console errors.

- [ ] **Step 8: Clean up** all test data (games + game\_\* + auth.users) via Management SQL; verify 0 remaining.

- [ ] **Step 9: Update memory** (`online-play-enablement.md`): P0 security closed (redaction + private channels + move-auth), with the verification evidence. Remind the user to revoke the token.

---

## Self-Review

**Spec coverage:** C1 redaction → Tasks 2,3,4,7; reveal-delivery → Task 2 + Task 7; C2 private channels → Tasks 5,6; C3 move-auth → Tasks 1,3; testing → Tasks 1,2,7,8; deploy → Task 8. All spec sections map to tasks.

**Placeholder scan:** Task 7's test has a "construct a GAME_STARTED" note — mitigated by the `revealedCardId` helper assertion so the test is concrete; the rest is full code.

**Type consistency:** `RedactedEvent` (events.ts) used identically in Tasks 2/3/4/6/7; `authorizeDraft(state, draft)` and `redactEventForSeat(event, viewer, pre, post)` signatures consistent across engine + Edge Functions; `subscribe(id, seat, cb)` consistent in gameClient + gameStore `OnlineTransport`. Deno `.ts` value-import fix (redact.ts, zones.ts, redact.ts→canSeeCardId) applied in Task 1 before authority.ts imports them.
