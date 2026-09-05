import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/authStore";

const STORAGE_KEY = "wakfu_player_pseudonym";

// État partagé (singleton) pour que tout changement se reflète instantanément partout
const pseudonym = ref<string>("");
let isInitialized = false;

function generateRandomFallback(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Joueur-${num}`;
}

export function _resetPseudonymForTesting(): void {
  pseudonym.value = "";
  isInitialized = false;
}

export function usePlayerPseudonym() {
  const authStore = useAuthStore();

  if (!isInitialized) {
    // 1. Priorité au localStorage
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved && saved.trim()) {
      pseudonym.value = saved.trim();
    } else {
      // 2. Repli sur le nom du compte ou email
      const user = authStore.user;
      const accountName = user?.displayName || user?.email?.split("@")[0];
      if (accountName && accountName.trim()) {
        pseudonym.value = accountName.trim();
      } else {
        // 3. Fallback aléatoire
        pseudonym.value = generateRandomFallback();
      }
      try {
        localStorage.setItem(STORAGE_KEY, pseudonym.value);
      } catch {
        /* ignore localStorage quota/disabled */
      }
    }
    isInitialized = true;
  }

  function setPseudonym(newName: string): { ok: boolean; error?: string } {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      return { ok: false, error: "Le pseudo doit contenir au moins 2 caractères." };
    }
    if (trimmed.length > 24) {
      return { ok: false, error: "Le pseudo ne peut pas dépasser 24 caractères." };
    }
    pseudonym.value = trimmed;
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  const isCustomized = computed(() => {
    return !pseudonym.value.startsWith("Joueur-");
  });

  return {
    pseudonym,
    setPseudonym,
    isCustomized,
  };
}
