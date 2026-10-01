import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "./authStore";
import { getMyProfile, getUsernames } from "@/services/profileService";
import {
  type OnlineUser,
  type ChatMessage,
  type ConversationItem,
  type SystemNotificationItem,
  trackCommunityPresence,
  fetchGeneralMessages,
  fetchPrivateMessages,
  fetchMyPrivateConversations,
  sendGeneralMessage as apiSendGeneral,
  sendPrivateMessage as apiSendPrivate,
  subscribeToChat,
  fetchBlockedUsers,
  blockUser as apiBlockUser,
  unblockUser as apiUnblockUser,
} from "@/services/communityService";

export const useCommunityStore = defineStore("community", () => {
  const authStore = useAuthStore();

  const onlineUsers = ref<OnlineUser[]>([]);
  const blockedUserIds = ref<Set<string>>(new Set());
  const knownUsernames = ref<Record<string, string>>({});

  const generalMessages = ref<ChatMessage[]>([]);
  const privateConversations = ref<Record<string, ConversationItem[]>>({});
  const unreadPrivateCounts = ref<Record<string, number>>({});
  const lastIncomingPrivateMessage = ref<ChatMessage | null>(null);
  const selectedUserId = ref<string | null>(null);
  const isCommunityViewActive = ref<boolean>(false);
  const activeTab = ref<"general" | "private" | "online" | "blocked">("general");

  // Mémorise le dernier état en ligne connu par userId pour détecter déco/reconnexion
  const previousOnlineState = ref<Record<string, boolean>>({});

  let stopPresence: (() => void) | null = null;
  let stopChatSub: (() => void) | null = null;
  let isInitialized = false;

  const currentUserId = computed(() => authStore.userId);
  const currentUsername = computed(() => {
    if (!currentUserId.value) return "Aventurier";
    return (
      knownUsernames.value[currentUserId.value] ||
      authStore.userEmail?.split("@")[0] ||
      "Aventurier"
    );
  });

  const onlineOtherUsers = computed(() => {
    return onlineUsers.value.filter((u) => u.userId !== currentUserId.value);
  });

  const filteredGeneralMessages = computed(() => {
    return generalMessages.value.filter(
      (m) => !blockedUserIds.value.has(m.sender_id),
    );
  });

  const activeConversationItems = computed<ConversationItem[]>(() => {
    if (!selectedUserId.value) return [];
    const items = privateConversations.value[selectedUserId.value] || [];
    return items.filter((item) => {
      if (item.type === "system") return true;
      return !blockedUserIds.value.has(item.sender_id);
    });
  });

  const conversationList = computed(() => {
    return Object.keys(privateConversations.value)
      .map((otherId) => {
        const items = privateConversations.value[otherId] || [];
        const lastItem = items[items.length - 1];
        const lastMsgText =
          lastItem?.type === "system"
            ? lastItem.systemText
            : (lastItem as ChatMessage)?.content || "";
        const lastTime = lastItem?.created_at || "";
        return {
          userId: otherId,
          username: getUsername(otherId),
          isOnline: isUserOnline(otherId),
          lastMessage: lastMsgText,
          lastTime,
          unread: unreadPrivateCounts.value[otherId] || 0,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime(),
      );
  });

  const totalUnreadPrivate = computed(() => {
    return Object.values(unreadPrivateCounts.value).reduce((a, b) => a + b, 0);
  });

  const isSelectedUserOnline = computed(() => {
    if (!selectedUserId.value) return false;
    return onlineUsers.value.some((u) => u.userId === selectedUserId.value);
  });

  const isSelectedUserBlocked = computed(() => {
    if (!selectedUserId.value) return false;
    return blockedUserIds.value.has(selectedUserId.value);
  });

  function isUserOnline(userId: string): boolean {
    return onlineUsers.value.some((u) => u.userId === userId);
  }

  function getUsername(userId: string): string {
    if (userId === currentUserId.value) return currentUsername.value;
    return knownUsernames.value[userId] || "Aventurier";
  }

  function injectSystemNotification(
    targetUserId: string,
    type: "online" | "offline" | "info",
    text: string,
  ) {
    if (!privateConversations.value[targetUserId]) {
      privateConversations.value[targetUserId] = [];
    }
    const notif: SystemNotificationItem = {
      id: "sys-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      type: "system",
      systemType: type,
      systemText: text,
      created_at: new Date().toISOString(),
    };
    privateConversations.value[targetUserId].push(notif);
  }

  function handleUserPresenceEvent(event: {
    type: "join" | "leave";
    userId: string;
    username?: string;
  }) {
    if (event.userId === currentUserId.value) return;

    const name =
      event.username ||
      knownUsernames.value[event.userId] ||
      getUsername(event.userId);

    if (event.username) {
      knownUsernames.value[event.userId] = event.username;
    }

    const wasOnline = previousOnlineState.value[event.userId];

    if (event.type === "leave") {
      previousOnlineState.value[event.userId] = false;
      // Notifier dans la conversation privée si elle existe ou est active
      if (
        privateConversations.value[event.userId] ||
        selectedUserId.value === event.userId
      ) {
        injectSystemNotification(
          event.userId,
          "offline",
          `${name} n'est plus en ligne.`,
        );
      }
    } else if (event.type === "join") {
      previousOnlineState.value[event.userId] = true;
      if (
        wasOnline === false &&
        (privateConversations.value[event.userId] ||
          selectedUserId.value === event.userId)
      ) {
        injectSystemNotification(
          event.userId,
          "online",
          `${name} vient de se reconnecter.`,
        );
      }
    }
  }

  async function initialize() {
    if (isInitialized) return;
    isInitialized = true;

    if (!authStore.isAuthenticated || !authStore.userId) return;

    // 1. Charger son propre profil
    try {
      const myProfile = await getMyProfile();
      if (myProfile?.username) {
        knownUsernames.value[authStore.userId] = myProfile.username;
      }
    } catch {
      /* ignore */
    }

    // 2. Charger les utilisateurs bloqués
    try {
      const blocked = await fetchBlockedUsers();
      blockedUserIds.value = new Set(blocked);
    } catch {
      /* ignore */
    }

    // 3. Charger le chat général
    try {
      generalMessages.value = await fetchGeneralMessages();
    } catch {
      /* ignore */
    }

    // 4. Charger l'ensemble des conversations privées existantes
    try {
      const myPrivates = await fetchMyPrivateConversations();
      for (const m of myPrivates) {
        const otherId =
          m.sender_id === currentUserId.value ? m.recipient_id : m.sender_id;
        if (otherId) {
          if (!privateConversations.value[otherId]) {
            privateConversations.value[otherId] = [];
          }
          if (
            !privateConversations.value[otherId].some(
              (item) => item.id === m.id,
            )
          ) {
            privateConversations.value[otherId].push(m);
          }
          if (m.sender_id === otherId && m.sender_name) {
            knownUsernames.value[otherId] = m.sender_name;
          }
        }
      }

      // Résoudre les pseudos manquants pour chaque interlocuteur
      const missingIds = Object.keys(privateConversations.value).filter(
        (id) => !knownUsernames.value[id],
      );
      if (missingIds.length > 0) {
        void getUsernames(missingIds).then((res) => {
          for (const [uid, uname] of Object.entries(res)) {
            if (uname) knownUsernames.value[uid] = uname;
          }
        });
      }
    } catch {
      /* ignore */
    }

    // 5. Démarrer le tracking de présence
    const userPayload = {
      id: authStore.userId,
      username: currentUsername.value,
    };

    stopPresence = trackCommunityPresence(
      userPayload,
      (users) => {
        onlineUsers.value = users;
        for (const u of users) {
          if (u.username) knownUsernames.value[u.userId] = u.username;
          if (u.userId !== currentUserId.value) {
            previousOnlineState.value[u.userId] = true;
          }
        }
      },
      handleUserPresenceEvent,
    );

    // 6. S'abonner aux nouveaux messages en direct
    stopChatSub = subscribeToChat((msg) => {
      if (msg.channel === "general") {
        if (!generalMessages.value.some((m) => m.id === msg.id)) {
          generalMessages.value.push(msg);
        }
      } else if (msg.channel === "private") {
        // Sécurité stricte : un message privé ne doit être traité QUE si on en est l'émetteur ou le destinataire
        if (
          msg.sender_id !== currentUserId.value &&
          msg.recipient_id !== currentUserId.value
        ) {
          return;
        }

        const otherId =
          msg.sender_id === currentUserId.value
            ? msg.recipient_id
            : msg.sender_id;
        if (otherId) {
          if (!privateConversations.value[otherId]) {
            privateConversations.value[otherId] = [];
          }
          if (
            !privateConversations.value[otherId].some((m) => m.id === msg.id)
          ) {
            privateConversations.value[otherId].push(msg);
          }
          if (msg.sender_id === otherId && msg.sender_name) {
            knownUsernames.value[otherId] = msg.sender_name;
          }

          if (msg.sender_id !== currentUserId.value) {
            const isViewingThisChat =
              isCommunityViewActive.value &&
              activeTab.value === "private" &&
              selectedUserId.value === otherId;

            if (!isViewingThisChat) {
              unreadPrivateCounts.value[otherId] =
                (unreadPrivateCounts.value[otherId] || 0) + 1;
            }
            lastIncomingPrivateMessage.value = msg;
          }
        }
      }
    });
  }

  async function openPrivateChat(userId: string, username?: string) {
    selectedUserId.value = userId;
    unreadPrivateCounts.value[userId] = 0;
    if (username) {
      knownUsernames.value[userId] = username;
    } else if (!knownUsernames.value[userId]) {
      const resolved = await getUsernames([userId]);
      if (resolved[userId]) {
        knownUsernames.value[userId] = resolved[userId];
      }
    }

    if (!privateConversations.value[userId]) {
      privateConversations.value[userId] = [];
    }

    // Charger l'historique des messages privés
    const msgs = await fetchPrivateMessages(userId);
    const existingIds = new Set(
      privateConversations.value[userId].map((m) => m.id),
    );
    for (const m of msgs) {
      if (!existingIds.has(m.id)) {
        privateConversations.value[userId].push(m);
      }
    }

    // Trier les éléments de conversation par date
    privateConversations.value[userId].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }

  async function sendGeneral(content: string) {
    const sent = await apiSendGeneral(currentUsername.value, content);
    if (!generalMessages.value.some((m) => m.id === sent.id)) {
      generalMessages.value.push(sent);
    }
  }

  async function sendPrivate(content: string) {
    if (!selectedUserId.value) throw new Error("Aucun destinataire sélectionné");
    const sent = await apiSendPrivate(
      selectedUserId.value,
      currentUsername.value,
      content,
    );
    const target = selectedUserId.value;
    if (!privateConversations.value[target]) {
      privateConversations.value[target] = [];
    }
    if (!privateConversations.value[target].some((m) => m.id === sent.id)) {
      privateConversations.value[target].push(sent);
    }
  }

  async function toggleBlockUser(userId: string): Promise<boolean> {
    const isBlocked = blockedUserIds.value.has(userId);
    if (isBlocked) {
      const res = await apiUnblockUser(userId);
      if (res.ok) {
        blockedUserIds.value.delete(userId);
        return false;
      }
      throw new Error(res.error || "Impossible de débloquer l'utilisateur");
    } else {
      const res = await apiBlockUser(userId);
      if (res.ok) {
        blockedUserIds.value.add(userId);
        return true;
      }
      throw new Error(res.error || "Impossible de bloquer l'utilisateur");
    }
  }

  function reset() {
    stopPresence?.();
    stopChatSub?.();
    stopPresence = null;
    stopChatSub = null;
    isInitialized = false;
    isCommunityViewActive.value = false;
    activeTab.value = "general";
    onlineUsers.value = [];
    blockedUserIds.value.clear();
    generalMessages.value = [];
    privateConversations.value = {};
    selectedUserId.value = null;
    previousOnlineState.value = {};
    unreadPrivateCounts.value = {};
    lastIncomingPrivateMessage.value = null;
  }

  return {
    onlineUsers,
    onlineOtherUsers,
    blockedUserIds,
    knownUsernames,
    generalMessages,
    filteredGeneralMessages,
    privateConversations,
    conversationList,
    totalUnreadPrivate,
    unreadPrivateCounts,
    lastIncomingPrivateMessage,
    selectedUserId,
    isCommunityViewActive,
    activeTab,
    activeConversationItems,
    currentUsername,
    isSelectedUserOnline,
    isSelectedUserBlocked,
    isUserOnline,
    getUsername,
    initialize,
    openPrivateChat,
    sendGeneral,
    sendPrivate,
    toggleBlockUser,
    reset,
  };
});
