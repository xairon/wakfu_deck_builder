import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCommunityStore } from "../communityStore";
import { useAuthStore } from "../authStore";

let presenceCb: any = null;
let userEventCb: any = null;
let chatSubCb: any = null;

vi.mock("@/services/communityService", () => ({
  trackCommunityPresence: vi.fn((user, onPresence, onUserEvent) => {
    presenceCb = onPresence;
    userEventCb = onUserEvent;
    return vi.fn();
  }),
  fetchGeneralMessages: vi.fn().mockResolvedValue([
    {
      id: "gen-1",
      sender_id: "u-2",
      sender_name: "Amalia",
      recipient_id: null,
      channel: "general",
      content: "Bienvenue à tous !",
      created_at: new Date().toISOString(),
    },
  ]),
  fetchPrivateMessages: vi.fn().mockResolvedValue([]),
  sendGeneralMessage: vi.fn((name, content) =>
    Promise.resolve({
      id: "gen-2",
      sender_id: "u-me",
      sender_name: name,
      recipient_id: null,
      channel: "general",
      content,
      created_at: new Date().toISOString(),
    }),
  ),
  sendPrivateMessage: vi.fn((recipientId, name, content) =>
    Promise.resolve({
      id: "priv-1",
      sender_id: "u-me",
      sender_name: name,
      recipient_id: recipientId,
      channel: "private",
      content,
      created_at: new Date().toISOString(),
    }),
  ),
  subscribeToChat: vi.fn((onMsg) => {
    chatSubCb = onMsg;
    return vi.fn();
  }),
  fetchBlockedUsers: vi.fn().mockResolvedValue([]),
  blockUser: vi.fn().mockResolvedValue({ ok: true }),
  unblockUser: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/services/profileService", () => ({
  getMyProfile: vi.fn().mockResolvedValue({ username: "YugoHero" }),
  getUsernames: vi.fn().mockResolvedValue({ "u-2": "Amalia" }),
}));

describe("communityStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    presenceCb = null;
    userEventCb = null;
    chatSubCb = null;
  });

  it("s'initialise et charge les messages généraux et la présence", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    expect(communityStore.currentUsername).toBe("YugoHero");
    expect(communityStore.generalMessages).toHaveLength(1);
    expect(communityStore.generalMessages[0].content).toBe("Bienvenue à tous !");

    // Simuler la présence reçue
    presenceCb([
      { userId: "u-me", username: "YugoHero", onlineAt: 1000 },
      { userId: "u-2", username: "Amalia", onlineAt: 1005 },
    ]);

    expect(communityStore.onlineUsers).toHaveLength(2);
    expect(communityStore.onlineOtherUsers).toHaveLength(1);
    expect(communityStore.isUserOnline("u-2")).toBe(true);
    expect(communityStore.isUserOnline("u-unknown")).toBe(false);
  });

  it("injecte une notification système dans la conversation privée quand l'interlocuteur se déconnecte ou se reconnecte", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    // Ouvrir une conversation privée avec Amalia
    await communityStore.openPrivateChat("u-2", "Amalia");
    expect(communityStore.selectedUserId).toBe("u-2");

    // Amalia est connectée initialement
    presenceCb([
      { userId: "u-me", username: "YugoHero", onlineAt: 1000 },
      { userId: "u-2", username: "Amalia", onlineAt: 1005 },
    ]);

    // Amalia se déconnecte (événement leave)
    userEventCb({ type: "leave", userId: "u-2", username: "Amalia" });

    // La conversation privée doit contenir la notification de déconnexion
    const itemsAfterLeave = communityStore.activeConversationItems;
    expect(itemsAfterLeave.some((item) => item.type === "system" && item.systemText.includes("n'est plus en ligne"))).toBe(true);

    // Amalia se reconnecte (événement join)
    userEventCb({ type: "join", userId: "u-2", username: "Amalia" });

    const itemsAfterJoin = communityStore.activeConversationItems;
    expect(itemsAfterJoin.some((item) => item.type === "system" && item.systemText.includes("vient de se reconnecter"))).toBe(true);
  });

  it("gère le blocage et déblocage d'un utilisateur et masque ses messages", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    expect(communityStore.filteredGeneralMessages).toHaveLength(1);

    // Bloquer Amalia (u-2)
    const isBlocked = await communityStore.toggleBlockUser("u-2");
    expect(isBlocked).toBe(true);
    expect(communityStore.blockedUserIds.has("u-2")).toBe(true);

    // Ses messages doivent être filtrés du chat général
    expect(communityStore.filteredGeneralMessages).toHaveLength(0);

    // Débloquer Amalia
    const isStillBlocked = await communityStore.toggleBlockUser("u-2");
    expect(isStillBlocked).toBe(false);
    expect(communityStore.blockedUserIds.has("u-2")).toBe(false);
    expect(communityStore.filteredGeneralMessages).toHaveLength(1);
  });

  it("permet d'envoyer un message général et privé", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    await communityStore.sendGeneral("Coucou la guilde");
    expect(communityStore.generalMessages.some((m) => m.content === "Coucou la guilde")).toBe(true);

    await communityStore.openPrivateChat("u-2", "Amalia");
    await communityStore.sendPrivate("Salut Amalia");
    expect(
      communityStore.activeConversationItems.some(
        (m) => m.type !== "system" && m.content === "Salut Amalia",
      ),
    ).toBe(true);
  });

  it("reçoit de nouveaux messages via l'abonnement chat", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    chatSubCb({
      id: "gen-realtime",
      sender_id: "u-2",
      sender_name: "Amalia",
      channel: "general",
      content: "Un message en direct !",
      created_at: new Date().toISOString(),
    });

    expect(
      communityStore.generalMessages.some((m) => m.id === "gen-realtime"),
    ).toBe(true);
  });

  it("incrémente les non-lus seulement si on n'est pas sur la conversation en question", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    // 1. Utilisateur hors de la vue ou sur le chat général
    communityStore.isCommunityViewActive = false;
    communityStore.activeTab = "general";
    communityStore.selectedUserId = null;

    chatSubCb({
      id: "priv-msg-1",
      sender_id: "u-2",
      sender_name: "Amalia",
      recipient_id: "u-me",
      channel: "private",
      content: "Tu es là ?",
      created_at: new Date().toISOString(),
    });

    expect(communityStore.unreadPrivateCounts["u-2"]).toBe(1);
    expect(communityStore.totalUnreadPrivate).toBe(1);
    expect(communityStore.lastIncomingPrivateMessage?.content).toBe("Tu es là ?");

    // 2. Utilisateur ouvre la conversation
    await communityStore.openPrivateChat("u-2", "Amalia");
    communityStore.isCommunityViewActive = true;
    communityStore.activeTab = "private";
    expect(communityStore.unreadPrivateCounts["u-2"]).toBe(0);

    // 3. Nouveau message alors qu'il est EN TRAIN de regarder la conversation
    chatSubCb({
      id: "priv-msg-2",
      sender_id: "u-2",
      sender_name: "Amalia",
      recipient_id: "u-me",
      channel: "private",
      content: "Super !",
      created_at: new Date().toISOString(),
    });

    expect(communityStore.unreadPrivateCounts["u-2"]).toBe(0);
    expect(communityStore.totalUnreadPrivate).toBe(0);
  });

  it("ignore totalement les messages privés entre tiers (ne fuitent pas vers les autres utilisateurs)", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-me", email: "yugo@elias.com" } as any;

    const communityStore = useCommunityStore();
    await communityStore.initialize();

    // Message privé entre u-2 (Amalia) et u-3 (Dally) — u-me n'est ni sender ni recipient
    chatSubCb({
      id: "priv-msg-leak",
      sender_id: "u-2",
      sender_name: "Amalia",
      recipient_id: "u-3",
      channel: "private",
      content: "Message secret pour Dally",
      created_at: new Date().toISOString(),
    });

    // 1. Ne doit pas créer ou alimenter une conversation privée pour u-2 ou u-3 chez u-me
    expect(communityStore.privateConversations["u-2"] || []).toHaveLength(0);
    expect(communityStore.privateConversations["u-3"] || []).toHaveLength(0);

    // 2. Ne doit pas générer de non-lu
    expect(communityStore.totalUnreadPrivate).toBe(0);

    // 3. Ne doit pas déclencher la notification lastIncomingPrivateMessage (qui déclenche les toasts)
    expect(communityStore.lastIncomingPrivateMessage).toBeNull();
  });
});
