<template>
  <div class="board">
    <!-- ───────── Adversaire (siège B) ───────── -->
    <section class="board__player board__player--opp">
      <div class="board__statusrow">
        <SeatBadge seat="B" :counters="heroCounters('B')" />
      </div>
      <div class="board__zones">
        <GameZone
          :zone="view.seats.B.havreSac"
          label="Havre-Sac B"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
        <GameZone
          :zone="view.seats.B.main"
          label="Main B"
          layout="fan"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
        <GameZone
          :zone="view.seats.B.defausse"
          label="Défausse B"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
        <GameZone
          :zone="view.seats.B.pioche"
          label="Pioche B"
          force-pile
          :resolve-card="resolveCard"
          @pile="store.draw('B')"
        />
      </div>
    </section>

    <!-- ───────── Monde commun ───────── -->
    <section class="board__world">
      <p class="eyebrow text-primary board__world-label">Le Monde</p>
      <GameZone
        :zone="view.monde"
        label="Monde"
        :resolve-card="resolveCard"
        :selected-id="selectedId"
        @select="select"
        @zoom="zoom"
      />
    </section>

    <!-- ───────── Joueur (siège A) ───────── -->
    <section class="board__player">
      <div class="board__zones">
        <GameZone
          :zone="view.seats.A.pioche"
          label="Pioche A"
          force-pile
          :resolve-card="resolveCard"
          @pile="store.draw('A')"
        />
        <GameZone
          :zone="view.seats.A.defausse"
          label="Défausse A"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
        <GameZone
          :zone="view.seats.A.havreSac"
          label="Havre-Sac A"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
        <GameZone
          :zone="view.seats.A.main"
          label="Main A"
          layout="fan"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoom"
        />
      </div>
      <div class="board__statusrow">
        <SeatBadge seat="A" :counters="heroCounters('A')" />
      </div>
    </section>

    <!-- ───────── Barre de la carte sélectionnée ───────── -->
    <Transition name="fade">
      <div v-if="selectedInst" class="board__actionbar">
        <span class="board__actionbar-name">{{ selectedName }}</span>
        <div class="board__actionbar-btns">
          <button class="gbtn" @click="moveSelected('monde')">Monde</button>
          <button class="gbtn" @click="moveSelected('havreSac')">
            Havre-Sac
          </button>
          <button class="gbtn" @click="moveSelected('main')">Main</button>
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
          <button class="gbtn" @click="tapSelected">
            {{
              selectedInst.orientation === "tapped" ? "Redresser" : "Incliner"
            }}
          </button>
          <span class="board__actionbar-sep"></span>
          <button class="gbtn gbtn--counter" @click="bumpDamage(1)">
            + Dmg
          </button>
          <button class="gbtn gbtn--counter" @click="bumpDamage(-1)">
            − Dmg
          </button>
          <button class="gbtn" @click="zoomSelected">Agrandir</button>
          <button class="gbtn gbtn--ghost" @click="selectedId = null">
            Fermer
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
import { computed, h, ref } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card } from "@/types/cards";
import type { CardCounters, Position } from "@/game";
import GameZone from "./GameZone.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";

const store = useGameStore();
const cardStore = useCardStore();

const cardIndex = computed(() => {
  const m = new Map<string, Card>();
  for (const c of cardStore.cards) m.set(c.id, c);
  return m;
});
function resolveCard(cardId: string | null): Card | null {
  return cardId ? (cardIndex.value.get(cardId) ?? null) : null;
}

const view = computed(() => store.view);

function heroCounters(seat: "A" | "B"): CardCounters {
  const id = view.value.seats[seat].heroInstanceId;
  return id ? (store.state.instances[id]?.counters ?? {}) : {};
}

// ── Sélection / actions ──────────────────────────────────────────────────────
const selectedId = ref<string | null>(null);
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
function zoom(instanceId: string): void {
  const inst = store.state.instances[instanceId];
  const card = inst ? resolveCard(inst.cardId) : null;
  if (card) {
    zoomCard.value = card;
    zoomOpen.value = true;
  }
}
function zoomSelected(): void {
  if (selectedId.value) zoom(selectedId.value);
}

// ── Badge de siège (compteurs Héros cliquables) — composant local ────────────
const SeatBadge = (props: { seat: "A" | "B"; counters: CardCounters }) => {
  const c = props.counters;
  const stat = (
    label: string,
    value: number | undefined,
    counter: "hp" | "xp" | "level",
  ) =>
    h("div", { class: "seatbadge__stat" }, [
      h("span", { class: "seatbadge__k" }, label),
      h("span", { class: "seatbadge__v" }, String(value ?? "—")),
      h("span", { class: "seatbadge__pm" }, [
        h(
          "button",
          {
            class: "seatbadge__btn",
            onClick: () => bumpSeat(props.seat, counter, 1),
          },
          "+",
        ),
        h(
          "button",
          {
            class: "seatbadge__btn",
            onClick: () => bumpSeat(props.seat, counter, -1),
          },
          "−",
        ),
      ]),
    ]);
  return h("div", { class: "seatbadge" }, [
    h("span", { class: "seatbadge__seat" }, `Siège ${props.seat}`),
    stat("PV", c.hp, "hp"),
    stat("XP", c.xp, "xp"),
    stat("Niv", c.level, "level"),
  ]);
};
function bumpSeat(
  seat: "A" | "B",
  counter: "hp" | "xp" | "level",
  delta: number,
): void {
  const id = view.value.seats[seat].heroInstanceId;
  if (id) store.adjustCounter(id, counter, delta);
}
</script>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  padding-bottom: 72px;
}
.board__player {
  background: var(--paper-200, #edebe4);
  border: 1px solid rgba(27, 26, 23, 0.12);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.board__player--opp {
  background: rgba(27, 26, 23, 0.04);
}
.board__zones {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 14px;
  align-items: start;
}
.board__player--opp .board__zones {
  grid-template-columns: auto 1fr auto auto;
}
.board__world {
  border-top: 2px solid #1b1a17;
  border-bottom: 2px solid #1b1a17;
  padding: 10px 12px;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 38px,
    rgba(27, 26, 23, 0.04) 38px,
    rgba(27, 26, 23, 0.04) 39px
  );
}
.board__world-label {
  margin-bottom: 6px;
}
.board__statusrow {
  display: flex;
}
.board__actionbar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: #1b1a17;
  color: #f6f5f1;
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 -2px 12px rgba(27, 26, 23, 0.25);
}
.board__actionbar-name {
  font-family: Fraunces, Georgia, serif;
  font-size: 15px;
}
.board__actionbar-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.board__actionbar-sep {
  width: 1px;
  height: 20px;
  background: rgba(246, 245, 241, 0.25);
}
.gbtn {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 4px;
  background: rgba(246, 245, 241, 0.12);
  color: #f6f5f1;
  transition: background 0.15s ease;
}
.gbtn:hover {
  background: #f04e22;
}
.gbtn--counter {
  font-family: "Space Mono", ui-monospace, monospace;
}
.gbtn--ghost {
  background: transparent;
  outline: 1px solid rgba(246, 245, 241, 0.3);
}
:deep(.seatbadge) {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
:deep(.seatbadge__seat) {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(27, 26, 23, 0.55);
}
:deep(.seatbadge__stat) {
  display: flex;
  align-items: center;
  gap: 5px;
}
:deep(.seatbadge__k) {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(27, 26, 23, 0.5);
}
:deep(.seatbadge__v) {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 16px;
}
:deep(.seatbadge__pm) {
  display: inline-flex;
  gap: 2px;
}
:deep(.seatbadge__btn) {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background: rgba(27, 26, 23, 0.08);
  font-size: 12px;
  line-height: 1;
  display: grid;
  place-items: center;
}
:deep(.seatbadge__btn:hover) {
  background: #f04e22;
  color: #f6f5f1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 760px) {
  .board__zones,
  .board__player--opp .board__zones {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
