<template>
  <div class="gtable">
    <!-- ════════ ADVERSAIRE (siège B, en haut) ════════ -->
    <section class="gseat gseat--opp">
      <div
        class="gseat__hand gseat__hand--opp"
        role="group"
        aria-label="Main de l'adversaire"
      >
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
      <div class="gseat__row">
        <SeatHud seat="B" />
        <div class="gseat__base" aria-label="Socle adverse">
          <span class="gslot-label">Socle</span>
          <div class="gseat__base-cards">
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
          </div>
        </div>
        <div class="gseat__field" role="group" aria-label="Alliés adverses">
          <span v-if="!allies('B').length" class="gfield-hint">Alliés</span>
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
          <Pile
            label="Réserve"
            :count="reserveCount('B')"
            deck
            reserve
            @act="store.drawFromReserve('B')"
          />
        </div>
      </div>
    </section>

    <!-- ════════ LIGNE MÉDIANE — LE MONDE ════════ -->
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

    <!-- ════════ JOUEUR (siège A, en bas) ════════ -->
    <section class="gseat">
      <div class="gseat__row">
        <SeatHud seat="A" />
        <div class="gseat__base" aria-label="Votre socle">
          <span class="gslot-label">Socle</span>
          <div class="gseat__base-cards">
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
          </div>
        </div>
        <div class="gseat__field" role="group" aria-label="Vos alliés">
          <span v-if="!allies('A').length" class="gfield-hint"
            >Vos alliés (jouez une carte ici)</span
          >
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
          <Pile
            label="Réserve"
            :count="reserveCount('A')"
            deck
            reserve
            @act="store.drawFromReserve('A')"
          />
        </div>
      </div>
      <div class="gseat__hand" role="group" aria-label="Votre main">
        <div v-for="h in handList('A')" :key="h.key" class="ghand-card">
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
          ↑ Piochez pour remplir votre main
        </p>
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
          {
            class: "ghud__btn",
            "aria-label": `Augmenter ${k} siège ${props.seat}`,
            onClick: () => bumpHero(props.seat, key, 1),
          },
          "+",
        ),
        h(
          "button",
          {
            class: "ghud__btn",
            "aria-label": `Diminuer ${k} siège ${props.seat}`,
            onClick: () => bumpHero(props.seat, key, -1),
          },
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
    h("div", { class: "ghud__body" }, [
      h("span", { class: "ghud__seat" }, [
        h("span", { class: "ghud__seat-dot" }),
        h("span", { class: "ghud__hero" }, card?.name ?? `Siège ${props.seat}`),
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

/* ── Demi-plateaux : se répartissent la hauteur, contenu poussé vers la médiane ── */
.gseat {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

/* Rangée principale : HUD | Socle | Alliés (remplit) | Piles → occupe la largeur */
.gseat__row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: clamp(12px, 1.6vw, 26px);
  align-items: end;
}
.gseat--opp .gseat__row {
  align-items: start;
}

/* ── Socle (Havre-Sac + Héros) ── */
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
  color: rgba(246, 245, 241, 0.32);
  font-style: italic;
  letter-spacing: 0.05em;
  text-transform: none;
}

/* ── Ligne médiane ── */
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

/* ── Mains ── */
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

/* ── Slots de carte (terrain) ── */
.gslot {
  width: var(--card-field);
}
.gslot--wide {
  width: var(--card-wide);
}
.gslot--small {
  width: var(--card-opp);
}

/* ── Piles ── */
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

/* ── HUD (héros + stats) ── */
:deep(.ghud) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px 6px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(246, 245, 241, 0.08);
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
:deep(.ghud__hero) {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
  color: #f6f5f1;
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
  background: rgba(14, 11, 8, 0.97);
  border: 1px solid rgba(240, 78, 34, 0.45);
  border-radius: 9px;
  padding: 9px 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
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

/* ── Responsive ── */
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
