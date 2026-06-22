# Online Game Lifecycle — Design (terminal state, concede, disconnect, cleanup, repeatable mulligan, shared assisted mode)

**Date:** 2026-06-22
**Status:** Approved scope (user chose "Complet" = Phases 1+2+3 + the two extra items).
**Source:** the lifecycle audit (7-agent) — root cause: the server has **no terminal game state**; everything else cascades.

## Root cause & goal

`games.status` only goes `lobby → active` (written once in `join_game`); nothing ever writes `finished`/`aborted` or fills `winner`/`end_reason`. So a game never ends server-side: concede is local-only, "Quitter" doesn't leave, tab-close is undetected, auto-victory is client-only, and `findMyActiveGame` (status='active') resurrects dead games forever. **Goal:** a server-authoritative terminal lifecycle so games end (victory/concede/disconnect), the result is shared + durable, dead games stop being resumed, and abandoned games get cleaned up. Plus two correctness items: **repeatable mulligan** and a **shared assisted-rules mode** chosen at creation.

## Verified facts

- `victoryFromState(ctx)` (`src/game/rules/progress.ts`) reads ONLY `ctx.state` (hero `counters.hp`/`xp`, `location.zone`) — **no card data** → the Edge Function can run it via `victoryFromState({ state: post } as RulesCtx)`.
- `games` already has `status` (CHECK includes `finished`/`aborted`), `winner` (text), `end_reason` (text). Only a new `assisted` column is needed.
- `deriveOnlineOutcome` (`gameStore`) already journal-derives phase + victory and is terminal-once-reached. `concede()` is local-only; `quitMatch()` doesn't disconnect online.

---

## Phase 1 — Terminal state + game-end (+ repeatable mulligan + assisted mode)

### 1.1 `GAME_OVER` terminal event (engine)

- Add `"GAME_OVER"` to `EventType` + `GameOverPayload = { winner: Seat | "draw"; reason: "concede" | "defeat" | "disconnect" }`.
- Reducer: **no-op** passthrough (outcome is journal-derived), alongside `UNDONE`/`SAID`/`MULLIGAN_DONE`.
- `GAME_OVER` is **server/system-authored only** — NOT added to client `ALLOWED_TYPES`. Players produce it indirectly via the `CONCEDE`/`CLAIM_VICTORY` meta-intents and via server auto-victory.

### 1.2 `submit_event` — concede, claim, auto-victory, terminal write

- **Reject up front** if the game is already terminal: the existing `status !== 'active'` gate (submit_event ~56) starts firing once we write `finished` — keep it; also short-circuit if the journal already has a `GAME_OVER`.
- **`CONCEDE` meta-intent** (`draft.type === 'CONCEDE'`): force loser = `me.seat`; append `GAME_OVER { winner: otherSeat(me.seat), reason: 'concede' }` (actor `system`), broadcast redacted, then `UPDATE games SET status='finished', winner=<other>, end_reason='concede'`.
- **`CLAIM_VICTORY` meta-intent** (`draft.type === 'CLAIM_VICTORY'`, disconnect-forfeit): append `GAME_OVER { winner: me.seat, reason: 'disconnect' }` + terminal write `end_reason='disconnect'`. Server guard: only if `status='active'` and no existing `GAME_OVER`. (Opponent-absence is enforced client-side by the grace window — trusted-client/free-table model; pg_cron is the backstop. Documented as accepted.)
- **Auto-victory** (normal gameplay path): after appending the player's event and computing `post = deriveState([...rowEvents, ev])`, run `victoryFromState({ state: post })`; if it returns a winner and no `GAME_OVER` exists yet, append `GAME_OVER { winner, reason: 'defeat' }` (actor `system`) + terminal write `end_reason='defeat'`. This makes auto-victory **server-authoritative + persisted** (backs commit ad9d162's client-only detection). Import `victoryFromState` from `../../../src/game/rules/progress.ts` (verify Deno bundles it; the chain is pure TS).
- Loser/winner are always derived from the **authenticated seat**, never a client payload.

### 1.3 Client converges from the journal (`gameStore`)

- `deriveOnlineOutcome`: if the journal contains a `GAME_OVER`, set `winner = payload.winner` (ignore for `'draw'`) and `matchPhase = 'finished'` **before** the `victoryFromState` check. So a concede/disconnect end is shared + survives reconnect (both clients see it).
- `concede(seat)`: if `online` → `gameClient.concede(gameId)` (submit the `CONCEDE` meta-intent); the terminal state then arrives via broadcast/`GAME_OVER`. If local → keep the existing local mutation.
- `quitMatch()`: if `online` → `concede(mySeat)` (forfeit) then `disconnectOnline()`; if local → existing reset.

### 1.4 Buttons (`PlayTableView`)

- **Abandonner** → `store.concede(perspective)` (now routes to the server online). Keep the two-step confirm.
- **Quitter** (online) → confirm → `store.quitMatch()` (which now concedes + disconnects). Offline unchanged.

### 1.5 Repeatable mulligan (fix)

- In `submit_event`'s `MULLIGAN` expansion, **remove the final `MULLIGAN_DONE` append**. A mulligan now only recycles → shuffle → redraw(n−1); the seat stays in `mulligan` so the overlay reappears with the smaller hand and the player can mulligan again or click **Garder** (which submits `MULLIGAN_DONE` separately, as today). The existing "already has `MULLIGAN_DONE`" guard then correctly blocks mulligan only **after** the player has kept. Matches the local game + the displayed rule ("une carte de moins à chaque fois"). Update the slice-B spec note ("mulligan implies done" was wrong) + tests.

### 1.6 Shared assisted-rules mode

- **Migration:** `alter table games add column assisted boolean not null default false;`
- **`create_game`**: accept `assisted` in the body → insert it.
- **Client:** the online-create form gets an "Règles assistées" toggle → `createGame(deck, assisted)`. `findGameByCode` and `findMyActiveGame` also return `assisted`. `connectOnline(id, seat, transport, assisted)` sets `assist.value = assisted` (instead of hard-coding `false`). (`assistEffects` stays `false` online — effect automation is separate and risks double-submit; out of scope.)
- Both players therefore run the same rule-assist mode for the match, chosen by the creator.

---

## Phase 2 — Disconnect / presence (+ grace-window forfeit)

### 2.1 Presence (`gameClient.subscribeToGame`)

- After `SUBSCRIBED`, `channel.track({ seat, at: Date.now-substitute })` (pass a server-independent marker; the app may use a counter). Listen to presence `sync`/`join`/`leave`. Surface opponent presence to the store via a new transport callback or a dedicated `subscribePresence(gameId, seat, onPresence)`; expose `store.opponentPresent: boolean`.
- Keep the existing broadcast subscription unchanged (presence rides the same or a sibling channel).

### 2.2 Lifecycle listeners (`PlayTableView`)

- `visibilitychange` → **cosmetic only** (optionally a subtle "adversaire peut-être absent"); NEVER forfeits.
- `pagehide` → best-effort presence untrack (the channel close already does this); no synchronous network forfeit.
- `onUnmounted` → `disconnectOnline()` if online (clean teardown) — but this is navigation away, not a forfeit; resume-on-mount still re-enters an `active` game.

### 2.3 Grace-window claim (`gameStore` + `PlayTableView`)

- When `opponentPresent` flips to `false` while `matchPhase==='playing'`, start a grace timer (default **5 min**). While counting, show "Adversaire déconnecté — victoire réclamable dans mm:ss". If the opponent returns (presence `join`), cancel.
- On expiry, show a **"Réclamer la victoire"** button → `gameClient.claimVictory(gameId)` (the `CLAIM_VICTORY` meta-intent) → server writes the terminal row (`end_reason='disconnect'`). Clear the timer on disconnect/finished.

---

## Phase 3 — Cleanup safety net (pg_cron)

- **Migration** (`0007_game_cleanup.sql`): `create extension if not exists pg_cron;` then schedule a sweep (runs hourly):
  - `lobby` with `created_at < now() - interval '2 hours'` → `status='aborted', end_reason='lobby_timeout'`.
  - `active` with `updated_at < now() - interval '24 hours'` → `status='aborted', end_reason='disconnect'`.
  - delete `games` (and cascade `game_events`/`game_secrets`/`game_players`) where terminal and `updated_at < now() - interval '30 days'`.
- `games.updated_at` is already maintained by `append_event` + the `games_set_updated_at` trigger → usable staleness signal. (Deploy note: pg_cron may need enabling at the project level; do via Management SQL.)

---

## Out of scope (documented, not built)

Server-side anti-cheat / turn-ownership enforcement / server damage adjudication — the game is intentionally a **trusted-clients / Cockatrice free table** (`authorizeDraft` only blocks opponent-private-zone access + peeking). `CLAIM_VICTORY` and client-detected victory are forgeable under this model; accepted. Showing a finished game's result on reconnect (finished games simply aren't resumed) — optional later.

## Data flow (end-to-end)

Create (assisted flag) → join (opening hands) → repeatable mulligan → play. End via: **concede** (`CONCEDE`→`GAME_OVER`), **auto-victory** (server `victoryFromState`→`GAME_OVER`), or **disconnect** (presence gone → grace → `CLAIM_VICTORY`→`GAME_OVER`). Each writes `games` terminal + broadcasts `GAME_OVER`; both clients derive `finished`+winner from the journal. `findMyActiveGame` (status='active') no longer returns ended games → no resurrection. pg_cron reaps anything that slips through.

## Testing

- **Unit (engine):** `GAME_OVER` no-op fold; `GameOverPayload` types.
- **Unit (gameStore):** `deriveOnlineOutcome` → a journal with `GAME_OVER{winner:'A'}` ⇒ `finished` + winner A on BOTH seats; repeatable mulligan (no auto-done); `connectOnline(..., assisted=true)` sets `assist`.
- **Live (2 accounts, cleanup):** concede → opponent sees defeat + `games.status='finished'`; mulligan twice (6→5→4) then keep; assisted toggle propagates to both; auto-victory (drive hero hp≤0) → both see winner + terminal row; reconnect to a finished game → NOT resurrected (back to lobby); disconnect one client → after (shortened test) grace, claim victory → terminal. Verify 0 redaction leak throughout.
- **Gate:** `vue-tsc`, full unit suite, `npx playwright`, build.

## Deployment

Migrations (`assisted` column + pg_cron) via Management SQL (one statement each) / enable pg_cron. Deploy `create_game` + `submit_event` (and any engine bundle changes) via the GitHub CLI binary. Frontend → master → Vercel. Live verify + cleanup. **Remind the user the new build needs a PWA cache clear once.**
