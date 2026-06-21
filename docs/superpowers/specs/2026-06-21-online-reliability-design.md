# Online Reliability (pull_events + resync + reconnection) — Design

**Date:** 2026-06-21
**Status:** Approved (design)
**Slice:** A of the "robust online playability" work (B = online game start: opening hand + mulligan).
**Fixes:** Bug 1 (joiner stuck on "En attente" — missed `GAME_STARTED` due to the subscribe-before-broadcast race) and refresh/disconnect abandoning an active game.

## Goal

Make online event delivery reliable and recoverable: a client can always (re)build
its authoritative, per-seat **redacted** journal by pulling from the server, so a
missed/late/out-of-order broadcast, a join-time race, or a page refresh never leaves
a player desynced or stuck. Broadcast stays the low-latency path; **pull is the
safety net**; the journal is the source of truth.

## Background

- `submit_event`/`join_game` broadcast per-seat redacted events on private channels
  `game:<id>:<seat>` (P0). Delivery is best-effort, at-most-once, not replayed.
- The creator subscribes at create time (before any broadcast) so it receives setup;
  the joiner subscribes then _immediately_ triggers `join_game`, whose `GAME_STARTED`
  broadcast can fire before the joiner's subscription is live → joiner misses it.
- `game_events` is RLS-blocked from clients (service-role only); there is no client
  read path → a refresh cannot rebuild state. `applyServerEvent` appends in arrival
  order with seq-dedup only (no reordering, no gap detection).
- `redactEventForSeat(event, viewer, pre, post)` (P0) already produces a per-seat
  redacted event + `reveals` patch; `deriveState` is a pure, memoized fold.

## Components

### 1. `pull_events` Edge Function (`supabase/functions/pull_events/index.ts`)

Returns the caller's **per-seat redacted** journal after a given seq.

- Auth: `getUserId(req)` → 401 if none. Resolve the caller's seat from
  `game_players (game_id, user_id)` → 403 `PAS_JOUEUR_DE_CETTE_PARTIE` if absent.
- Body: `{ gameId: string, sinceSeq: number }`.
- Read **all** `game_events` for `gameId` ordered by `seq` (the full journal is needed
  to compute the pre/post state of each returned event — redaction's `reveals` diff
  depends on prior events). Map rows → `PersistedEvent` (reuse the `rowToEvent` shape).
- Walk the journal accumulating state; for each event with `seq > sinceSeq`, push
  `redactEventForSeat(ev, seat, preState, postState)` where `preState` = state before
  the event and `postState` = state after. Events with `seq <= sinceSeq` only advance
  the accumulated state (not returned).
- Return `{ events: RedactedEvent[] }` (ordered by seq). Service role bypasses RLS;
  no secret leaves un-redacted (same guarantee as the broadcast path).
- Deno value imports use explicit `.ts` extensions (engine modules).

### 2. Client transport: `gameClient.pullEvents(gameId, sinceSeq)`

```ts
export async function pullEvents(
  gameId: string,
  sinceSeq: number,
): Promise<RedactedEvent[]>;
```

`functions.invoke("pull_events", { body: { gameId, sinceSeq } })` → `data.events`. The
seat is resolved server-side from the JWT (not passed by the client). Add `pull` to the
`OnlineTransport` interface in `gameStore.ts`; `PlayTableView`'s `onlineTransport`
gains `pull: pullEvents`.

### 3. `applyServerEvent` — order-aware + gap-resync (`gameStore.ts`)

Replace the append-in-arrival-order logic with contiguous-by-seq application plus a
buffer and a pull-to-fill-gaps trigger. The journal (`events.value`) is kept **strictly
contiguous from seq 1..N** so the pure fold is always correct.

State added to the store: `const pending = new Map<number, RedactedEvent>()`,
`let pulling = false`.

```ts
function lastSeq(): number {
  return events.value.length ? events.value[events.value.length - 1].seq : 0;
}

function applyServerEvent(ev: RedactedEvent): void {
  if (ev.reveals) revealed.value = { ...revealed.value, ...ev.reveals }; // monotonic, order-independent
  if (ev.seq <= lastSeq()) return; // duplicate / already applied
  pending.set(ev.seq, ev);
  // drain contiguous run
  let next = lastSeq() + 1;
  const toAppend: RedactedEvent[] = [];
  while (pending.has(next)) {
    toAppend.push(pending.get(next)!);
    pending.delete(next);
    next++;
  }
  if (toAppend.length) events.value = [...events.value, ...toAppend];
  // if a gap remains (pending events beyond the contiguous run), backfill via pull
  if (pending.size && !pulling) void resyncFrom(lastSeq());
}

async function resyncFrom(sinceSeq: number): Promise<void> {
  if (!onlineTransport?.pull || pulling) return;
  pulling = true;
  try {
    const evs = await onlineTransport.pull(gameId.value, sinceSeq);
    for (const e of evs) applyServerEvent(e); // re-enters; contiguous run drains
  } catch (e) {
    ruleError.value = `Resync: ${String(e)}`;
  } finally {
    pulling = false;
  }
}
```

Notes: `revealed` merge stays unconditional (safe, monotonic). Inserting only contiguous
runs keeps `events.value` ordered, so `deriveState` is always correct (the memo falls
back to a full re-derive if a run is non-monotonic — acceptable). `pending` and
`pulling` reset in `connectOnline`/`disconnectOnline`.

### 4. Connect-time backfill (`connectOnline`)

After wiring the subscription, pull the full journal so nothing sent before the
subscription was live is missed:

```ts
onlineUnsub = transport.subscribe(id, seat, applyServerEvent);
void resyncFrom(0); // pull(0) → applyServerEvent drains contiguously; dedups vs live
```

`connectOnline` stays sync (the pull runs in the background; the waiting overlay clears
when `GAME_STARTED` lands from either path). This fixes Bug 1 without a fragile
"wait for SUBSCRIBED".

### 5. Reconnection on mount (`PlayTableView`)

Add `resumeOnlineGame()` called from `onMounted` (when authenticated, not already in a
game): query `games` for a row where (`seat_a` = uid OR `seat_b` = uid) AND
`status = 'active'`, newest first. If found, determine my seat and
`store.connectOnline(gameId, seat, onlineTransport)` → the connect-time pull rebuilds
the board. (Reconnecting to a `lobby`-status game = slice B's concern; A handles
`active`.) `matchPhase` on reconnect = `'playing'` (slice B refines mulligan-phase).

## Data flow

connect/reconnect → subscribe + `pull(0)` → `applyServerEvent` drains seq 1..N → board.
live broadcast → `applyServerEvent`; if it's the next seq, append; if it's ahead (gap),
buffer + `pull(lastSeq)` to fill, then drain. Dedup by seq throughout.

## Error handling

- `pull_events` 401/403 → client surfaces via `ruleError` (resync failure is non-fatal;
  the next broadcast or a later pull retries).
- A pull that returns fewer events than expected (e.g., race) leaves `pending` items;
  the next broadcast re-triggers `resyncFrom`. `pulling` guards against pile-ups.
- No `pull` transport (e.g., a future local-only transport) → `resyncFrom` no-ops.

## Testing

- **Unit (`gameStore.spec.ts`)** with a mock transport exposing `pull`:
  - in-order events apply (seq 1,2,3 → journal contiguous, state correct).
  - out-of-order: apply seq 3 then 1 then 2 → after the gap, `pull` is invoked with the
    last contiguous seq; once the mock returns 1,2, the journal becomes [1,2,3] and the
    derived state matches in-order application (assert via `revealedCardId`/`state`).
  - duplicate seq → ignored.
  - `reveals` from any received event merge regardless of order.
- **Unit**: `redactEventForSeat` already covers per-event redaction; `pull_events` itself
  is an Edge Function (validated live).
- **Live (2 accounts, with cleanup)**: joiner B reliably reaches the board (receives
  `GAME_STARTED`) without any artificial wait; kill B's channel / simulate a missed
  broadcast → `pull` backfills; "refresh" (fresh `connectOnline` + `resumeOnlineGame`)
  rebuilds B's board for an active game. A's stream still carries 0 opponent secrets.
- **Gate**: `vue-tsc`, full unit suite, `npx playwright` green.

## Deployment (agent, with the user's `sbp_` token)

1. Deploy `pull_events` (and it shares the engine bundle, like the others) via the
   GitHub-released Supabase CLI binary. No new migration (RLS already covers
   `game_events` = server-only; `pull_events` reads via service role).
2. Frontend (`gameClient`/`gameStore`/`PlayTableView`) → git → Vercel.
3. Live verification + cleanup. (No project-config change needed.)

## Out of scope (slice B)

Server-dealt opening hand, online mulligan, `matchPhase` derived from the journal,
lobby-state reconnection. This slice only guarantees _delivery_; B adds the _content_.
