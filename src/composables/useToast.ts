import { ref } from 'vue'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  duration?: number
}

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  function addToast(message: string, type: ToastType, duration = 3000) {
    const id = nextId++
    const newToast = { id, message, type, duration }
    toasts.value.push(newToast)

    if (duration !== 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function removeToast(id: number) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function success(message: string, duration?: number) {
    return addToast(message, 'success', duration)
  }

  function error(message: string, duration?: number) {
    return addToast(message, 'error', duration)
  }

  function info(message: string, duration?: number) {
    return addToast(message, 'info', duration)
  }

  return {
    toasts,
    success,
    error,
    info,
    removeToast
  }
} 