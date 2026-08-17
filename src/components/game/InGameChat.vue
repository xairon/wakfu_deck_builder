<template>
  <div class="ingame-chat-container">
    <!-- ═══════════ BOUTON TOGGLE CHAT ═══════════ -->
    <button
      class="ingame-chat-toggle btn btn-circle btn-primary shadow-lg"
      :class="{ 'btn-active': isChatOpen }"
      aria-label="Ouvrir ou fermer le chat en jeu"
      data-testid="ingame-chat-toggle"
      @click="toggleChat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>

      <!-- Badge de messages non lus -->
      <span
        v-if="unreadCount > 0 && !isChatOpen"
        class="badge badge-error badge-sm absolute -top-1 -right-1 animate-pulse font-bold text-white shadow"
        data-testid="ingame-chat-unread-badge"
      >
        {{ unreadCount > 99 ? "99+" : unreadCount }}
      </span>
    </button>

    <!-- ═══════════ FENÊTRE DE CHAT (RETENUE EN MÉMOIRE VIA V-SHOW) ═══════════ -->
    <div
      v-show="isChatOpen"
      class="ingame-chat-window card bg-base-900/95 border-base-700/60 shadow-2xl backdrop-blur-md"
      data-testid="ingame-chat-window"
    >
      <!-- En-tête -->
      <div
        class="chat-header flex items-center justify-between border-b border-base-content/10 px-4 py-3 bg-base-800/80 rounded-t-2xl"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-2.5 w-2.5 rounded-full bg-success animate-pulse"
          ></span>
          <h3
            class="font-display font-bold text-sm tracking-wide text-base-content"
          >
            Chat de partie 1v1
          </h3>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-circle text-base-content/70 hover:text-base-content"
          aria-label="Fermer le chat"
          data-testid="ingame-chat-close"
          @click="closeChat"
        >
          ✕
        </button>
      </div>

      <!-- Zone d'affichage des messages scrollable -->
      <div
        ref="messagesContainerRef"
        class="messages-scroll-area flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[340px]"
        data-testid="ingame-chat-messages-list"
      >
        <div
          v-if="messagesList.length === 0"
          class="empty-state text-center text-xs text-base-content/40 italic py-8"
        >
          Aucun message pour l'instant. Dites bonjour à votre adversaire !
        </div>

        <div
          v-for="msg in messagesList"
          :key="msg.id"
          class="message-wrapper flex flex-col"
          :class="{
            'items-end': msg.isSelf,
            'items-start': !msg.isSelf && msg.type !== 'system',
            'items-center': msg.type === 'system',
          }"
        >
          <!-- Message système -->
          <div
            v-if="msg.type === 'system'"
            class="system-msg text-[11px] text-sky-200 bg-sky-950/70 border border-sky-500/40 px-3.5 py-1 rounded-full italic my-1 shadow-xs"
          >
            {{ msg.text }}
          </div>

          <!-- Message joueur (soi ou adversaire) -->
          <div
            v-else
            class="message-bubble max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-md border-2 transition-all"
            :class="[
              msg.isSelf
                ? 'bg-orange-950/90 border-orange-500/60 text-orange-50 rounded-br-xs'
                : 'bg-slate-800/95 border-amber-400/60 text-slate-50 rounded-bl-xs',
            ]"
          >
            <div
              class="message-meta flex items-center justify-between gap-3 text-[10px] mb-1.5 pb-0.5 border-b"
              :class="
                msg.isSelf ? 'border-orange-500/20' : 'border-amber-400/25'
              "
            >
              <span
                class="font-bold truncate max-w-[120px] text-[11px]"
                :class="msg.isSelf ? 'text-orange-300' : 'text-amber-300'"
              >
                {{ msg.senderName }}
              </span>
              <span
                class="text-[9px] font-mono whitespace-nowrap"
                :class="msg.isSelf ? 'text-orange-200/70' : 'text-amber-200/80'"
              >
                {{ msg.timestamp }}
              </span>
            </div>
            <p
              class="message-text break-words whitespace-pre-wrap leading-relaxed font-normal text-xs"
              :class="msg.isSelf ? 'text-orange-50' : 'text-slate-100'"
            >
              {{ msg.text }}
            </p>
          </div>
        </div>
      </div>

      <!-- Saisie de message -->
      <form
        class="chat-input-form flex items-center gap-2 border-t border-base-content/10 p-3 bg-base-900/60 rounded-b-2xl"
        @submit.prevent="handleSend"
      >
        <input
          v-model="inputText"
          type="text"
          class="input input-sm flex-1 bg-white text-black font-medium placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-primary border-slate-300"
          placeholder="Envoyer un message au joueur…"
          maxlength="300"
          data-testid="ingame-chat-input"
          @keydown.enter.exact.prevent="handleSend"
        />
        <button
          type="submit"
          class="btn btn-primary btn-sm px-3"
          :disabled="!inputText.trim()"
          aria-label="Envoyer le message"
          data-testid="ingame-chat-send"
        >
          ➤
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useInGameChat } from "@/composables/useInGameChat";

const props = defineProps<{
  localPlayerName?: string;
  opponentPlayerName?: string;
  onSendMessage?: (text: string) => void | Promise<void>;
}>();

const {
  messagesList,
  isChatOpen,
  unreadCount,
  messagesContainerRef,
  toggleChat,
  closeChat,
  sendMessage,
} = useInGameChat({
  localPlayerName: props.localPlayerName,
  opponentPlayerName: props.opponentPlayerName,
  onSendMessage: props.onSendMessage,
});

const inputText = ref("");

function handleSend() {
  if (!inputText.value.trim()) return;
  const ok = sendMessage(inputText.value);
  if (ok) {
    inputText.value = "";
  }
}
</script>

<style scoped>
.ingame-chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.ingame-chat-toggle {
  position: relative;
  width: 48px;
  height: 48px;
  min-height: 48px;
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.ingame-chat-window {
  width: 320px;
  margin-bottom: 12px;
  border-radius: 1rem;
  overflow: hidden;
  background: rgba(20, 18, 16, 0.95);
}

.messages-scroll-area::-webkit-scrollbar {
  width: 5px;
}

.messages-scroll-area::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.messages-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(240, 78, 34, 0.4);
  border-radius: 4px;
}

@media (max-width: 640px) {
  .ingame-chat-window {
    width: calc(100vw - 32px);
    right: 16px;
  }
}
</style>
