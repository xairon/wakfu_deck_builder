# Online Game Start (opening hand + mulligan) — Design

**Date:** 2026-06-21
**Status:** Proposed (design) — slice B of "robust online playability" (slice A = reliability, shipped).
**Fixes:** Bug 2 (creator lands on the board but is never dealt an opening hand / never prompted to keep-or-mulligan). Makes an online game actually start: both players get a hand, each independently keeps or mulligans, then play begins.

## Goal

Bring the online game from "both players on an empty board" to "both players with a starting hand, past the mulligan, ready to play" — server-authoritatively and reconnection-safely. The local game already does this (deal 6 → `mulligan` phase → keep/mulligan → `playing`); online must mirror it through the journal so both clients agree and a refresh resumes mid-mulligan.

## Background

- Local `startMatch`: `draw(seat, paOf(seat))` for each seat, then `matchPhase='mulligan'`, `mulliganSeat=first` (pass-the-device). `mulligan(seat)` = recycle whole hand → pioche top, shuffle, redraw (n−1). `keepHand()` marks the seat done; both done → `matchPhase='playing'`.
- Opening hand size = the hero's `pa` counter, which `setup.ts` hardcodes to **6** for every hero → online can use the constant 6 (no card data needed server-side).
- Online today: `connectOnline` hardcodes `matchPhase='playing'` and `join_game` setup emits only `GAME_STARTED` + `SHUFFLE`-per-pioche (no draws) → no hand, no mulligan.
- Server authority (slice A + P0): `submit_event` re-derives state, `authorizeDraft`, `resolveDraft` (server RNG for SHUFFLE from `masterSeed|gameId|seq|zone`), `append_event`, then per-seat redacted broadcast. `join_game` already appends a _sequence_ of setup events in a loop — the pattern for "one request → many appended+broadcast events".

## Protocol (event-sourced, journal-derived)

A seat makes exactly **one** mulligan decision:

- **Keep** → one `MULLIGAN_DONE` event for that seat.
- **Mulligan** → recycle hand→pioche, shuffle, redraw(n−1), **then** `MULLIGAN_DONE` for that seat (mulligan implies done — one mulligan, official rule, and it removes any "already-mulliganed" guard).

`matchPhase` (online) is **derived from the journal**: no `GAME_STARTED` → loading; `GAME_STARTED` present and _both_ seats have a `MULLIGAN_DONE` → `playing`; otherwise → `mulligan`. This is the single source of truth both clients + a reconnecting client agree on.

## Components

### 1. Opening hand dealt at setup (`join_game`)

After the existing setup events (`GAME_STARTED` + `SHUFFLE` per pioche), append **6 `drawTop` per seat**, re-deriving state between each (the existing setup loop already does derive→resolve→append→broadcast). Each `drawTop(state, seat)` is a `MOVE` pioche[0]→main `visibleTo:[seat]` → redaction reveals the cardId to that seat only (opponent sees an instanceId in `main`, no cardId). Actor = `system` (consistent with setup; bypasses authorization). Deal order: all of A's 6, then all of B's 6 (or interleaved — irrelevant, the pioche is shuffled).

### 2. `MULLIGAN_DONE` event type (engine)

- Add `"MULLIGAN_DONE"` to the `EventType` union + a `MulliganDonePayload = { seat: Seat }`.
- Reducer: a **no-op** case (state unchanged) — `matchPhase` derives from the journal, not state, so the reducer only needs to not throw on it. (Mirrors how `SAID` is a state no-op.)
- `authority.ts`: add `"MULLIGAN_DONE"` to `ALLOWED_TYPES`; in `authorizeDraft`, reject if `payload.seat !== actor` (a seat may only mark **its own** decision). `resolveDraft` passes it through unchanged (no RNG).

### 3. `MULLIGAN` meta-intent (server, `submit_event`)

`MULLIGAN` is a client intent that is **not** a persisted event — `submit_event` expands it (like `join_game`'s setup loop). Branch **before** the normal authorize/resolve path:

- Re-derive state; resolve the actor's seat (server-imposed). Reject (409) if the actor already has a `MULLIGAN_DONE` in the journal (can't decide twice).
- Build the sequence from server state: for each instanceId in `state.seats[seat].main` → a `MOVE` main→pioche top, face-down (`visibility:{faceDown:true, visibleTo:'none'}`); then a `SHUFFLE` of `{zone:'pioche',owner:seat}`; then `drawTop(state', seat)` × (n−1) (re-derive after the shuffle so draws come off the server-shuffled order); then `MULLIGAN_DONE {seat}`.
- Resolve + `append_event` + per-seat redacted broadcast **each** event in order (server RNG for the SHUFFLE via `masterSeed`). The recycled cards lose visibility (back to a hidden pioche); the redraws reveal the new hand to the owner only.

`MULLIGAN_DONE` (the keep path) is submitted directly by the client and goes through the **normal** `submit_event` path (now allowed + auth-checked + reducer no-op).

### 4. `matchPhase` from the journal (`gameStore`)

- A pure helper `deriveMatchPhase(events): MatchPhase` — `'lobby'` if no `GAME_STARTED`; `'playing'` if both seats have a `MULLIGAN_DONE`; else `'mulligan'`.
- `connectOnline` no longer hardcodes `'playing'`: after the initial state is available it sets `matchPhase = deriveMatchPhase(events.value)`, and `applyServerEvent` re-derives `matchPhase` (online only) after each applied run. Reconnecting mid-mulligan → `'mulligan'`; after both kept → `'playing'`.
- `perspective` online stays the player's own seat (unchanged). `passPending` is **not** used online (no device hand-off).

### 5. Online mulligan UI (`PlayTableView`)

Add an online branch to the mulligan overlay (the local pass-the-device branch is untouched):

- `online && matchPhase==='mulligan'` and **my** `MULLIGAN_DONE` absent → show the overlay with **Garder** / **Mulligan** → `onlineKeep()` (submit `MULLIGAN_DONE {seat:mySeat}`) / `onlineMulligan()` (submit `{type:'MULLIGAN'}`).
- my `MULLIGAN_DONE` present, opponent's absent → "En attente de l'adversaire (mulligan)…".
- Helpers read "has seat X kept?" from `store` (expose `mulliganDoneOnline: () => ({A,B})` derived from the journal, reusing the same scan as `deriveMatchPhase`).

## Data flow

`join_game`: GAME_STARTED → SHUFFLE×2 → drawTop×6 (A) → drawTop×6 (B), each broadcast redacted. Both clients (via slice-A pull/broadcast) build a board with their own 6-card hand; `matchPhase` derives `mulligan`. Each player clicks Keep or Mulligan → server appends MULLIGAN_DONE (and, for mulligan, the recycle+shuffle+redraw before it) → broadcast → `matchPhase` re-derives → when both done, `playing`. Reconnect at any point rebuilds the same phase from the journal.

## Error handling

- Deciding twice → 409 (client already hides the overlay once `MULLIGAN_DONE` is seen).
- `MULLIGAN_DONE` with `seat !== actor` → 403.
- Empty hand on mulligan (n=0) → recycle/shuffle no-op, redraw 0, still emit `MULLIGAN_DONE` (degenerate but safe).
- An append/order failure mid-expansion → return 409; the client resyncs (slice A) and the journal reflects whatever committed (each event is atomic; a partial mulligan is self-consistent because `MULLIGAN_DONE` is emitted last — if it didn't commit, the seat is still "not done" and can retry).

## Testing

- **Unit (engine):** `MULLIGAN_DONE` folds as a no-op (state unchanged, no throw); `authorizeDraft` rejects `MULLIGAN_DONE` where `seat !== actor` and allows own.
- **Unit (gameStore):** `deriveMatchPhase` — no GAME_STARTED → lobby; GAME_STARTED only → mulligan; one MULLIGAN_DONE → mulligan; both → playing. Online `applyServerEvent` updates `matchPhase` accordingly.
- **Live (2 accounts, cleanup):** create+join → **both** clients show a 6-card hand + the mulligan overlay (Bug 2 fixed); A keeps, B mulligans → B's hand changes to 5, both reach `playing`; A's stream carries 0 of B's cardIds throughout (incl. B's recycled/redrawn cards); reconnect mid-mulligan resumes the overlay; reconnect after both kept resumes `playing`.
- **Gate:** `vue-tsc`, full unit suite, `npx playwright` green.

## Deployment (agent, user's `sbp_` token)

Deploy `join_game` + `submit_event` (engine bundle) via the GitHub-released Supabase CLI binary. Frontend (`gameStore`/`PlayTableView`/engine types) → git → Vercel. No migration (no schema change — `MULLIGAN_DONE` is just an event `type` string in the existing `game_events.type` column). Live verify + cleanup.

## Out of scope

Turn-by-turn online play polish beyond start (already routes through `dispatch → submit_event`, verified for MOVE in P0/C3); spectators; rematch; mulligan animations.
