import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardDnd } from "../useBoardDnd";
import type { DropSpec } from "../useBoardDnd";

/** Fabrique un PointerEvent factice (jsdom n'implémente pas PointerEvent). */
function fakePointerDown(el: HTMLElement, x: number, y: number): PointerEvent {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    currentTarget: el,
  } as unknown as PointerEvent;
}

function firePointer(type: string, x: number, y: number): void {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  window.dispatchEvent(e);
}

function makeSource(): HTMLElement {
  const el = document.createElement("button");
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 63,
      bottom: 88,
      width: 63,
      height: 88,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function makeZone(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

const payload = (instanceId = "i1") => ({
  instanceId,
  card: null,
  imgSrc: "/images/cards/x.webp",
});

describe("useBoardDnd", () => {
  const dnd = useBoardDnd();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // purge l'état module-level entre les tests
    firePointer("pointerup", -1000, -1000);
    vi.runAllTimers();
    vi.useRealTimers();
    dnd.resetZones();
    dnd.setDropHandler(null);
    dnd.consumeClick();
    document.body.replaceChildren();
  });

  it("ne démarre pas de drag sous le seuil (clic simple non supprimé)", () => {
    dnd.armDrag(fakePointerDown(makeSource(), 10, 10), payload());
    firePointer("pointermove", 12, 13); // < 6 px
    firePointer("pointerup", 12, 13);
    expect(dnd.isDragging.value).toBe(false);
    expect(dnd.drag.value).toBeNull();
    expect(dnd.consumeClick()).toBe(false);
  });

  it("démarre au-delà du seuil, détecte la zone et déclenche le drop", () => {
    const drops: Array<{ id: string; spec: DropSpec }> = [];
    dnd.setDropHandler((id, spec) => drops.push({ id, spec }));
    const zone = makeZone({
      left: 200,
      top: 100,
      right: 400,
      bottom: 300,
      width: 200,
      height: 200,
    });
    dnd.registerZone("monde", zone, {
      zone: { zone: "monde" },
      label: "Monde",
    });

    dnd.armDrag(fakePointerDown(makeSource(), 10, 10), payload("ally-1"));
    firePointer("pointermove", 40, 40); // seuil franchi
    expect(dnd.isDragging.value).toBe(true);
    expect(dnd.drag.value?.instanceId).toBe("ally-1");

    firePointer("pointermove", 250, 150); // au-dessus de la zone
    expect(dnd.hoveredZoneId.value).toBe("monde");

    firePointer("pointerup", 250, 150);
    expect(drops).toHaveLength(1);
    expect(drops[0].id).toBe("ally-1");
    expect(drops[0].spec.zone).toEqual({ zone: "monde" });
    expect(dnd.drag.value).toBeNull();
    // le clic-écho du drag est consommé une seule fois
    expect(dnd.consumeClick()).toBe(true);
    expect(dnd.consumeClick()).toBe(false);
  });

  it("préfère la zone la plus petite en cas de chevauchement", () => {
    const big = makeZone({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
    });
    const small = makeZone({
      left: 100,
      top: 100,
      right: 200,
      bottom: 200,
      width: 100,
      height: 100,
    });
    dnd.registerZone("rangée", big, { zone: { zone: "monde" }, label: "" });
    dnd.registerZone("pile", small, {
      zone: { zone: "pioche", owner: "A" },
      label: "",
    });

    dnd.armDrag(fakePointerDown(makeSource(), 10, 10), payload());
    firePointer("pointermove", 150, 150);
    expect(dnd.hoveredZoneId.value).toBe("pile");
    firePointer("pointerup", -50, -50);
  });

  it("revient à l'origine si lâché hors zone (drop annulé)", () => {
    const handler = vi.fn();
    dnd.setDropHandler(handler);

    dnd.armDrag(fakePointerDown(makeSource(), 10, 10), payload());
    firePointer("pointermove", 300, 300);
    firePointer("pointerup", 300, 300);

    expect(handler).not.toHaveBeenCalled();
    expect(dnd.drag.value?.returning).toBe(true);
    expect(dnd.isDragging.value).toBe(false);
    vi.advanceTimersByTime(200);
    expect(dnd.drag.value).toBeNull();
  });
});
