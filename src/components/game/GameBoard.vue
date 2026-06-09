<template>
  <div class="gtable" :class="{ 'gtable--dragging': dnd.isDragging.value }">
    <!-- ════════ ADVERSAIRE : bande (HUD · socle · main · piles) puis champ ════════ -->
    <section class="gseat gseat--opp">
      <div class="gseat__strip">
        <SeatHud
          :name="store.players[opp].name"
          :active="store.turn.active === opp"
          :portrait="heroPortrait(opp)"
          :hero-name="heroName(opp)"
          :accent="heroAccent(opp)"
          :counters="heroCounters(opp)"
          @bump="(c, d) => bumpHero(opp, c, d)"
        />
        <div class="gzone gzone--base" aria-label="Socle adverse">
          <span class="gzone__label">Socle</span>
          <TransitionGroup tag="div" name="zone" class="gzone__cards">
            <div
              v-for="inst in baseCards(opp)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
            >
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </TransitionGroup>
        </div>
        <HandFan
          class="gseat__handzone gseat__handzone--opp"
          :items="handList(opp)"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
        <div class="gpiles">
          <PileStack label="Pioche" :count="piocheCount(opp)" deck />
          <PileStack
            label="Défausse"
            :count="discardCount(opp)"
            :top="topDiscard(opp)"
            :top-card="resolveCard(topDiscard(opp)?.cardId ?? null)"
            @zoom="zoomInst"
          />
          <PileStack label="Réserve" :count="reserveCount(opp)" deck reserve />
        </div>
      </div>
      <div class="gzone gzone--field" role="group" aria-label="Alliés adverses">
        <span v-if="!allies(opp).length" class="gzone__hint"
          >Alliés adverses</span
        >
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div v-for="inst in allies(opp)" :key="inst.instanceId" class="gslot">
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
          </div>
        </TransitionGroup>
      </div>
    </section>

    <!-- ════════ LIGNE MÉDIANE — LE MONDE / FILE D'ATTENTE ════════ -->
    <div
      class="gmid"
      :class="zoneCls('queue')"
      :ref="
        (el) =>
          registerZone('queue', el, { zone: 'fileAttente' }, 'File d\'attente')
      "
    >
      <span class="gmid__label">⬩ Le Monde ⬩</span>
      <div v-if="queue.length" class="gmid__queue">
        <span class="gmid__queue-label">File d'attente</span>
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div
            v-for="inst in queue"
            :key="inst.instanceId"
            class="gslot gslot--small"
          >
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              draggable
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- ════════ TOI : champ pleine largeur puis bande (HUD · socle · main · piles) ════════ -->
    <section class="gseat">
      <div
        class="gzone gzone--field gzone--play"
        :class="zoneCls('monde')"
        role="group"
        aria-label="Vos alliés"
        :ref="(el) => registerZone('monde', el, { zone: 'monde' }, 'Monde')"
      >
        <span v-if="!allies(me).length" class="gzone__hint"
          >⬇ Glissez une carte ici pour la jouer</span
        >
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div v-for="inst in allies(me)" :key="inst.instanceId" class="gslot">
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              draggable
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
          </div>
        </TransitionGroup>
      </div>
      <div class="gseat__strip">
        <SeatHud
          :name="store.players[me].name"
          :active="store.turn.active === me"
          :portrait="heroPortrait(me)"
          :hero-name="heroName(me)"
          :accent="heroAccent(me)"
          :counters="heroCounters(me)"
          @bump="(c, d) => bumpHero(me, c, d)"
        />
        <div
          class="gzone gzone--base"
          :class="zoneCls('socle')"
          aria-label="Votre socle"
          :ref="
            (el) =>
              registerZone(
                'socle',
                el,
                { zone: 'havreSac', owner: me },
                'Socle',
              )
          "
        >
          <span class="gzone__label">Socle</span>
          <TransitionGroup tag="div" name="zone" class="gzone__cards">
            <div
              v-for="inst in baseCards(me)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
            >
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                draggable
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </TransitionGroup>
        </div>
        <div
          class="gseat__handzone"
          :class="zoneCls('main')"
          :ref="
            (el) =>
              registerZone('main', el, { zone: 'main', owner: me }, 'Main')
          "
        >
          <HandFan
            mine
            draggable
            :items="handList(me)"
            :resolve-card="resolveCard"
            :selected-id="selectedId"
            @select="select"
            @zoom="zoomInst"
          />
        </div>
        <div class="gpiles">
          <span
            :class="zoneCls('pioche')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'pioche',
                  el,
                  { zone: 'pioche', owner: me },
                  'Pioche',
                  { at: 'top' },
                )
            "
          >
            <PileStack
              label="Pioche"
              :count="piocheCount(me)"
              deck
              @act="store.draw(me)"
            />
          </span>
          <span
            :class="zoneCls('defausse')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'defausse',
                  el,
                  { zone: 'defausse', owner: me },
                  'Défausse',
                  { at: 'top' },
                )
            "
          >
            <PileStack
              label="Défausse"
              :count="discardCount(me)"
              :top="topDiscard(me)"
              :top-card="resolveCard(topDiscard(me)?.cardId ?? null)"
              @zoom="zoomInst"
            />
          </span>
          <span
            :class="zoneCls('reserve')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'reserve',
                  el,
                  { zone: 'reserve', owner: me },
                  'Réserve',
                )
            "
          >
            <PileStack
              label="Réserve"
              :count="reserveCount(me)"
              deck
              reserve
              @act="store.drawFromReserve(me)"
            />
          </span>
        </div>
      </div>
    </section>

    <!-- ════════ Bouton Fin du tour (façon MTGA) ════════ -->
    <button
      type="button"
      class="gendturn"
      aria-label="Finir le tour"
      @click="store.endTurn()"
    >
      <span class="gendturn__ring" aria-hidden="true"></span>
      <span class="gendturn__txt">Fin du<br />tour</span>
    </button>

    <!-- ════════ Barre d'action de la carte sélectionnée ════════ -->
    <Transition name="slideup">
      <div
        v-if="selectedInst"
        class="gactionbar"
        role="toolbar"
        aria-label="Actions de la carte sélectionnée"
      >
        <span class="gactionbar__name">{{ selectedName }}</span>
        <div class="gactionbar__btns">
          <button class="gbtn gbtn--accent" @click="tapSelected">
            {{
              selectedInst.orientation === "tapped"
                ? "↺ Redresser"
                : "↻ Incliner"
            }}
          </button>
          <span class="gactionbar__sep"></span>
          <button class="gbtn" @click="moveSelected('monde')">→ Monde</button>
          <button class="gbtn" @click="moveSelected('havreSac')">
            → Socle
          </button>
          <button class="gbtn" @click="moveSelected('main')">→ Main</button>
          <button class="gbtn" @click="moveSelected('defausse', { at: 'top' })">
            Défausser
          </button>
          <button class="gbtn" @click="moveSelected('pioche', { at: 'top' })">
            ↑ Pioche
          </button>
          <button
            class="gbtn"
            @click="moveSelected('pioche', { at: 'bottom' })"
          >
            ↓ Pioche
          </button>
          <span class="gactionbar__sep"></span>
          <button class="gbtn gbtn--counter" @click="bumpDamage(1)">
            + Dmg
          </button>
          <button class="gbtn gbtn--counter" @click="bumpDamage(-1)">
            − Dmg
          </button>
          <button class="gbtn" @click="zoomInst(selectedInst.instanceId)">
            ⤢ Agrandir
          </button>
          <button
            class="gbtn gbtn--ghost"
            aria-label="Fermer"
            @click="selectedId = null"
          >
            ✕
          </button>
        </div>
      </div>
    </Transition>

    <CardZoomModal
      :card="zoomCard"
      :open="zoomOpen"
      @close="zoomOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card } from "@/types/cards";
import type {
  CardCounters,
  Position,
  RedactedInstance,
  RedactedZone,
  Seat,
  ZoneRef,
} from "@/game";
import GameCard from "./GameCard.vue";
import HandFan from "./HandFan.vue";
import type { HandItem } from "./HandFan.vue";
import SeatHud from "./SeatHud.vue";
import PileStack from "./PileStack.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";
import { useBoardDnd } from "@/composables/useBoardDnd";

const store = useGameStore();
const cardStore = useCardStore();
const dnd = useBoardDnd();

const me = computed(() => store.perspective);
const opp = computed(() => store.opponent);

const cardIndex = computed(() => {
  const m = new Map<string, Card>();
  for (const c of cardStore.cards) m.set(c.id, c);
  return m;
});
function resolveCard(cardId: string | null): Card | null {
  return cardId ? (cardIndex.value.get(cardId) ?? null) : null;
}

const view = computed(() => store.view);

function instancesOf(z: RedactedZone | null): RedactedInstance[] {
  return z && z.kind === "full" ? z.instances : [];
}
function mondeOwned(seat: Seat): RedactedInstance[] {
  return instancesOf(view.value.monde).filter((i) => i.owner === seat);
}
function havreId(seat: Seat): string | undefined {
  return view.value.seats[seat].havreSacInstanceId;
}
function baseCards(seat: Seat): RedactedInstance[] {
  const havre = mondeOwned(seat).filter((i) => i.instanceId === havreId(seat));
  return [...havre, ...instancesOf(view.value.seats[seat].havreSac)];
}
function allies(seat: Seat): RedactedInstance[] {
  return mondeOwned(seat).filter((i) => i.instanceId !== havreId(seat));
}
const queue = computed(() => instancesOf(view.value.fileAttente));

function handList(seat: Seat): HandItem[] {
  const z = view.value.seats[seat].main;
  if (z.kind === "full")
    return z.instances.map((i) => ({ key: i.instanceId, inst: i }));
  return Array.from({ length: z.count }, (_, i) => ({
    key: `back-${seat}-${i}`,
    inst: null,
  }));
}
function piocheCount(seat: Seat): number {
  const z = view.value.seats[seat].pioche;
  return z.kind === "count" ? z.count : z.instances.length;
}
function discardCount(seat: Seat): number {
  return instancesOf(view.value.seats[seat].defausse).length;
}
function topDiscard(seat: Seat): RedactedInstance | null {
  return instancesOf(view.value.seats[seat].defausse)[0] ?? null;
}
function reserveCount(seat: Seat): number {
  const z = view.value.seats[seat].reserve;
  return !z ? 0 : z.kind === "count" ? z.count : z.instances.length;
}

// ── Glisser-déposer (pointer, façon MTGA) ────────────────────────────────────
function registerZone(
  id: string,
  el: Element | ComponentPublicInstance | null,
  zone: ZoneRef,
  label: string,
  position?: Position,
): void {
  dnd.registerZone(id, el as HTMLElement | null, { zone, position, label });
}
function zoneCls(id: string): Record<string, boolean> {
  return {
    gdrop: true,
    "gdrop--on": dnd.isDragging.value,
    "gdrop--over": dnd.hoveredZoneId.value === id,
  };
}
onMounted(() => {
  dnd.setDropHandler((instanceId, spec) => {
    store.moveTo(instanceId, spec.zone, spec.position ?? { at: "any" });
  });
});
onUnmounted(() => {
  dnd.setDropHandler(null);
  dnd.resetZones();
});

// ── Sélection / actions ──────────────────────────────────────────────────────
const selectedId = ref<string | null>(null);
// changement de joueur (passation) → on referme la barre d'action
watch(
  () => store.perspective,
  () => {
    selectedId.value = null;
  },
);
const selectedInst = computed(() =>
  selectedId.value ? (store.state.instances[selectedId.value] ?? null) : null,
);
const selectedName = computed(() => {
  const inst = selectedInst.value;
  if (!inst) return "";
  return resolveCard(inst.cardId)?.name ?? "Carte face cachée";
});
function select(instanceId: string): void {
  selectedId.value = selectedId.value === instanceId ? null : instanceId;
}
function moveSelected(
  zone: "monde" | "havreSac" | "main" | "defausse" | "pioche",
  position: Position = { at: "any" },
): void {
  const inst = selectedInst.value;
  if (!inst) return;
  const ref =
    zone === "monde" ? { zone } : ({ zone, owner: inst.owner } as const);
  store.moveTo(inst.instanceId, ref, position);
  selectedId.value = null;
}
function tapSelected(): void {
  if (selectedInst.value) store.toggleTap(selectedInst.value.instanceId);
}
function bumpDamage(delta: number): void {
  if (selectedInst.value)
    store.adjustCounter(selectedInst.value.instanceId, "damage", delta);
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);
function zoomInst(instanceId: string): void {
  const inst = store.state.instances[instanceId];
  const card = inst ? resolveCard(inst.cardId) : null;
  if (card) {
    zoomCard.value = card;
    zoomOpen.value = true;
  }
}

// ── HUD de siège ─────────────────────────────────────────────────────────────
function heroInst(seat: Seat) {
  const id = view.value.seats[seat].heroInstanceId;
  return id ? (store.state.instances[id] ?? null) : null;
}
function heroPortrait(seat: Seat): string | null {
  const inst = heroInst(seat);
  if (!inst?.cardId) return null;
  return getThumbPath(`/images/cards/${inst.cardId}_recto.webp`);
}
function heroName(seat: Seat): string | null {
  return resolveCard(heroInst(seat)?.cardId ?? null)?.name ?? null;
}
function heroAccent(seat: Seat): string {
  const card = resolveCard(heroInst(seat)?.cardId ?? null);
  return elementColor(card?.stats?.niveau?.element);
}
function heroCounters(seat: Seat): CardCounters {
  return heroInst(seat)?.counters ?? {};
}
function bumpHero(seat: Seat, counter: string, delta: number): void {
  const id = view.value.seats[seat].heroInstanceId;
  if (id) store.adjustCounter(id, counter, delta);
}
</script>

<style scoped>
.gtable {
  --card-field: clamp(78px, 6.6vw, 104px);
  --card-wide: clamp(70px, 5.8vw, 90px);
  --card-hand: clamp(96px, 8.6vw, 128px);
  --card-opp: clamp(54px, 4.6vw, 68px);
  --pile: clamp(54px, 4.8vw, 70px);
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px clamp(12px, 2.5vw, 36px);
  border-radius: 12px;
  color: #f6f5f1;
  background:
    radial-gradient(
      60% 38% at 50% 50%,
      rgba(240, 78, 34, 0.07) 0%,
      transparent 100%
    ),
    radial-gradient(120% 90% at 50% 50%, #2c2720 0%, #1a1611 58%, #0d0a07 100%);
  box-shadow:
    inset 0 0 140px rgba(0, 0, 0, 0.65),
    inset 0 0 0 1px rgba(240, 78, 34, 0.16);
  overflow: hidden;
}
.gtable::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.022) 1px,
    transparent 1px
  );
  background-size: 5px 5px;
  pointer-events: none;
}
.gseat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

/* ── Bande de siège : HUD · socle · main · piles ── */
.gseat__strip {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: clamp(10px, 1.2vw, 18px);
  align-items: stretch;
}
.gseat__handzone {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  border-radius: 12px;
}
.gseat__handzone--opp {
  align-items: center;
}

/* ── Zones ── */
.gzone {
  position: relative;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  padding: 18px 12px 10px;
}
.gzone--base {
  border: 1px solid rgba(240, 78, 34, 0.28);
}
.gzone--field {
  flex: 1;
  min-height: calc(var(--card-field) * 88 / 63 + 30px);
  display: flex;
  align-items: center;
}
.gzone--play {
  border: 1px dashed rgba(240, 78, 34, 0.3);
}
.gzone__cards {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vw, 14px);
  flex-wrap: wrap;
}
.gzone--field .gzone__cards {
  width: 100%;
  justify-content: center;
}
.gzone__label {
  position: absolute;
  top: 5px;
  left: 10px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.4);
}
.gzone__hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-style: italic;
  color: rgba(240, 78, 34, 0.55);
  pointer-events: none;
}

/* ── Surbrillance des zones de drop ── */
.gdrop {
  transition:
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}
.gdrop--on {
  box-shadow:
    inset 0 0 0 2px rgba(240, 166, 43, 0.4),
    0 0 14px rgba(240, 166, 43, 0.12);
  animation: gdrop-breathe 1.6s ease-in-out infinite;
}
.gdrop--over {
  background-color: rgba(240, 166, 43, 0.14);
  box-shadow:
    inset 0 0 0 2px #f0a62b,
    0 0 26px rgba(240, 166, 43, 0.4);
  animation: none;
  transform: scale(1.012);
}
@keyframes gdrop-breathe {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 2px rgba(240, 166, 43, 0.4),
      0 0 14px rgba(240, 166, 43, 0.12);
  }
  50% {
    box-shadow:
      inset 0 0 0 2px rgba(240, 166, 43, 0.62),
      0 0 22px rgba(240, 166, 43, 0.24);
  }
}

/* ── Ligne médiane ── */
.gmid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 6px 14px;
  border-radius: 6px;
  border-top: 2px solid rgba(240, 78, 34, 0.5);
  border-bottom: 2px solid rgba(240, 78, 34, 0.5);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(240, 78, 34, 0.08) 18%,
    rgba(240, 78, 34, 0.08) 82%,
    transparent
  );
}
.gmid__label {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #f04e22;
  text-shadow: 0 0 16px rgba(240, 78, 34, 0.5);
}
.gmid__queue {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gmid__queue-label {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.55);
}

/* ── Slots ── */
.gslot {
  width: var(--card-field);
}
.gslot--wide {
  width: var(--card-wide);
}
.gslot--small {
  width: var(--card-opp);
}

/* FLIP des zones du terrain */
.zone-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.3, 1);
}
.zone-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.2, 1.15, 0.3, 1),
    opacity 0.22s ease;
}
.zone-enter-from {
  transform: translateY(-14px) scale(0.65);
  opacity: 0;
}
.zone-leave-active {
  position: absolute;
  transition:
    transform 0.2s ease,
    opacity 0.16s ease;
}
.zone-leave-to {
  transform: scale(0.8);
  opacity: 0;
}

/* ── Piles ── */
.gpiles {
  display: flex;
  gap: 10px;
  align-self: center;
}
.gpiles__slot {
  display: block;
  border-radius: 8px;
}

/* ── Bouton Fin du tour ── */
.gendturn {
  position: absolute;
  right: clamp(10px, 1.6vw, 26px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 18;
  width: clamp(72px, 6.4vw, 90px);
  height: clamp(72px, 6.4vw, 90px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(
    120% 120% at 30% 25%,
    #3a2e22 0%,
    #241c13 55%,
    #160f09 100%
  );
  border: 1px solid rgba(240, 166, 43, 0.5);
  box-shadow:
    0 6px 22px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.gendturn:hover {
  transform: translateY(-50%) scale(1.06);
}
.gendturn:active {
  transform: translateY(-50%) scale(0.97);
}
.gendturn:focus-visible {
  outline: 2px solid #f0a62b;
  outline-offset: 3px;
}
.gendturn__ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(240, 166, 43, 0) 0%,
    rgba(240, 166, 43, 0.75) 25%,
    rgba(240, 78, 34, 0.9) 50%,
    rgba(240, 166, 43, 0.75) 75%,
    rgba(240, 166, 43, 0) 100%
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2px)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2px)
  );
  animation: gendturn-spin 4s linear infinite;
  pointer-events: none;
}
@keyframes gendturn-spin {
  to {
    transform: rotate(360deg);
  }
}
.gendturn__txt {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  color: #f0a62b;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* ── Barre d'action ── */
.gactionbar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(96%, 1000px);
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  background: rgba(14, 11, 8, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(240, 166, 43, 0.35);
  border-radius: 999px;
  padding: 9px 22px;
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  z-index: 20;
}
.gactionbar__name {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
  white-space: nowrap;
}
.gactionbar__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
}
.gactionbar__sep {
  width: 1px;
  height: 20px;
  background: rgba(246, 245, 241, 0.2);
}
.gbtn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(246, 245, 241, 0.1);
  color: #f6f5f1;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}
.gbtn:hover {
  background: rgba(246, 245, 241, 0.22);
  transform: translateY(-1px);
}
.gbtn:active {
  transform: translateY(0) scale(0.97);
}
.gbtn--accent {
  background: rgba(240, 78, 34, 0.32);
}
.gbtn--accent:hover {
  background: #f04e22;
}
.gbtn--counter {
  font-family: "Space Mono", ui-monospace, monospace;
}
.gbtn--ghost {
  background: transparent;
  outline: 1px solid rgba(246, 245, 241, 0.25);
}
.slideup-enter-active,
.slideup-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slideup-enter-from,
.slideup-leave-to {
  transform: translate(-50%, 14px);
  opacity: 0;
}

@media (max-width: 1024px) {
  .gtable {
    height: auto;
    min-height: 0;
  }
  .gzone--field {
    flex: none;
  }
  .gseat__strip {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .gseat__handzone {
    grid-column: 1 / -1;
    order: 3;
  }
  .gpiles {
    justify-self: start;
  }
  .gendturn {
    position: relative;
    right: auto;
    top: auto;
    transform: none;
    align-self: flex-end;
  }
  .gendturn:hover,
  .gendturn:active {
    transform: none;
  }
}
@media (max-width: 640px) {
  .gtable {
    padding: 10px 8px 16px;
  }
  .gseat__strip {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gdrop--on,
  .gendturn__ring {
    animation: none;
  }
  .zone-move,
  .zone-enter-active,
  .zone-leave-active {
    transition: none;
  }
}
</style>
