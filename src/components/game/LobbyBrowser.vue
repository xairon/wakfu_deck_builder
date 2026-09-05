<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  subscribeToHostedLobbies,
  fetchHostedLobbiesFromDb,
  type HostedLobbyInfo,
} from "@/services/lobbyDiscoveryService";

const emit = defineEmits<{
  (e: "join", lobby: HostedLobbyInfo): void;
  (e: "host"): void;
}>();

const lobbies = ref<HostedLobbyInfo[]>([]);
const searchQuery = ref("");
const isRefreshing = ref(false);
let unsubscribe: (() => void) | null = null;

function formatElapsed(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  return `Il y a ${diffHours} h`;
}

async function refresh() {
  isRefreshing.value = true;
  try {
    const dbLobbies = await fetchHostedLobbiesFromDb();
    if (dbLobbies.length > 0) {
      // Fusionner avec les lobbies Realtime existants
      const existingCodes = new Set(lobbies.value.map((l) => l.code));
      for (const d of dbLobbies) {
        if (!existingCodes.has(d.code)) {
          lobbies.value.push(d);
        }
      }
    }
  } finally {
    setTimeout(() => {
      isRefreshing.value = false;
    }, 400);
  }
}

onMounted(() => {
  unsubscribe = subscribeToHostedLobbies((updated) => {
    lobbies.value = updated;
  });
  void refresh();
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
});

const filteredLobbies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return lobbies.value;
  return lobbies.value.filter(
    (l) =>
      l.code.toLowerCase().includes(q) ||
      l.hostName.toLowerCase().includes(q) ||
      (l.deckName && l.deckName.toLowerCase().includes(q)),
  );
});
</script>

<template>
  <div class="space-y-4">
    <!-- Barre de recherche et statut en direct -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
        </span>
        <span class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
          En direct · {{ filteredLobbies.length }} partie{{ filteredLobbies.length > 1 ? 's' : '' }} disponible{{ filteredLobbies.length > 1 ? 's' : '' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <input
          v-model="searchQuery"
          placeholder="Filtrer par code ou joueur…"
          class="input input-bordered input-xs w-48 bg-base-200"
        />
        <button
          class="btn btn-ghost btn-xs"
          :class="{ 'loading loading-spinner': isRefreshing }"
          title="Actualiser la liste"
          @click="refresh"
        >
          🔄
        </button>
      </div>
    </div>

    <!-- Liste des salons -->
    <div v-if="filteredLobbies.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div
        v-for="lobby in filteredLobbies"
        :key="lobby.code"
        class="rounded-lg border border-base-content/15 bg-base-200/50 hover:bg-base-200/80 transition-all p-4 flex flex-col justify-between gap-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="badge badge-sm" :class="lobby.mode === '1v1' ? 'badge-primary' : 'badge-info'">
                {{ lobby.mode === '1v1' ? 'Duel 1v1' : 'Équipe 2v2' }}
              </span>
              <span class="font-mono text-sm font-bold tracking-wider text-base-content">
                {{ lobby.code }}
              </span>
            </div>
            <p class="text-sm font-semibold text-base-content/90">
              Hôte : {{ lobby.hostName }}
            </p>
            <p v-if="lobby.deckName" class="text-xs text-base-content/60">
              Deck : {{ lobby.deckName }}
            </p>
          </div>

          <div class="text-right">
            <span class="badge badge-sm font-mono" :class="lobby.currentPlayers >= lobby.maxPlayers ? 'badge-warning' : 'badge-ghost'">
              {{ lobby.currentPlayers }} / {{ lobby.maxPlayers }}
            </span>
            <p class="text-[11px] text-base-content/50 mt-1">
              {{ formatElapsed(lobby.createdAt) }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-base-content/10">
          <span class="text-xs text-success flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            En attente d'adversaire
          </span>
          <button
            class="btn btn-primary btn-xs px-4"
            @click="emit('join', lobby)"
          >
            Rejoindre
          </button>
        </div>
      </div>
    </div>

    <!-- État vide -->
    <div
      v-else
      class="rounded-xl border border-dashed border-base-content/20 bg-base-200/30 p-8 text-center space-y-3"
    >
      <div class="text-3xl">⚔️</div>
      <h3 class="font-display text-base font-semibold text-base-content/80">
        Aucune partie publique en attente
      </h3>
      <p class="text-xs text-base-content/60 max-w-sm mx-auto">
        Il n'y a actuellement aucun salon ouvert. Sois le premier à héberger une partie et invite un ami !
      </p>
      <button
        class="btn btn-outline btn-primary btn-sm mt-2"
        @click="emit('host')"
      >
        Héberger une partie
      </button>
    </div>
  </div>
</template>
