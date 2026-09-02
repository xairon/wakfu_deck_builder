<template>
  <!-- ═══════════ LOBBY : choix des decks (J1 puis J2) ═══════════ -->
  <div v-if="store.matchPhase === 'lobby' && !store.online" class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">La Table des Douze</p>
        <h1 class="mt-2 font-display text-3xl sm:text-4xl">Nouvelle partie</h1>
        <p class="mt-2 max-w-lg text-base-content/70">
          Apprends en jouant une vraie partie contre l'ordinateur, ou affronte
          un ami à distance avec un code.
        </p>
      </div>
    </header>
    <div class="h-px w-full bg-base-content/20"></div>

    <!-- Partie en cours détectée : on PROPOSE de reprendre ou d'abandonner
         (plutôt que de s'y reconnecter d'office au montage). -->
    <section
      v-if="resumable"
      class="border border-warning/40 bg-warning/[0.06] p-5"
      data-testid="resume-banner"
    >
      <p class="eyebrow text-warning">Partie en cours</p>
      <p class="mt-1 text-sm text-base-content/70">
        Tu as une partie non terminée. Reprends-la ou abandonne-la pour repartir
        d'un lobby vierge.
      </p>
      <div class="mt-3 flex flex-wrap gap-3">
        <button
          class="btn btn-primary btn-sm"
          data-testid="resume-game"
          @click="resumeGame"
        >
          Reprendre la partie
        </button>
        <button
          class="btn btn-outline btn-sm"
          data-testid="abandon-game"
          @click="abandonResumable"
        >
          Abandonner
        </button>
      </div>
    </section>

    <!-- Apprendre en jouant (partie guidée-puis-libre contre l'IA locale) -->
    <section class="border border-secondary/30 bg-secondary/[0.04] p-5">
      <div>
        <p class="eyebrow text-secondary">Apprendre en jouant</p>
        <p class="mt-1 text-sm text-base-content/65">
          Une partie complète contre l'ordinateur, guidée pas à pas au début
          (mulligan, jouer, attaquer, défendre) puis libre.
          <span class="font-semibold text-base-content/80"
            >Ici, tout est automatisé pour toi : coûts, combat, victoire — et
            les effets des cartes.</span
          >
          C'est pourquoi seuls les decks starter d'Incarnam sont proposés : ce
          sont les seuls dont chaque effet est programmé.
        </p>
      </div>
      <div class="mt-4 flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-base-content/60">Ton deck</span>
          <select
            v-model="botMyDeckId"
            class="select select-bordered select-sm w-56 bg-base-200"
            data-testid="vsbot-my-deck"
          >
            <option
              v-for="d in INCARNAM_STARTERS"
              :key="'s' + d.id"
              :value="d.id"
            >
              {{ d.name }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-base-content/60">Deck de l'ordinateur</span>
          <select
            v-model="botOppDeckId"
            class="select select-bordered select-sm w-56 bg-base-200"
            data-testid="vsbot-opp-deck"
          >
            <option
              v-for="d in INCARNAM_STARTERS"
              :key="'o' + d.id"
              :value="d.id"
            >
              {{ d.name }}
            </option>
          </select>
        </label>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="!cardStore.cards.length || !botMyDeckId || !botOppDeckId"
          data-testid="vsbot-start"
          @click="startVsBot"
        >
          🎓 Apprendre en jouant
        </button>
      </div>
    </section>
    <div class="h-px w-full bg-base-content/20"></div>

    <section
      v-if="ONLINE_PLAY_ENABLED"
      class="border border-primary/30 bg-primary/[0.04] p-5"
    >
      <div>
        <p class="eyebrow text-primary">Jouer en ligne</p>
        <p class="mt-1 text-sm text-base-content/65">
          Affronte un ami à distance, en temps réel, avec un code de salon —
          avec le deck complet de ton choix. La table applique un cadre solide
          (tours, pioche, combat et victoire calculés pour vous deux),
          <span class="font-semibold text-base-content/80"
            >et les effets des cartes se jouent à la main</span
          >
          : c'est à vous de les lire et de les appliquer, comme sur une vraie
          table.
        </p>
      </div>

      <p v-if="!authStore.isAuthenticated" class="mt-3 text-sm">
        <RouterLink to="/auth" class="link text-primary"
          >Connecte-toi</RouterLink
        >
        pour jouer en ligne.
      </p>
      <p v-else-if="!decks.length" class="mt-3 text-sm text-base-content/60">
        <RouterLink to="/deck-builder" class="link text-primary"
          >Construis d'abord un deck</RouterLink
        >
        pour jouer en ligne.
      </p>

      <div v-else class="mt-4 space-y-4">
        <!-- Deck partagé (sert aussi bien à créer qu'à rejoindre). -->
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-base-content/60">Ton deck</span>
          <select
            v-model="onlineDeckId"
            class="select select-bordered select-sm w-64 bg-base-200"
          >
            <option :value="null" disabled>Choisis…</option>
            <option v-for="d in decks" :key="d.id" :value="d.id">
              {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
            </option>
          </select>
        </label>
        <p v-if="onlineDeckId && !onlineDeckValid" class="text-sm text-warning">
          Deck incomplet : {{ onlineDeckErrors[0] }}
        </p>

        <!-- Héberger une nouvelle partie (CADRE : un seul mode en ligne). -->
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="btn btn-primary btn-sm"
            :disabled="!onlineDeckId || onlineBusy || !onlineDeckValid"
            @click="onlineCreate"
          >
            {{ onlineBusy ? "…" : "Créer la partie" }}
          </button>
        </div>
        <p class="text-xs text-base-content/50">
          Les effets des cartes se jouent à la main dans tous les cas.
        </p>

        <!-- …ou rejoindre celle d'un ami avec son code. -->
        <div
          class="flex flex-wrap items-end gap-3 border-t border-base-content/10 pt-3"
        >
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-base-content/60">Rejoindre avec un code</span>
            <input
              v-model="joinCode"
              maxlength="8"
              placeholder="ABCD12"
              class="input input-bordered input-sm w-40 uppercase"
            />
          </label>
          <button
            class="btn btn-outline btn-sm"
            :disabled="
              !onlineDeckId ||
              !joinCode.trim() ||
              onlineBusy ||
              !onlineDeckValid
            "
            @click="onlineJoin"
          >
            {{ onlineBusy ? "…" : "Rejoindre" }}
          </button>
        </div>

        <span v-if="onlineError" class="text-sm text-error">{{
          onlineError
        }}</span>
      </div>
    </section>

    <!-- ═══════════ Mode 2v2 Multijoueur en équipe (En Ligne & Local) ═══════════ -->
    <div class="h-px w-full bg-base-content/20"></div>

    <section
      class="border border-info/40 bg-info/[0.04] p-5"
      data-testid="two-vs-two-section"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="eyebrow text-info">Multijoueur en équipe</p>
          <h2 class="mt-1 font-display text-xl sm:text-2xl font-semibold">Mode 2v2 (2 équipes de 2 joueurs)</h2>
          <p class="mt-1 text-sm text-base-content/70">
            Affrontez-vous en équipe de deux joueurs (Équipe 1 : Joueurs 1 & 3 / Équipe 2 : Joueurs 2 & 4).
            Tour par tour croisé, mains visibles entre coéquipiers, renforts en combat, et victoire à 36 XP d'équipe ou par élimination des Héros adverses.
          </p>
        </div>

        <!-- Onglets En Ligne vs Local -->
        <div class="join">
          <button
            class="btn btn-sm join-item"
            :class="online2v2Tab === 'online' ? 'btn-info' : 'btn-ghost'"
            @click="online2v2Tab = 'online'"
          >
            🌐 En Ligne
          </button>
          <button
            class="btn btn-sm join-item"
            :class="online2v2Tab === 'sandbox' ? 'btn-info' : 'btn-ghost'"
            @click="online2v2Tab = 'sandbox'"
          >
            🖥️ Entraînement Local
          </button>
        </div>
      </div>

      <!-- ── VUE EN LIGNE ── -->
      <div v-if="online2v2Tab === 'online'" class="mt-4 space-y-4">
        <!-- Sans salon actif : Créer ou Rejoindre -->
        <div v-if="!active2v2Lobby" class="space-y-4">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-base-content/70 font-medium">Ton deck pour le 2v2</span>
            <select
              v-model="online2v2DeckId"
              class="select select-bordered select-sm w-64 bg-base-200"
            >
              <option :value="null" disabled>Choisis un deck…</option>
              <option v-for="d in decks" :key="'2v2-my-' + d.id" :value="d.id">
                {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
              </option>
            </select>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              class="btn btn-info btn-sm"
              :disabled="!online2v2DeckId || !online2v2DeckValid"
              @click="create2v2OnlineLobby"
            >
              Créer un salon 2v2
            </button>

            <div class="flex items-center gap-2 border-l border-base-content/20 pl-3">
              <input
                v-model="online2v2JoinCode"
                maxlength="10"
                placeholder="2V2-XXXX"
                class="input input-bordered input-sm w-36 uppercase font-mono"
              />
              <button
                class="btn btn-outline btn-sm"
                :disabled="!online2v2DeckId || !online2v2DeckValid || !online2v2JoinCode.trim()"
                @click="join2v2OnlineLobby"
              >
                Rejoindre
              </button>
            </div>
          </div>
          <p v-if="online2v2Error" class="text-xs text-error">{{ online2v2Error }}</p>
        </div>

        <!-- Dans un salon 2v2 actif (4 slots en temps réel) -->
        <div v-else class="space-y-4 rounded-lg border border-info/30 bg-base-200/50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 pb-3">
            <div>
              <span class="text-xs font-semibold text-info uppercase">Salon 2v2 en attente</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="font-mono text-xl font-bold tracking-widest text-primary">{{ active2v2Lobby.code }}</span>
                <span class="badge badge-sm badge-info">4 Joueurs</span>
              </div>
            </div>
            <button class="btn btn-ghost btn-xs text-error" @click="leave2v2Lobby">
              Quitter le salon
            </button>
          </div>

          <!-- Grille des 4 slots -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Équipe 1 -->
            <div class="rounded border border-info/30 bg-base-100 p-3 space-y-2">
              <h4 class="font-bold text-sm text-info flex items-center justify-between">
                <span>🛡️ Équipe 1</span>
                <span v-if="team1OnlineErrors.length === 0 && active2v2Lobby.slots.A1 && active2v2Lobby.slots.A2" class="badge badge-success badge-xs">Decks valides</span>
              </h4>

              <!-- Slot A1 (Hôte - J1) -->
              <div class="flex items-center justify-between rounded bg-base-200/60 p-2 text-sm">
                <div>
                  <p class="font-semibold">{{ active2v2Lobby.slots.A1?.userName || "Joueur 1 (Hôte)" }} <span class="badge badge-xs">J1</span></p>
                  <p class="text-xs text-base-content/60">{{ (active2v2Lobby.slots.A1?.deck as Deck)?.name || "Deck sélectionné" }}</p>
                </div>
                <button
                  v-if="my2v2Seat === 'A1'"
                  class="btn btn-xs"
                  :class="active2v2Lobby.slots.A1?.ready ? 'btn-success' : 'btn-warning'"
                  @click="toggle2v2Ready"
                >
                  {{ active2v2Lobby.slots.A1?.ready ? "Prêt" : "En attente" }}
                </button>
                <span v-else class="badge badge-sm" :class="active2v2Lobby.slots.A1?.ready ? 'badge-success' : 'badge-warning'">
                  {{ active2v2Lobby.slots.A1?.ready ? "Prêt" : "En attente" }}
                </span>
              </div>

              <!-- Slot A2 (Coéquipier - J3) -->
              <div class="flex items-center justify-between rounded bg-base-200/60 p-2 text-sm">
                <div v-if="active2v2Lobby.slots.A2">
                  <p class="font-semibold">{{ active2v2Lobby.slots.A2.userName }} <span class="badge badge-xs">J3</span></p>
                  <p class="text-xs text-base-content/60">{{ (active2v2Lobby.slots.A2.deck as Deck)?.name || "Deck sélectionné" }}</p>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">
                  En attente du Joueur 3…
                </div>
                <div class="flex items-center gap-1">
                  <button
                    v-if="my2v2Seat !== 'A2' && !active2v2Lobby.slots.A2"
                    class="btn btn-xs btn-outline btn-info"
                    @click="select2v2Slot('A2')"
                  >
                    Prendre ce slot
                  </button>
                  <button
                    v-if="my2v2Seat === 'A2'"
                    class="btn btn-xs"
                    :class="active2v2Lobby.slots.A2?.ready ? 'btn-success' : 'btn-warning'"
                    @click="toggle2v2Ready"
                  >
                    {{ active2v2Lobby.slots.A2?.ready ? "Prêt" : "En attente" }}
                  </button>
                  <span
                    v-else-if="active2v2Lobby.slots.A2"
                    class="badge badge-sm"
                    :class="active2v2Lobby.slots.A2?.ready ? 'badge-success' : 'badge-warning'"
                  >
                    {{ active2v2Lobby.slots.A2?.ready ? "Prêt" : "En attente" }}
                  </span>
                </div>
              </div>

              <div v-if="team1OnlineErrors.length > 0" class="text-xs text-warning">
                <p v-for="(err, idx) in team1OnlineErrors" :key="idx">⚠️ {{ err }}</p>
              </div>
            </div>

            <!-- Équipe 2 -->
            <div class="rounded border border-warning/30 bg-base-100 p-3 space-y-2">
              <h4 class="font-bold text-sm text-warning flex items-center justify-between">
                <span>⚔️ Équipe 2</span>
                <span v-if="team2OnlineErrors.length === 0 && active2v2Lobby.slots.B1 && active2v2Lobby.slots.B2" class="badge badge-success badge-xs">Decks valides</span>
              </h4>

              <!-- Slot B1 (Adversaire 1 - J2) -->
              <div class="flex items-center justify-between rounded bg-base-200/60 p-2 text-sm">
                <div v-if="active2v2Lobby.slots.B1">
                  <p class="font-semibold">{{ active2v2Lobby.slots.B1.userName }} <span class="badge badge-xs">J2</span></p>
                  <p class="text-xs text-base-content/60">{{ (active2v2Lobby.slots.B1.deck as Deck)?.name || "Deck sélectionné" }}</p>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">
                  En attente du Joueur 2…
                </div>
                <div class="flex items-center gap-1">
                  <button
                    v-if="my2v2Seat !== 'B1' && !active2v2Lobby.slots.B1"
                    class="btn btn-xs btn-outline btn-warning"
                    @click="select2v2Slot('B1')"
                  >
                    Prendre ce slot
                  </button>
                  <button
                    v-if="my2v2Seat === 'B1'"
                    class="btn btn-xs"
                    :class="active2v2Lobby.slots.B1?.ready ? 'btn-success' : 'btn-warning'"
                    @click="toggle2v2Ready"
                  >
                    {{ active2v2Lobby.slots.B1?.ready ? "Prêt" : "En attente" }}
                  </button>
                  <span
                    v-else-if="active2v2Lobby.slots.B1"
                    class="badge badge-sm"
                    :class="active2v2Lobby.slots.B1?.ready ? 'badge-success' : 'badge-warning'"
                  >
                    {{ active2v2Lobby.slots.B1?.ready ? "Prêt" : "En attente" }}
                  </span>
                </div>
              </div>

              <!-- Slot B2 (Adversaire 2 - J4) -->
              <div class="flex items-center justify-between rounded bg-base-200/60 p-2 text-sm">
                <div v-if="active2v2Lobby.slots.B2">
                  <p class="font-semibold">{{ active2v2Lobby.slots.B2.userName }} <span class="badge badge-xs">J4</span></p>
                  <p class="text-xs text-base-content/60">{{ (active2v2Lobby.slots.B2.deck as Deck)?.name || "Deck sélectionné" }}</p>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">
                  En attente du Joueur 4…
                </div>
                <div class="flex items-center gap-1">
                  <button
                    v-if="my2v2Seat !== 'B2' && !active2v2Lobby.slots.B2"
                    class="btn btn-xs btn-outline btn-warning"
                    @click="select2v2Slot('B2')"
                  >
                    Prendre ce slot
                  </button>
                  <button
                    v-if="my2v2Seat === 'B2'"
                    class="btn btn-xs"
                    :class="active2v2Lobby.slots.B2?.ready ? 'btn-success' : 'btn-warning'"
                    @click="toggle2v2Ready"
                  >
                    {{ active2v2Lobby.slots.B2?.ready ? "Prêt" : "En attente" }}
                  </button>
                  <span
                    v-else-if="active2v2Lobby.slots.B2"
                    class="badge badge-sm"
                    :class="active2v2Lobby.slots.B2?.ready ? 'badge-success' : 'badge-warning'"
                  >
                    {{ active2v2Lobby.slots.B2?.ready ? "Prêt" : "En attente" }}
                  </span>
                </div>
              </div>

              <div v-if="team2OnlineErrors.length > 0" class="text-xs text-warning">
                <p v-for="(err, idx) in team2OnlineErrors" :key="idx">⚠️ {{ err }}</p>
              </div>
            </div>
          </div>

          <!-- Bouton de lancement pour l'Hôte -->
          <div class="pt-2 flex items-center justify-between">
            <div v-if="my2v2Seat === 'A1'">
              <button
                class="btn btn-info btn-sm"
                :disabled="!canHostStart2v2Online"
                @click="launch2v2OnlineGame"
              >
                🚀 Lancer la partie 2v2 en ligne
              </button>
              <span v-if="!canHostStart2v2Online" class="ml-3 text-xs text-base-content/60">
                En attente que les 4 joueurs soient connectés et conformes…
              </span>
            </div>
            <div v-else class="text-xs text-base-content/60 italic">
              En attente du lancement par l'Hôte (Joueur 1)…
            </div>
          </div>
        </div>
      </div>

      <!-- ── VUE ENTRAÎNEMENT LOCAL (4 DECKS) ── -->
      <div v-else class="mt-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Équipe 1 -->
          <div class="rounded border border-info/30 bg-base-200/40 p-4 space-y-3">
            <h3 class="font-bold text-info flex items-center gap-2">
              <span>🛡️</span> Équipe 1 (Joueurs 1 & 3)
            </h3>
            <div class="flex flex-col gap-3">
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-base-content/70 font-medium">Joueur 1 (Hôte - J1)</span>
                <select v-model="team1Deck1Id" class="select select-bordered select-sm w-full bg-base-200" data-testid="2v2-deck-a1">
                  <option :value="null" disabled>Choisis un deck…</option>
                  <optgroup v-if="decks.length" label="Mes decks">
                    <option v-for="d in decks" :key="'2v2-a1-' + d.id" :value="d.id">
                      {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                    </option>
                  </optgroup>
                  <optgroup label="Decks officiels & Starters">
                    <option v-for="d in ALL_OFFICIAL_DECKS" :key="'2v2-off-a1-' + d.id" :value="'official-' + d.id">
                      {{ d.name }}
                    </option>
                  </optgroup>
                </select>
              </label>

              <label class="flex flex-col gap-1 text-sm">
                <span class="text-base-content/70 font-medium">Joueur 3 (Coéquipier - J3)</span>
                <select v-model="team1Deck2Id" class="select select-bordered select-sm w-full bg-base-200" data-testid="2v2-deck-a2">
                  <option :value="null" disabled>Choisis un deck…</option>
                  <optgroup v-if="decks.length" label="Mes decks">
                    <option v-for="d in decks" :key="'2v2-a2-' + d.id" :value="d.id">
                      {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                    </option>
                  </optgroup>
                  <optgroup label="Decks officiels & Starters">
                    <option v-for="d in ALL_OFFICIAL_DECKS" :key="'2v2-off-a2-' + d.id" :value="'official-' + d.id">
                      {{ d.name }}
                    </option>
                  </optgroup>
                </select>
              </label>
            </div>
            <div v-if="team1DeckErrors.length > 0" class="text-xs text-warning space-y-1">
              <p v-for="(err, idx) in team1DeckErrors" :key="idx">⚠️ {{ err }}</p>
            </div>
          </div>

          <!-- Équipe 2 -->
          <div class="rounded border border-warning/30 bg-base-200/40 p-4 space-y-3">
            <h3 class="font-bold text-warning flex items-center gap-2">
              <span>⚔️</span> Équipe 2 (Joueurs 2 & 4)
            </h3>
            <div class="flex flex-col gap-3">
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-base-content/70 font-medium">Joueur 2 (Adversaire 1 - J2)</span>
                <select v-model="team2Deck1Id" class="select select-bordered select-sm w-full bg-base-200" data-testid="2v2-deck-b1">
                  <option :value="null" disabled>Choisis un deck…</option>
                  <optgroup v-if="decks.length" label="Mes decks">
                    <option v-for="d in decks" :key="'2v2-b1-' + d.id" :value="d.id">
                      {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                    </option>
                  </optgroup>
                  <optgroup label="Decks officiels & Starters">
                    <option v-for="d in ALL_OFFICIAL_DECKS" :key="'2v2-off-b1-' + d.id" :value="'official-' + d.id">
                      {{ d.name }}
                    </option>
                  </optgroup>
                </select>
              </label>

              <label class="flex flex-col gap-1 text-sm">
                <span class="text-base-content/70 font-medium">Joueur 4 (Adversaire 2 - J4)</span>
                <select v-model="team2Deck2Id" class="select select-bordered select-sm w-full bg-base-200" data-testid="2v2-deck-b2">
                  <option :value="null" disabled>Choisis un deck…</option>
                  <optgroup v-if="decks.length" label="Mes decks">
                    <option v-for="d in decks" :key="'2v2-b2-' + d.id" :value="d.id">
                      {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                    </option>
                  </optgroup>
                  <optgroup label="Decks officiels & Starters">
                    <option v-for="d in ALL_OFFICIAL_DECKS" :key="'2v2-off-b2-' + d.id" :value="'official-' + d.id">
                      {{ d.name }}
                    </option>
                  </optgroup>
                </select>
              </label>
            </div>
            <div v-if="team2DeckErrors.length > 0" class="text-xs text-warning space-y-1">
              <p v-for="(err, idx) in team2DeckErrors" :key="idx">⚠️ {{ err }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <button
            class="btn btn-info btn-sm"
            :disabled="!canStart2v2 || !cardStore.cards.length"
            data-testid="two-vs-two-start-btn"
            @click="start2v2Game"
          >
            👥 Lancer l'entraînement 2v2
          </button>
          <span class="text-xs text-base-content/50">
            Contrôle total des 4 joueurs en local · 36 XP d'équipe pour la victoire
          </span>
        </div>
      </div>
    </section>

    <!-- ═══════════ Mode Entraînement Solo (Sandbox / Hot-seat) ═══════════ -->
    <div class="h-px w-full bg-base-content/20"></div>

    <section
      class="border border-accent/40 bg-accent/[0.04] p-5"
      data-testid="sandbox-section"
    >
      <div>
        <p class="eyebrow text-accent">Mode Entraînement Solo</p>
        <h2 class="mt-1 font-display text-xl sm:text-2xl font-semibold">Bac à sable & Hot-seat</h2>
        <p class="mt-1 text-sm text-base-content/70">
          Prends le contrôle total des deux joueurs sur cette machine pour tester des decks, combos et stratégies.
          Les règles sont appliquées automatiquement et tu peux basculer la vue entre les deux joueurs à tout moment.
        </p>
      </div>

      <div class="mt-4 space-y-4">
        <div class="flex flex-wrap items-start gap-4">
          <!-- Nom Joueur 1 -->
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-base-content/70">Nom Joueur 1</span>
            <input
              v-model="sandboxPlayer1Name"
              type="text"
              class="input input-bordered input-sm w-64 bg-base-200"
              placeholder="Ex: Mon pseudo"
              maxlength="30"
              data-testid="sandbox-name-1"
            />
          </label>
          <!-- Nom Joueur 2 -->
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-base-content/70">Nom Joueur 2 (Adversaire)</span>
            <input
              v-model="sandboxPlayer2Name"
              type="text"
              class="input input-bordered input-sm w-64 bg-base-200"
              placeholder="Ex: Adversaire"
              maxlength="30"
              data-testid="sandbox-name-2"
            />
          </label>
        </div>

        <div class="flex flex-wrap items-start gap-4">
          <!-- Deck Joueur 1 -->
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-base-content/70">Deck Joueur 1</span>
            <select
              v-model="sandboxDeck1Id"
              class="select select-bordered select-sm w-64 bg-base-200"
              data-testid="sandbox-deck-1"
            >
              <option :value="null" disabled>Choisis un deck…</option>
              <optgroup v-if="decks.length" label="Mes decks">
                <option v-for="d in decks" :key="'my1-' + d.id" :value="d.id">
                  {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                </option>
              </optgroup>
              <optgroup label="Decks officiels & Starters">
                <option
                  v-for="d in ALL_OFFICIAL_DECKS"
                  :key="'off1-' + d.id"
                  :value="'official-' + d.id"
                >
                  {{ d.name }}
                </option>
              </optgroup>
            </select>
            <span v-if="sandboxDeck1Id && !sandboxDeck1Valid" class="text-xs text-warning">
              {{ sandboxDeck1Errors[0] ?? "Deck indisponible ou incomplet" }}
            </span>
          </label>

          <!-- Deck Joueur 2 -->
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-base-content/70">Deck Adversaire (Joueur 2)</span>
            <select
              v-model="sandboxDeck2Id"
              class="select select-bordered select-sm w-64 bg-base-200"
              data-testid="sandbox-deck-2"
            >
              <option :value="null" disabled>Choisis un deck…</option>
              <optgroup v-if="decks.length" label="Mes decks">
                <option v-for="d in decks" :key="'my2-' + d.id" :value="d.id">
                  {{ d.name }}{{ deckIsValid(d) ? "" : " — incomplet" }}
                </option>
              </optgroup>
              <optgroup label="Decks officiels & Starters">
                <option
                  v-for="d in ALL_OFFICIAL_DECKS"
                  :key="'off2-' + d.id"
                  :value="'official-' + d.id"
                >
                  {{ d.name }}
                </option>
              </optgroup>
            </select>
            <span v-if="sandboxDeck2Id && !sandboxDeck2Valid" class="text-xs text-warning">
              {{ sandboxDeck2Errors[0] ?? "Deck indisponible ou incomplet" }}
            </span>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <button
            class="btn btn-accent btn-sm"
            :disabled="!canStartSandbox || !cardStore.cards.length"
            data-testid="sandbox-start-btn"
            @click="startSandboxGame"
          >
            ⚔️ Lancer l'entraînement
          </button>
          <span class="text-xs text-base-content/50">
            Contrôle total des deux joueurs · Règles complètes et alternance des tours
          </span>
        </div>
      </div>
    </section>
  </div>

  <!-- ═══════════ EN MATCH (mulligan / playing) ═══════════ -->
  <div v-else class="gfull">
    <div class="gtopbar">
      <div class="gtopbar__group">
        <span class="gtopbar__title">La Table des Douze</span>
        <span v-if="store.matchPhase === 'playing'" class="gtopbar__turn">
          Tour {{ store.turn.number }} ·
          <template v-if="store.online">
            <span :class="myTurn ? 'gturn--you' : 'gturn--wait'">{{
              myTurn ? "🟢 À toi de jouer" : "⏳ Au tour de l'adversaire"
            }}</span>
          </template>
          <template v-else>{{ store.activeName }}</template>
          · {{ store.phaseLabel }}
        </span>
        <span v-else class="gtopbar__turn">Mise en place</span>
        <span
          v-if="store.online && tabHidden"
          class="gtopbar__turn"
          data-testid="tab-hidden-hint"
        >
          · Onglet en arrière-plan — l'adversaire peut te voir absent
        </span>
      </div>
      <div v-if="store.matchPhase === 'playing'" class="gtopbar__group">
        <button
          class="gtop-btn"
          @click="store.shufflePioche(store.perspective)"
        >
          Mélanger
        </button>
        <button class="gtop-btn" @click="store.undoLast()">Annuler</button>
        <!-- Bascule manuelle de vue (mode local / sandbox) -->
        <button
          v-if="!store.online"
          class="gtop-btn"
          data-testid="topbar-toggle-perspective"
          :title="'Vue actuelle : ' + store.players[store.perspective].name + ' (cliquer pour basculer)'"
          @click="store.togglePerspective()"
        >
          👁️ Vue : {{ store.players[store.perspective].name }}
        </button>
        <!-- Module SOLO starter (vs bot) : TOUJOURS full-assisté — la bascule
             n'a pas de sens là (le bot et les effets exigent les règles) et
             son seul usage serait de se mettre dans un état cassé. Elle reste
             disponible en table libre / hot-seat (sans botSeat). -->
        <label
          v-if="!store.botSeat"
          class="gtop-toggle"
          title="Coûts en Ressources, légalité des coups, combat et victoire automatiques"
        >
          <input
            v-model="store.assist"
            type="checkbox"
            class="gtop-toggle__box"
            data-testid="topbar-assist-toggle"
          />
          Règles assistées
        </label>
        <span
          v-if="
            store.matchPhase === 'playing' &&
            !store.assistEffects &&
            !tutorial.active
          "
          class="gtopbar__turn"
          data-testid="topbar-effects-manual-hint"
        >
          · Effets de carte : à jouer à la main
        </span>
      </div>
      <div class="gtopbar__group">
        <button
          class="gtop-btn"
          :aria-label="sounds.muted.value ? 'Activer le son' : 'Couper le son'"
          :aria-pressed="!sounds.muted.value"
          data-testid="topbar-sound-toggle"
          @click="sounds.toggleMute()"
        >
          {{ sounds.muted.value ? "🔇 Son" : "🔊 Son" }}
        </button>
        <!-- Musique de fond : pistes LOCALES de l'exploitant (public/audio/
             music + manifest.json — cf. README ; rien d'embarqué : les OST
             commerciales ne se redistribuent pas). Bouton visible seulement
             si une playlist est déclarée. -->
        <button
          v-if="music.available.value"
          class="gtop-btn"
          :aria-pressed="music.playing.value"
          data-testid="topbar-music-toggle"
          @click="music.toggle()"
        >
          {{ music.playing.value ? "♫ Musique" : "♪ Musique" }}
        </button>
        <button class="gtop-btn" @click="showJournal = !showJournal">
          {{ showJournal ? "Masquer le journal" : "Journal" }}
        </button>
        <button
          v-if="store.matchPhase === 'playing'"
          class="gtop-btn gtop-btn--quit"
          :class="{ 'gtop-btn--danger': concedeArmed }"
          @click="concedeClick"
        >
          {{ concedeArmed ? "Confirmer l'abandon ?" : "Abandonner" }}
        </button>
        <button class="gtop-btn gtop-btn--quit" @click="store.quitMatch()">
          Quitter
        </button>
      </div>
    </div>

    <!-- Assistant de règles : coach contextuel (quoi faire / pourquoi un refus).
         Visible PARTOUT, y compris en « Apprendre en jouant » : c'est LE guide du
         mode d'apprentissage (plus de coach à étapes forcées). -->
    <RuleAssistant />

    <!-- Sons de table (repères discrets — pioche, pose, combat, fin de partie).
         Sans rendu ; coupable via le bouton « Son » du bandeau. -->
    <GameSoundLayer />

    <!-- Adversaire déconnecté : bandeau de grâce + réclamation de victoire -->
    <div
      v-if="opponentGone"
      class="gdisconnect"
      data-testid="opponent-disconnected"
      role="status"
    >
      <span class="gdisconnect__text">
        Adversaire déconnecté —
        {{
          store.canClaimVictory
            ? "victoire réclamable."
            : "victoire réclamable après un délai de grâce…"
        }}
      </span>
      <button
        v-if="store.canClaimVictory"
        class="gtop-btn gdisconnect__claim"
        data-testid="claim-victory"
        @click="store.claimVictory()"
      >
        Réclamer la victoire
      </button>
    </div>

    <div class="glayout">
      <GameBoard class="glayout__board" />
      <aside v-if="showJournal" class="glayout__journal">
        <ActionLog :lines="store.log" />
        <!-- Chat de table (Cadre) : journalisé (SAID), visible des deux
             joueurs — indispensable pour annoncer les effets joués à la main. -->
        <form
          v-if="store.online"
          class="gchat"
          @submit.prevent="sendChatMessage"
        >
          <input
            v-model="chatText"
            class="gchat__input"
            data-testid="chat-input"
            placeholder="Dire à la table… (effets, annonces)"
            maxlength="300"
          />
          <button class="gchat__send" type="submit" aria-label="Envoyer">
            ➤
          </button>
        </form>
      </aside>
    </div>

    <CardHoverPreview />
    <DragLayer />
    <EffectSpotlight />
    <TurnBanner />
    <ManualEffectReminders />
    <InGameChat v-if="store.matchPhase !== 'lobby'" />

    <!-- Accueil « Apprendre en jouant » : but + fonctionnement, une seule fois au
         démarrage — affiché AU-DESSUS du mulligan, qu'il révèle en se fermant. -->
    <Transition name="ovl">
      <div
        v-if="tutorial.welcomeVisible"
        class="overlay overlay--welcome"
        data-testid="tutorial-welcome"
      >
        <div class="overlay__card overlay__card--wide">
          <p class="eyebrow text-primary">Apprendre en jouant</p>
          <h2 class="mt-2 font-display text-3xl">Une vraie partie, guidée</h2>
          <div class="welcome-body">
            <p>
              <strong>But :</strong> réduire les PV du Héros adverse à 0, ou
              faire monter ton Héros au Niveau 3 (18 XP). Tu joues en bas ; le
              premier joueur est tiré au sort.
            </p>
            <p>
              <strong>Tout est automatisé pour toi</strong> — coûts en
              Ressources, combat, victoire et effets des cartes. Un encart en
              haut du plateau (l'assistant de règles) te dit à tout moment ce
              que tu peux faire et pourquoi un coup est refusé.
            </p>
            <p>
              On commence par ta <strong>main de départ</strong> : garde-la, ou
              refais-la (une carte de moins). Ensuite, à toi de jouer —
              librement.
            </p>
          </div>
          <button
            class="btn btn-primary mt-6"
            data-testid="tutorial-welcome-start"
            @click="tutorial.dismissWelcome()"
          >
            Commencer
          </button>
        </div>
      </div>
    </Transition>

    <!-- En ligne : attente de l'adversaire (hôte) -->
    <Transition name="ovl">
      <div v-if="onlineWaiting" class="overlay">
        <div class="overlay__card">
          <p class="eyebrow text-primary">Partie en ligne</p>
          <h2 class="mt-2 font-display text-2xl">
            En attente de l'adversaire…
          </h2>
          <p v-if="createdCode" class="mt-4 text-sm text-base-content/70">
            Partage ce code de salon :
          </p>
          <p
            v-if="createdCode"
            class="mt-2 font-mono text-4xl tracking-[0.3em] text-primary"
          >
            {{ createdCode }}
          </p>
          <button
            class="btn btn-ghost btn-sm mt-6"
            @click="store.disconnectOnline()"
          >
            Annuler
          </button>
        </div>
      </div>
    </Transition>

    <!-- Écran de passation -->
    <Transition name="ovl">
      <div v-if="store.passPending" class="overlay">
        <div class="overlay__card">
          <p class="eyebrow text-primary">
            {{ botTurn ? "Tour adverse" : "Passe l'appareil" }}
          </p>
          <img
            v-if="perspectivePortrait"
            :src="perspectivePortrait"
            alt=""
            aria-hidden="true"
            class="overlay__portrait"
          />
          <h2 class="mt-3 font-display text-4xl">
            {{ store.players[store.perspective].name }}
          </h2>
          <p class="mt-3 text-base-content/70">
            {{
              botTurn
                ? "L'adversaire joue son tour…"
                : store.matchPhase === "mulligan"
                  ? "À toi de garder ou refaire ta main de départ."
                  : "C'est ton tour. Les autres, ne regardez pas !"
            }}
          </p>
          <button
            v-if="!botTurn"
            class="btn btn-primary mt-6"
            data-testid="passation-reveal"
            @click="store.reveal()"
          >
            Je suis prêt — afficher
          </button>
        </div>
      </div>
    </Transition>

    <!-- Effet optionnel (« vous pouvez… ») -->
    <Transition name="ovl">
      <div v-if="store.effectChoice" class="overlay">
        <div class="overlay__card">
          <p class="eyebrow text-primary">
            {{ store.effectChoice.optionLabels ? "Choix" : "Effet optionnel" }}
          </p>
          <h2 class="mt-2 font-display text-3xl">
            {{ store.effectChoice.cardName }}
          </h2>
          <p class="mt-3 max-w-md text-base-content/75">
            « {{ store.effectChoice.text }} »
          </p>
          <!-- CHOIX EXCLUSIF « A ou B » : deux boutons étiquetés (bouton 0 →
               resolve(true), bouton 1 → resolve(false)). -->
          <!-- CHOIX À N BRANCHES (chooseOne, N > 2 — ex. choix d'Élément) :
               un bouton par branche, choix obligatoire. -->
          <div
            v-if="store.effectChoice.options"
            class="mt-6 flex flex-wrap justify-center gap-3"
          >
            <button
              v-for="(opt, i) in store.effectChoice.options"
              :key="opt.label"
              class="btn btn-primary"
              @click="store.effectChoiceSelect(i)"
            >
              {{ opt.label }}
            </button>
          </div>
          <div
            v-else-if="store.effectChoice.optionLabels"
            class="mt-6 flex justify-center gap-3"
          >
            <button
              class="btn btn-primary"
              @click="store.effectChoiceResolve(true)"
            >
              {{ store.effectChoice.optionLabels[0] }}
            </button>
            <button
              class="btn btn-primary btn-outline"
              @click="store.effectChoiceResolve(false)"
            >
              {{ store.effectChoice.optionLabels[1] }}
            </button>
          </div>
          <!-- Effet OPTIONNEL « vous pouvez … » : Appliquer / Décliner. -->
          <div v-else class="mt-6 flex justify-center gap-3">
            <button
              class="btn btn-primary"
              @click="store.effectChoiceResolve(true)"
            >
              Appliquer l'effet
            </button>
            <button
              class="btn btn-outline"
              @click="store.effectChoiceResolve(false)"
            >
              {{
                store.effectChoice.declineDestroysSelf
                  ? "Refuser (la carte est détruite)"
                  : "Décliner"
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Choix de carte dans une pile (recycler / défausser) -->
    <Transition name="ovl">
      <div v-if="store.effectPicking" class="overlay">
        <div class="overlay__card overlay__card--wide">
          <p class="eyebrow text-primary">
            {{
              store.effectPicking.action === "recycle"
                ? "Recycler — la carte ira sous ta Pioche"
                : store.effectPicking.action === "discard"
                  ? "Défausser une carte de ta main"
                  : store.effectPicking.action === "toHand"
                    ? `Cherche ${pickFilterLabel} dans ta Pioche — vers ta main`
                    : `Cherche ${pickFilterLabel} dans ta Pioche — mise en jeu`
            }}
          </p>
          <h2 class="mt-1 font-display text-3xl">
            {{ store.effectPicking.cardName }}
          </h2>
          <div class="pick-grid">
            <button
              v-for="id in store.effectPickIds"
              :key="id"
              type="button"
              class="pick-card"
              @click="store.effectPick(id)"
            >
              <GameCard
                :instance="store.state.instances[id]"
                :card="resolveCard(store.state.instances[id]?.cardId ?? null)"
              />
            </button>
          </div>
          <button
            v-if="!store.effectPicking.mandatory"
            class="btn btn-outline mt-5"
            @click="store.effectPickSkip()"
          >
            Passer
          </button>
        </div>
      </div>
    </Transition>

    <!-- Tirage au sort ANIMÉ : qui commence ? (cosmétique, ~3 s, au-dessus du
         mulligan qu'il révèle en disparaissant). -->
    <Transition name="ovl">
      <div
        v-if="diceVisible"
        class="overlay overlay--dice"
        data-testid="dice-roll"
      >
        <div class="overlay__card dice-box">
          <p class="eyebrow text-primary">Tirage au sort — qui commence ?</p>
          <div
            class="die"
            :class="diceSettled ? 'die--settled' : 'die--rolling'"
            aria-hidden="true"
          >
            <span v-for="i in 9" :key="i" class="die__cell">
              <span v-if="dicePips.includes(i - 1)" class="die__pip"></span>
            </span>
          </div>
          <p v-if="diceSettled" class="dice-result" data-testid="dice-result">
            {{ diceIStart ? "🟢 Tu commences !" : "⏳ L'adversaire commence" }}
          </p>
          <p v-else class="dice-hint">Lancer du dé…</p>
        </div>
      </div>
    </Transition>

    <!-- Mulligan -->
    <Transition name="ovl">
      <div v-if="mulliganDecisionVisible" class="overlay overlay--mulligan">
        <div class="overlay__card overlay__card--wide">
          <p class="eyebrow text-primary">
            Main de départ — {{ store.players[store.perspective]?.name ?? String(store.perspective) }}
          </p>
          <h2 class="mt-1 font-display text-3xl">Gardes-tu cette main ?</h2>
          <p v-if="store.online" class="mt-1 text-sm text-base-content/60">
            🎲 Le tirage au sort du premier joueur a lieu après le choix des
            mains.
          </p>
          <div class="mulligan-fan">
            <HandFan mine :items="mulliganItems" :resolve-card="resolveCard" />
          </div>
          <div class="mt-5 flex flex-wrap justify-center gap-3">
            <button
              class="btn btn-primary"
              data-testid="mulligan-keep"
              @click="onMulliganKeep"
            >
              Garder ({{ mulliganHand.length }} cartes)
            </button>
            <button
              class="btn btn-outline"
              :disabled="mulliganHand.length === 0"
              @click="onMulliganReplace"
            >
              <template v-if="store.mulliganCount(store.perspective) === 0">
                Mulligan gratuit (re-piocher {{ mulliganHand.length }})
              </template>
              <template v-else>
                Mulligan (re-piocher {{ Math.max(0, mulliganHand.length - 1) }})
              </template>
            </button>
          </div>
          <p class="mt-3 text-xs text-base-content/50">
            Règle Wakfu : 1er mulligan gratuit (6 cartes), puis une carte de moins à chaque fois.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Mulligan en ligne : ma décision est prise, j'attends l'adversaire -->
    <Transition name="ovl">
      <div v-if="mulliganWaiting" class="overlay">
        <div class="overlay__card">
          <p class="eyebrow text-primary">Mulligan</p>
          <h2 class="mt-2 font-display text-3xl">
            En attente de l'adversaire…
          </h2>
          <p class="mt-3 text-sm text-base-content/60">
            Ta main est validée. La partie démarre dès que l'adversaire a
            décidé.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Fin de partie : animation plein écran Victoire / Défaite -->
    <VictoryDefeatOverlay />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card, Deck } from "@/types/cards";
import type { RedactedInstance, DraftEvent, Seat } from "@/game";
import { getThumbPath } from "@/utils/imagePaths";
import GameBoard from "@/components/game/GameBoard.vue";
import GameCard from "@/components/game/GameCard.vue";
import HandFan from "@/components/game/HandFan.vue";
import type { HandItem } from "@/components/game/HandFan.vue";
import ActionLog from "@/components/game/ActionLog.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";
import DragLayer from "@/components/game/DragLayer.vue";
import EffectSpotlight from "@/components/game/EffectSpotlight.vue";
import TurnBanner from "@/components/game/TurnBanner.vue";
import VictoryDefeatOverlay from "@/components/game/VictoryDefeatOverlay.vue";
import RuleAssistant from "@/components/game/RuleAssistant.vue";
import GameSoundLayer from "@/components/game/GameSoundLayer.vue";
import { useGameSounds } from "@/composables/useGameSounds";
import { useGameMusic } from "@/composables/useGameMusic";
import ManualEffectReminders from "@/components/game/ManualEffectReminders.vue";
import InGameChat from "@/components/game/InGameChat.vue";
import { useTutorialStore } from "@/stores/tutorialStore";
import { OFFICIAL_DECKS } from "@/data/officialDecks";
import { ALL_OFFICIAL_DECKS } from "@/data/allOfficialDecks";
import { buildOfficialDeck } from "@/composables/useOfficialDeckImport";
import { useBotOpponent } from "@/composables/useBotOpponent";
import { validateDeck } from "@/validators/deck";
import { validateTeamDecks } from "@/validators/teamDeck";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/authStore";
import {
  createGame as createOnlineGame,
  joinGame,
  findGameByCode,
  submitEvent,
  submitIntent,
  requestMulligan,
  subscribeToGame,
  pullEvents,
  findMyActiveGame,
  concede as concedeOnline,
  claimVictory as claimVictoryOnline,
  subscribeTo2v2Lobby,
  create2v2OnlineTransport,
  type Lobby2v2State,
  type Lobby2v2Slot,
  type Seat2v2,
} from "@/services/gameClient";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const store = useGameStore();
const tutorial = useTutorialStore();
// Sons de table : état muet (bouton du bandeau) — le calque GameSoundLayer
// joue les repères, ici on n'expose que la bascule.
const sounds = useGameSounds();
// Musique de fond (pistes locales de l'exploitant, cf. useGameMusic).
const music = useGameMusic();
// Démarrage AUTO au premier geste (politique d'autoplay : impossible avant
// une interaction). ON PAR DÉFAUT dès qu'une playlist existe — seule une
// coupure explicite au bouton la désactive. resumeIfWanted ATTEND le
// manifeste (le premier clic peut précéder le fetch).
onMounted(() => {
  const once = () => {
    // La musique n'accompagne QUE le match : au lobby, on n'arme rien.
    if (store.matchPhase !== "lobby") void music.resumeIfWanted();
    window.removeEventListener("pointerdown", once);
  };
  window.addEventListener("pointerdown", once);
});
// La musique est BORNÉE À LA PARTIE (bug rapporté : « quand on quitte la
// partie, la musique reste ») : retour au lobby → pause contextuelle (sans
// toucher la préférence) ; entrée en match → reprise (l'événement vient d'un
// clic → l'activation utilisateur couvre le play()).
watch(
  () => store.matchPhase,
  (now, prev) => {
    if (now === "lobby") music.pause();
    else if (prev === "lobby") void music.resumeIfWanted();
  },
);
onUnmounted(() => music.pause());
const route = useRoute();

const toast = useToast();
// Deep-link `?tutorial=1` : lance « Apprendre en jouant » avec deux starters par
// défaut (le joueur pourra rejouer avec le deck de son choix via le lobby).
function startTutorial(): void {
  const mine = starterToDeck(INCARNAM_STARTERS[0]?.id ?? "");
  const opp = starterToDeck(INCARNAM_STARTERS[1]?.id ?? "");
  if (!mine || !opp) {
    toast.addToast(
      "Impossible de préparer le tutoriel (cartes indisponibles).",
      { type: "warning" },
    );
    return;
  }
  tutorial.startGuidedGame(mine, opp);
}

// ── Abandon (confirmation en deux temps) ─────────────────────────────────────
const concedeArmed = ref(false);
let concedeTimer: ReturnType<typeof setTimeout> | null = null;
function concedeClick(): void {
  if (!concedeArmed.value) {
    concedeArmed.value = true;
    if (concedeTimer) clearTimeout(concedeTimer);
    concedeTimer = setTimeout(() => {
      concedeArmed.value = false;
      concedeTimer = null;
    }, 3000);
    return;
  }
  if (concedeTimer) clearTimeout(concedeTimer);
  concedeArmed.value = false;
  store.concede(store.perspective);
}

const decks = computed<Deck[]>(() => deckStore.decks ?? []);

// ── Jouer contre l'ordinateur (mode LOCAL vs IA heuristique) ─────────────────
const INCARNAM_STARTERS = OFFICIAL_DECKS.filter(
  (d) => d.extension === "incarnam",
);
// Decks jouables : uniquement les starters Incarnam (les seuls dont TOUS les
// effets sont automatisés) — valeur = id du deck officiel. « Apprendre en jouant »
// tient ainsi sa promesse « tout est résolu pour toi » (cf. assistEffects=true).
const botMyDeckId = ref<string>(INCARNAM_STARTERS[0]?.id ?? "");
const botOppDeckId = ref<string>(INCARNAM_STARTERS[1]?.id ?? "");
function resolveCardByName(name: string): Card | null {
  return cardStore.cards.find((c) => c.name === name) ?? null;
}
function starterToDeck(id: string): Deck | null {
  const od = INCARNAM_STARTERS.find((d) => d.id === id);
  if (!od) return null;
  const b = buildOfficialDeck(od, resolveCardByName);
  if (b.heroMissing || b.havreMissing || b.missing.length) return null;
  return {
    id: "vsbot-" + od.id,
    name: od.name,
    hero: b.heroCard,
    havreSac: b.havreSacCard,
    cards: b.deckCards.map((dc) => ({ card: dc.card, quantity: dc.quantity })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
function resolveMyBotDeck(): Deck | null {
  return starterToDeck(botMyDeckId.value);
}
function startVsBot(): void {
  const mine = resolveMyBotDeck();
  const opp = starterToDeck(botOppDeckId.value);
  if (!mine || !opp) {
    toast.addToast("Deck indisponible (cartes non chargées ?).", {
      type: "warning",
    });
    return;
  }
  // « Apprendre en jouant » : partie complète guidée-puis-libre vs l'IA (mulligan,
  // règles assistées, bot doux pendant l'intro). startGuidedGame pose botSeat.
  tutorial.startGuidedGame(mine, opp);
  // Module SOLO starter : TOUJOURS full-assisté (la bascule est masquée là —
  // on force les deux drapeaux au cas où une table libre les aurait éteints).
  store.assist = true;
  store.assistEffects = true;
}

// ── Mode Entraînement Solo (Sandbox / Hot-seat) ──────────────────────────────
const sandboxDeck1Id = ref<string | null>(null);
const sandboxDeck2Id = ref<string | null>(null);

function resolveAnyDeckById(id: string | null): Deck | null {
  if (!id) return null;
  if (id.startsWith("official-")) {
    const officialId = id.replace("official-", "");
    const od = ALL_OFFICIAL_DECKS.find((d) => d.id === officialId);
    if (!od) return null;
    const b = buildOfficialDeck(od, resolveCardByName);
    if (b.heroMissing || b.havreMissing || b.missing.length) return null;
    return {
      id: "sandbox-" + od.id,
      name: od.name,
      hero: b.heroCard,
      havreSac: b.havreSacCard,
      cards: b.deckCards.map((dc) => ({ card: dc.card, quantity: dc.quantity })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return decks.value.find((d) => d.id === id) ?? null;
}

const sandboxDeck1 = computed(() => resolveAnyDeckById(sandboxDeck1Id.value));
const sandboxDeck2 = computed(() => resolveAnyDeckById(sandboxDeck2Id.value));

const sandboxDeck1Errors = computed(() =>
  sandboxDeck1.value ? validateDeck(sandboxDeck1.value).errors : [],
);
const sandboxDeck2Errors = computed(() =>
  sandboxDeck2.value ? validateDeck(sandboxDeck2.value).errors : [],
);

const sandboxDeck1Valid = computed(
  () => !!sandboxDeck1.value && sandboxDeck1Errors.value.length === 0,
);
const sandboxDeck2Valid = computed(
  () => !!sandboxDeck2.value && sandboxDeck2Errors.value.length === 0,
);

const canStartSandbox = computed(
  () => sandboxDeck1Valid.value && sandboxDeck2Valid.value,
);

watch(
  [decks, () => cardStore.cards.length],
  () => {
    if (!sandboxDeck1Id.value) {
      sandboxDeck1Id.value =
        decks.value.find((d) => deckIsValid(d))?.id ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
    if (!sandboxDeck2Id.value) {
      sandboxDeck2Id.value =
        (decks.value.length > 1 ? decks.value[1]?.id : null) ??
        (INCARNAM_STARTERS[1] ? `official-${INCARNAM_STARTERS[1].id}` : null) ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
  },
  { immediate: true },
);

const sandboxPlayer1Name = ref("");
const sandboxPlayer2Name = ref("");

function startSandboxGame(): void {
  const d1 = sandboxDeck1.value;
  const d2 = sandboxDeck2.value;
  if (!d1 || !d2 || !canStartSandbox.value) return;
  const user = authStore.user;
  const defaultP1 =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    d1.name ||
    "Joueur 1";
  const p1 = sandboxPlayer1Name.value.trim() || defaultP1;
  const p2 = sandboxPlayer2Name.value.trim() || d2.name || "Joueur 2";
  store.startMatch(d1, d2, {
    isSandbox: true,
    nameA: p1,
    nameB: p2,
  });
  store.assist = true;
  store.assistEffects = true;
}

// ── Mode 2v2 Multijoueur en équipe (En Ligne & Local) ────────────────────────
const online2v2Tab = ref<"online" | "sandbox">("online");
const online2v2DeckId = ref<string | null>(null);
const online2v2JoinCode = ref("");
const online2v2Error = ref("");
const active2v2Lobby = ref<Lobby2v2State | null>(null);
const my2v2Seat = ref<Seat2v2>("A1");

const online2v2Deck = computed(
  () => decks.value.find((d) => d.id === online2v2DeckId.value) ?? null,
);
const online2v2DeckValid = computed(
  () => !!online2v2Deck.value && deckIsValid(online2v2Deck.value),
);

let lobby2v2Handle: ReturnType<typeof subscribeTo2v2Lobby> | null = null;

function generate2v2Code(): string {
  return "2V2-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function create2v2OnlineLobby(): void {
  const d = online2v2Deck.value;
  if (!d || !online2v2DeckValid.value) {
    online2v2Error.value = "Choisis un deck valide pour créer le salon.";
    return;
  }
  online2v2Error.value = "";
  const code = generate2v2Code();
  my2v2Seat.value = "A1";
  const user = authStore.user;
  const userName = user?.email?.split("@")[0] || "Joueur 1 (Hôte)";

  const initialLobby: Lobby2v2State = {
    code,
    hostSeat: "A1",
    slots: {
      A1: { userId: user?.id, userName, deck: d, ready: true },
      A2: null,
      B1: null,
      B2: null,
    },
    status: "waiting",
  };
  active2v2Lobby.value = initialLobby;

  lobby2v2Handle?.unsubscribe();
  lobby2v2Handle = subscribeTo2v2Lobby(code, "A1", {
    onUpdate: (updatedState) => {
      // Préserver A1 si perdu
      if (
        updatedState.slots &&
        !updatedState.slots.A1 &&
        active2v2Lobby.value?.slots.A1
      ) {
        updatedState.slots.A1 = active2v2Lobby.value.slots.A1;
      }
      active2v2Lobby.value = updatedState;
    },
    onClaimSlot: (seat, slot) => {
      if (!active2v2Lobby.value) return;
      const nextSlots = { ...active2v2Lobby.value.slots };
      // Retirer l'ancien slot du joueur s'il change de place
      for (const s of ["A1", "A2", "B1", "B2"] as Seat2v2[]) {
        if (nextSlots[s]?.userId && nextSlots[s]?.userId === slot.userId) {
          nextSlots[s] = null;
        }
      }
      nextSlots[seat] = slot;
      const nextState: Lobby2v2State = {
        ...active2v2Lobby.value,
        slots: nextSlots,
      };
      active2v2Lobby.value = nextState;
      lobby2v2Handle?.broadcastUpdate(nextState);
    },
    onRequestSync: () => {
      if (active2v2Lobby.value) {
        lobby2v2Handle?.broadcastUpdate(active2v2Lobby.value);
      }
    },
    onStart: (gameId, finalState, initialEvents) => {
      start2v2OnlineMatch(
        gameId,
        "A1",
        finalState,
        initialEvents as DraftEvent[] | undefined,
      );
    },
  });

  setTimeout(() => {
    if (active2v2Lobby.value) {
      lobby2v2Handle?.broadcastUpdate(active2v2Lobby.value);
    }
  }, 100);
}

function join2v2OnlineLobby(): void {
  const code = online2v2JoinCode.value.trim().toUpperCase();
  const d = online2v2Deck.value;
  if (!code) {
    online2v2Error.value = "Saisis un code de salon 2v2 valide.";
    return;
  }
  if (!d || !online2v2DeckValid.value) {
    online2v2Error.value = "Choisis un deck valide pour rejoindre le salon.";
    return;
  }
  online2v2Error.value = "";
  const user = authStore.user;
  const userName = user?.email?.split("@")[0] || "Joueur";

  let assignedSeat: Seat2v2 = "A2";

  lobby2v2Handle?.unsubscribe();
  lobby2v2Handle = subscribeTo2v2Lobby(code, assignedSeat, {
    onUpdate: (updatedState) => {
      active2v2Lobby.value = updatedState;
    },
    onClaimSlot: (seat, slot) => {
      if (!active2v2Lobby.value) return;
      active2v2Lobby.value = {
        ...active2v2Lobby.value,
        slots: {
          ...active2v2Lobby.value.slots,
          [seat]: slot,
        },
      };
    },
    onStart: (gameId, finalState, initialEvents) => {
      start2v2OnlineMatch(
        gameId,
        my2v2Seat.value,
        finalState,
        initialEvents as DraftEvent[] | undefined,
      );
    },
  });

  setTimeout(() => {
    const current = active2v2Lobby.value;
    if (current) {
      if (!current.slots.A2) assignedSeat = "A2";
      else if (!current.slots.B1) assignedSeat = "B1";
      else if (!current.slots.B2) assignedSeat = "B2";
    }
    my2v2Seat.value = assignedSeat;
    const slotData: Lobby2v2Slot = {
      userId: user?.id,
      userName,
      deck: d,
      ready: true,
    };
    lobby2v2Handle?.broadcastClaimSlot(assignedSeat, slotData);
  }, 250);
}

function select2v2Slot(seat: Seat2v2): void {
  if (!active2v2Lobby.value || !lobby2v2Handle) return;
  const d = online2v2Deck.value;
  const user = authStore.user;
  const userName = user?.email?.split("@")[0] || "Joueur";
  my2v2Seat.value = seat;

  const slotData: Lobby2v2Slot = {
    userId: user?.id,
    userName,
    deck: d,
    ready: true,
  };
  lobby2v2Handle.broadcastClaimSlot(seat, slotData);
}

function toggle2v2Ready(): void {
  if (!active2v2Lobby.value || !lobby2v2Handle) return;
  const seat = my2v2Seat.value;
  const slot = active2v2Lobby.value.slots[seat];
  if (!slot) return;
  const updatedSlot: Lobby2v2Slot = {
    ...slot,
    ready: !slot.ready,
  };
  lobby2v2Handle.broadcastClaimSlot(seat, updatedSlot);
}

function leave2v2Lobby(): void {
  lobby2v2Handle?.unsubscribe();
  lobby2v2Handle = null;
  active2v2Lobby.value = null;
}

const team1OnlineErrors = computed(() => {
  const s = active2v2Lobby.value?.slots;
  if (!s?.A1?.deck || !s?.A2?.deck) return [];
  try {
    const val = validateTeamDecks(s.A1.deck as Deck, s.A2.deck as Deck);
    return val.isValid ? [] : val.errors;
  } catch {
    return [];
  }
});

const team2OnlineErrors = computed(() => {
  const s = active2v2Lobby.value?.slots;
  if (!s?.B1?.deck || !s?.B2?.deck) return [];
  try {
    const val = validateTeamDecks(s.B1.deck as Deck, s.B2.deck as Deck);
    return val.isValid ? [] : val.errors;
  } catch {
    return [];
  }
});

const canHostStart2v2Online = computed(() => {
  const l = active2v2Lobby.value;
  if (!l) return false;
  const s = l.slots;
  const allFourPresent = !!s.A1 && !!s.A2 && !!s.B1 && !!s.B2;
  const allReady =
    (s.A1?.ready ?? false) &&
    (s.A2?.ready ?? false) &&
    (s.B1?.ready ?? false) &&
    (s.B2?.ready ?? false);
  return (
    allFourPresent &&
    allReady &&
    team1OnlineErrors.value.length === 0 &&
    team2OnlineErrors.value.length === 0
  );
});

let starting2v2Match = false;

function launch2v2OnlineGame(): void {
  if (!canHostStart2v2Online.value || !active2v2Lobby.value || !lobby2v2Handle) return;
  const gameId = "game-2v2-" + Math.random().toString(36).substring(2, 9);
  lobby2v2Handle.broadcastStart(gameId, active2v2Lobby.value);
}

function start2v2OnlineMatch(
  gameId: string,
  seat: Seat2v2,
  lobbyState: Lobby2v2State,
  _initialEvents?: DraftEvent[],
): void {
  if (starting2v2Match) return;
  starting2v2Match = true;
  const l = lobbyState;
  const dA1 = (l.slots.A1?.deck as Deck) ?? online2v2Deck.value!;
  const dA2 = (l.slots.A2?.deck as Deck) ?? dA1;
  const dB1 = (l.slots.B1?.deck as Deck) ?? dA1;
  const dB2 = (l.slots.B2?.deck as Deck) ?? dB1;
  const myDeck = (l.slots[seat]?.deck as Deck) ?? online2v2Deck.value;

  store.startMatch(dA1, dB1, {
    mode: "2v2",
    first: "A1",
    deckA2: dA2,
    deckB2: dB2,
    decks: { A1: dA1, B1: dB1, A2: dA2, B2: dB2 },
    names: {
      A1: l.slots.A1?.userName || "Joueur 1 (Équipe 1)",
      B1: l.slots.B1?.userName || "Joueur 2 (Équipe 2)",
      A2: l.slots.A2?.userName || "Joueur 3 (Équipe 1)",
      B2: l.slots.B2?.userName || "Joueur 4 (Équipe 2)",
    },
  });

  const initialEvents = [...store.events];

  const transport = create2v2OnlineTransport(
    l.code,
    seat,
    () => store.lastSeq(),
  );

  store.connectOnline(gameId, seat, transport, myDeck);
  store.perspective = seat;
  store.events = initialEvents;
  store.mulliganDone = { A1: false, B1: false, A2: false, B2: false };
  store.matchPhase = "mulligan";
  starting2v2Match = false;
}

// ── Decks pour le Mode 2v2 Local ────────────────────────────────────────────
const team1Deck1Id = ref<string | null>(null);
const team1Deck2Id = ref<string | null>(null);
const team2Deck1Id = ref<string | null>(null);
const team2Deck2Id = ref<string | null>(null);

const team1Deck1 = computed(() => resolveAnyDeckById(team1Deck1Id.value));
const team1Deck2 = computed(() => resolveAnyDeckById(team1Deck2Id.value));
const team2Deck1 = computed(() => resolveAnyDeckById(team2Deck1Id.value));
const team2Deck2 = computed(() => resolveAnyDeckById(team2Deck2Id.value));

const team1DeckErrors = computed(() => {
  const d1 = team1Deck1.value;
  const d2 = team1Deck2.value;
  if (!d1 || !d2) return [];
  const errors: string[] = [];
  const valTeam = validateTeamDecks(d1, d2);
  if (!valTeam.isValid) {
    errors.push(...valTeam.errors);
  }
  return errors;
});

const team2DeckErrors = computed(() => {
  const d1 = team2Deck1.value;
  const d2 = team2Deck2.value;
  if (!d1 || !d2) return [];
  const errors: string[] = [];
  const valTeam = validateTeamDecks(d1, d2);
  if (!valTeam.isValid) {
    errors.push(...valTeam.errors);
  }
  return errors;
});

const canStart2v2 = computed(() => {
  return (
    !!team1Deck1.value &&
    !!team1Deck2.value &&
    !!team2Deck1.value &&
    !!team2Deck2.value &&
    team1DeckErrors.value.length === 0 &&
    team2DeckErrors.value.length === 0
  );
});

watch(
  [decks, () => cardStore.cards.length],
  () => {
    if (!online2v2DeckId.value) {
      online2v2DeckId.value =
        decks.value.find((d) => deckIsValid(d))?.id ?? decks.value[0]?.id ?? null;
    }
    if (!team1Deck1Id.value) {
      team1Deck1Id.value =
        decks.value.find((d) => deckIsValid(d))?.id ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
    if (!team1Deck2Id.value) {
      team1Deck2Id.value =
        (decks.value.length > 1 ? decks.value[1]?.id : null) ??
        (INCARNAM_STARTERS[1] ? `official-${INCARNAM_STARTERS[1].id}` : null) ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
    if (!team2Deck1Id.value) {
      team2Deck1Id.value =
        decks.value.find((d) => deckIsValid(d))?.id ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
    if (!team2Deck2Id.value) {
      team2Deck2Id.value =
        (decks.value.length > 1 ? decks.value[1]?.id : null) ??
        (INCARNAM_STARTERS[1] ? `official-${INCARNAM_STARTERS[1].id}` : null) ??
        (INCARNAM_STARTERS[0] ? `official-${INCARNAM_STARTERS[0].id}` : null);
    }
  },
  { immediate: true },
);

function start2v2Game(): void {
  if (!canStart2v2.value) return;
  const dA1 = team1Deck1.value!;
  const dA2 = team1Deck2.value!;
  const dB1 = team2Deck1.value!;
  const dB2 = team2Deck2.value!;

  store.startMatch(dA1, dB1, {
    mode: "2v2",
    first: "A1",
    isSandbox: true,
    deckA2: dA2,
    deckB2: dB2,
    decks: { A1: dA1, B1: dB1, A2: dA2, B2: dB2 },
    names: {
      A1: `${dA1.name || "Joueur 1"} (Équipe 1)`,
      B1: `${dB1.name || "Joueur 2"} (Équipe 2)`,
      A2: `${dA2.name || "Joueur 3"} (Équipe 1)`,
      B2: `${dB2.name || "Joueur 4"} (Équipe 2)`,
    },
  });
  store.assist = true;
  store.assistEffects = true;
}
// Driver IA : actif dès que store.botSeat est renseigné (gate interne).
// `hold` : le bot NE JOUE PAS pendant le jet de dé d'entame (l'overlay est
// cosmétique par-dessus un état déjà « playing » — sans la garde, un bot
// premier joueur jouait son tour EN FOND pendant l'animation). Le getter est
// évalué à chaque battement du driver, après l'init du script (pas de TDZ).
const botDriver = useBotOpponent(store, 550, {
  hold: () => false,
});
// Masqué par défaut : le plateau occupe toute la largeur (cartes plus grandes).
// Le joueur ouvre le journal à la demande via le bouton « Journal ».
const showJournal = ref(false);
// Chat de table (Cadre) : SAID journalisé.
const chatText = ref("");
function sendChatMessage(): void {
  store.sendChat(chatText.value);
  chatText.value = "";
}
// Pendant un tutoriel, on force l'ouverture du journal : une étape le met en
// lumière (« tout est tracé dans le journal ») et le débutant le voit se remplir.
watch(
  () => tutorial.active,
  (on) => {
    if (on) showJournal.value = true;
  },
);

// ── Lobby ────────────────────────────────────────────────────────────────────
// ── Jeu en ligne (lobby) ──────────────────────────────────────────────────────
const authStore = useAuthStore();
const onlineTransport = {
  submit: submitEvent,
  submitIntent,
  subscribe: (
    id: string,
    seat: Seat,
    onEvent: (e: any) => void,
    onPresence?: (p: boolean) => void,
    onOpponentTarget?: (t: string | null) => void,
    onPlayerName?: (seat: Seat, name: string) => void,
  ) => {
    const user = authStore.user;
    const myName =
      user?.displayName ||
      user?.email?.split("@")[0] ||
      (seat === "A" ? "Joueur A" : "Joueur B");
    return subscribeToGame(
      id,
      seat,
      onEvent,
      onPresence,
      onOpponentTarget,
      myName,
      onPlayerName,
    );
  },
  pull: pullEvents,
  concede: concedeOnline,
  claimVictory: claimVictoryOnline,
};
// Jeu en ligne (stable). Backend déployé sur Supabase (tables games/game_players
// + Edge Functions create_game/join_game/submit_event) et vérifié de bout en bout
// à 2 clients connectés (création → join → mise en place → diffusion Realtime).
// NB : les effets de cartes NE sont PAS automatisés en ligne (assistEffects reste
// à false) — ils se jouent à la main, ce qui est écrit noir sur blanc dans le lobby.
const ONLINE_PLAY_ENABLED = true;
// Lobby « en ligne uniquement » : Créer et Rejoindre sont affichés ensemble (plus
// de bascule), et le deck est pré-sélectionné (cf. watcher plus bas) pour que
// « Créer la partie » soit cliquable tout de suite.
const onlineDeckId = ref<string | null>(null);
const joinCode = ref("");
const createdCode = ref("");
const onlineBusy = ref(false);
const onlineError = ref("");

// Partie ACTIVE détectée au montage (findMyActiveGame) : on PROPOSE de la
// reprendre ou de l'abandonner, plutôt que de s'y reconnecter d'office.
const resumable = ref<{
  gameId: string;
  seat: Seat;
  assisted: boolean;
} | null>(null);

/** Reprend la partie en cours détectée (reconnexion + reconstruction du plateau). */
function resumeGame(): void {
  const g = resumable.value;
  if (!g) return;
  resumable.value = null;
  const user = authStore.user;
  const myName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    `Joueur ${g.seat}`;
  store.connectOnline(
    g.gameId,
    g.seat,
    onlineTransport,
    onlineDeck.value,
    myName,
  );
}

/** Abandonne la partie en cours détectée (forfait serveur) sans s'y reconnecter. */
async function abandonResumable(): Promise<void> {
  const g = resumable.value;
  if (!g) return;
  resumable.value = null;
  try {
    await concedeOnline(g.gameId);
  } catch {
    /* best-effort : la partie sera de toute façon nettoyée (TTL serveur) */
  }
}

// Deck sélectionné pour le jeu en ligne + sa validité (1 Héros + 1 Havre-Sac +
// 48 cartes, copies, réserve). Le serveur rejette les decks incomplets
// (DECK_INVALIDE) : on bloque AVANT l'appel, avec un message clair.
const onlineDeck = computed(
  () => decks.value.find((d) => d.id === onlineDeckId.value) ?? null,
);
const onlineDeckErrors = computed(() =>
  onlineDeck.value ? validateDeck(onlineDeck.value).errors : [],
);
const onlineDeckValid = computed(
  () => !!onlineDeck.value && onlineDeckErrors.value.length === 0,
);
function deckIsValid(d: Deck): boolean {
  return validateDeck(d).errors.length === 0;
}
// Pré-sélectionne le premier deck VALIDE (sinon le premier, pour faire apparaître
// le motif « incomplet ») dès que les decks sont chargés → « Créer la partie »
// est cliquable d'emblée au lieu de rester grisé sur « Choisis… ».
watch(
  decks,
  (list) => {
    if (onlineDeckId.value && list.some((d) => d.id === onlineDeckId.value))
      return;
    onlineDeckId.value =
      list.find((d) => deckIsValid(d))?.id ?? list[0]?.id ?? null;
  },
  { immediate: true },
);

/** Messages clairs pour les codes d'erreur des Edge Functions de jeu. */
const FN_ERROR_FR: Record<string, string> = {
  DECK_INVALIDE:
    "Ce deck est incomplet : il faut un Héros, un Havre-Sac et 48 cartes.",
  PARTIE_INTROUVABLE: "Partie introuvable (vérifie le code).",
  PARTIE_DEJA_LANCEE: "Cette partie a déjà commencé.",
  DEJA_SIEGE_A:
    "Tu ne peux pas rejoindre ta propre partie (il faut un second compte).",
  UNAUTHENTICATED: "Tu dois être connecté pour jouer en ligne.",
};

/**
 * Extrait le vrai message d'erreur d'une Edge Function. supabase-js emballe les
 * réponses non-2xx dans une FunctionsHttpError dont `.message` est le générique
 * « Edge Function returned a non-2xx status code » ; le corps réel ({ error })
 * est dans `.context` (la Response). On le lit pour afficher la vraie cause
 * (traduite en clair si on connaît le code).
 */
async function fnErrorMessage(e: unknown): Promise<string> {
  const ctx = (e as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: unknown };
      if (typeof body?.error === "string")
        return FN_ERROR_FR[body.error] ?? body.error;
    } catch {
      try {
        const t = await ctx.clone().text();
        if (t) return t;
      } catch {
        /* ignore */
      }
    }
  }
  return (e as { message?: string })?.message ?? String(e);
}

async function onlineCreate(): Promise<void> {
  const deck = onlineDeck.value;
  if (!deck || onlineBusy.value) return;
  if (!onlineDeckValid.value) {
    onlineError.value = `Deck incomplet : ${onlineDeckErrors.value[0] ?? "complète-le pour jouer en ligne."}`;
    return;
  }
  onlineBusy.value = true;
  onlineError.value = "";
  try {
    // CADRE : une seule expérience en ligne — plus de mode assisté à la création.
    const { gameId, code } = await createOnlineGame(deck, false);
    createdCode.value = code;
    const user = authStore.user;
    const myName =
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Joueur A";
    store.connectOnline(gameId, "A", onlineTransport, deck, myName);
  } catch (e) {
    onlineError.value = await fnErrorMessage(e);
  } finally {
    onlineBusy.value = false;
  }
}

async function onlineJoin(): Promise<void> {
  const deck = onlineDeck.value;
  const code = joinCode.value.trim().toUpperCase();
  if (!deck || !code || onlineBusy.value) return;
  if (!onlineDeckValid.value) {
    onlineError.value = `Deck incomplet : ${onlineDeckErrors.value[0] ?? "complète-le pour jouer en ligne."}`;
    return;
  }
  onlineBusy.value = true;
  onlineError.value = "";
  try {
    const g = await findGameByCode(code);
    if (!g) {
      onlineError.value = "Partie introuvable (vérifie le code).";
      return;
    }
    const user = authStore.user;
    const myName =
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Joueur B";
    // s'abonner AVANT join (CADRE : un seul mode en ligne)
    store.connectOnline(g.id, "B", onlineTransport, deck, myName);
    await joinGame(code, deck);
    // joinGame vient de créer GAME_STARTED + mélanges + mains de départ. Le pull
    // de connexion a tourné sur un journal ENCORE VIDE (events créés seulement
    // maintenant) ; on rattrape explicitement pour ne pas dépendre du seul
    // broadcast (course connexion/diffusion qui laissait le joueur « en attente »).
    await store.resyncOnline();
  } catch (e) {
    // connectOnline a déjà basculé en « playing » (overlay d'attente) : on annule
    // pour revenir au lobby et rendre l'erreur visible.
    store.disconnectOnline();
    onlineError.value = await fnErrorMessage(e);
  } finally {
    onlineBusy.value = false;
  }
}

// En ligne : tant que la mise en place (GAME_STARTED) n'est pas arrivée, écran
// d'attente avec le code de salon (l'hôte le partage à l'adversaire).
const onlineWaiting = computed(
  () => store.online && store.state.monde.length === 0,
);

// Adversaire absent en pleine partie : on affiche le bandeau de grâce. Une fois
// `store.canClaimVictory` armé (délai de grâce écoulé), le bouton de
// réclamation apparaît. Le retour de l'adversaire (présence) referme tout.
const opponentGone = computed(
  () =>
    store.online &&
    store.matchPhase === "playing" &&
    store.opponentPresent === false,
);

// À qui de jouer (en ligne, vue figée sur SON siège) : sert au bandeau de tour
// et à griser la main quand ce n'est pas à toi.
const myTurn = computed(
  () =>
    store.matchPhase === "playing" && store.turn.active === store.perspective,
);

// ── Main de mulligan ─────────────────────────────────────────────────────────
const cardIndex = computed(() => {
  const m = new Map<string, Card>();
  for (const c of cardStore.cards) m.set(c.id, c);
  return m;
});
function resolveCard(cardId: string | null): Card | null {
  return cardId ? (cardIndex.value.get(cardId) ?? null) : null;
}
const mulliganHand = computed<RedactedInstance[]>(() => {
  const s = store.view?.seats?.[store.perspective];
  if (!s) return [];
  const z = s.main;
  return z?.kind === "full" ? z.instances : [];
});
const mulliganItems = computed<HandItem[]>(() =>
  mulliganHand.value.map((inst) => ({ key: inst.instanceId, inst })),
);

// ── Mulligan en ligne : décision indépendante par siège (pas de passation) ─────
const myMulliganDone = computed(
  () => store.online && (store.mulliganDone?.[store.mySeat] ?? false),
);
const oppMulliganDone = computed(() => {
  if (!store.online) return false;
  const p = store.mySeat;
  if (p === "A" || p === "B") {
    return store.mulliganDone?.[p === "A" ? "B" : "A"] ?? false;
  }
  const seats: Seat[] = ["A1", "B1", "A2", "B2"];
  const otherSeats = seats.filter((s) => s !== p);
  return otherSeats.every((s) => store.mulliganDone?.[s]);
});
/** Overlay de décision : en ligne tant que MON siège n'a pas tranché ; en local
 *  hors écran de passation. */
const mulliganDecisionVisible = computed(
  () =>
    store.matchPhase === "mulligan" &&
    (store.online ? !myMulliganDone.value : !store.passPending),
);
/** En ligne : j'ai tranché, j'attends l'adversaire. */
const mulliganWaiting = computed(
  () =>
    store.online &&
    store.matchPhase === "mulligan" &&
    myMulliganDone.value &&
    !oppMulliganDone.value,
);
async function onMulliganKeep(): Promise<void> {
  if (store.online && store.mode !== "2v2") {
    const seat = store.mySeat;
    await submitEvent(store.gameId(), {
      actor: seat,
      type: "MULLIGAN_DONE",
      payload: { seat },
    } as unknown as DraftEvent);
  } else {
    store.keepHand();
  }
}
async function onMulliganReplace(): Promise<void> {
  if (store.online && store.mode !== "2v2") {
    await requestMulligan(store.gameId());
  } else {
    store.mulligan(store.mySeat);
  }
}

// ── Libellé du filtre de recherche en pile ───────────────────────────────────
const pickFilterLabel = computed(() => {
  const f = store.effectPicking?.filter;
  if (!f) return "une carte";
  const parts = [f.mainType ?? "une carte"];
  if (f.sub) parts.push(f.sub.charAt(0).toUpperCase() + f.sub.slice(1));
  if (f.maxLevel !== undefined) parts.push(`(Niveau ≤ ${f.maxLevel})`);
  return parts.join(" ");
});

// ── Portrait du héros (écran de passation) ───────────────────────────────────
const perspectivePortrait = computed<string | null>(() => {
  const id = store.view.seats[store.perspective].heroInstanceId;
  const inst = id ? store.state.instances[id] : null;
  if (!inst?.cardId) return null;
  const cleanId = inst.cardId.replace(/_(recto|verso)$/, "");
  const faceSuffix = inst.face === "verso" ? "verso" : "recto";
  return getThumbPath(`/images/cards/${cleanId}_${faceSuffix}.webp`);
});

/** Tour de l'adversaire auto-piloté (tutoriel : joueur = siège A, bot = B).
 * On remplace la passation « passe l'appareil » par un discret « L'adversaire
 * joue… » et le bot finit son tour sans révéler son plateau. */
const botTurn = computed(
  () => (tutorial.active || !!store.botSeat) && store.perspective === "B",
);

// ── Tirage au sort ANIMÉ : qui commence ? ────────────────────────────────────
// Le premier joueur est décidé CÔTÉ SERVEUR (coin flip de join_game, ou pile/face
// local). Le dé est joué APRÈS le mulligan (transition mulligan → jeu) : les deux
// clients atteignent "playing" au même instant (2e MULLIGAN_DONE diffusé), donc le
// tirage est SYNCHRONE et visible des deux côtés. La face FINALE est DÉTERMINISTE
// (dérivée de gameId + siège qui commence) → le MÊME dé s'affiche chez les deux
// joueurs ; seul le texte est relatif à la perspective. (Le roulement utilise
// Math.random localement : purement visuel, sans incidence sur l'état.)
const diceVisible = ref(false);
const diceFace = ref(1);
const diceSettled = ref(false);
const diceIStart = ref(false);
let diceShownFor = "";
let diceCycle: ReturnType<typeof setInterval> | null = null;
let diceT1: ReturnType<typeof setTimeout> | null = null;
let diceT2: ReturnType<typeof setTimeout> | null = null;

function clearDiceTimers(): void {
  if (diceCycle) clearInterval(diceCycle);
  if (diceT1) clearTimeout(diceT1);
  if (diceT2) clearTimeout(diceT2);
  diceCycle = diceT1 = diceT2 = null;
}

function rollFirstPlayerDie(): void {
  clearDiceTimers();
  const fp = store.firstPlayer; // siège qui commence (partagé via le journal)
  diceIStart.value = fp === store.perspective;
  // Face FINALE déterministe + PARTAGÉE : parité = siège (pair → A, impair → B),
  // valeur dérivée du gameId → identique sur les deux clients.
  const pool = fp === "A" ? [2, 4, 6] : [1, 3, 5];
  const seed = [...store.gameId()].reduce((a, c) => a + c.charCodeAt(0), 0);
  const finalFace = pool[seed % pool.length];
  diceSettled.value = false;
  diceVisible.value = true;
  // prefers-reduced-motion : pas de clignotement de pips (mouvement de contenu
  // non couvert par la garde CSS) — on pose directement la face finale.
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    diceFace.value = finalFace;
    diceSettled.value = true;
    diceT2 = setTimeout(() => (diceVisible.value = false), 1900);
    return;
  }
  diceFace.value = 1 + Math.floor(Math.random() * 6);
  // Roulement : faces aléatoires rapides (~1,1 s) puis pose sur la valeur finale.
  diceCycle = setInterval(() => {
    diceFace.value = 1 + Math.floor(Math.random() * 6);
  }, 90);
  diceT1 = setTimeout(() => {
    if (diceCycle) clearInterval(diceCycle);
    diceCycle = null;
    diceFace.value = finalFace;
    diceSettled.value = true;
    // Lecture du résultat puis disparition (révèle le plateau en dessous).
    diceT2 = setTimeout(() => (diceVisible.value = false), 1900);
  }, 1100);
}

// Pips de la face (grille 3×3, indices 0..8).
const DICE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
const dicePips = computed(() => DICE_PIPS[diceFace.value] ?? [4]);

// Déclenche le dé une fois par partie, APRÈS le mulligan (transition mulligan →
// jeu). Les deux clients franchissent ce cap au même moment (2e MULLIGAN_DONE
// diffusé) → tirage synchrone des deux côtés. Garde `prev === "mulligan"` : on ne
// le joue PAS sur un saut direct lobby → jeu (sandbox/repriseéventuelle).
watch(
  () => store.matchPhase,
  (now, prev) => {
    if (now === "lobby") {
      diceShownFor = "";
      return;
    }
    if (
      now === "playing" &&
      prev === "mulligan" &&
      diceShownFor !== store.gameId()
    ) {
      diceShownFor = store.gameId();
      // Tirage au sort ANIMÉ dans tous les modes (solo vs IA comme en ligne) : le
      // 1er joueur est désormais tiré au sort (tutorialStore n'impose plus
      // l'ordinateur), donc le dé est honnête et non plus trompeur.
      rollFirstPlayerDie();
    }
  },
);

onMounted(async () => {
  if (!cardStore.cards.length) {
    try {
      await (
        cardStore as unknown as { initialize?: () => Promise<void> }
      ).initialize?.();
    } catch {
      /* l'app charge les cartes par ailleurs */
    }
  }
  // Reprise : si l'utilisateur a une partie ACTIVE, on NE s'y reconnecte PLUS
  // d'office (sinon une partie abandonnée la veille « piège » au montage). On la
  // détecte et on PROPOSE le choix dans le lobby (Reprendre / Abandonner).
  if (
    ONLINE_PLAY_ENABLED &&
    authStore.isAuthenticated &&
    store.matchPhase === "lobby" &&
    !store.online
  ) {
    try {
      resumable.value = await findMyActiveGame();
    } catch {
      /* pas de partie reprenable — on reste au lobby */
    }
  }
  // Onboarding : /play/table?tutorial=1 démarre directement le tutoriel.
  if (route.query.tutorial && !store.started) startTutorial();
});

// ── Cycle de vie de l'onglet ────────────────────────────────────────────────
// `visibilitychange` est PUREMENT cosmétique : on note discrètement que l'onglet
// est masqué pour l'affichage, mais on ne déclenche JAMAIS de forfait ici
// (basculer d'onglet ou verrouiller son téléphone ne doit pas faire perdre la
// partie). La présence Realtime + la fenêtre de grâce gèrent la déconnexion.
const tabHidden = ref(false);
function onVisibilityChange(): void {
  tabHidden.value = document.visibilityState === "hidden";
}

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  clearDiceTimers();
  botDriver.stop(); // arrête la boucle de polling de l'IA (pas de fuite de timer)
  // Navigation hors de la table : on coupe proprement le transport en ligne.
  // Ce n'est PAS un forfait — la reprise au montage (findMyActiveGame) permet de
  // revenir dans une partie encore `active`.
  if (store.online) store.disconnectOnline();
});
</script>

<style scoped>
/* ── Lobby ── */
.lobby-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  background: rgba(27, 26, 23, 0.1);
  color: rgba(27, 26, 23, 0.5);
}
.lobby-step--on {
  background: #f04e22;
  color: #fff;
}
.deck-pick {
  position: relative;
  text-align: left;
  border: 1px solid rgba(27, 26, 23, 0.15);
  border-radius: 8px;
  overflow: hidden;
  background: var(--paper-200, #edebe4);
  display: flex;
  flex-direction: column;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.deck-pick:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}
.deck-pick--on {
  border-color: var(--spine, #f04e22);
  box-shadow:
    0 0 0 2px var(--spine, #f04e22),
    0 10px 24px rgba(0, 0, 0, 0.35);
}
.deck-pick__art {
  position: relative;
  display: block;
  height: 150px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.08), transparent),
    #14110e;
  overflow: hidden;
}
.deck-pick__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  display: block;
  transition: transform 0.3s ease;
}
.deck-pick:hover .deck-pick__img {
  transform: scale(1.05);
}
.deck-pick__art::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 45%,
    rgba(20, 17, 14, 0.05) 70%,
    var(--paper-200, #edebe4) 100%
  );
}
.deck-pick__art-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.4);
}
.deck-pick__check {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--spine, #f04e22);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.deck-pick__body {
  position: relative;
  z-index: 1;
  padding: 4px 14px 14px;
  border-left: 3px solid var(--spine, #98a1af);
  margin: -22px 0 0;
}
.deck-pick__name {
  display: block;
  font-family: Fraunces, Georgia, serif;
  font-size: 19px;
  line-height: 1.15;
  color: #1b1a17;
}
.deck-pick__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(27, 26, 23, 0.6);
}
.deck-pick__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--spine, #98a1af);
  flex: 0 0 auto;
}
.deck-pick__sep {
  opacity: 0.5;
}

/* ── Match : plein écran fixe au-dessus du shell (immersion MTGA) ── */
.gfull {
  position: fixed;
  inset: 0;
  z-index: 50;
  padding: 10px clamp(8px, 2vw, 28px) 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  background:
    radial-gradient(
      90% 60% at 50% 0%,
      rgba(240, 78, 34, 0.05),
      transparent 70%
    ),
    #0d0a07;
  color: #f6f5f1;
}
.gtopbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(246, 245, 241, 0.08);
  border-radius: 10px;
  backdrop-filter: blur(8px);
}
.gtopbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.gtopbar__title {
  font-family: Fraunces, Georgia, serif;
  font-size: 18px;
  margin-right: 6px;
  color: #f6f5f1;
}
.gtopbar__turn {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(246, 245, 241, 0.55);
}
/* Bandeau de tour en ligne, relatif au joueur. */
.gturn--you {
  color: #7ee0a6;
  font-weight: 700;
}
.gturn--wait {
  color: #f0c674;
  font-weight: 700;
}
.gtop-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(246, 245, 241, 0.08);
  color: #f6f5f1;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}
.gtop-btn:hover {
  background: rgba(246, 245, 241, 0.18);
  transform: translateY(-1px);
}
.gtop-btn:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 1px;
}
.gtop-btn--quit {
  background: transparent;
  outline: 1px solid rgba(246, 245, 241, 0.2);
}
.gtop-btn--quit:hover {
  background: rgba(240, 78, 34, 0.25);
}
.gtop-btn--danger {
  background: #c0392b;
  outline-color: transparent;
}
.gtop-btn--danger:hover {
  background: #a72f1f;
}
.gtop-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(240, 166, 43, 0.12);
  border: 1px solid rgba(240, 166, 43, 0.35);
  color: #f0a62b;
  cursor: pointer;
  user-select: none;
}
.gtop-toggle__box {
  accent-color: #f0a62b;
}
.gdisconnect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 10px;
  background: rgba(240, 78, 34, 0.14);
  border: 1px solid rgba(240, 78, 34, 0.4);
  color: #f6f5f1;
}
.gdisconnect__text {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.04em;
}
.gdisconnect__claim {
  background: #f04e22;
  font-weight: 700;
}
.gdisconnect__claim:hover {
  background: #d8421a;
}
.glayout {
  display: flex;
  gap: 10px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.glayout__board {
  flex: 1;
  min-width: 0;
  height: 100%;
}
.glayout__journal {
  flex: 0 0 264px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(246, 245, 241, 0.08);
  border-radius: 10px;
  padding: 12px 14px;
  overflow: hidden;
}
/* Chat de table (Cadre). */
.gchat {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.gchat__input {
  flex: 1;
  min-width: 0;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(246, 245, 241, 0.18);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 12px;
  color: inherit;
}
.gchat__send {
  border: 1px solid rgba(246, 245, 241, 0.18);
  border-radius: 8px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

/* ── Overlays (passation / mulligan / fin) ── */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 8, 6, 0.84);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
}
.overlay__card {
  background: var(--paper, #f6f5f1);
  color: #1b1a17;
  border-radius: 14px;
  padding: 32px 36px;
  text-align: center;
  max-width: 92vw;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(240, 78, 34, 0.25);
  border-top: 4px solid #f04e22;
}
.overlay__card--wide {
  max-width: min(96vw, 1020px);
}
/* ── Tirage au sort animé (qui commence) ── */
.overlay--dice {
  z-index: 70; /* au-dessus du mulligan (60) qu'il révèle en disparaissant */
}
/* ── Accueil « Apprendre en jouant » (but + fonctionnement) ── */
.overlay--welcome {
  z-index: 80; /* au-dessus du mulligan (60) : on lit l'accueil, puis on garde/refait */
}
.welcome-body {
  margin-top: 1rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #35322c;
}
.welcome-body strong {
  color: #b3401b;
}
.dice-box {
  display: grid;
  place-items: center;
  gap: 1.1rem;
  min-width: 280px;
}
.die {
  width: 104px;
  height: 104px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 6px;
  padding: 14px;
  background: linear-gradient(150deg, #fbfaf7, #e9e6dd);
  border-radius: 18px;
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.45),
    inset 0 0 0 2px rgba(27, 26, 23, 0.08);
}
.die__cell {
  display: grid;
  place-items: center;
}
.die__pip {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #44413b, #1b1a17);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
}
.die--rolling {
  animation: die-roll 0.46s ease-in-out infinite;
}
.die--settled {
  animation: die-settle 0.45s cubic-bezier(0.2, 1.5, 0.4, 1);
}
@keyframes die-roll {
  0% {
    transform: rotate(-13deg) scale(1);
  }
  50% {
    transform: rotate(13deg) scale(1.07);
  }
  100% {
    transform: rotate(-13deg) scale(1);
  }
}
@keyframes die-settle {
  0% {
    transform: scale(1.32) rotate(-6deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
.dice-result {
  font-family: "Cinzel", var(--font-display, serif);
  font-size: 1.45rem;
  font-weight: 700;
  color: #1b1a17;
}
.dice-hint {
  color: #6b675f;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
}
@media (prefers-reduced-motion: reduce) {
  .die--rolling,
  .die--settled {
    animation: none;
  }
}
.overlay__portrait {
  width: 96px;
  height: 96px;
  border-radius: 14px;
  object-fit: cover;
  object-position: center 16%;
  margin: 14px auto 0;
  border: 3px solid #f04e22;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
}
.mulligan-fan {
  margin-top: 22px;
  --card-hand: clamp(96px, 12vw, 140px);
}
.pick-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
  max-height: 52vh;
  overflow-y: auto;
  padding: 4px;
}
.pick-card {
  width: clamp(86px, 10vw, 120px);
  border-radius: 6px;
  transition: transform 0.15s ease;
}
.pick-card:hover {
  transform: translateY(-4px) scale(1.04);
}
.pick-card:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 2px;
}
.ovl-enter-active {
  transition: opacity 0.25s ease;
}
.ovl-enter-active .overlay__card {
  animation: ovl-card-in 0.35s cubic-bezier(0.2, 1.1, 0.3, 1);
}
.ovl-leave-active {
  transition: opacity 0.2s ease;
}
.ovl-enter-from,
.ovl-leave-to {
  opacity: 0;
}
@keyframes ovl-card-in {
  from {
    transform: translateY(22px) scale(0.94);
  }
  to {
    transform: translateY(0) scale(1);
  }
}
/* Aligné sur le breakpoint d'empilement du plateau (GameBoard : 1024px) pour
   éviter la zone 1025–1100px où la coque passait en colonne alors que le board
   restait en mode desktop large. */
@media (max-width: 1024px) {
  .gfull {
    overflow-y: auto;
    /* `overflow-y: auto` seul rend l'axe X défilable (visible → auto) : le
       surplomb de l'éventail (~8px hors cadre, voulu sur desktop) créait un
       scroll HORIZONTAL de page en mobile (audit UX 2026-07) → clippé. */
    overflow-x: hidden;
  }
  .glayout {
    flex-direction: column;
    flex: none;
  }
  .glayout__board {
    height: auto;
  }
  .glayout__journal {
    flex: none;
    max-height: 200px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ovl-enter-active .overlay__card {
    animation: none;
  }
}
</style>
