<script setup lang="ts">
import { useGameStore } from "@/stores/gameStore";

const store = useGameStore();
</script>

<template>
  <div
    v-if="store.manualReminders.length"
    class="manual-reminders"
    data-testid="manual-reminders"
  >
    <div class="manual-reminders__title">Effets à résoudre à la main</div>
    <ul class="manual-reminders__list">
      <li
        v-for="r in store.manualReminders"
        :key="r.id"
        class="manual-reminder"
        data-testid="manual-reminder"
      >
        <span class="manual-reminder__text">
          <strong>{{ r.cardName }}</strong> : « {{ r.text }} »
        </span>
        <button
          type="button"
          class="manual-reminder__done"
          data-testid="manual-reminder-done"
          @click="store.dismissManualReminder(r.id)"
        >
          Fait
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.manual-reminders {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 30;
  max-width: 22rem;
  max-height: 40vh;
  overflow-y: auto;
  padding: 0.6rem 0.75rem;
  border-radius: 0.6rem;
  background: rgba(20, 16, 10, 0.92);
  border: 1px solid rgba(245, 197, 66, 0.5);
  color: #f4ead2;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  font-size: 0.85rem;
}
.manual-reminders__title {
  font-weight: 700;
  color: #f5c542;
  margin-bottom: 0.4rem;
}
.manual-reminders__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.manual-reminder {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}
.manual-reminder__text {
  line-height: 1.25;
}
.manual-reminder__done {
  flex: none;
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  background: #f5c542;
  color: #1a140a;
  font-weight: 700;
  cursor: pointer;
}
.manual-reminder__done:hover {
  background: #ffd45f;
}
</style>
