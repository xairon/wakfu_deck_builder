<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <router-link
          to="/decks"
          class="eyebrow inline-flex items-center gap-1.5 text-base-content/55 transition-colors hover:text-base-content"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 18l-6-6 6-6"
            />
          </svg>
          Mes decks
        </router-link>
        <h1 class="mt-2 font-display text-3xl leading-none sm:text-4xl">
          Atelier de deck
        </h1>
      </div>

      <!-- Sélecteur de deck -->
      <select
        v-if="decks.length > 1"
        class="select select-bordered select-sm max-w-[14rem]"
        :value="currentDeck?.id"
        @change="switchDeck(($event.target as HTMLSelectElement).value)"
        aria-label="Changer de deck"
      >
        <option v-for="d in decks" :key="d.id" :value="d.id">
          {{ d.name }}
        </option>
      </select>
    </header>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <!-- ─────────── Vivier de cartes ─────────── -->
      <section class="min-w-0">
        <CollectionFilters
          :extensions="filterExtensions"
          :main-types="filterMainTypes"
          :sub-types="filterSubTypes"
          :rarities="filterRarities"
          :elements="filterElements"
          :search-query="filterQuery"
          :selected-extension="filterExtension"
          :hide-not-owned="filterHideNotOwned"
          :selected-sort-field="filterSortField"
          :is-descending="filterSortDesc"
          :selected-main-type="filterMainType"
          :selected-sub-type="filterSubType"
          :selected-rarity="filterRarity"
          :selected-element="filterElement"
          :min-level="filterMinLevel"
          :max-level="filterMaxLevel"
          :min-cost="filterMinCost"
          :max-cost="filterMaxCost"
          :min-force="filterMinForce"
          :max-force="filterMaxForce"
          :effect-query="filterEffectQuery"
          @update:search-query="filterQuery = $event"
          @update:selected-extension="filterExtension = $event"
          @update:hide-not-owned="filterHideNotOwned = $event"
          @update:selected-sort-field="filterSortField = $event"
          @update:is-descending="filterSortDesc = $event"
          @update:selected-main-type="filterMainType = $event"
          @update:selected-sub-type="filterSubType = $event"
          @update:selected-rarity="filterRarity = $event"
          @update:selected-element="filterElement = $event"
          @update:min-level="filterMinLevel = $event"
          @update:max-level="filterMaxLevel = $event"
          @update:min-cost="filterMinCost = $event"
          @update:max-cost="filterMaxCost = $event"
          @update:min-force="filterMinForce = $event"
          @update:max-force="filterMaxForce = $event"
          @update:effect-query="filterEffectQuery = $event"
          class="mb-4"
        />
        <div class="mb-2 flex items-center justify-between gap-3">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="dimUnowned"
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary"
              data-testid="dim-unowned-toggle"
            />
            <span class="eyebrow">Estomper les non possédées</span>
          </label>
          <span class="font-mono text-xs tabular text-base-content/55"
            >{{ pool.length }} carte{{ pool.length > 1 ? "s" : "" }}</span
          >
        </div>

        <!-- Erreur de chargement du catalogue -->
        <div v-if="loadError" class="py-16 text-center">
          <div class="mx-auto mb-4 h-1 w-16 bg-error"></div>
          <p class="eyebrow mb-2 text-error">Erreur de chargement</p>
          <p class="mb-6 text-sm text-base-content/70">
            Impossible de charger les cartes.
          </p>
          <button class="btn btn-neutral btn-sm" @click="retryLoad">
            Réessayer
          </button>
        </div>

        <!-- Chargement en cours -->
        <div
          v-else-if="cardStore.isInitializing && pool.length === 0"
          class="py-16 text-center text-base-content/60"
        >
          <span class="loading loading-spinner loading-md"></span>
          <p class="mt-3 text-sm">Chargement des cartes…</p>
        </div>

        <!-- Aucune carte (filtre vide) -->
        <div
          v-else-if="pool.length === 0"
          class="py-16 text-center text-sm text-base-content/60"
        >
          Aucune carte ne correspond à votre recherche.
        </div>

        <template v-else>
          <div
            class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
          >
            <!-- Tuile de vivier : clic → zoom ; bouton + → ajout express -->
            <div
              v-for="card in visiblePool"
              :key="card.id"
              class="group relative"
            >
              <!-- Corps de la tuile : ouvre le zoom -->
              <button
                class="relative block w-full text-left"
                :title="`Lire ${card.name}`"
                :aria-label="`Lire ${card.name} — agrandir`"
                data-testid="pool-tile"
                @click="openZoom(card)"
              >
                <div
                  class="plate-frame"
                  :style="{ '--spine': elementColor(card) }"
                >
                  <img
                    :src="cardImg(card)"
                    :alt="card.name"
                    loading="lazy"
                    class="aspect-[7/10] object-cover"
                    :class="{
                      'opacity-40': dimUnowned && ownedQty(card.id) === 0,
                    }"
                    @error="onImgError"
                  />
                  <!-- Quantité dans le deck : étiquette braise carrée -->
                  <span
                    v-if="inDeckQty(card.id) > 0"
                    class="absolute left-[5px] top-[5px] z-10 bg-primary px-1.5 py-0.5 font-mono text-[11px] font-bold tabular text-primary-content"
                    >{{ inDeckQty(card.id) }}</span
                  >
                  <!-- Quantité possédée : mono tabulaire -->
                  <span
                    class="absolute right-[5px] top-[5px] z-10 bg-base-100/90 px-1 py-0.5 font-mono text-[10px] font-bold tabular"
                    :class="
                      ownedQty(card.id) > 0
                        ? 'text-success'
                        : 'text-base-content/40'
                    "
                    >{{ ownedQty(card.id) }}</span
                  >
                  <!-- Bandeau loupe au survol -->
                  <span
                    class="absolute inset-x-[5px] bottom-[5px] z-10 grid place-items-center bg-base-content py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-base-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path stroke-linecap="round" d="m20 20-3.5-3.5" />
                    </svg>
                  </span>
                </div>
              </button>
              <!-- Bouton ajout express -->
              <button
                class="absolute bottom-[5px] right-[5px] z-20 bg-base-content px-1.5 py-0.5 font-mono text-[11px] font-bold text-base-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                :aria-label="`Ajouter ${card.name} au deck`"
                :disabled="!canAddCard(card)"
                :title="
                  canAddCard(card)
                    ? `Ajouter ${card.name}`
                    : addBlockReason(card)
                "
                data-testid="pool-add"
                @click.stop="addToDeck(card)"
              >
                +
              </button>
            </div>
          </div>

          <div v-if="pool.length > visiblePool.length" class="mt-6 text-center">
            <button class="btn btn-outline btn-sm" @click="poolLimit += 60">
              Afficher plus ({{ pool.length - visiblePool.length }} restantes)
            </button>
          </div>
        </template>
      </section>

      <!-- ─────────── Panneau du deck ─────────── -->
      <aside
        class="border border-base-content/15 bg-base-100 xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
      >
        <!-- Nom + validité -->
        <div class="p-4">
          <input
            :value="currentDeck?.name"
            @change="renameCurrent(($event.target as HTMLInputElement).value)"
            class="w-full border-b border-transparent bg-transparent font-display text-2xl leading-tight focus:border-base-content focus:outline-none"
            aria-label="Nom du deck"
            placeholder="Nom du deck"
          />
          <div class="mt-4 flex items-center justify-between gap-3">
            <span
              class="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider"
              :class="
                validation.isValid ? 'text-primary' : 'text-base-content/55'
              "
            >
              <span
                class="h-2 w-2"
                :class="
                  validation.isValid ? 'bg-primary' : 'bg-base-content/40'
                "
              ></span>
              {{ validation.isValid ? "Prêt à jouer" : "En cours" }}
            </span>
            <!-- Compteur : devient le sceau à 48 -->
            <span
              v-if="cardCount === 48"
              class="seal shrink-0"
              aria-label="48 cartes sur 48"
              >48/48</span
            >
            <span
              v-else
              class="font-mono text-2xl font-bold tabular leading-none"
              >{{ cardCount
              }}<span class="text-base-content/35">/48</span></span
            >
          </div>
          <!-- Jauge : filet d'encre carré, remplissage braise→encre -->
          <div class="mt-3 h-px w-full bg-base-content/15">
            <div
              class="h-px transition-all duration-200"
              :class="cardCount === 48 ? 'bg-base-content' : 'bg-primary'"
              :style="{ width: Math.min(100, (cardCount / 48) * 100) + '%' }"
            ></div>
          </div>
          <ul
            v-if="!validation.isValid && validation.errors.length"
            role="status"
            aria-live="polite"
            class="mt-4 space-y-1.5 text-xs text-base-content/60"
          >
            <li
              v-for="(err, i) in validation.errors.slice(0, 4)"
              :key="i"
              class="flex items-start gap-2"
            >
              <span class="mt-1.5 h-1 w-1 shrink-0 bg-primary"></span>
              {{ err }}
            </li>
          </ul>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Slots héros / havre-sac : puits papier, filet d'encre central -->
        <div class="grid grid-cols-2 divide-x divide-base-content/15">
          <div class="relative bg-base-100 p-3">
            <span class="eyebrow text-base-content/50">Héros</span>
            <div
              v-if="currentDeck?.hero"
              class="mt-2 flex items-center gap-2.5"
            >
              <div
                class="plate-frame w-10 shrink-0"
                :style="{ '--spine': elementColor(currentDeck.hero) }"
              >
                <img
                  :src="cardImg(currentDeck.hero)"
                  :alt="currentDeck.hero.name"
                  class="aspect-[7/10] object-cover"
                  @error="onImgError"
                />
              </div>
              <div class="min-w-0">
                <p class="truncate font-display text-sm leading-tight">
                  {{ currentDeck.hero.name }}
                </p>
                <button
                  class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
                  @click="deckStore.removeHero()"
                >
                  Retirer
                </button>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-base-content/40">
              Cliquez un héros
            </p>
          </div>

          <div class="relative bg-base-100 p-3">
            <span class="eyebrow text-base-content/50">Havre-Sac</span>
            <div
              v-if="currentDeck?.havreSac"
              class="mt-2 flex items-center gap-2.5"
            >
              <div
                class="plate-frame w-10 shrink-0"
                :style="{ '--spine': elementColor(currentDeck.havreSac) }"
              >
                <img
                  :src="cardImg(currentDeck.havreSac)"
                  :alt="currentDeck.havreSac.name"
                  class="aspect-[7/10] object-cover"
                  @error="onImgError"
                />
              </div>
              <div class="min-w-0">
                <p class="truncate font-display text-sm leading-tight">
                  {{ currentDeck.havreSac.name }}
                </p>
                <button
                  class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
                  @click="deckStore.removeHavreSac()"
                >
                  Retirer
                </button>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-base-content/40">
              Cliquez un havre-sac
            </p>
          </div>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Distribution élémentaire : filet segmenté + légende mono -->
        <div v-if="cardCount > 0" class="p-4">
          <p class="section-rule eyebrow mb-3">Éléments</p>
          <div class="flex h-px w-full">
            <div
              v-for="el in elementDist"
              :key="el.name"
              :style="{
                width: (el.count / Math.max(1, cardCount)) * 100 + '%',
                backgroundColor: el.color,
              }"
              :title="`${el.name}: ${el.count}`"
            ></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <span
              v-for="el in elementDist"
              :key="el.name"
              class="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-base-content/65"
            >
              <span
                class="h-2.5 w-2.5"
                :style="{ backgroundColor: el.color }"
              ></span>
              {{ el.name }}
              <span class="tabular text-base-content">{{ el.count }}</span>
            </span>
          </div>
          <!-- Répartition par type -->
          <div
            class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-base-content/10 pt-3"
          >
            <span
              v-for="t in typeBreakdown"
              :key="t.type"
              class="font-mono text-[11px] uppercase tracking-wider text-base-content/65"
            >
              {{ t.type }}
              <span class="tabular text-base-content">{{ t.count }}</span>
            </span>
          </div>
        </div>
        <div v-if="cardCount > 0" class="h-px w-full bg-base-content/15"></div>

        <!-- Liste des cartes : grand-livre à conduite de points -->
        <div class="p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="section-rule eyebrow grow">Cartes du deck</p>
            <button
              v-if="cardCount > 0"
              class="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/50 hover:text-error"
              data-testid="deck-clear"
              @click="confirmClear"
            >
              Tout vider
            </button>
          </div>
          <div
            v-if="!currentDeck?.cards.length"
            class="py-8 text-center text-sm text-base-content/40"
          >
            Cliquez des cartes à gauche pour les ajouter.
          </div>
          <ul v-else class="max-h-[34vh] overflow-y-auto">
            <li
              v-for="dc in mainDeckCards"
              :key="dc.card.id"
              class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
              :style="{ '--spine': elementColor(dc.card) }"
            >
              <span
                class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
                >{{ dc.quantity }}</span
              >
              <span class="truncate font-display text-sm leading-tight">{{
                dc.card.name
              }}</span>
              <span class="leader"></span>
              <span
                class="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-base-content/45"
              >
                {{ dc.card.mainType
                }}<span v-if="dc.card.stats?.pa">
                  · {{ dc.card.stats.pa }} PA</span
                >
              </span>
              <span class="ml-1 flex shrink-0 items-center gap-1.5">
                <button
                  class="text-base-content/40 hover:text-primary"
                  @click="moveToReserve(dc.card.id)"
                  title="Déplacer en réserve"
                  aria-label="Déplacer en réserve"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
                    />
                  </svg>
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
                  @click="deckStore.removeCard(dc.card.id, 1)"
                  aria-label="Retirer une copie"
                >
                  −
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
                  @click="addToDeck(dc.card)"
                  aria-label="Ajouter une copie"
                >
                  +
                </button>
              </span>
            </li>
          </ul>
        </div>

        <!-- Réserve (sideboard, max 12) -->
        <div class="h-px w-full bg-base-content/15"></div>
        <div class="p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="section-rule eyebrow grow">Réserve</p>
            <span
              class="shrink-0 font-mono text-xs font-bold tabular"
              :class="
                reserveCount === 12
                  ? 'text-primary'
                  : reserveCount === 0
                    ? 'text-base-content/55'
                    : 'text-warning'
              "
              :title="
                reserveCount !== 0 && reserveCount !== 12
                  ? 'La réserve doit contenir exactement 0 ou 12 cartes (règle 101.4)'
                  : ''
              "
              >{{ reserveCount }} / 12<span
                v-if="reserveCount !== 0 && reserveCount !== 12"
                class="ml-1 lowercase text-warning"
                >· 0 ou 12 requis</span
              ></span
            >
          </div>
          <ul
            v-if="reserveDeckCards.length"
            class="max-h-[22vh] overflow-y-auto"
          >
            <li
              v-for="dc in reserveDeckCards"
              :key="'r-' + dc.card.id"
              class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
              :style="{ '--spine': elementColor(dc.card) }"
            >
              <span
                class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
                >{{ dc.quantity }}</span
              >
              <span class="truncate font-display text-sm leading-tight">{{
                dc.card.name
              }}</span>
              <span class="leader"></span>
              <span class="ml-1 flex shrink-0 items-center gap-1.5">
                <button
                  class="text-base-content/40 hover:text-primary"
                  @click="moveToMain(dc.card.id)"
                  title="Renvoyer au deck principal"
                  aria-label="Renvoyer au deck principal"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"
                    />
                  </svg>
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-error"
                  @click="deckStore.removeCard(dc.card.id, 1, true)"
                  aria-label="Retirer de la réserve"
                >
                  ×
                </button>
              </span>
            </li>
          </ul>
          <p v-else class="py-3 text-xs text-base-content/40">
            Réserve vide — déplacez-y des cartes du deck avec le bouton ↓.
          </p>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Cartes manquantes pour jouer cette liste (connecté) -->
        <div v-if="isAuthenticated && missingTotal > 0" class="p-4">
          <p class="section-rule eyebrow mb-3 text-primary">
            À acquérir · {{ missingTotal }}
          </p>
          <ul class="max-h-[20vh] space-y-1 overflow-y-auto">
            <li
              v-for="m in missingCards"
              :key="'miss-' + m.card.id"
              class="flex items-baseline gap-2 text-xs"
            >
              <span class="font-mono tabular text-primary"
                >+{{ m.missing }}</span
              >
              <span class="truncate font-display">{{ m.card.name }}</span>
              <span class="leader"></span>
              <span
                class="shrink-0 font-mono text-[10px] tabular text-base-content/45"
                >{{ m.have }}/{{ m.need }}</span
              >
            </li>
          </ul>
        </div>
        <div
          v-if="isAuthenticated && missingTotal > 0"
          class="h-px w-full bg-base-content/15"
        ></div>

        <!-- Notes du deck -->
        <div class="p-4">
          <p class="eyebrow mb-2 text-base-content/50">Notes</p>
          <textarea
            :value="currentDeck?.description || ''"
            @change="updateNotes(($event.target as HTMLTextAreaElement).value)"
            rows="2"
            placeholder="Archétype, plan de jeu, choix de réserve…"
            class="textarea textarea-bordered w-full text-sm"
          ></textarea>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-2 p-4">
          <router-link
            v-if="currentDeck"
            :to="`/deck/${currentDeck.id}`"
            class="btn btn-ghost btn-sm gap-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Aperçu
          </router-link>
          <button class="btn btn-ghost btn-sm gap-1.5" @click="shareDeck">
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            Partager
          </button>
          <div class="flex-1"></div>
          <button
            class="btn btn-ghost btn-sm text-error"
            @click="confirmDelete"
          >
            Supprimer
          </button>
        </div>
      </aside>
    </div>
  </div>

  <!-- ─────────── Zoom avant ajout ─────────── -->
  <CardZoomModal
    :card="zoomCard"
    :open="zoomOpen"
    data-testid="card-zoom"
    @close="zoomOpen = false"
  >
    <template #actions>
      <div class="flex flex-wrap gap-2">
        <!-- Ajouter 1 copie -->
        <button
          class="btn btn-sm font-mono uppercase tracking-wider"
          :disabled="zoomCard ? !canAddCard(zoomCard) : true"
          :title="
            zoomCard && !canAddCard(zoomCard) ? addBlockReason(zoomCard) : ''
          "
          @click="zoomCard && addToDeck(zoomCard)"
        >
          + Ajouter
        </button>
        <!-- Ajouter ×3 — masqué pour Héros / Havre-Sac -->
        <button
          v-if="!zoomIsLeader"
          class="btn btn-sm font-mono uppercase tracking-wider"
          :disabled="zoomCard ? !canAddCard(zoomCard) : true"
          :title="
            zoomCard && !canAddCard(zoomCard) ? addBlockReason(zoomCard) : ''
          "
          @click="zoomCard && addToDeckQty(zoomCard, 3)"
        >
          + ×3
        </button>
        <!-- Ajouter en Réserve — masqué pour Héros / Havre-Sac -->
        <button
          v-if="!zoomIsLeader"
          class="btn btn-sm font-mono uppercase tracking-wider"
          :disabled="zoomCard ? !canAddCard(zoomCard, true) : true"
          :title="
            zoomCard && !canAddCard(zoomCard, true)
              ? addBlockReason(zoomCard, true)
              : ''
          "
          @click="zoomCard && addToReserve(zoomCard)"
        >
          + Réserve
        </button>
      </div>
    </template>
  </CardZoomModal>

  <!-- Confirmation stylée (vider / supprimer le deck, remplacer héros/havre-sac) -->
  <ConfirmDialog
    :open="confirmState.open"
    :title="confirmState.title"
    :message="confirmState.message"
    :danger="confirmState.danger"
    @confirm="onConfirmOk"
    @cancel="onConfirmCancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getThumbPath } from "@/utils/imagePaths";
import {
  elementColors,
  elementColor as elementColorByEl,
} from "@/config/elementColors";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";
import { validateDeck } from "@/validators/deck";
import { generateShareUrl } from "@/utils/deckSharing";
import {
  filterCards,
  sortCards,
  pruneFilterCaches,
} from "@/composables/useCardFilter";
import type { FilterCriteria } from "@/composables/useCardFilter";
import CollectionFilters from "@/components/collection/CollectionFilters.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import type { Card, Deck } from "@/types/cards";

const route = useRoute();
const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const authStore = useAuthStore();
const toast = useToast();

// ── Filtres (liés à <CollectionFilters>) ──────────────────────────────────────
const filterQuery = ref("");
const filterExtension = ref("");
const filterMainType = ref("");
const filterSubType = ref("");
const filterRarity = ref("");
const filterElement = ref("");
const filterMinLevel = ref<number | null>(null);
const filterMaxLevel = ref<number | null>(null);
const filterMinCost = ref<number | null>(null);
const filterMaxCost = ref<number | null>(null);
const filterMinForce = ref<number | null>(null);
const filterMaxForce = ref<number | null>(null);
const filterEffectQuery = ref("");
const filterHideNotOwned = ref(false);
const filterSortField = ref("number");
const filterSortDesc = ref(false);

/**
 * Estompe les cartes non possédées dans le vivier. OFF par défaut : on peut
 * construire des decks pour le jeu en ligne sans posséder les cartes, donc la
 * possession n'est qu'une indication facultative (le badge de quantité reste).
 */
const dimUnowned = ref(false);

const poolLimit = ref(60);
// Vrai si l'initialisation du catalogue a échoué (réseau/hors-ligne).
const loadError = ref(false);

// ── Listes d'options pour CollectionFilters (calculées depuis cardStore) ──────
const filterExtensions = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.extension.name));
  return Array.from(set).sort();
});
const filterMainTypes = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.mainType));
  return Array.from(set).sort();
});
const filterSubTypes = computed(() => {
  const set = new Set(cardStore.cards.flatMap((c) => c.subTypes ?? []));
  return Array.from(set).sort();
});
const filterRarities = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.rarity));
  return Array.from(set).sort();
});
const filterElements = computed(() => {
  const set = new Set(
    cardStore.cards
      .map(
        (c) =>
          c.stats?.niveau?.element?.toLowerCase() ||
          c.stats?.force?.element?.toLowerCase() ||
          "",
      )
      .filter(Boolean),
  );
  return Array.from(set).sort();
});

// ── Zoom avant ajout ──────────────────────────────────────────────────────────
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);

/** Vrai si la carte zoomée est un leader (Héros ou Havre-Sac) — masque ×3 et Réserve. */
const zoomIsLeader = computed(
  () =>
    zoomCard.value?.mainType === "Héros" ||
    zoomCard.value?.mainType === "Havre-Sac",
);

function openZoom(card: Card) {
  zoomCard.value = card;
  zoomOpen.value = true;
}

// Fermeture clavier (Échap) quand le zoom est ouvert.
function onKeydown(e: KeyboardEvent) {
  if (!zoomOpen.value) return;
  if (e.key === "Escape") {
    zoomOpen.value = false;
    return;
  }
  // Ne pas déclencher les raccourcis d'ajout (a/e/r) si l'utilisateur tape dans
  // un champ (recherche, filtres, notes) — sinon taper « arme » ajouterait la carte.
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const card = zoomCard.value;
  if (!card) return;
  if (e.key === "a") addToDeck(card);
  else if (e.key === "e" && !zoomIsLeader.value) addToDeckQty(card, 3);
  else if (e.key === "r" && !zoomIsLeader.value) addToReserve(card);
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

// ── Données deck ──────────────────────────────────────────────────────────────
const decks = computed(() => deckStore.decks);
const currentDeck = computed(() => deckStore.currentDeck as Deck | null);
const cardCount = computed(() => deckStore.cardCount);

const validation = computed(() =>
  currentDeck.value
    ? validateDeck(currentDeck.value)
    : { isValid: false, errors: [] },
);

// ── Pool de cartes ────────────────────────────────────────────────────────────

/** IDs possédés (normal + foil) pour FilterCriteria.ownedIds. */
const ownedIds = computed(() => {
  const ids = new Set<string>();
  for (const c of cardStore.cards) {
    if (ownedQty(c.id) > 0) ids.add(c.id);
  }
  return ids;
});

const pool = computed(() => {
  pruneFilterCaches();
  const criteria: FilterCriteria = {
    query: filterQuery.value,
    extension: filterExtension.value,
    mainType: filterMainType.value,
    subType: filterSubType.value,
    rarity: filterRarity.value,
    element: filterElement.value.toLowerCase(),
    minLevel: filterMinLevel.value,
    maxLevel: filterMaxLevel.value,
    minCost: filterMinCost.value,
    maxCost: filterMaxCost.value,
    minForce: filterMinForce.value,
    maxForce: filterMaxForce.value,
    effectQuery: filterEffectQuery.value,
    hideNotOwned: filterHideNotOwned.value,
    ownedIds: ownedIds.value,
  };
  const filtered = filterCards(cardStore.cards, criteria);
  return sortCards(filtered, filterSortField.value, filterSortDesc.value);
});

// ── Guard d'ajout ────────────────────────────────────────────────────────────

/**
 * Renvoie true si on peut encore ajouter une copie de `card` au deck principal
 * (ou à la réserve si `reserve=true`).
 */
function canAddCard(card: Card, reserve = false): boolean {
  if (!currentDeck.value) return false;
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return true;
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max) return false;
  if (reserve) return deckStore.reserveCount < 12;
  return cardCount.value < 48;
}

/** Raison lisible quand canAddCard retourne false (pour le `title` du bouton). */
function addBlockReason(card: Card, reserve = false): string {
  if (!currentDeck.value) return "Aucun deck actif";
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return "";
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max)
    return isUnique
      ? `${card.name} est unique (1 exemplaire max)`
      : `Maximum ${max} exemplaires de ${card.name}`;
  if (reserve) return "La réserve est pleine (12 cartes max)";
  return "Le deck contient déjà 48 cartes";
}

// ── Cartes manquantes pour jouer cette liste en réel (croisé à la collection).
const missingCards = computed(() => {
  const map = new Map<string, { card: Card; need: number; have: number }>();
  for (const dc of currentDeck.value?.cards ?? []) {
    const entry = map.get(dc.card.id) ?? {
      card: dc.card,
      need: 0,
      have: ownedQty(dc.card.id),
    };
    entry.need += dc.quantity;
    map.set(dc.card.id, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, missing: Math.max(0, e.need - e.have) }))
    .filter((e) => e.missing > 0)
    .sort((a, b) => b.missing - a.missing);
});
const missingTotal = computed(() =>
  missingCards.value.reduce((a, e) => a + e.missing, 0),
);
const isAuthenticated = computed(() => authStore.isAuthenticated);

function updateNotes(value: string) {
  if (currentDeck.value)
    deckStore.setDeckDescription(currentDeck.value.id, value);
}
const visiblePool = computed(() => pool.value.slice(0, poolLimit.value));

/** Couleur d'élément d'une carte — délègue à @/config/elementColors. */
function elementColor(card: Card): string {
  const el = card.stats?.niveau?.element || card.stats?.force?.element || null;
  return elementColorByEl(el?.toString());
}
const elementDist = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    const el = (
      dc.card.stats?.niveau?.element ||
      dc.card.stats?.force?.element ||
      "Neutre"
    ).toLowerCase();
    map[el] = (map[el] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      color: elementColors[name] || elementColors.neutre,
    }))
    .sort((a, b) => b.count - a.count);
});

const reserveCount = computed(() => deckStore.reserveCount);
const mainDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => !c.isReserve)
    .sort((a, b) => {
      if (a.card.mainType !== b.card.mainType)
        return a.card.mainType.localeCompare(b.card.mainType);
      return (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0);
    }),
);
const reserveDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => c.isReserve)
    .sort((a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0)),
);
function moveToReserve(id: string) {
  if (reserveCount.value >= 12) {
    toast.warning("La réserve est pleine (12 cartes max)", { duration: 2000 });
    return;
  }
  deckStore.moveCardZone(id, true, 1);
}
function moveToMain(id: string) {
  if (cardCount.value >= 48) {
    toast.warning("Le deck principal est plein (48 cartes)", {
      duration: 2000,
    });
    return;
  }
  deckStore.moveCardZone(id, false, 1);
}

// Répartition par type (deck principal) — exposée pour le joueur.
const typeBreakdown = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    map[dc.card.mainType] = (map[dc.card.mainType] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
});

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full); // vignette en grille
}
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  // Repli vignette → image pleine → dos de carte.
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}

function ownedQty(id: string): number {
  return cardStore.getCardQuantity(id) + cardStore.getFoilCardQuantity(id);
}
function inDeckQty(id: string): number {
  return (currentDeck.value?.cards ?? [])
    .filter((c) => c.card.id === id)
    .reduce((a, c) => a + c.quantity, 0);
}

/** Ajoute 1 copie au deck principal (chemin normal + guard + toast). */
function addToDeck(card: Card) {
  if (!currentDeck.value) return;
  if (card.mainType === "Héros") {
    requestSetHero(card);
    return;
  }
  if (card.mainType === "Havre-Sac") {
    requestSetHavreSac(card);
    return;
  }
  if (!canAddCard(card)) {
    toast.warning(addBlockReason(card), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, 1);
}

/** Ajoute jusqu'à `qty` copies au deck principal (bouton ×3 de la zoom). */
function addToDeckQty(card: Card, qty: number) {
  if (!currentDeck.value) return;
  if (card.mainType === "Héros") {
    requestSetHero(card);
    return;
  }
  if (card.mainType === "Havre-Sac") {
    requestSetHavreSac(card);
    return;
  }
  if (!canAddCard(card)) {
    toast.warning(addBlockReason(card), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, qty);
}

/** Ajoute 1 copie à la réserve (bouton « + Réserve » de la zoom). */
function addToReserve(card: Card) {
  if (!currentDeck.value) return;
  if (!canAddCard(card, true)) {
    toast.warning(addBlockReason(card, true), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, 1, true);
}

function renameCurrent(name: string) {
  if (currentDeck.value) deckStore.renameDeck(currentDeck.value.id, name);
}

function switchDeck(id: string) {
  deckStore.setCurrentDeck(id);
  router.replace(`/deck-builder/${id}`);
}

// ── ConfirmDialog state ───────────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  onConfirm: () => void;
}
const confirmState = ref<ConfirmState>({
  open: false,
  title: "",
  message: "",
  danger: false,
  onConfirm: () => {},
});

function openConfirm(opts: Omit<ConfirmState, "open">) {
  confirmState.value = { open: true, ...opts };
}

function onConfirmOk() {
  confirmState.value.onConfirm();
  confirmState.value = { ...confirmState.value, open: false };
}

function onConfirmCancel() {
  confirmState.value = { ...confirmState.value, open: false };
}

function confirmClear() {
  openConfirm({
    title: "Vider toutes les cartes",
    message:
      "Cette action supprimera toutes les cartes du deck (y compris le héros et le havre-sac). Continuer ?",
    danger: true,
    onConfirm: () => deckStore.clearDeck(),
  });
}

function confirmDelete() {
  if (!currentDeck.value) return;
  const deckName = currentDeck.value.name;
  const deckId = currentDeck.value.id;
  openConfirm({
    title: `Supprimer « ${deckName} »`,
    message:
      "Ce deck sera définitivement supprimé. Cette action est irréversible.",
    danger: true,
    onConfirm: () => {
      deckStore.deleteDeck(deckId);
      toast.success("Deck supprimé", { duration: 2000 });
      router.push("/decks");
    },
  });
}

// ── Remplacement héros / havre-sac avec confirmation ────────────────────────

function requestSetHero(card: Card) {
  const existing = currentDeck.value?.hero;
  if (existing && existing.id !== card.id) {
    openConfirm({
      title: "Remplacer le héros",
      message: `Remplacer « ${existing.name} » par « ${card.name} » ?`,
      danger: false,
      onConfirm: () => {
        deckStore.setHero(card);
        toast.success(`Héros : ${card.name}`, { duration: 1500 });
      },
    });
  } else {
    deckStore.setHero(card);
    toast.success(`Héros : ${card.name}`, { duration: 1500 });
  }
}

function requestSetHavreSac(card: Card) {
  const existing = currentDeck.value?.havreSac;
  if (existing && existing.id !== card.id) {
    openConfirm({
      title: "Remplacer le havre-sac",
      message: `Remplacer « ${existing.name} » par « ${card.name} » ?`,
      danger: false,
      onConfirm: () => {
        deckStore.setHavreSac(card);
        toast.success(`Havre-sac : ${card.name}`, { duration: 1500 });
      },
    });
  } else {
    deckStore.setHavreSac(card);
    toast.success(`Havre-sac : ${card.name}`, { duration: 1500 });
  }
}

async function shareDeck() {
  if (!currentDeck.value) return;
  try {
    await navigator.clipboard.writeText(generateShareUrl(currentDeck.value));
    toast.success("Lien de partage copié !", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier le lien");
  }
}

async function setupDeck() {
  loadError.value = false;
  try {
    await cardStore.initialize();
  } catch (e) {
    // Avant : l'échec n'était pas intercepté → le pool restait vide sans
    // message ni moyen de réessayer.
    console.error("Erreur de chargement des cartes (deck builder):", e);
    loadError.value = true;
    return;
  }

  deckStore.initialize();

  const id = route.params.id as string | undefined;
  if (id) {
    deckStore.setCurrentDeck(id);
    if (!deckStore.currentDeck) {
      toast.error("Deck introuvable");
      router.replace("/decks");
    }
  } else {
    const newId = deckStore.createDeck("Nouveau deck");
    router.replace(`/deck-builder/${newId}`);
  }
}

function retryLoad() {
  cardStore.reset();
  setupDeck();
}

onMounted(setupDeck);
</script>
