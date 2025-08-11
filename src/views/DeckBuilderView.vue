<template>
  <div class="deck-builder-view w-full h-full min-h-screen bg-base-100">
    <div class="flex flex-col md:flex-row h-full">
      <!-- Partie gauche : Collection de cartes -->
      <div class="w-full md:w-2/3 p-2 md:p-4 collection-container">
        <div class="flex flex-col gap-4">
          <!-- En-tête avec le titre et les actions -->
          <div class="flex flex-wrap justify-between items-center gap-4">
            <div class="flex items-center gap-2">
              <router-link to="/decks" class="btn btn-sm btn-ghost">
                <i class="fas fa-arrow-left"></i>
              </router-link>
              <h1 class="text-2xl font-bold">
                {{ isEditingDeck ? 'Modification du deck' : 'Nouveau deck' }}
                <span v-if="currentDeck?.name" class="text-sm font-normal"
                  >: {{ currentDeck.name }}</span
                >
              </h1>
            </div>

            <div v-if="isEditingDeck" class="flex-none">
              <router-link :to="`/deck/${deckId}`" class="btn btn-sm btn-ghost">
                <i class="fas fa-eye mr-1"></i> Voir
              </router-link>
            </div>
          </div>

          <!-- Filtres de recherche pour la collection -->
          <div class="flex flex-col gap-4">
            <CollectionFilters
              v-model:search-query="searchQuery"
              v-model:selected-extension="selectedExtension"
              v-model:hide-not-owned="hideNotOwned"
              v-model:selected-sort-field="selectedSortField"
              v-model:is-descending="isDescending"
              v-model:selected-main-type="selectedMainType"
              v-model:selected-sub-type="selectedSubType"
              v-model:selected-rarity="selectedRarity"
              v-model:selected-element="selectedElement"
              v-model:min-level="minLevel"
              v-model:max-level="maxLevel"
              v-model:min-cost="minCost"
              v-model:max-cost="maxCost"
              :extensions="extensions"
              :main-types="mainTypes"
              :sub-types="subTypes"
              :rarities="rarities"
              :elements="elements"
            />
            
            <!-- Bouton de réinitialisation des filtres -->
            <div class="flex justify-end">
              <button 
                @click="resetAllFilters" 
                class="btn btn-sm btn-outline"
                title="Réinitialiser tous les filtres"
              >
                <i class="fas fa-undo mr-2"></i> Réinitialiser les filtres
              </button>
            </div>
          </div>

          <!-- Message concernant les types spéciaux de cartes -->
          <div
            v-if="
              !currentDeck?.hero || !currentDeck?.havreSac || cardCount !== 48
            "
            class="alert alert-info shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p class="font-bold">Règles de construction du deck :</p>
              <ul class="list-disc list-inside ml-2">
                <li v-if="!currentDeck?.hero" class="text-sm">
                  Choisissez un héros
                </li>
                <li v-if="!currentDeck?.havreSac" class="text-sm">
                  Choisissez un havre-sac
                </li>
                <li v-if="cardCount !== 48" class="text-sm">
                  Ajoutez exactement 48 cartes (actuellement: {{ cardCount }})
                </li>
              </ul>
            </div>
          </div>

          <!-- Message de deck validé -->
          <div
            v-if="
              currentDeck?.hero && currentDeck?.havreSac && cardCount === 48
            "
            class="alert alert-success shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p class="font-bold">Deck complet !</p>
              <p class="text-sm">
                Votre deck est valide et prêt à être utilisé.
              </p>
            </div>
            <div class="ml-auto">
              <button @click="exportDeck" class="btn btn-sm btn-success">
                <i class="fas fa-download mr-1"></i> Exporter
              </button>
            </div>
          </div>

          <!-- Grille de cartes de la collection avec action d'ajout au deck -->
          <div class="collection-grid">
            <!-- Message d'aide pour la sélection de type spécifique -->
            <div
              v-if="selectedMainType === 'Héros'"
              class="alert alert-info shadow-lg mb-4"
            >
              <div class="flex items-center">
                <i class="fas fa-info-circle mr-2"></i>
                <span>
                  <span class="font-bold">Sélection de héros:</span>
                  Cliquez sur un héros ci-dessous pour l'ajouter à votre deck
                </span>
              </div>
            </div>

            <div
              v-else-if="selectedMainType === 'Havre-sac'"
              class="alert alert-info shadow-lg mb-4"
            >
              <div class="flex items-center">
                <i class="fas fa-info-circle mr-2"></i>
                <span>
                  <span class="font-bold">Sélection de havre-sac:</span>
                  Cliquez sur un havre-sac ci-dessous pour l'ajouter à votre
                  deck
                </span>
              </div>
            </div>

            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            >
              <div
                v-for="item in filteredCollection"
                :key="item.card.id"
                class="card-item relative bg-base-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                :class="{ 
                  'opacity-50 saturate-50 grayscale-50': item.totalQuantity === 0,
                  'ring-2 ring-primary ring-opacity-30': item.inDeck > 0 
                }"
                  @click="selectCard(item.card)"
                >
                <!-- Image de la carte -->
                <div class="card-image relative aspect-[0.715] overflow-hidden">
                  <img
                    :src="item.card.imageUrl"
                    :alt="item.card.name"
                    class="w-full h-full object-cover"
                  />
                </div>

                <!-- Contrôles simplifiés -->
                <div class="card-info p-2">
                  <!-- Nom de la carte -->
                  <h3 class="text-sm font-semibold text-center mb-2" :class="getRarityClass(item.card.rarity)">
                      {{ item.card.name }}
                    </h3>
                  
                  <!-- Contrôles -->
                  <div class="flex items-center justify-between">
                    <!-- Quantité possédée -->
                    <div class="flex items-center gap-1">
                      <span class="text-xs">Possédés:</span>
                    <span
                        class="badge badge-sm"
                        :class="item.totalQuantity > 0 ? 'badge-success' : 'badge-error'"
                      >{{ item.totalQuantity }}</span>
                      <span v-if="item.foilQuantity > 0" class="badge badge-sm badge-warning">
                        ✨ {{ item.foilQuantity }}
                    </span>
                  </div>

                                        <!-- Boutons d'action -->
                    <div class="flex items-center gap-1">
                      <!-- Bouton pour retirer du deck (si déjà dans le deck) -->
                      <button
                        v-if="item.inDeck > 0"
                        @click.stop="removeCard(item.card.id, 1)"
                        class="btn btn-xs btn-error"
                        title="Retirer 1 du deck"
                      >
                        <i class="fas fa-minus"></i>
                      </button>
                      
                      <!-- Quantité en deck pour les cartes normales -->
                          <span
                        v-if="item.inDeck > 0 && item.card.mainType !== 'Héros' && item.card.mainType !== 'Havre-sac'"
                        class="text-xs font-semibold px-1"
                      >{{ item.inDeck }}</span>

                      <!-- Bouton d'ajout -->
                        <button
                        @click.stop="addCard(item.card)"
                        class="btn btn-xs btn-success"
                          :disabled="
                          (item.card.mainType === 'Héros' && currentDeck?.hero) ||
                          (item.card.mainType === 'Havre-sac' && currentDeck?.havreSac) ||
                          (item.card.mainType !== 'Héros' && item.card.mainType !== 'Havre-sac' && (item.inDeck >= 3 || cardCount >= 48))
                        "
                        title="Ajouter au deck"
                          >
                            <i class="fas fa-plus"></i>
                          </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Partie droite : Deck en construction -->
      <div class="deck-column w-full md:w-5/12 md:pl-4 space-y-4">
        <div
          class="deck-area-container p-4 md:p-6 bg-base-200 rounded-lg shadow flex flex-col h-full gap-3"
        >
          <!-- Deck selector -->
          <div class="deck-selector-wrapper mb-2">
            <div class="flex flex-col w-full">
              <div class="dropdown w-full">
                <label
                  tabindex="0"
                  class="btn btn-primary w-full flex justify-between"
                >
                  <div class="flex items-center">
                    <i class="fas fa-chess-rook mr-2"></i>
                    <span class="truncate max-w-[180px]">{{
                      currentDeck?.name || 'Sélectionner un deck'
                    }}</span>
                  </div>
                  <i class="fas fa-chevron-down"></i>
                </label>
                <ul
                  tabindex="0"
                  class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-full"
                >
                  <li v-if="!isEditingDeck">
                    <a @click="createNewDeck"
                      ><i class="fas fa-plus mr-2"></i> Nouveau deck</a
                    >
                  </li>
                  <li v-if="decks.length > 0" class="menu-title">
                    <span class="text-xs opacity-70">Mes decks</span>
                  </li>
                  <li v-for="deck in decks" :key="deck.id">
                    <a @click="loadDeck(deck.id)" class="flex justify-between">
                      <span class="truncate max-w-[180px]">{{
                        deck.name
                      }}</span>
                      <span
                        class="badge badge-sm"
                        :class="
                          checkDeckValidity(deck)
                            ? 'badge-success'
                            : 'badge-warning'
                        "
                      >
                        {{ countDeckCards(deck) }}
                      </span>
                    </a>
                  </li>
                  <li v-if="currentDeck" class="menu-title mt-2">
                    <span class="text-xs opacity-70">Actions</span>
                  </li>
                  <li v-if="currentDeck">
                    <a @click="renameDeck"
                      ><i class="fas fa-pen mr-2"></i> Renommer</a
                    >
                  </li>
                  <li v-if="currentDeck">
                    <a @click="saveDeck"
                      ><i class="fas fa-save mr-2"></i> Sauvegarder</a
                    >
                  </li>
                  <li v-if="currentDeck">
                    <a @click="exportDeckModal"
                      ><i class="fas fa-download mr-2"></i> Exporter</a
                    >
                  </li>

                  <li v-if="currentDeck" class="text-error">
                    <a @click="confirmDeleteDeck"
                      ><i class="fas fa-trash mr-2"></i> Supprimer</a
                    >
                  </li>
                </ul>
              </div>
              <div
                v-if="currentDeck"
                class="flex justify-between items-center text-xs text-base-content/70 mt-1 px-1"
              >
                <span>Modifié {{ formatTimeAgo(currentDeck.updatedAt) }}</span>
                <span
                  class="badge"
                  :class="isValid ? 'badge-success' : 'badge-warning'"
                >
                  {{ isValid ? 'Deck complet' : 'Deck incomplet' }}
                </span>
              </div>
            </div>
          </div>



          <!-- Héros et Havre-sac -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Héros -->
            <div
              class="hero-container border border-base-300 rounded-lg p-3 bg-base-100"
            >
              <h3 class="text-lg font-bold mb-2">Héros</h3>
              <div v-if="currentDeck?.hero" class="relative">
                <img
                  :src="
                    currentDeck.hero.imageUrl ||
                    `/images/cards/${currentDeck.hero.id}_recto.png`
                  "
                  :alt="currentDeck.hero.name"
                  class="h-40 rounded cursor-pointer"
                  @click="selectCard(currentDeck.hero)"
                  @error="onHeroImageError"
                />
                <button
                  @click="removeHero"
                  class="btn btn-circle btn-sm btn-error absolute top-1 right-1"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div
                v-else
                @click="setSelectedMainType('Héros')"
                class="flex flex-col items-center justify-center h-36 border border-dashed border-base-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                :class="{ 'border-error bg-error/5': !currentDeck?.hero }"
              >
                <div class="text-center">
                  <i
                    class="fas fa-chess-king text-2xl mb-2"
                    :class="!currentDeck?.hero ? 'text-error' : 'text-primary/50'"
                  ></i>
                  <p :class="!currentDeck?.hero ? 'text-error font-semibold' : ''">
                    {{ !currentDeck?.hero ? 'Cliquez pour choisir un héros' : 'Emplacement du héros' }}
                  </p>
                  <span v-if="!currentDeck?.hero" class="badge badge-error badge-xs mt-1">Requis</span>
                </div>
              </div>
            </div>

            <!-- Havre-sac -->
            <div
              class="havre-sac-container border border-base-300 rounded-lg p-3 bg-base-100"
            >
              <h3 class="text-lg font-bold mb-2">Havre-sac</h3>
              <div v-if="currentDeck?.havreSac" class="relative">
                <img
                  :src="
                    currentDeck.havreSac.imageUrl ||
                    `/images/cards/${currentDeck.havreSac.id}.png`
                  "
                  :alt="currentDeck.havreSac.name"
                  class="h-40 rounded cursor-pointer"
                  @click="selectCard(currentDeck.havreSac)"
                  @error="onHavreSacImageError"
                />
                <button
                  @click="removeHavreSac"
                  class="btn btn-circle btn-sm btn-error absolute top-1 right-1"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div
                v-else
                @click="setSelectedMainType('Havre-sac')"
                class="flex flex-col items-center justify-center h-36 border border-dashed border-base-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                :class="{ 'border-error bg-error/5': !currentDeck?.havreSac }"
              >
                <div class="text-center">
                  <i 
                    class="fas fa-suitcase text-2xl mb-2"
                    :class="!currentDeck?.havreSac ? 'text-error' : 'text-primary/50'"
                  ></i>
                  <p :class="!currentDeck?.havreSac ? 'text-error font-semibold' : ''">
                    {{ !currentDeck?.havreSac ? 'Cliquez pour choisir un havre-sac' : 'Emplacement du havre-sac' }}
                  </p>
                  <span v-if="!currentDeck?.havreSac" class="badge badge-error badge-xs mt-1">Requis</span>
                </div>
              </div>
            </div>
          </div>



          <!-- Cartes du deck -->
          <div
            class="deck-cards flex-grow border border-base-300 rounded-lg p-3 bg-base-100 overflow-y-auto"
          >
            <div class="flex justify-between items-center mb-3">
              <div class="flex items-center gap-3">
                <h3 class="text-lg font-bold">
                  Cartes ({{ cardCount }} / 48)
                </h3>
                </div>
              <div class="flex items-center gap-3">
                <!-- Statut de validation -->
                <div class="flex items-center gap-1">
                  <div class="w-2 h-2 rounded-full" :class="isValid ? 'bg-success' : 'bg-warning'"></div>
                  <span class="text-sm font-medium" :class="isValid ? 'text-success' : 'text-warning'">
                    {{ isValid ? 'Valide' : 'Incomplet' }}
                  </span>
                </div>
                
                <!-- Cartes manquantes -->
                <div v-if="missingCardsCount > 0" class="flex items-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-error"></div>
                  <span class="text-sm font-medium text-error">
                    {{ missingCardsCount }} manquante{{ missingCardsCount > 1 ? 's' : '' }}
                  </span>
                </div>
                
                <div class="dropdown dropdown-end">
                  <label tabindex="0" class="btn btn-sm btn-outline">
                    <i class="fas fa-filter mr-1"></i> Filtrer
                  </label>
                  <ul
                    tabindex="0"
                    class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-48"
                  >
                    <li>
                      <a
                        @click="
                          () => {
                            setSelectedMainType('Héros')
                          }
                        "
                        >Afficher les héros</a
                      >
                    </li>
                    <li>
                      <a
                        @click="
                          () => {
                            setSelectedMainType('Havre-sac')
                          }
                        "
                        >Afficher les havre-sacs</a
                      >
                    </li>
                    <li>
                      <a
                        @click="
                          () => {
                            setSelectedMainType('')
                          }
                        "
                        >Afficher toutes les cartes</a
                      >
                    </li>
                  </ul>
                </div>
                
                <div
                  v-if="currentDeck?.cards && currentDeck.cards.length > 0"
                  class="dropdown dropdown-end"
                >
                  <label tabindex="0" class="btn btn-sm btn-outline">
                    <i class="fas fa-sort mr-1"></i> Trier
                  </label>
                  <ul
                    tabindex="0"
                    class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-48"
                  >
                    <li>
                      <a
                        @click="
                          () => {
                            sortOrder = 'cost'
                          }
                        "
                        >Par coût</a
                      >
                    </li>
                    <li>
                      <a
                        @click="
                          () => {
                            sortOrder = 'name'
                          }
                        "
                        >Par nom</a
                      >
                    </li>
                    <li>
                      <a
                        @click="
                          () => {
                            sortOrder = 'type'
                          }
                        "
                        >Par type</a
                      >
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div
              v-if="!currentDeck?.hero || !currentDeck?.havreSac"
              class="alert alert-info mb-4"
            >
              <div>
                <i class="fas fa-info-circle mr-2"></i>
                <span>
                  {{
                    !currentDeck?.hero
                      ? 'Vous devez ajouter un héros à votre deck.'
                      : ''
                  }}
                  {{
                    !currentDeck?.havreSac
                      ? 'Vous devez ajouter un havre-sac à votre deck.'
                      : ''
                  }}
                </span>
              </div>
              <div class="text-sm opacity-70">
                Cliquez directement sur les emplacements héros et havre-sac pour les sélectionner
              </div>
            </div>

            <div
              v-if="!currentDeck?.cards || currentDeck.cards.length === 0"
              class="flex flex-col items-center justify-center py-6 text-base-content/70"
            >
              <i class="fas fa-inbox text-2xl mb-2"></i>
              <p>Aucune carte ajoutée</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="deckCard in sortedDeckCards"
                :key="deckCard.card.id"
                class="deck-card-item flex items-center p-2 bg-base-300 rounded-lg hover:bg-base-300/80 transition"
              >
                <div class="card-image w-10 h-10 overflow-hidden rounded mr-3">
                  <img
                    :src="deckCard.card.imageUrl"
                    :alt="deckCard.card.name"
                    class="w-full h-full object-cover cursor-pointer"
                    @click="selectCard(deckCard.card)"
                  />
                </div>
                <div class="card-info flex-grow">
                  <div
                    class="card-name font-semibold text-sm truncate"
                    :class="getRarityClass(deckCard.card.rarity)"
                  >
                    {{ deckCard.card.name }}
                  </div>
                  <div
                    class="card-stats flex items-center justify-between text-xs"
                  >
                    <div class="flex items-center gap-2">
                      <span
                        v-if="deckCard.card.stats?.pa"
                        class="flex items-center"
                      >
                        <i class="fas fa-bolt text-warning mr-1"></i
                        >{{ deckCard.card.stats.pa }}
                      </span>
                      <span
                        v-if="deckCard.card.stats?.niveau?.value"
                        class="flex items-center"
                      >
                        <i class="fas fa-arrow-up text-info mr-1"></i
                        >{{ deckCard.card.stats.niveau.value }}
                      </span>
                      <span class="opacity-70">{{
                        deckCard.card.mainType
                      }}</span>
                    </div>

                    <!-- Total dans la collection -->
                    <div class="flex items-center">
                      <span class="text-xs opacity-70">Collection:</span>
                      <span class="badge badge-xs ml-1">{{
                        getTotalQuantity(deckCard.card.id)
                      }}</span>
                    </div>
                  </div>
                </div>
                <div class="card-quantity flex flex-col items-end gap-2">
                  <div class="join">
                    <button
                      class="join-item btn btn-xs btn-error"
                      title="Retirer 1"
                      @click="removeCardQuantity(deckCard.card.id, 1)"
                    >
                      <i class="fas fa-minus"></i>
                    </button>
                    <span class="join-item px-2 text-xs font-semibold select-none bg-base-200">{{ deckCard.quantity }}/3</span>
                    <button
                      class="join-item btn btn-xs btn-success"
                      title="Ajouter 1"
                      :disabled="deckCard.quantity >= 3 || cardCount >= 48"
                      @click="addCardQuantity(deckCard.card, 1)"
                    >
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                  <!-- Barre de progression -->
                  <div class="w-full bg-base-200 rounded-full h-1">
                    <div
                      class="bg-primary h-1 rounded-full"
                      :style="{ width: `${(deckCard.quantity / 3) * 100}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal pour la sélection de deck -->
    <dialog id="deck_selector_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Mes decks</h3>
        <div
          v-if="decks.length === 0"
          class="text-center py-4 text-base-content/70"
        >
          <i class="fas fa-info-circle text-2xl mb-2"></i>
          <p>Vous n'avez pas encore de deck</p>
          <button
            @click="createNewDeckAndCloseModal"
            class="btn btn-primary mt-4"
          >
            <i class="fas fa-plus mr-1"></i> Créer un deck
          </button>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="p-3 border rounded-lg cursor-pointer hover:bg-base-200 flex flex-col"
            @click="loadDeck(deck.id)"
          >
            <div class="flex justify-between items-center">
              <span class="font-medium">{{ deck.name }}</span>
              <div class="flex gap-1">
                <span class="text-xs opacity-70">{{
                  formatTimeAgo(deck.updatedAt)
                }}</span>
                <button
                  class="btn btn-xs btn-ghost text-error"
                  @click.stop="confirmDeleteSpecificDeck(deck.id, deck.name)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="text-xs text-base-content/70 flex flex-wrap gap-1 mt-1">
              <span class="badge badge-sm">{{
                getDeckClassElement(deck)
              }}</span>
              <span class="badge badge-sm"
                >{{ countDeckCards(deck) }} cartes</span
              >
              <span
                v-if="checkDeckValidity(deck)"
                class="badge badge-sm badge-success"
                >Complet</span
              >
              <span v-else class="badge badge-sm badge-warning">Incomplet</span>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">Fermer</button>
          </form>
        </div>
      </div>
    </dialog>

    <!-- Modal pour le renommage du deck -->
    <dialog id="rename_deck_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Renommer le deck</h3>
        <div class="form-control">
          <input
            type="text"
            v-model="newDeckName"
            class="input input-bordered w-full"
            placeholder="Nouveau nom du deck"
            @keyup.enter="confirmRenameDeck"
          />
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="confirmRenameDeck">
            Renommer
          </button>
          <form method="dialog">
            <button class="btn">Annuler</button>
          </form>
        </div>
      </div>
    </dialog>

    <!-- Modal pour l'export du deck -->
    <dialog id="export_deck_modal" class="modal">
      <div class="modal-box max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="font-bold text-lg mb-4">Exporter le deck</h3>
        
        <div class="mb-4">
          <textarea
            v-model="exportedDeckText"
            class="textarea textarea-bordered w-full h-32 font-mono text-sm"
            readonly
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-2">
          <button class="btn btn-primary" @click="copyExportToClipboard">
            <i class="fas fa-copy mr-2"></i> Copier
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>



    <!-- Modal de confirmation de suppression -->
    <dialog id="confirm_delete_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error">Supprimer le deck</h3>
        <p class="py-4">
          Êtes-vous sûr de vouloir supprimer le deck "{{ currentDeck?.name }}" ?
          Cette action est irréversible.
        </p>
        <div class="modal-action">
          <button class="btn btn-error" @click="confirmDeleteDeckAction">
            Supprimer
          </button>
          <form method="dialog">
            <button class="btn">Annuler</button>
          </form>
        </div>
      </div>
    </dialog>

    <!-- Modal de détail de carte -->
    <dialog id="card_detail_modal" class="modal z-50">
      <div class="modal-box max-w-4xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle absolute right-2 top-2">
            ✕
          </button>
        </form>
        <div v-if="selectedCard" class="space-y-4">
          <!-- En-tête avec le nom et les onglets pour les héros -->
          <div class="flex justify-between items-center">
            <h3 class="text-2xl font-bold">{{ selectedCard.name }}</h3>
            <div v-if="isSelectedCardHero" class="join">
              <button
                class="join-item btn"
                :class="{ 'btn-active': !showVerso }"
                @click="showVerso = false"
              >
                Recto
              </button>
              <button
                class="join-item btn"
                :class="{ 'btn-active': showVerso }"
                @click="showVerso = true"
              >
                Verso
              </button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-8">
            <!-- Image -->
            <div class="relative aspect-[7/10] h-auto">
              <OptimizedImage
                :src="getSelectedCardImage"
                :alt="selectedCard.name"
                :width="480"
                :height="660"
                loading="eager"
                fetchpriority="high"
                class="rounded-lg w-full h-full"
                @error="handleImageError"
              />

              <!-- Message d'erreur si les deux faces ont échoué -->
              <div
                v-if="imageHasError && isSelectedCardHero && imageFallbackMode"
                class="absolute inset-0 flex flex-col items-center justify-center bg-base-300/90 rounded-lg p-4"
              >
                <div class="text-center space-y-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto text-warning"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <h3 class="text-lg font-bold">Image non disponible</h3>
                  <p class="text-sm">
                    Impossible de charger le
                    {{ showVerso ? 'verso' : 'recto' }} de cette carte.
                  </p>
                  <p class="text-xs text-base-content/60">
                    ID: {{ selectedCard.id }}_{{
                      showVerso ? 'verso' : 'recto'
                    }}
                  </p>

                  <!-- Boutons pour essayer les différentes faces -->
                  <div class="join mt-4">
          <button
                      class="join-item btn btn-sm"
                      :class="{ 'btn-ghost': showVerso }"
                      @click="
                        showVerso = false;
                        imageHasError = false;
                        imageFallbackMode = null;
                      "
                    >
                      Essayer Recto
          </button>
                    <button
                      class="join-item btn btn-sm"
                      :class="{ 'btn-ghost': !showVerso }"
                      @click="
                        showVerso = true;
                        imageHasError = false;
                        imageFallbackMode = null;
                      "
                    >
                      Essayer Verso
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informations -->
            <div class="space-y-4">
              <!-- Type et sous-types -->
              <div class="flex flex-wrap gap-2">
                <div class="badge badge-lg">{{ selectedCard.mainType }}</div>
                <div
                  v-for="subType in selectedCard.subTypes"
                  :key="subType"
                  class="badge badge-outline"
                >
                  {{ subType }}
                </div>
                <div
                  v-if="
                    isSelectedCardHero &&
                    selectedCard &&
                    isHeroCard(selectedCard)
                  "
                  class="badge badge-secondary"
                >
                  {{ selectedCard.class }}
                </div>
              </div>

              <!-- Stats -->
              <div
                v-if="displayedStats"
                class="stats stats-vertical shadow w-full"
              >
                <div v-if="displayedStats.niveau" class="stat">
                  <div class="stat-title">Niveau</div>
                  <div class="stat-value flex items-center gap-2">
                    {{ displayedStats.niveau.value }}
                    <span
                      v-if="
                        displayedStats.niveau.element.toLowerCase() !==
                        'neutre'
                      "
                      :class="getElementClass(displayedStats.niveau.element)"
                      class="text-2xl"
                    >
                      <ElementIcon
                        :element="
                          stringToElement(displayedStats.niveau.element)
                        "
                        size="sm"
                      />
                    </span>
                  </div>
                </div>
                <div v-if="displayedStats.force" class="stat">
                  <div class="stat-title">Force</div>
                  <div class="stat-value flex items-center gap-2">
                    {{ displayedStats.force.value }}
                    <span
                      v-if="
                        displayedStats.force.element.toLowerCase() !==
                        'neutre'
                      "
                      :class="getElementClass(displayedStats.force.element)"
                      class="text-2xl"
                    >
                      <ElementIcon
                        :element="stringToElement(displayedStats.force.element)"
                        size="sm"
                      />
                    </span>
                  </div>
                </div>
                <div v-if="displayedStats.pa" class="stat">
                  <div class="stat-title">PA</div>
                  <div class="stat-value">{{ displayedStats.pa }}</div>
                </div>
                <div v-if="displayedStats.pm" class="stat">
                  <div class="stat-title">PM</div>
                  <div class="stat-value">{{ displayedStats.pm }}</div>
                </div>
                <div v-if="displayedStats.pv" class="stat">
                  <div class="stat-title">PV</div>
                  <div class="stat-value">{{ displayedStats.pv }}</div>
                </div>
              </div>

              <!-- Effets -->
              <div v-if="displayedEffects?.length" class="divider">Effets</div>
              <div v-if="displayedEffects?.length" class="space-y-4">
                <div
                  v-for="(effect, index) in displayedEffects"
                  :key="index"
                  class="card bg-base-200"
                >
                  <div class="card-body p-4">
                    <p class="text-sm">{{ effect.description }}</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <div
                        v-if="effect.elements?.length"
                        class="flex items-center gap-1"
                      >
                        <span
                          v-for="element in effect.elements"
                          :key="element"
                          :class="getElementClass(element)"
                          class="text-lg"
                        >
                          <ElementIcon
                            :element="stringToElement(element)"
                            size="sm"
                          />
                        </span>
                      </div>
                      <div v-if="effect.isOncePerTurn" class="badge badge-sm">
                        Une fois par tour
                      </div>
                      <div v-if="effect.requiresIncline" class="badge badge-sm">
                        Nécessite d'incliner
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mots-clés -->
              <div v-if="displayedKeywords?.length" class="divider">
                Mots-clés
              </div>
              <div
                v-if="displayedKeywords?.length"
                class="flex flex-wrap gap-2"
              >
                <div
                  v-for="keyword in displayedKeywords"
                  :key="keyword.name"
                  class="badge badge-lg badge-outline tooltip tooltip-top"
                  :data-tip="keyword.description"
                >
                  <span class="font-medium">{{ keyword.name }}</span>
                  <span
                    v-if="keyword.elements?.length"
                    class="ml-2 flex items-center gap-1"
                  >
                    <span
                      v-for="element in keyword.elements"
                      :key="element"
                      :class="getElementClass(element)"
                      class="text-lg"
                    >
                      <ElementIcon
                        :element="stringToElement(element)"
                        size="sm"
                      />
                    </span>
                  </span>
                </div>
              </div>

              <!-- Informations -->
              <div class="divider">Informations</div>
              <div class="card bg-base-200">
                <div class="card-body p-4 space-y-2">
                  <!-- Extension -->
                  <div class="flex items-center gap-2">
                    <span class="text-base-content/60">Extension :</span>
                    <span class="badge badge-neutral">
                      {{ selectedCard.extension.name }}
                      <span
                        v-if="selectedCard.extension.number"
                        class="ml-2 opacity-70"
                      >
                        #{{ selectedCard.extension.number }}
                      </span>
                    </span>
                  </div>

                  <!-- Artistes -->
                  <div
                    v-if="selectedCard.artists?.length"
                    class="flex items-center gap-2"
                  >
                    <span class="text-base-content/60">Artiste(s) :</span>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="artist in selectedCard.artists"
                        :key="artist"
                        class="badge badge-ghost"
                      >
                        {{ artist }}
                      </span>
                    </div>
                  </div>

                  <!-- Flavor -->
                  <div v-if="selectedCard.flavor" class="mt-4">
                    <blockquote
                      class="italic text-base-content/70 border-l-4 border-primary/20 pl-4"
                    >
                      "{{ selectedCard.flavor.text }}"
                      <footer
                        v-if="selectedCard.flavor.attribution"
                        class="text-right mt-1"
                      >
                        - {{ selectedCard.flavor.attribution }}
                      </footer>
                    </blockquote>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeCardDetail">Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import { useDeckStore } from '@/stores/deckStore'
import { useToast } from '@/composables/useToast'
import { useRoute, useRouter } from 'vue-router'
import CollectionFilters from '@/components/collection/CollectionFilters.vue'
import CollectionGrid from '@/components/collection/CollectionGrid.vue'
import CardDetail from '@/components/CardDetail.vue'
import DeckCardItem from '@/components/deck/DeckCardItem.vue'
import DeckHeroCard from '@/components/deck/DeckHeroCard.vue'
import OptimizedImage from '@/components/common/OptimizedImage.vue'
import ElementIcon from '@/components/elements/ElementIcon.vue'
import type { Card, HeroCard } from '@/types/cards'
import { ELEMENTS } from '@/config/constants'



// Stores et route
const cardStore = useCardStore()
const deckStore = useDeckStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

// Constants
const minDeckSize = 30
const maxDeckSize = 40

// Récupérer l'ID du deck depuis la route
const deckId = computed(() => route.params.id as string)
const isEditingDeck = computed(() => !!deckId.value)

// Vérifier si le deck est valide
const isDeckValid = computed(() => {
  if (!currentDeck.value) return false
  return (
    !!currentDeck.value.hero &&
    !!currentDeck.value.havreSac &&
    cardCount.value === 48
  )
})

// États des filtres
const searchQuery = ref('')
const selectedExtension = ref('')
const selectedSortField = ref('number')
const isDescending = ref(false)
const selectedMainType = ref('')
const selectedSubType = ref('')
const selectedRarity = ref('')
const selectedElement = ref('')
const minLevel = ref(0)
const maxLevel = ref(100)
const minCost = ref<number | null>(null)
const maxCost = ref<number | null>(null)

// États pour les modals
const newDeckName = ref('')
const selectedCard = ref<Card | null>(null)
const exportedDeckText = ref('')
const sortOrder = ref<'cost' | 'type' | 'name'>('type')
const showCardDetail = ref(false)
const cardDetailModal = ref<HTMLDialogElement | null>(null)

// États pour le modal de détail complet
const showVerso = ref(false)
const imageHasError = ref(false)
const imageFallbackMode = ref<'recto' | 'verso' | null>(null)

// Surveiller les changements de showCardDetail pour ouvrir/fermer le modal
watch(showCardDetail, (newValue) => {
  if (newValue && cardDetailModal.value) {
    cardDetailModal.value.showModal()
  } else if (cardDetailModal.value) {
    cardDetailModal.value.close()
  }
})

// Reset verso state when card changes
watch(
  () => selectedCard.value,
  () => {
    showVerso.value = false
    imageHasError.value = false
    imageFallbackMode.value = null
  }
)

// S'assurer que le modal est fermé quand la carte sélectionnée change
watch(selectedCard, () => {
  if (selectedCard.value === null) {
    showCardDetail.value = false
  }
})



// Récupérer les données des stores
const cards = computed(() => cardStore.cards)
// La collection est gérée par `cardStore` désormais
const collection = computed(() => cardStore.collection)
const decks = computed(() => deckStore.decks)
const currentDeck = computed(() => deckStore.currentDeck)
const isValid = computed(() => deckStore.isValid)
const heroCount = computed(() => deckStore.heroCount)
const havreSacCount = computed(() => deckStore.havreSacCount)
const cardCount = computed(() => deckStore.cardCount)
const totalCount = computed(() => deckStore.totalCount)

// Compteur de cartes manquantes dans la collection
const missingCardsCount = computed(() => {
  if (!currentDeck.value?.cards) return 0
  
  let missing = 0
  
  // Vérifier les cartes du deck
  currentDeck.value.cards.forEach(deckCard => {
    const normalQuantity = cardStore.getCardQuantity(deckCard.card.id) || 0
    const foilQuantity = cardStore.getFoilCardQuantity(deckCard.card.id) || 0
    const totalOwned = normalQuantity + foilQuantity
    
    if (deckCard.quantity > totalOwned) {
      missing += deckCard.quantity - totalOwned
    }
  })
  
  return missing
})
const costCurve = computed<CostCurveItem[]>(() => {
  return deckStore.costCurve as unknown as CostCurveItem[]
})
const uniqueCardTypes = computed(
  () => Object.keys(deckStore.typeDistribution).length
)

// Options pour les filtres - correction du typage et récupération des valeurs
const extensions = computed(() => {
  // Si cardStore.extensions existe, l'utiliser, sinon extraire des cartes
  if ('extensions' in cardStore && Array.isArray(cardStore.extensions)) {
    return cardStore.extensions
  }
  // Sinon extraire des cartes
  const extensionSet = new Set<string>()
  cards.value.forEach((card) => {
    if (card.extension && card.extension.name) {
      extensionSet.add(card.extension.name)
    }
  })
  return Array.from(extensionSet).sort()
})

const mainTypes = computed(() => {
  // Si cardStore.mainTypes existe, l'utiliser, sinon extraire des cartes
  if ('mainTypes' in cardStore && Array.isArray((cardStore as any).mainTypes)) {
    return (cardStore as any).mainTypes
  }
  // Sinon extraire des cartes
  const typeSet = new Set<string>()
  cards.value.forEach((card) => {
    if (card.mainType) {
      typeSet.add(card.mainType)
    }
  })
  return Array.from(typeSet).sort()
})

const subTypes = computed(() => {
  // Si cardStore.subTypes existe, l'utiliser, sinon extraire des cartes
  if ('subTypes' in cardStore && Array.isArray((cardStore as any).subTypes)) {
    return (cardStore as any).subTypes
  }
  // Sinon extraire des cartes
  const typeSet = new Set<string>()
  cards.value.forEach((card) => {
    if (card.subTypes && Array.isArray(card.subTypes)) {
      card.subTypes.forEach((type) => typeSet.add(type))
    }
  })
  return Array.from(typeSet).sort()
})

const rarities = computed(() => {
  // Si cardStore.rarities existe, l'utiliser, sinon extraire des cartes
  if ('rarities' in cardStore && Array.isArray((cardStore as any).rarities)) {
    return (cardStore as any).rarities
  }
  // Sinon extraire des cartes
  const raritySet = new Set<string>()
  cards.value.forEach((card) => {
    if (card.rarity) {
      raritySet.add(card.rarity)
    }
  })
  return Array.from(raritySet).sort()
})

const elements = computed(() => {
  // Si cardStore.elements existe, l'utiliser, sinon extraire des cartes
  if ('elements' in cardStore && Array.isArray((cardStore as any).elements)) {
    return (cardStore as any).elements
  }
  // Sinon extraire des cartes
  const elementSet = new Set<string>()
  cards.value.forEach((card) => {
    const element = card.stats?.niveau?.element || card.stats?.force?.element
    if (element) {
      elementSet.add(element)
    }
  })
  return Array.from(elementSet).sort()
})

// Dans la section script setup, ajouter la variable hideNotOwned
const hideNotOwned = ref(false)

// Collection filtrée
const filteredCollection = computed(() => {
  let filtered = [...cards.value]

  // Filtrer par terme de recherche
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (card) =>
        card.name.toLowerCase().includes(query) ||
        (card.effects?.some((effect) =>
          effect.description.toLowerCase().includes(query)
        ) ??
          false)
    )
  }

  // Filtrer par extension
  if (selectedExtension.value) {
    filtered = filtered.filter(
      (card) => card.extension.name === selectedExtension.value
    )
  }

  // Filtrer par type principal
  if (selectedMainType.value) {
    filtered = filtered.filter(
      (card) => card.mainType === selectedMainType.value
    )
  }

  // Filtrer par sous-type
  if (selectedSubType.value) {
    filtered = filtered.filter((card) =>
      card.subTypes.includes(selectedSubType.value)
    )
  }

  // Filtrer par rareté
  if (selectedRarity.value) {
    filtered = filtered.filter((card) => card.rarity === selectedRarity.value)
  }

  // Filtrer par élément
  if (selectedElement.value) {
    filtered = filtered.filter((card) => {
      const element = card.stats?.niveau?.element || card.stats?.force?.element
      return element === selectedElement.value
    })
  }

  // Filtrer par niveau
  if (minLevel.value || maxLevel.value) {
    filtered = filtered.filter((card) => {
      const level = card.stats?.niveau?.value || 0
      if (minLevel.value && level < minLevel.value) return false
      if (maxLevel.value && level > maxLevel.value) return false
      return true
    })
  }

  // Filtrer par coût (PA)
  if (minCost.value !== null || maxCost.value !== null) {
    filtered = filtered.filter((card) => {
      const cost = card.stats?.pa || 0
      if (minCost.value !== null && cost < minCost.value) return false
      if (maxCost.value !== null && cost > maxCost.value) return false
      return true
    })
  }

  // Filtrer par possession (cartes que l'utilisateur possède)
  if (hideNotOwned.value) {
    filtered = filtered.filter((card) => {
      const normalQuantity = cardStore.getCardQuantity(card.id)
      const foilQuantity = cardStore.getFoilCardQuantity(card.id)
      return normalQuantity + foilQuantity > 0
    })
  }

  // Exclure les héros et havre-sacs déjà dans le deck
  if (currentDeck.value?.hero) {
    filtered = filtered.filter(
      (card) => card.id !== currentDeck.value?.hero?.id
    )
  }

  if (currentDeck.value?.havreSac) {
    filtered = filtered.filter(
      (card) => card.id !== currentDeck.value?.havreSac?.id
    )
  }

  // Trier les résultats
  filtered.sort((a, b) => {
    let valueA, valueB

    switch (selectedSortField.value) {
      case 'name':
        valueA = a.name
        valueB = b.name
        break
      case 'rarity':
        valueA = getRarityValue(a.rarity)
        valueB = getRarityValue(b.rarity)
        break
      case 'cost':
        valueA = a.stats?.pa || 0
        valueB = b.stats?.pa || 0
        break
      case 'level':
        valueA = a.stats?.niveau?.value || 0
        valueB = b.stats?.niveau?.value || 0
        break
      case 'number':
      default:
        valueA = a.id
        valueB = b.id
    }

    let result = 0
    if (valueA < valueB) result = -1
    if (valueA > valueB) result = 1

    return isDescending.value ? -result : result
  })

  // S'assurer que chaque carte a une propriété imageUrl
  filtered = filtered.map((card) => {
    // Créer une copie de la carte pour éviter de modifier l'original
    const cardCopy = { ...card }

    // Si la carte n'a pas d'imageUrl, en créer une basée sur l'ID
    if (!cardCopy.imageUrl) {
      // Pour les héros, utiliser le format recto
      if (cardCopy.mainType === 'Héros') {
        cardCopy.imageUrl = `/images/cards/${cardCopy.id}_recto.png`
      } else {
        cardCopy.imageUrl = `/images/cards/${cardCopy.id}.png`
      }
    }

    return cardCopy
  })

  // Ajouter la disponibilité totale (normale + foil) pour chaque carte
  return filtered.map((card) => {
    const normalQuantity = cardStore.getCardQuantity(card.id) || 0
    const foilQuantity = cardStore.getFoilCardQuantity(card.id) || 0
    const totalQuantity = normalQuantity + foilQuantity

    // Récupérer la quantité de cette carte déjà dans le deck actuel
    const deckQuantity =
      currentDeck.value?.cards.find((c) => c.card.id === card.id)?.quantity || 0

    // Calculer combien on peut encore ajouter au deck
    const availableForDeck = Math.min(totalQuantity, 3 - deckQuantity)

    return {
      card,
      quantity: normalQuantity,
      foilQuantity: foilQuantity,
      totalQuantity: totalQuantity,
      inDeck: deckQuantity,
      availableForDeck: availableForDeck,
    }
  })
})

// Tri des cartes dans le deck
const sortedDeckCards = computed(() => {
  if (!currentDeck.value) return []

  // Copier le tableau pour éviter de modifier l'original
  const cards = [...currentDeck.value.cards].map((deckCard) => {
    // Assurer que chaque carte a une imageUrl
    if (!deckCard.card.imageUrl) {
      // Créer une copie pour éviter de modifier l'original
      const cardCopy = { ...deckCard }
      cardCopy.card = { ...deckCard.card }

      // Attribuer une imageUrl basée sur l'ID et le type
      if (cardCopy.card.mainType === 'Héros') {
        cardCopy.card.imageUrl = `/images/cards/${cardCopy.card.id}_recto.png`
      } else {
        cardCopy.card.imageUrl = `/images/cards/${cardCopy.card.id}.png`
      }

      return cardCopy
    }
    return deckCard
  })

  // Trier les cartes selon l'ordre sélectionné
  cards.sort((a, b) => {
    if (sortOrder.value === 'cost') {
      // Trier par coût (PA)
      const costA = a.card.stats?.pa || 0
      const costB = b.card.stats?.pa || 0
      if (costA !== costB) return costA - costB

      // Si même coût, trier par nom
      return a.card.name.localeCompare(b.card.name)
    } else if (sortOrder.value === 'type') {
      // Trier par type
      const typeA = a.card.mainType
      const typeB = b.card.mainType
      const typeDiff = typeA.localeCompare(typeB)
      if (typeDiff !== 0) return typeDiff

      // Si même type, trier par coût puis par nom
      const costA = a.card.stats?.pa || 0
      const costB = b.card.stats?.pa || 0
      if (costA !== costB) return costA - costB

      return a.card.name.localeCompare(b.card.name)
    } else {
      // Par défaut : trier par nom
      return a.card.name.localeCompare(b.card.name)
    }
  })

  return cards
})

// Maximum de cartes pour un même coût (pour la courbe)
const maxCostCount = computed(() => {
  if (!costCurve.value || costCurve.value.length === 0) return 1
  return Math.max(...costCurve.value.map((item: CostCurveItem) => item.count))
})

// Initialisation - charger le deck spécifié dans la route
onMounted(() => {
  // S'assurer que les decks sont initialisés
  deckStore.initialize()

  if (isEditingDeck.value) {
    // Mode édition: charger le deck spécifié
    setTimeout(() => {
      deckStore.setCurrentDeck(deckId.value)
    }, 100)
  } else {
    // Mode création: créer automatiquement un nouveau deck et stabiliser l'URL
    const newId = deckStore.createDeck('Nouveau deck')
    // Remplacer l'URL pour éviter les créations multiples en cas de refresh
    router.replace(`/deck-builder/${newId}`)
  }
})

// Méthodes pour gérer les cartes dans le deck
function selectCard(card: Card) {
  console.log('Carte sélectionnée:', card)
  
  // Réinitialiser les états d'erreur et du modal
  imageHasError.value = false
  imageFallbackMode.value = null
  showVerso.value = false
  
  selectedCard.value = card
  showCardDetail.value = true

  // S'assurer que le modal est ouvert
  setTimeout(() => {
    const modal = document.getElementById(
      'card_detail_modal'
    ) as HTMLDialogElement
    if (modal && !modal.open) {
      console.log('Ouverture forcée du modal')
      modal.showModal()
    }
  }, 100)
}

function addCard(card: Card) {
  if (!currentDeck.value) {
    createNewDeck()
  }

  // Gérer les cartes spéciales
  if (card.mainType === 'Héros') {
    // Si un héros existe déjà, demander confirmation de remplacement
    if (currentDeck.value?.hero) {
      // On pourrait ajouter une confirmation ici, mais pour simplifier on remplace directement
      toast.warning(
        `Le héros "${currentDeck.value.hero.name}" a été remplacé`,
        { duration: 2000 }
      )
    }

    deckStore.setHero(card)
    toast.success(`Héros "${card.name}" ajouté au deck`, { duration: 2000 })
    
    // Réinitialiser le filtre pour afficher toutes les cartes
    selectedMainType.value = ''
  } else if (card.mainType === 'Havre-sac') {
    // Si un havre-sac existe déjà, demander confirmation de remplacement
    if (currentDeck.value?.havreSac) {
      // On pourrait ajouter une confirmation ici, mais pour simplifier on remplace directement
      toast.warning(
        `Le havre-sac "${currentDeck.value.havreSac.name}" a été remplacé`,
        { duration: 2000 }
      )
    }

    deckStore.setHavreSac(card)
    toast.success(`Havre-sac "${card.name}" ajouté au deck`, { duration: 2000 })
    
    // Réinitialiser le filtre pour afficher toutes les cartes
    selectedMainType.value = ''
  } else {
    // Vérifier si le deck a déjà atteint 48 cartes
    if (cardCount.value >= 48) {
      toast.warning('Le deck a atteint la limite de 48 cartes', {
        title: "Impossible d'ajouter la carte",
        duration: 3000,
      })
      return
    }

    // Vérifier si l'ajout de cette carte dépasse la limite de 3 exemplaires
    const existingCard = currentDeck.value?.cards.find(
      (c) => c.card.id === card.id
    )
    if (existingCard && existingCard.quantity >= 3) {
      toast.warning(
        `Vous ne pouvez pas ajouter plus de 3 exemplaires de "${card.name}"`,
        { duration: 3000 }
      )
      return
    }

    // Vérifier si on a suffisamment d'exemplaires dans la collection (normale + foil)
    const normalQuantity = cardStore.getCardQuantity(card.id) || 0
    const foilQuantity = cardStore.getFoilCardQuantity(card.id) || 0
    const totalQuantity = normalQuantity + foilQuantity
    const inDeckQuantity = existingCard?.quantity || 0

    // Ajouter la carte au deck même si on ne la possède pas
    deckStore.addCard(card, 1)

    // Notification différente selon si on possède la carte ou non
    if (totalQuantity === 0) {
      toast.warning(
        `⚠️ Carte "${card.name}" ajoutée au deck mais non possédée dans votre collection`,
        { 
          title: 'Carte manquante',
          duration: 4000 
        }
      )
    } else if (totalQuantity < inDeckQuantity + 1) {
      toast.warning(
        `⚠️ Vous n'avez que ${totalQuantity} exemplaire(s) de "${card.name}" mais en ajoutez ${inDeckQuantity + 1} au deck`,
        { 
          title: 'Exemplaires insuffisants',
          duration: 4000 
        }
      )
    } else {
      // Notification normale pour les cartes possédées
    if (!existingCard || existingCard.quantity === 1) {
      toast.success(`Carte "${card.name}" ajoutée au deck`, { duration: 1500 })
      }
    }

    // Si le deck atteint exactement 48 cartes, afficher une notification
    if (cardCount.value === 48) {
      toast.success('Deck complété avec 48 cartes !', {
        title: 'Deck prêt',
        duration: 4000,
      })
    }
  }
}

function removeCard(cardId: string) {
  deckStore.removeCard(cardId, 1) // Supprimer une seule copie à la fois
}

  // Ajouts rapides de quantités
  function addCardQuantity(card: Card, amount: number) {
    for (let i = 0; i < amount; i += 1) {
      addCard(card)
    }
  }

  function removeCardQuantity(cardId: string, amount: number) {
    deckStore.removeCard(cardId, amount)
  }

  function removeCardAll(cardId: string) {
    // Retire toutes les occurrences de cette carte
    const dc = currentDeck.value?.cards.find(c => c.card.id === cardId)
    if (dc) {
      deckStore.removeCard(cardId, dc.quantity)
    }
}

function removeHero() {
  deckStore.removeHero()
}

function removeHavreSac() {
  deckStore.removeHavreSac()
}

// Méthodes pour gérer les decks
function createNewDeck() {
  const deckName = 'Nouveau deck'
  const deckId = deckStore.createDeck(deckName)

  if (deckId) {
    toast.success('Nouveau deck créé', {
      duration: 2000,
    })
  }
}

function saveDeck() {
  if (!currentDeck.value) {
    toast.error('Aucun deck à sauvegarder', { duration: 3000 })
    return
  }

  // Sauvegarder le deck
  deckStore.saveDecks()
  
  toast.success('Deck sauvegardé avec succès', {
    title: 'Sauvegarde',
    duration: 2000,
  })
}

function openDeckSelector() {
  const modal = document.getElementById(
    'deck_selector_modal'
  ) as HTMLDialogElement
  modal.showModal()
}

function loadDeck(deckId: string) {
  deckStore.setCurrentDeck(deckId)
  const modal = document.getElementById(
    'deck_selector_modal'
  ) as HTMLDialogElement
  modal.close()
}

function renameDeckModal() {
  if (!currentDeck.value) return

  newDeckName.value = currentDeck.value.name
  const modal = document.getElementById(
    'rename_deck_modal'
  ) as HTMLDialogElement
  modal.showModal()
}

function confirmRenameDeck() {
  if (!currentDeck.value || !newDeckName.value.trim()) return

  const oldName = currentDeck.value.name
  deckStore.renameDeck(currentDeck.value.id, newDeckName.value.trim())

  toast.success(`Deck renommé de "${oldName}" à "${newDeckName.value}"`, {
    duration: 3000,
  })

  const modal = document.getElementById(
    'rename_deck_modal'
  ) as HTMLDialogElement
  modal.close()
}

function exportDeck() {
  if (!currentDeck.value) {
    toast.error('Aucun deck à exporter', { duration: 3000 })
    return
  }

  // Vérifier que le deck est valide (1 héros, 1 havre-sac, 48 cartes)
  if (!isValid.value) {
    toast.warning(
      "Votre deck n'est pas valide pour l'exportation : il doit contenir exactement 1 héros, 1 havre-sac et 48 cartes",
      {
        title: 'Deck incomplet',
        duration: 5000,
      }
    )
    return
  }

  exportedDeckText.value = deckStore.exportDeck(currentDeck.value.id)
  const modal = document.getElementById(
    'export_deck_modal'
  ) as HTMLDialogElement
  modal.showModal()
}

async function copyExportToClipboard() {
  try {
    await navigator.clipboard.writeText(exportedDeckText.value)
    toast.success('Deck copié dans le presse-papier', {
      title: 'Succès',
      duration: 3000,
    })
  } catch (err) {
    console.error('Erreur lors de la copie:', err)
    toast.error('Impossible de copier le deck', {
      title: 'Erreur',
      duration: 5000,
    })
  }
}



function confirmDeleteDeck() {
  if (!currentDeck.value) return

  const modal = document.getElementById(
    'confirm_delete_modal'
  ) as HTMLDialogElement
  modal.showModal()
}

function confirmDeleteDeckAction() {
  if (!currentDeck.value) return

  const deckName = currentDeck.value.name
  const deckId = currentDeck.value.id
  deckStore.deleteDeck(deckId)

  toast.info(`Deck "${deckName}" supprimé`, {
    duration: 3000,
  })

  const modal = document.getElementById(
    'confirm_delete_modal'
  ) as HTMLDialogElement
  modal.close()
}

// Méthodes utilitaires
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getRarityValue(rarity: string): number {
  const rarityValues: Record<string, number> = {
    Commune: 0,
    'Peu Commune': 1,
    Rare: 2,
    Mythique: 3,
    Légendaire: 4,
  }

  return rarityValues[rarity] || 0
}

function getDeckClassElement(deck: any): string {
  if (!deck.hero) return 'Pas de héros'

  let result = ''

  // Classe du héros (peut être dans subTypes)
  if (deck.hero.subTypes && deck.hero.subTypes.length > 0) {
    result = deck.hero.subTypes[0] // Première sous-classe
  }

  // Élément du héros (peut être dans stats.niveau.element)
  const element =
    deck.hero.stats?.niveau?.element || deck.hero.stats?.force?.element
  if (element) {
    result += result ? ` (${element})` : element
  }

  return result || 'Héros'
}

function countDeckCards(deck: any): number {
  let count = 0
  if (deck.hero) count += 1
  if (deck.havreSac) count += 1

  count += deck.cards.reduce((acc: number, card: any) => acc + card.quantity, 0)

  return count
}

function sortCards() {
  // Cycle through sorting options
  if (sortOrder.value === 'type') sortOrder.value = 'cost'
  else if (sortOrder.value === 'cost') sortOrder.value = 'name'
  else sortOrder.value = 'type'
}

// Computed properties pour le modal de détail complet
const isSelectedCardHero = computed(() => selectedCard.value?.mainType === 'Héros')

const getSelectedCardImage = computed(() => {
  if (!selectedCard.value) return '/images/card-back.png'
  
  if (selectedCard.value.imageUrl) {
    return selectedCard.value.imageUrl
  }
  
  if (isSelectedCardHero.value) {
    return `/images/cards/${selectedCard.value.id}_${showVerso.value ? 'verso' : 'recto'}.png`
  }
  
  return `/images/cards/${selectedCard.value.id}.png`
})

const displayedStats = computed(() => {
  if (!selectedCard.value) return null
  if (isSelectedCardHero.value) {
    const heroCard = selectedCard.value as HeroCard
    return showVerso.value ? heroCard.verso?.stats : heroCard.recto.stats
  }
  return selectedCard.value.stats
})

const displayedEffects = computed(() => {
  if (!selectedCard.value) return []
  if (isSelectedCardHero.value) {
    const heroCard = selectedCard.value as HeroCard
    return showVerso.value ? heroCard.verso?.effects || [] : heroCard.recto.effects || []
  }
  return selectedCard.value.effects || []
})

const displayedKeywords = computed(() => {
  if (!selectedCard.value) return []
  if (isSelectedCardHero.value) {
    const heroCard = selectedCard.value as HeroCard
    return showVerso.value ? heroCard.verso?.keywords || [] : heroCard.recto.keywords || []
  }
  return selectedCard.value.keywords || []
})

// Fonctions pour le modal de détail complet
function isHeroCard(card: Card): card is HeroCard {
  return card.mainType === 'Héros'
}

function stringToElement(elementStr: string) {
  // Dans constants.ts, ELEMENTS est un tableau, pas un objet
  // On retourne directement la string puisque ElementIcon attend une string
  return elementStr || 'Neutre'
}

function getElementClass(element: string): string {
  switch (element.toLowerCase()) {
    case 'feu':
      return 'text-error'
    case 'eau':
      return 'text-primary'
    case 'air':
      return 'text-info'
    case 'terre':
      return 'text-success'
    default:
      return 'text-base-content'
  }
}

function handleImageError() {
  console.warn(`🖼️ Erreur de chargement d'image pour la carte ${selectedCard.value?.name}`)
  
  if (isSelectedCardHero.value && !imageFallbackMode.value) {
    // Pour les héros, essayer l'autre face
    imageFallbackMode.value = showVerso.value ? 'verso' : 'recto'
    showVerso.value = !showVerso.value
    imageHasError.value = false
  } else {
    // Erreur définitive
    imageHasError.value = true
  }
}

function setSelectedMainType(type: string) {
  console.log('🎯 AVANT - selectedMainType.value:', selectedMainType.value)
  selectedMainType.value = type
  console.log('🎯 APRÈS - selectedMainType.value:', selectedMainType.value)
  console.log('🔍 Type recherché:', type)
  console.log('📊 Total cartes:', cards.value.length)
  
  const matchingCards = cards.value.filter(card => card.mainType === type)
  console.log('✅ Cartes avec ce type:', matchingCards.length)
  
  // Debug: afficher quelques exemples
  if (matchingCards.length > 0) {
    console.log('📋 Exemples de cartes:', matchingCards.slice(0, 3).map(c => c.name))
  } else {
    console.log('❌ AUCUNE carte trouvée avec ce type!')
  }
  
  // Vérifier tous les mainTypes disponibles
  const allMainTypes = [...new Set(cards.value.map(card => card.mainType))].sort()
  console.log('🗂️ Tous les mainTypes disponibles:', allMainTypes)
  
  // Vérifier si notre type existe exactement
  console.log('🔎 Le type existe-t-il?', allMainTypes.includes(type))
  
  // Chercher des types similaires
  const similarTypes = allMainTypes.filter(t => t.toLowerCase().includes('havre') || t.toLowerCase().includes('sac'))
  console.log('🔍 Types contenant "havre" ou "sac":', similarTypes)
}

// Fonction pour réinitialiser tous les filtres
function resetAllFilters() {
  searchQuery.value = ''
  selectedExtension.value = ''
  selectedMainType.value = ''
  selectedSubType.value = ''
  selectedRarity.value = ''
  selectedElement.value = ''
  minLevel.value = 0
  maxLevel.value = 100
  minCost.value = null
  maxCost.value = null
  hideNotOwned.value = false
}

// Fonction pour obtenir l'icône d'un élément
function getElementIcon(element: string): string {
  switch (element.toLowerCase()) {
    case 'feu':
      return 'fa-fire text-red-500'
    case 'eau':
      return 'fa-water text-blue-500'
    case 'terre':
      return 'fa-mountain text-amber-700'
    case 'air':
      return 'fa-wind text-cyan-500'
    case 'neutre':
      return 'fa-circle text-gray-500'
    default:
      return 'fa-question'
  }
}

// Fonction pour obtenir la classe CSS selon la rareté
function getRarityClass(rarity: string): string {
  switch (rarity) {
    case 'Commune':
      return 'text-gray-200'
    case 'Peu commune':
      return 'text-green-400'
    case 'Rare':
      return 'text-blue-400'
    case 'Mythique':
      return 'text-purple-400'
    case 'Légendaire':
      return 'text-orange-400'
    case 'Krosmonote':
      return 'text-yellow-400'
    default:
      return ''
  }
}

// Nouvelles fonctions d'ouverture des sélecteurs
function openHeroSelector() {
  // Filtrer pour n'afficher que les héros
  selectedMainType.value = 'Héros'

  // Afficher un modal de sélection ou guider l'utilisateur
  toast.info('Sélectionnez un héros dans la collection', {
    title: 'Choisir un héros',
    duration: 3000,
  })

  // Faire défiler vers la collection (sur mobile)
  if (window.innerWidth < 768) {
    const collectionEl = document.querySelector('.collection-container')
    if (collectionEl) {
      collectionEl.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

function openHavreSacSelector() {
  // Filtrer pour n'afficher que les havre-sacs
  selectedMainType.value = 'Havre-sac'

  // Afficher un modal de sélection ou guider l'utilisateur
  toast.info('Sélectionnez un havre-sac dans la collection', {
    title: 'Choisir un havre-sac',
    duration: 3000,
  })

  // Faire défiler vers la collection (sur mobile)
  if (window.innerWidth < 768) {
    const collectionEl = document.querySelector('.collection-container')
    if (collectionEl) {
      collectionEl.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

function onHeroImageError(event: Event) {
  // Remplacer par une image par défaut en cas d'erreur
  const target = event.target as HTMLImageElement
  if (target && currentDeck.value?.hero) {
    target.src = `/images/cards/default_hero.png`
  }
}

function onHavreSacImageError(event: Event) {
  // Remplacer par une image par défaut en cas d'erreur
  const target = event.target as HTMLImageElement
  if (target && currentDeck.value?.havreSac) {
    target.src = `/images/cards/default_havresac.png`
  }
}

watch(
  currentDeck,
  (newDeck) => {
    console.log('Deck actuel mis à jour:', newDeck)
    if (newDeck?.hero) {
      console.log('Héros du deck:', newDeck.hero)
      console.log('imageUrl du héros:', newDeck.hero.imageUrl)
    }
    if (newDeck?.havreSac) {
      console.log('Havre-sac du deck:', newDeck.havreSac)
      console.log('imageUrl du havre-sac:', newDeck.havreSac.imageUrl)
    }
  },
  { deep: true, immediate: true }
)

// New computed property for formatted element distribution
const formattedElementDistribution = computed(() => {
  // Si pas de distribution d'éléments, retourner un tableau vide
  if (!currentDeck.value) return []

  const elements = ['Feu', 'Eau', 'Terre', 'Air', 'Neutre']
  const result = []

  // Parcourir tous les éléments possibles
  for (const element of elements) {
    // Chercher les cartes ayant cet élément
    const count = currentDeck.value.cards.reduce((total, deckCard) => {
      const cardElement =
        deckCard.card.stats?.niveau?.element ||
        deckCard.card.stats?.force?.element ||
        'Neutre'
      if (cardElement === element) {
        return total + deckCard.quantity
      }
      return total
    }, 0)

    // N'ajouter que les éléments avec des cartes
    if (count > 0) {
      result.push({ element, count })
    }
  }

  return result
})

// Cartes du deck (propriété calculée)
const deckCards = computed(() => {
  return currentDeck.value?.cards || []
})

// Si le store a une erreur de chargement, afficher un message
watch(
  () => deckStore.loadingError,
  (error) => {
    if (error) {
      console.error('Erreur de chargement des decks:', error)
      toast.error('Erreur de chargement des decks', {
        title: 'Erreur',
        duration: 5000,
      })
    }
  }
)

// Formate le temps écoulé depuis la dernière mise à jour
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "À l'instant"
  if (diffInSeconds < 3600)
    return `Il y a ${Math.floor(diffInSeconds / 60)} minutes`
  if (diffInSeconds < 86400)
    return `Il y a ${Math.floor(diffInSeconds / 3600)} heures`

  return formatDate(dateString)
}

// Ajout d'une fonction pour remplacer renameDeck qui manque
function renameDeck() {
  renameDeckModal()
}

// Ajout d'une fonction pour remplacer deleteDeck qui manque
function deleteDeck() {
  confirmDeleteDeck()
}

// New function to create a new deck and close the modal
function createNewDeckAndCloseModal() {
  createNewDeck()
  const modal = document.getElementById(
    'deck_selector_modal'
  ) as HTMLDialogElement
  modal.close()
}

// New function to confirm delete a specific deck
function confirmDeleteSpecificDeck(deckId: string, deckName: string) {
  if (currentDeck.value?.id === deckId) {
    // Si c'est le deck actuel, utiliser la confirmation standard
    confirmDeleteDeck()
  } else {
    // Confirmation rapide avec toast
    if (confirm(`Êtes-vous sûr de vouloir supprimer le deck "${deckName}" ?`)) {
      deckStore.deleteDeck(deckId)
      toast.info(`Deck "${deckName}" supprimé`, { duration: 3000 })
    }
  }
}

// New function to check if a deck is valid
function checkDeckValidity(deck: any): boolean {
  // Un deck est valide s'il a un héros, un havre-sac et exactement 48 cartes
  const hasHero = !!deck.hero
  const hasHavreSac = !!deck.havreSac
  const cardsCount = deck.cards.reduce(
    (acc: number, card: any) => acc + card.quantity,
    0
  )

  return hasHero && hasHavreSac && cardsCount === 48
}

// Ajout d'une fonction de gestion pour update-quantity
function handleQuantityUpdate(
  cardId: string,
  quantity: number,
  isFoil: boolean
) {
  console.log(
    `Mise à jour de la quantité: ${cardId}, ${quantity}, isFoil: ${isFoil}`
  )
  // Si la méthode existe dans le store, l'utiliser
  if ('updateCardQuantity' in cardStore) {
    ;(cardStore as any).updateCardQuantity(cardId, quantity, isFoil)
  } else {
    console.warn("La méthode updateCardQuantity n'existe pas dans le cardStore")
  }
}

// Fonction qui ferme le modal de détail de carte
function closeCardDetail() {
  showCardDetail.value = false
  
  // Réinitialiser les états après une courte animation
  setTimeout(() => {
  selectedCard.value = null
    showVerso.value = false
    imageHasError.value = false
    imageFallbackMode.value = null
  }, 300)
}



// Fonction pour obtenir la quantité totale (normale + foil) d'une carte
function getTotalQuantity(cardId: string): number {
  const normalQuantity = cardStore.getCardQuantity(cardId) || 0
  const foilQuantity = cardStore.getFoilCardQuantity(cardId) || 0
  return normalQuantity + foilQuantity
}
</script>

<style scoped>
.deck-builder-view {
  display: flex;
  flex-direction: column;
}

.collection-container {
  height: 100%;
  overflow-y: auto;
}

.deck-column {
  height: 100vh;
  position: sticky;
  top: 0;
}

@media (min-width: 768px) {
  .deck-builder-view {
    flex-direction: row;
  }

  .collection-container {
    border-right: 1px solid var(--border-color);
  }
}
</style>
