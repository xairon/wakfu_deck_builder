<template>
  <!-- ═══════════ LOBBY : choix des decks (J1 puis J2) ═══════════ -->
  <div v-if="store.matchPhase === 'lobby'" class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">La Table des Douze</p>
        <h1 class="mt-2 font-display text-3xl sm:text-4xl">Nouvelle partie</h1>
        <p class="mt-2 max-w-lg text-base-content/70">
          Partie locale à deux (hot-seat). Chaque joueur choisit un deck, puis
          on passe l'appareil à tour de rôle.
        </p>
        <button
          class="btn btn-outline btn-sm mt-4 gap-2"
          :disabled="!cardStore.cards.length"
          data-testid="lobby-start-tutorial"
          @click="startTutorial"
        >
          🎓 Apprendre à jouer
          <span
            v-if="!tutorial.isDone()"
            class="font-mono text-[10px] uppercase opacity-70"
            >~5 min</span
          >
        </button>
      </div>
      <RouterLink to="/play" class="btn btn-ghost btn-sm"
        >← Compagnon</RouterLink
      >
    </header>
    <div class="h-px w-full bg-base-content/20"></div>

    <!-- Jeu en ligne (bêta) -->
    <section
      v-if="ONLINE_PLAY_ENABLED"
      class="border border-primary/30 bg-primary/[0.04] p-5"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="eyebrow text-primary">Jouer en ligne (bêta)</p>
          <p class="mt-1 text-sm text-base-content/65">
            Affronte un ami à distance — règles résolues à la main, comme sur
            une vraie table.
          </p>
        </div>
        <div
          v-if="authStore.isAuthenticated && decks.length"
          class="flex gap-2"
        >
          <button
            class="btn btn-sm"
            :class="onlinePanel === 'create' ? 'btn-primary' : 'btn-outline'"
            @click="onlinePanel = 'create'"
          >
            Créer
          </button>
          <button
            class="btn btn-sm"
            :class="onlinePanel === 'join' ? 'btn-primary' : 'btn-outline'"
            @click="onlinePanel = 'join'"
          >
            Rejoindre
          </button>
        </div>
      </div>

      <p v-if="!authStore.isAuthenticated" class="mt-3 text-sm">
        <RouterLink to="/auth" class="link text-primary"
          >Connecte-toi</RouterLink
        >
        pour jouer en ligne.
      </p>
      <p v-else-if="!decks.length" class="mt-3 text-sm text-base-content/60">
        Construis d'abord un deck pour jouer en ligne.
      </p>

      <div v-else-if="onlinePanel" class="mt-4 flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-base-content/60">Ton deck</span>
          <select
            v-model="onlineDeckId"
            class="select select-bordered select-sm w-56 bg-base-200"
          >
            <option :value="null" disabled>Choisis…</option>
            <option v-for="d in decks" :key="d.id" :value="d.id">
              {{ d.name }}
            </option>
          </select>
        </label>
        <label
          v-if="onlinePanel === 'join'"
          class="flex flex-col gap-1 text-sm"
        >
          <span class="text-base-content/60">Code du salon</span>
          <input
            v-model="joinCode"
            maxlength="8"
            placeholder="ABCD12"
            class="input input-bordered input-sm w-40 uppercase"
          />
        </label>
        <button
          v-if="onlinePanel === 'create'"
          class="btn btn-primary btn-sm"
          :disabled="!onlineDeckId || onlineBusy"
          @click="onlineCreate"
        >
          {{ onlineBusy ? "…" : "Créer la partie" }}
        </button>
        <button
          v-else
          class="btn btn-primary btn-sm"
          :disabled="!onlineDeckId || !joinCode.trim() || onlineBusy"
          @click="onlineJoin"
        >
          {{ onlineBusy ? "…" : "Rejoindre" }}
        </button>
        <span v-if="onlineError" class="text-sm text-error">{{
          onlineError
        }}</span>
      </div>
    </section>

    <p v-if="!decks.length" class="text-base-content/60">
      Aucun deck.
      <RouterLink to="/deck-builder" class="link text-primary"
        >Construisez-en un</RouterLink
      >
      pour jouer.
    </p>

    <section v-else class="space-y-5">
      <div class="flex items-center gap-3">
        <span class="lobby-step" :class="{ 'lobby-step--on': lobbyStep === 1 }"
          >1</span
        >
        <span class="h-px flex-1 bg-base-content/20"></span>
        <span class="lobby-step" :class="{ 'lobby-step--on': lobbyStep === 2 }"
          >2</span
        >
      </div>

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="section-rule eyebrow">
            {{
              lobbyStep === 1
                ? "Joueur 1 — choisis ton deck"
                : "Joueur 2 — choisis ton deck"
            }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-base-content/60">Nom :</span>
          <input
            v-if="lobbyStep === 1"
            v-model="nameA"
            class="input input-bordered input-sm w-44"
            placeholder="Joueur 1"
          />
          <input
            v-else
            v-model="nameB"
            class="input input-bordered input-sm w-44"
            placeholder="Joueur 2"
          />
        </label>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="d in decks"
          :key="d.id"
          type="button"
          class="deck-pick"
          :class="{ 'deck-pick--on': currentPick === d.id }"
          :style="{ '--spine': heroElement(d) }"
          data-testid="lobby-deck-pick"
          @click="setPick(d.id)"
        >
          <span class="deck-pick__art">
            <img
              v-if="heroImg(d)"
              :src="heroImg(d)!"
              :alt="d.hero?.name || ''"
              class="deck-pick__img"
              loading="lazy"
              @error="onImgError"
            />
            <span v-else class="deck-pick__art-empty">Sans héros</span>
            <span v-if="currentPick === d.id" class="deck-pick__check">✓</span>
          </span>
          <span class="deck-pick__body">
            <span class="deck-pick__name">{{ d.name }}</span>
            <span class="deck-pick__meta">
              <span class="deck-pick__dot" aria-hidden="true"></span>
              {{ d.hero?.name || "Sans héros" }}
              <span class="deck-pick__sep">·</span>
              {{ cardCount(d) }} cartes
            </span>
          </span>
        </button>
      </div>

      <div class="flex gap-3">
        <button
          v-if="lobbyStep === 2"
          class="btn btn-ghost"
          @click="lobbyStep = 1"
        >
          ← Retour
        </button>
        <button
          v-if="lobbyStep === 1"
          class="btn btn-primary"
          :disabled="!pickA"
          data-testid="lobby-next"
          @click="lobbyStep = 2"
        >
          Suivant →
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="!pickB"
          data-testid="lobby-launch"
          @click="launch"
        >
          Lancer la partie
        </button>
      </div>
    </section>
  </div>

  <!-- ═══════════ EN MATCH (mulligan / playing) ═══════════ -->
  <div v-else class="gfull">
    <div class="gtopbar">
      <div class="gtopbar__group">
        <span class="gtopbar__title">La Table des Douze</span>
        <span v-if="store.matchPhase === 'playing'" class="gtopbar__turn">
          Tour {{ store.turn.number }} · {{ store.activeName }} ·
          {{ store.phaseLabel }}
        </span>
        <span v-else class="gtopbar__turn">Mise en place</span>
      </div>
      <div v-if="store.matchPhase === 'playing'" class="gtopbar__group">
        <button
          class="gtop-btn"
          @click="store.shufflePioche(store.perspective)"
        >
          Mélanger
        </button>
        <button class="gtop-btn" @click="store.undoLast()">Annuler</button>
        <label
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

    <div class="glayout">
      <GameBoard class="glayout__board" />
      <aside v-if="showJournal" class="glayout__journal">
        <ActionLog :lines="store.log" />
      </aside>
    </div>

    <CardPreviewLayer />
    <DragLayer />
    <TurnBanner />
    <ManualEffectReminders />
    <TutorialCoach />

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
          <p class="eyebrow text-primary">Effet optionnel</p>
          <h2 class="mt-2 font-display text-3xl">
            {{ store.effectChoice.cardName }}
          </h2>
          <p class="mt-3 max-w-md text-base-content/75">
            « {{ store.effectChoice.text }} »
          </p>
          <div class="mt-6 flex justify-center gap-3">
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
                store.effectChoice.declineOps?.length
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

    <!-- Mulligan -->
    <Transition name="ovl">
      <div
        v-if="!store.passPending && store.matchPhase === 'mulligan'"
        class="overlay overlay--mulligan"
      >
        <div class="overlay__card overlay__card--wide">
          <p class="eyebrow text-primary">
            Main de départ — {{ store.players[store.perspective].name }}
          </p>
          <h2 class="mt-1 font-display text-3xl">Gardes-tu cette main ?</h2>
          <div class="mulligan-fan">
            <HandFan mine :items="mulliganItems" :resolve-card="resolveCard" />
          </div>
          <div class="mt-5 flex flex-wrap justify-center gap-3">
            <button
              class="btn btn-primary"
              data-testid="mulligan-keep"
              @click="store.keepHand()"
            >
              Garder ({{ mulliganHand.length }} cartes)
            </button>
            <button
              class="btn btn-outline"
              :disabled="mulliganHand.length === 0"
              @click="store.mulligan(store.perspective)"
            >
              Mulligan (re-piocher
              {{ Math.max(0, mulliganHand.length - 1) }})
            </button>
          </div>
          <p class="mt-3 text-xs text-base-content/50">
            Règle Wakfu : on recommence avec une carte de moins à chaque fois.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Fin de partie -->
    <Transition name="ovl">
      <div v-if="store.matchPhase === 'finished'" class="overlay">
        <div class="overlay__card">
          <p class="eyebrow text-primary">Partie terminée</p>
          <h2 class="mt-2 font-display text-4xl">
            {{
              store.winner
                ? `${store.players[store.winner].name} l'emporte`
                : "Match nul"
            }}
          </h2>
          <button class="btn btn-primary mt-6" @click="store.quitMatch()">
            Nouvelle partie
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card, Deck } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { elementColor } from "@/config/elementColors";
import { getThumbPath } from "@/utils/imagePaths";
import GameBoard from "@/components/game/GameBoard.vue";
import GameCard from "@/components/game/GameCard.vue";
import HandFan from "@/components/game/HandFan.vue";
import type { HandItem } from "@/components/game/HandFan.vue";
import ActionLog from "@/components/game/ActionLog.vue";
import CardPreviewLayer from "@/components/game/CardPreviewLayer.vue";
import DragLayer from "@/components/game/DragLayer.vue";
import TurnBanner from "@/components/game/TurnBanner.vue";
import ManualEffectReminders from "@/components/game/ManualEffectReminders.vue";
import TutorialCoach from "@/components/game/TutorialCoach.vue";
import { useTutorialStore } from "@/stores/tutorialStore";
import { validateDeck } from "@/validators/deck";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/authStore";
import {
  createGame as createOnlineGame,
  joinGame,
  findGameByCode,
  submitEvent,
  subscribeToGame,
} from "@/services/gameClient";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const store = useGameStore();
const tutorial = useTutorialStore();
const route = useRoute();

const toast = useToast();
function startTutorial(): void {
  if (!tutorial.start()) {
    toast.addToast(
      "Impossible de préparer le tutoriel (cartes indisponibles).",
      { type: "warning" },
    );
  }
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
// Masqué par défaut : le plateau occupe toute la largeur (cartes plus grandes).
// Le joueur ouvre le journal à la demande via le bouton « Journal ».
const showJournal = ref(false);
// Pendant un tutoriel, on force l'ouverture du journal : une étape le met en
// lumière (« tout est tracé dans le journal ») et le débutant le voit se remplir.
watch(
  () => tutorial.active,
  (on) => {
    if (on) showJournal.value = true;
  },
);

// ── Lobby ────────────────────────────────────────────────────────────────────
const lobbyStep = ref<1 | 2>(1);
const nameA = ref("");
const nameB = ref("");
const pickA = ref<string | null>(null);
const pickB = ref<string | null>(null);
const currentPick = computed(() =>
  lobbyStep.value === 1 ? pickA.value : pickB.value,
);
function setPick(id: string): void {
  if (lobbyStep.value === 1) pickA.value = id;
  else pickB.value = id;
}
function launch(): void {
  const dA = decks.value.find((d) => d.id === pickA.value);
  const dB = decks.value.find((d) => d.id === pickB.value);
  if (!dA || !dB) return;
  // 101.x — un deck non conforme (≠48, sans Héros/Havre-Sac, copies, réserve)
  // ne peut pas entrer en partie.
  const errs = [...validateDeck(dA).errors, ...validateDeck(dB).errors];
  if (errs.length) {
    toast.addToast(`Deck invalide : ${errs.join(" · ")}`, { type: "warning" });
    return;
  }
  // v1 « à la Cockatrice » : règles assistées (combat, coûts, légalité,
  // limites, victoire) mais effets de cartes résolus À LA MAIN. La file
  // d'effets DSL (Lots A–C) reste en backlog v2.
  store.assistEffects = false;
  store.startMatch(dA, dB, { nameA: nameA.value, nameB: nameB.value });
}

// ── Jeu en ligne (lobby) ──────────────────────────────────────────────────────
const authStore = useAuthStore();
const onlineTransport = { submit: submitEvent, subscribe: subscribeToGame };
// v1 : le jeu en ligne (bêta) est masqué — les transitions de match ne sont pas
// encore synchronisées (cf. roadmap, épopée v1.1). Code conservé derrière ce flag.
const ONLINE_PLAY_ENABLED = false;
const onlinePanel = ref<"create" | "join" | null>(null);
const onlineDeckId = ref<string | null>(null);
const joinCode = ref("");
const createdCode = ref("");
const onlineBusy = ref(false);
const onlineError = ref("");

async function onlineCreate(): Promise<void> {
  const deck = decks.value.find((d) => d.id === onlineDeckId.value);
  if (!deck || onlineBusy.value) return;
  onlineBusy.value = true;
  onlineError.value = "";
  try {
    const { gameId, code } = await createOnlineGame(deck);
    createdCode.value = code;
    store.connectOnline(gameId, "A", onlineTransport);
  } catch (e) {
    onlineError.value = (e as { message?: string })?.message ?? String(e);
  } finally {
    onlineBusy.value = false;
  }
}

async function onlineJoin(): Promise<void> {
  const deck = decks.value.find((d) => d.id === onlineDeckId.value);
  const code = joinCode.value.trim().toUpperCase();
  if (!deck || !code || onlineBusy.value) return;
  onlineBusy.value = true;
  onlineError.value = "";
  try {
    const gameId = await findGameByCode(code);
    if (!gameId) {
      onlineError.value = "Partie introuvable (vérifie le code).";
      return;
    }
    store.connectOnline(gameId, "B", onlineTransport); // s'abonner AVANT join
    await joinGame(code, deck);
  } catch (e) {
    onlineError.value = (e as { message?: string })?.message ?? String(e);
  } finally {
    onlineBusy.value = false;
  }
}

// En ligne : tant que la mise en place (GAME_STARTED) n'est pas arrivée, écran
// d'attente avec le code de salon (l'hôte le partage à l'adversaire).
const onlineWaiting = computed(
  () => store.online && store.state.monde.length === 0,
);

// ── Aides deck ───────────────────────────────────────────────────────────────
function cardCount(d: Deck): number {
  return (d.cards ?? []).reduce(
    (n, c) => n + (c.isReserve ? 0 : c.quantity),
    0,
  );
}
function heroImg(d: Deck): string | null {
  return d.hero ? `/images/cards/${d.hero.id}_recto.webp` : null;
}
function heroElement(d: Deck): string {
  return elementColor(d.hero?.stats?.niveau?.element);
}
function onImgError(e: Event): void {
  (e.target as HTMLImageElement).style.visibility = "hidden";
}

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
  const z = store.view.seats[store.perspective].main;
  return z.kind === "full" ? z.instances : [];
});
const mulliganItems = computed<HandItem[]>(() =>
  mulliganHand.value.map((inst) => ({ key: inst.instanceId, inst })),
);

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
  return getThumbPath(`/images/cards/${inst.cardId}_recto.webp`);
});

/** Tour de l'adversaire auto-piloté (tutoriel : joueur = siège A, bot = B).
 * On remplace la passation « passe l'appareil » par un discret « L'adversaire
 * joue… » et le bot finit son tour sans révéler son plateau. */
const botTurn = computed(() => tutorial.active && store.perspective === "B");

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
  // Onboarding : /play/table?tutorial=1 démarre directement le tutoriel.
  if (route.query.tutorial && !store.started) startTutorial();
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
