import { beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  setActivePinia(null)
})
