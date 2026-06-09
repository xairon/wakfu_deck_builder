/**
 * Drag & drop du plateau de jeu (façon MTGA) — état global partagé.
 *
 * Remplace le DnD HTML5 natif : suivi pointer (souris + tactile), seuil de
 * 6 px pour distinguer clic et drag, registre de zones de drop (hit-test sur
 * rects snapshotés au début du drag), inclinaison de la carte selon la
 * vitesse, animation de retour si lâchée hors zone.
 *
 * Le visuel est rendu par un unique `DragLayer` ; les zones s'enregistrent
 * via `registerZone()` (callbacks `:ref` du plateau) ; le plateau fournit le
 * handler de drop via `setDropHandler()`.
 */
import { computed, ref, shallowRef } from "vue";
import type { Card } from "@/types/cards";
import type { Position, ZoneRef } from "@/game";

export interface DropSpec {
  zone: ZoneRef;
  position?: Position;
  label: string;
}

export interface DragPayload {
  instanceId: string;
  card: Card | null;
  imgSrc: string;
  /** Appelé quand le seuil est franchi (ex. masquer l'aperçu hover). */
  onStart?: () => void;
}

export interface ActiveDrag {
  instanceId: string;
  card: Card | null;
  imgSrc: string;
  width: number;
  height: number;
  /** Coin haut-gauche d'origine (retour si annulation). */
  originX: number;
  originY: number;
  /** Position du pointeur. */
  x: number;
  y: number;
  /** Décalage du point de saisie dans la carte. */
  grabDX: number;
  grabDY: number;
  /** Inclinaison (deg) selon la vitesse horizontale. */
  tilt: number;
  /** Animation de retour en cours (drop annulé). */
  returning: boolean;
}

type DropHandler = (instanceId: string, spec: DropSpec) => void;

const RETURN_MS = 180;
const THRESHOLD_PX = 6;

const drag = ref<ActiveDrag | null>(null);
const hoveredZoneId = ref<string | null>(null);

const zones = new Map<string, { el: HTMLElement; spec: DropSpec }>();
const zoneRects = new Map<string, DOMRect>();
const dropHandler = shallowRef<DropHandler | null>(null);

let suppressNextClick = false;
let returnTimer: ReturnType<typeof setTimeout> | null = null;

const isDragging = computed(() => !!drag.value && !drag.value.returning);

function snapshotZoneRects(): void {
  zoneRects.clear();
  for (const [id, { el }] of zones) {
    if (el.isConnected) zoneRects.set(id, el.getBoundingClientRect());
  }
}

function hitTest(x: number, y: number): string | null {
  let best: string | null = null;
  let bestArea = Infinity;
  for (const [id, r] of zoneRects) {
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = r.width * r.height;
    // zone la plus petite gagne (pile posée dans une rangée plus large)
    if (area < bestArea) {
      bestArea = area;
      best = id;
    }
  }
  return best;
}

function endReturn(): void {
  if (returnTimer) clearTimeout(returnTimer);
  returnTimer = setTimeout(() => {
    drag.value = null;
    returnTimer = null;
  }, RETURN_MS);
}

export function useBoardDnd() {
  /**
   * À appeler au `pointerdown` d'une carte draggable. Le drag ne démarre
   * qu'au-delà du seuil ; sinon le clic natif suit son cours.
   */
  function armDrag(e: PointerEvent, payload: DragPayload): void {
    if (e.button !== 0 || drag.value) return;
    const sourceEl = e.currentTarget as HTMLElement | null;
    if (!sourceEl) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let lastX = startX;

    function begin(ev: PointerEvent): void {
      const rect = sourceEl!.getBoundingClientRect();
      drag.value = {
        instanceId: payload.instanceId,
        card: payload.card,
        imgSrc: payload.imgSrc,
        width: rect.width,
        height: rect.height,
        originX: rect.left,
        originY: rect.top,
        x: ev.clientX,
        y: ev.clientY,
        grabDX: startX - rect.left,
        grabDY: startY - rect.top,
        tilt: 0,
        returning: false,
      };
      snapshotZoneRects();
      hoveredZoneId.value = hitTest(ev.clientX, ev.clientY);
      document.body.classList.add("gdnd-dragging");
      payload.onStart?.();
    }

    function onMove(ev: PointerEvent): void {
      if (!started) {
        if (
          Math.abs(ev.clientX - startX) < THRESHOLD_PX &&
          Math.abs(ev.clientY - startY) < THRESHOLD_PX
        )
          return;
        started = true;
        begin(ev);
      }
      const d = drag.value;
      if (!d || d.returning) return;
      const targetTilt = Math.max(
        -10,
        Math.min(10, (ev.clientX - lastX) * 1.1),
      );
      lastX = ev.clientX;
      d.x = ev.clientX;
      d.y = ev.clientY;
      d.tilt = d.tilt + (targetTilt - d.tilt) * 0.35;
      hoveredZoneId.value = hitTest(ev.clientX, ev.clientY);
    }

    function cleanup(): void {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    }

    function onUp(ev: PointerEvent): void {
      cleanup();
      if (!started) return; // clic simple : sélection native
      // Le clic-écho éventuel part dans la même passe d'événements ; si le
      // navigateur n'en émet pas (cibles down/up différentes), le drapeau
      // expire seul pour ne pas manger un clic légitime ultérieur.
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 0);
      document.body.classList.remove("gdnd-dragging");
      const zoneId = hitTest(ev.clientX, ev.clientY);
      const target = zoneId ? zones.get(zoneId) : null;
      hoveredZoneId.value = null;
      if (target && drag.value) {
        const id = drag.value.instanceId;
        drag.value = null;
        dropHandler.value?.(id, target.spec);
      } else if (drag.value) {
        drag.value.returning = true;
        endReturn();
      }
    }

    function onCancel(): void {
      cleanup();
      document.body.classList.remove("gdnd-dragging");
      hoveredZoneId.value = null;
      if (drag.value) {
        drag.value.returning = true;
        endReturn();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  /**
   * À appeler dans le handler `click` de la carte : retourne `true` (une
   * seule fois) si ce clic est l'écho d'un drag qui vient de se terminer.
   */
  function consumeClick(): boolean {
    if (!suppressNextClick) return false;
    suppressNextClick = false;
    return true;
  }

  /** Enregistre/désenregistre une zone de drop (callback `:ref`). */
  function registerZone(
    id: string,
    el: HTMLElement | null,
    spec?: DropSpec,
  ): void {
    if (el && spec) zones.set(id, { el, spec });
    else zones.delete(id);
  }

  function resetZones(): void {
    zones.clear();
    zoneRects.clear();
  }

  function setDropHandler(fn: DropHandler | null): void {
    dropHandler.value = fn;
  }

  return {
    drag,
    isDragging,
    hoveredZoneId,
    armDrag,
    consumeClick,
    registerZone,
    resetZones,
    setDropHandler,
  };
}
