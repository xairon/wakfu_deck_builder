import { supabase } from "./supabase";

export interface OnlineUser {
  userId: string;
  username: string;
  onlineAt: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  channel: "general" | "private";
  content: string;
  created_at: string;
}

export interface SystemNotificationItem {
  id: string;
  type: "system";
  systemType: "online" | "offline" | "info";
  systemText: string;
  created_at: string;
}

export type ConversationItem =
  | (ChatMessage & { type?: "message" })
  | SystemNotificationItem;

function client() {
  if (!supabase) throw new Error("Supabase non configuré");
  return supabase;
}

/**
 * Gère la présence globale des utilisateurs en ligne sur le site.
 * Utilise Supabase Realtime Presence sur le canal `community:presence`.
 */
export function trackCommunityPresence(
  currentUser: { id: string; username: string },
  onPresenceChange: (users: OnlineUser[]) => void,
  onUserEvent?: (event: {
    type: "join" | "leave";
    userId: string;
    username?: string;
  }) => void,
): () => void {
  if (!supabase) {
    onPresenceChange([]);
    return () => {};
  }

  const c = client();
  const channel = c.channel("community:presence", {
    config: {
      presence: { key: currentUser.id },
      broadcast: { self: true },
    },
  });

  const extractUsers = () => {
    const state = channel.presenceState() as Record<
      string,
      Array<{ userId?: string; username?: string; onlineAt?: number }>
    >;
    const userMap = new Map<string, OnlineUser>();

    for (const [key, entries] of Object.entries(state)) {
      if (entries && entries.length > 0) {
        const item = entries[0];
        const uId = item?.userId || key;
        const uName = item?.username || "Aventurier";
        const oAt = item?.onlineAt || Date.now();
        userMap.set(uId, { userId: uId, username: uName, onlineAt: oAt });
      }
    }

    onPresenceChange(Array.from(userMap.values()));
  };

  channel
    .on("presence", { event: "sync" }, extractUsers)
    .on("presence", { event: "join" }, ({ key, newPresences }) => {
      extractUsers();
      const first = newPresences?.[0] as
        | { userId?: string; username?: string }
        | undefined;
      onUserEvent?.({
        type: "join",
        userId: first?.userId || key,
        username: first?.username,
      });
    })
    .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      extractUsers();
      const first = leftPresences?.[0] as
        | { userId?: string; username?: string }
        | undefined;
      onUserEvent?.({
        type: "leave",
        userId: first?.userId || key,
        username: first?.username,
      });
    });

  let isSubscribed = false;
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      isSubscribed = true;
      void channel.track({
        userId: currentUser.id,
        username: currentUser.username,
        onlineAt: Date.now(),
      });
    }
  });

  return () => {
    if (isSubscribed) {
      void channel.untrack();
    }
    void c.removeChannel(channel);
  };
}

/**
 * Récupère les messages récents du chat général.
 */
export async function fetchGeneralMessages(
  limit = 80,
): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const c = client();
  try {
    const { data, error } = await c
      .from("chat_messages")
      .select("*")
      .eq("channel", "general")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Impossible de récupérer les messages généraux:", error);
      return [];
    }
    const msgs = (data as ChatMessage[]) || [];
    // Remettre dans l'ordre chronologique
    return msgs.reverse();
  } catch (err) {
    console.warn("Erreur fetchGeneralMessages:", err);
    return [];
  }
}

/**
 * Récupère les messages d'une conversation privée entre deux utilisateurs.
 */
export async function fetchPrivateMessages(
  otherUserId: string,
  limit = 80,
): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const c = client();
  try {
    const { data: authData } = await c.auth.getUser();
    const myId = authData?.user?.id;
    if (!myId) return [];

    const { data, error } = await c
      .from("chat_messages")
      .select("*")
      .eq("channel", "private")
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${myId})`,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Impossible de récupérer la conversation privée:", error);
      return [];
    }
    const msgs = (data as ChatMessage[]) || [];
    return msgs.reverse();
  } catch (err) {
    console.warn("Erreur fetchPrivateMessages:", err);
    return [];
  }
}

/**
 * Envoie un message dans le chat général.
 */
export async function sendGeneralMessage(
  senderName: string,
  content: string,
): Promise<ChatMessage> {
  const c = client();
  const { data: authData } = await c.auth.getUser();
  const sender_id = authData?.user?.id;
  if (!sender_id) throw new Error("Vous devez être connecté");

  const cleanContent = content.trim();
  if (!cleanContent) throw new Error("Le message ne peut pas être vide");

  const payload = {
    sender_id,
    sender_name: senderName,
    recipient_id: null,
    channel: "general" as const,
    content: cleanContent,
  };

  const { data, error } = await c
    .from("chat_messages")
    .insert(payload)
    .select()
    .single();

  if (error) {
    // Si la table n'existe pas encore ou erreur réseau, on génère un message local et on diffuse
    const fallbackMsg: ChatMessage = {
      id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      sender_id,
      sender_name: senderName,
      recipient_id: null,
      channel: "general",
      content: cleanContent,
      created_at: new Date().toISOString(),
    };
    broadcastCommunityMessage(fallbackMsg);
    return fallbackMsg;
  }

  const created = data as ChatMessage;
  broadcastCommunityMessage(created);
  return created;
}

/**
 * Envoie un message privé à un utilisateur.
 */
export async function sendPrivateMessage(
  recipientId: string,
  senderName: string,
  content: string,
): Promise<ChatMessage> {
  const c = client();
  const { data: authData } = await c.auth.getUser();
  const sender_id = authData?.user?.id;
  if (!sender_id) throw new Error("Vous devez être connecté");

  const cleanContent = content.trim();
  if (!cleanContent) throw new Error("Le message ne peut pas être vide");

  const payload = {
    sender_id,
    sender_name: senderName,
    recipient_id: recipientId,
    channel: "private" as const,
    content: cleanContent,
  };

  const { data, error } = await c
    .from("chat_messages")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "42501" || error.message.includes("policy")) {
      throw new Error(
        "Impossible d'envoyer le message : cet utilisateur vous a bloqué ou est bloqué.",
      );
    }
    // Repli de secours
    const fallbackMsg: ChatMessage = {
      id: "local-priv-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      sender_id,
      sender_name: senderName,
      recipient_id: recipientId,
      channel: "private",
      content: cleanContent,
      created_at: new Date().toISOString(),
    };
    broadcastCommunityMessage(fallbackMsg);
    return fallbackMsg;
  }

  const created = data as ChatMessage;
  broadcastCommunityMessage(created);
  return created;
}

/**
 * Récupère l'ensemble des messages privés de l'utilisateur connecté
 * pour initialiser les conversations récentes.
 */
export async function fetchMyPrivateConversations(
  limit = 100,
): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const c = client();
  try {
    const { data: authData } = await c.auth.getUser();
    const myId = authData?.user?.id;
    if (!myId) return [];

    const { data, error } = await c
      .from("chat_messages")
      .select("*")
      .eq("channel", "private")
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.warn("Impossible de charger les messages privés:", error);
      return [];
    }
    return (data as ChatMessage[]) || [];
  } catch (err) {
    console.warn("Erreur fetchMyPrivateConversations:", err);
    return [];
  }
}

// Canal Realtime partagé unique pour les abonnements et diffusions de chat
let activeChatChannel: any = null;
let chatSubscribers: ((msg: ChatMessage) => void)[] = [];

function getSharedChatChannel() {
  if (!supabase) return null;
  if (!activeChatChannel) {
    const c = client();
    activeChatChannel = c.channel("community:chat", {
      config: { broadcast: { self: false } },
    });

    activeChatChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          if (payload.new) {
            for (const sub of chatSubscribers) {
              sub(payload.new as ChatMessage);
            }
          }
        },
      )
      .on("broadcast", { event: "new_message" }, ({ payload }: any) => {
        if (payload) {
          for (const sub of chatSubscribers) {
            sub(payload as ChatMessage);
          }
        }
      })
      .subscribe();
  }
  return activeChatChannel;
}

export function broadcastCommunityMessage(msg: ChatMessage) {
  try {
    const ch = getSharedChatChannel();
    if (ch) {
      void ch.send({
        type: "broadcast",
        event: "new_message",
        payload: msg,
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * S'abonne aux messages de chat (via Postgres Changes et/ou Broadcast sur community:chat).
 */
export function subscribeToChat(
  onMessage: (msg: ChatMessage) => void,
): () => void {
  if (!supabase) return () => {};

  chatSubscribers.push(onMessage);
  getSharedChatChannel();

  return () => {
    chatSubscribers = chatSubscribers.filter((s) => s !== onMessage);
    if (chatSubscribers.length === 0 && activeChatChannel) {
      const c = client();
      void c.removeChannel(activeChatChannel);
      activeChatChannel = null;
    }
  };
}

/**
 * Récupère la liste des IDs des utilisateurs bloqués par l'utilisateur connecté.
 */
export async function fetchBlockedUsers(): Promise<string[]> {
  if (!supabase) return [];
  const c = client();
  try {
    const { data: authData } = await c.auth.getUser();
    const myId = authData?.user?.id;
    if (!myId) return [];

    const { data, error } = await c
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", myId);

    if (error) {
      console.warn("Impossible de récupérer les utilisateurs bloqués:", error);
      return [];
    }

    return (data as Array<{ blocked_id: string }>).map((r) => r.blocked_id);
  } catch (err) {
    console.warn("Erreur fetchBlockedUsers:", err);
    return [];
  }
}

/**
 * Bloque un utilisateur.
 */
export async function blockUser(
  blockedId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase non configuré" };
  const c = client();
  try {
    const { data: authData } = await c.auth.getUser();
    const blocker_id = authData?.user?.id;
    if (!blocker_id) return { ok: false, error: "Non connecté" };
    if (blocker_id === blockedId) {
      return { ok: false, error: "Vous ne pouvez pas vous bloquer vous-même" };
    }

    const { error } = await c.from("user_blocks").insert({
      blocker_id,
      blocked_id: blockedId,
    });

    if (error && error.code !== "23505") {
      // 23505 = déjà bloqué
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Débloque un utilisateur.
 */
export async function unblockUser(
  blockedId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase non configuré" };
  const c = client();
  try {
    const { data: authData } = await c.auth.getUser();
    const blocker_id = authData?.user?.id;
    if (!blocker_id) return { ok: false, error: "Non connecté" };

    const { error } = await c
      .from("user_blocks")
      .delete()
      .eq("blocker_id", blocker_id)
      .eq("blocked_id", blockedId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
