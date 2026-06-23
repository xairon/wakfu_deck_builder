# Server-Authoritative Rules — Design

**Date:** 2026-06-23
**Status:** Approved (architecture = intent-based shared resolver; full scope, phased implementation).
**Goal:** The Edge Functions validate **every** action against the rules so out-of-turn and illegal moves are rejected **server-side**, regardless of client state/cache/mode. Replaces the current "trusted clients / free table" model (rules enforced client-side only; `authorizeDraft` does minimal validation).

## Problem

Today the client computes low-level events (e.g. _play card_ → resource taps + a MOVE) and submits them; `submit_event`/`authorizeDraft` only blocks opponent-private-zone access + peeking. So turn ownership, costs, legality, and combat are enforced **client-side only** (assisted mode). A stale-cache or manual-mode client can act out of turn or illegally (confirmed live: `MOVE havreSac→monde` on the opponent's turn committed). Not robust, not standard.

## Architecture: intent-based, shared pure resolver

The client sends **high-level intents**; a single pure function validates + computes the authoritative events; `submit_event` runs it as the authority. The same function runs in the browser for local play and assisted-UX preview, so the rules live in **one place**.

```
resolveIntent(state: GameState, getCard: (id) => Card | null, intent: GameIntent, seat: Seat)
  → { events: DraftEvent[] } | { error: string }
```

Validation order: **turn ownership → action legality → cost → combat windows**. Reuses the existing pure rules (`whyCannotPlay`, `planCost`, `eligibleAttackers`/`eligibleTargets`, `whyCannotDeclareAttack`, `resolveCombat`, `victoryFromState`, `grantXpEvents`, `equalityRescueEvents`). Pure (no DOM/network) → Deno + browser. Lives in a new `src/game/actions/resolveIntent.ts` (+ submodules per intent family), built by **extracting** the logic currently in `gameStore` (`playFromHand`, `endTurn`, `moveTo`, combat flow).

### Components

**1. `GameIntent` (shared, `src/game/types/intents.ts`).** Discriminated union:

- `{ kind: "PLAY_CARD"; instanceId; position? }` — hand → Monde (cost + legality).
- `{ kind: "MOVE_CARD"; instanceId; to: ZoneRef; position? }` — board moves (Havre-Sac↔Monde, défausse, pioche, exil…).
- `{ kind: "TAP" | "UNTAP"; instanceId }`
- `{ kind: "SET_COUNTER" | "INC_COUNTER"; instanceId; counter; value/delta; token? }`
- `{ kind: "SET_LEVEL"; instanceId; face; level?; xp? }`
- `{ kind: "ATTACH" | "DETACH"; … }`
- `{ kind: "END_TURN" }`
- `{ kind: "DECLARE_ATTACK"; attackerIds; targets }` · `{ kind: "DECLARE_BLOCK"; blocks }` · `{ kind: "RESOLVE_COMBAT" }` (P3)
- `{ kind: "MULLIGAN" }` · `{ kind: "MULLIGAN_DONE" }` · `{ kind: "CONCEDE" }` · `{ kind: "CLAIM_VICTORY" }` (existing meta-intents folded in).

`actor`/`seat` is **never** in the intent payload — the server imposes it from the authenticated seat.

**2. `submit_event` = authority.** Body becomes `{ gameId, intent }`. Flow: auth → `me.seat`; game `active` + no `GAME_OVER`; `rowEvents` → `state = deriveState`; `loadCards` → `getCard`; `result = resolveIntent(state, getCard, intent, me.seat)`. On `error` → `json({ error }, 403)`. Else append each computed event via `append_event` (server RNG for any `SHUFFLE`) + per-seat redacted broadcast (the existing `appendOne` loop). The existing meta-intents (MULLIGAN expansion, CONCEDE/CLAIM_VICTORY → `finishGame`, server auto-victory) are absorbed into this path.

**3. Card data server-side.** New migration `cards` table: `id text primary key, data jsonb not null`. Seeded from the compiled `public/data/*.json` (a one-off seed script `scripts/seedCardsTable.ts`, or batched `insert … on conflict` via Management SQL). Edge helper `loadCards(db, cardIds: string[]) → Map<string, Card>` selects only the cards referenced by the game's two decks (`game_players.deck` → cardIds, ≤ ~100 distinct) → `getCard = (id) => map.get(id) ?? null`. No giant bundle. Re-seed when the card DB changes (tie to `compile-effects`).

**4. Combat in the journal (P3).** Combat is currently a client-only `gameStore.combat` ref. Move it into `GameState`: add `state.combat: CombatState | null` (attackers, blockers, targets, step, reactingSeat), derived from new events `COMBAT_DECLARE_ATTACK` / `COMBAT_DECLARE_BLOCK` / `COMBAT_RESOLVE` (or a single `SET_COMBAT` payload) folded by the reducer. `resolveIntent` handles the combat intents: validate (`whyCannotDeclareAttack`, `eligibleAttackers`, reaction window from `state.combat`) → emit combat events + the resulting damage `SET_COUNTER`/`MOVE` events via `resolveCombat`. This is what lets the server **adjudicate combat** and permit **legitimate out-of-turn reactions** (defender blocking during the attacker's turn — the server sees the open combat window).

**5. Client + local play.** `gameStore` action functions become thin intent-submitters online (`onlineTransport.submit(gameId, intent)`), and **local play calls the same `resolveIntent`** directly (no server) — unifying the two modes on one rules path. The client keeps the rules engine for **UX only** (highlighting legal moves, disabling controls); the authority is the server's broadcast echo. Optimistic application online is optional (apply `resolveIntent`'s events locally, reconcile on echo) — default to non-optimistic for correctness first.

## Data flow

Client builds an intent → `submit_event { gameId, intent }` → server: state + cards → `resolveIntent` → (error → 403 with reason) | (events → append + broadcast redacted) → both clients fold the echoed events. Local play: `gameStore` → `resolveIntent` → apply events directly.

## Error handling

`resolveIntent` returns a French reason string (reuses the rules' messages: "Ce n'est pas votre tour.", "PA insuffisants", "Le Havre-Sac est plein", etc.). `submit_event` surfaces it as 403; the client shows it via the existing `ruleError`/toast. Server-imposed actor means a client can't forge actions for the opponent. `append_event`'s `parentSeq` optimistic lock handles concurrency (stale → 409 → client re-pulls + retries).

## Rollout (phased; each shippable + tested)

- **P1 — Authority foundation.** `cards` table + seed + `loadCards`; `resolveIntent` skeleton covering the **non-combat** intents (PLAY_CARD, MOVE_CARD, TAP/UNTAP, SET/INC_COUNTER, SET_LEVEL, ATTACH/DETACH, END_TURN) with **turn + zone + cost + legality** validation; `submit_event` switches to the intent contract for these. Meta-intents (MULLIGAN\*/CONCEDE/CLAIM_VICTORY) folded in. → **out-of-turn + illegal plays rejected server-side (cache-proof). Fixes the reported bug properly.**
- **P2 — Client to intents.** `gameStore` (`playFromHand`, `moveTo`, `endTurn`, tap/counter/attach) submit intents online; local play routes through `resolveIntent`. `gameClient` send `{gameId, intent}`.
- **P3 — Combat in the journal.** `state.combat` + combat events + combat intents in `resolveIntent`; client combat flow → combat intents.
- **P4 — Cleanup.** Remove the legacy `draft` path from `submit_event`/`authority`; `authorizeDraft` retired in favor of `resolveIntent`. Confirm local + online share exactly one rules path.

**Breaking change:** once P2 lands, the new `submit_event` only accepts intents → both clients must run the new build (one cache-clear). During P1, submit_event can accept BOTH (legacy draft + new intent) to avoid mid-rollout breakage, then drop legacy in P4.

## Testing

- **Unit (`resolveIntent`):** turn rejection (non-active → error, no events); cost validation (insufficient PA → error); legal play → exact expected events; zone guards; per intent family. Pure → exhaustive + fast.
- **Engine:** combat events fold into `state.combat` correctly (P3); existing 749 tests stay green.
- **Live (2 accounts, cleanup):** out-of-turn `MOVE`/`PLAY` rejected **server-side** (verify even with a tampered/forced client call — the server 403s); illegal play rejected; legal play resolves; (P3) combat adjudicated + a legal block during the opponent's turn works.
- **Gate:** `vue-tsc`, full unit suite, `npx playwright`, build.

## Out of scope

Card-effect automation (the manual-effects model stays); spectators; AI. `resolveIntent` covers structural + cost + combat legality, not full automatic effect resolution (effects remain manual reminders, as today).
