<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import { useCommunityStore } from "@/stores/communityStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";

const communityStore = useCommunityStore();
const authStore = useAuthStore();
const toast = useToast();
const route = useRoute();

const activeTab = computed({
  get: () => communityStore.activeTab,
  set: (val: "general" | "private" | "online" | "blocked") => {
    communityStore.activeTab = val;
  },
});
const sidebarTab = ref<"online" | "chats">("online");
const generalInput = ref("");
const privateInput = ref("");
const searchQuery = ref("");
const isSending = ref(false);

const generalScrollContainer = ref<HTMLElement | null>(null);
const privateScrollContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  communityStore.isCommunityViewActive = true;
  if (authStore.isAuthenticated) {
    await communityStore.initialize();
  }
  if (route?.query?.user && typeof route.query.user === "string") {
    startPrivateChat(route.query.user);
  } else if (communityStore.totalUnreadPrivate > 0) {
    sidebarTab.value = "chats";
  }
});

onUnmounted(() => {
  communityStore.isCommunityViewActive = false;
});

watch(
  () => route?.query?.user,
  (userId) => {
    if (userId && typeof userId === "string") {
      startPrivateChat(userId);
    }
  },
);

// Auto-scroll général
function scrollToBottomGeneral() {
  nextTick(() => {
    if (generalScrollContainer.value) {
      generalScrollContainer.value.scrollTop =
        generalScrollContainer.value.scrollHeight;
    }
  });
}

// Auto-scroll privé
function scrollToBottomPrivate() {
  nextTick(() => {
    if (privateScrollContainer.value) {
      privateScrollContainer.value.scrollTop =
        privateScrollContainer.value.scrollHeight;
    }
  });
}

watch(
  () => communityStore.filteredGeneralMessages.length,
  () => {
    if (activeTab.value === "general") {
      scrollToBottomGeneral();
    }
  },
);

watch(
  () => communityStore.activeConversationItems.length,
  () => {
    if (activeTab.value === "private") {
      scrollToBottomPrivate();
    }
  },
);

watch(
  () => communityStore.selectedUserId,
  (newId) => {
    if (newId) {
      activeTab.value = "private";
      scrollToBottomPrivate();
    }
  },
);

async function handleSendGeneral() {
  const text = generalInput.value.trim();
  if (!text || isSending.value) return;
  isSending.value = true;
  try {
    await communityStore.sendGeneral(text);
    generalInput.value = "";
    scrollToBottomGeneral();
  } catch (err) {
    toast.error((err as Error).message || "Erreur d'envoi");
  } finally {
    isSending.value = false;
  }
}

async function handleSendPrivate() {
  const text = privateInput.value.trim();
  if (!text || isSending.value) return;
  isSending.value = true;
  try {
    await communityStore.sendPrivate(text);
    privateInput.value = "";
    scrollToBottomPrivate();
  } catch (err) {
    toast.error((err as Error).message || "Erreur d'envoi");
  } finally {
    isSending.value = false;
  }
}

function startPrivateChat(userId: string, username?: string) {
  communityStore.openPrivateChat(userId, username);
  activeTab.value = "private";
  scrollToBottomPrivate();
}

function backToConversations() {
  communityStore.selectedUserId = null;
}

async function handleToggleBlock(userId: string, username: string) {
  try {
    const isNowBlocked = await communityStore.toggleBlockUser(userId);
    if (isNowBlocked) {
      toast.success(`${username} a été bloqué.`);
    } else {
      toast.success(`${username} a été débloqué.`);
    }
  } catch (err) {
    toast.error((err as Error).message || "Erreur lors du blocage");
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const filteredOnlineUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return communityStore.onlineOtherUsers;
  return communityStore.onlineOtherUsers.filter((u) =>
    u.username.toLowerCase().includes(q),
  );
});

const blockedList = computed(() => {
  return Array.from(communityStore.blockedUserIds).map((id) => ({
    userId: id,
    username: communityStore.getUsername(id),
  }));
});

const currentInterlocutorName = computed(() => {
  if (!communityStore.selectedUserId) return "";
  return communityStore.getUsername(communityStore.selectedUserId);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Non connecté -->
    <div
      v-if="!authStore.isAuthenticated"
      class="border border-base-content/20 bg-base-100 p-8 sm:p-10 text-center max-w-xl mx-auto space-y-4 shadow-xl relative overflow-hidden"
    >
      <div class="h-1 w-16 bg-primary mx-auto mb-4"></div>
      <div class="text-4xl mb-2">📜</div>
      <p class="eyebrow text-primary">Guilde des Messagers du Monde des Douze</p>
      <h2 class="font-display text-2xl sm:text-3xl text-base-content">
        Rejoins le Salon de la Communauté
      </h2>
      <p class="text-base-content/75 text-sm leading-relaxed max-w-md mx-auto">
        Connecte-toi à ton compte pour consulter le registre des aventuriers en ligne, partager tes exploits dans la taverne générale et échanger des missives privées avec les autres joueurs de Wakfu TCG.
      </p>
      <div class="pt-4">
        <router-link
          to="/auth?redirect=/communaute"
          class="btn btn-primary px-8 font-display tracking-wider uppercase text-xs"
        >
          Se connecter
        </router-link>
      </div>
    </div>

    <!-- Interface connectée -->
    <div v-else class="space-y-6">
      <!-- En-tête Grimoire -->
      <div class="border-b border-base-content/15 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            <span class="eyebrow text-primary">
              Hôtel des Messagers • En direct
            </span>
          </div>
          <h1 class="font-display text-3xl sm:text-4xl text-base-content leading-tight">
            Salon & Messagerie des Douze
          </h1>
          <p class="text-xs sm:text-sm text-base-content/65 font-sans mt-0.5">
            Retrouve les aventuriers en ligne, rejoins la discussion publique ou transmets une missive scellée.
          </p>
        </div>

        <!-- Compteur d'utilisateurs en ligne (Style Registre) -->
        <div class="flex items-center gap-3">
          <div class="border border-base-content/15 bg-base-200/60 px-4 py-2 flex items-center gap-3 shadow-sm rounded-sm">
            <div class="text-right">
              <p class="eyebrow text-[10px] text-base-content/60">
                Registre en ligne
              </p>
              <p class="font-mono text-lg font-bold text-success tabular">
                {{ communityStore.onlineUsers.length }} aventurier{{ communityStore.onlineUsers.length > 1 ? 's' : '' }}
              </p>
            </div>
            <span class="text-2xl opacity-90">🌐</span>
          </div>
        </div>
      </div>

      <!-- Navigation d'onglets (Style Marques-pages de Grimoire) -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-base-content/15 pb-px">
        <button
          type="button"
          class="border-b-2 px-4 py-2 font-display text-sm sm:text-base transition-all flex items-center gap-2"
          :class="
            activeTab === 'general'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-base-content/60 hover:text-base-content hover:border-base-content/30'
          "
          @click="activeTab = 'general'"
        >
          <span>💬</span>
          <span>Chat Général</span>
        </button>

        <button
          type="button"
          class="border-b-2 px-4 py-2 font-display text-sm sm:text-base transition-all flex items-center gap-2"
          :class="
            activeTab === 'online'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-base-content/60 hover:text-base-content hover:border-base-content/30'
          "
          @click="activeTab = 'online'"
        >
          <span>👥</span>
          <span>En ligne</span>
          <span class="badge badge-xs bg-success/20 text-success border-success/30 font-mono font-bold">
            {{ communityStore.onlineUsers.length }}
          </span>
        </button>

        <button
          type="button"
          class="border-b-2 px-4 py-2 font-display text-sm sm:text-base transition-all flex items-center gap-2"
          :class="
            activeTab === 'private'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-base-content/60 hover:text-base-content hover:border-base-content/30'
          "
          @click="activeTab = 'private'"
        >
          <span>✉️</span>
          <span>Privé {{ communityStore.selectedUserId ? `: ${currentInterlocutorName}` : '' }}</span>
          <span
            v-if="communityStore.totalUnreadPrivate > 0"
            class="badge badge-xs badge-error font-mono font-bold animate-pulse"
          >
            {{ communityStore.totalUnreadPrivate }}
          </span>
          <span
            v-else-if="communityStore.selectedUserId"
            class="h-2 w-2 rounded-full"
            :class="communityStore.isSelectedUserOnline ? 'bg-success' : 'bg-base-content/30'"
            :title="communityStore.isSelectedUserOnline ? 'En ligne' : 'Hors-ligne'"
          ></span>
        </button>

        <button
          type="button"
          class="border-b-2 ml-auto px-3 py-2 font-display text-xs sm:text-sm transition-all flex items-center gap-1.5"
          :class="
            activeTab === 'blocked'
              ? 'border-error text-error font-semibold'
              : 'border-transparent text-base-content/40 hover:text-base-content hover:border-base-content/20'
          "
          @click="activeTab = 'blocked'"
          title="Gérer les aventuriers bannis"
        >
          <span>🚫</span>
          <span>Bloqués ({{ communityStore.blockedUserIds.size }})</span>
        </button>
      </div>

      <!-- Grille principale de l'Hôtel des Messagers -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        <!-- ── COLONNE GAUCHE (Desktop) : REGISTRE & DISCUSSIONS ── -->
        <div class="hidden lg:block lg:col-span-4 space-y-4">
          <div class="border border-base-content/15 bg-base-200/40 p-4 space-y-3 rounded-sm">
            <!-- Sélecteur de vue latérale : En ligne vs Discussions -->
            <div class="flex items-center border border-base-content/15 bg-base-100 p-0.5 rounded-sm">
              <button
                type="button"
                class="flex-1 py-1.5 font-display text-xs transition-all text-center"
                :class="
                  sidebarTab === 'online'
                    ? 'bg-primary text-primary-content font-semibold shadow-sm'
                    : 'text-base-content/70 hover:text-base-content'
                "
                @click="sidebarTab = 'online'"
              >
                👥 En ligne ({{ communityStore.onlineUsers.length }})
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 font-display text-xs transition-all text-center flex items-center justify-center gap-1.5"
                :class="
                  sidebarTab === 'chats'
                    ? 'bg-primary text-primary-content font-semibold shadow-sm'
                    : 'text-base-content/70 hover:text-base-content'
                "
                @click="sidebarTab = 'chats'"
              >
                <span>✉️ Discussions</span>
                <span
                  v-if="communityStore.totalUnreadPrivate > 0"
                  class="badge badge-xs badge-error font-mono font-bold"
                >
                  {{ communityStore.totalUnreadPrivate }}
                </span>
                <span v-else class="badge badge-xs badge-ghost font-mono">
                  {{ communityStore.conversationList.length }}
                </span>
              </button>
            </div>

            <!-- Barre de recherche utilisateurs -->
            <div v-if="sidebarTab === 'online'" class="relative">
              <input
                v-model="searchQuery"
                placeholder="Rechercher un aventurier…"
                class="input input-bordered input-sm w-full bg-base-100 text-xs border-base-content/20 focus:border-primary pl-8 rounded-sm"
              />
              <span class="absolute left-2.5 top-2 text-base-content/40 text-xs">🔍</span>
            </div>

            <!-- VUE 1 : JOUEURS EN LIGNE -->
            <div v-if="sidebarTab === 'online'" class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <!-- Moi-même -->
              <div class="flex items-center justify-between p-2.5 border border-primary/30 bg-primary/5 rounded-sm">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-display font-bold flex items-center justify-center shadow-seal">
                    {{ communityStore.currentUsername.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-display font-semibold text-xs text-base-content">{{ communityStore.currentUsername }}</span>
                      <span class="badge badge-xs badge-primary font-mono text-[9px]">Moi</span>
                    </div>
                    <span class="text-[10px] text-success flex items-center gap-1 font-mono">
                      <span class="h-1.5 w-1.5 rounded-full bg-success"></span> Connecté
                    </span>
                  </div>
                </div>
              </div>

              <!-- Autres joueurs -->
              <div
                v-for="user in filteredOnlineUsers"
                :key="user.userId"
                class="flex items-center justify-between p-2.5 border border-base-content/10 bg-base-100 hover:border-primary/40 transition-all rounded-sm group"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-base-300 text-base-content text-xs font-display font-bold flex items-center justify-center border border-base-content/15">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="font-display font-semibold text-xs text-base-content group-hover:text-primary transition-colors">
                      {{ user.username }}
                    </p>
                    <span class="text-[10px] text-success flex items-center gap-1 font-mono">
                      <span class="h-1.5 w-1.5 rounded-full bg-success"></span> En ligne
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-primary hover:bg-primary/10"
                    title="Envoyer une missive privée"
                    @click="startPrivateChat(user.userId, user.username)"
                  >
                    ✉️
                  </button>

                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error/60 hover:text-error hover:bg-error/10"
                    :title="communityStore.blockedUserIds.has(user.userId) ? 'Débloquer' : 'Bloquer'"
                    @click="handleToggleBlock(user.userId, user.username)"
                  >
                    {{ communityStore.blockedUserIds.has(user.userId) ? '🔓' : '🚫' }}
                  </button>
                </div>
              </div>

              <div
                v-if="communityStore.onlineOtherUsers.length === 0"
                class="text-center py-8 text-xs text-base-content/50 italic font-display"
              >
                Aucun autre aventurier n'est présent dans la taverne pour l'instant.
              </div>
            </div>

            <!-- VUE 2 : DISCUSSIONS PRIVÉES EXISTANTES -->
            <div v-else class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <div
                v-for="conv in communityStore.conversationList"
                :key="conv.userId"
                class="p-2.5 border rounded-sm transition-all cursor-pointer"
                :class="
                  communityStore.selectedUserId === conv.userId
                    ? 'border-primary bg-primary/10'
                    : 'border-base-content/10 bg-base-100 hover:border-base-content/30'
                "
                @click="startPrivateChat(conv.userId, conv.username)"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-base-200 text-base-content text-xs font-display font-bold flex items-center justify-center border border-base-content/15 flex-shrink-0">
                      {{ conv.username.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-display font-semibold text-xs truncate">{{ conv.username }}</span>
                        <span
                          class="h-2 w-2 rounded-full flex-shrink-0"
                          :class="conv.isOnline ? 'bg-success shadow-[0_0_6px_rgba(47,161,90,0.8)]' : 'bg-base-content/30'"
                          :title="conv.isOnline ? 'En ligne' : 'Hors-ligne'"
                        ></span>
                      </div>
                      <p class="text-[11px] text-base-content/60 truncate max-w-[170px]">
                        {{ conv.lastMessage || 'Nouvelle missive' }}
                      </p>
                    </div>
                  </div>

                  <div class="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    <span v-if="conv.lastTime" class="font-mono text-[10px] text-base-content/50">
                      {{ formatTime(conv.lastTime) }}
                    </span>
                    <span
                      v-if="conv.unread > 0"
                      class="badge badge-xs badge-error font-mono font-bold"
                    >
                      {{ conv.unread }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-if="communityStore.conversationList.length === 0"
                class="text-center py-8 text-xs text-base-content/50 italic space-y-1 font-display"
              >
                <p>Aucune missive privée pour l'instant.</p>
                <p class="text-[10px] text-base-content/40 font-sans">
                  Choisis un joueur en ligne pour lui écrire !
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── ZONE PRINCIPALE : SALON & CHATS ── -->
        <div class="lg:col-span-8 flex flex-col">
          <!-- ══ ONGLET 1 : CHAT GÉNÉRAL (La Taverne) ══ -->
          <div
            v-if="activeTab === 'general'"
            class="border border-base-content/15 bg-base-100 flex flex-col h-[620px] shadow-sm overflow-hidden rounded-sm relative"
          >
            <!-- Filet cinabre supérieur -->
            <div class="h-1 w-full bg-primary/70"></div>

            <!-- En-tête du Chat -->
            <div class="p-3.5 border-b border-base-content/15 bg-base-200/50 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="text-xl">💬</span>
                <div>
                  <h2 class="font-display text-base font-semibold leading-tight text-base-content">
                    Chat Général
                  </h2>
                  <p class="text-[11px] text-base-content/60 font-sans">
                    Taverne publique du Monde des Douze • Messages visibles par tous
                  </p>
                </div>
              </div>
              <span class="eyebrow text-[10px] border border-base-content/20 px-2 py-0.5 rounded-sm bg-base-100">
                #public
              </span>
            </div>

            <!-- Liste des messages -->
            <div
              ref="generalScrollContainer"
              class="flex-1 overflow-y-auto p-4 space-y-3"
            >
              <div
                v-if="communityStore.filteredGeneralMessages.length === 0"
                class="h-full flex flex-col items-center justify-center text-center text-base-content/50 p-6 space-y-2"
              >
                <span class="text-4xl opacity-80">📜</span>
                <p class="font-display text-base">Le registre de la taverne est encore vierge.</p>
                <p class="text-xs text-base-content/50">Sois le premier aventurier à y déposer un mot !</p>
              </div>

              <div
                v-for="msg in communityStore.filteredGeneralMessages"
                :key="msg.id"
                class="flex flex-col"
                :class="msg.sender_id === authStore.userId ? 'items-end' : 'items-start'"
              >
                <!-- En-tête du message -->
                <div class="text-[11px] text-base-content/60 mb-1 flex items-center gap-1.5 px-1">
                  <span
                    class="font-display font-semibold"
                    :class="msg.sender_id === authStore.userId ? 'text-primary' : 'text-base-content/90'"
                  >
                    {{ msg.sender_name }}
                  </span>
                  <span class="text-base-content/30">•</span>
                  <time class="font-mono text-[10px] text-base-content/50">
                    {{ formatTime(msg.created_at) }}
                  </time>
                  <template v-if="msg.sender_id !== authStore.userId">
                    <button
                      type="button"
                      class="hover:text-primary transition-colors text-[10px] ml-1"
                      title="Envoyer une missive privée"
                      @click="startPrivateChat(msg.sender_id, msg.sender_name)"
                    >
                      ✉️
                    </button>
                    <button
                      type="button"
                      class="hover:text-error transition-colors text-[10px]"
                      title="Bloquer cet utilisateur"
                      @click="handleToggleBlock(msg.sender_id, msg.sender_name)"
                    >
                      🚫
                    </button>
                  </template>
                </div>

                <!-- Bulle parchemin du message -->
                <div
                  class="max-w-[85%] sm:max-w-[75%] rounded-md p-3 text-sm break-words border shadow-sm leading-relaxed"
                  :class="
                    msg.sender_id === authStore.userId
                      ? 'bg-primary/10 border-primary/30 text-base-content'
                      : 'bg-base-200/90 border-base-content/15 text-base-content'
                  "
                >
                  {{ msg.content }}
                </div>
              </div>
            </div>

            <!-- Formulaire d'envoi -->
            <form
              @submit.prevent="handleSendGeneral"
              class="p-3 border-t border-base-content/15 bg-base-200/40 flex items-center gap-2"
            >
              <input
                v-model="generalInput"
                placeholder="Écrire un message dans le chat général…"
                maxlength="1000"
                class="input input-bordered input-sm flex-1 bg-base-100 border-base-content/20 focus:border-primary text-xs sm:text-sm rounded-sm"
              />
              <button
                type="submit"
                class="btn btn-primary btn-sm px-5 font-display text-xs tracking-wider uppercase rounded-sm"
                :disabled="!generalInput.trim() || isSending"
              >
                Envoyer
              </button>
            </form>
          </div>

          <!-- ══ ONGLET 2 : CHAT PRIVÉ (Missives) ══ -->
          <div
            v-else-if="activeTab === 'private'"
            class="border border-base-content/15 bg-base-100 flex flex-col h-[620px] shadow-sm overflow-hidden rounded-sm relative"
          >
            <!-- Filet cinabre supérieur -->
            <div class="h-1 w-full bg-primary/70"></div>

            <!-- Aucun interlocuteur sélectionné : Sélecteur de conversation -->
            <div
              v-if="!communityStore.selectedUserId"
              class="h-full flex flex-col p-6 space-y-4 overflow-y-auto"
            >
              <div class="text-center py-6 border-b border-base-content/15 space-y-2">
                <span class="text-4xl">✉️</span>
                <h3 class="font-display text-2xl text-base-content">
                  Mes missives privées
                </h3>
                <p class="text-xs text-base-content/65 max-w-sm mx-auto">
                  Sélectionne un aventurier pour ouvrir une correspondance scellée.
                </p>
              </div>

              <!-- Liste des discussions existantes -->
              <div v-if="communityStore.conversationList.length > 0" class="space-y-2.5 max-w-xl mx-auto w-full pt-2">
                <div
                  v-for="conv in communityStore.conversationList"
                  :key="conv.userId"
                  class="flex items-center justify-between p-3.5 border border-base-content/15 bg-base-200/40 hover:border-primary/40 transition-all cursor-pointer rounded-sm group"
                  @click="startPrivateChat(conv.userId, conv.username)"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-display font-bold text-sm flex items-center justify-center border border-primary/20 shadow-seal">
                      {{ conv.username.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-display font-semibold text-sm group-hover:text-primary transition-colors">
                          {{ conv.username }}
                        </span>
                        <span
                          class="badge badge-xs font-mono text-[9px]"
                          :class="conv.isOnline ? 'badge-success' : 'badge-ghost text-base-content/50'"
                        >
                          {{ conv.isOnline ? 'En ligne' : 'Hors-ligne' }}
                        </span>
                      </div>
                      <p class="text-xs text-base-content/65 truncate max-w-xs mt-0.5">
                        {{ conv.lastMessage || 'Nouvelle conversation' }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span v-if="conv.unread > 0" class="badge badge-sm badge-error font-mono font-bold animate-pulse">
                      {{ conv.unread }} non lu{{ conv.unread > 1 ? 's' : '' }}
                    </span>
                    <button class="btn btn-sm btn-primary font-display text-xs uppercase tracking-wider rounded-sm">
                      Ouvrir
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="text-center py-12 text-sm text-base-content/60 space-y-3 font-display">
                <p>Aucune missive archivée pour le moment.</p>
                <button
                  class="btn btn-outline btn-sm font-display text-xs rounded-sm"
                  @click="activeTab = 'online'"
                >
                  Trouver un aventurier en ligne
                </button>
              </div>
            </div>

            <!-- Conversation privée active avec un interlocuteur -->
            <template v-else>
              <!-- En-tête de la conversation privée -->
              <div class="p-3.5 border-b border-base-content/15 bg-base-200/50 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-base-content/70 hover:text-base-content font-display"
                    title="Retour au registre des discussions"
                    @click="backToConversations"
                  >
                    ← Retour
                  </button>
                  <div class="w-8 h-8 rounded-full bg-primary/10 text-primary font-display font-bold text-xs flex items-center justify-center border border-primary/30 shadow-seal">
                    {{ currentInterlocutorName.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="font-display text-base font-semibold leading-tight">
                        {{ currentInterlocutorName }}
                      </h2>
                      <span
                        class="badge badge-xs font-mono text-[9px]"
                        :class="communityStore.isSelectedUserOnline ? 'badge-success' : 'badge-ghost text-base-content/50'"
                      >
                        {{ communityStore.isSelectedUserOnline ? 'En ligne' : 'Hors-ligne' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-base-content/60 font-sans">
                      Missive scellée de pair à pair
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-xs rounded-sm font-display"
                    :class="communityStore.isSelectedUserBlocked ? 'btn-success' : 'btn-error btn-outline'"
                    @click="handleToggleBlock(communityStore.selectedUserId!, currentInterlocutorName)"
                  >
                    {{ communityStore.isSelectedUserBlocked ? 'Débloquer' : 'Bloquer' }}
                  </button>
                </div>
              </div>

              <!-- Bannière de statut si hors-ligne -->
              <div
                v-if="!communityStore.isSelectedUserOnline"
                class="bg-warning/10 border-b border-warning/20 px-4 py-2 text-xs text-warning flex items-center gap-2 font-display"
              >
                <span>ℹ️</span>
                <span>{{ currentInterlocutorName }} n'est plus en ligne. Tes messages lui parviendront à sa prochaine connexion.</span>
              </div>

              <!-- Bannière de statut si bloqué -->
              <div
                v-if="communityStore.isSelectedUserBlocked"
                class="bg-error/10 border-b border-error/20 px-4 py-2 text-xs text-error flex items-center justify-between font-display"
              >
                <span>🚫 Tu as bloqué cet aventurier. Vos missives sont suspendues.</span>
                <button
                  type="button"
                  class="btn btn-xs btn-error btn-outline rounded-sm font-display"
                  @click="handleToggleBlock(communityStore.selectedUserId!, currentInterlocutorName)"
                >
                  Débloquer
                </button>
              </div>

              <!-- Historique des messages & notifications système -->
              <div
                ref="privateScrollContainer"
                class="flex-1 overflow-y-auto p-4 space-y-3"
              >
                <div
                  v-if="communityStore.activeConversationItems.length === 0"
                  class="h-full flex flex-col items-center justify-center text-center text-base-content/50 p-6 space-y-2"
                >
                  <span class="text-4xl opacity-80">✉️</span>
                  <p class="font-display text-base">Début de votre correspondance avec {{ currentInterlocutorName }}.</p>
                  <p class="text-xs text-base-content/50 font-sans">Rédige ta première missive ci-dessous !</p>
                </div>

                <template v-for="item in communityStore.activeConversationItems" :key="item.id">
                  <!-- Notification système (déconnexion / reconnexion) -->
                  <div
                    v-if="item.type === 'system'"
                    class="flex items-center justify-center my-3"
                  >
                    <div
                      class="px-4 py-1 text-xs font-mono rounded-full flex items-center gap-2 border shadow-sm"
                      :class="
                        item.systemType === 'offline'
                          ? 'border-warning/30 bg-warning/10 text-warning'
                          : item.systemType === 'online'
                            ? 'border-success/30 bg-success/10 text-success'
                            : 'border-base-content/20 bg-base-200 text-base-content/70'
                      "
                    >
                      <span>{{ item.systemType === 'offline' ? '⚠️' : '🟢' }}</span>
                      <span>{{ item.systemText }}</span>
                      <time class="opacity-60 text-[10px]">{{ formatTime(item.created_at) }}</time>
                    </div>
                  </div>

                  <!-- Message de chat privé -->
                  <div
                    v-else
                    class="flex flex-col"
                    :class="item.sender_id === authStore.userId ? 'items-end' : 'items-start'"
                  >
                    <div class="text-[11px] text-base-content/60 mb-1 flex items-center gap-1.5 px-1">
                      <span
                        class="font-display font-semibold"
                        :class="item.sender_id === authStore.userId ? 'text-primary' : 'text-base-content/90'"
                      >
                        {{ item.sender_name }}
                      </span>
                      <span class="text-base-content/30">•</span>
                      <time class="font-mono text-[10px] text-base-content/50">
                        {{ formatTime(item.created_at) }}
                      </time>
                    </div>

                    <!-- Bulle de missive -->
                    <div
                      class="max-w-[85%] sm:max-w-[75%] rounded-md p-3 text-sm break-words border shadow-sm leading-relaxed"
                      :class="
                        item.sender_id === authStore.userId
                          ? 'bg-primary/10 border-primary/30 text-base-content'
                          : 'bg-base-200/90 border-base-content/15 text-base-content'
                      "
                    >
                      {{ item.content }}
                    </div>
                  </div>
                </template>
              </div>

              <!-- Formulaire d'envoi privé -->
              <form
                @submit.prevent="handleSendPrivate"
                class="p-3 border-t border-base-content/15 bg-base-200/40 flex items-center gap-2"
              >
                <input
                  v-model="privateInput"
                  :placeholder="
                    communityStore.isSelectedUserBlocked
                      ? 'Débloque cet aventurier pour lui écrire…'
                      : `Rédiger une missive pour ${currentInterlocutorName}…`
                  "
                  maxlength="1000"
                  :disabled="communityStore.isSelectedUserBlocked"
                  class="input input-bordered input-sm flex-1 bg-base-100 border-base-content/20 focus:border-primary text-xs sm:text-sm rounded-sm"
                />
                <button
                  type="submit"
                  class="btn btn-primary btn-sm px-5 font-display text-xs tracking-wider uppercase rounded-sm"
                  :disabled="!privateInput.trim() || isSending || communityStore.isSelectedUserBlocked"
                >
                  Envoyer
                </button>
              </form>
            </template>
          </div>

          <!-- ══ ONGLET 3 : LISTE DES JOUEURS EN LIGNE (Vue mobile / onglet dédié) ══ -->
          <div
            v-else-if="activeTab === 'online'"
            class="border border-base-content/15 bg-base-100 p-6 space-y-4 shadow-sm rounded-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/15 pb-4">
              <div>
                <h2 class="font-display text-xl text-base-content">
                  Registre des aventuriers en ligne
                </h2>
                <p class="text-xs text-base-content/65 font-sans mt-0.5">
                  {{ communityStore.onlineUsers.length }} aventurier{{ communityStore.onlineUsers.length > 1 ? 's' : '' }} actuellement dans le Monde des Douze
                </p>
              </div>

              <input
                v-model="searchQuery"
                placeholder="Filtrer par nom…"
                class="input input-bordered input-sm w-56 bg-base-200/60 border-base-content/20 text-xs rounded-sm"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <!-- Moi-même -->
              <div class="flex items-center justify-between p-3.5 border border-primary/30 bg-primary/5 rounded-sm">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-primary text-primary-content font-display font-bold text-sm flex items-center justify-center shadow-seal">
                    {{ communityStore.currentUsername.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <p class="font-display font-semibold text-sm">{{ communityStore.currentUsername }}</p>
                      <span class="badge badge-xs badge-primary font-mono text-[9px]">Moi</span>
                    </div>
                    <span class="text-xs text-success flex items-center gap-1 font-mono">
                      <span class="h-2 w-2 rounded-full bg-success"></span> En ligne maintenant
                    </span>
                  </div>
                </div>
              </div>

              <!-- Autres joueurs -->
              <div
                v-for="user in filteredOnlineUsers"
                :key="user.userId"
                class="flex items-center justify-between p-3.5 border border-base-content/15 bg-base-200/40 hover:border-primary/40 transition-all rounded-sm group"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-base-300 text-base-content font-display font-bold text-sm flex items-center justify-center border border-base-content/15">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="font-display font-semibold text-sm text-base-content group-hover:text-primary transition-colors">
                      {{ user.username }}
                    </p>
                    <span class="text-xs text-success flex items-center gap-1 font-mono">
                      <span class="h-2 w-2 rounded-full bg-success shadow-[0_0_6px_rgba(47,161,90,0.8)]"></span> En ligne
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-primary font-display text-xs tracking-wider uppercase rounded-sm"
                    @click="startPrivateChat(user.userId, user.username)"
                  >
                    ✉️ Message
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-error/60 hover:text-error"
                    :title="communityStore.blockedUserIds.has(user.userId) ? 'Débloquer' : 'Bloquer'"
                    @click="handleToggleBlock(user.userId, user.username)"
                  >
                    {{ communityStore.blockedUserIds.has(user.userId) ? 'Débloquer' : 'Bloquer' }}
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="communityStore.onlineOtherUsers.length === 0"
              class="text-center py-12 text-sm text-base-content/60 italic font-display"
            >
              Tu es le seul aventurier en ligne actuellement. Dès qu'un compagnon se connectera, il apparaîtra ici en direct !
            </div>
          </div>

          <!-- ══ ONGLET 4 : UTILISATEURS BLOQUÉS ══ -->
          <div
            v-else-if="activeTab === 'blocked'"
            class="border border-base-content/15 bg-base-100 p-6 space-y-4 shadow-sm rounded-sm"
          >
            <div class="border-b border-base-content/15 pb-4">
              <h2 class="font-display text-xl flex items-center gap-2 text-error">
                <span>🚫 Aventuriers bannis de vos échanges</span>
              </h2>
              <p class="text-xs text-base-content/65 font-sans mt-0.5">
                Les aventuriers bloqués ne peuvent pas vous envoyer de missives et leurs prises de parole sont masquées dans la taverne générale.
              </p>
            </div>

            <div v-if="blockedList.length === 0" class="py-12 text-center text-sm text-base-content/50 italic font-display">
              Vous n'avez banni aucun aventurier.
            </div>

            <div v-else class="space-y-2.5">
              <div
                v-for="b in blockedList"
                :key="b.userId"
                class="flex items-center justify-between p-3.5 border border-base-content/15 bg-base-200/40 rounded-sm"
              >
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-error/15 text-error font-display font-bold text-xs flex items-center justify-center border border-error/25">
                    {{ b.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="font-display font-semibold text-sm">{{ b.username }}</p>
                    <p class="text-[10px] text-base-content/50 font-mono">{{ b.userId }}</p>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-sm btn-outline btn-success font-display text-xs rounded-sm"
                  @click="handleToggleBlock(b.userId, b.username)"
                >
                  Débloquer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Filet de défilement discret type grimoire */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: rgba(240, 78, 34, 0.25);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(240, 78, 34, 0.5);
}
</style>
