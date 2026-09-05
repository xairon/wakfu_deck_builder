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
});
