import { describe, it, expect, beforeEach, vi } from "vitest";

// Utiliser vi.hoisted pour déclarer la ref avant le hoisting de vi.mock
const { mockStorageRef } = vi.hoisted(() => {
  // On ne peut pas appeler ref() ici car Vue n'est pas encore chargé au moment du hoist.
  // On retourne un objet mutable simple qui sera initialisé dans beforeEach.
  return { mockStorageRef: { value: "light" } as { value: string } };
});

vi.mock("@vueuse/core", () => ({
  useStorage: vi.fn((_key: string, _defaultValue: string) => {
    // Retourner l'objet proxy qui sera géré dans les tests
    return mockStorageRef;
  }),
}));

// Importer après le mock
import { useTheme } from "@/composables/useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser le thème
    mockStorageRef.value = "light";
    // Réinitialiser l'attribut data-theme du document
    document.documentElement.removeAttribute("data-theme");
  });

  describe("État initial", () => {
    it('devrait avoir le thème par défaut à "light"', () => {
      const { currentTheme } = useTheme();

      expect(currentTheme.value).toBe("light");
    });

    it("devrait exposer la liste des thèmes disponibles", () => {
      const { themes } = useTheme();

      expect(themes).toContain("light");
      expect(themes).toContain("dark");
      expect(themes).toHaveLength(2);
    });
  });

  describe("toggleTheme()", () => {
    it('devrait basculer de "light" à "dark"', () => {
      const { currentTheme, toggleTheme } = useTheme();
      mockStorageRef.value = "light";

      toggleTheme();

      expect(currentTheme.value).toBe("dark");
    });

    it('devrait basculer de "dark" à "light"', () => {
      const { currentTheme, toggleTheme } = useTheme();
      mockStorageRef.value = "dark";

      toggleTheme();

      expect(currentTheme.value).toBe("light");
    });

    it("devrait effectuer un cycle complet light -> dark -> light", () => {
      const { currentTheme, toggleTheme } = useTheme();
      mockStorageRef.value = "light";

      toggleTheme();
      expect(currentTheme.value).toBe("dark");

      toggleTheme();
      expect(currentTheme.value).toBe("light");
    });
  });

  describe("setTheme()", () => {
    it('devrait définir le thème à "dark"', () => {
      const { currentTheme, setTheme } = useTheme();

      setTheme("dark");

      expect(currentTheme.value).toBe("dark");
    });

    it('devrait définir le thème à "light"', () => {
      const { setTheme, currentTheme } = useTheme();
      mockStorageRef.value = "dark";

      setTheme("light");

      expect(currentTheme.value).toBe("light");
    });

    it("devrait mettre à jour l'attribut data-theme sur le document", () => {
      const { setTheme } = useTheme();

      setTheme("dark");

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("devrait mettre à jour data-theme lors du toggle", () => {
      const { toggleTheme } = useTheme();
      mockStorageRef.value = "light";

      toggleTheme();

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  describe("initTheme()", () => {
    it("devrait appliquer le thème courant au document", () => {
      const { initTheme } = useTheme();
      mockStorageRef.value = "dark";

      initTheme();

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it('devrait appliquer "light" si c\'est le thème courant', () => {
      const { initTheme } = useTheme();
      mockStorageRef.value = "light";

      initTheme();

      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("Persistance", () => {
    it("devrait persister le thème via le ref partagé (mockStorageRef)", () => {
      const { setTheme, currentTheme } = useTheme();

      setTheme("dark");

      // Le thème est persisté via le ref partagé qui simule useStorage
      expect(currentTheme.value).toBe("dark");
      expect(mockStorageRef.value).toBe("dark");
    });

    it("devrait conserver la valeur entre les appels à useTheme", () => {
      const { setTheme } = useTheme();
      setTheme("dark");

      // Appeler useTheme à nouveau devrait retrouver la même valeur
      const { currentTheme: theme2 } = useTheme();
      expect(theme2.value).toBe("dark");
    });
  });
});
