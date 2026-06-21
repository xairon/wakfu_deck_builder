import { describe, it, expect, vi, beforeEach } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  createGame,
  joinGame,
  findGameByCode,
  submitEvent,
  subscribeToGame,
} from "@/services/gameClient";

describe("gameClient — appels Supabase (functions.invoke + query builder)", () => {
  beforeEach(() => {
    supabaseStub = null;
  });

  // ── createGame ──────────────────────────────────────────────────────────
  it("devrait invoquer 'create_game' avec le deck et renvoyer { gameId, code }", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { gameId: "g1", code: "ABCD" }, error: null });
    supabaseStub = { functions: { invoke } };

    const deck = { hero: "x" };
    const res = await createGame(deck);

    expect(res).toEqual({ gameId: "g1", code: "ABCD" });
    expect(invoke).toHaveBeenCalledWith("create_game", { body: { deck } });
  });

  it("devrait propager l'erreur renvoyée par 'create_game'", async () => {
    const err = new Error("create boom");
    const invoke = vi.fn().mockResolvedValue({ data: null, error: err });
    supabaseStub = { functions: { invoke } };

    await expect(createGame({})).rejects.toThrow("create boom");
  });

  // ── joinGame ────────────────────────────────────────────────────────────
  it("devrait invoquer 'join_game' avec { code, deck } et renvoyer { gameId, firstPlayer }", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { gameId: "g2", firstPlayer: "A" },
      error: null,
    });
    supabaseStub = { functions: { invoke } };

    const deck = { hero: "y" };
    const res = await joinGame("WXYZ", deck);

    expect(res).toEqual({ gameId: "g2", firstPlayer: "A" });
    expect(invoke).toHaveBeenCalledWith("join_game", {
      body: { code: "WXYZ", deck },
    });
  });

  it("devrait propager l'erreur renvoyée par 'join_game'", async () => {
    const err = new Error("join boom");
    const invoke = vi.fn().mockResolvedValue({ data: null, error: err });
    supabaseStub = { functions: { invoke } };

    await expect(joinGame("WXYZ", {})).rejects.toThrow("join boom");
  });

  // ── findGameByCode ──────────────────────────────────────────────────────
  it("devrait interroger games via select('id').eq('code', …).maybeSingle() et renvoyer l'id", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "game-42" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    supabaseStub = { from };

    const id = await findGameByCode("CODE1");

    expect(id).toBe("game-42");
    expect(from).toHaveBeenCalledWith("games");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("code", "CODE1");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("devrait renvoyer null quand aucune partie ne correspond au code (data null)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    const id = await findGameByCode("INCONNU");

    expect(id).toBeNull();
  });

  it("devrait propager l'erreur de la requête findGameByCode", async () => {
    const err = new Error("query boom");
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: err });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    await expect(findGameByCode("CODE1")).rejects.toThrow("query boom");
  });

  // ── submitEvent ─────────────────────────────────────────────────────────
  it("devrait invoquer 'submit_event' avec { gameId, draft } et renvoyer { seq }", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { seq: 7 }, error: null });
    supabaseStub = { functions: { invoke } };

    const draft = { kind: "play_card", cardId: "c1" } as any;
    const res = await submitEvent("g9", draft);

    expect(res).toEqual({ seq: 7 });
    expect(invoke).toHaveBeenCalledWith("submit_event", {
      body: { gameId: "g9", draft },
    });
  });

  it("devrait propager l'erreur renvoyée par 'submit_event'", async () => {
    const err = new Error("submit boom");
    const invoke = vi.fn().mockResolvedValue({ data: null, error: err });
    supabaseStub = { functions: { invoke } };

    await expect(submitEvent("g9", {} as any)).rejects.toThrow("submit boom");
  });

  // ── garde « Supabase non configuré » ─────────────────────────────────────
  it("devrait lever « Supabase non configuré » quand le client est absent", async () => {
    supabaseStub = null;

    await expect(createGame({})).rejects.toThrow("Supabase non configuré");
    await expect(joinGame("X", {})).rejects.toThrow("Supabase non configuré");
    await expect(findGameByCode("X")).rejects.toThrow("Supabase non configuré");
    await expect(submitEvent("g", {} as any)).rejects.toThrow(
      "Supabase non configuré",
    );
  });

  // ── subscribeToGame ──────────────────────────────────────────────────────
  it("devrait s'abonner au canal PRIVÉ game:<id>:<seat> sur l'event broadcast 'game_event'", () => {
    const subscribe = vi.fn().mockReturnValue("channel-handle");
    const on = vi.fn(
      (
        _event: string,
        _filter: unknown,
        _handler: (msg: { payload: unknown }) => void,
      ) => ({ subscribe }),
    );
    const channelObj = { on };
    const channel = vi.fn(() => channelObj);
    const removeChannel = vi.fn();
    supabaseStub = { channel, removeChannel };

    const onEvent = vi.fn();
    const unsubscribe = subscribeToGame("g5", "A", onEvent);

    expect(channel).toHaveBeenCalledWith("game:g5:A", {
      config: { private: true },
    });
    const [eventType, filter, handler] = on.mock.calls[0];
    expect(eventType).toBe("broadcast");
    expect(filter).toEqual({ event: "game_event" });
    expect(subscribe).toHaveBeenCalledTimes(1);

    // le handler relaie le payload tel quel
    const persisted = { seq: 1, type: "moved" } as any;
    handler({ payload: persisted });
    expect(onEvent).toHaveBeenCalledWith(persisted);

    // la fonction renvoyée retire le canal
    expect(removeChannel).not.toHaveBeenCalled();
    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith("channel-handle");
  });
});
