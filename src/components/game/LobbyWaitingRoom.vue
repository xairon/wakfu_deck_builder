<script setup lang="ts">
import { ref, computed } from "vue";

export interface LobbyPlayerSlot {
  name: string;
  deckName?: string;
  isHost?: boolean;
  ready?: boolean;
}

const props = withDefaults(
  defineProps<{
    code: string;
    mode?: "1v1" | "2v2";
    isHost?: boolean;
    currentPlayers?: number;
    maxPlayers?: number;
    players?: LobbyPlayerSlot[];
    canStart?: boolean;
  }>(),
  {
    mode: "1v1",
    isHost: false,
    currentPlayers: 1,
    maxPlayers: 2,
    players: () => [],
    canStart: false,
  },
);

const emit = defineEmits<{
  (e: "leave"): void;
  (e: "start"): void;
  (e: "toggleReady"): void;
}>();

const linkCopied = ref(false);
const codeCopied = ref(false);

const inviteUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/play/table/${props.code}`;
});

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    linkCopied.value = true;
    setTimeout(() => {
      linkCopied.value = false;
    }, 2500);
  } catch {
    /* fallback copy */
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code);
    codeCopied.value = true;
    setTimeout(() => {
      codeCopied.value = false;
    }, 2500);
  } catch {
    /* fallback */
  }
}

const isFull = computed(() => props.currentPlayers >= props.maxPlayers);
</script>

<template>
  <div class="rounded-xl border border-primary/30 bg-base-100/90 shadow-xl backdrop-blur-md p-6 sm:p-8 space-y-6">
    <!-- En-tête du Salon -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-base-content/10 pb-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="badge badge-primary font-semibold uppercase tracking-wider text-xs">
            {{ mode === '1v1' ? 'Duel 1v1' : 'Équipes 2v2' }}
          </span>
          <span
            class="badge text-xs font-medium"
            :class="isFull ? 'badge-success' : 'badge-warning'"
          >
            {{ isFull ? 'Complet' : 'En attente' }}
          </span>
        </div>
        <h2 class="font-display text-2xl sm:text-3xl text-base-content">
          Salon de partie
        </h2>
      </div>

      <button
        class="btn btn-ghost btn-sm text-error hover:bg-error/10"
        @click="emit('leave')"
      >
        ✕ Quitter le salon
      </button>
    </div>

    <!-- Zone de partage du Code et du Lien d'invitation -->
    <div class="rounded-lg bg-base-200/70 border border-base-content/10 p-5 text-center space-y-4">
      <p class="text-xs uppercase tracking-widest text-base-content/60 font-semibold">
        Code d'invitation unique
      </p>

      <div class="flex items-center justify-center gap-3">
        <span class="font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.25em] text-primary select-all">
          {{ code }}
        </span>
        <button
          class="btn btn-circle btn-sm btn-ghost"
          :title="codeCopied ? 'Copié !' : 'Copier le code'"
          @click="copyCode"
        >
          <span v-if="codeCopied" class="text-success text-lg">✓</span>
          <span v-else class="text-base">📋</span>
        </button>
      </div>

      <!-- Bouton Copier le lien d'invitation -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <button
          class="btn btn-primary btn-sm gap-2 px-6 shadow-md transition-all hover:scale-105"
          :class="{ 'btn-success': linkCopied }"
          @click="copyInviteLink"
        >
          <span v-if="linkCopied">✓ Lien copié dans le presse-papier !</span>
          <span v-else>🔗 Copier le lien d'invitation</span>
        </button>
      </div>
      <p class="text-xs text-base-content/60">
        Partage ce lien ou ce code à ton adversaire pour qu'il rejoigne la partie directement.
      </p>
    </div>

    <!-- Jauge et statut des joueurs -->
    <div class="space-y-3">
      <div class="flex items-center justify-between text-sm font-medium">
        <span class="text-base-content/80 flex items-center gap-2">
          <span>👥 Joueurs connectés</span>
          <span
            class="h-2 w-2 rounded-full"
            :class="isFull ? 'bg-success' : 'bg-warning animate-ping'"
          ></span>
        </span>
        <span class="font-mono font-bold text-base" :class="isFull ? 'text-success' : 'text-warning'">
          {{ currentPlayers }} / {{ maxPlayers }}
        </span>
      </div>

      <!-- Barre de progression -->
      <progress
        class="progress w-full h-2.5 transition-all"
        :class="isFull ? 'progress-success' : 'progress-warning'"
        :value="currentPlayers"
        :max="maxPlayers"
      ></progress>
    </div>

    <!-- Liste dynamique des participants -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="(p, index) in players"
        :key="index"
        class="flex items-center justify-between rounded-lg border bg-base-200/40 p-3.5 transition-all"
        :class="p.ready ? 'border-success/40 bg-success/5' : 'border-base-content/10'"
      >
        <div class="flex items-center gap-3">
          <div class="avatar placeholder">
            <div class="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
              <span>{{ p.name.charAt(0).toUpperCase() }}</span>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-sm">{{ p.name }}</span>
              <span v-if="p.isHost" class="badge badge-xs badge-primary">Hôte</span>
            </div>
            <p v-if="p.deckName" class="text-xs text-base-content/60 truncate max-w-[160px]">
              {{ p.deckName }}
            </p>
          </div>
        </div>

        <span
          class="badge badge-sm font-medium"
          :class="p.ready ? 'badge-success text-success-content' : 'badge-ghost text-base-content/60'"
        >
          {{ p.ready ? 'Prêt' : 'En attente' }}
        </span>
      </div>

      <!-- Slots vides -->
      <div
        v-for="emptySlot in Math.max(0, maxPlayers - players.length)"
        :key="'empty-' + emptySlot"
        class="flex items-center justify-center rounded-lg border border-dashed border-base-content/20 p-3.5 text-xs text-base-content/50 italic bg-base-200/20"
      >
        En attente de connexion…
      </div>
    </div>

    <!-- Actions du salon -->
    <div class="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-base-content/10">
      <div class="text-xs text-base-content/60">
        <span v-if="!isFull" class="text-warning">
          ⏳ En attente de l'adversaire avant de lancer…
        </span>
        <span v-else class="text-success font-medium">
          ✅ Tous les joueurs sont prêts !
        </span>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="!isHost"
          class="btn btn-sm btn-outline"
          @click="emit('toggleReady')"
        >
          Basculer état Prêt
        </button>

        <button
          v-if="isHost"
          class="btn btn-primary btn-sm px-6"
          :disabled="!canStart"
          @click="emit('start')"
        >
          🚀 Lancer la partie
        </button>
      </div>
    </div>
  </div>
</template>
