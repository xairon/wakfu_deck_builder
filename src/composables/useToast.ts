import { ref, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  message: string
  title?: string
  type: ToastType
  duration: number
  show: boolean
}

// Singleton pour gérer les toasts à travers toute l'application
const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  // Ajouter un nouveau toast
  function addToast(
    message: string,
    options?: {
      title?: string
      type?: ToastType
      duration?: number
    }
  ): number {
    const defaults = {
      type: 'info' as ToastType,
      duration: 3000, // 3 secondes par défaut
    }

    const toast: Toast = {
      id: nextId++,
      message,
      title: options?.title,
      type: options?.type || defaults.type,
      duration: options?.duration || defaults.duration,
      show: true,
    }

    toasts.value.push(toast)

    // Auto-supprimer après la durée spécifiée
    if (toast.duration > 0) {
      setTimeout(() => {
        removeToast(toast.id)
      }, toast.duration)
    }

    return toast.id
  }

  // Ajouter un toast de succès
  function success(
    message: string,
    options?: { title?: string; duration?: number }
  ): number {
    return addToast(message, { ...options, type: 'success' })
  }

  // Ajouter un toast d'erreur
  function error(
    message: string,
    options?: { title?: string; duration?: number }
  ): number {
    return addToast(message, { ...options, type: 'error' })
  }

  // Ajouter un toast d'information
  function info(
    message: string,
    options?: { title?: string; duration?: number }
  ): number {
    return addToast(message, { ...options, type: 'info' })
  }

  // Ajouter un toast d'avertissement
  function warning(
    message: string,
    options?: { title?: string; duration?: number }
  ): number {
    return addToast(message, { ...options, type: 'warning' })
  }

  // Supprimer un toast par son ID
  function removeToast(id: number): void {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      // Marquer comme non-affiché pour l'animation de sortie
      toasts.value[index].show = false

      // Supprimer après un court délai pour permettre l'animation
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id)
      }, 300)
    }
  }

  // Supprimer tous les toasts
  function clearToasts(): void {
    toasts.value = []
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
  }
}
