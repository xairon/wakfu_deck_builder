import { ref, watch, nextTick, onMounted, getCurrentInstance } from "vue";
import type { ChatMessage, UseInGameChatOptions } from "@/types/chat";
import { useGameStore } from "@/stores/gameStore";

/**
 * Hook de gestion de l'état et de la logique du chat en jeu 1v1.
 * Sécurité & Rétention : L'état `messagesList` est conservé en mémoire
 * indépendamment de la visibilité `isChatOpen`.
 */
export function useInGameChat(options: UseInGameChatOptions = {}) {
  const gameStore = useGameStore();

  // État séparé pour les messages et l'affichage UI
  const messagesList = ref<ChatMessage[]>([]);
  const isChatOpen = ref<boolean>(false);
  const unreadCount = ref<number>(0);
  const messagesContainerRef = ref<HTMLElement | null>(null);

  // Ensemble d'ID de séquences d'événements déjà traités pour éviter les doublons
  const processedSeqs = new Set<string | number>();

  /**
   * Formate une heure en HH:mm (ex: "14:35")
   */
  function formatTime(timestampMs?: number): string {
    const d = timestampMs ? new Date(timestampMs) : new Date();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * Auto-scroll vers le bas de la liste des messages (résistant jsdom/browser)
   */
  async function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    await nextTick();
    if (messagesContainerRef.value) {
      if (typeof messagesContainerRef.value.scrollTo === "function") {
        messagesContainerRef.value.scrollTo({
          top: messagesContainerRef.value.scrollHeight,
          behavior,
        });
      } else {
        messagesContainerRef.value.scrollTop =
          messagesContainerRef.value.scrollHeight;
      }
    }
  }

  /**
   * Bascule la visibilité de la fenêtre de chat
   */
  function toggleChat() {
    isChatOpen.value = !isChatOpen.value;
    if (isChatOpen.value) {
      unreadCount.value = 0;
      void scrollToBottom("instant");
    }
  }

  function openChat() {
    isChatOpen.value = true;
    unreadCount.value = 0;
    void scrollToBottom("instant");
  }

  function closeChat() {
    isChatOpen.value = false;
  }

  /**
   * Ajoute un message dans l'historique actif en mémoire
   */
  function addMessage(msg: {
    id?: string;
    senderId: string;
    senderName: string;
    text: string;
    isSelf: boolean;
    timestamp?: string;
    createdAt?: number;
    type?: "user" | "system";
  }) {
    const createdAt = msg.createdAt ?? Date.now();
    const formattedMessage: ChatMessage = {
      id:
        msg.id ??
        `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.text,
      timestamp: msg.timestamp ?? formatTime(createdAt),
      createdAt,
      isSelf: msg.isSelf,
      type: msg.type ?? "user",
    };

    messagesList.value.push(formattedMessage);

    // Si le chat est fermé et que le message provient de l'adversaire ou du système, incrémenter le badge
    if (!isChatOpen.value && !msg.isSelf) {
      unreadCount.value += 1;
    }

    // Auto-scroll si le chat est ouvert
    if (isChatOpen.value) {
      void scrollToBottom("smooth");
    }
  }

  /**
   * Envoie un nouveau message via le gameStore ou la fonction réseau custom
   */
  function sendMessage(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Troncature à 300 caractères max
    const content = trimmed.slice(0, 300);

    if (options.onSendMessage) {
      void options.onSendMessage(content);
    } else {
      gameStore.sendChat(content);
    }

    return true;
  }

  /**
   * Synchronise les événements SAID de gameStore vers messagesList
   */
  function syncEventsFromStore() {
    const events = gameStore.events || [];
    const currentPerspective = gameStore.perspective;

    for (const ev of events) {
      if (ev.type !== "SAID") continue;

      const eventKey = `${ev.seq}_${ev.actor}`;
      if (processedSeqs.has(eventKey)) continue;

      processedSeqs.add(eventKey);

      const text = String((ev.payload as { text?: string })?.text ?? "");
      if (!text) continue;

      const isSelf =
        ev.actor === currentPerspective ||
        (gameStore.online && ev.actor === gameStore.mySeat);
      let senderName = "Système";

      if (ev.actor !== "system") {
        const pName = gameStore.players?.[ev.actor as Seat]?.name;
        if (pName) {
          senderName = pName;
        } else if (ev.actor === "A") {
          senderName = options.localPlayerName ?? "Joueur 1";
        } else if (ev.actor === "B") {
          senderName = options.opponentPlayerName ?? "Joueur 2";
        } else if (ev.actor === "A1") {
          senderName = "Joueur 1 (Équipe 1)";
        } else if (ev.actor === "B1") {
          senderName = "Joueur 2 (Équipe 2)";
        } else if (ev.actor === "A2") {
          senderName = "Joueur 3 (Équipe 1)";
        } else if (ev.actor === "B2") {
          senderName = "Joueur 4 (Équipe 2)";
        } else {
          senderName = String(ev.actor);
        }
      }

      addMessage({
        id: `said_${ev.seq}`,
        senderId: ev.actor,
        senderName,
        text,
        isSelf,
        createdAt: ev.ts,
        timestamp: formatTime(ev.ts),
      });
    }
  }

  // Observer les changements du journal des événements de gameStore
  watch(
    () => gameStore.events,
    () => {
      syncEventsFromStore();
    },
    { deep: true, immediate: true, flush: "sync" },
  );

  if (getCurrentInstance()) {
    onMounted(() => {
      syncEventsFromStore();
    });
  } else {
    syncEventsFromStore();
  }

  return {
    messagesList,
    isChatOpen,
    unreadCount,
    messagesContainerRef,
    toggleChat,
    openChat,
    closeChat,
    sendMessage,
    addMessage,
    scrollToBottom,
  };
}
