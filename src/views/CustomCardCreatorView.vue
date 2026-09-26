<template>
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <!-- Header -->
    <div class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-base-content/10 pb-6">
      <div>
        <p class="eyebrow text-primary">Atelier d'Artisan</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold mt-1">Créateur de Cartes Personnalisées</h1>
        <p class="text-base-content/70 text-sm mt-1">
          Créez vos propres cartes, définissez leurs statistiques et effets, puis testez-les dans vos decks et duels.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="myCards.length"
          type="button"
          class="btn btn-outline btn-sm gap-2"
          @click="showMyCardsModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Mes cartes ({{ myCards.length }})
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          @click="resetForm"
        >
          Réinitialiser
        </button>
      </div>
    </div>

    <!-- Alertes -->
    <div v-if="successMessage" class="alert alert-success shadow-lg mb-6">
      <span>{{ successMessage }}</span>
    </div>
    <div v-if="errorMessage" class="alert alert-error shadow-lg mb-6">
      <span>{{ errorMessage }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- FORMULAIRE (col-span-7) -->
      <form class="lg:col-span-7 space-y-6" @submit.prevent="handleSave">
        <!-- Informations Générales -->
        <div class="card bg-base-200 shadow-md p-6 space-y-4">
          <h2 class="font-display text-xl font-bold border-b border-base-content/10 pb-2">1. Identité de la carte</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Nom de la carte *</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="ex: Yugo - Confrérie du Tofu"
                class="input input-bordered w-full"
                required
              />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Type Principal *</span></label>
              <select v-model="form.mainType" class="select select-bordered w-full">
                <option v-for="type in mainTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Élément</span></label>
              <select v-model="form.element" class="select select-bordered w-full">
                <option value="Neutre">Neutre</option>
                <option value="Air">Air</option>
                <option value="Eau">Eau</option>
                <option value="Feu">Feu</option>
                <option value="Terre">Terre</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Rareté</span></label>
              <select v-model="form.rarity" class="select select-bordered w-full">
                <option value="Commune">Commune</option>
                <option value="Peu Commune">Peu Commune</option>
                <option value="Rare">Rare</option>
                <option value="Mythique">Mythique</option>
                <option value="Légendaire">Légendaire</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Sous-types / Familles</span></label>
              <input
                v-model="subTypesInput"
                type="text"
                placeholder="Eliatrope, Tofu (séparés par virgule)"
                class="input input-bordered w-full"
              />
            </div>
          </div>

          <!-- Image URL Externe -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">URL de l'image (Illustration externe)</span>
              <span class="label-text-alt opacity-70">PNG, JPG, WebP</span>
            </label>
            <input
              v-model="form.imageUrl"
              type="url"
              placeholder="https://images.unsplash.com/... ou lien direct vers image"
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <!-- Caractéristiques & Statistiques -->
        <div class="card bg-base-200 shadow-md p-6 space-y-4">
          <h2 class="font-display text-xl font-bold border-b border-base-content/10 pb-2">2. Statistiques de jeu</h2>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Niveau</span></label>
              <input v-model.number="form.stats.level" type="number" min="0" max="10" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Coût (Kamas)</span></label>
              <input v-model.number="form.stats.cost" type="number" min="0" max="20" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Points de Vie (PV)</span></label>
              <input v-model.number="form.stats.hp" type="number" min="0" max="100" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Force / ATK</span></label>
              <input v-model.number="form.stats.strength" type="number" min="0" max="50" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">PA (Action)</span></label>
              <input v-model.number="form.stats.ap" type="number" min="0" max="20" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">PM (Mouvement)</span></label>
              <input v-model.number="form.stats.mp" type="number" min="0" max="10" class="input input-bordered w-full font-mono" />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-semibold">Résistance</span></label>
              <input v-model.number="form.stats.resistance" type="number" min="0" max="10" class="input input-bordered w-full font-mono" />
            </div>
          </div>
        </div>

        <!-- Effets & Textes de règles -->
        <div class="card bg-base-200 shadow-md p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-base-content/10 pb-2">
            <h2 class="font-display text-xl font-bold">3. Capacités & Effets</h2>
            <button type="button" class="btn btn-sm btn-ghost gap-1 text-primary" @click="addEffect">
              + Ajouter un effet
            </button>
          </div>

          <div v-for="(eff, idx) in form.effects" :key="idx" class="p-3 bg-base-100 rounded-lg space-y-2 border border-base-content/10">
            <div class="flex items-center justify-between gap-2">
              <div class="grid grid-cols-2 gap-2 flex-1">
                <input
                  v-model="eff.trigger"
                  type="text"
                  placeholder="Déclencheur (ex: Entrée en jeu, Riposte)"
                  class="input input-bordered input-xs"
                />
                <input
                  v-model="eff.cost"
                  type="text"
                  placeholder="Coût éventuel (ex: 2 PA, Inclinez)"
                  class="input input-bordered input-xs"
                />
              </div>
              <button type="button" class="btn btn-ghost btn-xs text-error" @click="removeEffect(idx)">
                Supprimer
              </button>
            </div>
            <textarea
              v-model="eff.description"
              placeholder="Description détaillée de l'effet..."
              class="textarea textarea-bordered textarea-sm w-full h-16"
            ></textarea>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-semibold">Texte d'ambiance (Flavor)</span></label>
            <input
              v-model="form.flavorText"
              type="text"
              placeholder="Citation ou phrase d'ambiance..."
              class="input input-bordered w-full italic"
            />
          </div>
        </div>

        <!-- Options de partage et visibilité -->
        <div class="card bg-base-200 shadow-md p-6 space-y-3">
          <h2 class="font-display text-xl font-bold border-b border-base-content/10 pb-2">4. Visibilité</h2>
          <label class="label cursor-pointer justify-start gap-3">
            <input v-model="form.isPublic" type="checkbox" class="checkbox checkbox-primary" />
            <span class="label-text">
              Rendre cette carte publique (accessible par les autres joueurs pour leurs decks et duels)
            </span>
          </label>
        </div>

        <!-- Boutons d'action -->
        <div class="flex items-center justify-end gap-4 pt-4">
          <button
            type="submit"
            class="btn btn-primary px-8"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="loading loading-spinner"></span>
            {{ editingCardId ? 'Mettre à jour la carte' : 'Créer et Enregistrer' }}
          </button>
        </div>
      </form>

      <!-- PREVIEW EN DIRECT (col-span-5) -->
      <div class="lg:col-span-5 sticky top-20 flex flex-col items-center">
        <div class="mb-3 text-center">
          <span class="eyebrow text-base-content/50">Aperçu en direct</span>
          <h3 class="font-display text-lg font-bold">Rendu de la carte</h3>
        </div>

        <CustomCardPreview :card="previewCard" />

        <div class="mt-4 p-4 bg-base-200/60 rounded-xl text-xs text-base-content/70 max-w-xs text-center border border-base-content/10">
          <p>
            Cette carte apparaîtra instantanément dans votre Deck Builder dès activation du filtre "Custom Cards".
          </p>
        </div>
      </div>
    </div>

    <!-- MODAL "Mes Cartes" -->
    <div v-if="showMyCardsModal" class="modal modal-open">
      <div class="modal-box max-w-3xl">
        <div class="flex items-center justify-between border-b border-base-content/10 pb-3 mb-4">
          <h3 class="font-display text-xl font-bold">Mes Cartes Personnalisées</h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="showMyCardsModal = false">✕</button>
        </div>

        <div v-if="!myCards.length" class="text-center py-8 text-base-content/50">
          Vous n'avez pas encore créé de carte personnalisée.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
          <div
            v-for="rec in myCards"
            :key="rec.id"
            class="card bg-base-200 border border-base-content/10 p-4 flex flex-row items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <img
                :src="rec.image_url || '/images/card-back.webp'"
                :alt="rec.name"
                class="w-12 h-16 object-cover rounded bg-base-300 shrink-0"
              />
              <div class="truncate">
                <h4 class="font-bold truncate">{{ rec.name }}</h4>
                <div class="text-xs text-base-content/60 flex items-center gap-2 mt-0.5">
                  <span>{{ rec.main_type }}</span>
                  <span>•</span>
                  <span :class="rec.is_public ? 'text-success' : 'text-neutral-content'">
                    {{ rec.is_public ? 'Publique' : 'Privée' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="btn btn-xs btn-outline"
                @click="loadCardForEdit(rec)"
              >
                Modifier
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error"
                @click="handleDelete(rec.id)"
              >
                Suppr.
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import CustomCardPreview from '@/components/card/CustomCardPreview.vue'
import {
  createCustomCard,
  updateCustomCard,
  deleteCustomCard,
  getCustomCardsByUser,
} from '@/services/customCardService'
import { useAuthStore } from '@/stores/authStore'
import type { CustomCardInput, CustomCardRecord } from '@/types/customCards'
import type { CardMainType, CardRarity, CardElement } from '@/types/cards'

const authStore = useAuthStore()

const mainTypes: CardMainType[] = [
  'Allié',
  'Action',
  'Équipement',
  'Zone',
  'Salle',
  'Dofus',
  'Héros',
  'Protecteur',
  'Havre-Sac',
  'Allié Élémentaire',
]

const form = reactive<{
  name: string
  mainType: CardMainType
  element: CardElement
  rarity: CardRarity
  imageUrl: string
  stats: {
    level?: number
    cost?: number
    hp?: number
    strength?: number
    ap?: number
    mp?: number
    resistance?: number
  }
  effects: Array<{ description: string; trigger?: string; cost?: string }>
  flavorText: string
  isPublic: boolean
}>({
  name: '',
  mainType: 'Allié',
  element: 'Neutre',
  rarity: 'Commune',
  imageUrl: '',
  stats: {
    level: 1,
    cost: 1,
    hp: 5,
    strength: 2,
    ap: 0,
    mp: 0,
    resistance: 0,
  },
  effects: [
    { trigger: 'Entrée en jeu', cost: '', description: 'Inflige 1 dommage à une cible adverse.' },
  ],
  flavorText: '',
  isPublic: true,
})

const subTypesInput = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const editingCardId = ref<string | null>(null)
const myCards = ref<CustomCardRecord[]>([])
const showMyCardsModal = ref(false)

const previewCard = computed<CustomCardInput>(() => ({
  name: form.name,
  mainType: form.mainType,
  element: form.element,
  rarity: form.rarity,
  imageUrl: form.imageUrl,
  subTypes: subTypesInput.value
    ? subTypesInput.value.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
  stats: { ...form.stats },
  effects: form.effects.map((e) => ({ ...e })),
  flavorText: form.flavorText,
  isPublic: form.isPublic,
}))

function addEffect() {
  form.effects.push({ description: '', trigger: '', cost: '' })
}

function removeEffect(index: number) {
  form.effects.splice(index, 1)
}

function resetForm() {
  form.name = ''
  form.mainType = 'Allié'
  form.element = 'Neutre'
  form.rarity = 'Commune'
  form.imageUrl = ''
  form.stats = { level: 1, cost: 1, hp: 5, strength: 2, ap: 0, mp: 0, resistance: 0 }
  form.effects = [{ trigger: 'Entrée en jeu', cost: '', description: 'Inflige 1 dommage à une cible adverse.' }]
  form.flavorText = ''
  form.isPublic = true
  subTypesInput.value = ''
  editingCardId.value = null
  errorMessage.value = ''
  successMessage.value = ''
}

async function fetchMyCards() {
  const userId = authStore.user?.id || 'guest_user'
  myCards.value = await getCustomCardsByUser(userId)
}

function loadCardForEdit(rec: CustomCardRecord) {
  editingCardId.value = rec.id
  form.name = rec.name
  form.mainType = rec.main_type
  form.element = (rec.card_data.element as CardElement) || 'Neutre'
  form.rarity = (rec.card_data.rarity as CardRarity) || 'Commune'
  form.imageUrl = rec.image_url || rec.card_data.imageUrl || ''
  subTypesInput.value = (rec.card_data.subTypes || []).join(', ')
  form.stats = {
    level: rec.card_data.stats?.niveau?.value,
    cost: rec.card_data.stats?.cost,
    hp: rec.card_data.stats?.pv,
    strength: rec.card_data.stats?.force?.value,
    ap: rec.card_data.stats?.pa,
    mp: rec.card_data.stats?.pm,
    resistance: rec.card_data.stats?.resistance,
  }
  form.effects = (rec.card_data.effects || []).map((e) => {
    const raw = e as { description?: string; trigger?: string; cost?: string }
    return {
      description: raw.description || '',
      trigger: raw.trigger,
      cost: raw.cost,
    }
  })
  form.flavorText = rec.card_data.flavor?.text || ''
  form.isPublic = rec.is_public
  showMyCardsModal.value = false
  successMessage.value = `Carte "${rec.name}" chargée pour modification.`
}

async function handleDelete(cardId: string) {
  const userId = authStore.user?.id || 'guest_user'
  await deleteCustomCard(cardId, userId)
  await fetchMyCards()
  if (editingCardId.value === cardId) {
    resetForm()
  }
}

async function handleSave() {
  if (!form.name.trim()) {
    errorMessage.value = 'Le nom de la carte est obligatoire.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const userId = authStore.user?.id || 'guest_user'
    const input: CustomCardInput = {
      name: form.name,
      mainType: form.mainType,
      element: form.element,
      rarity: form.rarity,
      imageUrl: form.imageUrl,
      subTypes: subTypesInput.value
        ? subTypesInput.value.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      stats: { ...form.stats },
      effects: form.effects.filter((e) => e.description.trim().length > 0),
      flavorText: form.flavorText,
      isPublic: form.isPublic,
    }

    if (editingCardId.value) {
      await updateCustomCard(editingCardId.value, input, userId)
      successMessage.value = `La carte "${form.name}" a été mise à jour avec succès !`
    } else {
      const created = await createCustomCard(input, userId)
      editingCardId.value = created.id
      successMessage.value = `La carte "${form.name}" a été créée avec succès !`
    }

    await fetchMyCards()
  } catch (err: unknown) {
    errorMessage.value = (err as Error)?.message || 'Une erreur est survenue lors de la sauvegarde.'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  void fetchMyCards()
})
</script>
