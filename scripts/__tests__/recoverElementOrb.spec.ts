import { describe, it, expect } from "vitest";
import { extractPrintedElement } from "../recoverElementOrb.mjs";

/** Bloc « Élément : [X] » (orbe en haut à droite), tel qu'archivé. */
const orb = (el: string) => `
  <div class="hstack gap-3">
    <div>
      Élément :
      <img
        class="symbole symbole-ressource"
        src="https://www.wtcg-return.fr/media/cache/symbole/ressource.png"
        alt="${el}"
        title="${el}"
      />
    </div>
  </div>`;

/** Bloc « Niveau : N [Neutre] » + « Force : ±N [X] » des Équipements. */
const forceLine = (value: string, el: string) => `
  <div class="hstack gap-3">
    <div>
      Niveau : 3
      <img class="symbole" alt="Neutre" title="Neutre" />
    </div>
    <div>
      Force : ${value}
      <img
        class="symbole symbole-ressource symbole-feu"
        src="https://www.wtcg-return.fr/media/cache/symbole/ressource.png"
        alt="${el}"
        title="${el}"
      />
    </div>
  </div>`;

describe("extractPrintedElement", () => {
  it("devrait lire l'orbe « Élément : [X] » en priorité", () => {
    expect(extractPrintedElement(orb("Air"))).toEqual({
      element: "Air",
      source: "orb",
    });
  });

  it("devrait remonter un orbe Neutre (backfill explicite)", () => {
    expect(extractPrintedElement(orb("Neutre"))).toEqual({
      element: "Neutre",
      source: "orb",
    });
  });

  it("devrait lire le symbole d'une Force POSITIVE faute d'orbe", () => {
    // Cas majoritaire des Équipements (« Force : +2 [Feu] », Bâton des Rois) :
    // c'est leur seul symbole coloré, donc leur Élément imprimé.
    expect(extractPrintedElement(forceLine("+2", "Feu"))).toEqual({
      element: "Feu",
      source: "force",
    });
  });

  it("devrait lire le symbole d'une Force NÉGATIVE faute d'orbe", () => {
    expect(extractPrintedElement(forceLine("-1", "Terre"))).toEqual({
      element: "Terre",
      source: "force",
    });
  });

  it("devrait lire le symbole d'une Force non signée faute d'orbe", () => {
    expect(extractPrintedElement(forceLine("1", "Eau"))).toEqual({
      element: "Eau",
      source: "force",
    });
  });

  it("devrait ignorer une Force Neutre (aucun symbole coloré à récupérer)", () => {
    expect(extractPrintedElement(forceLine("+1", "Neutre"))).toBeNull();
  });

  it("devrait ignorer la Force quand le JSON en porte déjà une (Alliés/Héros)", () => {
    // Ces cartes résolvent leur Élément via stats.force.element : pas de repli.
    expect(
      extractPrintedElement(forceLine("+2", "Feu"), { hasForceStat: true }),
    ).toBeNull();
  });

  it("devrait renvoyer null sans aucun symbole imprimé", () => {
    expect(extractPrintedElement("<div>Niveau : 3</div>")).toBeNull();
  });
});
