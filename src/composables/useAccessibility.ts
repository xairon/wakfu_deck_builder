import { ref, onMounted, onUnmounted } from 'vue'

interface AnnouncementOptions {
  politeness?: 'polite' | 'assertive'
  timeout?: number
}

export function useAccessibility() {
  const announcer = ref<HTMLElement | null>(null)

  // Création de l'élément d'annonce
  onMounted(() => {
    announcer.value = document.createElement('div')
    announcer.value.setAttribute('aria-live', 'polite')
    announcer.value.setAttribute('aria-atomic', 'true')
    announcer.value.classList.add('sr-only') // Screen reader only
    document.body.appendChild(announcer.value)
  })

  // Nettoyage
  onUnmounted(() => {
    announcer.value?.remove()
  })

  // Fonction d'annonce pour les lecteurs d'écran
  function announce(message: string, options: AnnouncementOptions = {}) {
    const { politeness = 'polite', timeout = 150 } = options

    if (announcer.value) {
      announcer.value.setAttribute('aria-live', politeness)
      // Reset pour forcer l'annonce
      announcer.value.textContent = ''

      setTimeout(() => {
        if (announcer.value) {
          announcer.value.textContent = message
        }
      }, timeout)
    }
  }

  // Gestionnaire de navigation au clavier
  function useKeyboardNavigation(options: {
    onArrowUp?: () => void
    onArrowDown?: () => void
    onArrowLeft?: () => void
    onArrowRight?: () => void
    onEnter?: () => void
    onSpace?: () => void
    onEscape?: () => void
  }) {
    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          options.onArrowUp?.()
          break
        case 'ArrowDown':
          event.preventDefault()
          options.onArrowDown?.()
          break
        case 'ArrowLeft':
          event.preventDefault()
          options.onArrowLeft?.()
          break
        case 'ArrowRight':
          event.preventDefault()
          options.onArrowRight?.()
          break
        case 'Enter':
          event.preventDefault()
          options.onEnter?.()
          break
        case ' ':
          event.preventDefault()
          options.onSpace?.()
          break
        case 'Escape':
          event.preventDefault()
          options.onEscape?.()
          break
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  }

  // Gestionnaire de focus
  function useFocusTrap(containerRef: HTMLElement) {
    const focusableElements = containerRef.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    return {
      activate: () => {
        containerRef.addEventListener('keydown', handleTabKey)
        firstElement?.focus()
      },
      deactivate: () => {
        containerRef.removeEventListener('keydown', handleTabKey)
      },
    }
  }

  // Gestionnaire de raccourcis clavier
  function useKeyboardShortcuts(shortcuts: {
    [key: string]: (event: KeyboardEvent) => void
  }) {
    function handleKeyDown(event: KeyboardEvent) {
      const key = [
        event.ctrlKey ? 'Ctrl' : '',
        event.altKey ? 'Alt' : '',
        event.shiftKey ? 'Shift' : '',
        event.key,
      ]
        .filter(Boolean)
        .join('+')

      if (shortcuts[key]) {
        event.preventDefault()
        shortcuts[key](event)
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  }

  return {
    announce,
    useKeyboardNavigation,
    useFocusTrap,
    useKeyboardShortcuts,
  }
}
