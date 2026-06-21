# Online Reliability (slice A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make online delivery reliable — a client always rebuilds its per-seat redacted journal by pulling, so a missed/late/out-of-order broadcast, the join-time race, or a refresh never leaves a player stuck or desynced.

**Architecture:** A `pull_events` Edge Function returns the caller's redacted journal after a seq; the client applies events **contiguously by seq** (buffering out-of-order ones and pulling to fill gaps), pulls the full journal on connect, and reconnects to an active game on mount.

**Tech Stack:** TypeScript, Vitest, Vue 3/Pinia, Supabase (Edge Functions/Deno, Realtime), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-21-online-reliability-design.md`
**Branch:** `feat/online-reliability` (created; spec committed).

---

### Task 1: Order-aware delivery + resync in gameStore

**Files:**

- Modify: `src/stores/gameStore.ts` (OnlineTransport interface, `applyServerEvent`, new `resyncFrom`, `pending`/`pulling`, connect/disconnect)
- Test: `src/stores/__tests__/gameStore.spec.ts`

- [ ] **Step 1: Add `pull` to the `OnlineTransport` interface** (`gameStore.ts`, the `export interface OnlineTransport` block):

```ts
export interface OnlineTransport {
  submit(gameId: string, draft: DraftEvent): Promise<{ seq: number }>;
  subscribe(
    gameId: string,
    seat: Seat,
    onEvent: (ev: RedactedEvent) => void,
  ): () => void;
  pull(gameId: string, sinceSeq: number): Promise<RedactedEvent[]>;
}
```

- [ ] **Step 2: Write the failing test** — add to `src/stores/__tests__/gameStore.spec.ts` (a mock transport whose `pull` returns a captured contiguous journal):

```ts
import type { RedactedEvent } from "@/game";

function ev(seq: number, reveals?: Record<string, string>): RedactedEvent {
  return {
    gameId: "g",
    seq,
    parentSeq: seq - 1,
    actor: "A",
    type: "SAID",
    payload: { text: String(seq) },
    ts: 0,
    ...(reveals ? { reveals } : {}),
  } as RedactedEvent;
}

describe("applyServerEvent — ordre & resync", () => {
  it("applique en ordre, dédoublonne, et tient le journal contigu", () => {
    const store = useGameStore();
    const journal = [ev(1), ev(2), ev(3)];
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
    };
    store.connectOnline("g", "A", transport);
    store.applyServerEvent(journal[0]);
    store.applyServerEvent(journal[1]);
    store.applyServerEvent(journal[1]); // doublon ignoré
    store.applyServerEvent(journal[2]);
    expect(store.onlineJournalSeqs()).toEqual([1, 2, 3]);
  });

  it("met en tampon le hors-ordre et PULL pour combler le trou", async () => {
    const store = useGameStore();
    const full = [ev(1), ev(2), ev(3)];
    let pullArgs: number | null = null;
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async (_g: string, since: number) => {
        pullArgs = since;
        return full.slice(since);
      },
    };
    store.connectOnline("g", "A", transport);
    store.applyServerEvent(ev(3)); // trou : on n'a pas 1,2 → tampon + pull(0)
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(pullArgs).toBe(0);
    expect(store.onlineJournalSeqs()).toEqual([1, 2, 3]);
  });
});
```

> Note: `connectOnline` will call `resyncFrom(0)` (Step 3) → the mock `pull` returns `[]` in test 1 (no-op) and the full journal in test 2. Expose a tiny test helper `onlineJournalSeqs: () => events.value.map((e) => e.seq)` on the store's returned object.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts -t "ordre"`
Expected: FAIL (`onlineJournalSeqs is not a function` / out-of-order not handled).

- [ ] **Step 4: Implement** in `gameStore.ts`. Add state near `onlineUnsub` (after line ~121):

```ts
const pending = new Map<number, RedactedEvent>();
let pulling = false;
```

Replace `applyServerEvent` with the order-aware version and add `resyncFrom`:

```ts
function lastSeq(): number {
  return events.value.length ? events.value[events.value.length - 1].seq : 0;
}

/** Applique un event diffusé/pullé : contigu par seq, hors-ordre mis en tampon. */
function applyServerEvent(ev: RedactedEvent): void {
  if (ev.reveals) revealed.value = { ...revealed.value, ...ev.reveals }; // monotone
  if (ev.seq <= lastSeq()) return; // doublon / déjà appliqué
  pending.set(ev.seq, ev);
  let next = lastSeq() + 1;
  const toAppend: RedactedEvent[] = [];
  while (pending.has(next)) {
    toAppend.push(pending.get(next)!);
    pending.delete(next);
    next++;
  }
  if (toAppend.length) events.value = [...events.value, ...toAppend];
  if (pending.size && !pulling) void resyncFrom(lastSeq()); // trou → combler
}

/** Retire le journal redacté depuis `sinceSeq` et l'applique (combler trous / connexion). */
async function resyncFrom(sinceSeq: number): Promise<void> {
  if (!onlineTransport?.pull || pulling) return;
  pulling = true;
  try {
    const evs = await onlineTransport.pull(gameId.value, sinceSeq);
    pulling = false;
    for (const e of evs) applyServerEvent(e);
  } catch (e) {
    ruleError.value = `Resync : ${String(e)}`;
  } finally {
    pulling = false;
  }
}
```

In `connectOnline` (after `onlineUnsub = transport.subscribe(id, seat, applyServerEvent);`) add the connect-time backfill and reset:

```ts
pending.clear();
pulling = false;
onlineUnsub = transport.subscribe(id, seat, applyServerEvent);
void resyncFrom(0); // rattrape tout event émis avant que l'abonnement soit vivant
```

In `disconnectOnline` add `pending.clear(); pulling = false;` next to `events.value = []`.

Expose on the store's returned object: `onlineJournalSeqs: () => events.value.map((e) => e.seq),`.

- [ ] **Step 5: Run to verify it passes + full store suite**

Run: `npx vitest run src/stores/__tests__/gameStore.spec.ts`
Expected: PASS (new + existing).

- [ ] **Step 6: Type-check + commit**

```bash
npm run type-check
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.spec.ts
git commit -m "feat(play): order-aware applyServerEvent + pull-based resync (no more lost/late events)"
```

---

### Task 2: `pull_events` Edge Function + client transport

**Files:**

- Create: `supabase/functions/pull_events/index.ts`
- Modify: `src/services/gameClient.ts` (`pullEvents`, `findMyActiveGame`)
- Modify: `src/views/PlayTableView.vue` (`onlineTransport` gains `pull`)

- [ ] **Step 1: Create the Edge Function** `supabase/functions/pull_events/index.ts`:

```ts
// Edge Function : pull_events — renvoie le journal REDACTÉ par siège depuis sinceSeq.
// Filet de sécurité (rattrapage / reconnexion) : le client reconstruit sa vue.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
import { redactEventForSeat } from "../../../src/game/engine/authority.ts";
import type { PersistedEvent } from "../../../src/game/types/events.ts";

function rowToEvent(r: Record<string, unknown>): PersistedEvent {
  return {
    gameId: r.game_id as string,
    seq: r.seq as number,
    parentSeq: r.parent_seq as number,
    actor: r.actor as PersistedEvent["actor"],
    type: r.type as PersistedEvent["type"],
    payload: r.payload,
    payloadPrivate:
      (r.payload_private as PersistedEvent["payloadPrivate"]) ?? undefined,
    ts: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);
    const { gameId, sinceSeq } = await req.json();
    const since = typeof sinceSeq === "number" ? sinceSeq : 0;
    const db = adminClient();

    const { data: me } = await db
      .from("game_players")
      .select("seat")
      .eq("game_id", gameId)
      .eq("user_id", uid)
      .single();
    if (!me) return json({ error: "PAS_JOUEUR_DE_CETTE_PARTIE" }, 403);

    const { data: rows } = await db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("seq", { ascending: true });

    const all = (rows ?? []).map(rowToEvent);
    const out = [];
    const acc: PersistedEvent[] = [];
    let pre = deriveState(acc);
    for (const ev of all) {
      const post = deriveState([...acc, ev]);
      if (ev.seq > since) out.push(redactEventForSeat(ev, me.seat, pre, post));
      acc.push(ev);
      pre = post;
    }
    return json({ events: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Add `pullEvents` + `findMyActiveGame` to `gameClient.ts`:**

```ts
import type { DraftEvent, PersistedEvent, RedactedEvent } from "@/game";
import type { Seat } from "@/game";

/** Retire le journal redacté du siège appelant depuis `sinceSeq` (résolu côté serveur). */
export async function pullEvents(
  gameId: string,
  sinceSeq: number,
): Promise<RedactedEvent[]> {
  const { data, error } = await client().functions.invoke("pull_events", {
    body: { gameId, sinceSeq },
  });
  if (error) throw error;
  return (data as { events: RedactedEvent[] }).events ?? [];
}

/** Partie ACTIVE de l'utilisateur courant (pour reprise après refresh). */
export async function findMyActiveGame(): Promise<{
  gameId: string;
  seat: Seat;
} | null> {
  const c = client();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await c
    .from("games")
    .select("id, seat_a, seat_b")
    .or(`seat_a.eq.${uid},seat_b.eq.${uid}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; seat_a: string; seat_b: string };
  return { gameId: row.id, seat: row.seat_a === uid ? "A" : "B" };
}
```

- [ ] **Step 3: Wire `pull` into `PlayTableView`'s transport** — find `const onlineTransport = { submit: submitEvent, subscribe: subscribeToGame }` and add `pull` (import `pullEvents`):

```ts
import {
  createGame as createOnlineGame,
  joinGame,
  findGameByCode,
  submitEvent,
  subscribeToGame,
  pullEvents,
  findMyActiveGame,
} from "@/services/gameClient";
const onlineTransport = {
  submit: submitEvent,
  subscribe: subscribeToGame,
  pull: pullEvents,
};
```

- [ ] **Step 4: Type-check + commit** (runtime validated live in Task 4)

```bash
npm run type-check
git add supabase/functions/pull_events/index.ts src/services/gameClient.ts src/views/PlayTableView.vue
git commit -m "feat(play): pull_events Edge Function + client pull/find-active-game"
```

---

### Task 3: Reconnection on mount

**Files:**

- Modify: `src/views/PlayTableView.vue` (`resumeOnlineGame` in `onMounted`)

- [ ] **Step 1: Add reconnection** — in `PlayTableView.vue`'s `onMounted` (currently initializes cards + tutorial), after the card-init block and before the tutorial line, add:

```ts
// Reprise : si l'utilisateur a une partie ACTIVE en cours, s'y reconnecter
// (le pull de connexion reconstruit le plateau). Évite d'abandonner sur refresh.
if (
  ONLINE_PLAY_ENABLED &&
  authStore.isAuthenticated &&
  store.matchPhase === "lobby" &&
  !store.online
) {
  try {
    const active = await findMyActiveGame();
    if (active)
      store.connectOnline(active.gameId, active.seat, onlineTransport);
  } catch {
    /* pas de reprise possible — on reste au lobby */
  }
}
```

- [ ] **Step 2: Type-check + commit** (validated live in Task 4)

```bash
npm run type-check
git add src/views/PlayTableView.vue
git commit -m "feat(play): reconnect to an active online game on mount (resume after refresh)"
```

---

### Task 4: Deploy + live integration test + cleanup

**Files:** none (ops + verification). Uses the user's `sbp_` token + the GitHub-released Supabase CLI binary (`C:\Users\Nicolas\AppData\Local\Temp\supabase-cli\supabase.exe`; re-download from the latest release if absent).

- [ ] **Step 1: Full gate** — `npm run type-check`, `npx vitest run`, `npm run build`. Green.

- [ ] **Step 2: Verify token** (Management API ping `GET /v1/projects/ehqalhzvmgkepgbaxbzu`). If 401, ask the user for a fresh token.

- [ ] **Step 3: Deploy `pull_events`** — PowerShell, `$env:SUPABASE_ACCESS_TOKEN` set: `& <exe> functions deploy pull_events --project-ref ehqalhzvmgkepgbaxbzu` from repo root (engine relative imports bundle). Confirm exit 0 + the upload lists the engine assets.

- [ ] **Step 4: Deploy frontend** — merge `feat/online-reliability` → `master` (`--no-ff`), type-check, push → Vercel.

- [ ] **Step 5: Live integration test** (2 throwaway accounts → password-grant JWTs; reuse a deck snapshot; clean up after). In the preview browser with real sessions, assert:

  - **Joiner reliability:** B subscribes + `connectOnline` (which pulls `0`) then A is already in; on join, B's board populates (`GAME_STARTED` received via pull or broadcast) with **no** artificial wait — `monde.length === 2`.
  - **Gap backfill:** after connect, call `pull_events(gameId, 0)` directly and confirm it returns the redacted journal for the caller's seat (0 opponent hidden cardIds, empty SHUFFLE permutations).
  - **Resume:** a second `connectOnline` (simulating refresh) on the active game rebuilds the journal (`onlineJournalSeqs().length > 0`, `monde.length === 2`).
  - **Security regression check:** seat A's pulled journal carries no B-owned hidden cardIds.

- [ ] **Step 6: Clean up** test games + accounts via Management SQL; verify 0 remaining.

- [ ] **Step 7: Update memory** (`online-play-enablement.md`): slice A shipped (pull_events + resync + reconnect); Bug 1 fixed; slice B (opening hand + mulligan) next.

---

## Self-Review

**Spec coverage:** pull_events → Task 2; order-aware/gap-resync `applyServerEvent` → Task 1; connect-time backfill → Task 1 (Step 4); reconnection → Task 3; deploy/live test → Task 4. All spec sections mapped.

**Placeholder scan:** none — full code in every code step; Task 4 verification is concrete.

**Type consistency:** `OnlineTransport.pull(gameId, sinceSeq): Promise<RedactedEvent[]>` defined in Task 1, implemented as `pullEvents` in Task 2, wired in Tasks 2/3; `findMyActiveGame(): {gameId, seat}|null` defined Task 2, used Task 3; `resyncFrom`/`pending`/`pulling`/`onlineJournalSeqs` consistent across Task 1; `redactEventForSeat`/`deriveState`/`rowToEvent` reused from existing code with `.ts` Deno imports.
