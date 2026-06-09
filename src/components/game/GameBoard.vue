<template>
  <div class="gtable">
    <!-- ════════ ADVERSAIRE (en haut, main cachée) ════════ -->
    <section class="gseat gseat--opp">
      <div
        class="gseat__hand gseat__hand--opp"
        role="group"
        aria-label="Main de l'adversaire"
      >
        <div
          v-for="hcard in handList(opp)"
          :key="hcard.key"
          class="ghand-card ghand-card--opp"
        >
          <GameCard
            v-if="hcard.inst"
            :instance="hcard.inst"
            :card="resolveCard(hcard.inst.cardId)"
            @select="select(hcard.inst.instanceId)"
            @zoom="zoomInst(hcard.inst.instanceId)"
          />
          <div v-else class="ghand-back"></div>
        </div>
      </div>
      <div class="gseat__row">
        <SeatHud :seat="opp" />
        <div class="gseat__base" aria-label="Socle adverse">
          <span class="gslot-label">Socle</span>
          <div class="gseat__base-cards">
            <CardSlot
              v-for="inst in baseCards(opp)"
              :key="inst.instanceId"
              wide
              :inst="inst"
              :card="resolveCard(inst.cardId)"
              :selected-id="selectedId"
              @select="select"
              @zoom="zoomInst"
            />
          </div>
        </div>
        <div class="gseat__field" role="group" aria-label="Alliés adverses">
          <span v-if="!allies(opp).length" class="gfield-hint"
            >Alliés adverses</span
          >
          <CardSlot
            v-for="inst in allies(opp)"
            :key="inst.instanceId"
            :inst="inst"
            :card="resolveCard(inst.cardId)"
            :selected-id="selectedId"
            @select="select"
            @zoom="zoomInst"
          />
        </div>
        <div class="gseat__piles">
          <Pile label="Pioche" :count="piocheCount(opp)" deck />
          <Pile
            label="Défausse"
            :top="topDiscard(opp)"
            :count="discardCount(opp)"
            :resolve="resolveCard"
            @zoom="zoomInst"
          />
          <Pile label="Réserve" :count="reserveCount(opp)" deck reserve />
        </div>
      </div>
    </section>

    <!-- ════════ LIGNE MÉDIANE — LE MONDE / FILE D'ATTENTE ════════ -->
    <div class="gmid">
      <span class="gmid__label">⬩ Le Monde ⬩</span>
      <div v-if="queue.length" class="gmid__queue">
        <span class="gmid__queue-label">File d'attente</span>
        <CardSlot
          v-for="inst in queue"
          :key="inst.instanceId"
          small
          :inst="inst"
          :card="resolveCard(inst.cardId)"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
      </div>
    </div>

    <!-- ════════ TOI (en bas, main révélée) ════════ -->
    <section class="gseat">
      <div class="gseat__row">
        <SeatHud :seat="me" />
        <div
          class="gseat__base gseat__drop"
          aria-label="Votre socle"
          @dragover.prevent
          @drop.prevent="onDrop($event, { zone: 'havreSac', owner: me })"
        >
          <span class="gslot-label">Socle</span>
          <div class="gseat__base-cards">
            <CardSlot
              v-for="inst in baseCards(me)"
              :key="inst.instanceId"
              wide
              draggable
              :inst="inst"
              :card="resolveCard(inst.cardId)"
              :selected-id="selectedId"
              @select="select"
              @zoom="zoomInst"
            />
          </div>
        </div>
        <div
          class="gseat__field gseat__field--play gseat__drop"
          role="group"
          aria-label="Vos alliés"
          @dragover.prevent
          @drop.prevent="onDrop($event, { zone: 'monde' })"
        >
          <span v-if="!allies(me).length" class="gfield-hint"
            >⬇ Glissez une carte ici pour la jouer</span
          >
          <CardSlot
            v-for="inst in allies(me)"
            :key="inst.instanceId"
            draggable
            :inst="inst"
            :card="resolveCard(inst.cardId)"
            :selected-id="selectedId"
            @select="select"
            @zoom="zoomInst"
          />
        </div>
        <div class="gseat__piles">
          <span
            class="gseat__drop"
            @dragover.prevent
            @drop.prevent="
              onDrop($event, { zone: 'pioche', owner: me }, { at: 'top' })
            "
          >
            <Pile
              label="Pioche"
              :count="piocheCount(me)"
              deck
              @act="store.draw(me)"
            />
          </span>
          <span
            class="gseat__drop"
            @dragover.prevent
            @drop.prevent="
              onDrop($event, { zone: 'defausse', owner: me }, { at: 'top' })
            "
          >
            <Pile
              label="Défausse"
              :top="topDiscard(me)"
              :count="discardCount(me)"
              :resolve="resolveCard"
              @zoom="zoomInst"
            />
          </span>
          <span
            class="gseat__drop"
            @dragover.prevent
            @drop.prevent="onDrop($event, { zone: 'reserve', owner: me })"
          >
            <Pile
              label="Réserve"
              :count="reserveCount(me)"
              deck
              reserve
              @act="store.drawFromReserve(me)"
            />
          </span>
        </div>
      </div>
      <div class="gseat__hand" role="group" aria-label="Votre main">
        <div v-for="hcard in handList(me)" :key="hcard.key" class="ghand-card">
          <GameCard
            v-if="hcard.inst"
            :instance="hcard.inst"
            :card="resolveCard(hcard.inst.cardId)"
            draggable
            :selected="hcard.inst.instanceId === selectedId"
            @select="select(hcard.inst.instanceId)"
            @zoom="zoomInst(hcard.inst.instanceId)"
          />
          <div v-else class="ghand-back"></div>
        </div>
        <p v-if="!handList(me).length" class="gseat__hand-empty">Main vide</p>
      </div>
    </section>

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
          <button class="gbtn" @click="moveSelected('monde')">→ Monde</button>
          <button class="gbtn" @click="moveSelected('havreSac')">
            → Havre-Sac
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
          <button class="gbtn gbtn--accent" @click="tapSelected">
            {{
              selectedInst.orientation === "tapped"
                ? "↺ Redresser"
                : "↻ Incliner"
            }}
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
            @click="selectedId = null"
            aria-label="Fermer"
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
import { computed, h, ref } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card } from "@/types/cards";
import type {
  Position,
  RedactedInstance,
  RedactedZone,
  Seat,
  ZoneRef,
} from "@/game";
import GameCard from "./GameCard.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";

const store = useGameStore();
const cardStore = useCardStore();

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

function handList(
  seat: Seat,
): { key: string; inst: RedactedInstance | null }[] {
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

// ── Glisser-déposer ──────────────────────────────────────────────────────────
function onDrop(
  e: DragEvent,
  to: ZoneRef,
  position: Position = { at: "any" },
): void {
  const id = e.dataTransfer?.getData("text/plain");
  if (id) store.moveTo(id, to, position);
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
function zoomInst(instanceId: string): void {
  const inst = store.state.instances[instanceId];
  const card = inst ? resolveCard(inst.cardId) : null;
  if (card) {
    zoomCard.value = card;
    zoomOpen.value = true;
  }
}

// ── HUD de siège ─────────────────────────────────────────────────────────────
function heroPortrait(seat: Seat): string | null {
  const id = view.value.seats[seat].heroInstanceId;
  const inst = id ? store.state.instances[id] : null;
  if (!inst?.cardId) return null;
  return getThumbPath(`/images/cards/${inst.cardId}_recto.webp`);
}
function bumpHero(seat: Seat, counter: string, delta: number): void {
  const id = view.value.seats[seat].heroInstanceId;
  if (id) store.adjustCounter(id, counter, delta);
}

const SeatHud = (props: { seat: Seat }) => {
  const id = view.value.seats[props.seat].heroInstanceId;
  const inst = id ? store.state.instances[id] : null;
  const c = inst?.counters ?? {};
  const card = inst ? resolveCard(inst.cardId) : null;
  const accent = elementColor(card?.stats?.niveau?.element);
  const portrait = heroPortrait(props.seat);
  const active = store.turn.active === props.seat;
  const stat = (k: string, key: string, val: number | undefined, big = false) =>
    h("div", { class: ["ghud__stat", big ? "ghud__stat--big" : ""] }, [
      h("span", { class: "ghud__k" }, k),
      h("span", { class: "ghud__v" }, String(val ?? "—")),
      h("span", { class: "ghud__pm" }, [
        h(
          "button",
          {
            class: "ghud__btn",
            "aria-label": `+ ${k}`,
            onClick: () => bumpHero(props.seat, key, 1),
          },
          "+",
        ),
        h(
          "button",
          {
            class: "ghud__btn",
            "aria-label": `− ${k}`,
            onClick: () => bumpHero(props.seat, key, -1),
          },
          "−",
        ),
      ]),
    ]);
  return h(
    "div",
    {
      class: ["ghud", active ? "ghud--active" : ""],
      style: { "--accent": accent },
    },
    [
      portrait
        ? h("img", {
            class: "ghud__portrait",
            src: portrait,
            alt: card?.name ?? "",
          })
        : h("div", { class: "ghud__portrait ghud__portrait--empty" }),
      h("div", { class: "ghud__body" }, [
        h("span", { class: "ghud__seat" }, [
          h("span", { class: "ghud__seat-dot" }),
          h("span", { class: "ghud__name" }, store.players[props.seat].name),
          active ? h("span", { class: "ghud__active" }, "● actif") : null,
        ]),
        h("div", { class: "ghud__row" }, [
          stat("PV", "hp", c.hp, true),
          stat("PA", "pa", c.pa),
          stat("PM", "pm", c.pm),
          stat("XP", "xp", c.xp),
          stat("NIV", "level", c.level),
        ]),
      ]),
    ],
  );
};

// ── Pile (Pioche / Défausse / Réserve) ───────────────────────────────────────
const Pile = (
  props: {
    label: string;
    count?: number;
    deck?: boolean;
    reserve?: boolean;
    top?: RedactedInstance | null;
    resolve?: (id: string | null) => Card | null;
  },
  { emit }: { emit: (e: string, ...a: unknown[]) => void },
) => {
  const count = props.count ?? 0;
  const topCard =
    props.top && props.resolve ? props.resolve(props.top.cardId) : null;
  const img =
    !props.deck && props.top && topCard
      ? getThumbPath(
          topCard.mainType === "Héros"
            ? `/images/cards/${props.top.cardId}_recto.webp`
            : `/images/cards/${props.top.cardId}.webp`,
        )
      : null;
  return h(
    "button",
    {
      class: [
        "gpile",
        props.deck ? "gpile--deck" : "gpile--discard",
        props.reserve ? "gpile--reserve" : "",
        count === 0 ? "gpile--empty" : "",
      ],
      onClick: () =>
        props.deck
          ? emit("act")
          : props.top
            ? emit("zoom", props.top.instanceId)
            : emit("act"),
      "aria-label": `${props.label} : ${count} cartes`,
    },
    [
      img ? h("img", { class: "gpile__img", src: img, alt: "" }) : null,
      h("span", { class: "gpile__count" }, String(count)),
      h("span", { class: "gpile__label" }, props.label),
    ],
  );
};

// ── Slot de carte (terrain) ──────────────────────────────────────────────────
const CardSlot = (
  props: {
    inst: RedactedInstance;
    card: Card | null;
    selectedId: string | null;
    wide?: boolean;
    small?: boolean;
    draggable?: boolean;
  },
  { emit }: { emit: (e: string, ...a: unknown[]) => void },
) =>
  h(
    "div",
    {
      class: [
        "gslot",
        props.wide ? "gslot--wide" : "",
        props.small ? "gslot--small" : "",
      ],
    },
    [
      h(GameCard, {
        instance: props.inst,
        card: props.card,
        selected: props.inst.instanceId === props.selectedId,
        draggable: props.draggable,
        onSelect: () => emit("select", props.inst.instanceId),
        onZoom: () => emit("zoom", props.inst.instanceId),
      }),
    ],
  );
</script>

<style scoped>
.gtable {
  --card-field: clamp(78px, 7vw, 108px);
  --card-wide: clamp(84px, 7.5vw, 116px);
  --card-hand: clamp(108px, 10vw, 150px);
  --card-opp: clamp(64px, 6vw, 84px);
  --pile: clamp(64px, 6vw, 86px);
  position: relative;
  height: calc(100dvh - 168px);
  min-height: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px clamp(12px, 2.5vw, 36px);
  border-radius: 10px;
  color: #f6f5f1;
  background: radial-gradient(
    120% 90% at 50% 50%,
    #2c2720 0%,
    #1a1611 58%,
    #0e0b08 100%
  );
  box-shadow:
    inset 0 0 140px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(240, 78, 34, 0.18);
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
  justify-content: space-between;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.gseat__row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: clamp(12px, 1.6vw, 26px);
  align-items: end;
}
.gseat--opp .gseat__row {
  align-items: start;
}
.gseat__base,
.gseat__field {
  position: relative;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  padding: 18px 12px 10px;
}
.gseat__base {
  border: 1px solid rgba(240, 78, 34, 0.3);
}
.gseat__base-cards {
  display: flex;
  gap: 8px;
}
.gseat__field {
  display: flex;
  align-items: flex-end;
  gap: clamp(8px, 1vw, 14px);
  flex-wrap: wrap;
  min-height: calc(var(--card-field) * 88 / 63 + 28px);
}
.gseat--opp .gseat__field {
  align-items: flex-start;
}
.gseat__field--play {
  border: 1px dashed rgba(240, 78, 34, 0.32);
}
.gseat__drop {
  transition:
    outline 0.12s ease,
    background 0.12s ease;
}
.gseat__drop.drag-over {
  outline: 2px dashed #f04e22;
  background: rgba(240, 78, 34, 0.12);
}
.gslot-label,
.gfield-hint {
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
.gfield-hint {
  position: static;
  align-self: center;
  margin: auto;
  color: rgba(240, 78, 34, 0.6);
  font-style: italic;
  letter-spacing: 0.05em;
  text-transform: none;
}
.gmid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 7px 14px;
  border-top: 2px solid rgba(240, 78, 34, 0.55);
  border-bottom: 2px solid rgba(240, 78, 34, 0.55);
  background: rgba(240, 78, 34, 0.06);
}
.gmid__label {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #f04e22;
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
.gseat__hand {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: calc(var(--card-hand) * 88 / 63 * 0.5);
  padding: 6px 0;
}
.gseat__hand--opp {
  align-items: flex-start;
  min-height: 60px;
}
.ghand-card {
  width: var(--card-hand);
  margin-left: -38px;
  transition: transform 0.18s ease;
}
.ghand-card:first-child {
  margin-left: 0;
}
.ghand-card:hover {
  transform: translateY(-30px) scale(1.04);
  z-index: 5;
}
.ghand-card--opp {
  width: var(--card-opp);
  margin-left: -26px;
}
.ghand-card--opp:hover {
  transform: translateY(8px);
}
.ghand-back {
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 5px;
  background: repeating-linear-gradient(
    45deg,
    #3f372e,
    #3f372e 6px,
    #2c2620 6px,
    #2c2620 12px
  );
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
}
.gseat__hand-empty {
  align-self: center;
  font-size: 14px;
  color: rgba(246, 245, 241, 0.5);
  font-style: italic;
}
.gslot {
  width: var(--card-field);
}
.gslot--wide {
  width: var(--card-wide);
}
.gslot--small {
  width: var(--card-opp);
}
.gseat__piles {
  display: flex;
  gap: 10px;
  align-self: center;
}
.gpile {
  position: relative;
  width: var(--pile);
  aspect-ratio: 63 / 88;
  border-radius: 6px;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid rgba(246, 245, 241, 0.18);
  background: repeating-linear-gradient(
    45deg,
    #3f372e,
    #3f372e 6px,
    #2c2620 6px,
    #2c2620 12px
  );
  box-shadow:
    2px 2px 0 rgba(0, 0, 0, 0.45),
    4px 4px 0 rgba(0, 0, 0, 0.28);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.gpile:hover {
  transform: translateY(-4px);
}
.gpile:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 2px;
}
.gpile--discard {
  background: rgba(0, 0, 0, 0.32);
  box-shadow: none;
}
.gpile--reserve {
  border-color: rgba(240, 166, 43, 0.5);
}
.gpile--empty {
  opacity: 0.5;
}
.gpile__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gpile__count {
  position: relative;
  z-index: 1;
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 22px;
  color: #f6f5f1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
}
.gpile__label {
  position: absolute;
  bottom: 3px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(246, 245, 241, 0.78);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
:deep(.ghud) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px 6px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(246, 245, 241, 0.08);
}
:deep(.ghud--active) {
  border-color: rgba(240, 78, 34, 0.7);
  box-shadow:
    0 0 0 1px rgba(240, 78, 34, 0.5),
    0 0 18px rgba(240, 78, 34, 0.25);
}
:deep(.ghud__portrait) {
  width: 76px;
  height: 76px;
  border-radius: 9px;
  object-fit: cover;
  object-position: center 16%;
  border: 2px solid var(--accent, #98a1af);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
  flex: 0 0 auto;
}
:deep(.ghud__portrait--empty) {
  background: rgba(255, 255, 255, 0.06);
}
:deep(.ghud__seat) {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}
:deep(.ghud__seat-dot) {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent, #98a1af);
}
:deep(.ghud__name) {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
  color: #f6f5f1;
}
:deep(.ghud__active) {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #f04e22;
}
:deep(.ghud__row) {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}
:deep(.ghud__stat) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
:deep(.ghud__k) {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.7);
}
:deep(.ghud__v) {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 22px;
  line-height: 1;
}
:deep(.ghud__stat--big .ghud__v) {
  font-size: 36px;
  color: #f0a62b;
}
:deep(.ghud__pm) {
  display: flex;
  gap: 3px;
  margin-top: 3px;
}
:deep(.ghud__btn) {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(246, 245, 241, 0.12);
  color: #f6f5f1;
  font-size: 14px;
  line-height: 1;
  display: grid;
  place-items: center;
}
:deep(.ghud__btn:hover) {
  background: #f04e22;
}
:deep(.ghud__btn:focus-visible) {
  outline: 2px solid #f04e22;
  outline-offset: 1px;
}
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
  background: rgba(14, 11, 8, 0.97);
  border: 1px solid rgba(240, 78, 34, 0.45);
  border-radius: 9px;
  padding: 9px 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  z-index: 20;
}
.gactionbar__name {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
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
  padding: 6px 11px;
  border-radius: 5px;
  background: rgba(246, 245, 241, 0.12);
  color: #f6f5f1;
  transition: background 0.15s ease;
}
.gbtn:hover {
  background: rgba(246, 245, 241, 0.24);
}
.gbtn--accent {
  background: rgba(240, 78, 34, 0.3);
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
  .gseat__row {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .gseat__piles {
    justify-self: start;
  }
}
@media (max-width: 640px) {
  .gtable {
    padding: 10px 8px 16px;
  }
  .gseat__row {
    grid-template-columns: 1fr;
  }
  .ghand-card {
    margin-left: -46px;
  }
  :deep(.ghud__btn) {
    width: 30px;
    height: 30px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ghand-card:hover,
  .gpile:hover {
    transform: none;
  }
}
</style>
