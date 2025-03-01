import { ref, Ref } from 'vue'

/**
 * Composable qui crée un état réactif et retourne à la fois l'état et la fonction pour le mettre à jour
 * Permet de simplifier la gestion d'état dans les stores et composants
 * 
 * @param initialValue - La valeur initiale de l'état
 * @returns Un objet contenant l'état et la fonction pour le mettre à jour
 */
export function useState<T>(initialValue: T) {
  const state = ref(initialValue) as Ref<T>

  function setState(newValue: T) {
    state.value = newValue
  }

  return {
    state,
    setState
  }
} 