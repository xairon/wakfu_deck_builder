<template>
  <!-- Invite de MISE À JOUR : un nouveau bundle est prêt (service worker en
       attente). Sans elle, un onglet ou une PWA installée restait sur
       l'ANCIENNE version indéfiniment — source de faux bugs (« la musique ne
       joue pas », « le bot ne fait rien ») déjà corrigés côté code mais
       invisibles pour un client périmé. -->
  <Transition name="pwa-update">
    <div
      v-if="needRefresh"
      class="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2"
      role="alertdialog"
      aria-label="Mise à jour disponible"
    >
      <div
        class="flex items-center gap-3 rounded-xl border border-primary/50 bg-base-200 px-4 py-3 shadow-xl"
      >
        <span class="text-sm">
          ✨ Nouvelle version disponible — recharge pour en profiter.
        </span>
        <button
          class="btn btn-primary btn-sm"
          data-testid="pwa-update-reload"
          @click="updateServiceWorker(true)"
        >
          Mettre à jour
        </button>
        <button
          class="btn btn-ghost btn-sm"
          aria-label="Plus tard"
          @click="needRefresh = false"
        >
          ✕
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useRegisterSW } from "virtual:pwa-register/vue";

// `prompt` (vite.config) : le nouveau SW attend notre feu vert —
// updateServiceWorker(true) l'active ET recharge la page (bundle frais).
const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

<style scoped>
.pwa-update-enter-active,
.pwa-update-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.pwa-update-enter-from,
.pwa-update-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
