import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { setActivePinia, createPinia } from "pinia";
import CommunityView from "../CommunityView.vue";
import { useAuthStore } from "@/stores/authStore";
import { useCommunityStore } from "@/stores/communityStore";

vi.mock("@/services/communityService", () => ({
  trackCommunityPresence: vi.fn(() => vi.fn()),
  fetchGeneralMessages: vi.fn().mockResolvedValue([]),
  fetchPrivateMessages: vi.fn().mockResolvedValue([]),
  sendGeneralMessage: vi.fn().mockResolvedValue({
    id: "msg-1",
    sender_id: "u-1",
    sender_name: "Yugo",
    channel: "general",
    content: "Salut !",
    created_at: new Date().toISOString(),
  }),
  sendPrivateMessage: vi.fn().mockResolvedValue({
    id: "priv-1",
    sender_id: "u-1",
    sender_name: "Yugo",
    recipient_id: "u-2",
    channel: "private",
    content: "Salut privé !",
    created_at: new Date().toISOString(),
  }),
  subscribeToChat: vi.fn(() => vi.fn()),
  fetchBlockedUsers: vi.fn().mockResolvedValue([]),
  blockUser: vi.fn().mockResolvedValue({ ok: true }),
  unblockUser: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/services/profileService", () => ({
  getMyProfile: vi.fn().mockResolvedValue({ username: "Yugo" }),
  getUsernames: vi.fn().mockResolvedValue({ "u-2": "Amalia" }),
}));

describe("CommunityView.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("affiche l'écran de connexion si l'utilisateur est déconnecté", () => {
    const authStore = useAuthStore();
    authStore.user = null;

    const wrapper = mount(CommunityView, {
      global: {
        stubs: ["router-link"],
      },
    });

    expect(wrapper.text()).toContain("Rejoins le Salon de la Communauté");
    expect(wrapper.text()).toContain("Se connecter");
  });

  it("affiche le chat général et les utilisateurs en ligne quand connecté", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-1", email: "yugo@test.com" } as any;

    const communityStore = useCommunityStore();
    communityStore.onlineUsers = [
      { userId: "u-1", username: "Yugo", onlineAt: 100 },
      { userId: "u-2", username: "Amalia", onlineAt: 110 },
    ];
    communityStore.generalMessages = [
      {
        id: "msg-1",
        sender_id: "u-2",
        sender_name: "Amalia",
        recipient_id: null,
        channel: "general",
        content: "Bienvenue à tous !",
        created_at: new Date().toISOString(),
      },
    ];

    const wrapper = mount(CommunityView, {
      global: {
        stubs: ["router-link"],
      },
    });
    await nextTick();

    expect(wrapper.text()).toContain("Salon & Messagerie");
    expect(wrapper.text()).toContain("Chat Général");
    expect(wrapper.text()).toContain("Bienvenue à tous !");
    expect(wrapper.text()).toContain("Amalia");
  });

  it("affiche la conversation privée avec l'indicateur de statut et les notifications système", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-1", email: "yugo@test.com" } as any;

    const communityStore = useCommunityStore();
    communityStore.selectedUserId = "u-2";
    communityStore.knownUsernames["u-2"] = "Amalia";
    communityStore.onlineUsers = [
      { userId: "u-1", username: "Yugo", onlineAt: 100 },
    ]; // Amalia n'est pas dans onlineUsers -> hors ligne
    communityStore.privateConversations["u-2"] = [
      {
        id: "sys-1",
        type: "system",
        systemType: "offline",
        systemText: "Amalia n'est plus en ligne.",
        created_at: new Date().toISOString(),
      },
      {
        id: "msg-p1",
        sender_id: "u-2",
        sender_name: "Amalia",
        recipient_id: "u-1",
        channel: "private",
        content: "À bientôt sur Wakfu !",
        created_at: new Date().toISOString(),
      },
    ];

    const wrapper = mount(CommunityView, {
      global: {
        stubs: ["router-link"],
      },
    });
    await nextTick();

    // Cliquer sur l'onglet privé
    const privTab = wrapper.findAll("button").find((b) => b.text().includes("Privé : Amalia"));
    expect(privTab).toBeTruthy();
    await privTab!.trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("Amalia n'est plus en ligne.");
    expect(wrapper.text()).toContain("À bientôt sur Wakfu !");
    expect(wrapper.text()).toContain("Hors-ligne");
  });

  it("active et désactive isCommunityViewActive selon le cycle de vie du composant", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-1", email: "yugo@test.com" } as any;

    const communityStore = useCommunityStore();
    expect(communityStore.isCommunityViewActive).toBe(false);

    const wrapper = mount(CommunityView, {
      global: {
        stubs: ["router-link"],
      },
    });

    expect(communityStore.isCommunityViewActive).toBe(true);

    wrapper.unmount();
    expect(communityStore.isCommunityViewActive).toBe(false);
  });
});
