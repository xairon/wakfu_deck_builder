<template>
  <div class="gtable">
    <!-- ════════ ADVERSAIRE (siège B, en haut) ════════ -->
    <section class="gseat gseat--opp">
      <div class="gseat__rail">
        <SeatHud seat="B" />
        <div class="gseat__piles">
          <Pile
            label="Pioche"
            :count="piocheCount('B')"
            deck
            @act="store.draw('B')"
          />
          <Pile
            label="Défausse"
            :top="topDiscard('B')"
            :count="discardCount('B')"
            :resolve="resolveCard"
            @zoom="zoomInst"
          />
        </div>
      </div>
      <div class="gseat__hand gseat__hand--opp">
        <div
          v-for="h in handList('B')"
          :key="h.key"
          class="ghand-card ghand-card--opp"
        >
          <GameCard
            v-if="h.inst"
            :instance="h.inst"
            :card="resolveCard(h.inst.cardId)"
            :selected="h.inst.instanceId === selectedId"
            @select="select(h.inst.instanceId)"
            @zoom="zoomInst(h.inst.instanceId)"
          />
          <div v-else class="ghand-back"></div>
        </div>
      </div>
      <div class="gseat__field">
        <CardSlot
          v-for="inst in baseCards('B')"
          :key="inst.instanceId"
          wide
          :inst="inst"
          :card="resolveCard(inst.cardId)"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
        <span v-if="allies('B').length" class="gfield-div"></span>
        <CardSlot
          v-for="inst in allies('B')"
          :key="inst.instanceId"
          :inst="inst"
          :card="resolveCard(inst.cardId)"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
      </div>
    </section>

    <!-- ════════ LIGNE MÉDIANE — LE MONDE ════════ -->
    <div class="gmid">
      <span class="gmid__label">Le Monde</span>
      <span v-if="queue.length" class="gmid__queue">
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
      </span>
    </div>

    <!-- ════════ JOUEUR (siège A, en bas) ════════ -->
    <section class="gseat">
      <div class="gseat__field">
        <CardSlot
          v-for="inst in baseCards('A')"
          :key="inst.instanceId"
          wide
          :inst="inst"
          :card="resolveCard(inst.cardId)"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
        <span v-if="allies('A').length" class="gfield-div"></span>
        <CardSlot
          v-for="inst in allies('A')"
          :key="inst.instanceId"
          :inst="inst"
          :card="resolveCard(inst.cardId)"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
      </div>
      <div class="gseat__rail">
        <SeatHud seat="A" />
        <div class="gseat__piles">
          <Pile
            label="Pioche"
            :count="piocheCount('A')"
            deck
            @act="store.draw('A')"
          />
          <Pile
            label="Défausse"
            :top="topDiscard('A')"
            :count="discardCount('A')"
            :resolve="resolveCard"
            @zoom="zoomInst"
          />
        </div>
      </div>
      <div class="gseat__hand">
        <div
          v-for="(h, i) in handList('A')"
          :key="h.key"
          class="ghand-card"
          :style="{ '--i': i, '--n': handList('A').length }"
        >
          <GameCard
            v-if="h.inst"
            :instance="h.inst"
            :card="resolveCard(h.inst.cardId)"
            :selected="h.inst.instanceId === selectedId"
            @select="select(h.inst.instanceId)"
            @zoom="zoomInst(h.inst.instanceId)"
          />
          <div v-else class="ghand-back"></div>
        </div>
        <p v-if="!handList('A').length" class="gseat__hand-empty">
          Main vide — piochez.
        </p>
      </div>
    </section>

    <!-- ════════ Barre d'action de la carte sélectionnée ════════ -->
    <Transition name="slideup">
      <div v-if="selectedInst" class="gactionbar">
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
          <button class="gbtn gbtn--ghost" @click="selectedId = null">✕</button>
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
import type { Position, RedactedInstance, RedactedZone, Seat } from "@/game";
import GameCard from "./GameCard.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";

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

function instancesOf(z: RedactedZone): RedactedInstance[] {
  return z.kind === "full" ? z.instances : [];
}
function mondeOwned(seat: Seat): RedactedInstance[] {
  return instancesOf(view.value.monde).filter((i) => i.owner === seat);
}
function havreId(seat: Seat): string | undefined {
  return view.value.seats[seat].havreSacInstanceId;
}
/** Carte Havre-Sac + son contenu (Héros, équipements) = socle du joueur. */
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

// ── HUD de siège (composant local : portrait Héros + PV/PA/PM/XP/Niv) ────────
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
  const stat = (k: string, key: string, val: number | undefined, big = false) =>
    h("div", { class: ["ghud__stat", big ? "ghud__stat--big" : ""] }, [
      h("span", { class: "ghud__k" }, k),
      h("span", { class: "ghud__v" }, String(val ?? "—")),
      h("span", { class: "ghud__pm" }, [
        h(
          "button",
          { class: "ghud__btn", onClick: () => bumpHero(props.seat, key, 1) },
          "+",
        ),
        h(
          "button",
          { class: "ghud__btn", onClick: () => bumpHero(props.seat, key, -1) },
          "−",
        ),
      ]),
    ]);
  return h("div", { class: "ghud", style: { "--accent": accent } }, [
    portrait
      ? h("img", {
          class: "ghud__portrait",
          src: portrait,
          alt: card?.name ?? "",
        })
      : h("div", { class: "ghud__portrait ghud__portrait--empty" }),
    h("div", { class: "ghud__stats" }, [
      h("span", { class: "ghud__seat" }, [
        h("span", { class: "ghud__seat-dot" }),
        `Siège ${props.seat}`,
        card ? h("span", { class: "ghud__hero" }, card.name) : null,
      ]),
      h("div", { class: "ghud__row" }, [
        stat("PV", "hp", c.hp, true),
        stat("PA", "pa", c.pa),
        stat("PM", "pm", c.pm),
        stat("XP", "xp", c.xp),
        stat("NIV", "level", c.level),
      ]),
    ]),
  ]);
};

// ── Pile (Pioche / Défausse) — composant local ───────────────────────────────
const Pile = (
  props: {
    label: string;
    count?: number;
    deck?: boolean;
    top?: RedactedInstance | null;
    resolve?: (id: string | null) => Card | null;
  },
  { emit }: { emit: (e: string, ...a: unknown[]) => void },
) => {
  const count = props.count ?? 0;
  const topCard =
    props.top && props.resolve ? props.resolve(props.top.cardId) : null;
  const img =
    props.top && topCard
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
        count === 0 ? "gpile--empty" : "",
      ],
      onClick: () =>
        props.top ? emit("zoom", props.top.instanceId) : emit("act"),
      "aria-label": `${props.label} : ${count} cartes`,
    },
    [
      img ? h("img", { class: "gpile__img", src: img, alt: "" }) : null,
      h("span", { class: "gpile__count" }, String(count)),
      h("span", { class: "gpile__label" }, props.label),
    ],
  );
};

// ── Slot de carte (terrain) — composant local pour la taille/halo ────────────
const CardSlot = (
  props: {
    inst: RedactedInstance;
    card: Card | null;
    selectedId: string | null;
    wide?: boolean;
    small?: boolean;
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
        onSelect: () => emit("select", props.inst.instanceId),
        onZoom: () => emit("zoom", props.inst.instanceId),
      }),
    ],
  );
</script>

<style scoped>
.gtable {
  position: relative;
  min-height: 78vh;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 18px clamp(12px, 3vw, 40px) 90px;
  border-radius: 10px;
  color: #f6f5f1;
  background: radial-gradient(
    120% 90% at 50% 50%,
    #2a251f 0%,
    #1a1611 55%,
    #0f0c09 100%
  );
  box-shadow:
    inset 0 0 120px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(240, 78, 34, 0.12);
  overflow: hidden;
}
.gtable::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.025) 1px,
    transparent 1px
  );
  background-size: 4px 4px;
  pointer-events: none;
}

/* ── Demi-plateaux ── */
.gseat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.gseat--opp {
  flex-direction: column-reverse;
}
.gseat__rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.gseat__field {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 132px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.gseat--opp .gseat__field {
  align-items: flex-start;
}
.gfield-div {
  width: 1px;
  align-self: stretch;
  background: rgba(246, 245, 241, 0.12);
  margin: 4px 4px;
}

/* ── Ligne médiane ── */
.gmid {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  margin: 4px 0;
  border-top: 1px solid rgba(240, 78, 34, 0.4);
  border-bottom: 1px solid rgba(240, 78, 34, 0.4);
}
.gmid__label {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(240, 78, 34, 0.85);
}
.gmid__queue {
  display: flex;
  gap: 6px;
}

/* ── Mains ── */
.gseat__hand {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: 150px;
  padding-top: 8px;
}
.gseat__hand--opp {
  min-height: 64px;
  align-items: flex-start;
}
.ghand-card {
  width: 116px;
  margin-left: -26px;
  transition:
    transform 0.18s ease,
    margin 0.18s ease;
}
.ghand-card:first-child {
  margin-left: 0;
}
.ghand-card:hover {
  transform: translateY(-22px);
  z-index: 5;
}
.ghand-card--opp {
  width: 46px;
  margin-left: -18px;
}
.ghand-card--opp:hover {
  transform: none;
}
.ghand-back {
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 4px;
  background: repeating-linear-gradient(
    45deg,
    #3a322a,
    #3a322a 5px,
    #2c2620 5px,
    #2c2620 10px
  );
  border: 1px solid rgba(0, 0, 0, 0.4);
}
.gseat__hand-empty {
  align-self: center;
  font-size: 13px;
  color: rgba(246, 245, 241, 0.4);
  font-style: italic;
}

/* ── Slots de carte (terrain) ── */
.gslot {
  width: 86px;
}
.gslot--wide {
  width: 92px;
}
.gslot--small {
  width: 58px;
}

/* ── Piles ── */
.gseat__piles {
  display: flex;
  gap: 12px;
}
.gpile {
  position: relative;
  width: 72px;
  aspect-ratio: 63 / 88;
  border-radius: 5px;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid rgba(246, 245, 241, 0.15);
  background: repeating-linear-gradient(
    45deg,
    #3a322a,
    #3a322a 5px,
    #2c2620 5px,
    #2c2620 10px
  );
  box-shadow:
    2px 2px 0 rgba(0, 0, 0, 0.4),
    4px 4px 0 rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.gpile:hover {
  transform: translateY(-3px);
}
.gpile--discard {
  background: rgba(0, 0, 0, 0.3);
  box-shadow: none;
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
  font-size: 20px;
  color: #f6f5f1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.gpile__label {
  position: absolute;
  bottom: 3px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

/* ── HUD (héros + stats) ── */
:deep(.ghud) {
  display: flex;
  align-items: center;
  gap: 12px;
}
:deep(.ghud__portrait) {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  object-position: center 18%;
  border: 2px solid var(--accent, #98a1af);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  flex: 0 0 auto;
}
:deep(.ghud__portrait--empty) {
  background: rgba(255, 255, 255, 0.06);
}
:deep(.ghud__seat) {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.55);
  margin-bottom: 4px;
}
:deep(.ghud__seat-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent, #98a1af);
}
:deep(.ghud__hero) {
  font-family: Fraunces, Georgia, serif;
  font-size: 14px;
  text-transform: none;
  letter-spacing: 0;
  color: #f6f5f1;
}
:deep(.ghud__row) {
  display: flex;
  gap: 14px;
  align-items: flex-end;
}
:deep(.ghud__stat) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
:deep(.ghud__k) {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.5);
}
:deep(.ghud__v) {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 17px;
  line-height: 1;
}
:deep(.ghud__stat--big .ghud__v) {
  font-size: 28px;
  color: #f0a62b;
}
:deep(.ghud__pm) {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}
:deep(.ghud__btn) {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: rgba(246, 245, 241, 0.1);
  color: #f6f5f1;
  font-size: 11px;
  line-height: 1;
  display: grid;
  place-items: center;
}
:deep(.ghud__btn:hover) {
  background: #f04e22;
}

/* ── Barre d'action ── */
.gactionbar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  background: rgba(15, 12, 9, 0.96);
  border: 1px solid rgba(240, 78, 34, 0.4);
  border-radius: 8px;
  padding: 9px 14px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
  z-index: 10;
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
}
.gactionbar__sep {
  width: 1px;
  height: 20px;
  background: rgba(246, 245, 241, 0.2);
}
.gbtn {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 5px;
  background: rgba(246, 245, 241, 0.1);
  color: #f6f5f1;
  transition: background 0.15s ease;
}
.gbtn:hover {
  background: rgba(246, 245, 241, 0.2);
}
.gbtn--accent {
  background: rgba(240, 78, 34, 0.25);
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
  transform: translateY(12px);
  opacity: 0;
}
@media (max-width: 820px) {
  .gtable {
    min-height: auto;
  }
  .ghand-card {
    width: 92px;
    margin-left: -34px;
  }
  .gslot,
  .gslot--wide {
    width: 70px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ghand-card:hover,
  .gpile:hover {
    transform: none;
  }
}
</style>
