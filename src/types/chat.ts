export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string; // Heure formatée (ex: "14:35")
  createdAt: number; // Timestamp Unix ms
  isSelf: boolean;
  type?: "user" | "system";
}

export interface UseInGameChatOptions {
  /** Nom du joueur local (ex: "Joueur 1" ou pseudo) */
  localPlayerName?: string;
  /** Nom de l'adversaire (ex: "Joueur 2" ou pseudo) */
  opponentPlayerName?: string;
  /** Callback optionnel d'envoi réseau direct (si hors gameStore) */
  onSendMessage?: (text: string) => void | Promise<void>;
}
