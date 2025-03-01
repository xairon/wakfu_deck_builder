import { ref } from 'vue';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  type: NotificationType;
  message: string;
}

export function useNotification() {
  const notification = ref<Notification | null>(null);
  const timeout = ref<number | null>(null);

  function showNotification(type: NotificationType, message: string, duration = 3000) {
    if (timeout.value) {
      clearTimeout(timeout.value);
    }

    notification.value = { type, message };

    timeout.value = window.setTimeout(() => {
      notification.value = null;
      timeout.value = null;
    }, duration);
  }

  function clearNotification() {
    if (timeout.value) {
      clearTimeout(timeout.value);
    }
    notification.value = null;
    timeout.value = null;
  }

  return {
    notification,
    showNotification,
    clearNotification
  };
} 