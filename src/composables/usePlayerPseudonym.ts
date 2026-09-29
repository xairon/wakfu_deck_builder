import { ref, computed, watch } from "vue";
import { useAuthStore } from "@/stores/authStore";

const STORAGE_KEY = "wakfu_player_pseudonym";

// État partagé (singleton) pour que tout changement se reflète instantanément partout
const pseudonym = ref<string>("");
let isInitialized = false;

function isLikelyEmail(str: string): boolean {
  return str.includes("@");
}

export function generateRandomFallback(userId?: string | null): string {
  if (userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash * 31 + userId.charCodeAt(i)) % 9000;
    }
    const num = 1000 + Math.abs(hash);
    return `Joueur ${num}`;
  }
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Joueur ${num}`;
}

export function _resetPseudonymForTesting(): void {
  pseudonym.value = "";
  isInitialized = false;
}

export function usePlayerPseudonym() {
  const authStore = useAuthStore();

  if (!isInitialized) {
    // 1. Priorité au pseudo du compte connecté (profil Supabase)
    if (authStore.username && authStore.username.trim()) {
      pseudonym.value = authStore.username.trim();
    } else {
      // 2. Priorité au pseudo sauvegardé dans le localStorage (sauf s'il contenait un ancien email)
      const saved =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (saved && saved.trim() && !isLikelyEmail(saved)) {
        pseudonym.value = saved.trim();
      } else {
        // 3. Repli sur le displayName du compte (s'il ne contient pas d'email)
        const user = authStore.user;
        const displayName = user?.displayName;
        if (displayName && displayName.trim() && !isLikelyEmail(displayName)) {
          pseudonym.value = displayName.trim();
        } else {
          // 4. Génération obligatoire "Joueur" suivi d'un chiffre
          pseudonym.value = generateRandomFallback(user?.id);
        }
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, pseudonym.value);
    } catch {
      /* ignore localStorage quota/disabled */
    }
    isInitialized = true;
  }

  // Si le profil Supabase est chargé après l'initialisation, synchroniser le pseudo
  watch(
    () => authStore.username,
    (newUsername) => {
      if (newUsername && newUsername.trim()) {
        const clean = newUsername.trim();
        // Si le pseudo actuel est un fallback "Joueur ...", le remplacer automatiquement
        if (
          !pseudonym.value ||
          pseudonym.value.startsWith("Joueur ") ||
          pseudonym.value.startsWith("Joueur-")
        ) {
          pseudonym.value = clean;
          try {
            localStorage.setItem(STORAGE_KEY, clean);
          } catch {
            /* ignore */
          }
        }
      }
    },
    { immediate: true },
  );

  function setPseudonym(newName: string): { ok: boolean; error?: string } {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      return {
        ok: false,
        error: "Le pseudo doit contenir au moins 2 caractères.",
      };
    }
    if (trimmed.length > 24) {
      return {
        ok: false,
        error: "Le pseudo ne peut pas dépasser 24 caractères.",
      };
    }
    if (isLikelyEmail(trimmed)) {
      return {
        ok: false,
        error: "Pour des raisons de confidentialité, ton adresse email ne peut pas servir de pseudo.",
      };
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
    return (
      !pseudonym.value.startsWith("Joueur ") &&
      !pseudonym.value.startsWith("Joueur-")
    );
  });

  return {
    pseudonym,
    setPseudonym,
    isCustomized,
  };
}
