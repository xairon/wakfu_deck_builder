import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface SandboxBroadcastEvent {
  type: "CARD_MOVED" | "CARD_TAPPED" | "CARD_FLIPPED" | "DICE_ROLLED" | "CHAT" | "COUNTER_CHANGED";
  payload: Record<string, unknown>;
  senderId: string;
}

export function useSandboxRealtime(gameId: string, currentUserId: string) {
  const channel = ref<any>(null);
  const connected = ref(false);

  function connect(onEvent: (event: SandboxBroadcastEvent) => void) {
    if (!supabase || !gameId) return;

    channel.value = supabase.channel(`sandbox:${gameId}`, {
      config: { broadcast: { self: false } },
    });

    channel.value
      .on("broadcast", { event: "sandbox_action" }, (payload: { payload: unknown }) => {
        const data = payload.payload as SandboxBroadcastEvent;
        if (data && data.senderId !== currentUserId) {
          onEvent(data);
        }
      })
      .subscribe((status: string) => {
        connected.value = status === "SUBSCRIBED";
      });
  }

  function broadcastAction(type: SandboxBroadcastEvent["type"], payload: Record<string, unknown>) {
    if (!channel.value || !connected.value) return;
    channel.value.send({
      type: "broadcast",
      event: "sandbox_action",
      payload: {
        type,
        payload,
        senderId: currentUserId,
      },
    });
  }

  function disconnect() {
    if (channel.value) {
      void (supabase as any)?.removeChannel(channel.value);
      channel.value = null;
      connected.value = false;
    }
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    connect,
    broadcastAction,
    disconnect,
  };
}
