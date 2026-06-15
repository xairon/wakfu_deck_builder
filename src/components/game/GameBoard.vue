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
          :resources="store.resourcesOf(opp)"
          @bump="(c, d) => bumpHero(opp, c, d)"
        />
        <div class="ghavre" aria-label="Havre-Sac adverse et son intérieur">
          <div class="gzone ghavre__bag">
            <span class="gzone__label">Havre-Sac</span>
            <div
              v-for="inst in havreCard(opp)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
              :class="slotCls(inst.instanceId)"
            >
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </div>
          <div
            class="gzone ghavre__inside"
            aria-label="Intérieur du Havre-Sac adverse"
          >
            <span class="gzone__label"
              >Intérieur · {{ interiorCards(opp).length }}/{{
                havreTaille(opp)
              }}</span
            >
            <TransitionGroup tag="div" name="zone" class="gzone__cards">
              <div
                v-for="inst in interiorCards(opp)"
                :key="inst.instanceId"
                class="gslot gslot--small"
                :class="slotCls(inst.instanceId)"
              >
                <GameCard
                  :instance="inst"
                  :card="resolveCard(inst.cardId)"
                  :selected="inst.instanceId === selectedId"
                  @select="select(inst.instanceId)"
                  @zoom="zoomInst(inst.instanceId)"
                />
              </div>
              <div
                v-for="n in emptyInteriorSlots(opp)"
                :key="`ghost-opp-${n}`"
                class="gslot gslot--small gslot--ghost"
                aria-hidden="true"
              />
            </TransitionGroup>
          </div>
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
          <div
            v-for="inst in allies(opp)"
            :key="inst.instanceId"
            class="gslot"
            :class="slotCls(inst.instanceId)"
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
          <div
            v-for="inst in allies(me)"
            :key="inst.instanceId"
            class="gslot"
            :class="slotCls(inst.instanceId)"
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
      <div class="gseat__strip">
        <SeatHud
          :name="store.players[me].name"
          :active="store.turn.active === me"
          :portrait="heroPortrait(me)"
          :hero-name="heroName(me)"
          :accent="heroAccent(me)"
          :counters="heroCounters(me)"
          :resources="store.resourcesOf(me)"
          @bump="(c, d) => bumpHero(me, c, d)"
        />
        <div class="ghavre" aria-label="Havre-Sac et son intérieur">
          <div class="gzone ghavre__bag">
            <span class="gzone__label">Havre-Sac</span>
            <div
              v-for="inst in havreCard(me)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
              :class="slotCls(inst.instanceId)"
            >
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </div>
          <div
            class="gzone ghavre__inside"
            :class="zoneCls('socle')"
            aria-label="Intérieur du Havre-Sac"
            :ref="
              (el) =>
                registerZone(
                  'socle',
                  el,
                  { zone: 'havreSac', owner: me },
                  'Intérieur du Havre-Sac',
                )
            "
          >
            <span class="gzone__label"
              >Intérieur · {{ interiorCards(me).length }}/{{
                havreTaille(me)
              }}</span
            >
            <TransitionGroup tag="div" name="zone" class="gzone__cards">
              <div
                v-for="inst in interiorCards(me)"
                :key="inst.instanceId"
                class="gslot gslot--small"
                :class="slotCls(inst.instanceId)"
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
              <div
                v-for="n in emptyInteriorSlots(me)"
                :key="`ghost-me-${n}`"
                class="gslot gslot--small gslot--ghost"
                aria-hidden="true"
              />
            </TransitionGroup>
          </div>
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

    <!-- ════════ Bandeau de ciblage d'effet ════════ -->
    <Transition name="slidedown">
      <div
        v-if="store.effectTargeting"
        class="gcombat gcombat--effect"
        role="toolbar"
        aria-label="Ciblage d'effet"
      >
        <span class="gcombat__step">
          ✨ {{ store.effectTargeting.cardName }} —
          {{
            store.effectTargeting.op.op === "destroyTarget"
              ? `choisis ${
                  store.effectTargeting.op.what === "Allié"
                    ? "l'Allié"
                    : store.effectTargeting.op.what === "Zone"
                      ? "la Zone"
                      : "l'Équipement"
                } à détruire`
              : `choisis l'Allié qui subit ${store.effectTargeting.op.n} Dommage(s)`
          }}
        </span>
        <div class="gcombat__btns">
          <button class="gbtn gbtn--ghost" @click="store.effectTargetSkip()">
            Passer
          </button>
        </div>
      </div>
    </Transition>

    <!-- ════════ Bandeau de combat (déclaration → blocage → résolution) ════════ -->
    <Transition name="slidedown">
      <div
        v-if="store.combat"
        class="gcombat"
        role="toolbar"
        aria-label="Combat en cours"
      >
        <span class="gcombat__step">
          {{
            store.combat.step === "attackers"
              ? "⚔ Choisis tes attaquants puis une cible adverse"
              : store.combat.step === "strikes"
                ? "🎯 Choisis le bloqueur qui encaisse la Force de l'attaquant en vert"
                : `🛡 ${store.players[opp].name} — déclare tes bloqueurs`
          }}
        </span>
        <span class="gcombat__info">
          {{ store.combat.attackers.length }} attaquant(s)
          <template v-if="store.combat.target"> · cible choisie</template>
          <template v-if="store.combat.step === 'blockers'">
            · {{ Object.keys(store.combat.blocks).length }} bloqueur(s)
          </template>
        </span>
        <div class="gcombat__btns">
          <button
            v-if="store.combat.step === 'attackers'"
            class="gbtn gbtn--accent"
            @click="store.combatConfirmAttackers()"
          >
            Confirmer l'attaque
          </button>
          <button
            v-else
            class="gbtn gbtn--accent"
            @click="store.combatResolve()"
          >
            Résoudre le combat
          </button>
          <button class="gbtn gbtn--ghost" @click="store.combatCancel()">
            Annuler
          </button>
        </div>
      </div>
    </Transition>

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
          <button
            v-if="canAttackSelected"
            class="gbtn gbtn--accent"
            @click="attackWithSelected"
          >
            ⚔ Attaquer
          </button>
          <button
            v-if="canActivateSelected"
            class="gbtn gbtn--accent"
            @click="activateSelected"
          >
            ⚡ Activer
          </button>
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
import { useToast } from "@/composables/useToast";

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
/** La carte Havre-Sac elle-même (vit dans le Monde, c'est le « socle » du joueur). */
function havreCard(seat: Seat): RedactedInstance[] {
  return mondeOwned(seat).filter((i) => i.instanceId === havreId(seat));
}
/** L'intérieur du Havre-Sac : Héros, Salles, Équipements… (zone `havreSac`). */
function interiorCards(seat: Seat): RedactedInstance[] {
  return instancesOf(view.value.seats[seat].havreSac);
}
/** Taille (capacité) du Havre-Sac = nombre d'emplacements intérieurs (2315). */
function havreTaille(seat: Seat): number {
  const inst = havreCard(seat)[0];
  const taille = resolveCard(inst?.cardId ?? null)?.stats?.taille;
  return typeof taille === "number" && taille > 0 ? taille : 4;
}
/** Une seule case « libre » visible (cible de dépôt) tant qu'il reste de la
 * place : la capacité totale est rappelée par le compteur du label, sinon
 * l'intérieur monopolise la largeur au détriment de la main. */
function emptyInteriorSlots(seat: Seat): number {
  return Math.min(
    1,
    Math.max(0, havreTaille(seat) - interiorCards(seat).length),
  );
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
    // règles assistées : un drop main → table passe par le moteur de règles
    // (légalité + inclinaison automatique des Ressources)
    const inst = store.state.instances[instanceId];
    const toPlay = spec.zone.zone === "monde" || spec.zone.zone === "havreSac";
    if (
      store.assist &&
      toPlay &&
      inst?.location.zone === "main" &&
      inst.owner === me.value
    ) {
      store.playFromHand(instanceId);
      return;
    }
    store.moveTo(instanceId, spec.zone, spec.position ?? { at: "any" });
  });
});
onUnmounted(() => {
  dnd.setDropHandler(null);
  dnd.resetZones();
});

// ── Refus de coup → toast ────────────────────────────────────────────────────
const toast = useToast();
watch(
  () => store.ruleError,
  (msg) => {
    if (msg) {
      toast.addToast(msg, { type: "warning" });
      store.clearRuleError();
    }
  },
);

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
  // effet à cible en cours : le clic désigne la cible
  if (store.effectTargeting) {
    store.effectTargetChoose(instanceId);
    return;
  }
  // combat en cours : les clics désignent attaquants / cible / bloqueurs
  if (store.combat) {
    if (store.combat.step === "attackers") {
      if (store.combatTargetIds.includes(instanceId))
        store.combatChooseTarget(instanceId);
      else store.combatToggleAttacker(instanceId);
    } else if (store.combat.step === "strikes") {
      store.combatChooseStrike(instanceId);
    } else {
      store.combatToggleBlock(instanceId);
    }
    return;
  }
  selectedId.value = selectedId.value === instanceId ? null : instanceId;
}

// ── Combat assisté : surbrillances + bouton Attaquer ────────────────────────
function slotCls(instanceId: string): Record<string, boolean> {
  if (store.effectTargeting) {
    return {
      "gslot--target-can": store.effectTargetIdsList.includes(instanceId),
    };
  }
  const c = store.combat;
  if (!c) return {};
  return {
    "gslot--atk-can":
      c.step === "attackers" && store.combatAttackerIds.includes(instanceId),
    "gslot--atk":
      c.attackers.includes(instanceId) ||
      (c.step === "strikes" && c.strikeFor === instanceId),
    "gslot--target-can":
      (c.step === "attackers" && store.combatTargetIds.includes(instanceId)) ||
      (c.step === "strikes" && store.combatStrikeIds.includes(instanceId)),
    "gslot--target": c.target?.instanceId === instanceId,
    "gslot--blk-can":
      c.step === "blockers" && store.combatBlockerIds.includes(instanceId),
    "gslot--blk": c.step === "blockers" && !!c.blocks[instanceId],
  };
}
const canAttackSelected = computed(() => {
  const inst = selectedInst.value;
  // N'offrir « Attaquer » que si la carte est un attaquant LÉGAL (redressé, hors
  // mal d'invocation, type combattant) ET qu'une attaque est déclarable ce tour
  // (1/tour, pas au premier tour) — sinon le bouton ouvrait un combat vide + erreur.
  return (
    store.assist &&
    !store.combat &&
    !!inst &&
    store.canDeclareAttack &&
    store.eligibleAttackerIds.includes(inst.instanceId)
  );
});
function attackWithSelected(): void {
  const id = selectedInst.value?.instanceId;
  selectedId.value = null;
  if (id) store.beginCombat(id);
}
const canActivateSelected = computed(() => {
  const inst = selectedInst.value;
  return (
    store.assist &&
    !store.combat &&
    !store.effectTargeting &&
    !!inst &&
    inst.controller === me.value &&
    inst.orientation === "upright" &&
    (inst.location.zone === "monde" || inst.location.zone === "havreSac") &&
    store.hasTapPower(inst.instanceId)
  );
});
function activateSelected(): void {
  const id = selectedInst.value?.instanceId;
  selectedId.value = null;
  if (id) store.activateTapPower(id);
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
  --card-field: clamp(82px, 6.9vw, 126px);
  --card-wide: clamp(74px, 6vw, 110px);
  --card-hand: clamp(100px, 8.6vw, 152px);
  --card-opp: clamp(56px, 4.6vw, 84px);
  --card-havre: clamp(84px, 6.9vw, 126px);
  --pile: clamp(58px, 5vw, 90px);
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px clamp(12px, 2.5vw, 36px);
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
  gap: 4px;
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
/* ── Havre-Sac : la carte (le socle) + son intérieur (Héros, Salles, Équip.) ── */
.ghavre {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.ghavre__bag,
.ghavre__inside {
  border: 1px solid rgba(240, 78, 34, 0.28);
  display: flex;
  align-items: center;
}
.ghavre__inside .gzone__cards {
  flex-wrap: nowrap;
}
/* Héros + Havre-Sac + Salles/Équip. : plus grands que les cartes adverses. */
.ghavre .gslot {
  width: var(--card-havre);
}
/* case vide de l'intérieur : matérialise l'espace disponible (dépôt) */
.gslot--ghost {
  aspect-ratio: 63 / 88;
  border: 1px dashed rgba(246, 245, 241, 0.16);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
}
.gzone--field {
  flex: 1;
  min-height: calc(var(--card-field) * 88 / 63 + 10px);
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

/* ── Combat : bandeau + surbrillances ── */
.gcombat {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  background: rgba(14, 11, 8, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(240, 78, 34, 0.5);
  border-radius: 999px;
  padding: 9px 22px;
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(240, 78, 34, 0.18);
}
.gcombat--effect {
  border-color: rgba(240, 166, 43, 0.55);
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(240, 166, 43, 0.2);
}
.gcombat__step {
  font-family: Fraunces, Georgia, serif;
  font-size: 15px;
}
.gcombat__info {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(246, 245, 241, 0.65);
}
.gcombat__btns {
  display: flex;
  gap: 6px;
}
.slidedown-enter-active,
.slidedown-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slidedown-enter-from,
.slidedown-leave-to {
  transform: translate(-50%, -14px);
  opacity: 0;
}
.gslot--atk-can :deep(.game-card),
.gslot--target-can :deep(.game-card),
.gslot--blk-can :deep(.game-card) {
  cursor: pointer;
}
.gslot--atk-can :deep(.game-card) {
  outline: 2px dashed rgba(95, 178, 42, 0.75);
  outline-offset: 1px;
}
.gslot--atk :deep(.game-card) {
  outline: 3px solid #5fb22a;
  outline-offset: 1px;
  box-shadow: 0 0 18px rgba(95, 178, 42, 0.5);
}
.gslot--target-can :deep(.game-card) {
  outline: 2px dashed rgba(240, 78, 34, 0.8);
  outline-offset: 1px;
}
.gslot--target :deep(.game-card) {
  outline: 3px solid #f04e22;
  outline-offset: 1px;
  box-shadow: 0 0 20px rgba(240, 78, 34, 0.6);
  animation: gtarget-pulse 1.2s ease-in-out infinite;
}
@keyframes gtarget-pulse {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(240, 78, 34, 0.6);
  }
  50% {
    box-shadow: 0 0 32px rgba(240, 78, 34, 0.85);
  }
}
.gslot--blk-can :deep(.game-card) {
  outline: 2px dashed rgba(31, 156, 236, 0.8);
  outline-offset: 1px;
}
.gslot--blk :deep(.game-card) {
  outline: 3px solid #1f9cec;
  outline-offset: 1px;
  box-shadow: 0 0 18px rgba(31, 156, 236, 0.55);
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
  .gendturn__ring,
  .gslot--target :deep(.game-card) {
    animation: none;
  }
  .zone-move,
  .zone-enter-active,
  .zone-leave-active {
    transition: none;
  }
}
</style>
