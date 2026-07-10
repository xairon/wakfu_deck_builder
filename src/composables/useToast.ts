import { ref, readonly } from "vue";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  message: string;
  title?: string;
  type: ToastType;
  duration: number;
  show: boolean;
}

// Singleton pour gérer les toasts à travers toute l'application
const toasts = ref<Toast[]>([]);
let nextId = 1;
// Minuteur d'expiration PAR toast : nécessaire au DÉDOUBLONNAGE (rafraîchir un
// toast = repousser son expiration, donc annuler l'ancien minuteur).
const expiryTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function useToast() {
  // Ajouter un nouveau toast
  function addToast(
    message: string,
    options?: {
      title?: string;
      type?: ToastType;
      duration?: number;
    },
  ): number {
    const defaults = {
      type: "info" as ToastType,
      duration: 3000, // 3 secondes par défaut
    };
    const type = options?.type || defaults.type;
    const duration = options?.duration || defaults.duration;

    // DÉDOUBLONNAGE : un toast IDENTIQUE (message + type) encore visible n'est
    // pas ré-empilé — son expiration repart de zéro. Sans ça, un refus répété
    // (« Pas assez de Ressources » ×N) forme une pile qui recouvre l'interface.
    const dup = toasts.value.find(
      (t) => t.show && t.message === message && t.type === type,
    );
    if (dup) {
      const prev = expiryTimers.get(dup.id);
      if (prev) clearTimeout(prev);
      if (duration > 0) {
        expiryTimers.set(
          dup.id,
          setTimeout(() => removeToast(dup.id), duration),
        );
      }
      return dup.id;
    }

    const toast: Toast = {
      id: nextId++,
      message,
      title: options?.title,
      type,
      duration,
      show: true,
    };

    toasts.value.push(toast);

    // Auto-supprimer après la durée spécifiée
    if (toast.duration > 0) {
      expiryTimers.set(
        toast.id,
        setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration),
      );
    }

    return toast.id;
  }

  // Ajouter un toast de succès
  function success(
    message: string,
    options?: { title?: string; duration?: number },
  ): number {
    return addToast(message, { ...options, type: "success" });
  }

  // Ajouter un toast d'erreur
  function error(
    message: string,
    options?: { title?: string; duration?: number },
  ): number {
    return addToast(message, { ...options, type: "error" });
  }

  // Ajouter un toast d'information
  function info(
    message: string,
    options?: { title?: string; duration?: number },
  ): number {
    return addToast(message, { ...options, type: "info" });
  }

  // Ajouter un toast d'avertissement
  function warning(
    message: string,
    options?: { title?: string; duration?: number },
  ): number {
    return addToast(message, { ...options, type: "warning" });
  }

  // Supprimer un toast par son ID
  function removeToast(id: number): void {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      // Marquer comme non-affiché pour l'animation de sortie
      toasts.value[index].show = false;
      const timer = expiryTimers.get(id);
      if (timer) clearTimeout(timer);
      expiryTimers.delete(id);

      // Supprimer après un court délai pour permettre l'animation
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, 300);
    }
  }

  // Supprimer tous les toasts
  function clearToasts(): void {
    for (const timer of expiryTimers.values()) clearTimeout(timer);
    expiryTimers.clear();
    toasts.value = [];
  }

  return {
    toasts: readonly(toasts),
    addToast,
    success,
    error,
    info,
    warning,
    removeToast,
    clearToasts,
  };
}
