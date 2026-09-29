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

          <!-- Image de l'illustration (Fichier local ou URL) -->
          <div class="form-control space-y-2">
            <div class="flex items-center justify-between">
              <label class="label p-0">
                <span class="label-text font-semibold">Illustration de la carte</span>
              </label>
              <div class="join">
                <button
                  type="button"
                  class="btn btn-xs join-item"
                  :class="imageSourceMode === 'local' ? 'btn-primary' : 'btn-ghost'"
                  @click="imageSourceMode = 'local'"
                >
                  📁 Fichier PC
                </button>
                <button
                  type="button"
                  class="btn btn-xs join-item"
                  :class="imageSourceMode === 'url' ? 'btn-primary' : 'btn-ghost'"
                  @click="imageSourceMode = 'url'"
                >
                  🌐 Lien URL
                </button>
              </div>
            </div>

            <!-- Mode 1 : Fichier local sécurisé -->
            <div v-if="imageSourceMode === 'local'" class="space-y-2">
              <div
                class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
                :class="isDragging ? 'border-primary bg-primary/10' : 'border-base-content/20 hover:border-primary/50 bg-base-100/50'"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleFileDrop"
                @click="triggerFileInput"
              >
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.avif"
                  class="hidden"
                  @change="handleFileInputChange"
                />

                <div v-if="isProcessingImage" class="flex flex-col items-center py-2 space-y-1">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                  <span class="text-xs text-base-content/70">Analyse de sécurité et assainissement de l'image…</span>
                </div>

                <div v-else-if="form.imageUrl && form.imageUrl.startsWith('data:')" class="flex items-center justify-between gap-3 text-left">
                  <div class="flex items-center gap-3">
                    <img :src="form.imageUrl" alt="Aperçu" class="w-12 h-12 rounded object-cover border border-base-content/20" />
                    <div>
                      <p class="text-xs font-semibold text-success flex items-center gap-1">
                        <span>✓</span> Image locale assainie et sécurisée
                      </p>
                      <p class="text-[11px] text-base-content/60">
                        {{ uploadedFileInfo || 'Prête à être utilisée' }}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    @click.stop="clearLocalImage"
                  >
                    ✕ Retirer
                  </button>
                </div>

                <div v-else class="flex flex-col items-center py-2 text-base-content/70">
                  <span class="text-2xl mb-1">🖼️</span>
                  <p class="text-xs font-semibold">
                    Clique pour parcourir ou glisse-dépose une image depuis ton PC
                  </p>
                  <p class="text-[11px] text-base-content/50 mt-0.5">
                    Formats acceptés : PNG, JPG, WebP, GIF, AVIF (Max 5 Mo) · SVG & scripts bloqués
                  </p>
                </div>
              </div>
              <p v-if="imageSecurityError" class="text-xs text-error font-medium">
                ⚠️ {{ imageSecurityError }}
              </p>
            </div>

            <!-- Mode 2 : URL Externe -->
            <div v-else class="space-y-1">
              <input
                v-model="form.imageUrl"
                type="url"
                placeholder="https://images.unsplash.com/... ou lien direct vers image"
                class="input input-bordered w-full text-xs font-mono"
              />
              <span class="text-[11px] text-base-content/50 block">
                Formats acceptés : PNG, JPG, WebP
              </span>
            </div>
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

            <!-- XP : Gain lors de la destruction d'un Allié (Wakfu TCG : pas de coût en Kamas) -->
            <div class="form-control">
              <div v-if="isAllyType">
                <label class="label">
                  <span class="label-text font-semibold text-amber-500">Gain d'XP (Allié)</span>
                </label>
                <input
                  v-model.number="form.stats.xp"
                  type="number"
                  min="0"
                  max="20"
                  class="input input-bordered input-warning w-full font-mono font-bold"
                  placeholder="1"
                />
                <p class="text-[10px] text-base-content/60 mt-1">
                  XP donnée à l'adversaire quand cet Allié est détruit
                </p>
              </div>
              <div v-else class="opacity-50">
                <label class="label">
                  <span class="label-text font-semibold">Gain d'XP</span>
                </label>
                <input
                  type="text"
                  disabled
                  value="—"
                  class="input input-bordered w-full font-mono text-center cursor-not-allowed"
                />
                <p class="text-[10px] text-base-content/50 mt-1">
                  Seuls les Alliés rapportent de l'XP
                </p>
              </div>
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
import { validateAndSanitizeImageFile } from '@/utils/safeImageUpload'
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
    xp?: number
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
    xp: 1,
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

const isAllyType = computed(() => {
  return form.mainType === 'Allié' || form.mainType === 'Allié Élémentaire'
})

// Gestion sécurisée des illustrations (Upload local PC vs URL)
const imageSourceMode = ref<'local' | 'url'>('local')
const isDragging = ref(false)
const isProcessingImage = ref(false)
const imageSecurityError = ref('')
const uploadedFileInfo = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function processImageFile(file: File) {
  isProcessingImage.value = true
  imageSecurityError.value = ''
  try {
    const res = await validateAndSanitizeImageFile(file)
    if (res.ok && res.dataUrl) {
      form.imageUrl = res.dataUrl
      uploadedFileInfo.value = `${file.name} (${res.width}x${res.height} px, ${(file.size / 1024).toFixed(0)} Ko)`
      imageSecurityError.value = ''
    } else {
      imageSecurityError.value = res.error || "Erreur de sécurité lors de l'analyse du fichier."
    }
  } catch {
    imageSecurityError.value = "Impossible de traiter l'image sélectionnée."
  } finally {
    isProcessingImage.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function handleFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    void processImageFile(file)
  }
}

function handleFileDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    void processImageFile(file)
  }
}

function clearLocalImage() {
  form.imageUrl = ''
  uploadedFileInfo.value = ''
  imageSecurityError.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

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
  stats: {
    ...form.stats,
    xp: isAllyType.value ? (form.stats.xp ?? 0) : undefined,
  },
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
  clearLocalImage()
  form.stats = { level: 1, xp: 1, hp: 5, strength: 2, ap: 0, mp: 0, resistance: 0 }
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
  if (form.imageUrl && form.imageUrl.startsWith('data:')) {
    imageSourceMode.value = 'local'
    uploadedFileInfo.value = 'Image chargée'
  } else if (form.imageUrl) {
    imageSourceMode.value = 'url'
  }
  subTypesInput.value = (rec.card_data.subTypes || []).join(', ')
  form.stats = {
    level: rec.card_data.stats?.niveau?.value,
    xp: rec.card_data.experience ?? 0,
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
      stats: {
        ...form.stats,
        xp: isAllyType.value ? (form.stats.xp ?? 0) : undefined,
      },
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
