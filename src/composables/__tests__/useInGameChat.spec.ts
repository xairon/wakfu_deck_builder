import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useInGameChat } from "@/composables/useInGameChat";
import { useGameStore } from "@/stores/gameStore";

describe("useInGameChat", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("devrait initialiser le chat fermé et sans messages non lus", () => {
    const { isChatOpen, unreadCount, messagesList } = useInGameChat();

    expect(isChatOpen.value).toBe(false);
    expect(unreadCount.value).toBe(0);
    expect(messagesList.value).toEqual([]);
  });

  it("devrait ouvrir et fermer le chat tout en réinitialisant le compteur non-lus à l'ouverture", () => {
    const { isChatOpen, unreadCount, toggleChat, addMessage } = useInGameChat();

    // Ajout d'un message adversaire chat fermé
    addMessage({
      senderId: "B",
      senderName: "Adversaire",
      text: "Hello",
      isSelf: false,
    });

    expect(unreadCount.value).toBe(1);

    toggleChat(); // Ouverture
    expect(isChatOpen.value).toBe(true);
    expect(unreadCount.value).toBe(0);

    toggleChat(); // Fermeture
    expect(isChatOpen.value).toBe(false);
  });

  it("devrait conserver l'historique des messages lors des bascules d'état UI", () => {
    const { isChatOpen, messagesList, openChat, closeChat, addMessage } =
      useInGameChat();

    addMessage({
      senderId: "A",
      senderName: "Joueur 1",
      text: "Message 1",
      isSelf: true,
    });

    openChat();
    expect(isChatOpen.value).toBe(true);

    addMessage({
      senderId: "B",
      senderName: "Joueur 2",
      text: "Message 2",
      isSelf: false,
    });

    closeChat();
    expect(isChatOpen.value).toBe(false);
    expect(messagesList.value).toHaveLength(2);
    expect(messagesList.value[0].text).toBe("Message 1");
    expect(messagesList.value[1].text).toBe("Message 2");
  });

  it("devrait synchroniser les événements SAID émis par le store gameStore", async () => {
    const store = useGameStore();
    store.perspective = "A";
    store.players.A = { name: "Pinpin" };
    store.players.B = { name: "Evangelyne" };

    const { messagesList } = useInGameChat();

    // Re-assignation pour déclencher la réactivité de shallowRef
    store.events = [
      {
        gameId: "g1",
        seq: 10,
        parentSeq: 9,
        actor: "B",
        type: "SAID",
        payload: { text: "Attaque !" },
        ts: Date.now(),
      },
    ];

    expect(messagesList.value).toHaveLength(1);
    expect(messagesList.value[0].senderName).toBe("Evangelyne");
    expect(messagesList.value[0].text).toBe("Attaque !");
    expect(messagesList.value[0].isSelf).toBe(false);
  });
});
