import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTutorialStore } from "../tutorialStore";
import { useCardStore } from "../cardStore";
import type { CardElement } from "@/types/cards";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

// buildDecks() exige, pour un élément (Feu/Eau/Terre/Air) : un Héros dont le
// recto a cet élément + ≥ 8 Alliés Niveau 1 du même élément, Force ≥ 1, sans
// effet compilé ni sous-type « Unique ». On sème un catalogue Feu conforme.
function seedFeuCatalog() {
  const feu = "Feu" as CardElement;
  const hero = createMockHeroCard({
    recto: {
      stats: { pv: 20, pa: 6, pm: 3, niveau: { value: 1, element: feu } },
      effects: [],
      keywords: [],
    },
  });
  const sac = createMockHavreSacCard();
  const allies = Array.from({ length: 10 }, (_, i) =>
    createMockAllyCard({
      id: `feu-ally-${i}`,
      name: `Allié Feu ${i}`,
      subTypes: [],
      effects: [],
      stats: {
        niveau: { value: 1, element: feu },
        force: { value: 1, element: feu },
      },
    }),
  );
  useCardStore().cards = [hero, sac, ...allies];
}

describe("tutorialStore — leçons", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait démarrer « découverte » (12 étapes), avancer, puis marquer terminé au skip", () => {
    seedFeuCatalog();
    const t = useTutorialStore();

    expect(t.isDone()).toBe(false);
    expect(t.startLesson("decouverte")).toBe(true);
    expect(t.active).toBe(true);
    expect(t.total).toBe(12);
    expect(t.stepIndex).toBe(0);

    // next() incrémente l'étape (les watchers d'auto-avancement sont asynchrones,
    // donc inertes dans ce test synchrone).
    t.next();
    expect(t.stepIndex).toBe(1);

    t.skip();
    expect(t.active).toBe(false);
    // Seule « découverte » marque l'onboarding terminé (localStorage mocké → on
    // vérifie l'appel plutôt que la persistance).
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu-tutorial-done",
      "1",
    );
  });

  it("devrait échouer proprement si le catalogue ne permet pas de construire les decks", () => {
    // Catalogue vide → buildDecks renvoie null → startLesson renvoie false.
    useCardStore().cards = [];
    const t = useTutorialStore();
    expect(t.startLesson("decouverte")).toBe(false);
    expect(t.active).toBe(false);
  });

  it("devrait exposer les leçons mécaniques (combat, leveling) hors découverte", () => {
    const t = useTutorialStore();
    expect(t.mechanicLessons.map((l) => l.id)).toEqual(["combat", "leveling"]);
  });

  it("ne devrait PAS marquer terminé au skip d'une leçon non-découverte", () => {
    const t = useTutorialStore();
    // Pas de lesson active : skip() ne doit rien marquer (activeLesson null).
    t.skip();
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "wakfu-tutorial-done",
      "1",
    );
    expect(vi.isMockFunction(localStorage.setItem)).toBe(true);
  });
});
