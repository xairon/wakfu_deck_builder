<template>
  <div class="relative w-64 rounded-xl border-2 shadow-2xl overflow-hidden bg-base-300 text-base-content flex flex-col"
       :class="borderColorClass">
    <!-- Header: Type & Rareté & Element -->
    <div class="px-3 py-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
         :class="headerBgClass">
      <span>{{ card.mainType }}</span>
      <div class="flex items-center gap-1.5">
        <span v-if="card.element && card.element !== 'Neutre'" class="badge badge-xs" :class="elementBadgeClass">
          {{ card.element }}
        </span>
        <span class="opacity-80">{{ card.rarity || 'Commune' }}</span>
      </div>
    </div>

    <!-- Nom de la carte -->
    <div class="px-3 py-2 bg-base-200/90 border-b border-base-content/10 flex items-center justify-between">
      <h4 class="font-display font-bold text-base leading-tight truncate text-primary">
        {{ card.name || 'Nom de la carte' }}
      </h4>
      <span v-if="levelOrCost !== null" class="font-mono font-bold text-sm bg-base-300 px-1.5 py-0.5 rounded border border-base-content/20">
        {{ levelOrCost }}
      </span>
    </div>

    <!-- Image Artwork -->
    <div class="relative w-full h-44 bg-base-100 flex items-center justify-center overflow-hidden border-b border-base-content/10">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.name"
        class="w-full h-full object-cover"
        @error="hasImageError = true"
      />
      <div v-if="!card.imageUrl || hasImageError" class="flex flex-col items-center justify-center p-4 text-center text-base-content/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-xs">Pas d'image (ou URL invalide)</span>
      </div>
      <div v-if="card.subTypes?.length" class="absolute bottom-1 left-2 bg-black/70 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 rounded-full font-mono">
        {{ card.subTypes.join(' · ') }}
      </div>
    </div>

    <!-- Stats Bar (si applicable) -->
    <div v-if="hasStats" class="grid grid-cols-4 bg-base-200 text-center py-1 border-b border-base-content/10 text-xs font-mono">
      <div v-if="card.stats?.hp !== undefined" class="border-r border-base-content/10">
        <span class="text-[10px] block opacity-60">PV</span>
        <span class="font-bold text-success">{{ card.stats.hp }}</span>
      </div>
      <div v-if="card.stats?.ap !== undefined" class="border-r border-base-content/10">
        <span class="text-[10px] block opacity-60">PA</span>
        <span class="font-bold text-info">{{ card.stats.ap }}</span>
      </div>
      <div v-if="card.stats?.mp !== undefined" class="border-r border-base-content/10">
        <span class="text-[10px] block opacity-60">PM</span>
        <span class="font-bold text-warning">{{ card.stats.mp }}</span>
      </div>
      <div v-if="card.stats?.strength !== undefined">
        <span class="text-[10px] block opacity-60">FORCE</span>
        <span class="font-bold text-error">{{ card.stats.strength }}</span>
      </div>
    </div>

    <!-- Effets / Boîte de texte -->
    <div class="p-3 text-xs flex-1 flex flex-col justify-between bg-base-300/50 min-h-[90px]">
      <div class="space-y-1.5 overflow-y-auto max-h-36">
        <div v-for="(effect, idx) in card.effects" :key="idx" class="leading-relaxed">
          <span v-if="effect.trigger" class="font-semibold text-accent">[{{ effect.trigger }}] </span>
          <span v-if="effect.cost" class="font-semibold text-secondary">({{ effect.cost }}) </span>
          <span>{{ effect.description }}</span>
        </div>
        <p v-if="!card.effects?.length" class="text-base-content/40 italic">
          Aucun effet renseigné...
        </p>
      </div>

      <!-- Flavor text & rules -->
      <div class="mt-2 pt-1.5 border-t border-base-content/10 text-[10px]">
        <p v-if="card.flavorText" class="italic text-base-content/60">
          « {{ card.flavorText }} »
        </p>
        <div class="mt-1 flex items-center justify-between text-base-content/40 font-mono">
          <span>Carte Créée</span>
          <span v-if="card.isPublic" class="badge badge-ghost badge-xs">Publique</span>
          <span v-else class="badge badge-neutral badge-xs">Privée</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CustomCardInput } from '@/types/customCards'

const props = defineProps<{
  card: CustomCardInput
}>()

const hasImageError = ref(false)

watch(() => props.card.imageUrl, () => {
  hasImageError.value = false
})

const borderColorClass = computed(() => {
  switch (props.card.element) {
    case 'Feu': return 'border-error/60'
    case 'Eau': return 'border-info/60'
    case 'Terre': return 'border-success/60'
    case 'Air': return 'border-secondary/60'
    default: return 'border-primary/40'
  }
})

const headerBgClass = computed(() => {
  switch (props.card.element) {
    case 'Feu': return 'bg-error/20 text-error'
    case 'Eau': return 'bg-info/20 text-info'
    case 'Terre': return 'bg-success/20 text-success'
    case 'Air': return 'bg-secondary/20 text-secondary'
    default: return 'bg-primary/20 text-primary'
  }
})

const elementBadgeClass = computed(() => {
  switch (props.card.element) {
    case 'Feu': return 'badge-error text-white'
    case 'Eau': return 'badge-info text-white'
    case 'Terre': return 'badge-success text-white'
    case 'Air': return 'badge-secondary text-white'
    default: return 'badge-ghost'
  }
})

const levelOrCost = computed(() => {
  if (props.card.stats?.level !== undefined && props.card.stats.level > 0) {
    return `Niv. ${props.card.stats.level}`
  }
  if (props.card.stats?.cost !== undefined && props.card.stats.cost > 0) {
    return `${props.card.stats.cost} Kamas`
  }
  return null
})

const hasStats = computed(() => {
  const s = props.card.stats
  return s && (s.hp !== undefined || s.ap !== undefined || s.mp !== undefined || s.strength !== undefined)
})
</script>
