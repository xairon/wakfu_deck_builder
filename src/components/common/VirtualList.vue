<template>
  <div 
    ref="container"
    class="virtual-list-container"
    @scroll="handleScroll"
  >
    <!-- Container spacer pour définir la hauteur totale -->
    <div 
      class="virtual-list-spacer"
      :style="{ height: `${totalHeight}px` }"
    ></div>
    
    <!-- Grid container actuel -->
    <div 
      class="virtual-list-grid"
      :style="{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${itemMinWidth}px, 1fr))`,
        gap: '1rem',
        position: 'absolute',
        top: `${startOffset}px`,
        left: 0,
        right: 0
      }"
    >
      <div 
        v-for="item in visibleItems"
        :key="getItemKey(item)"
      >
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useResizeObserver, useThrottleFn } from '@vueuse/core'
import { measure } from '../utils/performance'
import { METRIC_TYPES } from '../utils/performance'

interface Props<T> {
  items: T[]
  itemHeight: number
  minItemsPerRow: number
  maxItemsPerRow: number
  buffer?: number
  keyField?: string
}

const props = withDefaults(defineProps<Props<any>>(), {
  buffer: 5,
  keyField: 'id'
})

const container = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
const containerWidth = ref(0)
const itemsPerRow = ref(1)

// Calcul de la largeur minimum par élément
const itemMinWidth = computed(() => {
  if (!containerWidth.value || !props.maxItemsPerRow) return 200
  return Math.floor(containerWidth.value / props.maxItemsPerRow) - 20 // 20 pour le padding/marge
})

// Calcul du nombre d'éléments par ligne
watch([containerWidth, itemMinWidth], () => {
  if (containerWidth.value && itemMinWidth.value) {
    // Calcul du nombre d'éléments qui peuvent tenir dans une ligne
    const possibleItemsPerRow = Math.floor(containerWidth.value / itemMinWidth.value)
    
    // Limiter aux bornes définies dans les props
    itemsPerRow.value = Math.max(
      Math.min(possibleItemsPerRow, props.maxItemsPerRow),
      props.minItemsPerRow
    )
  }
})

// Calcul du nombre total de lignes
const totalRows = computed(() => Math.ceil(props.items.length / itemsPerRow.value))

// Calcul de la hauteur totale de la liste
const totalHeight = computed(() => totalRows.value * props.itemHeight)

// Calcul des lignes visibles
const visibleRowIndices = computed(() => {
  if (!container.value) return { start: 0, end: Math.min(20, totalRows.value - 1) }
  
  const startRow = Math.floor(scrollTop.value / props.itemHeight) - props.buffer
  const endRow = Math.ceil((scrollTop.value + containerHeight.value) / props.itemHeight) + props.buffer
  
  return {
    start: Math.max(0, startRow),
    end: Math.min(totalRows.value - 1, endRow)
  }
})

// Offset de départ pour positionner les éléments visibles
const startOffset = computed(() => visibleRowIndices.value.start * props.itemHeight)

// Calcul des éléments visibles
const visibleItems = computed(() => {
  const { start, end } = visibleRowIndices.value
  console.log(`🔍 DEBUG VirtualList - Lignes visibles: ${start} à ${end} sur ${totalRows.value} lignes`);
  console.log(`🔍 DEBUG VirtualList - Total éléments: ${props.items.length}, par ligne: ${itemsPerRow.value}`);
  
  const items = []
  
  for (let rowIndex = start; rowIndex <= end; rowIndex++) {
    const startItemIndex = rowIndex * itemsPerRow.value
    const endItemIndex = Math.min(startItemIndex + itemsPerRow.value, props.items.length)
    
    for (let i = startItemIndex; i < endItemIndex; i++) {
      items.push(props.items[i])
    }
  }
  
  console.log(`🔍 DEBUG VirtualList - Items visibles: ${items.length}`);
  if (items.length === 0 && props.items.length > 0) {
    console.warn('⚠️ DEBUG VirtualList - Aucun élément visible malgré des éléments disponibles!');
  }
  
  return items
})

// Obtenir une clé unique pour chaque item
function getItemKey(item: any): string {
  if (item && props.keyField in item) {
    return String(item[props.keyField])
  }
  return typeof item === 'object' ? JSON.stringify(item) : String(item)
}

// Gestion du défilement
const handleScroll = useThrottleFn(() => {
  if (container.value) {
    scrollTop.value = container.value.scrollTop
  }
}, 16) // ~60fps

// Initialisation
onMounted(async () => {
  if (container.value) {
    containerHeight.value = container.value.clientHeight
    containerWidth.value = container.value.clientWidth
  }
  
  // Observer les changements de taille du conteneur
  useResizeObserver(container, (entries) => {
    const entry = entries[0]
    if (entry) {
      containerHeight.value = entry.contentRect.height
      containerWidth.value = entry.contentRect.width
    }
  })
  
  // Initialiser le défilement
  await nextTick()
  handleScroll()
})

// Méthodes exposées
defineExpose({
  scrollToIndex: (index: number) => {
    if (!container.value) return
    const rowIndex = Math.floor(index / itemsPerRow.value)
    container.value.scrollTop = rowIndex * props.itemHeight
  }
})
</script>

<style scoped>
.virtual-list-container {
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  width: 100%;
}

.virtual-list-spacer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: none;
}

.virtual-list-grid {
  width: 100%;
}
</style> 