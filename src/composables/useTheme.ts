import { ref } from 'vue'
import { useStorage } from '@vueuse/core'

const THEME_KEY = 'wakfu-theme'
const themes = ['light', 'dark'] as const
type Theme = (typeof themes)[number]

const currentTheme = useStorage<Theme>(THEME_KEY, 'light')

export function useTheme() {
  function setTheme(theme: Theme) {
    currentTheme.value = theme
    document.documentElement.setAttribute('data-theme', theme)
  }

  function toggleTheme() {
    const newTheme = currentTheme.value === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  function initTheme() {
    setTheme(currentTheme.value)
  }

  return {
    currentTheme,
    setTheme,
    toggleTheme,
    initTheme,
    themes,
  }
}
