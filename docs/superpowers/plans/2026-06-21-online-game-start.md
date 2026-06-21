# Online Game Start (slice B) Implementation Plan

> **For agentic workers:** implement task-by-task. Each task: write/adjust tests → run (fail) → implement → run (pass) → `npm run type-check` → commit. Steps use `- [ ]`.

**Goal:** Online games actually start — server deals a 6-card opening hand, each player independently keeps or mulligans, `matchPhase` derives from the journal, then play begins. Fixes Bug 2.

**Architecture:** New `MULLIGAN_DONE` journal event (per seat). `MULLIGAN` is a server-expanded meta-intent (recycle→shuffle→redraw→MULLIGAN_DONE). `matchPhase` (online) is derived from the journal so both clients + reconnection agree.

**Tech Stack:** TypeScript, Vitest, Vue 3/Pinia, Supabase Edge Functions (Deno), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-21-online-game-start-design.md`
**Branch:** `feat/online-game-start` (created; spec committed).

---

### Task 1: Engine — `MULLIGAN_DONE` event + recycle verb

**Files:** Modify `src/game/types/events.ts`, `src/game/engine/reducer.ts`, `src/game/engine/authority.ts`, `src/game/engine/verbs.ts`; Test `src/game/engine/__tests__/engine.spec.ts` + `authority.spec.ts`.

- [ ] **Step 1: events.ts** — add to the `EventType` union (after `"SAID"`): `| "MULLIGAN_DONE"`. Add payload interface near `SaidPayload`:

```ts
export interface MulliganDonePayload {
  seat: Seat;
}
```

(`Seat` is already imported.) Note: `"MULLIGAN"` is intentionally NOT an `EventType` — it is a meta-intent expanded by `submit_event`, never persisted.

- [ ] **Step 2: reducer.ts** — make `MULLIGAN_DONE` a state no-op by adding it to the passthrough guard (currently `if (ev.type === "UNDONE" || ev.type === "SAID")` at ~line 180):

```ts
if (ev.type === "UNDONE" || ev.type === "SAID" || ev.type === "MULLIGAN_DONE") {
  const passthrough = structuredClone(state);
  passthrough.seq = ev.seq;
  return passthrough;
}
```

- [ ] **Step 3: authority.ts** — (a) add `"MULLIGAN_DONE"` to the `ALLOWED_TYPES` set. (b) in `authorizeDraft`, after the `SHUFFLE` foreign-zone guard, add the own-seat guard:

```ts
if (draft.type === "MULLIGAN_DONE") {
  const p = draft.payload as { seat?: Seat };
  if (p.seat !== actor) {
    throw new EngineError("FORBIDDEN", { reason: "mulligan-foreign-seat" });
  }
}
```

`resolveDraft` needs no change (no RNG; passes through).

- [ ] **Step 4: verbs.ts** — add a recycle verb (hand→pioche top, face-down, identity hidden again):

```ts
/** Recycle une carte de la Main vers le sommet de la Pioche (face cachée). */
export function recycleToPiocheTop(
  seat: Seat,
  instanceId: InstanceId,
): DraftEvent<MovePayload> {
  return move(seat, {
    instanceId,
    from: { zone: "main", owner: seat },
    to: { zone: "pioche", owner: seat },
    position: top,
    visibility: { faceDown: true, visibleTo: "none" },
    preservesIdentity: false,
  });
}
```

Export it from `src/game/index.ts` (alongside `drawTop`).

- [ ] **Step 5: Tests** — in `engine.spec.ts` (reducer describe):

```ts
it("MULLIGAN_DONE est un no-op d'état (fold sans throw)", () => {
  const { events } = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" });
  const before = deriveState(events);
  const withDone = [
    ...events,
    {
      gameId: GID,
      seq: before.seq + 1,
      parentSeq: before.seq,
      actor: "A",
      type: "MULLIGAN_DONE",
      payload: { seat: "A" },
      ts: 0,
    } as PersistedEvent,
  ];
  resetDeriveMemo();
  const after = deriveState(withDone);
  expect(after.instances).toEqual(before.instances);
  expect(after.seq).toBe(before.seq + 1);
});
```

In `authority.spec.ts`:

```ts
it("authorizeDraft: MULLIGAN_DONE d'un autre siège est rejeté", () => {
  const state = deriveState(
    createGame("g", DECKS, { seedA: "a", seedB: "b" }).events,
  );
  expect(() =>
    authorizeDraft(state, {
      actor: "A",
      type: "MULLIGAN_DONE",
      payload: { seat: "B" },
    }),
  ).toThrow();
  expect(() =>
    authorizeDraft(state, {
      actor: "A",
      type: "MULLIGAN_DONE",
      payload: { seat: "A" },
    }),
  ).not.toThrow();
});
```

(Match the existing `DECKS`/`createGame` helpers in each spec file.)

- [ ] **Step 6:** `npx vitest run src/game/engine` green; `npm run type-check`; commit `feat(game): MULLIGAN_DONE event (no-op fold + own-seat auth) + recycleToPiocheTop verb`.

---

### Task 2: gameStore — `matchPhase` from the journal

**Files:** Modify `src/stores/gameStore.ts`; Test `src/stores/__tests__/gameStore.spec.ts`.

- [ ] **Step 1: Pure helper** — add near the top of the store (module scope or inside setup):

```ts
function deriveMatchPhase(evs: PersistedEvent[]): MatchPhase {
  if (!evs.some((e) => e.type === "GAME_STARTED")) return "lobby";
  const done = { A: false, B: false };
  for (const e of evs)
    if (e.type === "MULLIGAN_DONE")
      done[(e.payload as { seat: Seat }).seat] = true;
  return done.A && done.B ? "playing" : "mulligan";
}
```

- [ ] **Step 2:** `connectOnline` — replace `matchPhase.value = "playing";` with `matchPhase.value = deriveMatchPhase(events.value);` (events is [] at that point → "lobby"; the connect-time pull then drives it).

- [ ] **Step 3:** in `applyServerEvent`, after the contiguous append (`if (toAppend.length) events.value = [...]`), recompute phase when online:

```ts
if (online.value) matchPhase.value = deriveMatchPhase(events.value);
```

- [ ] **Step 4: Expose** a journal-derived done map for the UI: add to the store's returned object:

```ts
    mulliganDoneOnline: () => {
      const done = { A: false, B: false };
      for (const e of events.value)
        if (e.type === "MULLIGAN_DONE") done[(e.payload as { seat: Seat }).seat] = true;
      return done;
    },
```

- [ ] **Step 5: Tests** (`gameStore.spec.ts`, reuse the mock transport with `pull`):

```ts
describe("matchPhase en ligne (dérivé du journal)", () => {
  function gameStarted(seq = 1): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: "system",
      type: "GAME_STARTED",
      payload: {
        state: {
          instances: {},
          seats: { A: {}, B: {} },
          monde: [],
          turn: {},
          seq,
        },
      },
      ts: 0,
    } as unknown as RedactedEvent;
  }
  function done(seat: "A" | "B", seq: number): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: seat,
      type: "MULLIGAN_DONE",
      payload: { seat },
      ts: 0,
    } as RedactedEvent;
  }
  it("GAME_STARTED seul ⇒ mulligan ; les deux MULLIGAN_DONE ⇒ playing", () => {
    const store = useGameStore();
    const T = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
    };
    store.connectOnline("g", "A", T);
    store.applyServerEvent(gameStarted(1));
    expect(store.matchPhase).toBe("mulligan");
    store.applyServerEvent(done("A", 2));
    expect(store.matchPhase).toBe("mulligan");
    store.applyServerEvent(done("B", 3));
    expect(store.matchPhase).toBe("playing");
  });
});
```

> If `deriveState` rejects the minimal `gameStarted` payload, build it from `createGame(...)` events instead (import the engine helpers already used in the spec) — the assertion is about `matchPhase`, so use a real GAME_STARTED + two synthetic MULLIGAN_DONE events.

- [ ] **Step 6:** `npx vitest run src/stores` green; `npm run type-check`; commit `feat(play): derive online matchPhase from the journal (GAME_STARTED + MULLIGAN_DONE)`.

---

### Task 3: join_game — deal the opening hand

**Files:** Modify `supabase/functions/join_game/index.ts`.

- [ ] **Step 1:** After the setup loop appends `GAME_STARTED` + the `SHUFFLE`s (and `stateEvents` reflects them), deal 6 cards per seat. Import `drawTop` from the engine verbs (`../../../src/game/engine/verbs.ts`). Mirror the existing per-draft pattern (derive `pre` → `resolveDraft` → `append_event` (check error → 409) → push to `stateEvents` → `post = deriveState(stateEvents)` → per-seat private redacted broadcast):

```ts
const OPENING_HAND = 6; // = pa initial du héros (setup.ts), constant
for (const seat of ["A", "B"] as const) {
  for (let i = 0; i < OPENING_HAND; i++) {
    const pre = deriveState(stateEvents);
    const draft = drawTop(pre, seat); // MOVE pioche[0]→main visibleTo:[seat]
    const ev = resolveDraft(
      pre,
      { ...draft, actor: "system" },
      {
        gameId: game.id,
        seq: pre.seq + 1,
        ts: Date.now(),
        masterSeed: secret.master_seed,
      },
    );
    const { error: e2 } = await db.rpc("append_event", {
      p_game_id: game.id,
      p_parent_seq: pre.seq,
      p_actor: ev.actor,
      p_type: ev.type,
      p_payload: ev.payload,
      p_payload_private: ev.payloadPrivate ?? null,
    });
    if (e2) return json({ error: e2.message }, 409);
    stateEvents.push(ev);
    const post = deriveState(stateEvents);
    for (const s of ["A", "B"] as const) {
      await db
        .channel(`game:${game.id}:${s}`, { config: { private: true } })
        .send({
          type: "broadcast",
          event: "game_event",
          payload: redactEventForSeat(ev, s, pre, post),
        });
    }
  }
}
```

> Match the EXACT variable names already in `join_game` (`game`, `secret`, `stateEvents`, the `db` handle, and whether it already imports `resolveDraft`/`redactEventForSeat`/`deriveState`). Reuse them; only add the `drawTop` import + this loop. Keep `actor: "system"` so it bypasses `authorizeDraft` (setup deal).

- [ ] **Step 2:** `npm run type-check`; commit `feat(play): deal a 6-card opening hand per seat in join_game`. (Runtime validated live in Task 6.)

---

### Task 4: submit_event — `MULLIGAN` expansion + `MULLIGAN_DONE`

**Files:** Modify `supabase/functions/submit_event/index.ts`.

- [ ] **Step 1:** Import the engine verbs at top: `import { drawTop, recycleToPiocheTop } from "../../../src/game/engine/verbs.ts";`.

- [ ] **Step 2:** After resolving the caller's seat (`me.seat`) and loading `secret`/`rowEvents`/`state`, branch on the meta-intent BEFORE the normal `authorizeDraft`/`resolveDraft` path:

```ts
// Meta-intent MULLIGAN : recycle la main → mélange → repioche (n-1) → MULLIGAN_DONE.
// Expansé côté serveur (RNG autoritatif), comme la mise en place de join_game.
if (draft?.type === "MULLIGAN") {
  const seat = me.seat as "A" | "B";
  const already = rowEvents.some(
    (e) =>
      e.type === "MULLIGAN_DONE" &&
      (e.payload as { seat?: string }).seat === seat,
  );
  if (already) return json({ error: "MULLIGAN_DEJA_FAIT" }, 409);

  let working = rowEvents.slice();
  let cur = deriveState(working);
  const hand = [...cur.seats[seat].main];

  const appendOne = async (d: {
    actor: "A" | "B" | "system";
    type: string;
    payload: unknown;
    payloadPrivate?: unknown;
  }) => {
    const pre = deriveState(working);
    const ev = resolveDraft(pre, d as never, {
      gameId,
      seq: pre.seq + 1,
      ts: Date.now(),
      masterSeed: secret!.master_seed,
    });
    const { error } = await db.rpc("append_event", {
      p_game_id: gameId,
      p_parent_seq: pre.seq,
      p_actor: ev.actor,
      p_type: ev.type,
      p_payload: ev.payload,
      p_payload_private: ev.payloadPrivate ?? null,
    });
    if (error) throw new Error(error.message);
    working = [...working, ev];
    const post = deriveState(working);
    for (const s of ["A", "B"] as const) {
      await db
        .channel(`game:${gameId}:${s}`, { config: { private: true } })
        .send({
          type: "broadcast",
          event: "game_event",
          payload: redactEventForSeat(ev, s, pre, post),
        });
    }
  };

  try {
    for (const id of hand) await appendOne(recycleToPiocheTop(seat, id));
    await appendOne({
      actor: seat,
      type: "SHUFFLE",
      payload: { zone: { zone: "pioche", owner: seat }, permutation: [] },
    });
    const redraw = Math.max(0, hand.length - 1);
    for (let i = 0; i < redraw; i++) {
      const pre = deriveState(working);
      await appendOne(drawTop(pre, seat));
    }
    await appendOne({ actor: seat, type: "MULLIGAN_DONE", payload: { seat } });
  } catch (e) {
    return json({ error: String(e) }, 409); // partiel : le client resync (slice A)
  }
  return json({ ok: true });
}
```

> Adapt to the file's actual identifiers (`db`, `secret`, `rowEvents`, `gameId`, `state`, the `resolveDraft`/`redactEventForSeat`/`deriveState` imports already present). The normal path below (for `MULLIGAN_DONE` keep + all other drafts) is unchanged — `MULLIGAN_DONE` now passes `authorizeDraft` (own-seat check from Task 1) and `resolveDraft` (no RNG) and folds as a no-op.

- [ ] **Step 3:** `npm run type-check`; commit `feat(play): submit_event handles MULLIGAN (server-expanded) + MULLIGAN_DONE`. (Validated live in Task 6.)

---

### Task 5: PlayTableView — online mulligan UI

**Files:** Modify `src/views/PlayTableView.vue`; possibly `src/services/gameClient.ts` (a `mulligan` helper).

- [ ] **Step 1: Client helper** — in `gameClient.ts`, a thin wrapper for the meta-intent:

```ts
/** Demande un mulligan (le serveur recycle/mélange/repioche puis marque le siège prêt). */
export async function requestMulligan(gameId: string): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft: { type: "MULLIGAN" } },
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Handlers** — in `PlayTableView.vue` script:

```ts
async function onlineKeep() {
  await submitEvent(store.gameId, {
    actor: store.perspective,
    type: "MULLIGAN_DONE",
    payload: { seat: store.perspective },
  } as unknown as DraftEvent);
}
async function onlineMulligan() {
  await requestMulligan(store.gameId);
}
const myMulliganDone = computed(
  () => store.online && store.mulliganDoneOnline()[store.perspective],
);
const oppMulliganDone = computed(
  () =>
    store.online &&
    store.mulliganDoneOnline()[store.perspective === "A" ? "B" : "A"],
);
```

(import `requestMulligan` from `@/services/gameClient`; `submitEvent`, `DraftEvent`, `store.gameId` are available — expose `gameId` on the store if not already a public getter.)

- [ ] **Step 3: Template** — extend the mulligan overlay (`v-if` currently `!store.passPending && store.matchPhase === 'mulligan'`) with an online branch:

  - When `store.online && store.matchPhase === 'mulligan'`:
    - if `!myMulliganDone` → show **Garder** (`@click="onlineKeep"`) + **Mulligan** (`@click="onlineMulligan"`) acting on the player's own hand.
    - else → "En attente de l'adversaire (mulligan)…".
  - The existing local pass-the-device branch (`!store.online`) is unchanged.

- [ ] **Step 4:** `npm run type-check`; `npx vitest run` (no regressions); commit `feat(play): online mulligan overlay (independent keep/mulligan per seat)`.

---

### Task 6: Deploy + live integration test + cleanup (operator)

- [ ] **Step 1:** Full gate — `npm run type-check`, `npx vitest run`, `npm run build`, `npx playwright test --workers=1`. Green.
- [ ] **Step 2:** Deploy `join_game` + `submit_event` via the GitHub-released Supabase CLI binary (`$env:SUPABASE_ACCESS_TOKEN`, `--project-ref ehqalhzvmgkepgbaxbzu`).
- [ ] **Step 3:** Merge `feat/online-game-start` → `master` (`--no-ff`), type-check, push → Vercel.
- [ ] **Step 4:** Live (2 throwaway accounts, real JWTs; clean up after). Create+join → assert via `pull_events` + the real store in the preview:
  - both seats have **6** cards in `main`, `matchPhase === 'mulligan'`;
  - A `onlineKeep` → A done, still `mulligan`; B `onlineMulligan` → B's hand size 5, both done → `matchPhase === 'playing'`;
  - throughout, A's pulled journal has **0** of B's cardIds (incl. B's recycled/redrawn cards), and vice-versa;
  - reconnect mid-mulligan (one done) → resumes `mulligan` + overlay; reconnect after both → `playing`.
- [ ] **Step 5:** Clean up games + accounts via Management SQL; verify 0 remaining.
- [ ] **Step 6:** Update memory (`online-play-enablement.md`): slice B shipped, Bug 2 fixed, online play fully functional.

---

## Self-Review

**Spec coverage:** opening hand → Task 3; `MULLIGAN_DONE` type/reducer/auth → Task 1; `MULLIGAN` expansion → Task 4; `matchPhase` from journal → Task 2; online UI → Task 5; deploy/live → Task 6. All mapped.

**Placeholder scan:** code in every code step; adaptation notes point at concrete existing identifiers, not "TBD".

**Type consistency:** `MULLIGAN_DONE` + `MulliganDonePayload {seat}` (Task 1) used identically in reducer, authority, store `deriveMatchPhase`/`mulliganDoneOnline` (Task 2), submit_event (Task 4), UI (Task 5). `recycleToPiocheTop(seat, instanceId)` defined Task 1, used Task 4. `requestMulligan(gameId)` defined Task 5. `deriveMatchPhase(evs): MatchPhase` consistent. `OPENING_HAND = 6` matches `setup.ts` `pa: 6`.
