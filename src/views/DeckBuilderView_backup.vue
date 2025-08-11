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
            :extensions="extensions"
            :main-types="mainTypes"
            :sub-types="subTypes"
            :rarities="rarities"
            :elements="elements"
          />

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
              v-else-if="selectedMainType === 'Havre-Sac'"
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
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              <div
                v-for="item in filteredCollection"
                :key="item.card.id"
                class="card-item relative bg-base-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                <!-- Image de la carte -->
                <div
                  class="card-image relative aspect-[0.715] overflow-hidden cursor-pointer"
                  @click="selectCard(item.card)"
                >
                  <img
                    :src="item.card.imageUrl"
                    :alt="item.card.name"
                    class="w-full h-full object-cover"
                  />
                </div>

                <!-- Informations de la carte -->
                <div class="card-info p-2">
                  <div class="flex items-center justify-between mb-1">
                    <h3
                      class="text-sm font-semibold truncate"
                      :class="getRarityClass(item.card.rarity)"
                    >
                      {{ item.card.name }}
                    </h3>
                    <span
                      v-if="item.card.stats?.pa"
                      class="badge badge-sm ml-1"
                    >
                      {{ item.card.stats.pa }} PA
                    </span>
                  </div>

                  <!-- Type de carte et niveau -->
                  <div class="flex text-xs justify-between items-center">
                    <span class="opacity-70 truncate">{{
                      item.card.mainType
                    }}</span>
                    <span
                      v-if="item.card.stats?.niveau?.value"
                      class="badge badge-xs badge-info"
                    >
                      Niv.{{ item.card.stats.niveau.value }}
                    </span>
                  </div>

                  <!-- Quantité et bouton d'ajout au deck -->
                  <div class="flex flex-col gap-1 mt-2">
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col">
                        <div class="text-xs font-semibold">Possédés:</div>
                        <div class="flex items-center gap-1 text-xs">
                          <span
                            ><i class="fas fa-image text-primary/60 mr-1"></i
                            >{{ item.quantity }}</span
                          >
                          <span
                            ><i class="fas fa-sparkles text-accent/60 mr-1"></i
                            >{{ item.foilQuantity }}</span
                          >
                        </div>
                      </div>

                      <!-- Bouton d'ajout au deck -->
                      <div>
                        <button
                          v-if="
                            item.card.mainType === 'Héros' ||
                            item.card.mainType === 'Havre-Sac'
                          "
                          @click="addCard(item.card)"
                          class="btn btn-xs btn-primary"
                          :disabled="
                            !!(
                              item.card.mainType === 'Héros' &&
                              currentDeck?.hero
                            ) ||
                            !!(
                              item.card.mainType === 'Havre-Sac' &&
                              currentDeck?.havreSac
                            ) ||
                            item.totalQuantity === 0
                          "
                        >
                          <i class="fas fa-plus mr-1"></i> Ajouter
                        </button>
                        <div v-else class="flex items-center">
                          <span class="text-xs opacity-70 mr-1">En deck:</span>
                          <span class="badge badge-sm mr-1"
                            >{{ item.inDeck }}/3</span
                          >
                          <button
                            @click="addCard(item.card)"
                            class="btn btn-xs btn-primary"
                            :disabled="
                              item.inDeck >= 3 ||
                              item.inDeck >= item.totalQuantity ||
                              cardCount >= 48
                            "
                          >
                            <i class="fas fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="item.inDeck > 0"
                      class="w-full bg-base-300 rounded-full h-1.5"
                    >
                      <div
                        class="bg-primary h-1.5 rounded-full"
                        :style="{ width: `${(item.inDeck / 3) * 100}%` }"
                      ></div>
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
                    <a @click="exportDeck"
                      ><i class="fas fa-download mr-2"></i> Exporter</a
                    >
                  </li>
                  <li>
                    <a @click="importDeckModal"
                      ><i class="fas fa-upload mr-2"></i> Importer</a
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

          <!-- Courbe de coût -->
          <div
            class="cost-curve border border-base-300 rounded-lg p-3 bg-base-100"
          >
            <h3 class="text-lg font-bold mb-2">Courbe de coût</h3>
            <div class="cost-bars flex items-end h-24 gap-1">
              <template v-for="cost in costCurve" :key="cost.cost">
                <div
                  class="cost-bar-container flex flex-col items-center flex-1"
                >
                  <div
                    class="cost-bar w-full bg-primary"
                    :style="{ height: `${(cost.count / maxCostCount) * 100}%` }"
                  ></div>
                  <div
                    class="cost-label mt-1 text-center text-xs font-semibold"
                  >
                    {{ cost.cost }}
                    <span class="text-xs opacity-70">({{ cost.count }})</span>
                  </div>
                </div>
              </template>
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
                class="flex flex-col items-center justify-center h-36 border border-dashed border-base-300 rounded-lg"
              >
                <div class="text-center">
                  <i
                    class="fas fa-chess-king text-2xl mb-2 text-primary/50"
                  ></i>
                  <p>Emplacement du héros</p>
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
                class="flex flex-col items-center justify-center h-36 border border-dashed border-base-300 rounded-lg"
              >
                <div class="text-center">
                  <i class="fas fa-suitcase text-2xl mb-2 text-primary/50"></i>
                  <p>Emplacement du havre-sac</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Répartition des éléments -->
          <div
            class="elements-stats border border-base-300 rounded-lg p-3 bg-base-100"
          >
            <h3 class="text-lg font-bold mb-2">Éléments</h3>
            <div class="elements-bars flex items-center gap-2">
              <template
                v-for="elem in formattedElementDistribution"
                :key="elem.element"
              >
                <div class="element-item flex flex-col items-center">
                  <div
                    class="element-icon w-6 h-6 rounded-full flex items-center justify-center"
                    :class="`bg-element-${elem.element.toLowerCase()}`"
                  >
                    <i class="fas" :class="getElementIcon(elem.element)"></i>
                  </div>
                  <span class="text-xs font-semibold mt-1">{{
                    elem.count
                  }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Cartes du deck -->
          <div
            class="deck-cards flex-grow border border-base-300 rounded-lg p-3 bg-base-100 overflow-y-auto"
          >
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-lg font-bold">Cartes ({{ cardCount }}/48)</h3>
              <div class="flex items-center gap-2">
                <div
                  class="badge"
                  :class="isValid ? 'badge-success' : 'badge-warning'"
                >
                  {{ isValid ? 'Deck valide' : 'Deck incomplet' }}
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
                            setSelectedMainType('Havre-Sac')
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
              <div class="flex-none gap-2">
                <button
                  v-if="!currentDeck?.hero"
                  @click="
                    () => {
                      setSelectedMainType('Héros')
                    }
                  "
                  class="btn btn-sm btn-primary"
                >
                  <i class="fas fa-chess-king mr-1"></i> Choisir un héros
                </button>
                <button
                  v-if="!currentDeck?.havreSac"
                  @click="
                    () => {
                      setSelectedMainType('Havre-Sac')
                    }
                  "
                  class="btn btn-sm btn-primary"
                >
                  <i class="fas fa-suitcase mr-1"></i> Choisir un havre-sac
                </button>
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
                <div class="card-quantity flex flex-col items-end gap-1">
                  <div class="flex items-center gap-1">
                    <button
                      @click="removeCard(deckCard.card.id)"
                      class="btn btn-xs btn-ghost text-error"
                    >
                      <i class="fas fa-minus"></i>
                    </button>
                    <span class="text-sm font-semibold">{{
                      deckCard.quantity
                    }}</span>
                    <button
                      @click="addCard(deckCard.card)"
                      class="btn btn-xs btn-ghost text-success"
                      :disabled="
                        deckCard.quantity >= 3 ||
                        deckCard.quantity >=
                          getTotalQuantity(deckCard.card.id) ||
                        cardCount >= 48
                      "
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
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Exporter le deck</h3>
        <div class="form-control">
          <textarea
            v-model="exportedDeckText"
            class="textarea textarea-bordered h-64 font-mono text-sm"
            readonly
          ></textarea>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="copyExportToClipboard">
            Copier
          </button>
          <form method="dialog">
            <button class="btn">Fermer</button>
          </form>
        </div>
      </div>
    </dialog>

    <!-- Modal pour l'import du deck -->
    <dialog id="import_deck_modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Importer un deck</h3>
        <div class="form-control">
          <textarea
            v-model="importDeckText"
            class="textarea textarea-bordered h-64 font-mono text-sm"
            placeholder="Collez ici votre liste de deck..."
          ></textarea>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="confirmImportDeck">
            Importer
          </button>
          <form method="dialog">
            <button class="btn">Annuler</button>
          </form>
        </div>
      </div>
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
    <dialog id="card_detail_modal" ref="cardDetailModal" class="modal">
      <div class="modal-box max-w-screen-md">
        <h3 class="font-bold text-lg mb-4">Détail de la carte</h3>
        <CardDetail
          v-if="selectedCard"
          :card="selectedCard"
          :enable-add-to-deck="true"
          @add-to-deck="addCard"
        />
        <div class="modal-action">
          <button
            class="btn btn-primary"
            @click="addSelectedCard"
            v-if="selectedCard"
          >
            Ajouter au deck
          </button>
          <form method="dialog">
            <button class="btn" @click="closeCardDetail">Fermer</button>
          </form>
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
import type { Card } from '@/types/cards'

// Interface pour les données de la courbe de coût
interface CostCurveItem {
  cost: number
  count: number
}

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

// États pour les modals
const newDeckName = ref('')
const selectedCard = ref<Card | null>(null)
const exportedDeckText = ref('')
const importDeckText = ref('')
const sortOrder = ref<'cost' | 'type' | 'name'>('type')
const showCardDetail = ref(false)
const cardDetailModal = ref<HTMLDialogElement | null>(null)
const showImportModal = ref(false)

// Surveiller les changements de showCardDetail pour ouvrir/fermer le modal
watch(showCardDetail, (newValue) => {
  if (newValue && cardDetailModal.value) {
    cardDetailModal.value.showModal()
  } else if (cardDetailModal.value) {
    cardDetailModal.value.close()
  }
})

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

  // Si on est en mode édition, charge le deck spécifié
  if (isEditingDeck.value) {
    setTimeout(() => {
      deckStore.setCurrentDeck(deckId.value)
    }, 100) // Petit délai pour s'assurer que les decks sont chargés
  }
})

// Méthodes pour gérer les cartes dans le deck
function selectCard(card: Card) {
  console.log('Carte sélectionnée:', card)
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
  } else if (card.mainType === 'Havre-Sac') {
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

    if (totalQuantity < inDeckQuantity + 1) {
      toast.warning(
        `Vous n'avez pas assez d'exemplaires de "${card.name}" dans votre collection`,
        { duration: 3000 }
      )
      return
    }

    deckStore.addCard(card, 1)

    // Notification pour les autres types de cartes uniquement si c'est une nouvelle carte
    if (!existingCard || existingCard.quantity === 1) {
      toast.success(`Carte "${card.name}" ajoutée au deck`, { duration: 1500 })
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

function importDeckModal() {
  importDeckText.value = ''
  const modal = document.getElementById(
    'import_deck_modal'
  ) as HTMLDialogElement
  modal.showModal()
}

function confirmImportDeck() {
  if (!importDeckText.value.trim()) return

  const deckId = deckStore.importDeck(importDeckText.value)
  if (deckId) {
    deckStore.setCurrentDeck(deckId)
    toast.success('Deck importé avec succès', {
      title: 'Importation réussie',
      duration: 3000,
    })
  } else {
    toast.error("Impossible d'importer le deck", {
      title: "Erreur d'importation",
      duration: 5000,
    })
  }

  const modal = document.getElementById(
    'import_deck_modal'
  ) as HTMLDialogElement
  modal.close()
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

function setSelectedMainType(type: string) {
  selectedMainType.value = type
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
  selectedMainType.value = 'Havre-Sac'

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
  selectedCard.value = null
}

// Fonction qui ajoute la carte sélectionnée au deck puis ferme le modal
function addSelectedCard() {
  if (selectedCard.value) {
    addCard(selectedCard.value)
    closeCardDetail()
  }
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
