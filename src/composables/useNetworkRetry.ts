import { ref } from 'vue'

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
}

export function useNetworkRetry() {
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000
    } = options

    isLoading.value = true
    error.value = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation()
        isLoading.value = false
        return result
      } catch (e) {
        if (attempt === maxRetries - 1) {
          error.value = e as Error
          isLoading.value = false
          throw e
        }
        
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // TypeScript needs this even though it's unreachable
    throw new Error('Unreachable')
  }

  return {
    isLoading,
    error,
    withRetry
  }
} 