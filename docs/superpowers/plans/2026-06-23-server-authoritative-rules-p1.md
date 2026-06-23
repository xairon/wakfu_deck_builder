# Server-Authoritative Rules — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Reject out-of-turn + illegal moves **server-side** (cache-proof), and lay the intent-based foundation: a `cards` Postgres table + server `getCard`, a pure `resolveIntent` for non-combat intents, and `submit_event` running it as the authority (accepting BOTH the legacy `draft` and the new `intent` during rollout).

**Architecture:** Pure `resolveIntent(state, getCard, intent, seat)` validates turn→legality→cost and emits authoritative `DraftEvent[]`, reusing the existing pure rules (`whyCannotPlay`, `planCost`, verbs). `submit_event` resolves it server-side. An **interim turn guard** on the legacy `authorizeDraft` path fixes the live out-of-turn bug immediately (the client still sends drafts until Phase 2).

**Tech Stack:** TypeScript, Vitest, Supabase Edge Functions (Deno), Postgres. `npm run type-check` (vue-tsc) is the only type gate; Edge Functions are Deno (engine imports use explicit `.ts`; validated at deploy). Spec: `docs/superpowers/specs/2026-06-23-server-authoritative-rules-design.md`. Branch: `feat/server-authoritative-rules`.

## File structure

- `src/game/engine/authority.ts` — add interim turn guard to `authorizeDraft` (Task 1).
- `supabase/migrations/0008_cards.sql` — `cards` table (Task 2).
- `scripts/seedCardsTable.ts` — seed `cards` from `public/data/*.json` (Task 2).
- `supabase/functions/_shared/cards.ts` — `loadCards(db, ids)` → `Map` (Task 3).
- `src/game/types/intents.ts` — `GameIntent` union (Task 4).
- `src/game/actions/resolveIntent.ts` — pure resolver, non-combat intents (Task 5).
- `src/game/actions/__tests__/resolveIntent.spec.ts` — unit tests (Task 5).
- `supabase/functions/submit_event/index.ts` — dual contract (`intent` | legacy `draft`) (Task 6).

---

### Task 1: Interim turn guard on the legacy path (immediate bug fix)

**Files:** Modify `src/game/engine/authority.ts` (in `authorizeDraft`); Test `src/game/engine/__tests__/authority.spec.ts`.

The live bug: a non-active player's `MOVE`/`SET_*` draft is accepted (no turn check). Reject player gameplay drafts whose actor ≠ `state.turn.active`. State-only, cache-proof. (Combat reactions are out of scope until Phase 3 / combat-in-journal; the online flow does not yet rely on out-of-turn combat drafts.)

- [ ] **Step 1: Failing test** in `authority.spec.ts`:

```ts
it("authorizeDraft: une action de jeu HORS de son tour est rejetée", () => {
  const state = deriveState(
    createGame("g", DECKS, { seedA: "a", seedB: "b" }).events,
  );
  // turn.active is firstPlayer "A" by default in createGame
  const someId = Object.keys(state.instances)[0];
  expect(() =>
    authorizeDraft(state, {
      actor: "B",
      type: "SET_ORIENTATION",
      payload: { instanceId: someId, orientation: "tapped" },
    }),
  ).toThrow();
  expect(() =>
    authorizeDraft(state, {
      actor: "A",
      type: "SET_ORIENTATION",
      payload: { instanceId: someId, orientation: "tapped" },
    }),
  ).not.toThrow();
});
```

> Verify `createGame`'s default `firstPlayer`/`turn.active` in the existing helper; if not "A", set `opts.firstPlayer:"A"`.

- [ ] **Step 2:** Run `npx vitest run src/game/engine/__tests__/authority.spec.ts` → FAIL.

- [ ] **Step 3:** In `authorizeDraft`, after the existing `assertActor` + `actor === "system"` early-return and the `MULLIGAN_DONE` guard, add:

```ts
// Garde de tour (P1, interim) : une action de JEU ne peut venir que du joueur
// actif. Les types structurels/méta (mulligan, concession) ont leurs propres
// gardes ; le combat hors-tour viendra avec le combat-au-journal (Phase 3).
const TURN_BOUND = new Set<EventType>([
  "MOVE",
  "SHUFFLE",
  "SET_ORIENTATION",
  "SET_LEVEL",
  "SET_COUNTER",
  "INC_COUNTER",
  "ATTACH",
  "DETACH",
]);
if (TURN_BOUND.has(draft.type) && state.turn.active !== actor) {
  throw new EngineError("NOT_YOUR_TURN", { active: state.turn.active, actor });
}
```

(`EventType` is already imported; `actor` is the `Seat` resolved above.)

- [ ] **Step 4:** Run the test → PASS. Then `npx vitest run src/game/engine` (full engine suite) → all green (the existing engine tests use the active player's seat or `system`; confirm none break — if a test moves as the non-active seat during a game, adjust it to use the active seat).

- [ ] **Step 5:** `npm run type-check`; commit `fix(game): authorizeDraft rejects out-of-turn gameplay drafts (server turn guard)`.

---

### Task 2: `cards` table + seed script

**Files:** Create `supabase/migrations/0008_cards.sql`, `scripts/seedCardsTable.ts`.

- [ ] **Step 1:** Migration `0008_cards.sql`:

```sql
-- Données de cartes accessibles côté serveur (Edge Functions) pour la
-- validation autoritative des règles (coûts, types). Lecture seule.
create table if not exists public.cards (
  id text primary key,
  data jsonb not null
);
alter table public.cards enable row level security;
-- Lisible par tout utilisateur authentifié (données publiques) ; écrites via
-- service_role uniquement (le seed).
drop policy if exists "cards_read" on public.cards;
create policy "cards_read" on public.cards for select to authenticated using (true);
```

- [ ] **Step 2:** `scripts/seedCardsTable.ts` — reads every `public/data/*.json`, flattens to `{id, data}` rows, upserts in batches via the service-role client (env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

```ts
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key);
const dir = "public/data";
const cards = new Map<string, unknown>();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const json = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const list = Array.isArray(json) ? json : (json.cards ?? []);
  for (const c of list) if (c?.id) cards.set(c.id, c);
}
const rows = [...cards].map(([id, data]) => ({ id, data }));
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from("cards").upsert(rows.slice(i, i + 500));
  if (error) throw error;
}
console.log(`seeded ${rows.length} cards`);
```

> Adapt the per-file shape to the actual `public/data/*.json` structure (inspect one file first: array vs `{cards:[…]}`). The operator runs this once at deploy (Task 7), it is not type-checked into the app.

- [ ] **Step 3:** `npm run type-check` (the script is standalone; ensure it doesn't break the build). Commit `feat(game): cards table + seed script for server-side card data`.

---

### Task 3: `loadCards` Edge helper

**Files:** Create `supabase/functions/_shared/cards.ts`.

- [ ] **Step 1:**

```ts
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Card } from "../../../src/game/types/cards.ts";

/** Charge les cartes référencées (par id) en une Map id→Card pour getCard. */
export async function loadCards(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, Card>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Card>();
  for (let i = 0; i < uniq.length; i += 500) {
    const { data, error } = await db
      .from("cards")
      .select("id, data")
      .in("id", uniq.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(r.id as string, r.data as Card);
  }
  return map;
}
```

> Confirm `Card` is exported from `src/game/types/cards.ts` and that the `.ts` Deno import resolves (it's a type import → elided; safe).

- [ ] **Step 2:** `npm run type-check`. Commit `feat(play): loadCards Edge helper (server getCard from cards table)`.

---

### Task 4: `GameIntent` type

**Files:** Create `src/game/types/intents.ts`; export from `src/game/types/index.ts` + `src/game/index.ts`.

- [ ] **Step 1:**

```ts
import type { InstanceId, Position } from "./events";
import type { ZoneRef } from "./zones";

/** Intentions de jeu de HAUT NIVEAU (le serveur les valide + les résout en
 *  events autoritatifs). L'acteur est imposé serveur, jamais dans le payload. */
export type GameIntent =
  | { kind: "PLAY_CARD"; instanceId: InstanceId; position?: Position }
  | {
      kind: "MOVE_CARD";
      instanceId: InstanceId;
      to: ZoneRef;
      position?: Position;
    }
  | { kind: "TAP"; instanceId: InstanceId }
  | { kind: "UNTAP"; instanceId: InstanceId }
  | {
      kind: "SET_COUNTER";
      instanceId: InstanceId;
      counter: string;
      value: number;
      token?: boolean;
    }
  | {
      kind: "INC_COUNTER";
      instanceId: InstanceId;
      counter: string;
      delta: number;
      token?: boolean;
    }
  | {
      kind: "SET_LEVEL";
      instanceId: InstanceId;
      face: "recto" | "verso";
      level?: number;
      xp?: number;
    }
  | { kind: "ATTACH"; equipmentId: InstanceId; bearerId: InstanceId }
  | { kind: "DETACH"; equipmentId: InstanceId; to: ZoneRef; position: Position }
  | { kind: "END_TURN" };
```

- [ ] **Step 2:** add `export type { GameIntent } from "./intents";` to `src/game/types/index.ts` and re-export via `src/game/index.ts`. `npm run type-check`. Commit `feat(game): GameIntent intent protocol type (non-combat)`.

---

### Task 5: pure `resolveIntent` (non-combat)

**Files:** Create `src/game/actions/resolveIntent.ts`, `src/game/actions/__tests__/resolveIntent.spec.ts`; export from `src/game/index.ts`.

Reuses verbs (`move`, `drawTop`, `playToWorld`, `tap`, `untap`, `setCounter`, `incCounter`, `flipLevel`, `attach`, `detach`, `worldHavenSwap`) + rules (`whyCannotPlay`, `planCost`, `paOf`-equivalent). Builds a `RulesCtx = { state, getCard }`.

- [ ] **Step 1:** Inspect the verbs' exact signatures (`src/game/engine/verbs.ts`) + `whyCannotPlay`/`planCost` (`src/game/rules/legality.ts`, `resources.ts`) + `RulesCtx` (`src/game/rules/types.ts`). Note `playFromHand` in `gameStore.ts:940` is the reference for PLAY_CARD (whyCannotPlay → planCost → resource taps + `playToWorld`); `endTurn`/`nextTurn` (gameStore) is the reference for END_TURN (draw to PA + `setPhase` + redress + remove damage).

- [ ] **Step 2: Failing tests** (`resolveIntent.spec.ts`) — reuse the deck/createGame helpers from `engine.spec.ts`. Drive a game to `playing` via `createGame` + a `setPhase`/state with `turn.active="A"`. Cover:

```ts
it("PLAY_CARD hors tour → erreur, aucun event", () => {
  const { state, getCard } = playingState(/* active A */);
  const bHandCard = state.seats.B.main[0];
  const r = resolveIntent(
    state,
    getCard,
    { kind: "PLAY_CARD", instanceId: bHandCard },
    "B",
  );
  expect("error" in r && r.error).toContain("tour");
});
it("MOVE_CARD hors tour → erreur", () => {
  const { state, getCard } = playingState();
  const bCard = state.seats.B.havreSac[0];
  const r = resolveIntent(
    state,
    getCard,
    { kind: "MOVE_CARD", instanceId: bCard, to: { zone: "monde" } },
    "B",
  );
  expect("error" in r).toBe(true);
});
it("END_TURN par le joueur actif → events (setPhase + pioche)", () => {
  const { state, getCard } = playingState(); // active A
  const r = resolveIntent(state, getCard, { kind: "END_TURN" }, "A");
  expect("events" in r && r.events.some((e) => e.type === "SET_PHASE")).toBe(
    true,
  );
});
```

> Provide a `playingState()` helper in the spec that returns `{ state, getCard }` with `turn.active="A"` and both hands populated (build from `createGame` + `drawTop` events, `getCard` from the mock deck factory cards).

- [ ] **Step 3:** Run → FAIL (resolveIntent undefined).

- [ ] **Step 4: Implement** `resolveIntent.ts`:

```ts
import type { GameState } from "../types/state";
import type { Card } from "../types/cards";
import type { GameIntent } from "../types/intents";
import type { DraftEvent } from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import {
  move,
  drawTop,
  playToWorld,
  tap,
  untap,
  setCounter,
  incCounter,
  flipLevel,
  attach,
  detach,
  worldHavenSwap,
  setPhase,
} from "../engine/verbs";
import { whyCannotPlay } from "../rules/legality";
import { planCost } from "../rules/resources";
import type { RulesCtx } from "../rules/types";

export type IntentResult = { events: DraftEvent[] } | { error: string };
const TURN_BOUND = new Set<GameIntent["kind"]>([
  "PLAY_CARD",
  "MOVE_CARD",
  "TAP",
  "UNTAP",
  "SET_COUNTER",
  "INC_COUNTER",
  "SET_LEVEL",
  "ATTACH",
  "DETACH",
  "END_TURN",
]);

export function resolveIntent(
  state: GameState,
  getCard: (id: string | null) => Card | null,
  intent: GameIntent,
  seat: Seat,
): IntentResult {
  const ctx: RulesCtx = { state, getCard } as RulesCtx;
  // Garde de tour (toutes les intentions de P1 sont liées au tour).
  if (TURN_BOUND.has(intent.kind) && state.turn.active !== seat) {
    return { error: "Ce n'est pas votre tour." };
  }
  switch (intent.kind) {
    case "PLAY_CARD": {
      const reason = whyCannotPlay(ctx, seat, intent.instanceId, false);
      if (reason) return { error: reason };
      const inst = state.instances[intent.instanceId];
      const card = getCard(inst?.cardId ?? null);
      if (!inst || !card) return { error: "Carte inconnue." };
      const plan = planCost(ctx, seat, card);
      if (!plan.ok) return { error: plan.reason };
      const events: DraftEvent[] = plan.producers.map((id) => tap(seat, id));
      events.push(playToWorld(seat, intent.instanceId, intent.position));
      return { events };
    }
    case "MOVE_CARD": {
      const inst = state.instances[intent.instanceId];
      if (!inst) return { error: "Carte inconnue." };
      // Monde↔Havre-Sac conserve l'identité (worldHavenSwap), sinon move brut.
      const z = inst.location.zone,
        to = intent.to.zone;
      if (
        (z === "monde" && to === "havreSac") ||
        (z === "havreSac" && to === "monde")
      )
        return { events: [worldHavenSwap(seat, intent.instanceId, z)] };
      return {
        events: [
          move(seat, {
            instanceId: intent.instanceId,
            from: inst.location,
            to: intent.to,
            position: intent.position ?? { at: "any" },
            visibility: {
              faceDown: intent.to.zone === "pioche",
              visibleTo: intent.to.zone === "pioche" ? "none" : "all",
            },
            preservesIdentity: false,
          }),
        ],
      };
    }
    case "TAP":
      return { events: [tap(seat, intent.instanceId)] };
    case "UNTAP":
      return { events: [untap(seat, intent.instanceId)] };
    case "SET_COUNTER":
      return {
        events: [
          setCounter(
            seat,
            intent.instanceId,
            intent.counter,
            intent.value,
            intent.token,
          ),
        ],
      };
    case "INC_COUNTER":
      return {
        events: [
          incCounter(
            seat,
            intent.instanceId,
            intent.counter,
            intent.delta,
            intent.token,
          ),
        ],
      };
    case "SET_LEVEL":
      return {
        events: [
          flipLevel(
            seat,
            intent.instanceId,
            intent.face,
            intent.level,
            intent.xp,
          ),
        ],
      };
    case "ATTACH":
      return { events: [attach(seat, intent.equipmentId, intent.bearerId)] };
    case "DETACH":
      return {
        events: [detach(seat, intent.equipmentId, intent.to, intent.position)],
      };
    case "END_TURN": {
      const active = seat;
      const need =
        (state.seats[active].heroInstanceId
          ? (state.instances[state.seats[active].heroInstanceId!]?.counters
              .pa ?? 6)
          : 6) - state.seats[active].main.length;
      const events: DraftEvent[] = [];
      for (let i = 0; i < Math.max(0, need); i++) {
        // chaque draw lit l'état COURANT ; en pratique le serveur résout chaque
        // event puis re-dérive, donc on émet des drawTop dépendants — voir note.
        events.push(drawTop(state, active)); // NOTE: voir Step 4b
      }
      const next = otherSeat(active);
      events.push(
        setPhase(next, {
          active: next,
          number: state.turn.number + 1,
          phase: "principale",
          firstPlayer: state.turn.firstPlayer,
        }),
      );
      return { events };
    }
  }
}
```

- [ ] **Step 4b (END_TURN draw correctness):** `drawTop(state, …)` reads `state.seats[seat].pioche[0]`; emitting N of them from the SAME pre-state would all reference the same top card. Fix: in `resolveIntent`, fold each emitted event into a working copy to compute the next `drawTop`, OR (simpler + matches `submit_event`'s existing per-event resolve loop) return a marker so `submit_event` re-derives between draws. **Decision:** END_TURN returns the `setPhase` + a count `draws: need`; `submit_event` performs `need` sequential `drawTop` re-deriving between each (it already does this for the MULLIGAN redraw). So change END_TURN's return to `{ events: [setPhase…], draws: need }` and widen `IntentResult` to `{ events; draws? }`. Update the END_TURN test to assert `draws` + the setPhase.

- [ ] **Step 5:** Run the tests → PASS. Verify the verb signatures match (adjust calls to the real signatures from Step 1). `npx vitest run src/game/actions` green.

- [ ] **Step 6:** Export `resolveIntent` + `IntentResult` from `src/game/index.ts`. `npm run type-check`. Commit `feat(game): pure resolveIntent for non-combat intents (turn+legality+cost)`.

---

### Task 6: `submit_event` dual contract (intent | legacy draft)

**Files:** Modify `supabase/functions/submit_event/index.ts`.

- [ ] **Step 1:** Import `resolveIntent` from `../../../src/game/actions/resolveIntent.ts`, `loadCards` from `../_shared/cards.ts`. Read both `{ gameId, draft, intent }` from the body.

- [ ] **Step 2:** Keep the existing meta-intent branches (MULLIGAN/CONCEDE/CLAIM_VICTORY) and the `GAME_OVER` guard. Then:

```ts
if (intent) {
  // Charger les cartes des deux decks pour getCard (coûts/types).
  const { data: players } = await db
    .from("game_players")
    .select("deck")
    .eq("game_id", gameId);
  const ids = (players ?? []).flatMap((p) => deckCardIds(p.deck));
  const cardMap = await loadCards(db, ids);
  const getCard = (id: string | null) =>
    id ? (cardMap.get(id) ?? null) : null;
  const res = resolveIntent(state, getCard, intent, me.seat);
  if ("error" in res) return json({ error: res.error }, 403);
  // Appliquer les events (+ d'éventuels draws END_TURN re-dérivés), comme la
  // boucle MULLIGAN : resolveDraft (RNG serveur pour SHUFFLE) → append → broadcast.
  let working = rowEvents.slice();
  for (const d of res.events) await appendOne(d /* working ref */);
  if (res.draws)
    for (let i = 0; i < res.draws; i++)
      await appendOne(drawTop(deriveState(working), me.seat));
  return json({ ok: true });
}
```

> Reuse/extract the existing `appendOne(draft)` helper (from the MULLIGAN branch) so it threads `working`/broadcasts. `deckCardIds(deck)` = small local helper: collect `deck.hero.id`, `deck.havreSac.id`, and each `deck.cards[].card.id`.

- [ ] **Step 3:** The legacy `draft` path stays unchanged below (now with the Task-1 turn guard in `authorizeDraft`). `npm run type-check`. Commit `feat(play): submit_event accepts intents (resolveIntent authority) alongside legacy drafts`.

---

### Task 7: Deploy + live test + cleanup (operator)

- [ ] **Step 1:** Gate — `npm run type-check`, `npx vitest run`, `npm run build`.
- [ ] **Step 2:** Apply `0008_cards.sql` via Management SQL; run `scripts/seedCardsTable.ts` (needs `SUPABASE_SERVICE_ROLE_KEY` — NOT available to the agent; the **user** runs the seed, OR seed via Management SQL batched inserts from the JSON). Verify `select count(*) from cards`.
- [ ] **Step 3:** Deploy `submit_event` via the GitHub CLI binary.
- [ ] **Step 4:** Merge `feat/server-authoritative-rules` → master → push (Vercel).
- [ ] **Step 5:** Live (2 accounts, cleanup): the **legacy turn guard** rejects an out-of-turn `MOVE`/`SET_ORIENTATION` (force a `submit_event` with the non-active seat → 403 `NOT_YOUR_TURN`); a new `intent` PLAY_CARD by the active player resolves; an out-of-turn intent → 403. Clean up.
- [ ] **Step 6:** Update memory.

---

## Self-review

**Spec coverage:** cards table+seed (T2) + loadCards (T3); resolveIntent non-combat (T5); submit_event authority + dual contract (T6); interim turn guard fixes the bug now (T1, the spec's P1 "out-of-turn rejected server-side"); meta-intents stay folded in submit_event (T6 keeps existing branches). Combat (P3), client→intents (P2), cleanup (P4) are out of this plan by design.
**Placeholders:** seed-file shape + verb signatures flagged for inspection in T2/T5 Step 1 (concrete adaptation, not TBD). The card-DB seed needs the service-role key — explicitly assigned to the operator (T7).
**Type consistency:** `resolveIntent(state, getCard, intent, seat) → IntentResult ({events} | {error} | {events,draws})` consistent across T5/T6; `GameIntent` (T4) used in T5/T6; `loadCards` (T3) used in T6; `cards` table (T2) read by T3.
**Open risk (flagged):** the interim turn guard (T1) blocks non-active combat drafts on the legacy path — acceptable since combat-online is not yet a verified flow and Phase 3 moves combat into the journal with proper reaction windows.
