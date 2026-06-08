<template>
  <div>
    <!-- Utilisateur connecté -->
    <div v-if="authStore.isAuthenticated" class="dropdown dropdown-end">
      <label
        tabindex="0"
        class="btn btn-ghost btn-sm gap-2"
        aria-label="Menu utilisateur"
        role="button"
        aria-haspopup="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="hidden sm:inline text-xs max-w-[140px] truncate">
          {{ authStore.userEmail }}
        </span>
      </label>
      <ul
        tabindex="0"
        class="dropdown-content z-[1] menu p-2 shadow-lg bg-base-200 rounded-box w-60"
      >
        <li class="menu-title flex-col items-start gap-1">
          <span class="text-xs opacity-70">Connecté en tant que</span>
          <span class="text-sm font-semibold truncate w-full">{{
            authStore.userEmail
          }}</span>
          <span class="badge badge-primary badge-xs">Synchronisé · Cloud</span>
        </li>
        <li>
          <button @click="handleSignOut" class="text-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                clip-rule="evenodd"
              />
            </svg>
            Déconnexion
          </button>
        </li>
      </ul>
    </div>

    <!-- Non connecté -->
    <router-link
      v-else
      to="/auth"
      class="btn btn-primary btn-sm gap-2"
      aria-label="Se connecter ou créer un compte"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="hidden sm:inline">Connexion</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

async function handleSignOut() {
  await authStore.signOut();
  toast.info("Déconnexion réussie");
  router.push("/");
}
</script>
