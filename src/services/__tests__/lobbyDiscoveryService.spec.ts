import { describe, it, expect, vi, beforeEach } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  publishHostedLobby,
  subscribeToHostedLobbies,
  fetchHostedLobbiesFromDb,
} from "../lobbyDiscoveryService";

describe("lobbyDiscoveryService", () => {
  beforeEach(() => {
    supabaseStub = null;
  });

  it("gère gracieusement l'absence de Supabase sans planter", async () => {
    supabaseStub = null;
    const unpub = publishHostedLobby({
      code: "TEST12",
      hostName: "Iop",
      mode: "1v1",
      currentPlayers: 1,
      maxPlayers: 2,
      createdAt: Date.now(),
      status: "waiting",
    });
    expect(typeof unpub).toBe("function");
    unpub();

    let received: any[] = [];
    const unsub = subscribeToHostedLobbies((list) => {
      received = list;
    });
    expect(received).toEqual([]);
    expect(typeof unsub).toBe("function");
    unsub();

    const dbLobbies = await fetchHostedLobbiesFromDb();
    expect(dbLobbies).toEqual([]);
  });

  it("publie un salon hébergé via track sur le canal Realtime", () => {
    const trackMock = vi.fn();
    const untrackMock = vi.fn();
    const removeChannelMock = vi.fn();

    const channelMock = {
      subscribe: vi.fn((cb) => cb("SUBSCRIBED")),
      track: trackMock,
      untrack: untrackMock,
    };

    supabaseStub = {
      channel: vi.fn().mockReturnValue(channelMock),
      removeChannel: removeChannelMock,
    };

    const unpub = publishHostedLobby({
      code: "ROOM01",
      hostName: "Cra",
      mode: "1v1",
      currentPlayers: 1,
      maxPlayers: 2,
      createdAt: Date.now(),
      status: "waiting",
    });

    expect(supabaseStub.channel).toHaveBeenCalledWith("lobbies:discovery", expect.any(Object));
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ROOM01", hostName: "Cra" }),
    );

    unpub();
    expect(untrackMock).toHaveBeenCalled();
    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });

  it("conserve les salons en cours (started) lors de la découverte", () => {
    let presenceCallback: any = null;
    const channelMock: any = {
      presenceState: vi.fn().mockReturnValue({
        "ROOM-WAIT": [
          {
            code: "ROOM-WAIT",
            hostName: "Amalia",
            mode: "1v1",
            currentPlayers: 1,
            maxPlayers: 2,
            createdAt: Date.now() - 5000,
            status: "waiting",
          },
        ],
        "ROOM-LIVE": [
          {
            code: "ROOM-LIVE",
            hostName: "Goultard",
            mode: "1v1",
            currentPlayers: 2,
            maxPlayers: 2,
            createdAt: Date.now() - 10000,
            status: "started",
          },
        ],
      }),
      on: vi.fn((event, filterOrCb, cb) => {
        if (event === "presence" && filterOrCb?.event === "sync") {
          presenceCallback = cb;
        }
        return channelMock;
      }),
      subscribe: vi.fn(),
    };

    supabaseStub = {
      channel: vi.fn().mockReturnValue(channelMock),
      removeChannel: vi.fn(),
    };

    let discovered: any[] = [];
    subscribeToHostedLobbies((list) => {
      discovered = list;
    });

    // Simule la synchro presence
    if (presenceCallback) {
      presenceCallback();
    }

    expect(discovered.length).toBe(2);
    expect(discovered.map((l) => l.code)).toEqual(["ROOM-WAIT", "ROOM-LIVE"]);
    expect(discovered.find((l) => l.code === "ROOM-LIVE")?.status).toBe("started");
  });

  it("détecte les parties en cours depuis la base (fetchHostedLobbiesFromDb) pour le mode spectateur", async () => {
    const mockGames = [
      {
        id: "game-uuid-1",
        code: "LIVE99",
        status: "active",
        seat_a: "user-1",
        seat_b: "user-2",
        created_at: new Date().toISOString(),
      },
      {
        id: "game-uuid-2",
        code: "WAIT88",
        status: "lobby",
        seat_a: "user-3",
        seat_b: null,
        created_at: new Date().toISOString(),
      },
    ];

    const selectBuilder: any = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockGames, error: null }),
    };

    supabaseStub = {
      from: vi.fn().mockReturnValue(selectBuilder),
    };

    const lobbies = await fetchHostedLobbiesFromDb();
    expect(supabaseStub.from).toHaveBeenCalledWith("games");
    expect(lobbies.length).toBe(2);

    const liveGame = lobbies.find((l) => l.code === "LIVE99");
    expect(liveGame).toBeDefined();
    expect(liveGame?.status).toBe("started");
    expect(liveGame?.currentPlayers).toBe(2);
    expect(liveGame?.gameId).toBe("game-uuid-1");

    const waitGame = lobbies.find((l) => l.code === "WAIT88");
    expect(waitGame).toBeDefined();
    expect(waitGame?.status).toBe("waiting");
    expect(waitGame?.currentPlayers).toBe(1);
  });
});
