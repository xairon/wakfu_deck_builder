import { ref, computed, onMounted, onUnmounted } from "vue";
import { supabase } from "@/services/supabase";

const isOnline = ref(typeof navigator !== "undefined" ? navigator.onLine : true);
const isServerConnected = ref(true);
let listenersCount = 0;

export function useNetworkStatus() {
  function updateOnlineStatus() {
    isOnline.value = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline.value) {
      isServerConnected.value = false;
    } else {
      void checkServerConnectivity();
    }
  }

  async function checkServerConnectivity() {
    if (!isOnline.value) {
      isServerConnected.value = false;
      return;
    }
    if (!supabase) {
      // Pas de Supabase configuré : mode hors-ligne / local
      isServerConnected.value = false;
      return;
    }
    try {
      // Vérification rapide de l'état de la connexion Realtime ou auth
      const isSocketConnected = (supabase.realtime as any)?.isConnected?.();
      if (typeof isSocketConnected === "boolean" && isSocketConnected) {
        isServerConnected.value = true;
        return;
      }
      // Ping léger sur la session Supabase
      const { error } = await supabase.auth.getSession();
      isServerConnected.value = !error;
    } catch {
      isServerConnected.value = false;
    }
  }

  onMounted(() => {
    if (listenersCount === 0 && typeof window !== "undefined") {
      window.addEventListener("online", updateOnlineStatus);
      window.addEventListener("offline", updateOnlineStatus);
    }
    listenersCount++;
    void checkServerConnectivity();
  });

  onUnmounted(() => {
    listenersCount--;
    if (listenersCount <= 0 && typeof window !== "undefined") {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      listenersCount = 0;
    }
  });

  const status = computed<"online" | "connecting" | "offline">(() => {
    if (!isOnline.value) return "offline";
    if (!isServerConnected.value) return "connecting";
    return "online";
  });

  const label = computed<string>(() => {
    if (!isOnline.value) return "Hors-ligne";
    if (!isServerConnected.value) return "Serveur en attente";
    return "En ligne (Serveur connecté)";
  });

  const badgeClass = computed<string>(() => {
    if (!isOnline.value) return "badge-error text-error-content";
    if (!isServerConnected.value) return "badge-warning text-warning-content";
    return "badge-success text-success-content";
  });

  const dotClass = computed<string>(() => {
    if (!isOnline.value) return "bg-error";
    if (!isServerConnected.value) return "bg-warning animate-pulse";
    return "bg-success animate-pulse";
  });

  return {
    isOnline,
    isServerConnected,
    status,
    label,
    badgeClass,
    dotClass,
    checkServerConnectivity,
  };
}
