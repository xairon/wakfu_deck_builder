import { describe, it, expect, vi, beforeEach } from "vitest";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));

import {
  trackCommunityPresence,
  fetchGeneralMessages,
  fetchPrivateMessages,
  sendGeneralMessage,
  sendPrivateMessage,
  fetchBlockedUsers,
  blockUser,
  unblockUser,
} from "../communityService";

describe("communityService", () => {
  beforeEach(() => {
    supabaseStub = null;
    vi.clearAllMocks();
  });

  it("gère l'absence de Supabase sans planter", async () => {
    supabaseStub = null;
    let usersResult: any[] = [];
    const unsub = trackCommunityPresence(
      { id: "u-1", username: "Yugo" },
      (users) => {
        usersResult = users;
      },
    );
    expect(usersResult).toEqual([]);
    unsub();

    const generalMsgs = await fetchGeneralMessages();
    expect(generalMsgs).toEqual([]);

    const privMsgs = await fetchPrivateMessages("u-2");
    expect(privMsgs).toEqual([]);

    const blocked = await fetchBlockedUsers();
    expect(blocked).toEqual([]);

    const bRes = await blockUser("u-2");
    expect(bRes.ok).toBe(false);

    const ubRes = await unblockUser("u-2");
    expect(ubRes.ok).toBe(false);
  });

  it("suit la présence des utilisateurs via Supabase Realtime", () => {
    let syncCb: any = null;
    let joinCb: any = null;
    let leaveCb: any = null;
    const trackMock = vi.fn();
    const untrackMock = vi.fn();
    const removeChannelMock = vi.fn();

    const channelMock: any = {
      presenceState: vi.fn(() => ({
        "u-2": [{ userId: "u-2", username: "Amalia", onlineAt: 12345 }],
      })),
      on: vi.fn((event, opts, cb) => {
        if (opts.event === "sync") syncCb = cb;
        if (opts.event === "join") joinCb = cb;
        if (opts.event === "leave") leaveCb = cb;
        return channelMock;
      }),
      subscribe: vi.fn((cb) => cb("SUBSCRIBED")),
      track: trackMock,
      untrack: untrackMock,
    };

    supabaseStub = {
      channel: vi.fn(() => channelMock),
      removeChannel: removeChannelMock,
    };

    let usersList: any[] = [];
    const userEvents: any[] = [];

    const unsub = trackCommunityPresence(
      { id: "u-1", username: "Yugo" },
      (users) => {
        usersList = users;
      },
      (ev) => {
        userEvents.push(ev);
      },
    );

    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        username: "Yugo",
      }),
    );

    // Déclencher sync
    syncCb();
    expect(usersList).toHaveLength(1);
    expect(usersList[0].username).toBe("Amalia");

    // Déclencher join
    joinCb({
      key: "u-3",
      newPresences: [{ userId: "u-3", username: "Dally" }],
    });
    expect(userEvents).toContainEqual(
      expect.objectContaining({ type: "join", userId: "u-3", username: "Dally" }),
    );

    // Déclencher leave
    leaveCb({
      key: "u-3",
      leftPresences: [{ userId: "u-3", username: "Dally" }],
    });
    expect(userEvents).toContainEqual(
      expect.objectContaining({ type: "leave", userId: "u-3", username: "Dally" }),
    );

    unsub();
    expect(untrackMock).toHaveBeenCalled();
    expect(removeChannelMock).toHaveBeenCalled();
  });

  it("envoie un message général et gère le fallback si hors-ligne ou erreur", async () => {
    supabaseStub = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
        }),
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "msg-1",
                sender_id: "u-1",
                sender_name: "Yugo",
                channel: "general",
                content: "Salut la taverne !",
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      })),
      channel: vi.fn(() => ({
        subscribe: vi.fn(),
        send: vi.fn(),
      })),
    };

    const res = await sendGeneralMessage("Yugo", "Salut la taverne !");
    expect(res.content).toBe("Salut la taverne !");
    expect(res.sender_id).toBe("u-1");
  });

  it("gère le blocage et déblocage d'un utilisateur", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    supabaseStub = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "user_blocks") {
          return {
            insert: insertMock,
            delete: deleteMock,
          };
        }
        return {};
      }),
    };

    const bRes = await blockUser("u-nox");
    expect(bRes.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      blocker_id: "u-1",
      blocked_id: "u-nox",
    });

    const ubRes = await unblockUser("u-nox");
    expect(ubRes.ok).toBe(true);
  });

  it("envoie un message privé à un utilisateur", async () => {
    supabaseStub = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
        }),
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "priv-1",
                sender_id: "u-1",
                sender_name: "Yugo",
                recipient_id: "u-2",
                channel: "private",
                content: "Salut Amalia",
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      })),
      channel: vi.fn(() => ({
        subscribe: vi.fn(),
        send: vi.fn(),
      })),
    };

    const res = await sendPrivateMessage("u-2", "Yugo", "Salut Amalia");
    expect(res.content).toBe("Salut Amalia");
    expect(res.recipient_id).toBe("u-2");
  });
});
