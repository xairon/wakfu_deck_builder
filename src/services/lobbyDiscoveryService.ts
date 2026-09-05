import { supabase } from "./supabase";

export interface HostedLobbyInfo {
  code: string;
  gameId?: string;
  hostName: string;
  hostUserId?: string;
  mode: "1v1" | "2v2";
  deckName?: string;
  currentPlayers: number;
  maxPlayers: number;
  createdAt: number;
  status: "waiting" | "ready" | "started";
}

function client() {
  if (!supabase) throw new Error("Supabase non configuré");
  return supabase;
}

/**
 * Publie la présence d'un salon hébergé sur le canal public de découverte.
 * Dès que l'hôte quitte ou se déconnecte, Supabase Realtime retire automatiquement le salon.
 */
export function publishHostedLobby(lobby: HostedLobbyInfo): () => void {
  if (!supabase) return () => {};

  const c = client();
  const channel = c.channel("lobbies:discovery", {
    config: {
      presence: { key: lobby.code },
      broadcast: { self: false },
    },
  });

  let isSubscribed = false;

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      isSubscribed = true;
      void channel.track(lobby);
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
 * S'abonne en temps réel à la liste des salons hébergés disponibles.
 */
export function subscribeToHostedLobbies(
  callback: (lobbies: HostedLobbyInfo[]) => void,
): () => void {
  if (!supabase) {
    callback([]);
    return () => {};
  }

  const c = client();
  const channel = c.channel("lobbies:discovery", {
    config: {
      broadcast: { self: true },
    },
  });

  const extractLobbies = () => {
    const stateMap = channel.presenceState() as Record<string, HostedLobbyInfo[]>;
    const lobbies: HostedLobbyInfo[] = [];

    for (const [code, items] of Object.entries(stateMap)) {
      if (items && items.length > 0) {
        const item = items[0];
        // Ne garder que les salons en attente ou prêts qui ne sont pas expirés (> 1h)
        if (
          item &&
          item.code &&
          item.status !== "started" &&
          Date.now() - (item.createdAt || 0) < 3600000
        ) {
          lobbies.push(item);
        }
      }
    }

    // Trier du plus récent au plus ancien
    lobbies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(lobbies);
  };

  channel
    .on("presence", { event: "sync" }, extractLobbies)
    .on("presence", { event: "join" }, extractLobbies)
    .on("presence", { event: "leave" }, extractLobbies)
    .subscribe();

  // Exécution initiale
  extractLobbies();

  return () => {
    void c.removeChannel(channel);
  };
}

/**
 * Récupère les salons hébergés en combinant une éventuelle RPC Supabase et le canal Realtime.
 */
export async function fetchHostedLobbiesFromDb(): Promise<HostedLobbyInfo[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("list_open_games");
    if (error || !data) return [];
    return (data as any[]).map((row) => ({
      code: row.code,
      gameId: row.id,
      hostName: "Hôte",
      mode: "1v1",
      currentPlayers: 1,
      maxPlayers: 2,
      createdAt: new Date(row.created_at).getTime(),
      status: "waiting",
    }));
  } catch {
    return [];
  }
}
