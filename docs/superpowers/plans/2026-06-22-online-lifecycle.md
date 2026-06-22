# Online Game Lifecycle Implementation Plan

> Implement task-by-task. Each task: tests (where given) → implement → `npm run type-check` → relevant `npx vitest run` → commit. Spec: `docs/superpowers/specs/2026-06-22-online-lifecycle-design.md`. Branch: `feat/online-lifecycle`.

**Goal:** Server-authoritative terminal game lifecycle (victory/concede/disconnect) + repeatable mulligan + shared assisted-rules mode + cleanup. Conventions: TS strict, no enums, UI French/code English, `npm run type-check` (vue-tsc) is the only type gate; Edge Functions are Deno (type-check only locally, validated at deploy), engine imports use explicit `.ts`.

---

## Phase 1 — Terminal state + game-end

### Task 1: Engine — `GAME_OVER` event

**Files:** `src/game/types/events.ts`, `src/game/engine/reducer.ts`; test `src/game/engine/__tests__/engine.spec.ts`.

- events.ts: add `"GAME_OVER"` to `EventType`; add `export interface GameOverPayload { winner: Seat | "draw"; reason: "concede" | "defeat" | "disconnect"; }`.
- reducer.ts: extend the no-op passthrough guard to include `GAME_OVER` (alongside `UNDONE`/`SAID`/`MULLIGAN_DONE`).
- Test: a journal with a `GAME_OVER` folds without throwing and leaves `instances` unchanged (mirror the `MULLIGAN_DONE` no-op test).
- `npm run type-check`; commit `feat(game): GAME_OVER terminal event (no-op fold)`.

### Task 2: gameStore — converge on GAME_OVER + online concede/quit + assisted param

**Files:** `src/stores/gameStore.ts`; test `src/stores/__tests__/gameStore.spec.ts`.

- `deriveOnlineOutcome()`: BEFORE the `victoryFromState` block, scan `events.value` for a `GAME_OVER`; if found, set `matchPhase='finished'` and, when `payload.winner !== 'draw'`, `winner.value = payload.winner`; return. (So concede/disconnect ends converge on both clients from the journal.)
- `connectOnline(id, seat, transport, assisted = false)`: set `assist.value = assisted` instead of hard-coding `false` (keep `assistEffects=false`). Update the `OnlineTransport`/call sites accordingly (the param is plumbed from PlayTableView in Task 6).
- `concede(seat)`: `if (online.value) { void onlineTransport?.concede?.(gameId.value); } else { <existing local mutation> }`. Add `concede(gameId): Promise<void>` to the `OnlineTransport` interface.
- `quitMatch()`: `if (online.value) { concede(mySeat.value); disconnectOnline(); return; }` then the existing local reset.
- Tests: (a) `deriveOnlineOutcome` — a journal `[GAME_STARTED, MULLIGAN_DONE×2, GAME_OVER{winner:'A'}]` ⇒ `matchPhase==='finished'`, `winner==='A'` (build via mock `applyServerEvent`, reuse helpers); (b) `connectOnline(..., true)` ⇒ `store.assist===true`.
- type-check; `npx vitest run src/stores`; commit `feat(play): converge online outcome on GAME_OVER + online concede/quit + assisted mode`.

### Task 3: gameClient — concede/claimVictory/assisted transport

**Files:** `src/services/gameClient.ts`.

- `concede(gameId)`: `functions.invoke("submit_event", { body: { gameId, draft: { type: "CONCEDE" } } })`.
- `claimVictory(gameId)`: `... draft: { type: "CLAIM_VICTORY" }`.
- `createGame(deck, assisted = false)`: include `assisted` in the body.
- `findGameByCode(code)`: also `select("id, assisted")` → return `{ id, assisted } | null` (adjust callers).
- `findMyActiveGame()`: also select `assisted` → return `{ gameId, seat, assisted }`.
- Wire these into `PlayTableView`'s `onlineTransport` (add `concede: gc.concede`).
- type-check; commit `feat(play): gameClient concede/claimVictory + assisted on create/find`.

### Task 4: submit_event — concede, claim, auto-victory, terminal write; repeatable mulligan

**Files:** `supabase/functions/submit_event/index.ts`.

- Import `victoryFromState` from `../../../src/game/rules/progress.ts` and `otherSeat` from `../../../src/game/types/zones.ts`.
- Helper `finishGame(winner, reason)`: append a system `GAME_OVER {winner, reason}` event (resolve+append+per-seat redacted broadcast, like the MULLIGAN loop's `appendOne`), then `await db.from("games").update({ status:"finished", winner, end_reason: reason }).eq("id", gameId)`.
- Early guard: if `rowEvents.some(e => e.type==="GAME_OVER")` → 409 `PARTIE_TERMINEE` (and the existing `status!=='active'` gate now fires once finished).
- `CONCEDE` meta-intent: `await finishGame(otherSeat(me.seat), "concede")` → return `{ ok:true }`.
- `CLAIM_VICTORY` meta-intent: `await finishGame(me.seat, "disconnect")` → return `{ ok:true }`. (Trusted-client; client gates on grace window.)
- **Repeatable mulligan:** in the existing `MULLIGAN` branch, **delete the final `appendOne({...MULLIGAN_DONE...})`** so a mulligan no longer auto-finishes (player keeps via the separate `MULLIGAN_DONE` path).
- **Auto-victory:** in the NORMAL path, after the successful append + `post = deriveState([...rowEvents, ev])`, add: `const w = victoryFromState({ state: post } as never); if (w && !rowEvents.some(e=>e.type==="GAME_OVER")) await finishGame(w, "defeat");` (after broadcasting the player's event).
- Actor is always `me.seat` (never client payload). type-check; commit `feat(play): server game-end (concede/claim/auto-victory) + terminal write; repeatable mulligan`.

### Task 5: Migration + create_game — assisted column

**Files:** new `supabase/migrations/0007_game_assisted.sql`; `supabase/functions/create_game/index.ts`.

- Migration: `alter table public.games add column if not exists assisted boolean not null default false;`
- create_game: read `assisted` from the body (`const { deck, assisted = false } = await req.json()`) → include in the games insert.
- type-check; commit `feat(play): games.assisted column + create_game stores it`.

### Task 6: PlayTableView — assisted toggle + wire concede/quit/connect

**Files:** `src/views/PlayTableView.vue`.

- Online-create form: a checkbox "Règles assistées" bound to `onlineAssisted` (ref, default per the user's choice — present as an explicit toggle, no forced default) → `createOnlineGame(deck, onlineAssisted.value)`.
- `onlineCreate`: `store.connectOnline(gameId, "A", onlineTransport, onlineAssisted.value)`.
- `onlineJoin`: `const g = await findGameByCode(code)` now `{id, assisted}` → `store.connectOnline(g.id, "B", onlineTransport, g.assisted)` (keep the post-join `resyncOnline`).
- Resume-on-mount: `findMyActiveGame()` now returns `assisted` → pass to `connectOnline`.
- Abandonner button already calls `store.concede(perspective)` (now server-routed online) — no change beyond confirming. Quitter calls `store.quitMatch()` (now concedes+disconnects online).
- type-check; `npx vitest run` (no regressions); commit `feat(play): assisted-rules toggle at create + wire online concede/quit/connect`.

---

## Phase 2 — Disconnect / presence

### Task 7: Presence transport + grace timer

**Files:** `src/services/gameClient.ts`, `src/stores/gameStore.ts`.

- gameClient: in `subscribeToGame`, after `SUBSCRIBED` call `channel.track({ seat })`; add `.on("presence", { event: "sync" }, ...)` / `join` / `leave` handlers that compute whether the OTHER seat is present and invoke a new `onPresence(present: boolean)` callback. Extend the subscribe signature (or add `subscribePresence`) and the `OnlineTransport.subscribe` type to deliver presence to the store.
- gameStore: `const opponentPresent = ref(true)`; presence callback sets it. When it flips to `false` while `matchPhase==='playing'`, start a grace timer (store a handle; default 5 min — make the duration a constant `DISCONNECT_GRACE_MS`); on `join` before expiry, cancel. Expose `opponentPresent`, `graceRemainingMs` (or a `canClaimVictory` ref), and `claimVictory()` → `onlineTransport.claimVictory(gameId)`. Clear timer in `disconnectOnline`.
- Add `claimVictory(gameId)` to `OnlineTransport`.
- Tests: presence false → after (mocked/shortened) grace, `canClaimVictory` true; presence true cancels. Keep timer test-safe (clear in disconnect; use a injectable/short duration in tests or test the logic without real 5-min waits).
- type-check; `npx vitest run src/stores`; commit `feat(play): opponent presence + disconnect grace window`.

### Task 8: PlayTableView — presence UI + lifecycle listeners

**Files:** `src/views/PlayTableView.vue`.

- Show "Adversaire déconnecté — victoire réclamable dans mm:ss" when `online && opponentPresent===false && matchPhase==='playing'`; once `canClaimVictory`, a "Réclamer la victoire" button → `store.claimVictory()`.
- `visibilitychange` listener: cosmetic only (optional subtle note), never forfeits.
- `onUnmounted`: `if (store.online) store.disconnectOnline()` (clean teardown; resume-on-mount still re-enters active games).
- type-check; `npx vitest run`; commit `feat(play): presence indicator + claim-victory + lifecycle teardown`.

---

## Phase 3 — Cleanup (pg_cron)

### Task 9: Cleanup migration

**Files:** new `supabase/migrations/0007b_game_cleanup.sql` (rename to keep order after 0007).

- `create extension if not exists pg_cron;`
- Schedule hourly: `lobby` older than 2h → `aborted/lobby_timeout`; `active` with `updated_at` older than 24h → `aborted/disconnect`; delete terminal games older than 30 days (cascades).
- Deploy note: pg_cron may need project-level enabling (Management SQL). If `cron.schedule` is unavailable, apply the UPDATE/DELETE statements as a documented manual/periodic job and flag it.
- commit `feat(play): pg_cron cleanup of stale lobbies + zombie games`.

---

## Task 10: Deploy + live test + cleanup (operator)

- Gate: `npm run type-check`, `npx vitest run`, `npm run build`, `npx playwright test --workers=1`.
- Apply migrations (assisted column + pg_cron) via Management SQL (one statement each; enable pg_cron if needed). Deploy `create_game` + `submit_event` via the GitHub CLI binary (`$env:SUPABASE_ACCESS_TOKEN`, `--project-ref ehqalhzvmgkepgbaxbzu`).
- Merge `feat/online-lifecycle` → master → push (Vercel).
- Live (2 throwaway accounts, cleanup): concede → opponent sees defeat + `games.status='finished'`; reconnect to finished → NOT resurrected; repeatable mulligan 6→5→4 then keep; assisted toggle propagates; auto-victory (drive hero hp≤0 via setCounter) → terminal row + both see winner; disconnect → grace → claim victory → terminal. 0 redaction leak throughout. Clean up; verify 0 remaining.
- Update memory. Remind the user to clear the PWA cache once.

## Self-review

Spec coverage: terminal `GAME_OVER` (T1), client converge + concede/quit (T2), transport (T3), server end-paths + repeatable mulligan + auto-victory (T4), assisted column/create (T5), UI wiring (T6), presence+grace (T7/T8), cleanup (T9), deploy/test (T10). Type consistency: `GameOverPayload{winner,reason}` (T1) used in submit_event (T4) + deriveOnlineOutcome (T2); `connectOnline(...,assisted)` defined T2, called T6; transport methods `concede`/`claimVictory` defined T3/T7, used T2/T7. Verify at implementation: `victoryFromState` Deno-importability (T4) and pg_cron availability (T9) — both flagged.
