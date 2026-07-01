<template>
  <Transition name="pwa-banner">
    <div
      v-if="showBanner"
      class="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-0 md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
    >
      <div class="bg-base-200 border border-base-300 rounded-box shadow-xl p-4">
        <div class="flex items-start gap-3">
          <img
            src="/images/pwa-192x192.png"
            alt="Wakfu Deck Builder"
            class="w-12 h-12 rounded-lg flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-sm">Installer Wakfu Deck Builder</h3>
            <p class="text-xs text-base-content/70 mt-1">
              Installez l'application pour la lancer en un tap depuis votre
              écran d'accueil.
            </p>
          </div>
          <button
            class="btn btn-ghost btn-xs btn-circle flex-shrink-0"
            aria-label="Fermer"
            @click="dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-primary btn-sm flex-1" @click="installApp">
            Installer
          </button>
          <button class="btn btn-ghost btn-sm" @click="dismiss">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "wakfu-pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const showBanner = ref(false);
let deferredPrompt: BeforeInstallPromptEvent | null = null;

function isMobileOrTablet(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  );
}

function wasDismissedRecently(): boolean {
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const dismissedAt = parseInt(dismissed, 10);
  return Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

function handleBeforeInstallPrompt(e: Event) {
  // Prevent the default browser install prompt
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;

  // Only show banner on mobile/tablet and if not recently dismissed
  if (isMobileOrTablet() && !wasDismissedRecently()) {
    showBanner.value = true;
  }
}

function handleAppInstalled() {
  showBanner.value = false;
  deferredPrompt = null;
  localStorage.removeItem(DISMISS_KEY);
}

async function installApp() {
  if (!deferredPrompt) return;

  try {
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      showBanner.value = false;
    } else {
      // User dismissed the native prompt, mark as dismissed
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      showBanner.value = false;
    }
  } catch {
    // Silently handle prompt errors
    showBanner.value = false;
  }

  deferredPrompt = null;
}

function dismiss() {
  showBanner.value = false;
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
}

onMounted(() => {
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.removeEventListener("appinstalled", handleAppInstalled);
});
</script>

<style scoped>
.pwa-banner-enter-active {
  transition: all 0.3s ease-out;
}

.pwa-banner-leave-active {
  transition: all 0.2s ease-in;
}

.pwa-banner-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.pwa-banner-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
