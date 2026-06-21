# Multiplayer P0 Security Remediation — Design

**Date:** 2026-06-21
**Status:** Approved (design)
**Source:** `audit-multiplayer` workflow (31 agents, adversarially verified), 2026-06-21.

## Goal

Close the three **critical** security holes in the online 1v1 system so that an
adversarial opponent cannot read your hidden information, a stranger cannot
snoop on a game, and a crafted client cannot manipulate your cards — while
preserving the "free table" (assisted, no rule-enforcement) play model.

## Scope

In scope (the 3 criticals):

- **C1 — Hidden-information leak.** Edge Functions broadcast the _complete_ event
  (full `GAME_STARTED` state with every `cardId`, the `SHUFFLE` permutation = full
  draw order, both seats' `payloadPrivate`). Fix: per-seat **redacted** events.
- **C2 — Public channel.** `game:<id>` is a public Realtime channel; any
  authenticated user can resolve code→id and subscribe. Fix: **private per-seat
  channels** with Realtime Authorization.
- **C3 — No move authorization.** `submit_event` forces the actor seat but takes
  the move payload verbatim (no ownership/zone check). Fix: server-side
  `authorizeDraft`.

Out of scope (next slices, P1+): resync/reconnect (`pull_events`), terminal game
status + cleanup/TTL, server-side deck-legality validation, presence, OUT_OF_ORDER
auto-retry, double-join atomicity. Tracked in the audit report.

## Background that shapes the design

- `cardId` is set **once**, at `GAME_STARTED` (`setup.ts:buildInitialLayout`); no
  card identity is introduced later. So masking opponent `cardId`s at
  `GAME_STARTED` removes them from the viewer's journal _permanently_.
- At setup there is **no opening hand**: every deck card starts in `pioche`
  (`revealedTo: []`, hidden from everyone incl. owner — the order is server-secret)
  or `reserve` (`revealedTo: [owner]`). Heroes/Havre-Sacs are `revealedTo: ['A','B']`.
- `drawTop` (`verbs.ts`) is a `MOVE` pioche→main with `visibleTo:[seat]` and **no
  `payloadPrivate`** — it does not carry the drawn `cardId`. `playToWorld` is a
  `MOVE` main→monde with `visibleTo:"all"`.

**Consequence:** with redacted events, a viewer needs the server to _deliver_ a
`cardId` the moment a card becomes visible to them — both for **own draws**
(pioche is opaque even to the owner) and for **opponent plays** (hidden→public).
The existing `redactEventForBroadcast` masks `GAME_STARTED`/`SHUFFLE`/`payloadPrivate`
but does **not** deliver these progressive reveals. Delivering them is the core
new work of this P0.

## Architecture (4 components)

### 1. Redaction + reveal delivery (C1)

**Wire type.** Add an optional field carried only on the wire (never stored):

```ts
type RedactedEvent = PersistedEvent & { reveals?: Record<InstanceId, string> };
```

`reveals` maps an `instanceId` → its real `cardId`, for the instances that became
**newly visible to this viewer** as a result of this event.

**Server function** (engine, pure & tested) in `src/game/engine/authority.ts`:

```ts
export function redactEventForSeat(
  event: PersistedEvent,
  viewer: Seat,
  preState: GameState, // state BEFORE this event
  postState: GameState, // state AFTER this event
): RedactedEvent;
```

It returns `redactEventForBroadcast(event, viewer)` (unchanged: `SHUFFLE`
permutation → `[]`, `GAME_STARTED` masks `cardId` of instances not in viewer's
`revealedTo`, `payloadPrivate` reduced to `[viewer]`) **plus** a `reveals` patch:
for every instance `id`, if `canSeeCardId(postState.instances[id], viewer)` is true
**and** `canSeeCardId(preState.instances[id], viewer)` is false (or the instance is
new in post), include `reveals[id] = postState.instances[id].cardId`. (For
`GAME_STARTED`, `preState` is `emptyState()` so initial reserve/hero reveals flow
naturally; the `GAME_STARTED` masking already covers the bulk, and `reveals` is
empty/minimal there.) `canSeeCardId` already exists in `redact.ts` and is the
single source of truth for "may this viewer know this identity".

**Client** (`gameStore.ts`):

- New `const revealed = ref<Record<string, string>>({})` (monotonic).
- `applyServerEvent(ev: RedactedEvent)`: existing seq-dedup + append; additionally
  `if (ev.reveals) Object.assign(revealed.value, ev.reveals)`.
- The `state` computed becomes: derive from the (redacted) journal, then patch in
  known identities:
  ```ts
  const base = deriveState(events.value);
  for (const [id, cardId] of Object.entries(revealed.value))
    if (base.instances[id]) base.instances[id].cardId = cardId;
  ```
  `redactStateFor(state, perspective)` stays as the render projection (now mostly a
  safety net + zone projection: opponent hand → count, etc.).
- `connectOnline`/`disconnectOnline` reset `revealed` alongside `events`.

**Why this is correct:** the redacted journal never contains an opponent secret;
`reveals` only ever carries identities the recipient is _already entitled_ to see
(gated by `canSeeCardId`); the monotonic `revealed` map survives re-derivation.

### 2. Private per-seat channels (C2)

**Channel naming.** Per seat: `game:<id>:A`, `game:<id>:B`. Each seat receives
only its own redacted stream.

**Server (Edge Functions).** Replace the single shared broadcast with two
per-seat sends. In `submit_event` and in `join_game`'s setup loop, for the just-
appended `ev` with `preState`/`postState` in hand:

```ts
for (const seat of ["A", "B"] as const)
  await db
    .channel(`game:${gameId}:${seat}`)
    .send({
      type: "broadcast",
      event: "game_event",
      payload: redactEventForSeat(ev, seat, preState, postState),
    });
```

The service-role client bypasses RLS, so server sends are always authorized.

**Migration** `supabase/migrations/0006_realtime_authorization.sql`: enable
Supabase Realtime Authorization by adding an RLS policy on `realtime.messages` so
a client may receive a topic `game:<id>:<seat>` only if it is that seat's user:

```sql
alter table realtime.messages enable row level security; -- (idempotent; Supabase-managed)
create policy "game_seat_recv" on realtime.messages
  for select to authenticated using (
    exists (
      select 1 from public.game_players gp
      where gp.user_id = auth.uid()
        and ('game:' || gp.game_id::text || ':' || gp.seat) = realtime.topic()
    )
  );
```

(Exact policy verb/refinements validated against the deployed Realtime version in
the integration test; fall back to a participant-scoped per-game topic if per-seat
topic matching needs adjustment.)

**Client.** `gameClient.subscribeToGame(gameId, seat, onEvent)` subscribes to
`game:<id>:<seat>` with `{ config: { private: true } }`. `gameStore.connectOnline`
already knows `mySeat`; thread it through `transport.subscribe(id, seat, cb)`.
Update the `onlineTransport` shape in `PlayTableView.vue` accordingly.

### 3. Server-side move authorization (C3)

**Engine function** (pure & tested) in `authority.ts`:

```ts
export function authorizeDraft(state: GameState, draft: DraftEvent): void; // throws EngineError('FORBIDDEN'|'BAD_EVENT_TYPE')
```

Rules (minimal, respecting the free table):

1. **Type allowlist:** `draft.type` must be a known `EventType`; else `BAD_EVENT_TYPE`.
2. **No reaching into the opponent's private zones:** for any event that targets an
   instance (`MOVE` via `payload.instanceId`/`payload.from`; `SET_COUNTER`,
   `INC_COUNTER`, `SET_LEVEL`, `SET_ORIENTATION`, `REVEAL`, `LOOK`, `ATTACH`,
   `DETACH` via `payload.instanceId`), if the target instance's current zone is a
   **private zone (`pioche`/`main`/`reserve`) owned by the _other_ seat**, reject
   with `FORBIDDEN`. (Public zones — `monde`/`defausse`/`havreSac`/`exil`/`fileAttente`
   — remain interactable by either seat, consistent with manual effect resolution.)
3. **No peeking:** a `MOVE`/`REVEAL`/`LOOK` may not add the actor (or "all") to the
   `visibleTo`/`revealedTo` of an instance the actor cannot already see
   (`canSeeCardId(instance, actor) === false`) **and** that the actor does not own.
   (You may reveal your own cards; you may not reveal the opponent's hidden cards.)

`submit_event` calls `authorizeDraft(state, { ...draft, actor: me.seat })` right
after deriving state; on `EngineError` it returns **403** `{ error: 'FORBIDDEN' }`.
System events (setup) bypass (actor `"system"`, server-generated).

## Data flow (after)

`submit_event`: auth → `me.seat` → derive `preState` → **`authorizeDraft`** (403 on
fail) → `resolveDraft` → `append_event` → derive `postState` → **broadcast
`redactEventForSeat(ev, A/B, pre, post)` on `game:<id>:A` / `:B`**.

`join_game` setup loop: per draft → `resolveDraft` → `append_event` → broadcast
per-seat redacted on the private channels (pre/post = `deriveState` before/after).

Client: `connectOnline(id, seat)` → subscribe `game:<id>:<seat>` private → receive
redacted events → `applyServerEvent` (merge `reveals`) → `state` = patched derive →
`redactStateFor` render.

## Error handling

- `authorizeDraft` failure → 403, surfaced via the existing `fnErrorMessage`
  mapping (`FORBIDDEN` → clear FR message: "Action non autorisée").
- Realtime subscribe denied (wrong seat / non-participant) → channel never reaches
  `SUBSCRIBED`; the existing `onlineWaiting` overlay already covers the wait; add a
  `subscribe((status)=>…)` log for `CHANNEL_ERROR` (full reconnection is P1).
- Redaction must never throw on a malformed instance; missing `cardId` stays `""`.

## Testing

- **Unit** (`authority.spec.ts`, `redact` tests):
  - `authorizeDraft`: rejects MOVE-from-opponent-main, REVEAL/LOOK of opponent
    pioche, SET_COUNTER on opponent hand; allows own-card and public-zone actions;
    rejects unknown type.
  - `redactEventForSeat`: seat A's stream for `GAME_STARTED` contains **zero**
    opponent `cardId`s and **no** `SHUFFLE` permutation; an own `drawTop` yields
    `reveals` with the drawn `cardId` for the drawer only; a `playToWorld` yields
    `reveals` for **both** seats; a draw to A yields **no** `reveals` for B.
- **Integration (real, 2 throwaway accounts, with cleanup)** — same harness as the
  prior end-to-end test (signup + password grant → JWTs; Management API for DB
  forensics/cleanup): assert seat A's channel payloads never carry B's hidden
  `cardId`s; a **3rd** account is **denied** subscription to `game:<id>:A`; a crafted
  `submit_event` that tries to MOVE/REVEAL B's pioche card returns **403**.
- **Browser:** the board renders correctly from redacted events (opponent = card
  backs/counts, your own cards + your draws visible, a played card appears for both).
- **Gate:** `vue-tsc`, full unit suite, `npx playwright` unchanged-green.

## Deployment (agent, with the user's `sbp_` token)

1. Re-verify the access token is still valid (Management API ping).
2. `npm i -g supabase` (PowerShell has network) → `supabase login`/token →
   `supabase link` → `supabase functions deploy join_game submit_event`.
3. Apply `0006_realtime_authorization.sql` via the Management API `database/query`
   (and confirm Realtime Authorization is active by the denial test above).
4. Frontend (`gameClient`/`gameStore`/`PlayTableView`) → git → Vercel.
5. Run the real 2-account integration + browser verification post-deploy; clean up.

## Risks

- **Realtime Authorization policy** is the trickiest piece; the per-seat topic
  matching must be validated against the deployed Realtime version (integration
  test gates this; participant-scoped per-game fallback if needed).
- **Deno imports** of `redactEventForSeat`/`authorizeDraft` into Edge Functions
  must use explicit `.ts` value imports (the engine already deploys under Deno).
- **Client state-model change** (redacted events + `reveals`) — covered by the
  browser render test; `redactStateFor` retained as a safety net.
